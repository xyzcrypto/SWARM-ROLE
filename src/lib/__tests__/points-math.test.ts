import { describe, expect, it } from "vitest";
import {
  annualise,
  breakEven,
  buildComparables,
  compRange,
  efficiency,
  fdvLadder,
  impliedFdv,
  median,
  projectCost,
  projectValue,
  sensitivityGrid,
  usdCompact,
  type CompVenue,
  type ValueInputs,
} from "@modules/points/lib/points";

const venue = (over: Partial<CompVenue> & { slug: string }): CompVenue => ({
  name: over.slug,
  logo: null,
  volume24h: 0,
  volume7d: 0,
  volume30d: 0,
  openInterest: 0,
  fdv: null,
  ...over,
});

// The worked example this whole engine exists for, taken from a real napkin
// comparison: Variational is unlisted, Aster does ~1.5x its 7d volume at a
// $5.4B FDV, Lighter ~1.2x at $4.28B. Those two peers should bracket it.
const VARIATIONAL = venue({ slug: "variational", volume7d: 10.43e9, volume30d: 38.562e9, openInterest: 832.3e6 });
const ASTER = venue({ slug: "aster", volume7d: 15.91e9, volume30d: 71.411e9, openInterest: 1.295e9, fdv: 5.4e9 });
const LIGHTER = venue({ slug: "lighter", volume7d: 12.877e9, volume30d: 54.099e9, openInterest: 720e6, fdv: 4.28e9 });
const HYPERLIQUID = venue({ slug: "hyperliquid", volume7d: 45.457e9, volume30d: 236.988e9, openInterest: 6.802e9, fdv: 6.802e9 });

describe("implied FDV is the napkin ratio, not a model", () => {
  it("scales the peer's FDV by how much bigger the peer is", () => {
    // Aster is 1.5259x Variational on 7d volume, so Variational implies
    // 5.4B / 1.5259 = ~3.54B.
    const v = impliedFdv(5.4e9, 15.91e9, 10.43e9);
    expect(v / 1e9).toBeCloseTo(3.54, 2);
  });

  it("is symmetric with the ratio the UI shows", () => {
    const ratio = 15.91 / 10.43;
    expect(impliedFdv(5.4e9, 15.91e9, 10.43e9)).toBeCloseTo(5.4e9 / ratio, 0);
  });

  it("refuses to invent a number from nothing", () => {
    // A peer with no FDV or no volume says nothing at all, and must not say
    // zero as though zero were an estimate.
    expect(impliedFdv(0, 100, 50)).toBe(0);
    expect(impliedFdv(5e9, 0, 50)).toBe(0);
  });
});

describe("buildComparables", () => {
  const peers = [ASTER, LIGHTER, HYPERLIQUID];

  it("produces one comparable per listed peer, cheapest first", () => {
    const comps = buildComparables(VARIATIONAL, peers, "volume7d");
    expect(comps).toHaveLength(3);
    // Sorted by implied FDV ascending, so the UI can read low -> high directly.
    const implied = comps.map((c) => c.impliedFdv);
    expect([...implied].sort((a, b) => a - b)).toEqual(implied);

    // ⚠️ Hyperliquid comes FIRST, and that is the finding rather than a quirk.
    // It is by far the largest venue here, and it trades at the LOWEST multiple
    // of its own volume - so anchoring on the market leader produces the most
    // conservative estimate, not the most generous one. A napkin comparison
    // against "the big one" is the opposite of optimistic.
    expect(comps.map((c) => c.peer.slug)).toEqual(["hyperliquid", "lighter", "aster"]);
    expect(comps[0].impliedFdv / 1e9).toBeCloseTo(1.56, 1);
    expect(comps[2].impliedFdv / 1e9).toBeCloseTo(3.54, 1);
  });

  it("drops peers with no FDV instead of counting them as zero", () => {
    // The bug this guards: an unlisted peer contributing impliedFdv 0 would
    // drag the median down hard while being invisible in the table.
    const unlisted = venue({ slug: "ghost", volume7d: 9e9 });
    const comps = buildComparables(VARIATIONAL, [...peers, unlisted], "volume7d");
    expect(comps.map((c) => c.peer.slug)).not.toContain("ghost");
  });

  it("never compares a venue against itself", () => {
    const listed = venue({ ...VARIATIONAL, fdv: 3e9 });
    const comps = buildComparables(listed, [listed, ASTER], "volume7d");
    expect(comps.map((c) => c.peer.slug)).toEqual(["aster"]);
  });

  it("says nothing when the target has no data on the chosen metric", () => {
    // Picking "open interest" for a venue that reports none must produce an
    // empty set, not a division that quietly yields Infinity.
    const noOi = venue({ slug: "x", volume7d: 1e9 });
    expect(buildComparables(noOi, peers, "openInterest")).toEqual([]);
  });

  it("reports the peer's own valuation multiple, annualised", () => {
    const [aster] = buildComparables(VARIATIONAL, [ASTER], "volume7d");
    // 5.4B FDV against 15.91B/week -> 829.9B/yr -> ~0.0065x
    expect(aster.peerMultiple).toBeCloseTo(5.4e9 / (15.91e9 * (365 / 7)), 6);
  });
});

describe("compRange is a range, and uses the median", () => {
  it("brackets the estimate with the real low and high", () => {
    const r = compRange(buildComparables(VARIATIONAL, [ASTER, LIGHTER, HYPERLIQUID], "volume7d"));
    expect(r.count).toBe(3);
    expect(r.low).toBeLessThan(r.median);
    expect(r.median).toBeLessThan(r.high);
    // Aster and Lighter both land near $3.5B; Hyperliquid's much lower
    // multiple pulls the top of the range down, not up - worth seeing.
    expect(r.median / 1e9).toBeCloseTo(3.47, 1);
  });

  it("resists a single euphoric peer, which a mean would not", () => {
    // This is the whole reason for median. One venue at a silly valuation
    // should widen the range, not move the headline number.
    const mania = venue({ slug: "mania", volume7d: 1e9, fdv: 80e9 });
    const sane = compRange(buildComparables(VARIATIONAL, [ASTER, LIGHTER], "volume7d"));
    const withMania = compRange(buildComparables(VARIATIONAL, [ASTER, LIGHTER, mania], "volume7d"));
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const meanWith = mean(
      buildComparables(VARIATIONAL, [ASTER, LIGHTER, mania], "volume7d").map((c) => c.impliedFdv)
    );
    expect(withMania.high).toBeGreaterThan(sane.high); // the range widens
    expect(withMania.median).toBeLessThan(meanWith / 10); // the headline does not
  });

  it("is empty rather than zero when there is nothing to compare", () => {
    expect(compRange([])).toEqual({ low: 0, median: 0, high: 0, count: 0 });
  });

  it("averages the two middles on an even count", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([1, 2, 3])).toBe(2);
    expect(median([])).toBe(0);
  });
});

describe("annualise makes windows comparable", () => {
  it("scales each window to a year", () => {
    expect(annualise(1, "volume24h")).toBe(365);
    expect(annualise(7, "volume7d")).toBe(365);
    expect(annualise(30, "volume30d")).toBe(365);
  });

  it("leaves open interest alone, because it is a level not a flow", () => {
    // OI is a stock. Multiplying it by 365 would be meaningless, and the
    // multiple built on it would be off by two orders of magnitude.
    expect(annualise(832e6, "openInterest")).toBe(832e6);
  });
});

// ── value ──────────────────────────────────────────────────────────────────

const BASE: ValueInputs = {
  yourPoints: 940,
  totalPoolPoints: 9_400_000,
  allocationPctOfSupply: 30,
  totalSupply: 1_000_000_000,
  fdvUsd: 1.5e9,
  tgeUnlockPct: 25,
};

describe("projectValue", () => {
  it("walks points -> share -> tokens -> dollars", () => {
    const r = projectValue(BASE);
    expect(r.sharePct).toBeCloseTo(0.01, 6); // 940 / 9.4M
    expect(r.priceUsd).toBeCloseTo(1.5, 6); // 1.5B / 1B supply
    expect(r.tokens).toBeCloseTo(30_000, 6); // 0.01% of a 300M pool
    expect(r.grossUsd).toBeCloseTo(45_000, 6);
  });

  it("separates what you can actually sell at TGE from what vests", () => {
    // The number farmers quote is the gross one; the number they receive on
    // day one is this. A 25% unlock turns $45k into $11.25k liquid.
    const r = projectValue(BASE);
    expect(r.liquidAtTgeUsd).toBeCloseTo(11_250, 6);
    expect(r.lockedUsd).toBeCloseTo(33_750, 6);
    expect(r.liquidAtTgeUsd + r.lockedUsd).toBeCloseTo(r.grossUsd, 6);
  });

  it("clamps a nonsense unlock rather than inventing money", () => {
    expect(projectValue({ ...BASE, tgeUnlockPct: 900 }).liquidAtTgeUsd).toBeCloseTo(45_000, 6);
    expect(projectValue({ ...BASE, tgeUnlockPct: -50 }).liquidAtTgeUsd).toBe(0);
  });

  it("is linear in FDV, which is what lets break-even invert exactly", () => {
    const a = projectValue({ ...BASE, fdvUsd: 1e9 }).grossUsd;
    const b = projectValue({ ...BASE, fdvUsd: 2e9 }).grossUsd;
    expect(b).toBeCloseTo(a * 2, 6);
  });

  it("survives an empty form without dividing by zero", () => {
    const r = projectValue({ ...BASE, totalPoolPoints: 0, totalSupply: 0 });
    expect(r.sharePct).toBe(0);
    expect(r.priceUsd).toBe(0);
    expect(Number.isFinite(r.grossUsd)).toBe(true);
  });
});

// ── cost ───────────────────────────────────────────────────────────────────

describe("projectCost", () => {
  const COST = {
    volumeUsd: 5_000_000,
    feeRatePct: 0.04,
    gasUsd: 120,
    capitalUsd: 20_000,
    days: 90,
    opportunityAprPct: 8,
  };

  it("prices the fee line, which is usually what decides the farm", () => {
    const c = projectCost(COST);
    expect(c.feesUsd).toBeCloseTo(2000, 6); // $5M x 0.04%
  });

  it("counts parked capital's forgone yield separately from cash spent", () => {
    // Keeping these apart matters: cash cost is what left your wallet, total
    // cost is what the farm actually cost you. Farmers only ever count the first.
    const c = projectCost(COST);
    expect(c.opportunityUsd).toBeCloseTo(20_000 * 0.08 * (90 / 365), 6);
    expect(c.cashCostUsd).toBeCloseTo(2120, 6);
    expect(c.totalCostUsd).toBeCloseTo(2120 + c.opportunityUsd, 6);
  });

  it("treats negative inputs as zero rather than as a rebate", () => {
    const c = projectCost({ ...COST, volumeUsd: -1e6, gasUsd: -50, days: -10 });
    expect(c.feesUsd).toBe(0);
    expect(c.gasUsd).toBe(0);
    expect(c.opportunityUsd).toBe(0);
  });
});

describe("breakEven", () => {
  const cost = projectCost({
    volumeUsd: 5_000_000,
    feeRatePct: 0.04,
    gasUsd: 120,
    capitalUsd: 20_000,
    days: 90,
    opportunityAprPct: 8,
  });

  it("finds the FDV where the farm stops being a loss", () => {
    const be = breakEven(BASE, cost);
    // Gross is linear in FDV, so the break-even FDV reproduces the cost exactly.
    const atBreakEven = projectValue({ ...BASE, fdvUsd: be.fdvUsd }).grossUsd;
    expect(atBreakEven).toBeCloseTo(cost.totalCostUsd, 4);
  });

  it("agrees with the sign of net at the current assumption", () => {
    const rich = breakEven(BASE, cost); // $45k gross vs ~$2.5k cost
    expect(rich.netUsd).toBeGreaterThan(0);
    expect(rich.roiMultiple).toBeGreaterThan(1);
    expect(rich.fdvUsd).toBeLessThan(BASE.fdvUsd);

    const thin = breakEven({ ...BASE, fdvUsd: 1e6 }, cost);
    expect(thin.netUsd).toBeLessThan(0);
    expect(thin.roiMultiple).toBeLessThan(1);
    expect(thin.fdvUsd).toBeGreaterThan(1e6);
  });

  it("says unreachable when no FDV can help, instead of printing 0", () => {
    // Zero points means zero tokens at any valuation. "Break even at $0" would
    // read as good news; it is the opposite.
    const be = breakEven({ ...BASE, yourPoints: 0 }, cost);
    expect(be.unreachable).toBe(true);
    expect(be.netUsd).toBeLessThan(0);
  });
});

describe("efficiency", () => {
  it("prices one point, so two farms can be compared at all", () => {
    const cost = projectCost({
      volumeUsd: 1_000_000,
      feeRatePct: 0.04,
      gasUsd: 0,
      capitalUsd: 0,
      days: 0,
      opportunityAprPct: 0,
    });
    const e = efficiency({ points: 400, cost, volumeUsd: 1_000_000 });
    expect(e.costPerPoint).toBeCloseTo(1, 6); // $400 of fees / 400 points
    expect(e.pointsPer1kVolume).toBeCloseTo(0.4, 6);
  });

  it("does not divide by zero on a fresh form", () => {
    const cost = projectCost({ volumeUsd: 0, feeRatePct: 0, gasUsd: 0, capitalUsd: 0, days: 0, opportunityAprPct: 0 });
    const e = efficiency({ points: 0, cost, volumeUsd: 0 });
    expect(e.costPerPoint).toBe(0);
    expect(e.pointsPer1kVolume).toBe(0);
  });
});

// ── the grid ───────────────────────────────────────────────────────────────

describe("sensitivityGrid", () => {
  const fdvs = [5e8, 1e9, 2e9];
  const allocs = [10, 20, 30];

  it("is rows of allocation by columns of FDV", () => {
    const g = sensitivityGrid(BASE, fdvs, allocs, 1000);
    expect(g).toHaveLength(3);
    expect(g[0]).toHaveLength(3);
    expect(g[0][0].allocationPct).toBe(10);
    expect(g[0][2].fdvUsd).toBe(2e9);
  });

  it("shows loss as a negative, not as a floor at zero", () => {
    // A grid that clamps at zero hides exactly the cells a farmer needs to see.
    const g = sensitivityGrid({ ...BASE, yourPoints: 1 }, [1e6], [1], 5000);
    expect(g[0][0].netUsd).toBeLessThan(0);
  });

  it("moves much more across FDV than across allocation", () => {
    // The point of showing a grid at all: a 4x in FDV is a 4x in value, while
    // 10% -> 30% allocation is only 3x, and farmers argue about the wrong one.
    const g = sensitivityGrid(BASE, fdvs, allocs, 0);
    const acrossFdv = g[0][2].grossUsd / g[0][0].grossUsd;
    const acrossAlloc = g[2][0].grossUsd / g[0][0].grossUsd;
    expect(acrossFdv).toBeCloseTo(4, 6);
    expect(acrossAlloc).toBeCloseTo(3, 6);
  });
});

describe("fdvLadder", () => {
  it("is geometric around the anchor, not arithmetic", () => {
    // Farming outcomes are multiplicative; an arithmetic ladder spends half
    // its rows on cases nobody can tell apart.
    const l = fdvLadder(2e9);
    expect(l).toHaveLength(5);
    expect(l[2]).toBe(2e9); // the anchor sits in the middle
    expect(l[0]).toBeLessThan(l[1]);
    expect(l[3]).toBeGreaterThan(l[2]);
  });

  it("returns nothing for a missing anchor rather than a ladder of zeros", () => {
    expect(fdvLadder(0)).toEqual([]);
    expect(fdvLadder(NaN)).toEqual([]);
  });
});

describe("usdCompact", () => {
  it("reads the way the table needs it to", () => {
    expect(usdCompact(6.802e9)).toBe("$6.80B");
    expect(usdCompact(832.3e6)).toBe("$832.30M");
    expect(usdCompact(12_500)).toBe("$12.5k");
    expect(usdCompact(42.5)).toBe("$42.50");
  });

  it("keeps the sign, because half these cells are losses", () => {
    expect(usdCompact(-2400)).toBe("-$2.4k");
  });
});
