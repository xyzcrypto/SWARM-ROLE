"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { MarkdownEditor } from "./MarkdownEditor";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type Stats = {
  totalUsers: number;
  googleUsers: number;
  emailUsers: number;
  last7days: number;
  activeMembers: number;
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
  excerpt: string;
  content: string;
  cover: string | null;
  category: string;
  tags: string;
  published: boolean;
  featured: boolean;
  createdAt: string;
};

type Tab = "overview" | "publish" | "content" | "members";

// ─────────────────────────────────────────────────────────────
// Main shell
// ─────────────────────────────────────────────────────────────

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
    { id: "publish",  label: "Publish" },
    { id: "content",  label: `Content (${posts.length})` },
    { id: "members",  label: `Members (${recentUsers.length})` },
  ];

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">Admin</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-zinc-50 sm:text-4xl">
          Welcome, {adminName.split(" ")[0]} 👋
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Manage content, members and platform intelligence.
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
      {tab === "publish"  && <Publish />}
      {tab === "content"  && <Content posts={posts} />}
      {tab === "members"  && <Members users={recentUsers} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Overview
// ─────────────────────────────────────────────────────────────

function Overview({ stats }: { stats: Stats }) {
  const cards = [
    { label: "Total signups",     value: stats.totalUsers,    hint: "All registered users" },
    { label: "New (7 days)",      value: stats.last7days,     hint: "Signed up this week" },
    { label: "Active members",    value: stats.activeMembers, hint: "isMember toggled on" },
    { label: "Google sign-ins",   value: stats.googleUsers,   hint: "Via Gmail / Google" },
    { label: "Email sign-ups",    value: stats.emailUsers,    hint: "Email + password" },
    { label: "Published content", value: stats.totalPosts,    hint: "Live posts on the hub" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="card-gold-border rounded-2xl p-6">
          <p className="text-sm text-zinc-500">{c.label}</p>
          <p className="mt-2 font-display text-4xl font-bold text-gold-gradient">{c.value}</p>
          <p className="mt-1 text-xs text-zinc-600">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PostForm — shared by Publish (create) and Content (edit)
// ─────────────────────────────────────────────────────────────

type PostFormData = {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  cover: string;
  tags: string;
  published: boolean;
  featured: boolean;
};

function PostForm({
  post,
  onSaved,
  onCancel,
}: {
  post?: PostRow;
  onSaved?: (updated: PostRow) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const isEdit = !!post;

  const [form, setForm] = useState<PostFormData>({
    title:     post?.title     ?? "",
    excerpt:   post?.excerpt   ?? "",
    content:   post?.content   ?? "",
    category:  post?.category  ?? "Research",
    cover:     post?.cover     ?? "",
    tags:      post?.tags      ?? "",
    published: post?.published ?? false,
    featured:  post?.featured  ?? false,
  });

  const [msg, setMsg]       = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const set =
    <K extends keyof PostFormData>(k: K) =>
    (v: PostFormData[K]) =>
      setForm((f) => ({ ...f, [k]: v }));

  async function submit(publishOverride?: boolean) {
    setMsg(null);
    setLoading(true);

    const payload = {
      ...form,
      published: publishOverride !== undefined ? publishOverride : form.published,
    };

    const url    = isEdit ? `/api/research/${post!.id}` : "/api/research";
    const method = isEdit ? "PUT" : "POST";

    const res  = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMsg({ type: "err", text: data.error || "Something went wrong." });
      return;
    }

    if (isEdit) {
      const updated: PostRow = {
        ...post!,
        title:     payload.title,
        excerpt:   payload.excerpt,
        content:   payload.content,
        category:  payload.category,
        cover:     payload.cover || null,
        tags:      payload.tags ?? "",
        published: payload.published,
        featured:  payload.featured ?? false,
      };
      setMsg({ type: "ok", text: "Post updated." });
      onSaved?.(updated);
    } else {
      setMsg({
        type: "ok",
        text: payload.published
          ? "Published! Your post is now live."
          : "Draft saved. Publish it from the Content tab when ready.",
      });
      setForm({ title: "", excerpt: "", content: "", category: "Research", cover: "", tags: "", published: false, featured: false });
      router.refresh();
    }
  }

  return (
    <div>
      {/* Back button (edit mode) */}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-gold-200"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M19 12H5M11 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to all posts
        </button>
      )}

      {/* Edit mode header */}
      {isEdit && (
        <div className="mb-6 rounded-xl border border-white/8 bg-ink-700/40 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-400">Editing</p>
          <p className="mt-1 font-display text-xl font-bold text-zinc-100 line-clamp-1">{post!.title}</p>
          <p className="mt-1 text-xs text-zinc-600">
            Slug: <code className="text-zinc-500">/{post!.slug}</code>
            <span className="ml-2 text-zinc-700">(immutable — changing it would break published URLs)</span>
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Main column ─────────────────────────────────────── */}
        <div className="space-y-5 lg:col-span-2">
          <FormInput
            label="Title"
            value={form.title}
            onChange={set("title")}
            placeholder="e.g. The State of L2s in 2026"
            required
          />
          <FormTextarea
            label="Excerpt / Summary"
            value={form.excerpt}
            onChange={set("excerpt")}
            placeholder="A short 1–2 sentence summary shown on post cards."
            rows={2}
            required
          />
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Content{" "}
              <span className="ml-1 font-normal normal-case text-zinc-600">
                — Markdown supported
              </span>
            </label>
            <MarkdownEditor
              value={form.content}
              onChange={set("content")}
              placeholder={`Write your research here.\n\n## Heading\n- bullet point\n**bold**, *italic*, \`code\`, [link](https://example.com)`}
              rows={24}
            />
          </div>
        </div>

        {/* ── Sidebar ─────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Category */}
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

          <FormInput
            label="Cover image URL (optional)"
            value={form.cover}
            onChange={set("cover")}
            placeholder="https://…/cover.jpg"
          />

          <FormInput
            label="Tags (comma separated)"
            value={form.tags}
            onChange={set("tags")}
            placeholder="defi, l2, airdrop"
          />

          {/* Status toggles */}
          <div className="space-y-3 rounded-xl border border-white/10 bg-ink-700/30 p-4">
            <Toggle
              label="Published"
              hint="Visible to all readers"
              checked={form.published}
              onChange={set("published")}
            />
            <div className="h-px bg-white/5" />
            <Toggle
              label="Featured"
              hint="Highlighted across the site"
              checked={form.featured}
              onChange={set("featured")}
            />
          </div>

          {/* Feedback */}
          {msg && (
            <p
              className={`rounded-lg px-3 py-2.5 text-sm ring-1 ${
                msg.type === "ok"
                  ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                  : "bg-red-500/10 text-red-300 ring-red-500/20"
              }`}
            >
              {msg.text}
            </p>
          )}

          {/* Action buttons */}
          {isEdit ? (
            <button
              type="button"
              onClick={() => submit()}
              disabled={loading}
              className="btn-gold w-full disabled:opacity-60"
            >
              {loading ? "Saving…" : "Save Changes"}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => submit(false)}
                disabled={loading}
                className="btn-ghost !py-2.5 text-sm disabled:opacity-60"
              >
                {loading ? "…" : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={() => submit(true)}
                disabled={loading}
                className="btn-gold !py-2.5 text-sm disabled:opacity-60"
              >
                {loading ? "…" : "Publish Now"}
              </button>
            </div>
          )}

          {!isEdit && (
            <p className="text-center text-xs text-zinc-600">
              Drafts are only visible to admins.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Publish tab — create new post
// ─────────────────────────────────────────────────────────────

function Publish() {
  return <PostForm />;
}

// ─────────────────────────────────────────────────────────────
// Content tab — CMS: list, filter, toggle, inline edit
// ─────────────────────────────────────────────────────────────

type ContentFilter = "all" | "published" | "drafts";

function Content({ posts: initial }: { posts: PostRow[] }) {
  const router = useRouter();
  const [posts, setPosts]   = useState(initial);
  const [editing, setEditing] = useState<PostRow | null>(null);
  const [filter, setFilter]   = useState<ContentFilter>("all");
  const [busy, setBusy]       = useState<string | null>(null);

  /* ── Edit mode ─────────────────────────────────────────── */
  if (editing) {
    return (
      <PostForm
        post={editing}
        onSaved={(updated) => {
          setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          setEditing(null);
          router.refresh();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  /* ── Helpers ────────────────────────────────────────────── */
  const counts = {
    all:       posts.length,
    published: posts.filter((p) => p.published).length,
    drafts:    posts.filter((p) => !p.published).length,
  };

  const filtered =
    filter === "published" ? posts.filter((p) => p.published) :
    filter === "drafts"    ? posts.filter((p) => !p.published) :
    posts;

  async function toggle(p: PostRow, field: "published" | "featured") {
    const key = `${field[0]}-${p.id}`;
    setBusy(key);
    const res = await fetch(`/api/research/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !p[field] }),
    });
    setBusy(null);
    if (res.ok) {
      setPosts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, [field]: !p[field] } : x))
      );
      if (field === "published") router.refresh();
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this post permanently? This cannot be undone.")) return;
    setBusy(`d-${id}`);
    const res = await fetch(`/api/research/${id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    }
  }

  /* ── List mode ──────────────────────────────────────────── */
  return (
    <div>
      {/* Filter + summary */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(["all", "published", "drafts"] as ContentFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                filter === f
                  ? "bg-gold-500/15 text-gold-200 ring-1 ring-gold-500/30"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {f} ({counts[f]})
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-600">
          {counts.published} published · {counts.drafts} draft{counts.drafts !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold-500/20 bg-ink-700/40 p-12 text-center text-sm text-zinc-500">
          {filter === "all"
            ? <span>No content yet. Head to the <b className="text-gold-200">Publish</b> tab to create your first post.</span>
            : <span>No {filter} posts.</span>}
        </div>
      ) : (
        /* Posts table */
        <div className="overflow-x-auto rounded-2xl border border-white/8">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-700/60 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Featured</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  {/* Title */}
                  <td className="max-w-[260px] px-5 py-3">
                    <span className="line-clamp-1 font-medium text-zinc-200">{p.title}</span>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-400 ring-1 ring-white/10">
                      {p.category}
                    </span>
                  </td>

                  {/* Published toggle */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(p, "published")}
                      disabled={busy === `p-${p.id}`}
                      title={p.published ? "Click to unpublish" : "Click to publish"}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 transition-colors disabled:opacity-50 ${
                        p.published
                          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30 hover:bg-emerald-500/20"
                          : "bg-white/5 text-zinc-500 ring-white/10 hover:bg-white/10 hover:text-zinc-300"
                      }`}
                    >
                      {busy === `p-${p.id}` ? "…" : p.published ? "Published" : "Draft"}
                    </button>
                  </td>

                  {/* Featured star */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggle(p, "featured")}
                      disabled={busy === `f-${p.id}`}
                      title={p.featured ? "Remove from featured" : "Mark as featured"}
                      className={`text-xl leading-none transition-colors disabled:opacity-50 ${
                        p.featured
                          ? "text-gold-400 hover:text-gold-600"
                          : "text-zinc-700 hover:text-zinc-400"
                      }`}
                    >
                      {busy === `f-${p.id}` ? "…" : p.featured ? "★" : "☆"}
                    </button>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {formatDate(p.createdAt)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3 text-xs">
                      <button
                        onClick={() => setEditing(p)}
                        className="font-medium text-gold-200 hover:underline"
                      >
                        Edit
                      </button>
                      <Link
                        href={`/research/${p.slug}`}
                        target="_blank"
                        className="text-zinc-400 hover:text-zinc-200 hover:underline"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => remove(p.id)}
                        disabled={busy === `d-${p.id}`}
                        className="text-red-400 hover:underline disabled:opacity-50"
                      >
                        {busy === `d-${p.id}` ? "…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Members tab
// ─────────────────────────────────────────────────────────────

function Members({ users: initial }: { users: UserRow[] }) {
  const [users, setUsers]     = useState(initial);
  const [toggling, setToggling] = useState<string | null>(null);

  function exportCsv() {
    const header = "Name,Email,Provider,Role,Member,Last Login,Joined\n";
    const rows = users
      .map(
        (u) =>
          `"${u.name ?? ""}","${u.email}","${u.provider}","${u.role}","${
            u.isMember ? "Yes" : "No"
          }","${u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}","${formatDate(u.createdAt)}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
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
        <p className="text-sm text-zinc-500">Showing latest {users.length} members</p>
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
                  {u.lastLoginAt
                    ? formatDate(u.lastLoginAt)
                    : <span className="text-zinc-700">Never</span>}
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

// ─────────────────────────────────────────────────────────────
// Reusable primitives
// ─────────────────────────────────────────────────────────────

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex cursor-pointer items-center justify-between gap-3" onClick={() => onChange(!checked)}>
      <div>
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        <p className="text-xs text-zinc-500">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
          checked ? "bg-gold-500" : "bg-zinc-700"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function FormInput({
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

function FormTextarea({
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
