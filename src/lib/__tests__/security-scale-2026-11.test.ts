import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import fg from "fast-glob";
import { csvCell } from "@/lib/utils";
import { sortActivityBySource, sourceKey } from "@modules/journal/lib/journal-activity";

const read = (p: string) => readFileSync(p, "utf8");

// Fixes from the 2026-11-28 API review. Each test pins the rule, not the prose.
describe("privacy", () => {
  it("the journal overview card shows nothing for a private profile and never counts anonymous trades", () => {
    const r = read("src/app/api/journal/share/overview/[userId]/route.tsx");
    expect(r).toMatch(/if \(!user \|\| user\.profileVisibility === "private"\) return fallbackCard\(\);/);
    expect(r).toMatch(/where: \{ userId: params\.userId, visibility: "public" \}/);
  });
  it("any non-public visibility withdraws a trade's named activity, whatever it was before", () => {
    const r = read("src/app/api/journal/trades/[id]/route.ts");
    expect(r).toMatch(/if \(fields\.visibility && fields\.visibility !== "public"\) \{\s*await prisma\.journalActivity\s*\.deleteMany\(\{ where: tradeActivityWhere\(trade\.id, me\.id\) \}\)/);
    // The Vercel finding: conditioning on the OLD visibility skipped anonymous -> private.
    expect(r).not.toMatch(/existing\.visibility === "public"\)/);
  });
  it("a legacy anonymous trade with a named row: hidden on read and revoked, even though no write path removed it", () => {
    // Persisted under the old rule: public -> anonymous kept the named row.
    const rows = [
      { id: "a1", sourceType: "trade", sourceId: "t-anon" },
      { id: "a2", sourceType: "trade", sourceId: "t-private" },
      { id: "a3", sourceType: "trade", sourceId: "t-public" },
      { id: "a4", sourceType: "challenge", sourceId: "c-community" },
      { id: "a5", sourceType: "challenge", sourceId: "c-private" },
      { id: "a6", sourceType: "trade", sourceId: "t-gone" },
      { id: "a7", sourceType: null, sourceId: null },
    ];
    const visibilityOf = new Map([
      [sourceKey("trade", "t-anon"), "anonymous"],
      [sourceKey("trade", "t-private"), "private"],
      [sourceKey("trade", "t-public"), "public"],
      [sourceKey("challenge", "c-community"), "community"],
      [sourceKey("challenge", "c-private"), "private"],
    ]);
    const { shown, revoke } = sortActivityBySource(rows, visibilityOf);
    expect(shown.map((r) => r.id)).toEqual(["a3", "a4", "a7"]);
    expect(revoke).toEqual(["a1", "a2", "a5"]);
  });
  it("both public readers of the feed go through the read-time check", () => {
    const share = read("src/app/api/journal/share/activity/[userId]/route.ts");
    expect(share).toMatch(/await publicJournalActivity\(params\.userId, 20\)/);
    expect(share).not.toMatch(/prisma\.journalActivity\.findMany/);
    expect(read("src/app/u/[username]/page.tsx")).toMatch(/publicJournalActivity\(user\.id, 8\)/);
    const readers = fg
      .sync("src/**/*.{ts,tsx}", { ignore: ["src/**/__tests__/**"] })
      .filter((f) => /journalActivity\s*\.\s*find(Many|First|Unique)/.test(read(f)));
    expect(readers).toEqual(["src/modules/journal/lib/public-activity.ts"]);
    const lib = read("src/modules/journal/lib/public-activity.ts");
    expect(lib).toMatch(/prisma\.trade\.findMany\(\{ where: \{ id: \{ in: tradeIds \}, userId \}/);
    expect(lib).toMatch(/deleteMany\(\{ where: \{ id: \{ in: revoke \}, userId \} \}\)/);
  });
  it("a DM report can only cite a message the reported member sent, in the reporter's own conversation", () => {
    const r = read("src/app/api/dm/report/route.ts");
    expect(r).toMatch(/if \(m && inIt && m\.senderId === userId\) citedId = messageId;/);
    expect(r).toMatch(/messageId: citedId,/);
  });
});

describe("access control", () => {
  it("an email removed from ADMIN_EMAILS loses Super Admin on the next session refresh (only when the list is configured)", () => {
    const a = read("src/core/auth/auth.ts");
    expect(a).toMatch(/if \(role === "ADMIN" && adminEmails\.length > 0 && !isAdminEmail\(token\.email\)\)/);
    expect(a).toMatch(/token\.role = role;/);
  });
  it("a staffer cannot strip capabilities they do not hold", () => {
    const r = read("src/app/api/users/[id]/access/route.ts");
    expect(r).toMatch(/const kept = sanitizePermissions\(target\.permissions \?\? \[\]\)\.filter\(\(p\) => !hasPermission\(actor, p\)\);/);
    expect(r).toMatch(/data: \{ permissions: next \}/);
  });
});

describe("CSV exports neutralise formulas", () => {
  it("cells starting with = + - @ tab or CR are shown as text", () => {
    for (const v of ["=HYPERLINK(1)", "+1", "-1", "@SUM(A1)", "\tx", "\rx"]) expect(csvCell(v).startsWith(`"'`), v).toBe(true);
    expect(csvCell("Riya")).toBe('"Riya"');
  });
  it("both admin exports use the shared safe cell", () => {
    for (const f of ["src/app/api/users/route.ts", "src/app/api/subscribers/route.ts"]) {
      expect(read(f), f).not.toMatch(/const csvCell =/);
      expect(read(f), f).toMatch(/import \{[^}]*csvCell[^}]*\} from "@\/lib\/utils";/);
    }
  });
});

describe("nothing on the server waits for ever", () => {
  it("realtime broadcasts (awaited on ~26 request paths) are bounded", () => {
    expect(read("src/core/realtime/realtime.ts")).toMatch(/signal: AbortSignal\.timeout\(2500\)/);
  });
  it("every upstream call in the markets, ticker, chart, gif, email and telegram paths has a timeout", () => {
    const files = [
      "src/app/api/markets/coin/[id]/route.ts",
      "src/app/api/markets/search/route.ts",
      "src/app/api/markets/protocol/[type]/[slug]/route.ts",
      "src/app/api/markets/category/route.ts",
      "src/app/api/markets/defi/route.ts",
      "src/app/api/markets/chart/route.ts",
      "src/app/api/markets/global/route.ts",
      "src/app/api/ticker/route.ts",
      "src/app/api/chart/route.ts",
      "src/app/api/chat/gif/route.ts",
      "src/core/email/email.ts",
      "src/modules/notifications/lib/telegram.ts",
    ];
    for (const f of files) {
      const src = read(f);
      const calls = (src.match(/\bfetch\(/g) ?? []).length;
      const bounded = (src.match(/AbortSignal\.timeout\(/g) ?? []).length;
      expect(bounded, f).toBeGreaterThanOrEqual(calls);
    }
  });
  it("web push and link previews are bounded", () => {
    expect(read("src/core/push/push.ts")).toMatch(/\{ timeout: 8000 \}/);
    expect(read("src/core/net/safe-fetch.ts")).toMatch(/const deadline = setTimeout\(/);
  });
});

describe("scale", () => {
  it("a DM thread returns the NEWEST 200 messages, and marks read only when it moves", () => {
    const r = read("src/app/api/dm/[id]/route.ts");
    expect(r).toMatch(/orderBy: \{ createdAt: "desc" \},\s*take: 200,/);
    expect(r).toMatch(/const rows = newest\.reverse\(\);/);
    expect(r).toMatch(/if \(!myPrevRead \|\| \(conv\.lastMessageAt && myPrevRead < conv\.lastMessageAt\)\)/);
  });
  it("polled DM responses never carry inline data: avatars", () => {
    expect(read("src/app/api/dm/route.ts")).toMatch(/image: publicImageUrl\(other\.image, other\.id\)/);
    expect(read("src/app/api/dm/[id]/route.ts")).toMatch(/image: publicImageUrl\(other\.image, other\.id\)/);
  });
  it("leaderboard search is batched and rate-limited per IP", () => {
    const b = read("src/modules/academy/lib/board.ts");
    expect(b).toMatch(/prisma\.academyXp\.groupBy\(\{ by: \["userId"\], where: \{ userId: \{ in: ids \}/);
    expect(read("src/app/api/academy/leaderboard/route.ts")).toMatch(/rateLimit\("academySearch", clientIp\(req\)\)/);
  });
  it("chat push skips devices set to off and sends in batches", () => {
    const c = read("src/modules/community/lib/chat-push.ts");
    expect(c).toMatch(/NOT: \{ notifyMode: "off" \}/);
    expect(c).toMatch(/for \(let i = 0; i < subs\.length; i \+= 50\)/);
  });
  it("live-quiz finalization is resumable: a lease, idempotent steps, finalizedAt written last", () => {
    const l = read("src/modules/academy/lib/live.ts");
    const fin = l.slice(l.indexOf("export async function finalizeLive"), l.indexOf("async function loadLive"));
    expect(fin).toMatch(/endedAt: \{ lt: new Date\(now\.getTime\(\) - FINALIZE_LEASE_MS\) \}/);
    expect(fin.indexOf("data: { finalizedAt: new Date() }")).toBeGreaterThan(fin.indexOf("checkAchievements"));
    expect(fin).not.toMatch(/data: \{ status: "ended", finalizedAt/);
  });
  it("hot lookups are indexed", () => {
    const s = read("prisma/schema.prisma");
    expect(s).toMatch(/@@index\(\[status, pinnedAt\]\)/);
    expect(s).toMatch(/model Session \{[\s\S]*?@@index\(\[userId\]\)[\s\S]*?\}/);
  });
});
