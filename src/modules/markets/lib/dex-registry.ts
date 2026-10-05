// Future-proof Perp DEX / trading-platform registry. Adding a new platform is
// adding one object to this array - no schema change, no migration, no
// rewrite. Mirrors the exact pattern already used for NEWS_SOURCES
// (src/lib/news-sources.ts). Values are the platform's own public info plus
// assumption-based defaults for the points/airdrop-value calculator - never
// guaranteed figures, always editable here or by the user in the calculator.

import { favicon } from "@/lib/news-sources";

export type PointValueScenario = {
  totalSupply: number;
  totalPoints: number;
  tgeUnlockPcts: number[]; // e.g. [25, 30, 34]
  fdvScenariosUsd: number[]; // e.g. [700_000_000, 1_500_000_000, ...]
  allocationPctOfSupply: number; // % of total supply assumed allocated to points/airdrop
  /** Optional quick-select buttons for the "% of the airdrop pool actually
   * distributed" dimension - e.g. a program might allocate a fixed pool
   * (say 150M tokens = 15% of total supply) but only end up distributing
   * 50% or 30% of that pool. Each `pct` is still expressed as % of TOTAL
   * SUPPLY (so it plugs directly into `allocationPctOfSupply`), not % of
   * the pool - `label` carries the pool-relative framing for the button. */
  allocationScenarios?: { label: string; pct: number }[];
};

/**
 * The state of the POINTS PROGRAMME, which is not the same thing as the state
 * of the venue. A live exchange can have a programme that has not opened yet,
 * has closed, or has already paid out - and "is it still worth farming" is the
 * first question anyone has.
 *
 * It lives here as structured data rather than inside `notes` prose because the
 * page has to sort and filter on it. Every field past `phase` is optional: a
 * programme nobody has announced dates for is the normal case, and inventing a
 * date to fill the shape would be worse than showing nothing.
 */
export type PointsProgramMeta = {
  phase: "live" | "upcoming" | "ended" | "distributed";
  /** e.g. "Season 2". Omit when the programme does not run in seasons. */
  season?: string;
  /**
   * Whether the numbers in `pointValueScenario` come from the protocol or from
   * the community guessing. This drives a visible badge - a reader deserves to
   * know which of the two they are looking at, and almost no airdrop site says.
   */
  confirmed: boolean;
  /** Human summary of how points accrue, e.g. "1 point per $1,000 of volume". */
  earnRate?: string;
  /** ISO dates. `snapshotAt` is the one farmers actually plan around. */
  startedAt?: string;
  snapshotAt?: string;
  tgeAt?: string;
};

export type DexPlatform = {
  id: string;
  name: string;
  status: "live" | "testnet" | "upcoming";
  chain: string;
  fees: string; // short human summary
  pointsRules: string;
  rewardLogic: string;
  supportedMarkets: string;
  maxLeverage: string;
  notes: string;
  links: { website?: string; docs?: string; twitter?: string };
  /** True only when this site has a wired live data feed for this platform's
   * funding rate (currently Hyperliquid only, via /api/markets/perp). Other
   * platforms still work in the Funding Fee Calculator via manual entry -
   * this just controls whether the rate auto-prefills. */
  hasLiveFunding?: boolean;
  /** Present when a points/airdrop-value calculator scenario applies to this platform. */
  pointValueScenario?: PointValueScenario;
  /** Present when this platform runs a points programme worth tracking. */
  pointsProgram?: PointsProgramMeta;
  /** Explicit logo override (site-root-relative path, e.g. "/risex-logo.png") for
   * platforms where a real domain-favicon isn't a reliable source of the actual
   * brand mark - a committed static asset here, checked before falling back to
   * the domain favicon. Use sparingly (most platforms should stay favicon-only,
   * per platformLogo()'s doc comment). */
  logo?: string;
};

export const DEX_REGISTRY: DexPlatform[] = [
  {
    id: "variational",
    name: "Variational",
    status: "live",
    chain: "Multi-chain",
    fees: "Varies by market - see official docs for the current schedule.",
    pointsRules: "Points earned from trading volume and protocol activity (see official docs for current rules).",
    rewardLogic: "Expected token allocation proportional to points share at TGE - a community assumption, not a confirmed mechanic.",
    supportedMarkets: "Perpetuals",
    maxLeverage: "See official docs",
    notes: "The scenario numbers below are planning assumptions only, not official figures - edit them freely in the calculator.",
    links: { website: "https://www.variational.io" },
    pointsProgram: {
      phase: "live",
      confirmed: false,
      earnRate: "Earned from trading volume and protocol activity - see official docs for the current rate.",
    },
    pointValueScenario: {
      totalSupply: 1_000_000_000,
      totalPoints: 11_200_000, // owner-set (2026-10-05); the Featured card shows "11.2M Points"
      tgeUnlockPcts: [25, 30, 34],
      fdvScenariosUsd: [700_000_000, 1_500_000_000, 3_000_000_000, 10_000_000_000, 30_000_000_000],
      // 32%, owner-set (2026-10-05). The Featured Programs card shows the same
      // figure as a hard-coded label; points-programs.test.ts fails if the two
      // drift apart again (they did: card 12%, calculator 30%).
      allocationPctOfSupply: 32,
    },
  },
  {
    id: "sodex",
    name: "Sodex",
    status: "live",
    chain: "ValueChain",
    fees: "Varies by market - see official docs for the current schedule.",
    pointsRules: "SoPoints are earned from spot + perpetuals trading volume, liquidity provision, and ecosystem participation - see official docs for current rules.",
    rewardLogic: "SoPoints directly determine your share of the SOSO SoPoints incentive pool at distribution - a confirmed program mechanic.",
    supportedMarkets: "Spot, Perpetuals, RWA, Futures",
    maxLeverage: "See official docs",
    notes: "SOSO already trades live, so the price below is real (not a speculative FDV assumption) - edit freely. Use the pool-distribution buttons below to compare the 100%/50%/30% scenarios.",
    links: { website: "https://sodex.com" },
    pointsProgram: {
      phase: "live",
      confirmed: true,
      earnRate: "SoPoints from spot + perp volume, liquidity provision and ecosystem activity.",
    },
    pointValueScenario: {
      // Real total SOSO supply is 1B; at the real $0.29 price that's a
      // $290M FDV (via priceFromFdv below). The 150M-token SoPoints airdrop
      // pool is 15% of that total supply - allocationScenarios lets the
      // user quickly compare distributing 100%/50%/30% of that pool.
      totalSupply: 1_000_000_000,
      totalPoints: 27_000_000,
      tgeUnlockPcts: [],
      fdvScenariosUsd: [290_000_000],
      allocationPctOfSupply: 15,
      allocationScenarios: [
        { label: "100% pool - 150M SOSO", pct: 15 },
        { label: "50% pool - 75M SOSO", pct: 7.5 },
        { label: "30% pool - 45M SOSO", pct: 4.5 },
      ],
    },
  },
  {
    id: "risex",
    name: "RiseX",
    status: "live",
    chain: "Not confirmed - see official docs",
    fees: "Not confirmed - see official docs.",
    pointsRules: "Not confirmed - see official docs for current rules.",
    rewardLogic: "Expected token allocation proportional to points share at TGE - a community assumption, not a confirmed mechanic.",
    supportedMarkets: "Not confirmed - see official docs",
    maxLeverage: "Not confirmed - see official docs",
    notes: "The scenario numbers below are planning assumptions only, not official figures - edit them freely. Use the allocation buttons below to compare the 20%/25%/30% supply-allocation scenarios.",
    links: {},
    logo: "/risex-logo.png",
    pointsProgram: {
      phase: "live",
      confirmed: false,
      earnRate: "Not confirmed - see official docs.",
    },
    pointValueScenario: {
      totalSupply: 1_000_000_000,
      totalPoints: 12_000_000,
      tgeUnlockPcts: [],
      fdvScenariosUsd: [500_000_000, 1_000_000_000, 1_500_000_000, 3_000_000_000],
      allocationPctOfSupply: 25,
      allocationScenarios: [
        { label: "20% of supply", pct: 20 },
        { label: "25% of supply", pct: 25 },
        { label: "30% of supply", pct: 30 },
      ],
    },
  },
  {
    // ⚠️ Arcus has NO token: no ticker, supply, airdrop size or FDV is published,
    // and its terms (Annex C) say points are a participation metric only - not
    // redeemable, no ownership, no guaranteed token or airdrop. So the ONLY
    // official inputs are the Season 1 schedule; every dollar figure is a
    // scenario. The supply is a placeholder: in projectValue() it cancels out,
    // leaving value per point = FDV x airdrop % / total points exactly.
    //
    // Season 1 maximum, derived (pinned in points-programs.test.ts): 250,000
    // points every Wednesday 3 PM ET, from Season 1's start on Thu 1 Oct 2026 to
    // no later than Wed 30 Jun 2027 = 39 drops (7 Oct 2026 ... 30 Jun 2027)
    // = 9,750,000 points. Ending early only shrinks this.
    //
    // Not the unrelated "Arcus Network" token - a different project.
    id: "arcus",
    name: "Arcus",
    status: "live",
    chain: "Not confirmed - see official docs",
    fees: "See official docs for the current schedule.",
    pointsRules:
      "Season 1 distributes a fixed 250,000 points every week (Wednesdays, 3:00 PM ET), shared across all participants - the total does not grow with volume or users. Points come from trading, market making, retained deposits and referrals, with boosts for stock tokens and other RWAs and for off-hours RWA perps.",
    rewardLogic:
      "Arcus's terms say points are a participation metric only: not redeemable for cash, no ownership, and no guaranteed token or airdrop. This calculator ASSUMES points convert pro rata into an airdrop share - a scenario, not an Arcus mechanic.",
    supportedMarkets: "Perpetuals, stock tokens and other RWAs (incl. off-hours RWA perps)",
    maxLeverage: "See official docs",
    notes:
      "Arcus has no token yet, so every dollar figure here is a scenario. Total points defaults to the Season 1 maximum: 39 weekly drops x 250,000 = 9.75M if the season runs to 30 Jun 2027 (it can end earlier, which means fewer points). Season 0 (1 Jul - 30 Sep 2026) points are already allocated but unpublished - add your estimate to Total points to include that dilution. Not the unrelated Arcus Network token.",
    links: {
      website: "https://arcus.xyz",
      docs: "https://arcus.xyz/blog/introducing-arcus-points",
      twitter: "https://x.com/arcus_xyz",
    },
    pointsProgram: {
      phase: "live",
      season: "Season 1",
      // The schedule is official; the token economics are not - so the badge
      // reads Community, as it does for every guessed scenario on this page.
      confirmed: false,
      earnRate: "250,000 points per week (fixed), every Wednesday 3:00 PM ET, until no later than 30 Jun 2027.",
      startedAt: "2026-10-01",
    },
    pointValueScenario: {
      totalSupply: 1_000_000_000, // placeholder - cancels out of value per point
      totalPoints: 9_750_000,
      tgeUnlockPcts: [],
      fdvScenariosUsd: [250_000_000, 500_000_000, 1_000_000_000, 2_000_000_000, 3_000_000_000],
      // 25%, owner-set (2026-10-05) to match the Featured Programs card. Still a scenario:
      // Arcus has published no token or airdrop size.
      allocationPctOfSupply: 25,
      allocationScenarios: [
        { label: "5% airdrop", pct: 5 },
        { label: "10% airdrop", pct: 10 },
        { label: "15% airdrop", pct: 15 },
        { label: "25% airdrop", pct: 25 },
        { label: "30% airdrop", pct: 30 },
      ],
    },
  },
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    status: "live",
    chain: "Hyperliquid L1",
    fees: "Tiered maker/taker, discounted by 30-day volume - see official docs.",
    pointsRules: "No active points program - HYPE has already launched and trades live.",
    rewardLogic: "N/A - token generation event has already happened.",
    supportedMarkets: "Perpetuals + spot",
    maxLeverage: "Up to 50x (market-dependent)",
    notes: "Live funding rate and open interest for Hyperliquid already power the Funding Fee Calculator on this page.",
    links: { website: "https://hyperliquid.xyz" },
    hasLiveFunding: true,
  },
  {
    id: "gmx",
    name: "GMX",
    status: "live",
    chain: "Arbitrum + Avalanche",
    fees: "Open/close fee + a dynamic borrow/funding rate that varies by pool utilization - see official docs.",
    pointsRules: "No points program - rewards flow through GM/GLP liquidity provision, not a trading-points system.",
    rewardLogic: "N/A - no token-airdrop-via-points mechanic today.",
    supportedMarkets: "Perpetuals + spot swaps",
    maxLeverage: "Up to 50x (market-dependent)",
    notes: "No live feed wired in yet - enter GMX's published funding/borrow rate manually.",
    links: { website: "https://gmx.io" },
  },
  {
    id: "dydx",
    name: "dYdX",
    status: "live",
    chain: "dYdX Chain (Cosmos)",
    fees: "Tiered maker/taker by 30-day volume - see official docs.",
    pointsRules: "No active points program - DYDX has already launched and trades live.",
    rewardLogic: "N/A - token generation event has already happened.",
    supportedMarkets: "Perpetuals",
    maxLeverage: "Up to 20x (market-dependent)",
    notes: "No live feed wired in yet - enter dYdX's published funding rate manually.",
    links: { website: "https://dydx.trade" },
  },
  {
    id: "vertex",
    name: "Vertex Protocol",
    status: "live",
    chain: "Arbitrum",
    fees: "Tiered maker/taker - see official docs.",
    pointsRules: "See official docs for any current incentive program.",
    rewardLogic: "See official docs.",
    supportedMarkets: "Perpetuals + spot",
    maxLeverage: "Up to 20x (market-dependent)",
    notes: "No live feed wired in yet - enter Vertex's published funding rate manually.",
    links: { website: "https://vertexprotocol.com" },
  },
  {
    id: "aevo",
    name: "Aevo",
    status: "live",
    chain: "Aevo L2 (OP Stack)",
    fees: "Tiered maker/taker - see official docs.",
    pointsRules: "No active points program - AEVO has already launched and trades live.",
    rewardLogic: "N/A - token generation event has already happened.",
    supportedMarkets: "Perpetuals + options",
    maxLeverage: "Up to 20x (market-dependent)",
    notes: "No live feed wired in yet - enter Aevo's published funding rate manually.",
    links: { website: "https://aevo.xyz" },
  },
];

export function getPlatform(id: string): DexPlatform | undefined {
  return DEX_REGISTRY.find((p) => p.id === id);
}

export function platformsWithPointValue(): DexPlatform[] {
  return DEX_REGISTRY.filter((p) => p.pointValueScenario);
}

/**
 * Best-effort logo for a platform. Prefers an explicit `logo` override
 * (a committed static asset) when set; otherwise derives the domain from its
 * `website` link and reuses the same keyless favicon service already used
 * for news sources (`favicon()`), so no logo file needs to be committed for
 * most platforms. Returns null when neither is available.
 */
export function platformLogo(platform: Pick<DexPlatform, "links" | "logo">): string | null {
  if (platform.logo) return platform.logo;
  const domain = platformDomain(platform);
  return domain ? favicon(domain) : null;
}

/** Just the hostname from a platform's website link (e.g. "variational.io") - so
 * callers that need to reconstruct a trusted logo URL themselves (server-side
 * share-card routes) never have to accept a raw, attacker-suppliable URL. */
export function platformDomain(platform: Pick<DexPlatform, "links">): string | null {
  const site = platform.links.website;
  if (!site) return null;
  try {
    return new URL(site).hostname;
  } catch {
    return null;
  }
}
