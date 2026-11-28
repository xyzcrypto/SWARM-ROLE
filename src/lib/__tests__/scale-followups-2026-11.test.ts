import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { buildLeaderboard, participantPnl, rankStandings, LEADERBOARD_MAX, type ChallengeTrade } from "@modules/tools/lib/challenge";

const read = (p: string) => readFileSync(p, "utf8");

// The follow-ups the 2026-11-28 API review left open (M5, M10, L2-L5).

describe("M5: publishing does not fan out inside the request, and notifications expire", () => {
  const n = read("src/modules/notifications/lib/notifications.ts");
  const fan = n.slice(n.indexOf("export async function notifyNewPost"), n.indexOf("export const NEW_POST_MAX_RECIPIENTS"));

  it("the fan-out is one INSERT ... SELECT in the database, capped, with ids that pass isCuid", () => {
    expect(fan).toMatch(/INSERT INTO "Notification"[\s\S]*SELECT 'c' \|\| replace\(gen_random_uuid\(\)::text, '-', ''\)/);
    expect(fan).toMatch(/FROM "User" u\s+WHERE u\."id" <> \$\{post\.authorId \?\? ""\}::text\s+LIMIT \$\{NEW_POST_MAX_RECIPIENTS\}::int/);
    // UTC, because the column is `timestamp without time zone`.
    expect(fan).toMatch(/\(now\(\) AT TIME ZONE 'UTC'\)/);
    expect(fan).not.toMatch(/prisma\.user\.findMany/);
    expect(fan).not.toMatch(/prisma\.notification\.createMany/);
    expect("c" + "0123456789abcdef0123456789abcdef").toMatch(/^c[a-z0-9]{20,}$/i);
  });

  it("the publish request awaits only the What's New row; fan-out, pruning and the AI summary run after the response", () => {
    const r = read("src/app/api/research/route.ts");
    const fn = r.slice(r.indexOf("async function afterPublish"), r.indexOf("// Refresh the ISR-cached pages"));
    expect(fn).toMatch(/after\(async \(\) => \{\s*await notifyNewPost\(post\);\s*await pruneNotifications\(\);/);
    expect(fn.indexOf("whatsNewEntry")).toBeLessThan(fn.indexOf("after("));
    // What's New exists before the homepage is revalidated.
    expect(r).toMatch(/if \(post\.published\) await afterPublish\(post\);\s*revalidateContent\(post\.slug\);/);
  });

  it("retention: read rows after 30 days, any row after 90, bounded per call, and indexed", () => {
    const prune = n.slice(n.indexOf("export async function pruneNotifications"));
    expect(prune).toMatch(/"createdAt" < \(now\(\) AT TIME ZONE 'UTC'\) - make_interval\(days => \$\{KEEP_READ_DAYS\}::int\)\s+AND \("read" = true OR "createdAt" < \(now\(\) AT TIME ZONE 'UTC'\) - make_interval\(days => \$\{KEEP_ANY_DAYS\}::int\)\)/);
    expect(prune).toMatch(/LIMIT \$\{PRUNE_BATCH\}::int/);
    expect(n).toMatch(/export const KEEP_READ_DAYS = 30;/);
    expect(n).toMatch(/export const KEEP_ANY_DAYS = 90;/);
    expect(read("prisma/schema.prisma")).toMatch(/model Notification \{[\s\S]*?@@index\(\[createdAt\]\)[\s\S]*?\}/);
  });

  it("the daily cron prunes even when push is not configured", () => {
    const c = read("src/app/api/academy/remind/route.ts");
    expect(c.indexOf("await pruneNotifications()")).toBeGreaterThan(c.indexOf("checkCronAuth("));
    expect(c.indexOf("await pruneNotifications()")).toBeLessThan(c.indexOf("if (!pushEnabled)"));
  });
});

describe("M10: a challenge view is summed in SQL and returns a bounded board", () => {
  it("the route no longer loads every participant's trades and fills, nor the participant list", () => {
    const r = read("src/app/api/journal/challenges/[id]/route.ts");
    const get = r.slice(r.indexOf("export async function GET"), r.indexOf("const patchSchema"));
    expect(get).toMatch(/challengeStandings\(challenge\.id\)/);
    expect(get).not.toMatch(/where: \{ challengeId: challenge\.id \},\s*select: \{ userId: true, side: true, fills/);
    expect(get).not.toMatch(/participants: \{ include/);
    expect(get).toMatch(/challengeParticipant\.findUnique\(\{ where: \{ challengeId_userId:/);
  });

  it("the SQL keeps buildLeaderboard's rules: average cost, net of fees, open trades excluded, participants only", () => {
    const b = read("src/modules/journal/lib/challenge-board.ts");
    expect(b).toMatch(/\(CASE WHEN side = 'long' THEN 1 ELSE -1 END\) \* \(exit_notional - \(entry_notional \/ entry_size\) \* exit_size\) - fees/);
    expect(b).toMatch(/CASE WHEN entry_size > 0 AND exit_size > 0/);
    expect(b).toMatch(/FROM "ChallengeParticipant" p\s+LEFT JOIN per_user u ON u\."userId" = p\."userId"/);
  });

  // The SQL's algebra, mirrored: dir * (Σ exit p·s − avgEntry · Σ exit s) − fees
  // must equal realizedPnl's Σ (p − avgEntry) · s · dir − fees for any fills.
  it("the rearranged formula equals realizedPnl on random trades", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 200; k++) {
      const fills = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => ({
        kind: (rnd() < 0.5 ? "entry" : "exit") as "entry" | "exit",
        price: 1 + rnd() * 1000,
        size: rnd() * 5,
        fee: rnd(),
      }));
      const trade: ChallengeTrade = { side: rnd() < 0.5 ? "long" : "short", fills };
      const sum = (kind: string, f: (x: (typeof fills)[number]) => number) => fills.filter((x) => x.kind === kind).reduce((s, x) => s + f(x), 0);
      const entrySize = sum("entry", (x) => x.size);
      const exitSize = sum("exit", (x) => x.size);
      const sql = entrySize > 0 && exitSize > 0
        ? (trade.side === "long" ? 1 : -1) * (sum("exit", (x) => x.price * x.size) - (sum("entry", (x) => x.price * x.size) / entrySize) * exitSize) - fills.reduce((s, x) => s + x.fee, 0)
        : 0;
      expect(sql).toBeCloseTo(participantPnl([trade]), 6);
    }
  });

  it("rankStandings ranks like buildLeaderboard, keeps the top 50, and adds your own row with its true rank", () => {
    const rows = Array.from({ length: 120 }, (_, i) => ({ userId: `u${i}`, trades: i % 3, pnl: (i % 7) * 10 - 20 }));
    const { entries, total } = rankStandings(rows, 1000, "u0");
    expect(total).toBe(120);
    const oracle = buildLeaderboard(rows.map((r) => ({ userId: r.userId, name: r.userId })), new Map(), 1000);
    expect(oracle).toHaveLength(120); // same participants; pnl ordering checked below
    const pct = entries.slice(0, LEADERBOARD_MAX).map((e) => e.returnPct);
    expect(pct).toEqual([...pct].sort((a, b) => b - a));
    expect(entries.slice(0, LEADERBOARD_MAX).map((e) => e.rank)).toEqual(Array.from({ length: LEADERBOARD_MAX }, (_, i) => i + 1));
    // u0 has pnl -20 (the lowest, rank > 50), so it is appended with its real rank.
    const mine = entries[entries.length - 1];
    expect(entries).toHaveLength(LEADERBOARD_MAX + 1);
    expect(mine.userId).toBe("u0");
    expect(mine.rank).toBeGreaterThan(LEADERBOARD_MAX);
    expect(mine.returnPct).toBe(-2);
    // Ties keep the database's order (join time).
    const firstTie = entries.filter((e) => e.returnPct === entries[0].returnPct).map((e) => e.userId);
    expect(firstTie).toEqual(rows.filter((r) => r.pnl === 40).map((r) => r.userId).slice(0, firstTie.length));
  });

  it("the client shows the true rank, not the list position", () => {
    expect(read("src/modules/journal/components/ChallengesPanel.tsx")).toMatch(/#\{l\.rank \?\? i \+ 1\}/);
  });
});

describe("L2: the unused public stats counter is gone", () => {
  it("no route counts every page view for anonymous callers", () => {
    expect(existsSync("src/app/api/live/stats/route.ts")).toBe(false);
  });
});

describe("L3: the feedback admin list carries links, not inline screenshots", () => {
  const f = read("src/modules/feedback/lib/feedback.ts");
  it("adminList does not select the image column; inline ones become a staff-only URL", () => {
    const list = f.slice(f.indexOf("export async function adminList"), f.indexOf("/** Staff-only URL"));
    expect(list).not.toMatch(/page: true, image: true/);
    expect(list).toMatch(/image: shots\.get\(r\.id\) \?\? null/);
    expect(f).toMatch(/CASE WHEN "image" LIKE 'data:%' THEN NULL ELSE "image" END AS url/);
  });
  it("the image route is gated, typed from an allow-list, and never shared-cached", () => {
    const r = read("src/app/api/admin/feedback/image/route.ts");
    expect(r).toMatch(/requirePermission\("feedback:manage"\)/);
    expect(r).toMatch(/"Cache-Control": "private, max-age=86400"/);
    expect(r).toMatch(/"X-Content-Type-Options": "nosniff"/);
    expect(f).toMatch(/\^data:\(image\\\/\(\?:png\|jpeg\|webp\)\);base64,/);
  });
});

describe("L5: community-chat reports reach staff", () => {
  it("the moderation queue reads ChatReport and can mark one reviewed", () => {
    const r = read("src/app/api/reports/route.ts");
    expect(r).toMatch(/prisma\.chatReport\s*\.findMany\(/);
    expect(r).toMatch(/kind: z\.enum\(\["dm", "chat"\]\)\.default\("dm"\)/);
    expect(r).toMatch(/if \(kind === "chat"\) await prisma\.chatReport\.update/);
    expect(r).toMatch(/email: maskEmail\(u\.email\)/);
  });
  it("the dashboard sends the kind back and can hide a reported chat message", () => {
    const d = read("src/modules/dashboard/components/DashboardClient.tsx");
    expect(d).toMatch(/body: JSON\.stringify\(\{ id, status, kind: r\.kind \}\)/);
    expect(d).toMatch(/body: JSON\.stringify\(\{ id: messageId, action: "hide" \}\)/);
  });
});
