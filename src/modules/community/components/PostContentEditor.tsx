"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Smile } from "lucide-react";
import { ColorText } from "@/lib/tiptap-color-mark";
import { htmlToMarkdown, markdownToHtml, type ColorKey } from "@/lib/richtext";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/EmojiPicker";

const COLORS: { key: ColorKey; label: string; swatch: string }[] = [
  { key: "gold", label: "Gold", swatch: "bg-gold-400" },
  { key: "mint", label: "Mint", swatch: "bg-mint-400" },
  { key: "red", label: "Red", swatch: "bg-rose-400" },
  { key: "blue", label: "Blue", swatch: "bg-sky-400" },
];

/**
 * Real WYSIWYG content box for the admin post editor, built on Tiptap
 * (ProseMirror) instead of a hand-rolled contentEditable + execCommand - that
 * combination is exactly what's unreliable on mobile (lost focus,
 * inconsistent typing, a toolbar click losing the selection), which is why
 * dedicated editor engines exist rather than every app hand-rolling one.
 * Storage is unaffected: the value in/out is still the same plain markdown
 * string `/api/research` already expects - richtext.ts's
 * markdownToHtml/htmlToMarkdown convert at the boundary, so the API,
 * lib/markdown.tsx's public renderer, and every other consumer are untouched.
 */
export function PostContentEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (markdown: string) => void;
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  // Seeded once, on mount, from whatever markdown the post already has -
  // never re-derived from `value` afterwards (the editor is the source of
  // truth for its own document once mounted; re-feeding it on every keystroke
  // would fight the user's typing and the caret).
  const [initialHtml] = useState(() => markdownToHtml(value));

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        underline: false,
        strike: false,
        codeBlock: false,
        horizontalRule: false,
        orderedList: false,
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      ColorText,
      Placeholder.configure({ placeholder: "Write your research here…" }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: { class: "prose-xyz h-full outline-none" },
    },
    onUpdate: ({ editor }) => {
      const dom = new DOMParser().parseFromString(editor.getHTML(), "text/html");
      onChange(htmlToMarkdown(dom.body));
    },
  });

  if (!editor) {
    return <div className="h-[26rem] w-full animate-pulse rounded-xl border border-white/10 bg-ink-700/60" />;
  }

  // `editor` is narrowed non-null above, but TS can't carry that through a
  // nested function declaration's closure - safe to assert here since these
  // are only ever called after that guard has already passed.
  function toggleLink() {
    const prevUrl = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prevUrl || "https://");
    if (url === null) return;
    if (!url) {
      editor!.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (editor!.state.selection.empty) {
      editor!.chain().focus().insertContent(`<a href="${url}">${url}</a>`).run();
    } else {
      editor!.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }

  function insertEmoji(emoji: string) {
    editor!.chain().focus().insertContent(emoji).run();
    setShowEmoji(false);
  }

  const toolbar = [
    { key: "bold", label: "B", title: "Bold", active: editor.isActive("bold"), onClick: () => editor.chain().focus().toggleBold().run() },
    { key: "italic", label: "I", title: "Italic", active: editor.isActive("italic"), onClick: () => editor.chain().focus().toggleItalic().run() },
    { key: "h1", label: "H1", title: "Heading", active: editor.isActive("heading", { level: 1 }), onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { key: "h2", label: "H2", title: "Subheading", active: editor.isActive("heading", { level: 2 }), onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: "h3", label: "H3", title: "Minor heading", active: editor.isActive("heading", { level: 3 }), onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { key: "list", label: "•", title: "List", active: editor.isActive("bulletList"), onClick: () => editor.chain().focus().toggleBulletList().run() },
    { key: "quote", label: "❝", title: "Quote", active: editor.isActive("blockquote"), onClick: () => editor.chain().focus().toggleBlockquote().run() },
    { key: "code", label: "</>", title: "Code", active: editor.isActive("code"), onClick: () => editor.chain().focus().toggleCode().run() },
    { key: "link", label: "🔗", title: "Link", active: editor.isActive("link"), onClick: toggleLink },
  ];

  // Toolbar buttons must never take native DOM focus/selection away from the
  // editor on click - a plain button click does that by default, which left
  // Tiptap's own tracked selection out of sync with the browser's (reproduced:
  // select a line, toggle a format via the toolbar, then click back into the
  // editor to keep typing - the next Enter would wipe the just-formatted
  // text). Preventing the mousedown's default is the standard fix recommended
  // for building a ProseMirror/Tiptap toolbar.
  const preserveSelection = (e: React.MouseEvent) => e.preventDefault();

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-1">
        {toolbar.map((t) => (
          <button
            key={t.key}
            type="button"
            title={t.title}
            onMouseDown={preserveSelection}
            onClick={t.onClick}
            className={cn(
              "h-8 min-w-8 rounded-md border px-2 text-xs font-semibold transition-colors",
              t.active
                ? "border-gold-500/50 bg-gold-500/15 text-gold-100"
                : "border-white/10 bg-ink-700/60 text-zinc-300 hover:border-gold-500/40 hover:text-gold-100"
            )}
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
            onMouseDown={preserveSelection}
            onClick={() => editor.chain().focus().setColorText(c.key).run()}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
              editor.isActive("colorText", { color: c.key })
                ? "border-gold-500/50 bg-white/10"
                : "border-white/10 bg-ink-700/60 hover:border-gold-500/40"
            )}
          >
            <span className={`h-3.5 w-3.5 rounded-full ${c.swatch}`} />
          </button>
        ))}
        <span className="mx-0.5 h-5 w-px bg-white/10" aria-hidden />
        <div className="relative">
          <button
            type="button"
            title="Emoji"
            onMouseDown={preserveSelection}
            onClick={() => setShowEmoji((v) => !v)}
            className="flex h-8 min-w-8 items-center justify-center rounded-md border border-white/10 bg-ink-700/60 px-2 text-zinc-300 transition-colors hover:border-gold-500/40 hover:text-gold-100"
          >
            <Smile className="h-4 w-4" />
          </button>
          {showEmoji && <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmoji(false)} />}
        </div>
      </div>
      {/* overscroll-contain stops a scroll that hits the top/bottom of the box
          from chaining up and moving the whole page. */}
      <div className="h-[26rem] w-full overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm transition-colors focus-within:border-gold-500/50 focus-within:ring-2 focus-within:ring-gold-500/20">
        <EditorContent editor={editor} />
      </div>
    </>
  );
}
