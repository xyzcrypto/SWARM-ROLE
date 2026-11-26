import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const { bestPerPerson, byScore } = await import("@modules/academy/lib/duel");

const read = (p: string) => readFileSync(p, "utf8");

describe("challenge board ranking", () => {
  it("higher score first, and the faster run wins a tie", () => {
    const rows = [
      { score: 500, timeMs: 30_000 },
      { score: 700, timeMs: 50_000 },
      { score: 500, timeMs: 20_000 },
    ].sort(byScore);
    expect(rows).toEqual([
      { score: 700, timeMs: 50_000 },
      { score: 500, timeMs: 20_000 },
      { score: 500, timeMs: 30_000 },
    ]);
  });

  it("keeps each friend's best replay once, and never lists the host as a taker", () => {
    const t = bestPerPerson(
      [
        { userId: "a", score: 300, timeMs: 1 },
        { userId: "a", score: 900, timeMs: 1 },
        { userId: "b", score: 400, timeMs: 1 },
        { userId: "host", score: 9999, timeMs: 1 },
      ],
      "host"
    );
    expect(t.map((x) => [x.userId, x.score])).toEqual([
      ["a", 900],
      ["b", 400],
    ]);
  });
});

describe("challenge wiring", () => {
  it("the public challenge route returns the board, edge-cached for 60s (not an hour) since it grows", () => {
    const r = read("src/app/api/academy/quiz/[id]/challenge/route.ts");
    expect(r).toMatch(/challengeBoard\(id\)/);
    expect(r).toMatch(/PUBLIC\(60, 600\)/);
  });
  it("boards expose names and avatars only, never an email", () => {
    expect(read("src/modules/academy/lib/duel.ts")).not.toMatch(/email: true/);
  });
  it("replays are indexed by challengeOf", () => {
    expect(read("prisma/schema.prisma")).toMatch(/@@index\(\[challengeOf\]\)/);
  });
  it("results show the VS card and board; sharing goes to the native sheet, then WhatsApp", () => {
    const q = read("src/modules/academy/components/QuizResults.tsx");
    expect(q).toMatch(/<VsCard/);
    expect(q).toMatch(/shareChallenge\(challengeUrl, challengeText\)/);
    const d = read("src/modules/academy/components/Duel.tsx");
    expect(d).toMatch(/await nav\.share\(data\)/);
    expect(d).toMatch(/https:\/\/wa\.me\/\?text=/);
  });
  it("the dashboard lists your challenges, from /api/academy/me", () => {
    expect(read("src/modules/academy/lib/me.ts")).toMatch(/myChallenges\(userId\)/);
    expect(read("src/modules/academy/components/Dashboard.tsx")).toMatch(/<MyChallenges list=\{me\.challenges\} \/>/);
  });
});
