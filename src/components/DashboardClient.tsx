"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

type Stats = {
  totalUsers: number;
  googleUsers: number;
  emailUsers: number;
  premiumUsers: number;
  last7days: number;
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  provider: string;
  role: string;
  membership: string;
  status: string;
  lastLogin: string | null;
  signupDate: string;
  createdAt: string;
};

type PostRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  published: boolean;
  publishedAt: string | null;
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
    { label: "Premium members", value: stats.premiumUsers, hint: "Upgraded accounts" },
    { label: "Published content", value: stats.publishedPosts, hint: "Live posts" },
    { label: "Drafts", value: stats.draftPosts, hint: "Unpublished posts" },
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
    published: true,
  });
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (k: keyof typeof form) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (res.ok) {
      set("cover")(data.url);
    } else {
      setMsg({ type: "err", text: data.error ?? "Upload failed" });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const res = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setMsg({ type: "err", text: data.error || "Could not publish." });
      return;
    }
    setMsg({
      type: "ok",
      text: form.published
        ? "Published! Your post is now live."
        : "Saved as draft.",
    });
    setForm({ title: "", excerpt: "", content: "", category: "Research", cover: "", tags: "", published: true });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Input label="Title" value={form.title} onChange={set("title") as (v: string) => void} placeholder="e.g. The State of L2s in 2026" required />
        <Textarea label="Excerpt / summary" value={form.excerpt} onChange={set("excerpt") as (v: string) => void} placeholder="A short 1–2 line summary shown on cards." rows={2} required />
        <Textarea
          label="Content (Markdown supported)"
          value={form.content}
          onChange={set("content") as (v: string) => void}
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

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Cover Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="mb-2 w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-zinc-300"
          />
          <input
            value={form.cover}
            onChange={(e) => set("cover")(e.target.value)}
            placeholder="…or paste URL"
            className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-gold-500/50"
          />
          {uploading && (
            <p className="mt-1 text-xs text-zinc-500">Uploading image…</p>
          )}
        </div>

        <Input label="Tags (comma separated)" value={form.tags} onChange={set("tags") as (v: string) => void} placeholder="defi, l2, airdrop" />

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Status
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => set("published")(true)}
              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                form.published
                  ? "border-gold-500/50 bg-gold-500/10 text-gold-200"
                  : "border-white/10 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Publish
            </button>
            <button
              type="button"
              onClick={() => set("published")(false)}
              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                !form.published
                  ? "border-white/20 bg-white/5 text-zinc-300"
                  : "border-white/10 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Save Draft
            </button>
          </div>
        </div>

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

        <button type="submit" disabled={loading || uploading} className="btn-gold w-full disabled:opacity-60">
          {loading
            ? "Saving…"
            : form.published
            ? "Publish now"
            : "Save as draft"}
        </button>
        <p className="text-xs text-zinc-600">
          Published posts appear instantly on the Research hub and home page.
        </p>
      </div>
    </form>
  );
}

/* ------------------------------ Content ----------------------------- */
function Content({ posts: initialPosts }: { posts: PostRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialPosts);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<PostRow | null>(null);

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

  async function togglePublish(post: PostRow) {
    setBusy(post.id);
    const res = await fetch(`/api/research/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !post.published }),
    });
    setBusy(null);
    if (res.ok) {
      setItems((arr) =>
        arr.map((p) =>
          p.id === post.id ? { ...p, published: !p.published } : p
        )
      );
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
    <>
      {editing && (
        <EditModal
          post={editing}
          onClose={() => setEditing(null)}
          onSave={(updated) => {
            setItems((arr) =>
              arr.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
            );
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      <div className="overflow-hidden rounded-2xl border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-700/60 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-3">Title</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.02]">
                <td className="px-5 py-3 font-medium text-zinc-200">{p.title}</td>
                <td className="px-5 py-3 text-zinc-400">{p.category}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ring-1 ${
                      p.published
                        ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                        : "bg-white/5 text-zinc-400 ring-white/10"
                    }`}
                  >
                    {p.published ? "Live" : "Draft"}
                  </span>
                </td>
                <td className="px-5 py-3 text-zinc-500">{formatDate(p.createdAt)}</td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-3">
                    {p.published && (
                      <Link href={`/research/${p.slug}`} target="_blank" className="text-gold-200 hover:underline">
                        View
                      </Link>
                    )}
                    <button
                      onClick={() => setEditing(p)}
                      className="text-zinc-400 hover:text-zinc-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => togglePublish(p)}
                      disabled={busy === p.id}
                      className="text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
                    >
                      {busy === p.id ? "…" : p.published ? "Unpublish" : "Publish"}
                    </button>
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
    </>
  );
}

/* ----------------------------- EditModal ---------------------------- */
function EditModal({
  post,
  onClose,
  onSave,
}: {
  post: PostRow;
  onClose: () => void;
  onSave: (updated: Partial<PostRow> & { id: string }) => void;
}) {
  const [form, setForm] = useState({
    title: post.title,
    category: post.category,
    published: post.published,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setLoading(true);
    setErr("");
    const res = await fetch(`/api/research/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setErr(data.error ?? "Save failed");
      return;
    }
    onSave({ id: post.id, ...form });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-700 p-6 shadow-xl">
        <h2 className="mb-4 font-display text-lg font-bold text-zinc-50">
          Edit Post
        </h2>
        <div className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(v) => setForm((f) => ({ ...f, title: v }))}
          />
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
              className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-gold-500/50"
            >
              <option>Research</option>
              <option>Article</option>
              <option>Post</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="edit-published"
              checked={form.published}
              onChange={(e) =>
                setForm((f) => ({ ...f, published: e.target.checked }))
              }
              className="rounded"
            />
            <label htmlFor="edit-published" className="text-sm text-zinc-400">
              Published (live)
            </label>
          </div>
          {err && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">
              {err}
            </p>
          )}
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={save}
            disabled={loading}
            className="btn-gold flex-1 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save changes"}
          </button>
          <button onClick={onClose} className="btn-ghost flex-1 !px-4 !py-2">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Members ----------------------------- */
function Members({ users: initialUsers }: { users: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = search.trim()
    ? users.filter(
        (u) =>
          u.name?.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  async function searchServer() {
    if (!search.trim()) return;
    setSearching(true);
    const res = await fetch(
      `/api/admin/users?search=${encodeURIComponent(search)}&limit=50`
    );
    setSearching(false);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
  }

  async function updateUser(
    id: string,
    payload: { role?: string; membership?: string; status?: string }
  ) {
    setBusy(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(null);
    if (res.ok) {
      const data = await res.json();
      setUsers((arr) =>
        arr.map((u) => (u.id === id ? { ...u, ...data.user } : u))
      );
    }
  }

  function exportCsv() {
    const header = "Name,Email,Provider,Role,Membership,Status,Signup Date,Last Login\n";
    const rows = users
      .map(
        (u) =>
          `"${u.name ?? ""}","${u.email}","${u.provider}","${u.role}","${u.membership}","${u.status}","${formatDate(u.signupDate)}","${u.lastLogin ? formatDate(u.lastLogin) : "Never"}"`
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

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchServer()}
            placeholder="Search by name or email…"
            className="flex-1 rounded-xl border border-white/10 bg-ink-700/60 px-4 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-gold-500/50"
          />
          <button
            onClick={searchServer}
            disabled={searching}
            className="btn-ghost !px-4 !py-2 text-xs disabled:opacity-60"
          >
            {searching ? "…" : "Search"}
          </button>
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setUsers(initialUsers);
              }}
              className="btn-ghost !px-4 !py-2 text-xs"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-sm text-zinc-500">
          {filtered.length} member{filtered.length !== 1 ? "s" : ""}
        </p>
        <button onClick={exportCsv} className="btn-ghost !px-4 !py-2 text-xs">
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-700/60 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Membership</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Signup</th>
              <th className="px-4 py-3">Last Login</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium text-zinc-200">{u.name ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-400 ring-1 ring-white/10">
                    {u.provider}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ring-1 ${
                      u.role === "ADMIN"
                        ? "bg-gold-500/10 text-gold-200 ring-gold-500/30"
                        : u.role === "PREMIUM"
                        ? "bg-purple-500/10 text-purple-300 ring-purple-500/30"
                        : "bg-white/5 text-zinc-400 ring-white/10"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ${
                    u.membership === "enterprise"
                      ? "bg-gold-500/10 text-gold-200 ring-gold-500/30"
                      : u.membership === "premium"
                      ? "bg-purple-500/10 text-purple-300 ring-purple-500/30"
                      : "bg-white/5 text-zinc-500 ring-white/10"
                  }`}>
                    {u.membership}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ring-1 ${
                      u.status === "active"
                        ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                        : "bg-red-500/10 text-red-400 ring-red-500/20"
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {formatDate(u.signupDate)}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {u.lastLogin ? formatDate(u.lastLogin) : "Never"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {/* Membership upgrade */}
                    <select
                      value={u.membership}
                      disabled={busy === u.id}
                      onChange={(e) =>
                        updateUser(u.id, { membership: e.target.value })
                      }
                      className="rounded-lg border border-white/10 bg-ink-700/60 px-2 py-1 text-xs text-zinc-300 outline-none disabled:opacity-50"
                    >
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                    {/* Disable / Enable toggle */}
                    <button
                      onClick={() =>
                        updateUser(u.id, {
                          status: u.status === "active" ? "disabled" : "active",
                        })
                      }
                      disabled={busy === u.id}
                      className={`rounded-lg px-2 py-1 text-xs ring-1 transition-colors disabled:opacity-50 ${
                        u.status === "active"
                          ? "bg-red-500/10 text-red-400 ring-red-500/20 hover:bg-red-500/20"
                          : "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20 hover:bg-emerald-500/20"
                      }`}
                    >
                      {busy === u.id
                        ? "…"
                        : u.status === "active"
                        ? "Disable"
                        : "Enable"}
                    </button>
                  </div>
                </td>
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
