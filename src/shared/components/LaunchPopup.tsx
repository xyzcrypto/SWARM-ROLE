"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, AudioLines, ChevronRight, Coins, GraduationCap, MessageSquareHeart, Sparkles, Trophy, X } from "lucide-react";
import { activeLaunches, type Launch } from "@shared/utils/launches";

/**
 * "What's new" popup on the home page: the latest product launches (and admin
 * What's New entries from the last week) the visitor has not seen yet, one
 * card at a time. Close it with X, or it closes itself after AUTO_MS
 * (paused while hovered or touched). Seen items are remembered per browser.
 *
 * Nothing here renders on the server or the first client pass: the list is
 * built after mount, so it can never cause a hydration mismatch.
 */

const KEY = "xyz:launches:seen:v1";
const AUTO_MS = 8000;
const ICONS = { GraduationCap, AudioLines, Trophy, Coins, MessageSquareHeart, Sparkles } as const;

type Item = Pick<Launch, "id" | "product" | "title" | "body" | "href" | "cta" | "icon">;

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function writeSeen(ids: string[]) {
  try {
    const all = [...readSeen(), ...ids].slice(-80);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode: it will show again next visit */
  }
}

export function LaunchPopup() {
  const [items, setItems] = useState<Item[]>([]);
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const seen = readSeen();
      const now = Date.now();
      const list: Item[] = activeLaunches(now).filter((l) => !seen.has(l.id));
      try {
        const res = await fetch("/api/whatsnew?limit=4");
        const body = await res.json();
        for (const e of (body?.entries ?? []) as { id: string; date: string; tag: string; title: string; body: string }[]) {
          const id = `wn:${e.id}`;
          if (seen.has(id) || String(e.id).startsWith("static-")) continue;
          if (now - Date.parse(e.date) > 7 * 86_400_000) continue;
          list.push({ id, product: e.tag || "Update", title: e.title, body: e.body, href: "/#whats-new", cta: "Read more", icon: "Sparkles" });
        }
      } catch {
        /* launches alone are fine */
      }
      if (!alive || !list.length) return;
      setItems(list.slice(0, 5));
      setOpen(true);
    }, 1600);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  const close = useCallback(() => {
    writeSeen(items.map((x) => x.id));
    setOpen(false);
  }, [items]);

  // Auto-close: a progress bar runs for AUTO_MS per card, paused on hover/touch.
  useEffect(() => {
    if (!open || paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      elapsed.current += t - last;
      last = t;
      const p = Math.min(1, elapsed.current / AUTO_MS);
      setProgress(p);
      if (p >= 1) {
        if (i < items.length - 1) {
          elapsed.current = 0;
          setI((x) => x + 1);
        } else {
          close();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, paused, i, items.length, close]);

  const item = items[i];
  const Icon = item ? ICONS[item.icon] ?? Sparkles : Sparkles;

  return (
    <AnimatePresence>
      {open && item && (
        <motion.aside
          key="launch"
          role="dialog"
          aria-label="What's new on XYZ Crypto"
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          className="launch-pop fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-md overflow-hidden rounded-3xl border border-gold-400/35 bg-ink-950/95 shadow-elevate backdrop-blur-xl sm:inset-x-auto sm:bottom-6 sm:left-6 sm:mx-0 sm:w-[25rem]"
        >
          <div className="launch-pop-glow pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="relative flex items-center gap-1.5 rounded-full bg-gold-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gold-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-300" /> New · {item.product}
              </span>
              {items.length > 1 && (
                <span className="font-mono text-[10px] text-content-subtle">
                  {i + 1}/{items.length}
                </span>
              )}
              <button type="button" onClick={close} className="ml-auto rounded-full p-1.5 text-content-subtle transition-colors hover:bg-white/5 hover:text-content" aria-label="Close updates">
                <X className="h-4 w-4" />
              </button>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={item.id} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.25 }} className="mt-3 flex gap-3.5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-gold-400/30 bg-gradient-to-br from-gold-400/20 to-transparent text-gold-200">
                  <Icon className="h-6 w-6" strokeWidth={1.7} />
                </span>
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold leading-snug text-content">{item.title}</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-content-muted">{item.body}</p>
                </div>
              </motion.div>
            </AnimatePresence>
            <div className="mt-4 flex items-center gap-2">
              <Link href={item.href} onClick={close} className="btn-gold h-10 flex-1 justify-center text-sm">
                {item.cta} <ArrowRight className="h-4 w-4" />
              </Link>
              {i < items.length - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    elapsed.current = 0;
                    setProgress(0);
                    setI(i + 1);
                  }}
                  className="btn-secondary h-10 px-4 text-sm"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="h-1 w-full bg-white/[0.06]" aria-hidden>
            <div className="h-full bg-gradient-to-r from-gold-500 to-gold-200" style={{ width: `${(1 - progress) * 100}%` }} />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
