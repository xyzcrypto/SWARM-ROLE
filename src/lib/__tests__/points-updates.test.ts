import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  KIND_LABEL,
  KIND_TONE,
  UPDATE_KINDS,
  UPDATE_LIMITS,
  isUpdateKind,
  safeUrl,
  sortUpdates,
  type PointsUpdateDto,
} from "@modules/points/lib/points-updates";

const u = (over: Partial<PointsUpdateDto> & { id: string }): PointsUpdateDto => ({
  title: over.id,
  body: "b",
  kind: "update",
  program: null,
  url: null,
  image: null,
  pinned: false,
  published: true,
  createdAt: "2026-09-17T10:00:00.000Z",
  ...over,
});

describe("an update's link cannot carry script", () => {
  // The `url` is rendered as an anchor a reader clicks. `javascript:` and
  // `data:` in an href are the oldest stored-XSS vector there is, and the
  // author here is trusted staff - but a compromised staff account, or a
  // paste from somewhere else, should not be able to reach a reader's browser.
  it("accepts ordinary http and https", () => {
    expect(safeUrl("https://t.me/X_Y_Z_Crypto/16537")).toBe("https://t.me/X_Y_Z_Crypto/16537");
    expect(safeUrl("http://example.com/a?b=1")).toBe("http://example.com/a?b=1");
  });

  it("rejects every scheme that can execute", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)  ",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ]) {
      expect(safeUrl(bad), `${bad} was allowed through`).toBeNull();
    }
  });

  it("rejects what it cannot parse rather than guessing", () => {
    // A half-typed URL is not something to publish as a link. Sanitising into
    // something plausible would be worse than refusing.
    expect(safeUrl("not a url")).toBeNull();
    expect(safeUrl("//evil.example.com")).toBeNull();
    expect(safeUrl("")).toBeNull();
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
  });

  it("is applied on the way IN, not only on the way out", () => {
    // A bad URL filtered only at render is one careless consumer away from
    // being rendered. Keeping it out of the row is the durable fix.
    const create = readFileSync("src/app/api/points/updates/route.ts", "utf8");
    expect(create).toMatch(/const url = safeUrl\(/);
    expect(create).toMatch(/if \(parsed\.data\.url\?\.trim\(\) && !url\) return fail/);
  });
});

describe("the feed's order is the question it answers", () => {
  it("puts pinned first, then newest", () => {
    const out = sortUpdates([
      u({ id: "old", createdAt: "2026-09-01T00:00:00.000Z" }),
      u({ id: "pinned-old", pinned: true, createdAt: "2026-08-01T00:00:00.000Z" }),
      u({ id: "new", createdAt: "2026-09-17T00:00:00.000Z" }),
    ]);
    expect(out.map((x) => x.id)).toEqual(["pinned-old", "new", "old"]);
  });

  it("does not mutate its input", () => {
    const input = [u({ id: "a" }), u({ id: "b", pinned: true })];
    const copy = [...input];
    sortUpdates(input);
    expect(input).toEqual(copy);
  });

  it("matches the order the route asks the database for", () => {
    // Two orderings that drift produce a feed that reshuffles on refetch, which
    // reads as a bug even though every row is correct.
    const route = readFileSync("src/app/api/points/updates/route.ts", "utf8");
    expect(route).toMatch(/orderBy: \[\{ pinned: "desc" \}, \{ createdAt: "desc" \}\]/);
  });

  it("has an index covering exactly that order", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toMatch(/@@index\(\[published, pinned, createdAt\]\)/);
  });
});

describe("kinds are a closed vocabulary", () => {
  it("every kind has a label and a tone", () => {
    for (const k of UPDATE_KINDS) {
      expect(KIND_LABEL[k], `${k} has no label`).toBeTruthy();
      expect(KIND_TONE[k], `${k} has no tone`).toBeTruthy();
    }
  });

  it("no tone uses a dark-only foreground on a tint", () => {
    // The exact mistake that scored 1.01:1 across the whole points UI in the
    // light theme. These badges sit on the same kind of translucent tint.
    for (const [k, tone] of Object.entries(KIND_TONE)) {
      expect(tone, `${k} uses a dark-only foreground`).not.toMatch(/text-(zinc|mint-100|rose-200)/);
    }
  });

  it("recognises its own kinds and nothing else", () => {
    expect(isUpdateKind("live")).toBe(true);
    expect(isUpdateKind("tge")).toBe(true);
    expect(isUpdateKind("nonsense")).toBe(false);
    expect(isUpdateKind(null)).toBe(false);
    expect(isUpdateKind(7)).toBe(false);
  });

  it("degrades an unknown stored kind instead of breaking the feed", () => {
    // A row written before a kind was renamed must not take the page down.
    const route = readFileSync("src/app/api/points/updates/route.ts", "utf8");
    expect(route).toMatch(/isUpdateKind\(r\.kind\) \? r\.kind : "update"/);
  });
});

describe("the write path is guarded", () => {
  const create = readFileSync("src/app/api/points/updates/route.ts", "utf8");
  const mutate = readFileSync("src/app/api/points/updates/[id]/route.ts", "utf8");

  it("every mutating handler checks the permission and rate-limits", () => {
    // The repo's standing rule for API routes: rateLimit -> zod -> auth gate.
    for (const [name, src] of [["POST", create], ["PATCH/DELETE", mutate]] as const) {
      expect(src, `${name} does not require points:manage`).toMatch(/requirePermission\("points:manage"\)/);
      expect(src, `${name} is not rate limited`).toMatch(/rateLimit\("admin", clientIp\(req\)\)/);
    }
  });

  it("never edge-caches a response containing drafts", () => {
    // An unpublished update served from a shared cache is a leak, not a bug in
    // the abstract - the whole point of a draft is that nobody has seen it.
    expect(create).toMatch(/includeDrafts\s*\?\s*"private, no-store"/);
  });

  it("only broadcasts what a reader can actually see", () => {
    // Broadcasting a draft makes every open page refetch and find nothing new.
    expect(create).toMatch(/if \(row\.published\) await broadcastEvent/);
  });

  it("survives the table not existing yet", () => {
    // `db push` runs on production deploys only, so the code ships before the
    // table does. An empty feed is the truth in that window; a 503 is not.
    expect(create).toMatch(/isMissingTable\(err\)\) return ok\(\{ updates: \[\], live: false \}\)/);
  });
});

describe("the migration is safe to re-run", () => {
  const raw = readFileSync("prisma/migrations/37_points_updates/migration.sql", "utf8");
  /**
   * SQL comments out before matching, and this one is not hypothetical: the
   * destructive-keyword check below matched the word "air-DROP" in the file's
   * own header comment. A test that fails on its own prose teaches people to
   * weaken the test.
   */
  const sql = raw.replace(/^\s*--.*$/gm, " ");

  it("creates additively", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "PointsUpdate"/);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS/);
  });

  it("drops nothing", () => {
    // `db push` retries on failure; a migration that is not idempotent turns
    // one retry into an outage.
    expect(sql).not.toMatch(/DROP|TRUNCATE|ALTER COLUMN/i);
  });
});

describe("the feed is live without being expensive", () => {
  const feed = readFileSync("src/modules/points/components/UpdatesFeed.tsx", "utf8");
  const route = readFileSync("src/app/api/points/updates/route.ts", "utf8");

  it("goes through the shared realtime primitive", () => {
    // Not a hand-rolled channel: `useRealtime` carries the retry, the armed
    // fallback poll and the wake refetch that seven surfaces already needed
    // and that this one would otherwise get wrong on its own.
    expect(feed).toMatch(/useRealtime\(\{ channel: CH_POINTS, event: "points_update"/);
  });

  it("uses its own public topic, not the signed-in bell", () => {
    // CH_NOTIFY is subscribed by signed-in members. This feed is public, so
    // anonymous readers have to get the ping too.
    const channels = readFileSync("src/core/realtime/realtime-channels.ts", "utf8");
    expect(channels).toMatch(/export const CH_POINTS = "points-updates"/);
  });

  it("keeps the edge window under the fallback poll", () => {
    // `useRealtime`'s fallback poll is 60s and only runs while the channel is
    // down. A 30s edge window means such a poll can never land on a fresh
    // cache entry and spin the origin.
    expect(route).toMatch(/s-maxage=30/);
  });
});

describe("limits are shared, not retyped", () => {
  it("the composer caps what the schema caps", () => {
    const feed = readFileSync("src/modules/points/components/UpdatesFeed.tsx", "utf8");
    // The headline is still a plain input, so the browser enforces it.
    expect(feed).toMatch(/maxLength=\{UPDATE_LIMITS\.title\}/);
    expect(UPDATE_LIMITS.title).toBe(120);

    // ⚠️ The body no longer can be. It used to be a `<textarea maxLength=…>`;
    // it is now the dashboard's rich-text editor, which has no such attribute.
    // Losing the attribute WITHOUT replacing the guard would mean an author
    // writes past the limit and only learns at the end, when zod refuses the
    // POST. So the cap has to be checked in the component instead - and the
    // check has to disable the submit, not merely colour a counter.
    expect(feed, "the body length must still be compared to the shared limit").toMatch(
      /body\.length\s*-\s*UPDATE_LIMITS\.body/
    );
    expect(feed, "being over the limit must disable Post").toMatch(/disabled=\{[^}]*overBy > 0/);
  });

  it("the feed query is bounded", () => {
    const route = readFileSync("src/app/api/points/updates/route.ts", "utf8");
    expect(route).toMatch(/take: UPDATE_LIMITS\.take/);
    expect(UPDATE_LIMITS.take).toBeLessThanOrEqual(50);
  });
});
