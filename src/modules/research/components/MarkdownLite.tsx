// A tiny, dependency-free markdown renderer for AI briefings: headings
// (`#`/`##`/`###`), bullet + ordered lists, blockquotes, `**bold**` / `*italic*`
// inline, and paragraphs. Deliberately minimal + safe (no raw HTML).
import { Fragment, type ReactNode } from "react";
export { stripMarkdown } from "@/lib/strip-markdown";

function inline(text: string, keyBase: string): ReactNode[] {
  if (!text.includes("*")) return [text];
  // Split on **bold** and *italic* while keeping the delimiters' content.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={`${keyBase}-b${i}`} className="font-semibold text-zinc-100">{p.slice(2, -2)}</strong>;
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2)
      return <em key={`${keyBase}-i${i}`} className="italic text-zinc-200">{p.slice(1, -1)}</em>;
    return <Fragment key={`${keyBase}-t${i}`}>{p}</Fragment>;
  });
}

export function MarkdownLite({ text, className }: { text: string; className?: string }) {
  const lines = (text || "").replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = (key: string) => {
    if (!list || !list.items.length) return;
    const { ordered, items } = list;
    list = null;
    const Tag = ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={key} className="my-2 space-y-1.5 pl-1">
        {items.map((li, i) => (
          <li key={i} className="flex gap-2 text-[15px] leading-relaxed text-zinc-300">
            {ordered ? (
              <span className="mono mt-[1px] shrink-0 text-[12px] font-semibold text-gold-300/80">{i + 1}.</span>
            ) : (
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400/70" />
            )}
            <span>{inline(li, `li${key}-${i}`)}</span>
          </li>
        ))}
      </Tag>
    );
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) { flushList(`l-${i}`); return; }

    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    if (ordered) {
      if (!list || !list.ordered) { flushList(`l-${i}`); list = { ordered: true, items: [] }; }
      list.items.push(ordered[1]);
      return;
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      if (!list || list.ordered) { flushList(`l-${i}`); list = { ordered: false, items: [] }; }
      list.items.push(bullet[1]);
      return;
    }
    flushList(`l-${i}`);

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      blocks.push(
        <blockquote key={`q-${i}`} className="my-2 border-l-2 border-gold-500/40 pl-3 text-[14px] italic leading-relaxed text-zinc-400">
          {inline(quote[1], `q-${i}`)}
        </blockquote>
      );
      return;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls = level <= 2
        ? "mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-gold-200"
        : "mt-3 text-[15px] font-semibold text-zinc-100";
      blocks.push(<h3 key={`h-${i}`} className={cls}>{inline(h[2], `h-${i}`)}</h3>);
      return;
    }
    blocks.push(
      <p key={`p-${i}`} className="my-2 text-[15px] leading-relaxed text-zinc-300">{inline(line, `p-${i}`)}</p>
    );
  });
  flushList("l-end");

  return <div className={className}>{blocks}</div>;
}
