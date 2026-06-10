"use client";

import { useRef, useState } from "react";
import { Markdown } from "@/lib/markdown";

export type EditablePost = {
  id?: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  cover: string;
  tags: string;
  published: boolean;
};

const EMPTY: EditablePost = {
  title: "",
  excerpt: "",
  content: "",
  category: "Research",
  cover: "",
  tags: "",
  published: false,
};

type Fmt = "bold" | "italic" | "h2" | "h3" | "list" | "quote" | "code" | "link";

export function PostEditor({
  mode,
  initial,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  initial?: EditablePost;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<EditablePost>(initial ?? EMPTY);
  const [view, setView] = useState<"write" | "preview">("write");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof EditablePost>(k: K, v: EditablePost[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function applyFormat(kind: Fmt) {
    const ta = contentRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const sel = value.slice(s, e);
    const wrap: Record<Fmt, string> = {
      bold: `**${sel || "bold text"}**`,
      italic: `*${sel || "italic"}*`,
      h2: `## ${sel || "Heading"}`,
      h3: `### ${sel || "Subheading"}`,
      list: `- ${sel || "list item"}`,
      quote: `> ${sel || "quote"}`,
      code: `\`${sel || "code"}\``,
      link: `[${sel || "link text"}](https://)`,
    };
    const insert = wrap[kind];
    const next = value.slice(0, s) + insert + value.slice(e);
    set("content", next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = s + insert.length;
    });
  }

  async function uploadCover(file: File) {
    setMsg(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "Upload failed." });
        return;
      }
      set("cover", data.url);
    } catch {
      setMsg({ type: "err", text: "Upload failed. Please try again." });
    } finally {
      setUploading(false);
    }
  }

  async function save(publish: boolean) {
    setMsg(null);
    setBusy(true);
    try {
      const payload = { ...form, published: publish };
      const res = await fetch(
        mode === "edit" ? `/api/research/${form.id}` : "/api/research",
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "Could not save." });
        return;
      }
      setMsg({
        type: "ok",
        text: publish ? "Published — your post is live." : "Saved as draft.",
      });
      if (mode === "create") setForm(EMPTY);
      onDone();
    } catch {
      setMsg({ type: "err", text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const toolbar: { k: Fmt; label: string; title: string }[] = [
    { k: "bold", label: "B", title: "Bold" },
    { k: "italic", label: "I", title: "Italic" },
    { k: "h2", label: "H2", title: "Heading" },
    { k: "h3", label: "H3", title: "Subheading" },
    { k: "list", label: "•", title: "List" },
    { k: "quote", label: "❝", title: "Quote" },
    { k: "code", label: "</>", title: "Code" },
    { k: "link", label: "🔗", title: "Link" },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Main column */}
      <div className="space-y-4 lg:col-span-2">
        <Field label="Title" value={form.title} onChange={(v) => set("title", v)} placeholder="e.g. The State of L2s in 2026" />
        <Field label="Excerpt / summary" value={form.excerpt} onChange={(v) => set("excerpt", v)} placeholder="A short 1–2 line summary shown on cards." textarea rows={2} />

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Content (Markdown)</label>
            <div className="flex gap-1 rounded-lg bg-ink-700/60 p-0.5 text-xs">
              {(["write", "preview"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-md px-2.5 py-1 font-medium capitalize transition-colors ${
                    view === v ? "bg-gold-500/20 text-gold-100" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {view === "write" ? (
            <>
              <div className="mb-2 flex flex-wrap gap-1">
                {toolbar.map((t) => (
                  <button
                    key={t.k}
                    type="button"
                    title={t.title}
                    onClick={() => applyFormat(t.k)}
                    className="h-8 min-w-8 rounded-md border border-white/10 bg-ink-700/60 px-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-gold-500/40 hover:text-gold-100"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <textarea
                ref={contentRef}
                value={form.content}
                onChange={(e) => set("content", e.target.value)}
                rows={16}
                placeholder={"Write your research here.\n\n## Heading\n- bullet point\n**bold**, *italic*, `code`, [links](https://x.com)"}
                className="w-full resize-y rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 font-mono text-sm leading-relaxed text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
              />
            </>
          ) : (
            <div className="prose-xyz min-h-[22rem] rounded-xl border border-white/10 bg-ink-700/40 px-5 py-4">
              {form.content.trim() ? (
                <Markdown content={form.content} />
              ) : (
                <p className="text-sm text-zinc-600">Nothing to preview yet.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Side column */}
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Category</label>
          <select
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-gold-500/50"
          >
            <option>Research</option>
            <option>Article</option>
            <option>Post</option>
          </select>
        </div>

        {/* Cover image: URL or upload */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Cover image</label>
          {form.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <div className="relative mb-2 overflow-hidden rounded-xl border border-white/10">
              <img src={form.cover} alt="Cover preview" className="h-32 w-full object-cover" />
              <button
                type="button"
                onClick={() => set("cover", "")}
                className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white backdrop-blur hover:bg-black/80"
              >
                Remove
              </button>
            </div>
          ) : null}
          <input
            value={form.cover}
            onChange={(e) => set("cover", e.target.value)}
            placeholder="Paste image URL…"
            className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-2.5 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500/50"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadCover(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-2 w-full rounded-xl border border-dashed border-white/15 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:border-gold-500/40 hover:text-gold-100 disabled:opacity-60"
          >
            {uploading ? "Uploading…" : form.cover ? "Replace by upload" : "Upload an image"}
          </button>
        </div>

        <Field label="Tags (comma separated)" value={form.tags} onChange={(v) => set("tags", v)} placeholder="defi, l2, airdrop" />

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

        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => save(true)} disabled={busy} className="btn-gold w-full disabled:opacity-60">
            {busy ? "Saving…" : mode === "edit" ? "Update & publish" : "Publish now"}
          </button>
          <button type="button" onClick={() => save(false)} disabled={busy} className="btn-ghost w-full disabled:opacity-60">
            Save as draft
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="w-full py-2 text-center text-sm text-zinc-500 hover:text-zinc-300">
              Cancel
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-600">
          Drafts stay private. Publishing makes the post live on the Research hub and home page instantly.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  rows?: number;
}) {
  const cls =
    "w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20";
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className={`${cls} resize-y`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </label>
  );
}
