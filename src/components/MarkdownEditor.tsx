"use client";

import { useRef, useState } from "react";
import { Markdown } from "@/lib/markdown";

type ViewMode = "write" | "split" | "preview";

type ToolItem = {
  label: string;
  title: string;
  wrap?: [string, string];
  line?: string;
};

const TOOLBAR: ToolItem[] = [
  { label: "B",   title: "Bold",         wrap: ["**", "**"] },
  { label: "I",   title: "Italic",       wrap: ["*", "*"] },
  { label: "H2",  title: "Heading 2",    line: "## " },
  { label: "H3",  title: "Heading 3",    line: "### " },
  { label: "` `", title: "Inline code",  wrap: ["`", "`"] },
  { label: "•",   title: "Bullet list",  line: "- " },
  { label: ">",   title: "Blockquote",   line: "> " },
  { label: "[ ]", title: "Link",         wrap: ["[", "](https://)"] },
];

function applyFormat(
  el: HTMLTextAreaElement,
  item: ToolItem,
  onChange: (v: string) => void
) {
  const { selectionStart: s, selectionEnd: e, value: v } = el;

  if (item.wrap) {
    const [pre, post] = item.wrap;
    const sel = v.slice(s, e) || "text";
    const next = v.slice(0, s) + pre + sel + post + v.slice(e);
    onChange(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(s + pre.length, s + pre.length + sel.length);
    }, 0);
    return;
  }

  if (item.line) {
    const lineStart = v.lastIndexOf("\n", s - 1) + 1;
    const next = v.slice(0, lineStart) + item.line + v.slice(lineStart);
    onChange(next);
    setTimeout(() => {
      el.focus();
      const pos = s + item.line!.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  }
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write your content in Markdown…",
  rows = 22,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [mode, setMode] = useState<ViewMode>("split");
  const ref = useRef<HTMLTextAreaElement>(null);

  const MODES: { id: ViewMode; label: string }[] = [
    { id: "write",   label: "Write" },
    { id: "split",   label: "Split" },
    { id: "preview", label: "Preview" },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-ink-800/70 px-3 py-2">
        {/* Formatting buttons */}
        <div className="flex flex-wrap items-center gap-0.5">
          {TOOLBAR.map((t) => (
            <button
              key={t.title}
              type="button"
              title={t.title}
              onMouseDown={(e) => {
                e.preventDefault(); // keep textarea focus
                if (ref.current) applyFormat(ref.current, t, onChange);
              }}
              className="inline-flex h-7 min-w-[30px] items-center justify-center rounded px-1.5 font-mono text-xs font-semibold text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-100"
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* View mode toggle */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-ink-800/80 p-0.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                mode === m.id
                  ? "bg-gold-500/20 text-gold-200"
                  : "text-zinc-600 hover:text-zinc-300"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Panes ───────────────────────────────────────────────────── */}
      <div
        className={
          mode === "split"
            ? "grid grid-cols-2 divide-x divide-white/10"
            : undefined
        }
      >
        {/* Write pane */}
        {(mode === "write" || mode === "split") && (
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            spellCheck={false}
            className="w-full resize-none bg-ink-700/60 px-4 py-3 font-mono text-sm leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-700"
          />
        )}

        {/* Preview pane */}
        {(mode === "preview" || mode === "split") && (
          <div
            className="prose-xyz min-h-[200px] overflow-y-auto bg-ink-700/30 px-5 py-4 text-sm"
            style={{ maxHeight: `${rows * 1.5}rem` }}
          >
            {value.trim() ? (
              <Markdown content={value} />
            ) : (
              <p className="italic text-zinc-700">Preview will appear here…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
