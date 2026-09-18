import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// ⚠️ This exists because a published article was lost.
//
// `DELETE /api/research/[id]` called `prisma.post.delete`, so the row was gone
// from Postgres with no way back short of a database backup - and a backup is
// not a feature, it is a thing you find out you do not have on the day you need
// it. Deleting now sets `deletedAt`, and permanent removal takes a second,
// explicit action.
//
// The dangerous half of a soft delete is the READ side. Sixteen places query
// `Post`; miss one and a deleted article is still reachable by URL, still in a
// count, still in a sitemap. Nothing errors. The post is simply still there.
//
// So this walks every source file and fails on a `prisma.post` read that does
// not carry the shared predicate.

/** Every .ts/.tsx under src, so a new read site cannot be added unnoticed. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !p.includes("__tests__")) out.push(p);
  }
  return out;
}

const files = walk("src");

const strip = (s: string) =>
  s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");

/** Read sites, with enough following text to see the `where` clause. */
function readSites(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/prisma\.post\.(findMany|findUnique|findFirst|count)\b/g)) {
    out.push(src.slice(m.index!, m.index! + 420));
  }
  return out;
}

describe("a trashed post is invisible to every read path", () => {
  it("found the read sites (guards against a silently empty scan)", () => {
    const total = files.reduce((n, f) => n + readSites(strip(readFileSync(f, "utf8"))).length, 0);
    expect(total).toBeGreaterThanOrEqual(10);
  });

  it("every prisma.post read filters the trash", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = strip(readFileSync(f, "utf8"));
      for (const site of readSites(src)) {
        // ⚠️ The predicate is often NOT in the text after the call: a site may
        // pass `{ where }` as shorthand or spread `...base`, both of which are
        // variables defined earlier in the file. Checking only the call site
        // fires on correct code - and a check that cries wolf gets weakened
        // rather than obeyed, which would leave the real gap uncovered.
        //
        // So resolve every identifier the call leans on and look at ITS
        // definition too.
        const refs = new Set<string>();
        for (const m of site.matchAll(/\.\.\.([A-Za-z_$][\w$]*)/g)) refs.add(m[1]);
        for (const m of site.matchAll(/where:\s*([A-Za-z_$][\w$]*)/g)) refs.add(m[1]);
        // `{ where }` / `{ where, ... }` shorthand.
        if (/\{\s*where\s*[,}]/.test(site)) refs.add("where");

        const resolved = [...refs]
          .map((name) => new RegExp(`const ${name}(: [^=]+)? = \\{[\\s\\S]{0,700}`).exec(src)?.[0] ?? "")
          .join("\n");

        const guarded =
          /NOT_TRASHED|LIVE_POST|deletedAt/.test(site) ||
          /NOT_TRASHED|LIVE_POST|deletedAt/.test(resolved) ||
          // The admin edit/delete lookups address ONE post by id and must be
          // able to see a trashed one, or it could never be restored.
          /select: \{ id: true, slug: true, deletedAt: true/.test(site) ||
          /where: \{ id: params\.id \},\s*select: POST_SCALARS/.test(site);
        if (!guarded) offenders.push(`${f}\n      ${site.split("\n").slice(0, 3).join(" ").trim()}`);
      }
    }
    expect(
      offenders,
      `these read Post without filtering the trash, so a deleted post stays visible:\n  ${offenders.join(
        "\n  "
      )}`
    ).toEqual([]);
  });

  it("defines the predicate in exactly one place", () => {
    // Sixteen hand-written `deletedAt: null` clauses is fifteen chances to
    // forget one.
    const lib = readFileSync("src/modules/research/lib/post-visibility.ts", "utf8");
    expect(lib).toMatch(/export const NOT_TRASHED = \{ deletedAt: null \}/);
  });
});

describe("deleting is reversible, and destroying takes a second action", () => {
  const del = strip(readFileSync("src/app/api/research/[id]/route.ts", "utf8"));
  const restore = strip(readFileSync("src/app/api/research/[id]/restore/route.ts", "utf8"));

  it("the default DELETE only sets deletedAt", () => {
    expect(del).toMatch(/data: \{ deletedAt: new Date\(\) \}/);
  });

  it("a purge refuses anything not already in the trash", () => {
    // Permanent deletion takes two deliberate actions, and the second one is
    // taken while looking at the trash.
    expect(del).toMatch(/purge/);
    expect(del).toMatch(/if \(!existing\.deletedAt\)/);
  });

  it("restore exists, because deletedAt alone is a slower way to lose things", () => {
    expect(restore).toMatch(/data: \{ deletedAt: null \}/);
    expect(restore).toMatch(/requirePermission\("post:manage"\)/);
  });

  it("restore busts both caches, or the post is back but still missing", () => {
    expect(restore).toMatch(/revalidatePath\("\/research"\)/);
    expect(restore).toMatch(/revalidatePath\(`\/research\/\$\{existing\.slug\}`\)/);
  });

  it("restore does not make a publishing decision for the owner", () => {
    // A draft that was deleted comes back a draft. Scoped to the WRITE - the
    // route legitimately SELECTS `published: true` to report what it restored,
    // and matching that was this assertion firing on correct code.
    const write = /data: \{[\s\S]{0,200}?\}/.exec(restore)?.[0] ?? "";
    expect(write).toMatch(/deletedAt: null/);
    expect(write).not.toMatch(/published/);
  });
});

describe("the migration is additive and re-runnable", () => {
  const sql = readFileSync("prisma/migrations/39_post_soft_delete/migration.sql", "utf8");

  it("adds the column IF NOT EXISTS, nullable, no backfill", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "deletedAt"/);
    expect(sql).not.toMatch(/NOT NULL/);
  });

  it("indexes the shape the list queries actually use", () => {
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS/);
    expect(sql).toMatch(/WHERE "deletedAt" IS NULL/);
  });
});
