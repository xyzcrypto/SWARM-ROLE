"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatDateTime, maskEmail } from "@/lib/utils";
import { PostEditor } from "./PostEditor";
import { PostManager } from "./PostManager";
import { PERMISSIONS, ALL_PERMISSIONS, hasPermission, type Permission } from "@/lib/permissions";
import { WhatsNewManager } from "./WhatsNewManager";
import { useRealtime } from "@/lib/useRealtime";
import { getRealtimeClient } from "@/lib/realtimeClient";

type Viewer = { id: string; permissions: string[]; isSuperAdmin: boolean };

type Stats = {
  totalUsers: number;
  googleUsers: number;
  emailUsers: number;
  last7days: number;
  premiumUsers: number;
  subscribers: number;
  totalPosts: number;
  totalVisits: number;
  todayVisits: number;
  totalPostViews: number;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  provider: string;
  role: string;
  membership: string;
  createdAt: string;
  lastLoginAt: string | null;
};

type PostRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  published: boolean;
  premium: boolean;
  views: number;
  createdAt: string;
};

type Realtime = { url: string; anonKey: string };
type Tab =
  | "overview"
  | "premium"
  | "publish"
  | "content"
  | "members"
  | "access"
  | "whatsnew"
  | "moderation"
  | "subscribers"
  | "activity"
  | "aiusage";
/** Integration status booleans (names only - never values/secrets). */
export type HealthFlags = { storage: boolean; realtime: boolean; upstash: boolean; email: boolean; google: boolean; github: boolean; twitter: boolean; ai: boolean };

/* ----------------------- realtime hooks (admin) ----------------------- */
function useLiveOnline(realtime: Realtime) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!realtime.url || !realtime.anonKey) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const client = await getRealtimeClient(realtime.url, realtime.anonKey);
      if (cancelled) return;
      const ch = client.channel("site-visitors", {
        config: { presence: { key: `admin-${Math.random().toString(36).slice(2)}` } },
      });
      ch.on("presence", { event: "sync" }, () => setCount(Object.keys(ch.presenceState()).length)).subscribe(
        (status) => {
          if (status === "SUBSCRIBED") ch.track({ at: Date.now() });
        }
      );
      cleanup = () => client.removeChannel(ch);
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [realtime.url, realtime.anonKey]);
  return count;
}

function useMembersChannel(realtime: Realtime, onChange: (id: string, membership: string) => void) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    if (!realtime.url || !realtime.anonKey) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const client = await getRealtimeClient(realtime.url, realtime.anonKey);
      if (cancelled) return;
      const ch = client.channel("members");
      ch.on("broadcast", { event: "membership_changed" }, ({ payload }) => {
        const p = payload as { id: string; membership: string };
        cb.current(p.id, p.membership);
      }).subscribe();
      cleanup = () => client.removeChannel(ch);
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [realtime.url, realtime.anonKey]);
}

async function setMembership(id: string, membership: "Free" | "Premium") {
  const res = await fetch(`/api/users/${id}/membership`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ membership }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not update membership.");
  }
}

/* ------------------------------- shell ------------------------------- */
export function DashboardClient({
  stats,
  recentUsers,
  premiumMembers,
  posts,
  adminName,
  realtime,
  viewer,
  health,
}: {
  stats: Stats;
  recentUsers: UserRow[];
  premiumMembers: UserRow[];
  posts: PostRow[];
  adminName: string;
  realtime: Realtime;
  viewer: Viewer;
  health: HealthFlags;
}) {
  const liveOnline = useLiveOnline(realtime);

  // Only show tabs the viewer is allowed to use (Super Admins see all). Server
  // routes re-check the capability, so this is UX, not the security boundary.
  const allTabs: { id: Tab; label: string; perm: Permission }[] = [
    { id: "overview", label: "Overview", perm: "dashboard:view" },
    { id: "premium", label: "Premium", perm: "premium:manage" },
    { id: "publish", label: "Publish", perm: "post:publish" },
    { id: "content", label: "Content", perm: "post:manage" },
    { id: "moderation", label: "Moderation", perm: "post:manage" },
    { id: "members", label: "Members", perm: "users:manage" },
    { id: "subscribers", label: "Subscribers", perm: "users:manage" },
    { id: "whatsnew", label: "What's New", perm: "whatsnew:manage" },
    { id: "access", label: "Access", perm: "users:roles" },
    { id: "activity", label: "Activity", perm: "users:roles" },
    { id: "aiusage", label: "AI Usage", perm: "ai:manage" },
  ];
  const tabs = allTabs.filter((t) => hasPermission(viewer, t.perm));

  // Default to the first tab the viewer can actually see (a staff member with only,
  // say, What's New shouldn't land on a hidden "overview" tab and see a blank page).
  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? "overview");

  return (
    <div>
      <div className="mb-8">
        <span className="eyebrow eyebrow-glass text-gold-200">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
          <span className="mono text-[11px] uppercase tracking-[0.18em]">Admin</span>
        </span>
        <h1 className="mt-2 font-display text-3xl font-bold text-zinc-50 sm:text-4xl">
          Welcome, {adminName.split(" ")[0]} 👋
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Manage signups, publish Web3 research and grow the XYZ Crypto ecosystem.
        </p>
      </div>

      <div className="mb-8 flex flex-wrap gap-2 border-b border-white/10 pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-b-2 border-gold-400 text-gold-100 shadow-[0_6px_16px_-8px_rgba(226,167,47,0.6)]"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
            {t.id === "premium" && (
              <span className="ml-1.5 rounded-full bg-gold-500/15 px-1.5 text-[10px] text-gold-200">
                {stats.premiumUsers}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview stats={stats} liveOnline={liveOnline} health={health} />}
      {tab === "premium" && <PremiumMembers initial={premiumMembers} realtime={realtime} />}
      {tab === "publish" && <PublishPanel />}
      {tab === "content" && <PostManager posts={posts} />}
      {tab === "moderation" && <ModerationPanel />}
      {tab === "members" && <Members users={recentUsers} realtime={realtime} />}
      {tab === "subscribers" && <SubscribersPanel />}
      {tab === "whatsnew" && <WhatsNewManager />}
      {tab === "access" && <AccessPanel viewer={viewer} />}
      {tab === "activity" && <ActivityPanel />}
      {tab === "aiusage" && <AiUsagePanel />}
    </div>
  );
}

/* ----------------------------- Overview ----------------------------- */
type Accent = "gold" | "mint" | "plain";

type DailyPoint = { day: string; count: number };

/**
 * Compact single-series area chart (30 daily points). Follows the dataviz
 * rules: one series (title names it - no legend), recessive grid, thin 2px
 * line, hover crosshair + tooltip, direct max label, sr-only data table as
 * the low-contrast relief. Hues come from --chart-* (validated per theme).
 */
function TrendChart({ title, points, tone }: { title: string; points: DailyPoint[]; tone: "mint" | "gold" }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 300;
  const H = 72;
  const PAD = 4;
  const max = Math.max(1, ...points.map((p) => p.count));
  const total = points.reduce((s, p) => s + p.count, 0);
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  const x = (i: number) => PAD + i * stepX;
  const y = (c: number) => H - PAD - (c / max) * (H - PAD * 2);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;
  const color = tone === "mint" ? "var(--chart-mint)" : "var(--chart-gold)";
  const maxIdx = points.reduce((best, p, i) => (p.count > points[best]!.count ? i : best), 0);
  const fmtDay = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round((px - PAD) / (stepX || 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  }

  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-zinc-500">{title}</p>
        <p className="mono text-sm font-semibold text-zinc-300">{total.toLocaleString("en-US")} / 30d</p>
      </div>
      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-20 w-full"
          role="img"
          aria-label={`${title}: ${total} total over the last 30 days`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* recessive grid: midline only */}
          <line x1={PAD} x2={W - PAD} y1={y(max / 2)} y2={y(max / 2)} stroke="currentColor" className="text-zinc-500/20" strokeWidth="1" />
          <path d={area} fill={color} opacity="0.16" />
          <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {/* direct label on the peak (relief for low-contrast fills) */}
          {points[maxIdx]!.count > 0 && hover === null && (
            <text x={Math.min(W - 24, Math.max(14, x(maxIdx)))} y={Math.max(10, y(points[maxIdx]!.count) - 5)} textAnchor="middle" className="fill-zinc-400 mono" fontSize="9">
              {points[maxIdx]!.count.toLocaleString("en-US")}
            </text>
          )}
          {hover !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={PAD} y2={H - PAD} stroke="currentColor" className="text-zinc-500/40" strokeWidth="1" />
              <circle cx={x(hover)} cy={y(points[hover]!.count)} r="3.5" fill={color} stroke="var(--surface)" strokeWidth="2" />
            </>
          )}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-ink-800/95 px-2 py-1 mono text-[10px] text-zinc-200 shadow-elevate"
            style={{ left: `${((x(hover) / W) * 100).toFixed(1)}%` }}
          >
            {fmtDay(points[hover]!.day)} · {points[hover]!.count.toLocaleString("en-US")}
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between mono text-[9px] text-zinc-600">
        <span>{points.length ? fmtDay(points[0]!.day) : ""}</span>
        <span>{points.length ? fmtDay(points[points.length - 1]!.day) : ""}</span>
      </div>
      {/* Accessible data table (also the contrast-relief required by the palette check). */}
      <table className="sr-only">
        <caption>{title} - daily values, last 30 days</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.day}>
              <td>{p.day}</td>
              <td>{p.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value, hint, accent = "plain" }: { label: string; value: number; hint: string; accent?: Accent }) {
  const num =
    accent === "mint" ? "text-mint-gradient" : accent === "gold" ? "text-gold-gradient" : "text-zinc-50";
  return (
    <div className="surface surface-hover lift rounded-2xl p-6">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`mt-2 mono text-4xl font-semibold ${num}`}>{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-zinc-600">{hint}</p>
    </div>
  );
}

function Overview({ stats: initialStats, liveOnline, health }: { stats: Stats; liveOnline: number; health: HealthFlags }) {
  const [stats, setStats] = useState(initialStats);
  const [series, setSeries] = useState<{ signups: DailyPoint[]; views: DailyPoint[] } | null>(null);

  // 30-day trends (cached endpoint; fetched once per mount).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/timeseries", { cache: "no-store" });
        const d = await res.json().catch(() => null);
        if (!cancelled && res.ok && d?.signups && d?.views) {
          setSeries({ signups: d.signups, views: d.views });
        }
      } catch {
        /* charts are progressive enhancement */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/stats", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.stats) setStats(data.stats as Stats);
    } catch {
      /* keep last known numbers */
    }
  }, []);

  // Live refresh: instant on new post/comment (notifications ping) + a gentle
  // 30s backstop for signups/visits. The endpoint is cached → negligible DB load.
  useRealtime({ channel: "notifications", event: "ping", onMessage: refresh });
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Traffic/engagement → mint; headline business metrics → gold; the rest stay
  // neutral white. Consistent accent system gives the grid hierarchy instead of
  // a wall of identical gold numbers.
  const analytics: { label: string; value: number; hint: string; accent: Accent }[] = [
    { label: "Total visits", value: stats.totalVisits, hint: "All page views tracked", accent: "mint" },
    { label: "Visits today", value: stats.todayVisits, hint: "Since midnight", accent: "mint" },
    { label: "Post views", value: stats.totalPostViews, hint: "Across all articles", accent: "mint" },
  ];
  const cards: { label: string; value: number; hint: string; accent: Accent }[] = [
    { label: "Total signups", value: stats.totalUsers, hint: "All registered users", accent: "gold" },
    { label: "New (7 days)", value: stats.last7days, hint: "Signed up this week", accent: "plain" },
    { label: "Google sign-ins", value: stats.googleUsers, hint: "Via Gmail / Google", accent: "plain" },
    { label: "Email sign-ups", value: stats.emailUsers, hint: "Email + password", accent: "plain" },
    { label: "Premium members", value: stats.premiumUsers, hint: "Upgraded accounts", accent: "gold" },
    { label: "Waitlist emails", value: stats.subscribers, hint: "Captured via email forms", accent: "plain" },
    { label: "Published content", value: stats.totalPosts, hint: "Research, articles & posts", accent: "gold" },
  ];
  return (
    <div className="space-y-6">
      {/* Live + analytics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface rounded-2xl p-6 ring-1 ring-mint-500/20">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-mint-400" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-mint-400" />
            </span>
            <p className="text-sm text-zinc-400">Live online</p>
          </div>
          <p className="mt-2 mono text-4xl font-semibold text-mint-gradient">{liveOnline}</p>
          <p className="mt-1 text-xs text-zinc-600">Visitors on the site right now</p>
        </div>
        {analytics.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {/* 30-day trends */}
      {series && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TrendChart title="Signups per day" points={series.signups} tone="gold" />
          <TrendChart title="Page views per day" points={series.views} tone="mint" />
        </div>
      )}

      {/* Signups / content */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {/* Integration health - booleans only, never values. */}
      <div className="surface rounded-2xl p-5">
        <p className="text-sm text-zinc-500">Integrations</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["Database", true],
              ["Realtime", health.realtime],
              ["Storage", health.storage],
              ["Rate limits", health.upstash],
              ["Email", health.email],
              ["Google login", health.google],
              ["GitHub login", health.github],
              ["X login", health.twitter],
              ["XYZ AI", health.ai],
            ] as const
          ).map(([label, on]) => (
            <span
              key={label}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
                on ? "bg-mint-500/10 text-mint-200 ring-mint-500/25" : "bg-white/5 text-zinc-500 ring-white/10"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-mint-400" : "bg-zinc-600"}`} />
              {label}
              {!on && <span className="text-zinc-600">· not configured</span>}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          Unconfigured integrations degrade gracefully - see docs/HANDOFF.md for setup.
        </p>
      </div>
    </div>
  );
}

/* --------------------------- Moderation ---------------------------- */
type ModComment = {
  id: string;
  body: string;
  status: string;
  createdAt: string;
  authorName: string;
  postTitle: string;
  postSlug: string;
};
type ModMessage = {
  id: string;
  body: string;
  status: string;
  createdAt: string;
  author: { name: string | null; username: string | null };
};

function ModerationPanel() {
  const [view, setView] = useState<"comments" | "chat">("comments");
  const [statusFilter, setStatusFilter] = useState<"all" | "visible" | "hidden">("all");
  const [comments, setComments] = useState<ModComment[]>([]);
  const [messages, setMessages] = useState<ModMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url =
        view === "comments"
          ? `/api/comments?status=${statusFilter}`
          : `/api/chat/messages/moderate?status=${statusFilter}`;
      const res = await fetch(url, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not load.");
      if (view === "comments") setComments(d.comments ?? []);
      else setMessages(d.messages ?? []);
    } catch (e: any) {
      setError(e.message || "Could not load.");
    } finally {
      setLoading(false);
    }
  }, [view, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function setCommentStatus(id: string, status: "visible" | "hidden") {
    setBusy(id);
    try {
      const res = await fetch(`/api/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed.");
      setComments((arr) => arr.map((c) => (c.id === id ? { ...c, status } : c)));
    } catch (e: any) {
      setError(e.message || "Failed.");
    } finally {
      setBusy(null);
    }
  }

  async function setMessageStatus(id: string, action: "hide" | "restore") {
    setBusy(id);
    try {
      const res = await fetch("/api/chat/messages/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed.");
      setMessages((arr) => arr.map((m) => (m.id === id ? { ...m, status: action === "hide" ? "hidden" : "visible" } : m)));
    } catch (e: any) {
      setError(e.message || "Failed.");
    } finally {
      setBusy(null);
    }
  }

  // One-click recovery: un-hide EVERY hidden chat message (soft-deletes only -
  // nothing is ever destroyed, so "deleted" messages can always come back).
  async function restoreAllMessages() {
    if (!confirm("Restore ALL hidden chat messages? They will reappear for everyone.")) return;
    setBusy("restore_all");
    setError("");
    try {
      const res = await fetch("/api/chat/messages/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore_all" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed.");
      setMessages((arr) => arr.map((m) => ({ ...m, status: "visible" })));
    } catch (e: any) {
      setError(e.message || "Failed.");
    } finally {
      setBusy(null);
    }
  }

  const hiddenCount = view === "chat" ? messages.filter((m) => m.status === "hidden").length : 0;

  const StatusBadge = ({ status }: { status: string }) =>
    status === "hidden" ? (
      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-300 ring-1 ring-red-500/25">Hidden</span>
    ) : (
      <span className="rounded-full bg-mint-500/10 px-2 py-0.5 text-[10px] font-medium text-mint-300 ring-1 ring-mint-500/25">Visible</span>
    );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["comments", "chat"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              view === v ? "bg-gold-500/15 text-gold-100 ring-1 ring-gold-500/30" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {v === "comments" ? "Comments" : "Chat messages"}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          {(["all", "visible", "hidden"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                statusFilter === s ? "bg-white/10 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {s[0]!.toUpperCase() + s.slice(1)}
            </button>
          ))}
          {view === "chat" && hiddenCount > 0 && (
            <button
              onClick={restoreAllMessages}
              disabled={busy === "restore_all"}
              className="ml-2 rounded-lg border border-mint-500/30 px-2.5 py-1 text-xs font-medium text-mint-200 transition-colors hover:bg-mint-500/10 disabled:opacity-50"
            >
              {busy === "restore_all" ? "Restoring…" : `Restore all hidden (${hiddenCount})`}
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">{error}</p>}
      {loading ? (
        <p className="rounded-2xl border border-line bg-white/[0.02] px-5 py-10 text-center text-sm text-zinc-500">Loading…</p>
      ) : view === "comments" ? (
        comments.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white/[0.02] px-5 py-10 text-center text-sm text-zinc-500">Nothing to review.</p>
        ) : (
          <ul className="space-y-2">
            {comments.map((c) => (
              <li key={c.id} className="surface rounded-2xl p-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                  <span className="font-medium text-zinc-300">{c.authorName}</span>
                  <span>on</span>
                  <a href={`/research/${c.postSlug}`} target="_blank" className="text-gold-200 hover:underline">
                    {c.postTitle}
                  </a>
                  <span>· {formatDateTime(c.createdAt)}</span>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-300">{c.body}</p>
                <div className="mt-2 flex gap-3 text-xs">
                  {c.status === "visible" ? (
                    <button onClick={() => setCommentStatus(c.id, "hidden")} disabled={busy === c.id} className="font-medium text-red-300 hover:underline disabled:opacity-50">
                      {busy === c.id ? "…" : "Hide"}
                    </button>
                  ) : (
                    <button onClick={() => setCommentStatus(c.id, "visible")} disabled={busy === c.id} className="font-medium text-mint-300 hover:underline disabled:opacity-50">
                      {busy === c.id ? "…" : "Restore"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : messages.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white/[0.02] px-5 py-10 text-center text-sm text-zinc-500">Nothing to review.</p>
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => (
            <li key={m.id} className="surface rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                <span className="font-medium text-zinc-300">
                  {m.author.name ?? (m.author.username ? `@${m.author.username}` : "Member")}
                </span>
                <span>· {formatDateTime(m.createdAt)}</span>
                <StatusBadge status={m.status} />
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-300">{m.body}</p>
              <div className="mt-2 flex gap-3 text-xs">
                {m.status === "visible" ? (
                  <button onClick={() => setMessageStatus(m.id, "hide")} disabled={busy === m.id} className="font-medium text-red-300 hover:underline disabled:opacity-50">
                    {busy === m.id ? "…" : "Hide"}
                  </button>
                ) : (
                  <button onClick={() => setMessageStatus(m.id, "restore")} disabled={busy === m.id} className="font-medium text-mint-300 hover:underline disabled:opacity-50">
                    {busy === m.id ? "…" : "Restore"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --------------------------- Subscribers --------------------------- */
type SubscriberRow = { id: string; email: string; source: string; createdAt: string };

function SubscribersPanel() {
  const [rows, setRows] = useState<SubscriberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (cursor?: string | null) => {
    try {
      const res = await fetch(`/api/subscribers${cursor ? `?cursor=${cursor}` : ""}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not load subscribers.");
      setTotal(d.total ?? 0);
      setRows((prev) => (cursor ? [...prev, ...(d.subscribers ?? [])] : d.subscribers ?? []));
      setNextCursor(d.nextCursor ?? null);
    } catch (e: any) {
      setError(e.message || "Could not load subscribers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-zinc-100">Subscribers</h2>
          <p className="text-sm text-zinc-500">Waitlist &amp; newsletter emails ({total.toLocaleString("en-US")}).</p>
        </div>
        <button onClick={() => window.open("/api/subscribers?format=csv", "_blank")} className="btn-ghost !px-4 !py-2 text-xs">
          Export CSV (all)
        </button>
      </div>
      {error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">{error}</p>}
      {loading ? (
        <p className="rounded-2xl border border-line bg-white/[0.02] px-5 py-10 text-center text-sm text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white/[0.02] px-5 py-10 text-center text-sm text-zinc-500">No subscribers yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink-700/60 mono text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium sm:px-5">Email</th>
                  <th className="hidden px-5 py-3 font-medium sm:table-cell">Source</th>
                  <th className="px-4 py-3 font-medium sm:px-5">Subscribed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-zinc-200 sm:px-5">{s.email}</td>
                    <td className="mono hidden px-5 py-3 text-xs text-zinc-400 sm:table-cell">{s.source}</td>
                    <td className="mono px-4 py-3 text-xs text-zinc-400 sm:px-5">{formatDate(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor && (
            <div className="mt-4 text-center">
              <button onClick={() => load(nextCursor)} className="btn-ghost !px-4 !py-2 text-xs">
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ----------------------------- Activity ---------------------------- */
type AuditEntry = {
  id: string;
  action: string;
  targetId: string | null;
  detail: string | null;
  createdAt: string;
  actorName: string;
};

function ActivityPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (cursor?: string | null) => {
    try {
      const res = await fetch(`/api/admin/audit${cursor ? `?cursor=${cursor}` : ""}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not load activity.");
      setEntries((prev) => (cursor ? [...prev, ...(d.entries ?? [])] : d.entries ?? []));
      setNextCursor(d.nextCursor ?? null);
    } catch (e: any) {
      setError(e.message || "Could not load activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-zinc-100">Admin activity</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Append-only audit trail of role &amp; permission changes.
      </p>
      {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">{error}</p>}
      {loading ? (
        <p className="mt-4 rounded-2xl border border-line bg-white/[0.02] px-5 py-10 text-center text-sm text-zinc-500">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-line bg-white/[0.02] px-5 py-10 text-center text-sm text-zinc-500">
          No admin activity recorded yet.
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {entries.map((e) => (
              <li key={e.id} className="surface flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-2xl p-4 text-sm">
                <span className="font-medium text-zinc-200">{e.actorName}</span>
                <span className="mono rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-gold-200">{e.action}</span>
                {e.detail && <span className="mono min-w-0 break-all text-[11px] text-zinc-500">{e.detail}</span>}
                <span className="ml-auto mono text-[11px] text-zinc-600">{formatDateTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
          {nextCursor && (
            <div className="mt-4 text-center">
              <button onClick={() => load(nextCursor)} className="btn-ghost !px-4 !py-2 text-xs">
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------ Publish ----------------------------- */
function PublishPanel() {
  const router = useRouter();
  return <PostEditor mode="create" onDone={() => router.refresh()} />;
}

/* --------------------------- Premium members -------------------------- */
function PremiumMembers({ initial, realtime }: { initial: UserRow[]; realtime: Realtime }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Re-seed when the server component re-renders (router.refresh), so fresh
  // data actually lands instead of being discarded by the initial useState.
  useEffect(() => {
    setRows(initial);
  }, [initial]);

  // Live: if anyone is downgraded elsewhere, drop them from this list instantly.
  useMembersChannel(
    realtime,
    useCallback((id, membership) => {
      if (membership !== "Premium") setRows((arr) => arr.filter((u) => u.id !== id));
    }, [])
  );

  async function downgrade(u: UserRow) {
    setBusy(u.id);
    setError("");
    try {
      await setMembership(u.id, "Free");
      setRows((arr) => arr.filter((x) => x.id !== u.id));
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Could not update.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-zinc-100">Premium members</h2>
          <p className="text-sm text-zinc-500">Everyone with an active Premium membership.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/12 px-3 py-1 text-sm font-medium text-gold-200 ring-1 ring-gold-500/30">
          ★ {rows.length}
        </span>
      </div>
      {error && (
        <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">{error}</p>
      )}
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white/[0.02] px-5 py-10 text-center text-sm text-zinc-500">
          No premium members yet.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((u) => (
            <div key={u.id} className="surface flex items-center justify-between gap-3 rounded-2xl p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-100">{u.name ?? u.email}</p>
                <p className="mono truncate text-[11px] text-zinc-500">{u.email}</p>
                <p className="mt-0.5 text-[11px] text-zinc-600">Since {formatDate(u.createdAt)}</p>
              </div>
              <button
                onClick={() => downgrade(u)}
                disabled={busy === u.id}
                className="shrink-0 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/10 disabled:opacity-50"
              >
                {busy === u.id ? "…" : "Downgrade"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Members ----------------------------- */
function Members({ users, realtime }: { users: UserRow[]; realtime: Realtime }) {
  const [rows, setRows] = useState(users);
  const [nextCursor, setNextCursor] = useState<string | null>(users.length >= 50 ? "seed" : null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // Live: reflect membership changes made anywhere (this admin or another).
  useMembersChannel(
    realtime,
    useCallback((id, membership) => {
      setRows((arr) => arr.map((x) => (x.id === id ? { ...x, membership } : x)));
    }, [])
  );

  // Server-side search over ALL members (the server prop only carries the 50
  // most recent - filtering that client-side hid everyone older). Debounced;
  // empty query lists most-recent with cursor pagination.
  const fetchPage = useCallback(async (q: string, cursor?: string | null) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (cursor && cursor !== "seed") params.set("cursor", cursor);
    const res = await fetch(`/api/users?${params}`, { cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "Could not load members.");
    return { users: (d.users ?? []) as UserRow[], nextCursor: (d.nextCursor ?? null) as string | null };
  }, []);

  useEffect(() => {
    const id = setTimeout(async () => {
      setSearching(true);
      setError("");
      try {
        const page = await fetchPage(query.trim());
        setRows(page.users);
        setNextCursor(page.nextCursor);
      } catch (e: any) {
        setError(e.message || "Could not load members.");
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [query, fetchPage]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const cursor = nextCursor === "seed" ? rows[rows.length - 1]?.id : nextCursor;
      const page = await fetchPage(query.trim(), cursor);
      setRows((prev) => [...prev, ...page.users.filter((u) => !prev.some((p) => p.id === u.id))]);
      setNextCursor(page.nextCursor);
    } catch (e: any) {
      setError(e.message || "Could not load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleMembership(u: UserRow) {
    const next = u.membership === "Premium" ? "Free" : "Premium";
    setBusy(u.id);
    setError("");
    try {
      await setMembership(u.id, next);
      setRows((arr) => arr.map((x) => (x.id === u.id ? { ...x, membership: next } : x)));
    } catch (e: any) {
      setError(e.message || "Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  // Full export from the server (the old client export only covered the rows
  // already loaded - silently truncating to 50 on real userbases).
  function exportCsv() {
    const params = new URLSearchParams({ format: "csv" });
    const q = query.trim();
    if (q) params.set("q", q);
    window.open(`/api/users?${params}`, "_blank");
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all members by email or name…"
          className="w-full max-w-xs rounded-xl border border-line bg-ink-700/60 px-4 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-gold-500/50"
        />
        <div className="flex items-center gap-3">
          <span className="mono text-xs text-zinc-500">
            {searching ? "Searching…" : `${rows.length}${nextCursor ? "+" : ""} member${rows.length === 1 ? "" : "s"}`}
          </span>
          <button onClick={exportCsv} className="btn-ghost !px-4 !py-2 text-xs">
            Export CSV (all)
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">{error}</p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[340px] text-left text-sm md:min-w-[640px]">
          <thead className="bg-ink-700/60 mono text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium sm:px-5">Email</th>
              <th className="hidden px-5 py-3 font-medium md:table-cell">Signup Date</th>
              <th className="hidden px-5 py-3 font-medium md:table-cell">Last Login</th>
              <th className="px-4 py-3 font-medium sm:px-5">Membership</th>
              <th className="px-4 py-3 text-right font-medium sm:px-5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 sm:px-5">
                  {/* PII-light by default: masked email, tap to reveal (staff-
                      gated view, but no need to show every address on screen). */}
                  <button
                    type="button"
                    onClick={() => setRevealedId((id) => (id === u.id ? null : u.id))}
                    title={revealedId === u.id ? "Hide email" : "Reveal email"}
                    className="font-medium text-zinc-200 hover:text-gold-200"
                  >
                    {revealedId === u.id ? u.email : maskEmail(u.email)}
                  </button>
                  <div className="mono text-[11px] text-zinc-600">{u.name ?? "-"} · {u.provider}</div>
                </td>
                <td className="hidden px-5 py-3 mono text-xs text-zinc-400 md:table-cell">{formatDate(u.createdAt)}</td>
                <td className="hidden px-5 py-3 mono text-xs text-zinc-400 md:table-cell">
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="text-zinc-600">Never</span>}
                </td>
                <td className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {u.role === "ADMIN" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/12 px-2.5 py-1 text-[11px] font-medium text-gold-200 ring-1 ring-gold-500/30">
                        Admin
                      </span>
                    )}
                    {u.membership === "Premium" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-500/12 px-2.5 py-1 text-[11px] font-medium text-mint-300 ring-1 ring-mint-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
                        Premium
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-400 ring-1 ring-white/10">
                        Free
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right sm:px-5">
                  {/* Admins get the same Premium toggle as everyone else now - role
                      (staff access) and membership (Premium perks) are independent,
                      so an admin's own account previously had no way to self-grant
                      Premium and always displayed "Free" everywhere that reads
                      membership (e.g. the navbar badge). */}
                  <button
                    onClick={() => toggleMembership(u)}
                    disabled={busy === u.id}
                    className="text-xs font-medium text-gold-200 transition-colors hover:text-gold-100 disabled:opacity-50"
                  >
                    {busy === u.id ? "…" : u.membership === "Premium" ? "Downgrade" : "Make Premium"}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !searching && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-zinc-500">
                  No members match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {nextCursor && (
        <div className="mt-4 text-center">
          <button onClick={loadMore} disabled={loadingMore} className="btn-ghost !px-4 !py-2 text-xs disabled:opacity-60">
            {loadingMore ? "Loading…" : "Load more members"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------- Team / Access ------------------------- */
type StaffUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  permissions: string[];
  isSuperAdmin: boolean;
};

function StaffRow({ u, onEdit }: { u: StaffUser; onEdit: (u: StaffUser) => void }) {
  return (
    <li className="surface flex items-center justify-between gap-3 rounded-2xl p-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-zinc-200">{u.email}</div>
        <div className="mono text-[11px] text-zinc-600">{u.name ?? "-"}</div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {u.isSuperAdmin ? (
          <span className="rounded-full bg-gold-500/12 px-2.5 py-1 text-[11px] font-medium text-gold-200 ring-1 ring-gold-500/30">
            Super Admin
          </span>
        ) : (
          <>
            <span className="mono hidden text-[11px] text-zinc-500 xs:inline">
              {u.permissions.length
                ? `${u.permissions.length} ${u.permissions.length === 1 ? "capability" : "capabilities"}`
                : "No access"}
            </span>
            <button
              onClick={() => onEdit(u)}
              className="text-xs font-medium text-gold-200 transition-colors hover:text-gold-100"
            >
              {u.permissions.length ? "Edit access" : "Grant access"}
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function AccessPanel({ viewer }: { viewer: Viewer }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StaffUser[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [editing, setEditing] = useState<StaffUser | null>(null);

  const search = useCallback(async (q: string) => {
    setLoadingResults(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      setResults(Array.isArray(d.users) ? d.users : []);
    } catch {
      /* keep last results */
    } finally {
      setLoadingResults(false);
    }
  }, []);

  const loadStaff = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const res = await fetch("/api/users/staff", { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      setStaff(Array.isArray(d.users) ? d.users : []);
    } catch {
      /* keep last */
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // Debounced server-side search; empty query lists the most recent members.
  useEffect(() => {
    const id = setTimeout(() => search(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query, search]);

  const refreshAll = () => {
    loadStaff();
    search(query.trim());
  };

  return (
    <div className="space-y-6">
      {/* Who currently has access */}
      <div>
        <h2 className="font-display text-lg font-semibold text-zinc-100">Team - who has access</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Everyone with staff capabilities. Super Admins (set via{" "}
          <span className="mono text-zinc-400">ADMIN_EMAILS</span>) have full access.
        </p>
        <ul className="mt-4 space-y-2">
          {loadingStaff && staff.length === 0 ? (
            <li className="rounded-2xl border border-line bg-white/[0.02] px-5 py-6 text-center text-sm text-zinc-500">
              Loading team…
            </li>
          ) : staff.length === 0 ? (
            <li className="rounded-2xl border border-line bg-white/[0.02] px-5 py-6 text-center text-sm text-zinc-500">
              No one has staff access yet - grant some below.
            </li>
          ) : (
            staff.map((u) => <StaffRow key={u.id} u={u} onEdit={setEditing} />)
          )}
        </ul>
      </div>

      {/* Grant access to a new member */}
      <div>
        <h3 className="font-display text-base font-semibold text-zinc-100">Grant access</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Search <strong className="text-zinc-300">any member</strong> by name or email, then grant or adjust their
          capabilities any time.
        </p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all members by name or email…"
          className="mt-3 w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
        />
        <ul className="mt-3 space-y-2">
          {loadingResults && results.length === 0 ? (
            <li className="rounded-2xl border border-line bg-white/[0.02] px-5 py-6 text-center text-sm text-zinc-500">
              Searching…
            </li>
          ) : results.length === 0 ? (
            <li className="rounded-2xl border border-line bg-white/[0.02] px-5 py-6 text-center text-sm text-zinc-500">
              {query.trim() ? `No members match “${query}”.` : "No members yet."}
            </li>
          ) : (
            results.map((u) => <StaffRow key={u.id} u={u} onEdit={setEditing} />)
          )}
        </ul>
      </div>

      {editing && (
        <AccessEditor user={editing} viewer={viewer} onClose={() => setEditing(null)} onSaved={refreshAll} />
      )}
    </div>
  );
}

function AccessEditor({
  user,
  viewer,
  onClose,
  onSaved,
}: {
  user: { id: string; email: string };
  viewer: Viewer;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [perms, setPerms] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/users/${user.id}/access`)
      .then((r) => r.json())
      .then((d) => {
        if (active) setPerms(Array.isArray(d.permissions) ? d.permissions : []);
      })
      .catch(() => {
        if (active) setPerms([]);
      });
    return () => {
      active = false;
    };
  }, [user.id]);

  const canGrant = (p: Permission) => viewer.isSuperAdmin || viewer.permissions.includes(p);
  const toggle = (p: Permission) =>
    setPerms((cur) => (cur ? (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]) : [p]));

  const save = async () => {
    if (!perms) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${user.id}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: perms }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not save access.");
      }
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message || "Could not save access.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div className="surface w-full max-w-lg rounded-2xl p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold text-zinc-100">Manage access</h3>
            <p className="mono truncate text-[12px] text-zinc-500">{user.email}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-200">
            ✕
          </button>
        </div>

        {perms === null ? (
          <p className="mt-6 text-sm text-zinc-500">Loading capabilities…</p>
        ) : (
          <div className="mt-5 space-y-2">
            {ALL_PERMISSIONS.map((p) => {
              const checked = perms.includes(p);
              const allowed = canGrant(p);
              return (
                <label
                  key={p}
                  className={`flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 ${
                    allowed ? "cursor-pointer hover:border-gold-500/30" : "opacity-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!allowed}
                    onChange={() => allowed && toggle(p)}
                    className="mt-0.5 h-4 w-4 accent-gold-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-zinc-200">{PERMISSIONS[p]}</span>
                    <span className="mono text-[11px] text-zinc-600">{p}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
          Any capability lets this member open the dashboard (they&apos;ll see only the tabs they&apos;re
          allowed to use). If they&apos;re already signed in, they may need to refresh to pick up the change.
        </p>

        {error && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">{error}</p>
        )}

        <div className="mt-5 flex items-center justify-end gap-3">
          {saved && <span className="text-xs text-mint-300">Saved ✓</span>}
          <button onClick={onClose} className="btn-ghost !px-4 !py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || perms === null}
            className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save access"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- AI Usage (gateway analytics + per-user limits) ---------------- */

type AiUsageProvider = { id: string; enabled: boolean; requests: number };
type AiTopUser = {
  id: string | null;
  name: string | null;
  email: string | null;
  membership: string;
  aiDailyLimit: number | null;
  requests: number;
  costMicros: number;
};
type AiUsageData = {
  days: number;
  requests: DailyPoint[];
  cost: DailyPoint[];
  totals: {
    today: number;
    month: number;
    inputTokens: number;
    outputTokens: number;
    costMicros: number;
    errors: number;
    fallbacks: number;
    cached: number;
    cacheHitRate: number;
  };
  providers: AiUsageProvider[];
  topUsers: AiTopUser[];
  abuse: { id: string | null; name: string | null; email: string | null; errors: number }[];
};

function usd(micros: number): string {
  return `$${(micros / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function AiUsagePanel() {
  const [data, setData] = useState<AiUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/ai-usage", { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not load AI usage.");
      setData(d as AiUsageData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load AI usage.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="py-8 text-center text-sm text-zinc-500">Loading AI usage…</p>;
  if (error || !data) return <p className="py-8 text-center text-sm text-amber-300">{error || "No data."}</p>;

  const t = data.totals;
  const costCents = data.cost.map((p) => ({ day: p.day, count: Math.round(p.count / 10_000) }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-zinc-100">XYZ AI - Usage & Cost</h2>
        <p className="text-sm text-zinc-500">Gateway analytics (last 30 days). Metadata only - no prompt or response text is stored.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Requests today" value={t.today} hint="AI calls today (UTC)" />
        <StatCard label="Requests (30d)" value={t.month} hint="all AI calls" accent="gold" />
        <StatCard label="Cache hits (30d)" value={t.cached} hint={`${Math.round(t.cacheHitRate * 100)}% of calls served from cache`} accent="mint" />
        <StatCard label="Errors (30d)" value={t.errors} hint={`${data.totals.fallbacks} recovered via fallback`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat label="Est. cost (30d)" value={usd(t.costMicros)} hint="notional - free tiers bill $0" />
        <MiniStat label="Input tokens (30d)" value={t.inputTokens.toLocaleString("en-US")} hint="prompt tokens" />
        <MiniStat label="Output tokens (30d)" value={t.outputTokens.toLocaleString("en-US")} hint="completion tokens" />
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <TrendChart title="Requests / day" points={data.requests} tone="gold" />
        <TrendChart title="Est. cost / day (¢)" points={costCents} tone="mint" />
      </section>

      <div className="surface rounded-2xl p-5">
        <p className="mb-3 text-sm font-semibold text-zinc-100">Provider health</p>
        <div className="flex flex-wrap gap-2">
          {data.providers.map((p) => (
            <span
              key={p.id}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
                p.enabled ? "bg-mint-500/10 text-mint-200 ring-mint-500/25" : "bg-white/5 text-zinc-500 ring-white/10"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${p.enabled ? "bg-mint-400" : "bg-zinc-600"}`} />
              {p.id} · {p.enabled ? "configured" : "off"} · {p.requests.toLocaleString("en-US")}
            </span>
          ))}
        </div>
      </div>

      {data.abuse.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5">
          <p className="mb-2 text-sm font-semibold text-amber-200">Abuse watch - members with the most failed calls (30d)</p>
          <ul className="space-y-1 text-sm text-zinc-300">
            {data.abuse.map((a, i) => (
              <li key={a.id ?? `abuse-${i}`} className="flex items-center justify-between">
                <span className="truncate">{a.name || (a.email ? maskEmail(a.email) : "-")}</span>
                <span className="mono text-amber-300">{a.errors} errors</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="surface rounded-2xl p-5">
        <p className="mb-3 text-sm font-semibold text-zinc-100">Top members by AI usage (30d) - set per-user daily limits</p>
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-2 text-left font-medium">Member</th>
                <th className="px-2 py-2 text-right font-medium">Requests</th>
                <th className="px-2 py-2 text-right font-medium">Est. cost</th>
                <th className="px-2 py-2 text-right font-medium">Daily limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.topUsers.map((u, i) => (
                <AiUserRow key={u.id ?? `top-${i}`} user={u} />
              ))}
              {!data.topUsers.length && (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center text-zinc-500">No AI usage recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="surface rounded-2xl p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 mono text-2xl font-semibold text-zinc-100">{value}</p>
      <p className="mt-1 text-xs text-zinc-600">{hint}</p>
    </div>
  );
}

function AiUserRow({ user }: { user: AiTopUser }) {
  const [limit, setLimit] = useState<string>(user.aiDailyLimit != null ? String(user.aiDailyLimit) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!user.id) return;
    setSaving(true);
    setSaved(false);
    try {
      const n = limit.trim() === "" ? null : Math.max(0, Math.floor(Number(limit)));
      const res = await fetch(`/api/users/${user.id}/ai-limit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiDailyLimit: Number.isFinite(n as number) ? n : null }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="transition-colors hover:bg-white/[0.03]">
      <td className="px-2 py-2.5">
        <span className="text-zinc-100">{user.name || (user.email ? maskEmail(user.email) : "-")}</span>
        <span className="ml-2 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500">{user.membership}</span>
      </td>
      <td className="mono px-2 py-2.5 text-right text-zinc-300">{user.requests.toLocaleString("en-US")}</td>
      <td className="mono px-2 py-2.5 text-right text-zinc-400">{usd(user.costMicros)}</td>
      <td className="px-2 py-2.5">
        <div className="flex items-center justify-end gap-1.5">
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="default"
            inputMode="numeric"
            className="w-20 rounded-lg border border-white/10 bg-ink-950/60 px-2 py-1 text-right text-xs text-zinc-100 outline-none focus:border-gold-500/40"
          />
          <button
            onClick={save}
            disabled={saving || !user.id}
            className="rounded-lg border border-gold-500/30 bg-gold-500/10 px-2 py-1 text-[11px] font-medium text-gold-200 transition-colors hover:bg-gold-500/20 disabled:opacity-50"
          >
            {saving ? "…" : saved ? "✓" : "Set"}
          </button>
        </div>
      </td>
    </tr>
  );
}
