/**
 * Points programmes, joined to live market data where any exists.
 *
 * Two registries meet here and they do NOT overlap cleanly:
 *
 *   - The curated one (`DEX_REGISTRY`) knows what a programme actually is:
 *     how points accrue, what supply they come out of, whether the numbers are
 *     confirmed or guessed. It is hand-maintained, and adding a programme is
 *     adding one object.
 *   - The live one (`/api/points/comps`) knows what the market is doing:
 *     volume, open interest, peer valuations. It only contains venues large
 *     enough for DefiLlama to track.
 *
 * ⚠️ Most points programmes worth farming are in the FIRST list and not the
 * second - that is the whole point of farming them. Sodex and RiseX have no
 * DefiLlama row at all. A page built only on live data silently drops them,
 * which is exactly what happened when the calculator moved to /points: three
 * curated programmes became unreachable and nothing reported it.
 *
 * So the curated list is the spine. Live data decorates it when present.
 */

import { DEX_REGISTRY, type DexPlatform, type PointsProgramMeta } from "@/lib/dex-registry";
import type { CompVenue } from "./points";

export type ProgramPhase = PointsProgramMeta["phase"];

export type ProgramView = {
  id: string;
  name: string;
  logo: string | null;
  phase: ProgramPhase;
  confirmed: boolean;
  season?: string;
  earnRate?: string;
  rules: string;
  rewardLogic: string;
  /** Venue facts a farmer asks before committing capital anywhere. */
  supportedMarkets: string;
  maxLeverage: string;
  fees: string;
  notes: string;
  chain: string;
  links: DexPlatform["links"];
  scenario: NonNullable<DexPlatform["pointValueScenario"]>;
  /** The live venue this programme runs on, when the market data has one. */
  venue: CompVenue | null;
  startedAt?: string;
  snapshotAt?: string;
  tgeAt?: string;
};

/**
 * Same normalisation the comps route uses, and for the same reason: two
 * registries spell the same project differently and a wrong join is worse than
 * no join. Kept deliberately narrow - it strips the noise words that differ
 * between listings, not anything that identifies the project.
 */
export function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(v\d+|perpetual|perpetuals|perps?|exchange|protocol|finance|network|dex)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function buildPrograms(venues: CompVenue[], registry: DexPlatform[] = DEX_REGISTRY): ProgramView[] {
  const byName = new Map<string, CompVenue>();
  for (const v of venues) {
    const k = normaliseName(v.name);
    if (k && !byName.has(k)) byName.set(k, v);
  }

  return registry
    .filter((p): p is DexPlatform & { pointValueScenario: NonNullable<DexPlatform["pointValueScenario"]> } =>
      Boolean(p.pointValueScenario)
    )
    .map((p) => {
      const meta = p.pointsProgram;
      return {
        id: p.id,
        name: p.name,
        logo: p.logo ?? null,
        // A programme with no metadata block is still a programme - it just has
        // not been classified yet. Defaulting to "live" and unconfirmed is the
        // honest reading of "someone added a scenario and said nothing else".
        phase: meta?.phase ?? "live",
        confirmed: meta?.confirmed ?? false,
        season: meta?.season,
        earnRate: meta?.earnRate,
        rules: p.pointsRules,
        rewardLogic: p.rewardLogic,
        supportedMarkets: p.supportedMarkets,
        maxLeverage: p.maxLeverage,
        fees: p.fees,
        notes: p.notes,
        chain: p.chain,
        links: p.links,
        scenario: p.pointValueScenario,
        venue: byName.get(normaliseName(p.name)) ?? null,
        startedAt: meta?.startedAt,
        snapshotAt: meta?.snapshotAt,
        tgeAt: meta?.tgeAt,
      };
    });
}

const PHASE_ORDER: Record<ProgramPhase, number> = {
  live: 0,
  upcoming: 1,
  distributed: 2,
  ended: 3,
};

export const PHASE_LABEL: Record<ProgramPhase, string> = {
  live: "Farming now",
  upcoming: "Not open yet",
  distributed: "Tokens distributed",
  ended: "Closed",
};

/**
 * Live programmes first, then the ones you cannot farm yet, then the ones you
 * cannot farm any more. "Can I still earn these?" is the first question, so it
 * is the first sort key; ties break on whether the numbers can be trusted.
 */
export function sortPrograms(list: ProgramView[]): ProgramView[] {
  return [...list].sort((a, b) => {
    const d = PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase];
    if (d !== 0) return d;
    if (a.confirmed !== b.confirmed) return a.confirmed ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * The scenario's own mid FDV, used to seed the calculator when a programme has
 * no live comparables to anchor on.
 *
 * The MIDDLE of the ladder rather than the first or the biggest: a registry
 * author lists scenarios low to high, so index 0 is the bear case and the last
 * is the moon case. Opening on either is editorialising.
 */
export function scenarioFdv(p: ProgramView): number {
  const xs = p.scenario.fdvScenariosUsd;
  if (!xs.length) return 0;
  return xs[Math.floor(xs.length / 2)];
}

/** Does this programme have enough live data for the comparables engine? */
export function hasLiveComps(p: ProgramView): boolean {
  return Boolean(p.venue && (p.venue.volume30d > 0 || p.venue.volume7d > 0));
}
