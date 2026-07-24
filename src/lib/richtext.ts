// Bidirectional markdown <-> HTML conversion for PostEditor's contentEditable
// write box - lets toolbar actions apply directly/visibly to selected text
// (real bold, real headings, real color) while the value saved to the API
// stays the same plain markdown string the rest of the app already expects.
// Deliberately NOT shared with lib/markdown.tsx (which renders every research
// post sitewide) - kept as its own small, self-contained module so this
// editor-only concern can't regress the live post renderer.

export type ColorKey = "gold" | "mint" | "red" | "blue";

export const COLOR_CLASS: Record<ColorKey, string> = {
  gold: "text-gold-300",
  mint: "text-mint-300",
  red: "text-rose-400",
  blue: "text-sky-400",
};

const CLASS_TO_COLOR: Record<string, ColorKey> = Object.fromEntries(
  (Object.entries(COLOR_CLASS) as [ColorKey, string][]).map(([key, cls]) => [cls, key])
);

// Escapes for both text content and (double-quoted) attribute values - a
// literal `"` in a link href (e.g. a URL with an unusual query string) would
// otherwise close the attribute early and let the rest of the string inject
// new attributes/markup.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineToHtml(text: string): string {
  // Bold's closing "**" requires a negative lookahead for a further "*" - without
  // it, overlapping bold+italic (e.g. Tiptap's own "**hello *world***", from
  // bolding then italicizing part of the same run) stops at the FIRST "**" it
  // finds, which lands mid-run and drops the bold wrapper / leaks stray "*"
  // characters as visible text. The lookahead makes it prefer the "**" that
  // isn't immediately followed by another star, so "***" tails resolve as
  // "closing italic then bold" instead of "closing bold one star short."
  const regex = /(\{c:(?:gold|mint|red|blue)\}[\s\S]*?\{\/c\}|\*\*[\s\S]+?\*\*(?!\*)|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let out = "";
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (match.index > last) out += escapeHtml(text.slice(last, match.index));
    const t = match[0];
    if (t.startsWith("{c:")) {
      const m = /\{c:(gold|mint|red|blue)\}([\s\S]*?)\{\/c\}/.exec(t);
      if (m) out += `<span class="${COLOR_CLASS[m[1] as ColorKey]}">${inlineToHtml(m[2])}</span>`;
    } else if (t.startsWith("**")) out += `<strong>${inlineToHtml(t.slice(2, -2))}</strong>`;
    else if (t.startsWith("`")) out += `<code>${escapeHtml(t.slice(1, -1))}</code>`;
    else if (t.startsWith("[")) {
      const m = /\[([^\]]+)\]\(([^)]+)\)/.exec(t);
      if (m) out += `<a href="${escapeHtml(m[2])}">${inlineToHtml(m[1])}</a>`;
    } else if (t.startsWith("*")) out += `<em>${inlineToHtml(t.slice(1, -1))}</em>`;
    last = match.index + t.length;
  }
  if (last < text.length) out += escapeHtml(text.slice(last));
  return out;
}

/** Markdown source -> HTML, for the contentEditable box's initial content. */
export function markdownToHtml(content: string): string {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let list: string[] = [];
  const flushList = () => {
    if (list.length) {
      html += `<ul>${list.map((it) => `<li>${inlineToHtml(it) || "<br>"}</li>`).join("")}</ul>`;
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
    if (line.startsWith("### ")) html += `<h3>${inlineToHtml(line.slice(4))}</h3>`;
    else if (line.startsWith("## ")) html += `<h2>${inlineToHtml(line.slice(3))}</h2>`;
    else if (line.startsWith("# ")) html += `<h1>${inlineToHtml(line.slice(2))}</h1>`;
    else if (line.startsWith("> ")) html += `<blockquote>${inlineToHtml(line.slice(2))}</blockquote>`;
    else html += `<p>${inlineToHtml(line) || "<br>"}</p>`;
  }
  flushList();
  return html;
}

function blockPrefix(tag: string): string {
  if (tag === "h1") return "# ";
  if (tag === "h2") return "## ";
  if (tag === "h3") return "### ";
  if (tag === "blockquote") return "> ";
  return "";
}

function inlineFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const children = () => Array.from(el.childNodes).map(inlineFromNode).join("");
  if (tag === "br") return "\n";
  if (tag === "strong" || tag === "b") return `**${children()}**`;
  if (tag === "em" || tag === "i") return `*${children()}*`;
  if (tag === "code") return `\`${el.textContent ?? ""}\``;
  if (tag === "a") {
    const href = el.getAttribute("href") ?? "";
    return href ? `[${children()}](${href})` : children();
  }
  if (tag === "span") {
    const color = CLASS_TO_COLOR[el.className.trim()];
    return color ? `{c:${color}}${children()}{/c}` : children();
  }
  return children();
}

/** The contentEditable box's live DOM -> markdown source, for saving. */
export function htmlToMarkdown(root: HTMLElement): string {
  const lines: string[] = [];
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").trim();
      if (text) lines.push(text);
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      for (const li of Array.from(el.children)) {
        const text = inlineFromNode(li).trim();
        if (text) lines.push(`- ${text}`);
      }
      continue;
    }
    if (tag === "br") continue;
    const text = inlineFromNode(el).trim();
    if (!text) continue;
    lines.push(`${blockPrefix(tag)}${text}`);
  }
  return lines.join("\n").trim();
}
