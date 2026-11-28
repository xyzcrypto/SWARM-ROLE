"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Award, BarChart3, BookOpen, CheckCircle2, Loader2, Pause, Play, Radio, RefreshCw, Settings2, Square, Users, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson, postJson } from "../../client/hooks";
import type { adminOverview } from "@modules/academy/lib/admin";
import { Avatar, fmt, Pill, Stat, utcDate } from "../ui";
import { ContentEditor } from "./ContentEditor";
import { SettingsEditor } from "./SettingsEditor";

export type Overview = Awaited<ReturnType<typeof adminOverview>>;
export const adminPost = <T,>(body: unknown) => postJson<T>("/api/admin/academy", body);

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "content", label: "Content", icon: BookOpen },
  { id: "live", label: "Live quizzes", icon: Radio },
  { id: "certs", label: "Certificates", icon: Award },
  { id: "learners", label: "Learners", icon: Users },
  { id: "settings", label: "Rewards & rules", icon: Settings2 },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-content-subtle">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-[0.6875rem] text-content-subtle">{hint}</span>}
    </label>
  );
}
export const inputCls = "w-full rounded-xl border border-hairline bg-ink-900/80 px-3 py-2.5 text-sm text-content placeholder:text-content-subtle focus:border-gold-400/50 focus:outline-none";

export function Toast({ msg, onClose }: { msg: { ok: boolean; text: string } | null; onClose: () => void }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [msg, onClose]);
  if (!msg) return null;
  return (
    <div className={cn("fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-elevate", msg.ok ? "border-mint-400/40 bg-ink-900 text-mint-200" : "border-red-400/40 bg-ink-900 text-red-200")} role="status">
      {msg.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      {msg.text}
    </div>
  );
}

export function AcademyAdmin() {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Overview | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await getJson<Overview>("/api/admin/academy"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const run = useCallback(
    async (body: unknown, ok: string) => {
      try {
        const r = await adminPost<Record<string, unknown>>(body);
        setToast({ ok: true, text: ok });
        await load();
        return r;
      } catch (e) {
        setToast({ ok: false, text: (e as Error).message });
        return null;
      }
    },
    [load]
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-xs font-semibold text-content-subtle hover:text-gold-300">
            ← Admin dashboard
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold text-content">Academy admin</h1>
          <p className="mt-1 text-sm text-content-muted">Lessons, questions, live quizzes, certificates and every reward rule. All changes are audit-logged.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/academy" className="btn-ghost h-10 px-4 text-sm">
            Open Academy
          </Link>
          <button type="button" onClick={load} className="btn-secondary h-10 px-4 text-sm">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-white/10 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-semibold", tab === t.id ? "border-b-2 border-gold-400 text-gold-100" : "text-content-subtle hover:text-content")}
          >
            <t.icon className="h-4 w-4" /> {t.label}
            {t.id === "certs" && data?.stats.pendingCerts ? <span className="rounded-full bg-gold-400/20 px-1.5 text-[0.625rem] text-gold-200">{data.stats.pendingCerts}</span> : null}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {error ? (
          <div className="rounded-2xl border border-red-400/30 p-6 text-sm text-red-300">{error}</div>
        ) : !data ? (
          <div className="grid min-h-[40vh] place-items-center">
            <Loader2 className="h-7 w-7 animate-spin text-gold-300" />
          </div>
        ) : tab === "overview" ? (
          <OverviewTab data={data} />
        ) : tab === "content" ? (
          <ContentEditor data={data} run={run} />
        ) : tab === "live" ? (
          <LiveTab data={data} run={run} />
        ) : tab === "certs" ? (
          <CertsTab data={data} run={run} />
        ) : tab === "learners" ? (
          <LearnersTab data={data} run={run} />
        ) : (
          <SettingsEditor data={data} run={run} />
        )}
      </div>
      <Toast msg={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function OverviewTab({ data }: { data: Overview }) {
  const s = data.stats;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Learners" value={fmt(s.learners)} accent />
        <Stat label="Quizzes today" value={fmt(s.quizzesToday)} sub={`${fmt(s.quizzesWeek)} in 7 days`} />
        <Stat label="Answers (7d)" value={fmt(s.answersWeek)} sub={s.accuracyWeek == null ? "–" : `${s.accuracyWeek}% correct`} />
        <Stat label="XP issued (7d)" value={fmt(s.xpWeek)} sub={`${fmt(s.questions)} questions in bank`} />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="surface rounded-3xl p-5">
          <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-content-subtle">Top learners (all-time)</div>
          <ul className="space-y-1.5">
            {data.top.map((u, i) => (
              <li key={u.userId} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-center font-mono text-xs text-content-subtle">{i + 1}</span>
                <Avatar src={u.image} alt={u.name ?? "?"} size={26} />
                <span className="min-w-0 flex-1 truncate text-content">{u.name}</span>
                <span className="text-xs text-content-subtle">L{u.level} · {u.accuracy ?? "–"}% · {u.streak}d</span>
                <span className="w-16 text-right font-mono text-xs text-gold-200">{fmt(u.xp)}</span>
              </li>
            ))}
            {!data.top.length && <li className="text-sm text-content-subtle">No learners yet.</li>}
          </ul>
        </div>
        <div className="surface rounded-3xl p-5">
          <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-content-subtle">Lesson completions</div>
          <ul className="space-y-2 text-sm">
            {data.categories.map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-content-muted">{c.title}</span>
                <span className="font-mono text-xs text-content-subtle">{c.modules.reduce((n, m) => n + m.completions, 0)} completions</span>
                {!c.published && <Pill>hidden</Pill>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function toLocalInput(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function LiveTab({ data, run }: { data: Overview; run: (b: unknown, ok: string) => Promise<unknown> }) {
  const [f, setF] = useState(() => ({ title: "", description: "", when: toLocalInput(Date.now() + 3600_000), count: 10, category: "", difficulty: "mixed", questionSec: 20, revealSec: 7 }));
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    await run(
      { op: "live.create", title: f.title, description: f.description, scheduledAt: new Date(f.when).getTime(), count: f.count, category: f.category || null, difficulty: f.difficulty, questionSec: f.questionSec, revealSec: f.revealSec },
      "Live quiz scheduled"
    );
    setBusy(false);
  };
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="surface space-y-4 rounded-3xl p-5">
        <div className="font-display text-lg font-semibold text-content">Schedule a live quiz</div>
        <Field label="Title">
          <input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Friday Night DeFi Showdown" />
        </Field>
        <Field label="Description">
          <input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Optional" />
        </Field>
        <Field label="Starts (your local time)" hint="It goes live by itself at this time. You can also start it early.">
          <input type="datetime-local" className={inputCls} value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Questions">
            <input type="number" min={3} max={30} className={inputCls} value={f.count} onChange={(e) => setF({ ...f, count: Number(e.target.value) })} />
          </Field>
          <Field label="Difficulty">
            <select className={inputCls} value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}>
              {["mixed", "easy", "medium", "hard", "expert"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Seconds / question">
            <input type="number" min={8} max={90} className={inputCls} value={f.questionSec} onChange={(e) => setF({ ...f, questionSec: Number(e.target.value) })} />
          </Field>
          <Field label="Reveal seconds">
            <input type="number" min={3} max={30} className={inputCls} value={f.revealSec} onChange={(e) => setF({ ...f, revealSec: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Topic">
          <select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option value="">All topics</option>
            {data.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
        <button type="button" onClick={create} disabled={busy || f.title.trim().length < 3} className="btn-primary h-11 w-full justify-center text-sm disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />} Schedule
        </button>
      </div>
      <div className="surface rounded-3xl p-5">
        <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-content-subtle">Sessions</div>
        <ul className="space-y-2">
          {data.live.map((l) => {
            const open = l.status === "scheduled" || l.status === "live";
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-hairline p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-content">{l.title}</span>
                    <Pill tone={l.status === "live" ? "border-mint-400/50 text-mint-300" : l.status === "scheduled" ? "border-gold-400/40 text-gold-300" : undefined}>{l.paused ? "paused" : l.status}</Pill>
                  </div>
                  <div className="text-xs text-content-subtle">
                    {new Date(l.scheduledAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · {l.questions} Q · {l.participants} players
                  </div>
                </div>
                <Link href={`/academy/live/${l.id}`} className="btn-ghost h-9 px-3 text-xs" target="_blank">
                  Watch
                </Link>
                {open && !l.startedAt && (
                  <button type="button" className="btn-primary h-9 px-3 text-xs" onClick={() => run({ op: "live.host", id: l.id, action: "start" }, "Starting in 6 seconds")}>
                    <Play className="h-3.5 w-3.5" /> Start now
                  </button>
                )}
                {l.status === "live" && !l.paused && (
                  <button type="button" className="btn-secondary h-9 px-3 text-xs" onClick={() => run({ op: "live.host", id: l.id, action: "pause" }, "Paused")}>
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </button>
                )}
                {l.paused && (
                  <button type="button" className="btn-secondary h-9 px-3 text-xs" onClick={() => run({ op: "live.host", id: l.id, action: "resume" }, "Resumed")}>
                    <Play className="h-3.5 w-3.5" /> Resume
                  </button>
                )}
                {open && (
                  <button
                    type="button"
                    className="btn-ghost h-9 px-3 text-xs"
                    onClick={() => {
                      if (confirm(l.startedAt ? "End this quiz now and award the winners?" : "Cancel this scheduled quiz?")) void run({ op: "live.host", id: l.id, action: l.startedAt ? "end" : "cancel" }, l.startedAt ? "Ended" : "Cancelled");
                    }}
                  >
                    <Square className="h-3.5 w-3.5" /> {l.startedAt ? "End" : "Cancel"}
                  </button>
                )}
              </li>
            );
          })}
          {!data.live.length && <li className="text-sm text-content-subtle">No live quizzes yet.</li>}
        </ul>
      </div>
    </div>
  );
}

function CertsTab({ data, run }: { data: Overview; run: (b: unknown, ok: string) => Promise<unknown> }) {
  const [f, setF] = useState({ user: "", kind: "event", title: "", periodKey: "", rank: 1, score: 0 });
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="space-y-5">
        <div className="surface space-y-4 rounded-3xl p-5">
          <div className="font-display text-lg font-semibold text-content">Issue a certificate</div>
          <p className="text-xs text-content-subtle">For special events and all-time milestones. Period winners are issued automatically when a period closes.</p>
          <Field label="Member" hint="User id, @handle or email">
            <input className={inputCls} value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind">
              <select className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                <option value="event">Special event</option>
                <option value="milestone">Milestone</option>
              </select>
            </Field>
            <Field label="Rank">
              <input type="number" min={1} className={inputCls} value={f.rank} onChange={(e) => setF({ ...f, rank: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Title" hint="Leave empty for the default title">
            <input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Special Event Champion" />
          </Field>
          <Field label="Event / milestone name" hint="Shown on the certificate. One certificate per member per name.">
            <input className={inputCls} value={f.periodKey} onChange={(e) => setF({ ...f, periodKey: e.target.value })} placeholder="Devcon India 2026 Quiz" />
          </Field>
          <Field label="Score">
            <input type="number" min={0} className={inputCls} value={f.score} onChange={(e) => setF({ ...f, score: Number(e.target.value) })} />
          </Field>
          <button
            type="button"
            className="btn-gold h-11 w-full justify-center text-sm disabled:opacity-50"
            disabled={!f.user || f.periodKey.trim().length < 2}
            onClick={() => run({ op: "cert.issue", ...f, periodKey: `event:${f.periodKey.trim()}`, title: f.title || undefined }, "Certificate issued")}
          >
            <Award className="h-4 w-4" /> Issue certificate
          </button>
        </div>
        <button type="button" className="btn-secondary h-11 w-full justify-center text-sm" onClick={() => run({ op: "finalize" }, "Finished periods closed")}>
          <RefreshCw className="h-4 w-4" /> Close finished periods now
        </button>
      </div>
      <div className="surface rounded-3xl p-5">
        <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-content-subtle">Latest certificates</div>
        <ul className="space-y-2">
          {data.certificates.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-hairline p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-content">{c.displayName}</span>
                  <Pill tone={c.status === "issued" ? "border-mint-400/40 text-mint-300" : c.status === "pending" ? "border-gold-400/40 text-gold-300" : "border-red-400/40 text-red-300"}>{c.status}</Pill>
                </div>
                <div className="text-xs text-content-subtle">
                  {c.title} · #{c.rank} · {c.periodKey} · {utcDate(c.issuedAt)} · <span className="font-mono">{c.code}</span>
                </div>
              </div>
              <Link href={`/academy/certificate/${c.code}`} target="_blank" className="btn-ghost h-8 px-3 text-xs">
                View
              </Link>
              {c.status !== "issued" && (
                <button type="button" className="btn-primary h-8 px-3 text-xs" onClick={() => run({ op: "cert.status", id: c.id, status: "issued" }, "Approved")}>
                  Approve
                </button>
              )}
              {c.status !== "revoked" && (
                <button type="button" className="btn-ghost h-8 px-3 text-xs text-red-300" onClick={() => confirm("Revoke this certificate? Its public page will say REVOKED.") && run({ op: "cert.status", id: c.id, status: "revoked" }, "Revoked")}>
                  Revoke
                </button>
              )}
            </li>
          ))}
          {!data.certificates.length && <li className="text-sm text-content-subtle">No certificates yet.</li>}
        </ul>
      </div>
    </div>
  );
}

function LearnersTab({ data, run }: { data: Overview; run: (b: unknown, ok: string) => Promise<unknown> }) {
  const [f, setF] = useState({ user: "", amount: 100, note: "" });
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="surface space-y-4 rounded-3xl p-5">
        <div className="font-display text-lg font-semibold text-content">Award XP</div>
        <p className="text-xs text-content-subtle">For special challenges and events. Written to the same ledger as earned XP, with your note, and audit-logged.</p>
        <Field label="Member" hint="User id, @handle or email">
          <input className={inputCls} value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} />
        </Field>
        <Field label="XP">
          <input type="number" min={1} className={inputCls} value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} />
        </Field>
        <Field label="Reason">
          <input className={inputCls} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Community event winner" />
        </Field>
        <button type="button" className="btn-gold h-11 w-full justify-center text-sm disabled:opacity-50" disabled={!f.user || f.note.trim().length < 2 || f.amount < 1} onClick={() => run({ op: "xp.grant", ...f }, "XP awarded")}>
          Award XP
        </button>
      </div>
      <div className="surface overflow-x-auto rounded-3xl p-5">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="text-left text-[0.625rem] uppercase tracking-[0.14em] text-content-subtle">
              <th className="pb-2">Learner</th>
              <th className="pb-2 text-right">XP</th>
              <th className="pb-2 text-right">Level</th>
              <th className="pb-2 text-right">Quizzes</th>
              <th className="pb-2 text-right">Accuracy</th>
              <th className="pb-2 text-right">Streak</th>
            </tr>
          </thead>
          <tbody>
            {data.top.map((u) => (
              <tr key={u.userId} className="border-t border-hairline">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <Avatar src={u.image} alt={u.name ?? "?"} size={24} />
                    <span className="text-content">{u.name}</span>
                    {u.username && <span className="text-xs text-content-subtle">@{u.username}</span>}
                  </div>
                </td>
                <td className="py-2 text-right font-mono text-gold-200">{fmt(u.xp)}</td>
                <td className="py-2 text-right">{u.level}</td>
                <td className="py-2 text-right">{u.quizzes}</td>
                <td className="py-2 text-right">{u.accuracy ?? "–"}%</td>
                <td className="py-2 text-right">{u.streak}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
