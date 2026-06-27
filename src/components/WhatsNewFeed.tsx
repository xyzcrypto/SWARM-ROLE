"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, Wrench, Bug, Megaphone, ShieldCheck, Map } from "lucide-react";
import { Reveal } from "./Reveal";
import { formatDate } from "@/lib/utils";
import { WHATS_NEW_TAGS, type WhatsNewEntry, type WhatsNewTag } from "@/lib/whatsnew";

const tagStyle: Record<WhatsNewTag, { ring: string; text: string; Icon: typeof Sparkles }> = {
  New: { ring: "ring-mint-500/30 bg-mint-500/10", text: "text-mint-200", Icon: Sparkles },
  Improved: { ring: "ring-gold-500/30 bg-gold-500/10", text: "text-gold-200", Icon: Wrench },
  Fixed: { ring: "ring-violet-400/30 bg-violet-500/10", text: "text-violet-200", Icon: Bug },
  Announcement: { ring: "ring-sky-500/30 bg-sky-500/10", text: "text-sky-200", Icon: Megaphone },
  Security: { ring: "ring-red-500/30 bg-red-500/10", text: "text-red-200", Icon: ShieldCheck },
  Roadmap: { ring: "ring-zinc-400/30 bg-white/5", text: "text-zinc-200", Icon: Map },
};

type Realtime = { url: string; anonKey: string };

/**
 * Tabbed, realtime-aware "What's New" feed. Seeded from the server (DB or static
 * fallback); when Supabase realtime is configured it refetches on a
 * `whatsnew_updated` broadcast so newly-shipped entries appear without a reload.
 * Degrades gracefully — without realtime the homepage ISR + revalidatePath on
 * publish still surface new entries on the next visit.
 */
export function WhatsNewFeed({ entries: initial, realtime }: { entries: WhatsNewEntry[]; realtime?: Realtime }) {
  const [entries, setEntries] = useState<WhatsNewEntry[]>(initial);
  const [active, setActive] = useState<"All" | WhatsNewTag>("All");

  // Tabs: "All" + only the tags actually present, in catalog order.
  const tabs = useMemo<("All" | WhatsNewTag)[]>(() => {
    const present = new Set(entries.map((e) => e.tag));
    return ["All", ...WHATS_NEW_TAGS.filter((t) => present.has(t))];
  }, [entries]);

  const visible = active === "All" ? entries : entries.filter((e) => e.tag === active);

  useEffect(() => {
    if (!realtime?.url || !realtime?.anonKey) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { createClient } = await import("@supabase/supabase-js");
      if (cancelled) return;
      const client = createClient(realtime.url, realtime.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const ch = client.channel("notifications");
      ch.on("broadcast", { event: "whatsnew_updated" }, async () => {
        const data = await fetch("/api/whatsnew?limit=12", { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => null);
        if (data?.entries) setEntries(data.entries as WhatsNewEntry[]);
      }).subscribe();
      cleanup = () => client.removeChannel(ch);
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [realtime?.url, realtime?.anonKey]);

  if (entries.length === 0) return null;

  return (
    <>
      {tabs.length > 2 && (
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                active === t
                  ? "bg-gold-shine text-ink shadow-gold-sm"
                  : "border border-line bg-white/5 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2">
        {visible.slice(0, 8).map((e, i) => {
          const s = tagStyle[e.tag] ?? tagStyle.New;
          return (
            <Reveal key={e.id ?? `${e.title}-${i}`} delay={i % 4} variant="pop">
              <div className="surface surface-hover lift group h-full rounded-3xl p-6">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${s.ring} ${s.text}`}
                  >
                    <s.Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    {e.tag}
                  </span>
                  <span className="mono text-[11px] text-zinc-500">{formatDate(e.date)}</span>
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-zinc-100">{e.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{e.body}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
