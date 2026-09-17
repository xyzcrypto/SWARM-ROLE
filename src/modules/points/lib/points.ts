/**
 * Points / airdrop farming math.
 *
 * Everything here is a PROJECTION from assumptions. No perp DEX publishes a
 * points-to-token conversion before TGE, so there is no live figure to fetch
 * and any UI built on this must say so. What this module can do is make the
 * assumptions honest: derive the weakest input (FDV) from live peer data
 * instead of asking someone to guess it, and show the whole outcome space
 * rather than one flattering number.
 *
 * Pure functions only - no fetching, no React. The route layer supplies data.
 */

/** Which live metric a comparison is anchored on. */
export type CompMetric = "volume24h" | "volume7d" | "volume30d" | "openInterest";

export const COMP_METRIC_LABEL: Record<CompMetric, string> = {
  volume24h: "24h volume",
  volume7d: "7d volume",
  volume30d: "30d volume",
  openInterest: "open interest",
};

/** A venue as the comparables engine sees it. `fdv` is null when unlisted. */
export type CompVenue = {
  slug: string;
  name: string;
  logo: string | null;
  volume24h: number;
  volume7d: number;
  volume30d: number;
  openInterest: number;
  /** Fully diluted valuation in USD, or null when the token has not launched. */
  fdv: number | null;
  /** CoinGecko id backing `fdv`, for attribution in the UI. */
  coingeckoId?: string | null;
};

export function metricOf(v: CompVenue, metric: CompMetric): number {
  return v[metric] ?? 0;
}

/**
 * What one listed peer implies about an unlisted venue's FDV.
 *
 * The ratio is deliberately the plain one a trader would do on a napkin:
 * "Aster does 1.5x our volume and is worth $5.4B, so we're worth $5.4B / 1.5".
 * No smoothing, no regression - a model nobody can check in their head is
 * worse than arithmetic they can argue with.
 */
export type Comparable = {
  peer: CompVenue;
  /** target metric / peer metric. 1.5 means the peer is 1.5x the target. */
  ratio: number;
  /** peer FDV x (target metric / peer metric) */
  impliedFdv: number;
  /** peer FDV / peer annualised metric - the multiple being applied. */
  peerMultiple: number;
};

export function impliedFdv(peerFdv: number, peerMetric: number, targetMetric: number): number {
  if (peerMetric <= 0 || peerFdv <= 0) return 0;
  return peerFdv * (targetMetric / peerMetric);
}

/**
 * Build the comparable set for `target` against every listed peer.
 *
 * A peer needs both an FDV and a non-zero metric to say anything, so venues
 * missing either are dropped rather than contributing a zero that would drag
 * the median down without being visible.
 */
export function buildComparables(
  target: CompVenue,
  peers: CompVenue[],
  metric: CompMetric
): Comparable[] {
  const t = metricOf(target, metric);
  if (t <= 0) return [];
  return peers
    .filter((p) => p.slug !== target.slug && (p.fdv ?? 0) > 0 && metricOf(p, metric) > 0)
    .map((p) => {
      const pm = metricOf(p, metric);
      const annualised = metric === "openInterest" ? pm : annualise(pm, metric);
      return {
        peer: p,
        ratio: pm / t,
        impliedFdv: impliedFdv(p.fdv ?? 0, pm, t),
        peerMultiple: annualised > 0 ? (p.fdv ?? 0) / annualised : 0,
      };
    })
    .sort((a, b) => a.impliedFdv - b.impliedFdv);
}

/** Scale a windowed volume to a yearly run-rate, so multiples are comparable. */
export function annualise(value: number, metric: CompMetric): number {
  switch (metric) {
    case "volume24h":
      return value * 365;
    case "volume7d":
      return value * (365 / 7);
    case "volume30d":
      return value * (365 / 30);
    case "openInterest":
      return value;
  }
}

export type CompRange = { low: number; median: number; high: number; count: number };

/**
 * The honest summary of a comparable set: a RANGE, never a single number.
 *
 * Median rather than mean on purpose. One peer trading at a euphoric multiple
 * (or a dead one trading at nothing) moves a mean enough to change the
 * conclusion, and both happen constantly in this sector.
 */
export function compRange(comps: Comparable[]): CompRange {
  const vals = comps.map((c) => c.impliedFdv).filter((v) => v > 0).sort((a, b) => a - b);
  if (!vals.length) return { low: 0, median: 0, high: 0, count: 0 };
  return {
    low: vals[0],
    median: median(vals),
    high: vals[vals.length - 1],
    count: vals.length,
  };
}

/** Median of a PRE-SORTED array. Even counts average the two middles. */
export function median(sorted: number[]): number {
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ── the value projection ────────────────────────────────────────────────────

export type ValueInputs = {
  yourPoints: number;
  totalPoolPoints: number;
  /** % of TOTAL SUPPLY allocated to this points program. */
  allocationPctOfSupply: number;
  totalSupply: number;
  fdvUsd: number;
  /** % of your allocation that is liquid at TGE; the rest vests. */
  tgeUnlockPct: number;
};

export type ValueResult = {
  sharePct: number;
  tokens: number;
  priceUsd: number;
  grossUsd: number;
  /** Value of the portion actually sellable at TGE. */
  liquidAtTgeUsd: number;
  lockedUsd: number;
};

export function projectValue(a: ValueInputs): ValueResult {
  const sharePct = a.totalPoolPoints > 0 ? (a.yourPoints / a.totalPoolPoints) * 100 : 0;
  const priceUsd = a.totalSupply > 0 ? a.fdvUsd / a.totalSupply : 0;
  const poolTokens = a.totalSupply * (a.allocationPctOfSupply / 100);
  const tokens = poolTokens * (sharePct / 100);
  const grossUsd = tokens * priceUsd;
  const unlock = clampPct(a.tgeUnlockPct) / 100;
  return {
    sharePct,
    tokens,
    priceUsd,
    grossUsd,
    liquidAtTgeUsd: grossUsd * unlock,
    lockedUsd: grossUsd * (1 - unlock),
  };
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

// ── cost basis: the half nobody models ──────────────────────────────────────

/**
 * Farming is not free, and the fee line is usually the one that decides it.
 *
 * A points program that pays out at 0.02% of volume while you pay 0.04% taker
 * is a guaranteed loss dressed as a yield, and you cannot see that from the
 * points total - only from the cost side. This is why the calculator asks for
 * volume and fee rate rather than letting someone type a round "spent" figure.
 */
export type CostInputs = {
  /** Cumulative notional traded while farming. */
  volumeUsd: number;
  /** Effective round-trip fee rate in %, e.g. 0.04. */
  feeRatePct: number;
  /** Gas / bridging / other out-of-pocket, USD. */
  gasUsd: number;
  /** Capital parked in the protocol, USD. */
  capitalUsd: number;
  /** Days that capital has been committed. */
  days: number;
  /** What that capital would have earned elsewhere, annualised %. */
  opportunityAprPct: number;
};

export type CostResult = {
  feesUsd: number;
  gasUsd: number;
  opportunityUsd: number;
  /** Out-of-pocket only - fees + gas. What you have actually paid. */
  cashCostUsd: number;
  /** Cash cost plus the yield the parked capital gave up. */
  totalCostUsd: number;
};

export function projectCost(a: CostInputs): CostResult {
  const feesUsd = Math.max(0, a.volumeUsd) * (Math.max(0, a.feeRatePct) / 100);
  const gasUsd = Math.max(0, a.gasUsd);
  const opportunityUsd =
    Math.max(0, a.capitalUsd) * (Math.max(0, a.opportunityAprPct) / 100) * (Math.max(0, a.days) / 365);
  return {
    feesUsd,
    gasUsd,
    opportunityUsd,
    cashCostUsd: feesUsd + gasUsd,
    totalCostUsd: feesUsd + gasUsd + opportunityUsd,
  };
}

export type BreakEven = {
  /** FDV at which gross value equals total cost. 0 when unreachable. */
  fdvUsd: number;
  /** Multiple on total cost at the current FDV assumption. */
  roiMultiple: number;
  /** Profit (or loss) at the current FDV assumption. */
  netUsd: number;
  /** True when the position cannot break even at any FDV - no points, no share. */
  unreachable: boolean;
};

/**
 * The FDV you need for this farm to have been worth doing.
 *
 * Value is linear in FDV (tokens are fixed once your share is), so this
 * inverts exactly rather than searching: breakEvenFdv = cost / value-per-FDV.
 */
export function breakEven(value: ValueInputs, cost: CostResult): BreakEven {
  const at1 = projectValue({ ...value, fdvUsd: 1 }).grossUsd; // gross USD per $1 of FDV
  const current = projectValue(value);
  const net = current.grossUsd - cost.totalCostUsd;
  if (at1 <= 0) {
    return { fdvUsd: 0, roiMultiple: 0, netUsd: net, unreachable: true };
  }
  return {
    fdvUsd: cost.totalCostUsd / at1,
    roiMultiple: cost.totalCostUsd > 0 ? current.grossUsd / cost.totalCostUsd : 0,
    netUsd: net,
    unreachable: false,
  };
}

/** Per-point economics - the number that makes two farms comparable. */
export function efficiency(a: { points: number; cost: CostResult; volumeUsd: number }) {
  const costPerPoint = a.points > 0 ? a.cost.totalCostUsd / a.points : 0;
  const pointsPer1kVolume = a.volumeUsd > 0 ? (a.points / a.volumeUsd) * 1000 : 0;
  return { costPerPoint, pointsPer1kVolume };
}

// ── the outcome space, not one number ───────────────────────────────────────

export type GridCell = {
  fdvUsd: number;
  allocationPct: number;
  grossUsd: number;
  /** Net of total cost. Negative is a loss and the UI colours it as one. */
  netUsd: number;
  roiMultiple: number;
};

/**
 * Value across every (FDV x allocation) pair.
 *
 * A single "estimated value" invites anchoring on it. A grid makes the shape
 * of the bet visible instead: usually that allocation % barely matters next to
 * FDV, which is the opposite of where farmers spend their argument.
 */
export function sensitivityGrid(
  base: ValueInputs,
  fdvs: number[],
  allocationPcts: number[],
  totalCostUsd = 0
): GridCell[][] {
  return allocationPcts.map((allocationPct) =>
    fdvs.map((fdvUsd) => {
      const { grossUsd } = projectValue({ ...base, fdvUsd, allocationPctOfSupply: allocationPct });
      return {
        fdvUsd,
        allocationPct,
        grossUsd,
        netUsd: grossUsd - totalCostUsd,
        roiMultiple: totalCostUsd > 0 ? grossUsd / totalCostUsd : 0,
      };
    })
  );
}

/** Round to a readable ladder around an anchor, for auto-built FDV scenarios. */
export function fdvLadder(anchor: number, steps = 5): number[] {
  if (!(anchor > 0)) return [];
  // Geometric either side of the anchor: farming outcomes are multiplicative,
  // so an arithmetic ladder wastes half its rows on indistinguishable cases.
  const factors = [0.25, 0.5, 1, 2, 4];
  return factors.slice(0, steps).map((f) => roundNice(anchor * f));
}

function roundNice(n: number): number {
  if (n <= 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  return Math.round(n / (mag / 2)) * (mag / 2);
}

/** Compact USD for dense tables: $1.2B / $340M / $12.5k. */
export function usdCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(2)}`;
}

/**
 * The share API's zod schema caps `platform` at 40 characters and REJECTS
 * anything longer - a 41-character name failed with "Couldn't create the share
 * link" and nothing indicating the name was why. Truncating here keeps that
 * rule next to the value it constrains.
 */
export const SHARE_NAME_MAX = 40;

export function shareName(label: string, programName?: string | null, venueName?: string | null): string {
  const picked = label.trim() || programName || venueName || "Perp DEX";
  return picked.slice(0, SHARE_NAME_MAX);
}
