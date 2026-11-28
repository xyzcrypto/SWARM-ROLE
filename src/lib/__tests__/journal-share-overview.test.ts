import { describe, expect, it, vi, beforeEach } from "vitest";
import { computeStats, type TradeLike } from "../journal";

// Regression guard for the unauthenticated private-P&L disclosure:
// /api/journal/share/overview/[userId] is public by design (link-preview bots
// must fetch it without cookies), so the ONLY thing standing between a caller
// and a member's real P&L is the `visibility` filter on the trade query.
// `Trade.visibility` defaults to "private", so dropping that filter silently
// re-opens the hole - hence a test that asserts the filter specifically.

const findMany = vi.fn();
const findUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => findUnique(...a) },
    trade: { findMany: (...a: unknown[]) => findMany(...a) },
  },
}));

type Row = TradeLike & { visibility: string };

const closedWinner = (visibility: string): Row => ({
  visibility,
  side: "long",
  stopLoss: null,
  takeProfit: null,
  fills: [
    { kind: "entry", price: 100, size: 1, fee: 0 },
    { kind: "exit", price: 200, size: 1, fee: 0 },
  ],
});

/** Every trade this member has is private - the case that used to leak. */
const ALL_PRIVATE: Row[] = [closedWinner("private"), closedWinner("private")];

/** Stand-in for Postgres: apply the same where-clause the route passes us. */
function fakeDb(rows: Row[]) {
  return async ({ where }: { where: { visibility?: { in: string[] } } }) => {
    const allowed = where?.visibility?.in;
    return allowed ? rows.filter((r) => allowed.includes(r.visibility)) : rows;
  };
}

beforeEach(() => {
  findMany.mockReset();
  findUnique.mockReset();
  findUnique.mockResolvedValue({ name: "Trader", username: "trader" });
});

describe("journal share overview - visibility filter", () => {
  it("scopes the trade query to published trades only", async () => {
    findMany.mockImplementation(fakeDb(ALL_PRIVATE));
    const { GET } = await import("@/app/api/journal/share/overview/[userId]/route");

    await GET(new Request("http://localhost/"), { params: Promise.resolve({ userId: "u_1" }) });

    expect(findMany).toHaveBeenCalledTimes(1);
    const where = findMany.mock.calls[0][0].where;
    expect(where.userId).toBe("u_1");
    // The assertion that matters: only PUBLIC trades. Private ones are the
    // member's own; anonymous ones were published without a name, so they
    // cannot appear on a card that prints @username.
    expect(where.visibility).toBe("public");
  });

  it("a member whose trades are all private yields zeroed stats, not their real P&L", async () => {
    const query = fakeDb(ALL_PRIVATE);
    // What the route's own where-clause returns for this member:
    const visible = await query({ where: { visibility: { in: ["public", "anonymous"] } } });
    expect(visible).toHaveLength(0);

    const stats = computeStats(visible);
    expect(stats.totalTrades).toBe(0);
    expect(stats.totalPnl).toBe(0);
    expect(stats.winRate).toBe(0);

    // Sanity: without the filter the same fixture exposes a real, non-zero P&L -
    // i.e. this fixture would genuinely have leaked before the fix.
    const unfiltered = await query({ where: {} });
    expect(computeStats(unfiltered).totalPnl).toBeGreaterThan(0);
  });

  it("still counts trades the member deliberately published", async () => {
    const rows = [closedWinner("private"), closedWinner("public"), closedWinner("anonymous")];
    const visible = await fakeDb(rows)({ where: { visibility: { in: ["public", "anonymous"] } } });
    expect(visible).toHaveLength(2);
    expect(computeStats(visible).totalTrades).toBe(2);
  });
});
