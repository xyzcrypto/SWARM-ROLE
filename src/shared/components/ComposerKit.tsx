"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import {
  Bold,
  Code,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  Loader2,
  Quote,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The pieces both inline composers need: formatting, and a cover image.
 *
 * ## Why markdown rather than a rich-text editor
 *
 * The dashboard already has a Tiptap editor, and it is the right tool for a long
 * piece. It is also the single heaviest thing this site ships - `/dashboard`
 * measures roughly twice every other route's bundle, and that is Tiptap loading
 * for every dashboard tab. Putting it on `/research` and `/points` would move
 * that weight onto two public pages to save typing two asterisks.
 *
 * So these buttons write MARKDOWN into a plain `<textarea>`. Both destinations
 * already render markdown (`MarkdownLite`), the output is a string a human can
 * read and fix, and the whole toolkit costs a handful of icons.
 *
 * ⚠️ That is a deliberate trade, not an oversight: colour-picking and arbitrary
 * fonts are NOT here, because neither survives the renderer. `MarkdownLite`
 * emits the design system's own type and colour tokens by design - which is what
 * keeps a post looking like the site rather than like whoever typed it.
 */

/** Wrap the selection, or insert a placeholder when nothing is selected. */
function surround(
  el: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder: string
): { value: string; selStart: number; selEnd: number } {
  const { selectionStart: s, selectionEnd: e, value } = el;
  const chosen = value.slice(s, e) || placeholder;
  const next = `${value.slice(0, s)}${before}${chosen}${after}${value.slice(e)}`;
  return {
    value: next,
    selStart: s + before.length,
    selEnd: s + before.length + chosen.length,
  };
}

/** Prefix each selected line, for lists and quotes. */
function prefixLines(
  el: HTMLTextAreaElement,
  prefix: string
): { value: string; selStart: number; selEnd: number } {
  const { selectionStart: s, selectionEnd: e, value } = el;
  const lineStart = value.lastIndexOf("\n", s - 1) + 1;
  const lineEnd = value.indexOf("\n", e) === -1 ? value.length : value.indexOf("\n", e);
  const block = value.slice(lineStart, lineEnd) || "";
  const next =
    value.slice(0, lineStart) +
    block
      .split("\n")
      .map((l) => (l.startsWith(prefix) ? l : prefix + l))
      .join("\n") +
    value.slice(lineEnd);
  return { value: next, selStart: lineStart, selEnd: lineEnd + prefix.length };
}

type Action = {
  key: string;
  label: string;
  icon: typeof Bold;
  apply: (el: HTMLTextAreaElement) => { value: string; selStart: number; selEnd: number };
};

const ACTIONS: Action[] = [
  { key: "bold", label: "Bold", icon: Bold, apply: (el) => surround(el, "**", "**", "bold text") },
  { key: "italic", label: "Italic", icon: Italic, apply: (el) => surround(el, "_", "_", "italic text") },
  { key: "h2", label: "Heading", icon: Heading2, apply: (el) => prefixLines(el, "## ") },
  { key: "list", label: "Bullet list", icon: List, apply: (el) => prefixLines(el, "- ") },
  { key: "quote", label: "Quote", icon: Quote, apply: (el) => prefixLines(el, "> ") },
  { key: "link", label: "Link", icon: Link2, apply: (el) => surround(el, "[", "](https://)", "link text") },
  { key: "code", label: "Code", icon: Code, apply: (el) => surround(el, "`", "`", "code") },
];

/**
 * A formatting row bound to one textarea.
 *
 * Selection is restored after every action, so a reader can bold a word and keep
 * typing without hunting for the caret. `requestAnimationFrame` because React
 * has to commit the new value before the selection can be set on it.
 */
export function MarkdownToolbar({
  textareaRef,
  value,
  onChange,
  className,
  children,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  className?: string;
  /** Extra controls (image picker, counters) rendered at the end of the row. */
  children?: React.ReactNode;
}) {
  const run = useCallback(
    (action: Action) => {
      const el = textareaRef.current;
      if (!el) return;
      const { value: next, selStart, selEnd } = action.apply(el);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(selStart, selEnd);
      });
    },
    [textareaRef, onChange]
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-0.5", className)}>
      {ACTIONS.map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={() => run(a)}
          title={a.label}
          aria-label={a.label}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-white/[0.05] hover:text-content active:text-content"
        >
          <a.icon className="h-4 w-4" strokeWidth={1.7} />
        </button>
      ))}
      {/* `value` is read so the toolbar re-renders with the field; without it a
          stale closure could write over text typed since the last action. */}
      <span className="sr-only">{value.length} characters</span>
      {children}
    </div>
  );
}

/**
 * Pick a cover image, upload it, hand back the URL.
 *
 * ⚠️ Uploads to `/api/upload`, which is **admin-gated and rate-limited**, and
 * degrades on its own terms: with no Supabase storage configured it returns 501
 * and the message is shown rather than swallowed. A composer that silently drops
 * an image is how someone publishes a post they think has a cover.
 *
 * The preview is a plain `<img>`, not `next/image`, and deliberately: the file
 * is served straight from Supabase Storage, so the browser fetches it directly
 * and it costs zero Vercel transfer. Routing a preview through the image
 * optimiser would spend both Fast Origin Transfer and optimisation quota to show
 * the uploader a thumbnail of their own file (cost-check, trap 3).
 */
export function CoverPicker({
  url,
  onChange,
  label = "Add a cover",
}: {
  url: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Upload failed.");
      const next = j?.data?.url ?? j?.url;
      if (!next) throw new Error("Upload returned no URL.");
      onChange(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          // Reset so picking the SAME file twice still fires a change event.
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title={label}
        aria-label={label}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-white/[0.05] hover:text-content disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.7} />
        ) : (
          <ImagePlus className="h-4 w-4" strokeWidth={1.7} />
        )}
      </button>

      {url && (
        <span className="relative mt-2 block overflow-hidden rounded-xl border border-hairline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="block max-h-44 w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remove the cover image"
            className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </span>
      )}

      {err && <span className="mt-1.5 block text-[11px] text-amber-200">{err}</span>}
    </>
  );
}

/** Characters left, turning amber near the limit and red past it. */
export function CharCount({ value, max }: { value: string; max: number }) {
  const left = max - value.length;
  if (left > max * 0.25) return null;
  return (
    <span
      className={cn(
        "mono ml-auto text-[11px] tabular-nums",
        left < 0 ? "grid-net-down" : "text-content-subtle"
      )}
    >
      {left}
    </span>
  );
}
