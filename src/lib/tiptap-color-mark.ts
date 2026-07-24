import { Mark, mergeAttributes } from "@tiptap/core";
import { COLOR_CLASS, type ColorKey } from "./richtext";

// Curated color highlighting for the PostEditor - deliberately restricted to
// the site's 4 design-token colors (matching COLOR_CLASS in richtext.ts),
// not arbitrary CSS colors. Renders/parses as the exact same
// `<span class="text-gold-300">...</span>` shape richtext.ts's
// markdownToHtml/htmlToMarkdown already produce and read, so the round trip
// to the `{c:key}...{/c}` markdown storage format stays unchanged.

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    colorText: {
      setColorText: (color: ColorKey) => ReturnType;
      unsetColorText: () => ReturnType;
    };
  }
}

export const ColorText = Mark.create({
  name: "colorText",

  addAttributes() {
    return {
      color: {
        default: "gold",
        parseHTML: (element: HTMLElement) => {
          const match = (Object.entries(COLOR_CLASS) as [ColorKey, string][]).find(([, cls]) =>
            element.classList.contains(cls)
          );
          return match ? match[0] : null;
        },
        renderHTML: (attributes: { color?: ColorKey }) => ({
          class: COLOR_CLASS[attributes.color ?? "gold"],
        }),
      },
    };
  },

  parseHTML() {
    return (Object.keys(COLOR_CLASS) as ColorKey[]).map((key) => ({
      tag: `span.${COLOR_CLASS[key]}`,
      attrs: { color: key },
    }));
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setColorText:
        (color: ColorKey) =>
        ({ commands }) =>
          commands.setMark(this.name, { color }),
      unsetColorText:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
