// Future-proof Perp DEX / trading-platform registry. Adding a new platform is
// adding one object to this array - no schema change, no migration, no
// rewrite. Mirrors the exact pattern already used for NEWS_SOURCES
// (src/lib/news-sources.ts). Values are the platform's own public info plus
// assumption-based defaults for the points/airdrop-value calculator - never
// guaranteed figures, always editable here or by the user in the calculator.

export type PointValueScenario = {
  totalSupply: number;
  totalPoints: number;
  tgeUnlockPcts: number[]; // e.g. [25, 30, 34]
  fdvScenariosUsd: number[]; // e.g. [700_000_000, 1_500_000_000, ...]
  allocationPctOfSupply: number; // % of total supply assumed allocated to points/airdrop
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
  /** Present when a points/airdrop-value calculator scenario applies to this platform. */
  pointValueScenario?: PointValueScenario;
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
    links: {},
    pointValueScenario: {
      totalSupply: 1_000_000_000,
      totalPoints: 9_400_000,
      tgeUnlockPcts: [25, 30, 34],
      fdvScenariosUsd: [700_000_000, 1_500_000_000, 3_000_000_000, 10_000_000_000, 30_000_000_000],
      allocationPctOfSupply: 30,
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
  },
];

export function getPlatform(id: string): DexPlatform | undefined {
  return DEX_REGISTRY.find((p) => p.id === id);
}

export function platformsWithPointValue(): DexPlatform[] {
  return DEX_REGISTRY.filter((p) => p.pointValueScenario);
}
