"use client";

import { useState } from "react";
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
  createdAt: string;
};

type Tab = "overview" | "publish" | "content" | "members";

export function DashboardClient({
  stats,
  recentUsers,
  posts,
  adminName,
}: {
  stats: Stats;
  recentUsers: UserRow[];
  posts: PostRow[];
  adminName: string;
}) {
  const [tab, setTab] = useState<Tab>("overview");

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "publish", label: "Publish" },
    { id: "content", label: "Content" },
    { id: "members", label: "Members" },
  ];

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">
          Admin
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-zinc-50 sm:text-4xl">
          Welcome, {adminName.split(" ")[0]} 👋
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Manage signups, publish Web3 research and grow the XYZ Crypto
          ecosystem.
        </p>
      </div>

      <div className="mb-8 flex flex-wrap gap-2 border-b border-white/5 pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-b-2 border-gold-400 text-gold-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview stats={stats} />}
      {tab === "publish" && <PublishPanel />}
      {tab === "content" && <PostManager posts={posts} />}
      {tab === "members" && <Members users={recentUsers} />}
    </div>
  );
}

/* ----------------------------- Overview ----------------------------- */
function Overview({ stats }: { stats: Stats }) {
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="surface rounded-2xl p-6">
          <p className="text-sm text-zinc-500">{c.label}</p>
          <p className="mt-2 mono text-4xl font-semibold text-gold-gradient">
            {c.value}
          </p>
          <p className="mt-1 text-xs text-zinc-600">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Publish ----------------------------- */
function PublishPanel() {
  const router = useRouter();
  return <PostEditor mode="create" onDone={() => router.refresh()} />;
}

/* ------------------------------ Members ----------------------------- */
function Members({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(users);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = rows.filter(
    (u) =>
      !query ||
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      (u.name ?? "").toLowerCase().includes(query.toLowerCase())
  );

  async function toggleMembership(u: UserRow) {
    const next = u.membership === "Premium" ? "Free" : "Premium";
    setBusy(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}/membership`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membership: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not update membership. Please try again.");
        return;
      }
      setRows((arr) =>
        arr.map((x) => (x.id === u.id ? { ...x, membership: next } : x))
      );
      router.refresh();
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function exportCsv() {
    const header = "Name,Email,Membership,Role,Method,Signup Date,Last Login\n";
    const body = rows
      .map((u) =>
        [
          u.name ?? "",
          u.email,
          u.membership,
          u.role,
          u.provider,
          formatDate(u.createdAt),
          u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never",
        ]
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
                  <div className="mono text-[11px] text-zinc-600">
                    {u.name ?? "—"} · {u.provider}
                  </div>
                </td>
                <td className="px-5 py-3 mono text-xs text-zinc-400">
                  {formatDate(u.createdAt)}
                </td>
                <td className="px-5 py-3 mono text-xs text-zinc-400">
                  {u.lastLoginAt ? (
                    formatDateTime(u.lastLoginAt)
                  ) : (
                    <span className="text-zinc-600">Never</span>
                  )}
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
                      {busy === u.id
                        ? "…"
                        : u.membership === "Premium"
                          ? "Downgrade"
                          : "Make Premium"}
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

