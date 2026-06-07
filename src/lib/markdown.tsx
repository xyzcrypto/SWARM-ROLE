import { Fragment, type ReactNode } from "react";

/**
 * Minimal, dependency-free markdown renderer covering the basics used in
 * research posts: headings, lists, blockquotes, bold/italic/inline-code and
 * paragraphs. Good enough for clean article rendering without extra packages.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text))) {
    if (match.index > last) tokens.push(text.slice(last, match.index));
    const t = match[0];
    const key = `${keyBase}-${i++}`;
    if (t.startsWith("**")) tokens.push(<strong key={key}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) tokens.push(<code key={key}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) {
      const m = /\[([^\]]+)\]\(([^)]+)\)/.exec(t);
      if (m) tokens.push(<a key={key} href={m[2]} target="_blank" rel="noopener noreferrer">{m[1]}</a>);
    } else if (t.startsWith("*")) tokens.push(<em key={key}>{t.slice(1, -1)}</em>);
    last = match.index + t.length;
  }
  if (last < text.length) tokens.push(text.slice(last));
  return tokens;
}

export function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let key = 0;

  const flushList = () => {
    if (list.length) {
      const items = [...list];
      blocks.push(
        <ul key={`ul-${key++}`}>
          {items.map((it, idx) => (
            <li key={idx}>{inline(it, `li-${key}-${idx}`)}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-*]\s+/, ""));
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    if (line.startsWith("### ")) blocks.push(<h3 key={key++}>{inline(line.slice(4), `h3-${key}`)}</h3>);
    else if (line.startsWith("## ")) blocks.push(<h2 key={key++}>{inline(line.slice(3), `h2-${key}`)}</h2>);
    else if (line.startsWith("# ")) blocks.push(<h2 key={key++}>{inline(line.slice(2), `h1-${key}`)}</h2>);
    else if (line.startsWith("> ")) blocks.push(<blockquote key={key++}>{inline(line.slice(2), `bq-${key}`)}</blockquote>);
    else blocks.push(<p key={key++}>{inline(line, `p-${key}`)}</p>);
  }
  flushList();

  return <Fragment>{blocks}</Fragment>;
}
