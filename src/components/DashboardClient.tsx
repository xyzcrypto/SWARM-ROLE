"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatDateTime, csvCell } from "@/lib/utils";
import { PostEditor } from "./PostEditor";
import { PostManager } from "./PostManager";
import { PERMISSIONS, ALL_PERMISSIONS, hasPermission, type Permission } from "@/lib/permissions";
import { WhatsNewManager } from "./WhatsNewManager";
import { useRealtime } from "@/lib/useRealtime";

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
type Tab = "overview" | "premium" | "publish" | "content" | "members" | "access" | "whatsnew";

/* ----------------------- realtime hooks (admin) ----------------------- */
function useLiveOnline(realtime: Realtime) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!realtime.url || !realtime.anonKey) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { createClient } = await import("@supabase/supabase-js");
      if (cancelled) return;
      const client = createClient(realtime.url, realtime.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
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
      const { createClient } = await import("@supabase/supabase-js");
      if (cancelled) return;
      const client = createClient(realtime.url, realtime.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
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
}: {
  stats: Stats;
  recentUsers: UserRow[];
  premiumMembers: UserRow[];
  posts: PostRow[];
  adminName: string;
  realtime: Realtime;
  viewer: Viewer;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const liveOnline = useLiveOnline(realtime);

  // Only show tabs the viewer is allowed to use (Super Admins see all). Server
  // routes re-check the capability, so this is UX, not the security boundary.
  const allTabs: { id: Tab; label: string; perm: Permission }[] = [
    { id: "overview", label: "Overview", perm: "dashboard:view" },
    { id: "premium", label: "Premium", perm: "premium:manage" },
    { id: "publish", label: "Publish", perm: "post:publish" },
    { id: "content", label: "Content", perm: "post:manage" },
    { id: "members", label: "Members", perm: "users:manage" },
    { id: "whatsnew", label: "What's New", perm: "whatsnew:manage" },
    { id: "access", label: "Access", perm: "users:roles" },
  ];
  const tabs = allTabs.filter((t) => hasPermission(viewer, t.perm));

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

      {tab === "overview" && <Overview stats={stats} liveOnline={liveOnline} />}
      {tab === "premium" && <PremiumMembers initial={premiumMembers} realtime={realtime} />}
      {tab === "publish" && <PublishPanel />}
      {tab === "content" && <PostManager posts={posts} />}
      {tab === "members" && <Members users={recentUsers} realtime={realtime} />}
      {tab === "whatsnew" && <WhatsNewManager />}
      {tab === "access" && <AccessPanel users={recentUsers} viewer={viewer} />}
    </div>
  );
}

/* ----------------------------- Overview ----------------------------- */
type Accent = "gold" | "mint" | "plain";

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

function Overview({ stats: initialStats, liveOnline }: { stats: Stats; liveOnline: number }) {
  const [stats, setStats] = useState(initialStats);

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

      {/* Signups / content */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>
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
  const router = useRouter();
  const [rows, setRows] = useState(users);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  // Live: reflect membership changes made anywhere (this admin or another).
  useMembersChannel(
    realtime,
    useCallback((id, membership) => {
      setRows((arr) => arr.map((x) => (x.id === id ? { ...x, membership } : x)));
    }, [])
  );

  const filtered = rows.filter(
    (u) =>
      !query ||
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      (u.name ?? "").toLowerCase().includes(query.toLowerCase())
  );

  async function toggleMembership(u: UserRow) {
    const next = u.membership === "Premium" ? "Free" : "Premium";
    setBusy(u.id);
    setError("");
    try {
      await setMembership(u.id, next);
      setRows((arr) => arr.map((x) => (x.id === u.id ? { ...x, membership: next } : x)));
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function exportCsv() {
    const header = "Name,Email,Membership,Role,Method,Signup Date,Last Login\n";
    const body = rows
      .map((u) =>
        [u.name ?? "", u.email, u.membership, u.role, u.provider, formatDate(u.createdAt), u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"]
          .map(csvCell)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "xyz-crypto-members.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email or name…"
          className="w-full max-w-xs rounded-xl border border-line bg-ink-700/60 px-4 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-gold-500/50"
        />
        <div className="flex items-center gap-3">
          <span className="mono text-xs text-zinc-500">
            {filtered.length} member{filtered.length === 1 ? "" : "s"}
          </span>
          <button onClick={exportCsv} className="btn-ghost !px-4 !py-2 text-xs">
            Export CSV
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
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 sm:px-5">
                  <div className="font-medium text-zinc-200">{u.email}</div>
                  <div className="mono text-[11px] text-zinc-600">{u.name ?? "-"} · {u.provider}</div>
                </td>
                <td className="hidden px-5 py-3 mono text-xs text-zinc-400 md:table-cell">{formatDate(u.createdAt)}</td>
                <td className="hidden px-5 py-3 mono text-xs text-zinc-400 md:table-cell">
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="text-zinc-600">Never</span>}
                </td>
                <td className="px-4 py-3 sm:px-5">
                  {u.role === "ADMIN" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/12 px-2.5 py-1 text-[11px] font-medium text-gold-200 ring-1 ring-gold-500/30">
                      Admin
                    </span>
                  ) : u.membership === "Premium" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-500/12 px-2.5 py-1 text-[11px] font-medium text-mint-300 ring-1 ring-mint-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
                      Premium
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-400 ring-1 ring-white/10">
                      Free
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right sm:px-5">
                  {u.role === "ADMIN" ? (
                    <span className="text-xs text-zinc-600">-</span>
                  ) : (
                    <button
                      onClick={() => toggleMembership(u)}
                      disabled={busy === u.id}
                      className="text-xs font-medium text-gold-200 transition-colors hover:text-gold-100 disabled:opacity-50"
                    >
                      {busy === u.id ? "…" : u.membership === "Premium" ? "Downgrade" : "Make Premium"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-zinc-500">
                  No members match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------- Team / Access ------------------------- */
function AccessPanel({ users, viewer }: { users: UserRow[]; viewer: Viewer }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const q = query.trim().toLowerCase();
  const filtered = q ? users.filter((u) => `${u.name ?? ""} ${u.email}`.toLowerCase().includes(q)) : users;

  return (
    <div className="space-y-5">
      <div className="surface rounded-2xl p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-zinc-100">Team &amp; access</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Grant staff capabilities to members. Super Admins (set via{" "}
          <span className="mono text-zinc-400">ADMIN_EMAILS</span>) have full access and can&apos;t be edited here.
        </p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members by name or email…"
          className="mt-4 w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
        />
        <p className="mt-2 text-[11px] text-zinc-600">Showing the 50 most recent members. Search to narrow.</p>
      </div>

      <ul className="space-y-2">
        {filtered.slice(0, 50).map((u) => {
          const superAdmin = u.role === "ADMIN";
          return (
            <li key={u.id} className="surface flex items-center justify-between gap-3 rounded-2xl p-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-200">{u.email}</div>
                <div className="mono text-[11px] text-zinc-600">{u.name ?? "—"}</div>
              </div>
              {superAdmin ? (
                <span className="shrink-0 rounded-full bg-gold-500/12 px-2.5 py-1 text-[11px] font-medium text-gold-200 ring-1 ring-gold-500/30">
                  Super Admin
                </span>
              ) : (
                <button
                  onClick={() => setEditing(u)}
                  className="shrink-0 text-xs font-medium text-gold-200 transition-colors hover:text-gold-100"
                >
                  Manage access
                </button>
              )}
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="rounded-2xl border border-line bg-white/[0.02] px-5 py-8 text-center text-sm text-zinc-500">
            No members match “{query}”.
          </li>
        )}
      </ul>

      {editing && <AccessEditor user={editing} viewer={viewer} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AccessEditor({ user, viewer, onClose }: { user: UserRow; viewer: Viewer; onClose: () => void }) {
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
