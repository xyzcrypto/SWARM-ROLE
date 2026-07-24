"use client";

import { useRef, useState } from "react";
import { Smile } from "lucide-react";
import { Markdown } from "@/lib/markdown";
import { COLOR_CLASS, type ColorKey, escapeHtml, htmlToMarkdown, markdownToHtml } from "@/lib/richtext";
import { uploadFileWithProgress } from "@/lib/upload";
import { compressImage } from "@/lib/image";
import { EmojiPicker } from "./EmojiPicker";

export type EditablePost = {
  id?: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  cover: string;
  tags: string;
  published: boolean;
  premium: boolean;
};

const EMPTY: EditablePost = {
  title: "",
  excerpt: "",
  content: "",
  category: "Research",
  cover: "",
  tags: "",
  published: false,
  premium: false,
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_BYTES = 5 * 1024 * 1024;

type Fmt = "bold" | "italic" | "h1" | "h2" | "h3" | "list" | "quote" | "code" | "link";
const COLORS: { key: ColorKey; label: string; swatch: string }[] = [
  { key: "gold", label: "Gold", swatch: "bg-gold-400" },
  { key: "mint", label: "Mint", swatch: "bg-mint-400" },
  { key: "red", label: "Red", swatch: "bg-rose-400" },
  { key: "blue", label: "Blue", swatch: "bg-sky-400" },
];

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
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [editorHtml] = useState(() => markdownToHtml((initial ?? EMPTY).content));
  const editableRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof EditablePost>(k: K, v: EditablePost[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // The box is the only source of truth for its own DOM while the user is
  // typing (editorHtml above seeds it once, on mount, and is never written
  // back to - see the div below) - this just mirrors its content back into
  // form.content as plain markdown, for saving/preview/autosave.
  function syncFromDom() {
    const el = editableRef.current;
    if (!el) return;
    set("content", htmlToMarkdown(el));
  }

  // Selected text applies formatting directly (real bold/heading/color), via
  // the browser's native contentEditable commands - no more literal `**`/`#`
  // syntax characters landing in the box. Toolbar buttons prevent the
  // mousedown's default focus shift (see onMouseDown below) so the box never
  // loses focus/selection when a button is clicked.
  function applyFormat(kind: Fmt) {
    const el = editableRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    switch (kind) {
      case "bold":
        document.execCommand("bold");
        break;
      case "italic":
        document.execCommand("italic");
        break;
      case "h1":
        document.execCommand("formatBlock", false, "<h1>");
        break;
      case "h2":
        document.execCommand("formatBlock", false, "<h2>");
        break;
      case "h3":
        document.execCommand("formatBlock", false, "<h3>");
        break;
      case "list":
        document.execCommand("insertUnorderedList");
        break;
      case "quote":
        document.execCommand("formatBlock", false, "<blockquote>");
        break;
      case "code": {
        const sel = window.getSelection()?.toString() || "code";
        document.execCommand("insertHTML", false, `<code>${escapeHtml(sel)}</code>`);
        break;
      }
      case "link": {
        const selection = window.getSelection();
        const hasSelection = Boolean(selection && !selection.isCollapsed);
        const url = window.prompt("Link URL", "https://");
        if (!url) return;
        if (hasSelection) {
          document.execCommand("createLink", false, url);
        } else {
          document.execCommand("insertHTML", false, `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
        }
        break;
      }
    }
    syncFromDom();
  }

  function applyColor(color: ColorKey) {
    const el = editableRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const sel = window.getSelection()?.toString() || "colored text";
    document.execCommand("insertHTML", false, `<span class="${COLOR_CLASS[color]}">${escapeHtml(sel)}</span>`);
    syncFromDom();
  }

  function insertEmoji(emoji: string) {
    const el = editableRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    document.execCommand("insertText", false, emoji);
    syncFromDom();
    setShowEmoji(false);
  }

  async function uploadCover(file: File) {
    setMsg(null);
    // Client-side guards mirror the server so users get instant feedback.
    if (!ALLOWED_TYPES.includes(file.type)) {
      setMsg({ type: "err", text: "Use a JPG, PNG, WebP, GIF or AVIF image." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setMsg({ type: "err", text: "Image is too large (max 5 MB)." });
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      // Downscale/re-encode client-side so the upload is small + reliable - this
      // also keeps it under the inline data-URL cap when Storage isn't configured.
      const upload = await compressImage(file, 1280);
      const { ok, status, data } = await uploadFileWithProgress("/api/upload", upload, setProgress);
      if (!ok) {
        // 501 = Supabase Storage not configured yet → guide to the URL fallback.
        const hint = status === 501 ? " You can paste an image URL instead." : "";
        setMsg({ type: "err", text: (data.error || "Upload failed.") + hint });
        return;
      }
      set("cover", data.url);
      setMsg({ type: "ok", text: "Image uploaded." });
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
        text: publish ? "Published - your post is live." : "Saved as draft.",
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
    { k: "h1", label: "H1", title: "Heading" },
    { k: "h2", label: "H2", title: "Subheading" },
    { k: "h3", label: "H3", title: "Minor heading" },
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
        <Field label="Excerpt / summary" value={form.excerpt} onChange={(v) => set("excerpt", v)} placeholder="A short 1-2 line summary shown on cards." textarea rows={2} />

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
              <div className="mb-2 flex flex-wrap items-center gap-1">
                {toolbar.map((t) => (
                  <button
                    key={t.k}
                    type="button"
                    title={t.title}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyFormat(t.k)}
                    className="h-8 min-w-8 rounded-md border border-white/10 bg-ink-700/60 px-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-gold-500/40 hover:text-gold-100"
                  >
                    {t.label}
                  </button>
                ))}
                <span className="mx-0.5 h-5 w-px bg-white/10" aria-hidden />
                {COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    title={`${c.label} text`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyColor(c.key)}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-ink-700/60 transition-colors hover:border-gold-500/40"
                  >
                    <span className={`h-3.5 w-3.5 rounded-full ${c.swatch}`} />
                  </button>
                ))}
                <span className="mx-0.5 h-5 w-px bg-white/10" aria-hidden />
                <div className="relative">
                  <button
                    type="button"
                    title="Emoji"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowEmoji((v) => !v)}
                    className="flex h-8 min-w-8 items-center justify-center rounded-md border border-white/10 bg-ink-700/60 px-2 text-zinc-300 transition-colors hover:border-gold-500/40 hover:text-gold-100"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  {showEmoji && <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmoji(false)} />}
                </div>
              </div>
              {/* Real contentEditable box - toolbar actions apply directly to the
                  selected text (native bold/heading/color), not literal markdown
                  syntax characters. Seeded once from editorHtml on mount; never
                  reset from form.content afterwards (that would reset the caret
                  on every keystroke) - onInput mirrors the DOM back into
                  form.content as markdown instead. overscroll-contain stops a
                  scroll that hits the top/bottom of the box from chaining up
                  and moving the whole page. */}
              <div
                ref={editableRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncFromDom}
                dangerouslySetInnerHTML={{ __html: editorHtml }}
                data-placeholder="Write your research here…"
                className="prose-xyz h-[26rem] w-full overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm outline-none transition-colors focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20 empty:before:text-zinc-600 empty:before:content-[attr(data-placeholder)]"
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
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) uploadCover(f);
            }}
            className={`mt-2 w-full rounded-xl border border-dashed px-4 py-2.5 text-sm transition-all disabled:opacity-60 ${
              dragging
                ? "scale-[1.01] border-mint-500/60 bg-mint-500/10 text-mint-100"
                : "border-white/15 text-zinc-400 hover:border-gold-500/40 hover:text-gold-100"
            }`}
          >
            {uploading ? `Uploading… ${progress}%` : form.cover ? "Replace (click or drop)" : "Upload an image (click or drop)"}
          </button>
          {uploading && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-mint-shine transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Premium content toggle */}
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gold-500/20 bg-gold-500/[0.04] px-4 py-3">
          <span>
            <span className="block text-sm font-semibold text-gold-100">Premium content</span>
            <span className="block text-[11px] text-zinc-500">Body locked to Premium members</span>
          </span>
          <input
            type="checkbox"
            checked={form.premium}
            onChange={(e) => set("premium", e.target.checked)}
            className="h-5 w-5 accent-gold-500"
          />
        </label>

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
