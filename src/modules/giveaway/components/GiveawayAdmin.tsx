"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Download, ExternalLink, Loader2, RefreshCw, Shuffle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { BUNGEE_LINKS, BUNGEE_PRIZE } from "../lib/bungee";

type Entry = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: "pending" | "verified" | "winner" | "rejected";
  note: string;
  bungeeUid: string;
  bungeeEmail: string;
  telegram: string;
  proofUrl: string | null;
  user: { id: string; name: string | null; username: string | null; email: string; joinedAt: string };
  lessonsDone: number;
  live: { played: number; score: number; correct: number; blurs: number };
  flags: { sameNetwork: number; sameBrowser: number; fastAnswers: number; tabSwitches: number; newAccount: boolean };
};
type Data = { open: boolean; totalLessons: number; liveHeld: number; entries: Entry[] };

const FILTERS = ["all", "pending", "verified", "winner", "rejected", "flagged"] as const;
type Filter = (typeof FILTERS)[number];

const flagged = (e: Entry) => e.flags.sameNetwork > 0 || e.flags.sameBrowser > 0 || e.flags.fastAnswers > 0 || e.flags.tabSwitches > 2;
const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";

async function fetchEntries(): Promise<Data> {
  const r = await fetch("/api/giveaway/bungee/admin", { cache: "no-store" });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || "Could not load entries.");
  return d as Data;
}

export function GiveawayAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"activity" | "newest" | "oldest">("activity");
  const [picks, setPicks] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetchEntries().then(
        (d) => {
          setData(d);
          setErr(null);
        },
        (e: Error) => setErr(e.message)
      ),
    []
  );
  useEffect(() => {
    let alive = true;
    fetchEntries().then(
      (d) => alive && setData(d),
      (e: Error) => alive && setErr(e.message)
    );
    return () => {
      alive = false;
    };
  }, []);

  const patch = async (body: Record<string, unknown>, key: string) => {
    setBusy(key);
    try {
      const r = await fetch("/api/giveaway/bungee/admin", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "Update failed.");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const rows = useMemo(() => {
    if (!data) return [];
    let list = data.entries.filter((e) => (filter === "all" ? true : filter === "flagged" ? flagged(e) : e.status === filter));
    list = [...list].sort((a, b) =>
      sort === "activity"
        ? b.live.played - a.live.played || b.live.score - a.live.score
        : sort === "newest"
          ? b.createdAt.localeCompare(a.createdAt)
          : a.createdAt.localeCompare(b.createdAt)
    );
    return list;
  }, [data, filter, sort]);

  // Random draw among verified entries (fair, uses the browser's CSPRNG). The
  // picks are only highlighted; marking a winner is a separate, deliberate click.
  const draw = () => {
    if (!data) return;
    const pool = data.entries.filter((e) => e.status === "verified");
    const out: string[] = [];
    const left = [...pool];
    while (out.length < 3 && left.length) {
      const r = new Uint32Array(1);
      crypto.getRandomValues(r);
      out.push(left.splice(r[0] % left.length, 1)[0].id);
    }
    setPicks(out);
    setFilter("all");
  };

  const csv = () => {
    if (!data) return;
    const head = ["status", "submitted_utc", "site_username", "site_email", "bungee_uid", "bungee_email", "telegram", "lessons_done", "live_played", "live_score", "live_correct", "same_network", "same_browser", "fast_answers", "tab_switches", "proof_url", "note"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = data.entries.map((e) =>
      [e.status, e.createdAt, e.user.username ?? "", e.user.email, e.bungeeUid, e.bungeeEmail, e.telegram, e.lessonsDone, e.live.played, e.live.score, e.live.correct, e.flags.sameNetwork, e.flags.sameBrowser, e.flags.fastAnswers, e.flags.tabSwitches, e.proofUrl?.startsWith("http") ? e.proofUrl : e.proofUrl ? "(inline image)" : "", e.note].map(esc).join(",")
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bungee-giveaway-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (err && !data)
    return (
      <div className="text-sm text-red-400">
        {err}{" "}
        <button type="button" onClick={() => void load()} className="underline">
          Retry
        </button>
      </div>
    );
  if (!data)
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading entries...
      </div>
    );

  const counts = Object.fromEntries(FILTERS.map((f) => [f, f === "all" ? data.entries.length : f === "flagged" ? data.entries.filter(flagged).length : data.entries.filter((e) => e.status === f).length]));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-gold-300">Giveaway</div>
          <h1 className="mt-1 font-display text-2xl font-semibold text-zinc-50">Bungee: {BUNGEE_PRIZE}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {data.entries.length} entries · {data.liveHeld} Bungee live quizzes so far · {data.totalLessons} lessons ·{" "}
            <Link href={BUNGEE_LINKS.giveaway} className="text-gold-300 hover:underline">
              /bungee
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void patch({ open: !data.open }, "open")} className={cn("h-10 rounded-xl px-4 text-sm font-semibold", data.open ? "bg-mint-500/15 text-mint-300 ring-1 ring-mint-500/30" : "bg-red-500/10 text-red-300 ring-1 ring-red-500/30")}>
            {busy === "open" ? <Loader2 className="inline h-4 w-4 animate-spin" /> : data.open ? "Entries open (click to close)" : "Entries closed (click to open)"}
          </button>
          <button type="button" onClick={draw} className="btn-ghost h-10 px-4 text-sm" title="Randomly highlight 3 verified entries">
            <Shuffle className="h-4 w-4" /> Draw 3 from verified
          </button>
          <button type="button" onClick={csv} className="btn-ghost h-10 px-4 text-sm">
            <Download className="h-4 w-4" /> CSV
          </button>
          <button type="button" onClick={() => void load()} className="btn-ghost h-10 px-3 text-sm" aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold capitalize ring-1", filter === f ? "bg-gold-400/15 text-gold-200 ring-gold-400/40" : "text-zinc-400 ring-white/10 hover:text-zinc-200")}>
            {f} ({counts[f]})
          </button>
        ))}
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="ml-auto rounded-lg border border-white/10 bg-ink-800 px-2 py-1.5 text-xs text-zinc-300">
          <option value="activity">Most live activity</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        Flags are signals, not verdicts. Same network can be family or a college Wi-Fi; check the Bungee UID, Telegram and proof before rejecting. Fast answers scored
        zero automatically. Tab switches are counted only while a live question was open.
      </p>

      <div className="mt-4 grid gap-3">
        {rows.length === 0 && <p className="text-sm text-zinc-500">No entries here yet.</p>}
        {rows.map((e) => {
          const picked = picks.includes(e.id);
          const isFlagged = flagged(e);
          return (
            <div key={e.id} className={cn("rounded-2xl border bg-ink-800/60 p-4", picked ? "border-gold-400/70 ring-2 ring-gold-400/30" : isFlagged ? "border-red-500/30" : "border-white/10")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {picked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/20 px-2 py-0.5 text-[0.6875rem] font-semibold text-gold-200">
                        <Trophy className="h-3 w-3" /> Drawn
                      </span>
                    )}
                    <span className="font-semibold text-zinc-100">{e.user.name || e.user.username || "Member"}</span>
                    {e.user.username && (
                      <Link href={`/u/${e.user.username}`} className="text-xs text-gold-300 hover:underline" target="_blank">
                        @{e.user.username}
                      </Link>
                    )}
                    <span className={cn("rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold capitalize", e.status === "winner" ? "bg-gold-400/20 text-gold-200" : e.status === "verified" ? "bg-mint-500/15 text-mint-300" : e.status === "rejected" ? "bg-red-500/15 text-red-300" : "bg-white/5 text-zinc-300")}>
                      {e.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Site: {e.user.email} · joined {fmt(e.user.joinedAt)} · entered {fmt(e.createdAt)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(["verified", "winner", "rejected", "pending"] as const).map((s) => (
                    <button key={s} type="button" disabled={busy === e.id || e.status === s} onClick={() => void patch({ id: e.id, status: s }, e.id)} className="rounded-lg px-2.5 py-1 text-xs font-semibold capitalize text-zinc-300 ring-1 ring-white/10 hover:text-gold-200 disabled:opacity-40">
                      {s === "verified" ? "Verify" : s === "winner" ? "Winner" : s === "rejected" ? "Reject" : "Reset"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <Info k="Bungee UID" v={e.bungeeUid} mono />
                <Info k="Bungee email" v={e.bungeeEmail} />
                <Info k="Telegram" v={e.telegram} href={e.telegram.startsWith("@") ? `https://t.me/${e.telegram.slice(1)}` : undefined} />
                <Info k="Lessons" v={`${e.lessonsDone} / ${data.totalLessons}`} warn={e.lessonsDone < data.totalLessons} />
                <Info k="Live quizzes" v={`${e.live.played} / ${data.liveHeld} played · ${e.live.correct} correct · ${e.live.score} pts`} />
                <div className="text-xs">
                  <div className="text-zinc-500">Proof</div>
                  {e.proofUrl ? (
                    <a href={e.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gold-300 hover:underline">
                      Open screenshot <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-red-300">missing</span>
                  )}
                </div>
              </div>

              {isFlagged || e.flags.newAccount ? (
                <div className="mt-3 flex flex-wrap gap-1.5 text-[0.6875rem]">
                  {e.flags.sameNetwork > 0 && <Flag text={`Same network as ${e.flags.sameNetwork} other entr${e.flags.sameNetwork === 1 ? "y" : "ies"}`} />}
                  {e.flags.sameBrowser > 0 && <Flag text={`Same browser as ${e.flags.sameBrowser} other entr${e.flags.sameBrowser === 1 ? "y" : "ies"}`} />}
                  {e.flags.fastAnswers > 0 && <Flag text={`${e.flags.fastAnswers} inhumanly fast live answers`} />}
                  {e.flags.tabSwitches > 0 && <Flag text={`${e.flags.tabSwitches} tab switches during live questions`} soft={e.flags.tabSwitches <= 2} />}
                  {e.flags.newAccount && <Flag text="Site account created within 24h of entering" soft />}
                </div>
              ) : null}

              <NoteBox initial={e.note} onSave={(note) => void patch({ id: e.id, status: e.status, note }, e.id)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Info({ k, v, mono, warn, href }: { k: string; v: string; mono?: boolean; warn?: boolean; href?: string }) {
  return (
    <div className="min-w-0 text-xs">
      <div className="text-zinc-500">{k}</div>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block truncate text-gold-300 hover:underline">
          {v}
        </a>
      ) : (
        <div className={cn("truncate", mono && "font-mono", warn ? "text-red-300" : "text-zinc-200")}>{v}</div>
      )}
    </div>
  );
}

function Flag({ text, soft }: { text: string; soft?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", soft ? "bg-white/5 text-zinc-400" : "bg-red-500/10 text-red-300")}>
      <AlertTriangle className="h-3 w-3" /> {text}
    </span>
  );
}

function NoteBox({ initial, onSave }: { initial: string; onSave: (note: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="mt-3 flex gap-2">
      <input value={v} onChange={(e) => setV(e.target.value)} maxLength={500} placeholder="Private note (staff only)" className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-ink-900/60 px-3 text-xs text-zinc-200 placeholder:text-zinc-600" />
      <button type="button" disabled={v === initial} onClick={() => onSave(v)} className="rounded-lg px-3 text-xs font-semibold text-zinc-300 ring-1 ring-white/10 hover:text-gold-200 disabled:opacity-40">
        Save
      </button>
    </div>
  );
}
