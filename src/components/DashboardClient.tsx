"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

type Stats = {
  totalUsers: number;
  googleUsers: number;
  emailUsers: number;
  last7days: number;
  totalPosts: number;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  provider: string;
  role: string;
  isMember: boolean;
  lastLoginAt: string | null;
  createdAt: string;
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
      {tab === "publish" && <Publish />}
      {tab === "content" && <Content posts={posts} />}
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
    { label: "Published content", value: stats.totalPosts, hint: "Research, articles & posts" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="card-gold-border rounded-2xl p-6">
          <p className="text-sm text-zinc-500">{c.label}</p>
          <p className="mt-2 font-display text-4xl font-bold text-gold-gradient">
            {c.value}
          </p>
          <p className="mt-1 text-xs text-zinc-600">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Publish ----------------------------- */
function Publish() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    excerpt: "",
    content: "",
    category: "Research",
    cover: "",
    tags: "",
  });
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const res = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, published: true }),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setMsg({ type: "err", text: data.error || "Could not publish." });
      return;
    }
    setMsg({ type: "ok", text: "Published! Your post is now live." });
    setForm({ title: "", excerpt: "", content: "", category: "Research", cover: "", tags: "" });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Input label="Title" value={form.title} onChange={set("title")} placeholder="e.g. The State of L2s in 2026" required />
        <Textarea label="Excerpt / summary" value={form.excerpt} onChange={set("excerpt")} placeholder="A short 1–2 line summary shown on cards." rows={2} required />
        <Textarea
          label="Content (Markdown supported)"
          value={form.content}
          onChange={set("content")}
          placeholder={"Write your research here.\n\n## Heading\n- bullet point\n**bold**, *italic*, `code`, [links](https://x.com)"}
          rows={14}
          required
        />
      </div>

      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Category
          </label>
          <select
            value={form.category}
            onChange={(e) => set("category")(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-gold-500/50"
          >
            <option>Research</option>
            <option>Article</option>
            <option>Post</option>
          </select>
        </div>
        <Input label="Cover image URL (optional)" value={form.cover} onChange={set("cover")} placeholder="https://…/image.jpg" />
        <Input label="Tags (comma separated)" value={form.tags} onChange={set("tags")} placeholder="defi, l2, airdrop" />

        {msg && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ring-1 ${
              msg.type === "ok"
                ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                : "bg-red-500/10 text-red-300 ring-red-500/20"
            }`}
          >
            {msg.text}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-60">
          {loading ? "Publishing…" : "Publish now"}
        </button>
        <p className="text-xs text-zinc-600">
          Posts appear instantly on the Research hub and home page.
        </p>
      </div>
    </form>
  );
}

/* ------------------------------ Content ----------------------------- */
function Content({ posts }: { posts: PostRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(posts);
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Delete this post permanently?")) return;
    setBusy(id);
    const res = await fetch(`/api/research/${id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) {
      setItems((arr) => arr.filter((p) => p.id !== id));
      router.refresh();
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gold-500/20 bg-ink-700/40 p-12 text-center text-sm text-zinc-500">
        No content yet. Head to the <b className="text-gold-200">Publish</b> tab
        to create your first post.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink-700/60 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-5 py-3">Title</th>
            <th className="px-5 py-3">Category</th>
            <th className="px-5 py-3">Date</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {items.map((p) => (
            <tr key={p.id} className="hover:bg-white/[0.02]">
              <td className="px-5 py-3 font-medium text-zinc-200">{p.title}</td>
              <td className="px-5 py-3 text-zinc-400">{p.category}</td>
              <td className="px-5 py-3 text-zinc-500">{formatDate(p.createdAt)}</td>
              <td className="px-5 py-3">
                <div className="flex justify-end gap-3">
                  <Link href={`/research/${p.slug}`} target="_blank" className="text-gold-200 hover:underline">
                    View
                  </Link>
                  <button
                    onClick={() => remove(p.id)}
                    disabled={busy === p.id}
                    className="text-red-400 hover:underline disabled:opacity-50"
                  >
                    {busy === p.id ? "…" : "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------ Members ----------------------------- */
function Members({ users: initial }: { users: UserRow[] }) {
  const [users, setUsers] = useState(initial);
  const [toggling, setToggling] = useState<string | null>(null);

  function exportCsv() {
    const header = "Name,Email,Provider,Role,Member,Last Login,Joined\n";
    const rows = users
      .map(
        (u) =>
          `"${u.name ?? ""}","${u.email}","${u.provider}","${u.role}","${u.isMember ? "Yes" : "No"}","${u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}","${formatDate(u.createdAt)}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "xyz-crypto-members.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function toggleMembership(u: UserRow) {
    setToggling(u.id);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isMember: !u.isMember }),
    });
    setToggling(null);
    if (res.ok) {
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, isMember: !u.isMember } : x))
      );
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Showing latest {users.length} members
        </p>
        <button onClick={exportCsv} className="btn-ghost !px-4 !py-2 text-xs">
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-700/60 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Method</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Member</th>
              <th className="px-5 py-3">Last Login</th>
              <th className="px-5 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.02]">
                <td className="px-5 py-3 font-medium text-zinc-200">{u.name ?? "—"}</td>
                <td className="px-5 py-3 text-zinc-400">{u.email}</td>
                <td className="px-5 py-3">
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-400 ring-1 ring-white/10">
                    {u.provider}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ring-1 ${
                      u.role === "ADMIN"
                        ? "bg-gold-500/10 text-gold-200 ring-gold-500/30"
                        : "bg-white/5 text-zinc-400 ring-white/10"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => toggleMembership(u)}
                    disabled={toggling === u.id}
                    className={`rounded-full px-2.5 py-0.5 text-xs ring-1 transition-colors disabled:opacity-50 ${
                      u.isMember
                        ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30 hover:bg-emerald-500/20"
                        : "bg-white/5 text-zinc-400 ring-white/10 hover:bg-white/10"
                    }`}
                  >
                    {toggling === u.id ? "…" : u.isMember ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-5 py-3 text-zinc-500">
                  {u.lastLoginAt ? formatDate(u.lastLoginAt) : <span className="text-zinc-700">Never</span>}
                </td>
                <td className="px-5 py-3 text-zinc-500">{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------ Inputs ------------------------------ */
function Input({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows: number;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className="w-full resize-y rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
      />
    </label>
  );
}
