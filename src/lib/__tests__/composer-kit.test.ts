import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Real module paths, never the `src/lib` / `src/components` re-export shims left
// by #203 - a shim is one `export * from` line, so a regex against one matches
// nothing and the test passes while checking nothing at all.
const KIT = "src/shared/components/ComposerKit.tsx";
const RESEARCH = "src/modules/research/components/QuickPublish.tsx";
const POINTS = "src/modules/points/components/UpdatesFeed.tsx";

const strip = (s: string) =>
  s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");

const kit = strip(readFileSync(KIT, "utf8"));
const research = strip(readFileSync(RESEARCH, "utf8"));
const points = strip(readFileSync(POINTS, "utf8"));

describe("both inline composers share one toolkit", () => {
  it("neither hand-rolls its own formatting controls", () => {
    // Two toolbars is one toolbar and a divergence waiting to happen: the first
    // time a button is fixed in one and not the other, the surfaces stop
    // behaving alike and nobody notices until someone uses both.
    for (const [name, src] of [["research", research], ["points", points]] as const) {
      expect(src, `${name} should use the shared MarkdownToolbar`).toMatch(/<MarkdownToolbar/);
      expect(src, `${name} should use the shared CoverPicker`).toMatch(/<CoverPicker/);
    }
  });

  it("writes markdown rather than pulling in a rich-text editor", () => {
    // ⚠️ The dashboard's Tiptap is the single heaviest thing this site ships -
    // `/dashboard` measures roughly twice every other route's bundle. Putting it
    // on two PUBLIC pages to save typing two asterisks would move that weight
    // onto readers who never compose anything.
    expect(kit).not.toMatch(/@tiptap|slate|quill|draft-js/i);
    expect(kit).toMatch(/surround\(el, "\*\*", "\*\*"/);
  });

  it("does not offer colours or fonts the renderer would discard", () => {
    // `MarkdownLite` emits the design system's own type and colour tokens, which
    // is what keeps a post looking like the site rather than like whoever typed
    // it. A colour picker here would be a control that silently does nothing.
    expect(kit).not.toMatch(/type="color"|fontFamily|font-family/i);
  });
});

describe("an uploaded image costs nothing it does not have to", () => {
  it("previews and renders with a plain img, never next/image", () => {
    // ⚠️ An <img> pointing at Supabase Storage is fetched browser-to-Supabase
    // and costs ZERO Vercel transfer. Routing it through `next/image` spends
    // both Fast Origin Transfer and image-optimisation quota - the lint rule's
    // "best practice" is the expensive option here (cost-check, trap 3).
    for (const [name, src] of [["kit", kit], ["points", points]] as const) {
      expect(src, `${name} must not route uploads through next/image`).not.toMatch(
        /from "next\/image"/
      );
    }
  });

  it("stores a URL, never inline base64", () => {
    // A `data:` image in the DB is serialised into every response that reads the
    // table. That blew Fast Origin Transfer on this project once already, which
    // is why `stripInlineImage()` exists (cost-check, trap 4).
    expect(kit).toMatch(/\/api\/upload/);
    expect(kit).not.toMatch(/readAsDataURL|toDataURL/);
  });

  it("lazy-loads update images so a feed does not fetch every cover", () => {
    expect(points).toMatch(/loading="lazy"/);
  });
});

describe("the new column is additive and survives a re-run", () => {
  const sql = readFileSync("prisma/migrations/38_points_update_image/migration.sql", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  it("adds the column IF NOT EXISTS", () => {
    // `db push` runs on production deploys only and a failure now fails the
    // build loudly - but a migration that cannot be re-run safely turns one
    // retry into an outage.
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "image"/);
  });

  it("is nullable, so no existing row needs a backfill", () => {
    expect(sql).not.toMatch(/NOT NULL/);
    expect(schema).toMatch(/^\s*image\s+String\?/m);
  });

  it("passes the image through the same URL gate as every other link", () => {
    // An image src is a URL the browser fetches. It goes through `safeUrl` -
    // http(s) only - rather than being trusted because an upload wrote it: the
    // column can also be written by a future path that does not.
    const route = strip(readFileSync("src/app/api/points/updates/route.ts", "utf8"));
    expect(route).toMatch(/image: safeUrl\(/);
  });
});
