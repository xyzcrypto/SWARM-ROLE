"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatDateTime, csvCell } from "@/lib/utils";
import { PostEditor } from "./PostEditor";
import { PostManager } from "./PostManager";

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
type Tab = "overview" | "premium" | "publish" | "content" | "members";

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
}: {
  stats: Stats;
  recentUsers: UserRow[];
  premiumMembers: UserRow[];
  posts: PostRow[];
  adminName: string;
  realtime: Realtime;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const liveOnline = useLiveOnline(realtime);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "premium", label: "Premium" },
    { id: "publish", label: "Publish" },
    { id: "content", label: "Content" },
    { id: "members", label: "Members" },
  ];

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">Admin</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-zinc-50 sm:text-4xl">
          Welcome, {adminName.split(" ")[0]} 👋
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Manage signups, publish Web3 research and grow the XYZ Crypto ecosystem.
        </p>
      </div>

      <div className="mb-8 flex flex-wrap gap-2 border-b border-white/5 pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id ? "border-b-2 border-gold-400 text-gold-100" : "text-zinc-500 hover:text-zinc-300"
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
    </div>
  );
}

/* ----------------------------- Overview ----------------------------- */
function Overview({ stats, liveOnline }: { stats: Stats; liveOnline: number }) {
  const analytics = [
    { label: "Total visits", value: stats.totalVisits, hint: "All page views tracked", tone: "mint" as const },
    { label: "Visits today", value: stats.todayVisits, hint: "Since midnight", tone: "mint" as const },
    { label: "Post views", value: stats.totalPostViews, hint: "Across all articles", tone: "gold" as const },
  ];
  const cards = [
    { label: "Total signups", value: stats.totalUsers, hint: "All registered users" },
    { label: "New (7 days)", value: stats.last7days, hint: "Signed up this week" },
    { label: "Google sign-ins", value: stats.googleUsers, hint: "Via Gmail / Google" },
    { label: "Email sign-ups", value: stats.emailUsers, hint: "Email + password" },
    { label: "Premium members", value: stats.premiumUsers, hint: "Upgraded accounts" },
    { label: "Waitlist emails", value: stats.subscribers, hint: "Captured via email forms" },
    { label: "Published content", value: stats.totalPosts, hint: "Research, articles & posts" },
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
          <div key={c.label} className="surface rounded-2xl p-6">
            <p className="text-sm text-zinc-500">{c.label}</p>
            <p className={`mt-2 mono text-4xl font-semibold ${c.tone === "mint" ? "text-mint-gradient" : "text-gold-gradient"}`}>
              {c.value.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-zinc-600">{c.hint}</p>
          </div>
        ))}
      </div>

      {/* Signups / content */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="surface rounded-2xl p-6">
            <p className="text-sm text-zinc-500">{c.label}</p>
            <p className="mt-2 mono text-4xl font-semibold text-gold-gradient">{c.value.toLocaleString()}</p>
            <p className="mt-1 text-xs text-zinc-600">{c.hint}</p>
          </div>
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
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-ink-700/60 mono text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Signup Date</th>
              <th className="px-5 py-3 font-medium">Last Login</th>
              <th className="px-5 py-3 font-medium">Membership</th>
              <th className="px-5 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.02]">
                <td className="px-5 py-3">
                  <div className="font-medium text-zinc-200">{u.email}</div>
                  <div className="mono text-[11px] text-zinc-600">{u.name ?? "—"} · {u.provider}</div>
                </td>
                <td className="px-5 py-3 mono text-xs text-zinc-400">{formatDate(u.createdAt)}</td>
                <td className="px-5 py-3 mono text-xs text-zinc-400">
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="text-zinc-600">Never</span>}
                </td>
                <td className="px-5 py-3">
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
                <td className="px-5 py-3 text-right">
                  {u.role === "ADMIN" ? (
                    <span className="text-xs text-zinc-600">—</span>
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
