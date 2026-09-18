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

describe("both inline composers mount the dashboard's editor, not a lookalike", () => {
  // ⚠️ This suite USED to assert the opposite - that neither page imported a
  // rich-text editor - and it was right about the cost and wrong about the
  // requirement. A markdown toolbar over a textarea was a SECOND editor: every
  // capability the dashboard gained either had to be built twice or quietly did
  // not exist here. The only way to keep two things the same is to make them one
  // thing, so both pages now mount the dashboard's own components.
  //
  // The cost the old assertion was protecting is real and has NOT been waived -
  // it is enforced below, by the shape of the import rather than its absence.

  it("uses the dashboard's own component on each page", () => {
    // `/research` takes the whole `PostEditor` (it posts to `/api/research`
    // itself, so there is no second submit path); `/points` takes the body
    // editor only, because a desk post also carries a kind, a programme and a
    // pin that a research post does not.
    expect(research, "research should mount the dashboard PostEditor").toMatch(
      /import\("@\/components\/PostEditor"\)/
    );
    expect(points, "points should mount the dashboard body editor").toMatch(
      /import\("@\/components\/PostContentEditor"\)/
    );
  });

  it("keeps Tiptap off both public pages until someone opens the composer", () => {
    // ⚠️ THE load-bearing assertion. Tiptap is the single heaviest thing this
    // site ships - `/dashboard` measures roughly twice every other route's
    // bundle because of it - and `/research` and `/points` are PUBLIC. A plain
    // `import` would move that weight onto every reader, almost none of whom
    // compose anything.
    //
    // `next/dynamic` with `ssr: false` is what makes the swap safe: the chunk
    // is requested only when the composer opens. A static import would pass the
    // test above and silently undo the reason this is acceptable at all.
    for (const [name, src] of [["research", research], ["points", points]] as const) {
      expect(src, `${name} must import the editor dynamically`).toMatch(/dynamic\(\s*\(\)\s*=>/);
      expect(src, `${name} must not server-render the editor`).toMatch(/ssr:\s*false/);
      expect(src, `${name} must not import the editor statically`).not.toMatch(
        /^import\s+\{[^}]*Post(Content)?Editor[^}]*\}\s+from/m
      );
    }
  });

  it("still shares one cover picker rather than two", () => {
    // `PostEditor` carries its own; the points composer keeps the shared one,
    // so the upload path, its 501 handling and its cost note stay in one place.
    expect(points).toMatch(/<CoverPicker/);
  });

  it("the toolkit it still uses does not offer colours or fonts the renderer would discard", () => {
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
