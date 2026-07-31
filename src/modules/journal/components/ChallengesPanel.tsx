"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Trophy, Users, ChevronDown, Check, Share2, CalendarDays } from "lucide-react";
import { cn, formatDateWithDay } from "@/lib/utils";
import { CalcField, CalcSegmented } from "@/components/tools/CalcField";
import { periodBreakdown } from "@/lib/journal-analytics";
import {
  challengeDayRange,
  daysElapsed,
  daysRemaining,
  isExpired,
  progressTowardTarget,
  totalDurationDays,
  DURATION_PRESETS,
  type LeaderboardEntry,
} from "@/lib/challenge";

type ChallengeSummary = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  startingCapital: number;
  targetCapital: number | null;
  visibility: string;
  status: string;
  creatorId: string;
  _count?: { participants: number; trades?: number };
};

type ChallengeTradeDetail = {
  side: string;
  symbol: string;
  fills: { kind: "entry" | "exit"; price: number; size: number; fee: number; executedAt: string }[];
};

type DayNote = { day: string; note: string | null; mood: string | null };

type ChallengeDetail = {
  challenge: ChallengeSummary;
  milestones: { id: string; label: string; targetDate: string | null; achieved: boolean }[];
  leaderboard: LeaderboardEntry[];
  myTrades: ChallengeTradeDetail[];
  dayNotes: DayNote[];
  isParticipant: boolean;
  isOwner: boolean;
};

const VISIBILITIES = [
  { value: "private" as const, label: "Private" },
  { value: "public" as const, label: "Public" },
  { value: "community" as const, label: "Community" },
];

function money(n: number): string {
  return `${n >= 0 ? "" : "-"}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function ChallengesPanel({ isPremium }: { isPremium: boolean }) {
  const [mine, setMine] = useState<ChallengeSummary[] | null>(null);
  const [discover, setDiscover] = useState<ChallengeSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/journal/challenges", { cache: "no-store" });
    const j = await res.json();
    if (res.ok) {
      setMine(j.mine ?? []);
      setDiscover(j.discover ?? []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function join(id: string) {
    await fetch(`/api/journal/challenges/${id}/join`, { method: "POST" }).catch(() => {});
    load();
  }

  if (mine === null) {
    return <div className="surface rounded-2xl p-8 text-center text-sm text-zinc-500">Loading challenges…</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-zinc-200">Your challenges</h2>
          <p className="mt-1 text-xs text-zinc-500">Custom-duration trading challenges - solo, public, or with a community.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-gold inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> New challenge
        </button>
      </div>

      {showForm && (
        <ChallengeForm
          isPremium={isPremium}
          onCreated={(id) => {
            setShowForm(false);
            setExpanded(id);
            load().then(() => {
              requestAnimationFrame(() => document.getElementById(`challenge-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
            });
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="space-y-3">
        {mine.length === 0 && (
          <div className="surface rounded-2xl p-8 text-center text-sm text-zinc-500">
            No challenges yet - start one, or join a public challenge below.
          </div>
        )}
        {mine.map((c) => (
          <ChallengeCard key={c.id} challenge={c} expanded={expanded === c.id} onToggle={() => setExpanded((e) => (e === c.id ? null : c.id))} />
        ))}
      </div>

      {discover.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-base font-semibold text-zinc-200">Discover</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {discover.map((c) => (
              <div key={c.id} className="surface rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-sm font-semibold text-zinc-100">{c.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {money(c.startingCapital)} start · {c._count?.participants ?? 0} joined
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300 ring-1 ring-violet-500/25">
                    <Users className="h-3 w-3" /> {c.visibility}
                  </span>
                </div>
                <button onClick={() => join(c.id)} className="btn-secondary mt-3 w-full text-xs">
                  Join
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChallengeCard({ challenge, expanded, onToggle }: { challenge: ChallengeSummary; expanded: boolean; onToggle: () => void }) {
  const [detail, setDetail] = useState<ChallengeDetail | null>(null);
  const { data: session } = useSession();
  const myId = (session?.user as any)?.id as string | undefined;
  const now = useMemo(() => new Date(), []);
  const c = challenge;
  const expired = isExpired(c, now);
  const elapsed = daysElapsed(c, now);
  const total = totalDurationDays(c);
  const remaining = daysRemaining(c, now);
  const myEntry = detail?.leaderboard.find((l) => l.userId === myId);

  useEffect(() => {
    if (expanded && !detail) {
      fetch(`/api/journal/challenges/${c.id}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => setDetail(j))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  return (
    <div id={`challenge-${c.id}`} className="surface surface-hover rounded-2xl scroll-mt-24">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left">
        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-semibold text-zinc-100">{c.title}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1", c.visibility === "private" ? "bg-white/5 text-zinc-400 ring-white/10" : "bg-violet-500/10 text-violet-300 ring-violet-500/25")}>
            {c.visibility}
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1", expired ? "bg-white/5 text-zinc-400 ring-white/10" : "bg-mint-500/10 text-mint-300 ring-mint-500/25")}>
            {expired ? "ended" : c.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>
            {elapsed}/{total}d
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </div>
      </button>

      {expanded && (
        <div className="space-y-5 border-t border-line p-4">
          {c.description && <p className="text-sm text-zinc-400">{c.description}</p>}

          <div className="grid gap-3 text-xs text-zinc-400 sm:grid-cols-3">
            <div>Starting capital: <span className="mono text-zinc-200">{money(c.startingCapital)}</span></div>
            {c.targetCapital && <div>Target: <span className="mono text-zinc-200">{money(c.targetCapital)}</span></div>}
            <div>{expired ? "Ended" : `${remaining} days left`}</div>
          </div>

          {detail && (
            <>
              {detail.leaderboard.length > 1 && (
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <Trophy className="h-3.5 w-3.5 text-gold-400" /> Leaderboard
                  </h3>
                  <div className="space-y-1.5">
                    {detail.leaderboard.map((l, i) => (
                      <div key={l.userId} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2 text-xs">
                        <span className="text-zinc-300">
                          <span className="mono text-zinc-600">#{i + 1}</span> {l.name}
                        </span>
                        <span className={cn("mono", l.returnPct >= 0 ? "text-mint-300" : "text-rose-300")}>{l.returnPct.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <MilestoneList challengeId={c.id} milestones={detail.milestones} isOwner={detail.isOwner} onChange={(ms) => setDetail((d) => (d ? { ...d, milestones: ms } : d))} />

              {detail.isParticipant && (
                <ChallengeDayTracker
                  challengeId={c.id}
                  challenge={c}
                  myTrades={detail.myTrades}
                  dayNotes={detail.dayNotes}
                  onChange={(notes) => setDetail((d) => (d ? { ...d, dayNotes: notes } : d))}
                />
              )}

              {c.targetCapital && myEntry && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Your progress to target</span>
                    <span>{(progressTowardTarget(c, myEntry.capital) ?? 0).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold-500 to-mint-500"
                      style={{ width: `${Math.max(0, Math.min(100, progressTowardTarget(c, myEntry.capital) ?? 0))}%` }}
                    />
                  </div>
                </div>
              )}

              {c.visibility !== "private" && (
                <a
                  href={`/api/journal/share/challenge/${c.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary inline-flex items-center gap-1.5 text-xs"
                >
                  <Share2 className="h-3.5 w-3.5" /> Share card
                </a>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const MOODS = [
  { value: "" as const, label: "—" },
  { value: "disciplined" as const, label: "Disciplined" },
  { value: "neutral" as const, label: "Neutral" },
  { value: "off-plan" as const, label: "Off-plan" },
];

const MOOD_TONE: Record<string, string> = {
  disciplined: "bg-mint-500/10 text-mint-300 ring-mint-500/25",
  neutral: "bg-white/5 text-zinc-400 ring-white/10",
  "off-plan": "bg-rose-500/10 text-rose-300 ring-rose-500/25",
};

// Day-by-day tracker within a challenge - P&L per day is DERIVED from the
// participant's own linked trades (periodBreakdown, already built for
// Analytics), never stored. Only the optional note + mood are persisted
// (ChallengeDayNote), one row per participant per day.
function ChallengeDayTracker({
  challengeId,
  challenge,
  myTrades,
  dayNotes,
  onChange,
}: {
  challengeId: string;
  challenge: ChallengeSummary;
  myTrades: ChallengeTradeDetail[];
  dayNotes: DayNote[];
  onChange: (notes: DayNote[]) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const days = useMemo(() => challengeDayRange(challenge, now), [challenge, now]);
  const pnlByDay = useMemo(() => new Map(periodBreakdown(myTrades, "day").map((b) => [b.period, b])), [myTrades]);
  const noteByDay = useMemo(() => new Map(dayNotes.map((n) => [n.day, n])), [dayNotes]);

  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [moodDraft, setMoodDraft] = useState<(typeof MOODS)[number]["value"]>("");
  const [saving, setSaving] = useState(false);

  function openDay(day: string) {
    const existing = noteByDay.get(day);
    setNoteDraft(existing?.note ?? "");
    setMoodDraft((existing?.mood as (typeof MOODS)[number]["value"]) ?? "");
    setEditingDay(day);
  }

  async function save() {
    if (!editingDay) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/journal/challenges/${challengeId}/days`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: editingDay, note: noteDraft || null, mood: moodDraft || null }),
      });
      const j = await res.json();
      if (res.ok) {
        onChange([...dayNotes.filter((n) => n.day !== editingDay), j.dayNote]);
        setEditingDay(null);
      }
    } finally {
      setSaving(false);
    }
  }

  if (days.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        <CalendarDays className="h-3.5 w-3.5 text-gold-400" /> Day by day
      </h3>
      <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
        {[...days].reverse().map((day) => {
          const bucket = pnlByDay.get(day);
          const note = noteByDay.get(day);
          const isEditing = editingDay === day;
          return (
            <div key={day} className="rounded-lg bg-white/[0.02]">
              <button onClick={() => (isEditing ? setEditingDay(null) : openDay(day))} className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-xs">
                <span className="mono text-zinc-500">{formatDateWithDay(day)}</span>
                {bucket && (
                  <span className={cn("mono rounded-full px-1.5 py-0.5 text-[10px]", bucket.pnl >= 0 ? "bg-mint-500/10 text-mint-300" : "bg-rose-500/10 text-rose-300")}>
                    {bucket.pnl >= 0 ? "+" : ""}${bucket.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                )}
                {note?.mood && <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] ring-1", MOOD_TONE[note.mood])}>{note.mood}</span>}
                {note?.note && <span className="flex-1 truncate text-zinc-500">{note.note}</span>}
              </button>
              {isEditing && (
                <div className="space-y-2 border-t border-line/50 px-3 py-3">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="How did today go? Did you follow your plan?"
                    rows={2}
                    maxLength={1000}
                    className="w-full rounded-lg border border-white/10 bg-ink-700/60 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-gold-500/50"
                  />
                  <CalcSegmented options={MOODS} value={moodDraft} onChange={setMoodDraft} />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingDay(null)} className="btn-ghost px-3 py-1.5 text-xs">
                      Cancel
                    </button>
                    <button onClick={save} disabled={saving} className="btn-gold px-3 py-1.5 text-xs disabled:opacity-50">
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MilestoneList({
  challengeId,
  milestones,
  isOwner,
  onChange,
}: {
  challengeId: string;
  milestones: { id: string; label: string; targetDate: string | null; achieved: boolean }[];
  isOwner: boolean;
  onChange: (ms: { id: string; label: string; targetDate: string | null; achieved: boolean }[]) => void;
}) {
  const [label, setLabel] = useState("");

  async function toggle(id: string, achieved: boolean) {
    const res = await fetch(`/api/journal/challenges/${challengeId}/milestones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ achieved }),
    });
    if (res.ok) onChange(milestones.map((m) => (m.id === id ? { ...m, achieved } : m)));
  }

  async function add() {
    if (!label.trim()) return;
    const res = await fetch(`/api/journal/challenges/${challengeId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim() }),
    });
    const j = await res.json();
    if (res.ok) {
      onChange([...milestones, j.milestone]);
      setLabel("");
    }
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Milestones</h3>
      <div className="space-y-1.5">
        {milestones.map((m) => (
          <button
            key={m.id}
            onClick={() => isOwner && toggle(m.id, !m.achieved)}
            disabled={!isOwner}
            className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors", m.achieved ? "bg-mint-500/[0.06] text-mint-300" : "bg-white/[0.02] text-zinc-400")}
          >
            <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1", m.achieved ? "bg-mint-500/20 ring-mint-500/40" : "ring-white/15")}>
              {m.achieved && <Check className="h-2.5 w-2.5" />}
            </span>
            {m.label}
          </button>
        ))}
      </div>
      {isOwner && (
        <div className="mt-2 flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Add a checkpoint…"
            className="flex-1 rounded-lg border border-white/10 bg-ink-700/60 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-gold-500/50"
          />
          <button onClick={add} className="btn-secondary px-3 py-2 text-xs">
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function ChallengeForm({ isPremium, onCreated, onCancel }: { isPremium: boolean; onCreated: (id: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preset, setPreset] = useState<number | "custom">(90);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10));
  const [startingCapital, setStartingCapital] = useState("10000");
  const [targetCapital, setTargetCapital] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public" | "community">("private");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyPreset(days: number) {
    setPreset(days);
    const start = new Date();
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(new Date(start.getTime() + days * 86_400_000).toISOString().slice(0, 10));
  }

  async function submit() {
    if (!title.trim() || !(Number(startingCapital) > 0)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/journal/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description || undefined,
          startDate: new Date(startDate).getTime(),
          endDate: new Date(endDate).getTime(),
          startingCapital: Number(startingCapital),
          targetCapital: targetCapital ? Number(targetCapital) : undefined,
          visibility,
        }),
      });
      const j = await res.json();
      if (res.ok) onCreated(j.challenge.id);
      else setError(j.error ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface space-y-5 rounded-3xl p-6 sm:p-7">
      <h3 className="font-display text-lg font-semibold text-zinc-50">New challenge</h3>
      {!isPremium && (
        <p className="rounded-xl border border-gold-500/20 bg-gold-500/[0.05] px-4 py-2.5 text-xs text-gold-200">
          Free members can run 1 active challenge at a time. <a href="/premium" className="underline decoration-gold-400/40 underline-offset-2 hover:text-gold-100">Upgrade to Premium</a> for unlimited challenges.
        </p>
      )}
      {error && <p className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-2.5 text-xs text-rose-200">{error}</p>}

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="4-Month Funded Challenge" className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-gold-500/50" />
      </label>

      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Duration</span>
        <div className="flex flex-wrap gap-1.5">
          {DURATION_PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => applyPreset(p.days)}
              className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors", preset === p.days ? "border-gold-500/40 bg-gold-500/15 text-gold-100" : "border-white/10 text-zinc-400 hover:border-gold-500/40 hover:text-gold-200")}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPreset("custom")}
            className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors", preset === "custom" ? "border-gold-500/40 bg-gold-500/15 text-gold-100" : "border-white/10 text-zinc-400 hover:border-gold-500/40 hover:text-gold-200")}
          >
            Custom
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Start date</span>
          <input type="date" value={startDate} onChange={(e) => { setPreset("custom"); setStartDate(e.target.value); }} className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-gold-500/50" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">End date</span>
          <input type="date" value={endDate} onChange={(e) => { setPreset("custom"); setEndDate(e.target.value); }} className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-gold-500/50" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CalcField label="Starting capital" value={startingCapital} onChange={setStartingCapital} suffix="USD" />
        <CalcField label="Target capital" value={targetCapital} onChange={setTargetCapital} suffix="USD (optional)" />
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-gold-500/50" />
      </label>

      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Visibility</span>
        <CalcSegmented options={VISIBILITIES} value={visibility} onChange={setVisibility} />
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
        <button onClick={submit} disabled={busy} className="btn-gold disabled:opacity-50">
          {busy ? "Creating…" : "Create challenge"}
        </button>
      </div>
    </div>
  );
}
