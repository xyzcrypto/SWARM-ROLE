"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Eye, Inbox, Loader2, RotateCcw, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES, type Status } from "../lib/shared";

type Item = {
  id: string;
  category: string;
  rating: number;
  message: string;
  page: string;
  image: string | null;
  status: string;
  xp: number;
  createdAt: string;
  name: string | null;
  contact: string | null;
  user: { id: string; name: string | null; email: string; username: string | null; image: string | null } | null;
};
type Data = { items: Item[]; next: string | null; stats: { total: number; avgRating: number; new: number; seen: number; done: number } };

const FILTERS: { id: Status | "all"; label: string }[] = [
  { id: "new", label: "New" },
  { id: "seen", label: "Seen" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
];

// Times are shown in UTC on purpose: same text on server and client.
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + " UTC";

/** Staff triage for /feedback: filter, read, mark seen / done (done pays the member XP once). */
export function FeedbackAdmin() {
  const [filter, setFilter] = useState<Status | "all">("new");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  const load = useCallback(async (f: Status | "all", cursor?: string) => {
    setError(null);
    const qs = new URLSearchParams();
    if (f !== "all") qs.set("status", f);
    if (cursor) qs.set("cursor", cursor);
    const r = await fetch(`/api/admin/feedback?${qs}`);
    const body = await r.json().catch(() => null);
    if (!r.ok) throw new Error(body?.error || "Couldn't load feedback.");
    return body as Data;
  }, []);

  useEffect(() => {
    let alive = true;
    setData(null);
    load(filter)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [filter, load]);

  const setStatus = async (id: string, status: Status) => {
    setBusy(id);
    try {
      const r = await fetch("/api/admin/feedback", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      const body = await r.json().catch(() => null);
      if (!r.ok) throw new Error(body?.error || "Couldn't update.");
      setData((d) => {
        if (!d) return d;
        const before = d.items.find((i) => i.id === id)?.status as Status | undefined;
        const items = filter === "all" ? d.items.map((i) => (i.id === id ? { ...i, status } : i)) : d.items.filter((i) => i.id !== id);
        const stats = { ...d.stats };
        if (before && before !== status) {
          stats[before] = Math.max(0, stats[before] - 1);
          stats[status] += 1;
        }
        return { ...d, items, stats };
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-content-subtle hover:text-content">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-content">Feedback</h1>
          <p className="mt-1 text-sm text-content-muted">Every note from /feedback. New ones also arrive by email and Telegram.</p>
        </div>
        {data && (
          <div className="flex flex-wrap gap-2">
            {[
              { k: "Total", v: data.stats.total },
              { k: "New", v: data.stats.new },
              { k: "Avg rating", v: data.stats.avgRating ? data.stats.avgRating.toFixed(1) : "–" },
              { k: "Shipped", v: data.stats.done },
            ].map((s) => (
              <div key={s.k} className="surface rounded-2xl px-4 py-2.5 text-center">
                <div className="font-mono text-lg font-bold text-content">{s.v}</div>
                <div className="text-[0.625rem] uppercase tracking-[0.14em] text-content-subtle">{s.k}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-1.5 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn("h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors", filter === f.id ? "bg-gold-400/15 text-gold-100" : "text-content-subtle hover:text-content")}
          >
            {f.label}
            {data && f.id !== "all" ? <span className="ml-1.5 font-mono text-[0.6875rem] opacity-70">{data.stats[f.id]}</span> : null}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      <div className="mt-4 space-y-3">
        {!data && !error && (
          <div className="flex items-center gap-2 py-10 text-sm text-content-subtle">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}
        {data && data.items.length === 0 && (
          <div className="surface flex flex-col items-center rounded-3xl py-14 text-center">
            <Inbox className="h-8 w-8 text-content-subtle" />
            <p className="mt-3 text-sm text-content-muted">Nothing here.</p>
          </div>
        )}
        {data?.items.map((it) => {
          const c = CATEGORIES.find((x) => x.id === it.category);
          const who = it.user ? it.user.name || (it.user.username ? `@${it.user.username}` : "Member") : it.name || "Guest";
          const reach = it.user ? it.user.email : it.contact;
          return (
            <article key={it.id} id={it.id} className="surface scroll-mt-28 rounded-3xl p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                <span className="rounded-full bg-white/[0.05] px-2.5 py-1 font-semibold text-content">
                  {c?.emoji} {c?.label ?? it.category}
                </span>
                <span className="flex items-center gap-0.5 text-gold-300" aria-label={`${it.rating} of 5`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className={cn("h-3.5 w-3.5", i < it.rating ? "fill-current" : "opacity-25")} />
                  ))}
                </span>
                <span className="font-semibold text-content">
                  {it.user?.username ? (
                    <Link href={`/u/${it.user.username}`} className="hover:underline">
                      {who}
                    </Link>
                  ) : (
                    who
                  )}
                </span>
                {reach && <span className="text-content-subtle">{reach}</span>}
                {!it.user && <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[0.625rem] text-content-subtle">guest</span>}
                <span className="ml-auto text-content-subtle">{when(it.createdAt)}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-content">{it.message}</p>
              {it.image && (
                <a href={it.image} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.image} alt="Attached screenshot" className="max-h-56 rounded-xl border border-hairline object-contain" loading="lazy" />
                </a>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {it.page && <span className="font-mono text-[0.6875rem] text-content-subtle">from {it.page}</span>}
                {it.xp > 0 && <span className="rounded-full bg-mint-400/10 px-2 py-0.5 font-mono text-[0.625rem] text-mint-300">+{it.xp} XP paid</span>}
                <div className="ml-auto flex gap-1.5">
                  {busy === it.id && <Loader2 className="h-4 w-4 animate-spin self-center text-content-subtle" />}
                  {it.status !== "seen" && (
                    <button type="button" disabled={busy === it.id} onClick={() => setStatus(it.id, "seen")} className="btn-secondary h-8 px-3 text-xs">
                      <Eye className="h-3.5 w-3.5" /> Seen
                    </button>
                  )}
                  {it.status !== "done" && (
                    <button type="button" disabled={busy === it.id} onClick={() => setStatus(it.id, "done")} className="btn-gold h-8 px-3 text-xs" title={it.user ? "Marks it shipped and pays the member 100 XP" : "Marks it shipped"}>
                      <Check className="h-3.5 w-3.5" /> Done
                    </button>
                  )}
                  {it.status !== "new" && (
                    <button type="button" disabled={busy === it.id} onClick={() => setStatus(it.id, "new")} className="btn-ghost h-8 px-3 text-xs">
                      <RotateCcw className="h-3.5 w-3.5" /> Reopen
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
        {data?.next && (
          <button
            type="button"
            disabled={more}
            onClick={async () => {
              setMore(true);
              try {
                const d = await load(filter, data.next!);
                setData((p) => (p ? { ...d, items: [...p.items, ...d.items] } : d));
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setMore(false);
              }
            }}
            className="btn-secondary mx-auto mt-2 flex h-10 px-5 text-sm"
          >
            {more ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Load more
          </button>
        )}
      </div>
    </div>
  );
}
