// A tiny, dependency-free markdown renderer for AI briefings: headings
// (`#`/`##`/`###`), bullet + ordered lists, blockquotes, `**bold**` / `*italic*`
// inline, and paragraphs. Deliberately minimal + safe (no raw HTML).
import { Fragment, type ReactNode } from "react";
export { stripMarkdown } from "@/lib/strip-markdown";

/**
 * Only ever http(s), and never `javascript:`.
 *
 * ⚠️ This renderer's whole promise is "no raw HTML", and an anchor is the one
 * place that promise can be broken: a `javascript:` or `data:` href is script
 * execution dressed as a link. The text comes from AI output and from posts an
 * admin types, and neither is a reason to skip the check - `safeUrl` exists on
 * the points side for exactly this and the rule is the same here.
 */
function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function link(href: string, label: string, key: string): ReactNode {
  const safe = safeHref(href);
  if (!safe) return <Fragment key={key}>{label}</Fragment>;
  return (
    <a
      key={key}
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      // `break-all` because a referral URL is one long unbreakable token and
      // will otherwise push a card wider than the phone it is being read on.
      className="break-all font-medium text-gold-200 underline decoration-gold-500/40 underline-offset-2 transition-colors hover:text-gold-100"
    >
      {label}
    </a>
  );
}

/**
 * ⚠️ Links were MISSING entirely - neither `[text](url)` nor a bare URL rendered
 * as one. A desk post containing a referral link showed it as dead text that a
 * reader had to select and copy by hand, which on a phone is most of the way to
 * not bothering. The renderer already refused raw HTML, so nothing was unsafe;
 * it simply had no anchor at all.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  // One split, so emphasis and links cannot fight over the same characters.
  // Markdown links come first: their label may itself contain asterisks.
  const parts = text
    .split(/(\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s<>"')\]]+|\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter(Boolean);
  return parts.map((p, i) => {
    const md = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p);
    if (md) return link(md[2], md[1], `${keyBase}-l${i}`);
    if (/^https?:\/\//.test(p)) {
      // Trailing punctuation belongs to the sentence, not the URL: "see
      // https://x.io." should not link the full stop.
      const trail = /[.,;:!?]+$/.exec(p)?.[0] ?? "";
      const bare = trail ? p.slice(0, -trail.length) : p;
      return (
        <Fragment key={`${keyBase}-u${i}`}>
          {link(bare, bare, `${keyBase}-u${i}-a`)}
          {trail}
        </Fragment>
      );
    }
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
          <li key={i} className="flex gap-2 text-[0.9375rem] leading-relaxed text-zinc-300">
            {ordered ? (
              <span className="mono mt-[1px] shrink-0 text-[0.75rem] font-semibold text-gold-300/80">{i + 1}.</span>
            ) : (
              <span className="mt-[0.5625rem] h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400/70" />
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
        <blockquote key={`q-${i}`} className="my-2 border-l-2 border-gold-500/40 pl-3 text-[0.875rem] italic leading-relaxed text-zinc-400">
          {inline(quote[1], `q-${i}`)}
        </blockquote>
      );
      return;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls = level <= 2
        ? "mt-4 text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-gold-200"
        : "mt-3 text-[0.9375rem] font-semibold text-zinc-100";
      blocks.push(<h3 key={`h-${i}`} className={cls}>{inline(h[2], `h-${i}`)}</h3>);
      return;
    }
    blocks.push(
      <p key={`p-${i}`} className="my-2 text-[0.9375rem] leading-relaxed text-zinc-300">{inline(line, `p-${i}`)}</p>
    );
  });
  flushList("l-end");

  return <div className={className}>{blocks}</div>;
}
