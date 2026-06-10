"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { PostEditor, type EditablePost } from "./PostEditor";

export type PostRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  published: boolean;
  createdAt: string;
};

const CATEGORIES = ["All", "Research", "Article", "Post"];
const STATUSES = ["All", "Published", "Draft"] as const;

export function PostManager({ posts }: { posts: PostRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(posts);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("All");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditablePost | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((p) => {
      if (cat !== "All" && p.category !== cat) return false;
      if (status === "Published" && !p.published) return false;
      if (status === "Draft" && p.published) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, cat, status]);

  async function openEditor(id: string) {
    setError("");
    setLoadingEdit(id);
    try {
      const res = await fetch(`/api/research/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load the post.");
        return;
      }
      const p = data.post;
      setEditing({
        id: p.id,
        title: p.title,
        excerpt: p.excerpt,
        content: p.content,
        category: p.category,
        cover: p.cover ?? "",
        tags: p.tags ?? "",
        published: p.published,
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingEdit(null);
    }
  }

  async function togglePublish(p: PostRow) {
    setBusy(p.id);
    try {
      const res = await fetch(`/api/research/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !p.published }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not update status.");
        return;
      }
      setRows((arr) => arr.map((x) => (x.id === p.id ? { ...x, published: !x.published } : x)));
      router.refresh();
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(p: PostRow) {
    if (!confirm(`Delete "${p.title}" permanently?`)) return;
    setBusy(p.id);
    try {
      const res = await fetch(`/api/research/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete the post.");
        return;
      }
      setRows((arr) => arr.filter((x) => x.id !== p.id));
      router.refresh();
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  // Editing takes over the panel.
  if (editing) {
    return (
      <div>
        <button
          onClick={() => setEditing(null)}
          className="mb-5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← Back to all posts
        </button>
        <PostEditor
          mode="edit"
          initial={editing}
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search posts by title…"
          className="w-full max-w-sm rounded-xl border border-line bg-ink-700/60 px-4 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-gold-500/50"
        />
        <div className="flex flex-wrap gap-2">
          <Select value={cat} onChange={setCat} options={CATEGORIES} />
          <Select value={status} onChange={(v) => setStatus(v as (typeof STATUSES)[number])} options={[...STATUSES]} />
          <span className="mono inline-flex items-center px-1 text-xs text-zinc-500">
            {filtered.length} of {rows.length}
          </span>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">{error}</p>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold-500/20 bg-ink-700/40 p-12 text-center text-sm text-zinc-500">
          {rows.length === 0 ? (
            <>No content yet. Use the <b className="text-gold-200">Publish</b> tab to create your first post.</>
          ) : (
            <>No posts match your filters.</>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/8">
          <table className="w-full min-w-[640px] text-left text-sm">
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
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-medium text-zinc-200">{p.title}</td>
                  <td className="px-5 py-3 text-zinc-400">{p.category}</td>
                  <td className="px-5 py-3">
                    {p.published ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-500/12 px-2.5 py-1 text-[11px] font-medium text-mint-300 ring-1 ring-mint-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-mint-400" /> Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/30">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-zinc-500">{formatDate(p.createdAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-3 text-xs">
                      <button
                        onClick={() => openEditor(p.id)}
                        disabled={loadingEdit === p.id}
                        className="font-medium text-gold-200 hover:underline disabled:opacity-50"
                      >
                        {loadingEdit === p.id ? "…" : "Edit"}
                      </button>
                      <button
                        onClick={() => togglePublish(p)}
                        disabled={busy === p.id}
                        className="font-medium text-zinc-300 hover:text-zinc-100 disabled:opacity-50"
                      >
                        {p.published ? "Unpublish" : "Publish"}
                      </button>
                      {p.published && (
                        <Link href={`/research/${p.slug}`} target="_blank" className="text-zinc-400 hover:text-zinc-200">
                          View
                        </Link>
                      )}
                      <button
                        onClick={() => remove(p)}
                        disabled={busy === p.id}
                        className="text-red-400 hover:underline disabled:opacity-50"
                      >
                        Delete
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

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-line bg-ink-700/60 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-gold-500/50"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
