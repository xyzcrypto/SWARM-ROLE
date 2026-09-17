import { describe, expect, it } from "vitest";
import { DEX_REGISTRY } from "@modules/markets/lib/dex-registry";
import {
  buildPrograms,
  hasLiveComps,
  normaliseName,
  scenarioFdv,
  sortPrograms,
  type ProgramView,
} from "@modules/points/lib/programs";
import type { CompVenue } from "@modules/points/lib/points";

const venue = (name: string, over: Partial<CompVenue> = {}): CompVenue => ({
  slug: name.toLowerCase(),
  name,
  logo: null,
  volume24h: 1e9,
  volume7d: 7e9,
  volume30d: 30e9,
  openInterest: 5e8,
  fdv: null,
  ...over,
});

describe("the curated programmes are the spine, not the live data", () => {
  // The regression this exists for: /points was built on the live comparables
  // feed alone, and DefiLlama has no row for Sodex or RiseX - so two of the
  // three programmes this site actually tracks silently vanished from the page
  // that replaced the calculator. Nothing failed; they were just gone.
  it("keeps every registry programme even with no live data at all", () => {
    const programs = buildPrograms([]);
    const ids = programs.map((p) => p.id);
    expect(ids).toContain("variational");
    expect(ids).toContain("sodex");
    expect(ids).toContain("risex");
  });

  it("includes exactly the registry entries that have a scenario", () => {
    const expected = DEX_REGISTRY.filter((p) => p.pointValueScenario).map((p) => p.id).sort();
    expect(buildPrograms([]).map((p) => p.id).sort()).toEqual(expected);
  });

  it("carries the scenario through so the calculator can prefill", () => {
    const sodex = buildPrograms([]).find((p) => p.id === "sodex")!;
    expect(sodex.scenario.totalSupply).toBe(1_000_000_000);
    expect(sodex.scenario.allocationScenarios?.length).toBeGreaterThan(0);
  });
});

describe("live market data decorates a programme when it exists", () => {
  it("attaches the matching venue", () => {
    const programs = buildPrograms([venue("Variational", { fdv: null })]);
    const v = programs.find((p) => p.id === "variational")!;
    expect(v.venue?.name).toBe("Variational");
    expect(hasLiveComps(v)).toBe(true);
  });

  it("leaves programmes with no market row perfectly usable", () => {
    // Sodex has no DefiLlama presence. It must still be a complete programme,
    // just without comparables - not a broken row.
    const sodex = buildPrograms([venue("Variational")]).find((p) => p.id === "sodex")!;
    expect(sodex.venue).toBeNull();
    expect(hasLiveComps(sodex)).toBe(false);
    expect(scenarioFdv(sodex)).toBeGreaterThan(0);
  });

  it("does not attach a venue that merely looks similar", () => {
    // A wrong join here puts another venue's volume behind this programme's
    // valuation, which is the same class of silent wrongness as a bad
    // CoinGecko id. Better no venue than the wrong one.
    const p = buildPrograms([venue("Variance Labs")]).find((x) => x.id === "variational")!;
    expect(p.venue).toBeNull();
  });

  it("matches across the spelling differences the two registries actually have", () => {
    expect(normaliseName("Jupiter Perpetual Exchange")).toBe(normaliseName("Jupiter"));
    expect(normaliseName("dYdX V4")).toBe(normaliseName("dYdX"));
    expect(normaliseName("Vertex Protocol")).toBe(normaliseName("Vertex"));
    // But not so aggressively that two different projects collide.
    expect(normaliseName("Aster")).not.toBe(normaliseName("Aevo"));
  });
});

describe("ordering answers 'can I still farm this?' first", () => {
  const p = (id: string, phase: ProgramView["phase"], confirmed = false): ProgramView =>
    ({ id, name: id, phase, confirmed, scenario: { fdvScenariosUsd: [1] } } as unknown as ProgramView);

  it("puts live programmes above everything else", () => {
    const out = sortPrograms([p("c", "ended"), p("a", "live"), p("b", "upcoming")]);
    expect(out.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks ties on whether the numbers are confirmed", () => {
    const out = sortPrograms([p("guess", "live", false), p("real", "live", true)]);
    expect(out.map((x) => x.id)).toEqual(["real", "guess"]);
  });

  it("is stable and does not mutate its input", () => {
    const input = [p("b", "live"), p("a", "live")];
    const copy = [...input];
    sortPrograms(input);
    expect(input).toEqual(copy);
  });
});

describe("scenarioFdv opens on the middle of the ladder", () => {
  const withLadder = (xs: number[]) => ({ scenario: { fdvScenariosUsd: xs } } as ProgramView);

  it("picks the middle, not the bear case or the moon case", () => {
    // Registry authors write these low to high, so index 0 is the bear case
    // and the last is the moon case. Opening on either is editorialising.
    expect(scenarioFdv(withLadder([7e8, 1.5e9, 3e9, 1e10, 3e10]))).toBe(3e9);
    expect(scenarioFdv(withLadder([5e8, 1e9, 1.5e9, 3e9]))).toBe(1.5e9);
  });

  it("handles a single-scenario programme", () => {
    // Sodex has one: its token already trades, so there is nothing to guess.
    expect(scenarioFdv(withLadder([2.9e8]))).toBe(2.9e8);
  });

  it("returns 0 rather than NaN when a programme lists none", () => {
    expect(scenarioFdv(withLadder([]))).toBe(0);
  });
});

describe("every tracked programme is presentable", () => {
  // A registry entry with a scenario but no rules text renders an empty card.
  // Cheap to assert, and it is the kind of thing added at 2am.
  for (const p of buildPrograms([])) {
    it(`${p.id} has the fields the card renders`, () => {
      expect(p.name).toBeTruthy();
      expect(p.rules).toBeTruthy();
      expect(p.rewardLogic).toBeTruthy();
      expect(p.scenario.totalSupply).toBeGreaterThan(0);
      expect(p.scenario.totalPoints).toBeGreaterThan(0);
      expect(p.scenario.allocationPctOfSupply).toBeGreaterThan(0);
      expect(["live", "upcoming", "ended", "distributed"]).toContain(p.phase);
    });
  }
});
