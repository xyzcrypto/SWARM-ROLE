// A tiny, dependency-free markdown renderer for AI briefings: supports
// `##`/`###` headings, `-`/`•` bullet lists, `**bold**` inline, and paragraphs.
// Deliberately minimal + safe (no raw HTML) — good enough for our AI text.
import { Fragment, type ReactNode } from "react";

function inline(text: string, keyBase: string): ReactNode[] {
  // Split on **bold** while keeping the delimiters' content.
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={`${keyBase}-b${i}`} className="font-semibold text-zinc-100">{p.slice(2, -2)}</strong>
    ) : (
      <Fragment key={`${keyBase}-t${i}`}>{p}</Fragment>
    )
  );
}

export function MarkdownLite({ text, className }: { text: string; className?: string }) {
  const lines = (text || "").replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (!list.length) return;
    const items = list;
    list = [];
    blocks.push(
      <ul key={key} className="my-2 space-y-1.5 pl-1">
        {items.map((li, i) => (
          <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-zinc-300">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400/70" />
            <span>{inline(li, `li${key}-${i}`)}</span>
          </li>
        ))}
      </ul>
    );
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) { flushList(`ul-${i}`); return; }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) { list.push(bullet[1]); return; }
    flushList(`ul-${i}`);
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      blocks.push(
        <h3 key={`h-${i}`} className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-200">
          {inline(h[2], `h-${i}`)}
        </h3>
      );
      return;
    }
    blocks.push(
      <p key={`p-${i}`} className="my-2 text-[14px] leading-relaxed text-zinc-300">{inline(line, `p-${i}`)}</p>
    );
  });
  flushList("ul-end");

  return <div className={className}>{blocks}</div>;
}
