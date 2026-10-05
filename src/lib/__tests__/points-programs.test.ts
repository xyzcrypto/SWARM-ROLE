import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { projectValue } from "@modules/points/lib/points";
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

describe("Arcus (Season 1) - official schedule, everything else a scenario", () => {
  const arcus = DEX_REGISTRY.find((p) => p.id === "arcus")!;
  const sc = arcus.pointValueScenario!;

  it("totals the Season 1 maximum from the official schedule, not a guess", () => {
    // 250,000 points every Wednesday, Season 1 starts Thu 1 Oct 2026, ends no later than Wed 30 Jun 2027.
    const drops: string[] = [];
    for (let d = new Date(Date.UTC(2026, 9, 1)); d <= new Date(Date.UTC(2027, 5, 30)); d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() === 3) drops.push(d.toISOString().slice(0, 10));
    }
    expect(drops.length).toBe(39);
    expect(drops[0]).toBe("2026-10-07");
    expect(drops.at(-1)).toBe("2027-06-30");
    expect(sc.totalPoints).toBe(39 * 250_000);
  });

  it("values a point as FDV x airdrop % / total points (the placeholder supply cancels out)", () => {
    const perPoint = (fdvUsd: number, pct: number, totalSupply = sc.totalSupply) =>
      projectValue({ yourPoints: 1, totalPoolPoints: sc.totalPoints, allocationPctOfSupply: pct, totalSupply, fdvUsd, tgeUnlockPct: 100 }).grossUsd;
    expect(perPoint(500_000_000, 10)).toBeCloseTo(5.128, 3); // the worked example: $500M, 10% -> $5.13
    expect(perPoint(500_000_000, 10, 7_000_000_000)).toBeCloseTo(perPoint(500_000_000, 10), 9); // supply is irrelevant
    expect(perPoint(3_000_000_000, 30)).toBeCloseTo(92.31, 2);
    expect(perPoint(250_000_000, 5)).toBeCloseTo(1.28, 2);
  });

  it("offers the FDV and airdrop ranges asked for, including 25-30% and $2B / $3B", () => {
    expect(sc.fdvScenariosUsd).toEqual([250_000_000, 500_000_000, 1_000_000_000, 2_000_000_000, 3_000_000_000]);
    expect(sc.allocationScenarios!.map((a) => a.pct)).toEqual([5, 10, 15, 25, 30]);
    expect(sc.allocationScenarios!.map((a) => a.pct)).toContain(sc.allocationPctOfSupply);
  });

  it("never presents its numbers as official, and says what is missing", () => {
    expect(arcus.pointsProgram).toMatchObject({ phase: "live", season: "Season 1", confirmed: false, startedAt: "2026-10-01" });
    expect(arcus.notes).toMatch(/no token yet/i);
    expect(arcus.notes).toMatch(/Season 0/);
    expect(arcus.notes).toMatch(/Arcus Network/);
    expect(arcus.rewardLogic).toMatch(/not redeemable/i);
  });
});

describe("Featured Programs card agrees with the calculator", () => {
  it("Variational shows 32% on the card and uses 32% in the calculator", () => {
    const card = readFileSync("src/modules/points/components/FeaturedProgramsBar.tsx", "utf8");
    const v = DEX_REGISTRY.find((p) => p.id === "variational")!;
    expect(v.pointValueScenario!.allocationPctOfSupply).toBe(32);
    expect(card).toMatch(/id: "variational",[\s\S]*?allocLabel: "32% Allocation"/);
  });

  // The labels are hard-coded, so pin each live card to the registry it advertises.
  const card = readFileSync("src/modules/points/components/FeaturedProgramsBar.tsx", "utf8");
  const label = (id: string, key: "pointsLabel" | "allocLabel") =>
    card.match(new RegExp(`id: "${id}",[\\s\\S]*?${key}: "([^"]+)"`))?.[1];
  const millions = (n: number) => `${+(n / 1_000_000).toFixed(2)}M Points`;

  it("Variational shows 11.2M points, the calculator's pool", () => {
    const sc = DEX_REGISTRY.find((p) => p.id === "variational")!.pointValueScenario!;
    expect(sc.totalPoints).toBe(11_200_000);
    expect(label("variational", "pointsLabel")).toBe(millions(sc.totalPoints));
  });

  it("Arcus has a live card: 9.75M points and 25%, same as its calculator", () => {
    const sc = DEX_REGISTRY.find((p) => p.id === "arcus")!.pointValueScenario!;
    expect(label("arcus", "pointsLabel")).toBe("9.75M Points");
    expect(label("arcus", "pointsLabel")).toBe(millions(sc.totalPoints));
    expect(label("arcus", "allocLabel")).toBe(`${sc.allocationPctOfSupply}% Allocation`);
    expect(sc.allocationPctOfSupply).toBe(25);
    expect(card).toMatch(/LOCKED_IDS = new Set\(\["hyperliquid", "lighter"\]\)/);
  });
});

describe("a shared /points/<id> link opens that programme's calculator", () => {
  const client = readFileSync("src/modules/points/components/PointsClient.tsx", "utf8");
  const venuePage = readFileSync("src/app/points/[venue]/page.tsx", "utf8");
  it("the link page redirects to /points#programme-<id>", () => {
    expect(venuePage).toMatch(/redirect\(`\/points#programme-\$\{hit\.id\}`\)/);
  });
  it("the page reads that hash and selects the programme (after restoring saved state)", () => {
    const restore = client.indexOf("localStorage.getItem(STORE_KEY)");
    const hash = client.indexOf("#programme-([a-z0-9-]+)");
    expect(restore).toBeGreaterThan(-1);
    expect(hash).toBeGreaterThan(restore); // declared after, so the link wins over the saved choice
    expect(client).toMatch(/set\("analyseId", id\);\s*set\("openId", id\);/);
    expect(client).toMatch(/addEventListener\("hashchange", selectFromHash\)/);
  });
  it("covers every programme, including Arcus", () => {
    expect(DEX_REGISTRY.filter((p) => p.pointValueScenario).map((p) => p.id)).toEqual(expect.arrayContaining(["arcus", "variational", "sodex", "risex"]));
  });
});

describe("the calculator offers each programme's own presets", () => {
  const card = readFileSync("src/modules/points/components/PointsCalculatorCard.tsx", "utf8");
  it("uses allocationScenarios and fdvScenariosUsd when the programme defines them", () => {
    expect(card).toMatch(/if \(ownAllocs\.length >= 2\) \{\s*return Array\.from\(new Set\(ownAllocs\.map\(\(a\) => a\.pct\)\)\)/);
    expect(card).toMatch(/scenarioFdvs && scenarioFdvs\.length >= 3\s*\? Array\.from\(new Set\(scenarioFdvs\)\)/);
  });
  it("sizes the pill row to the number of pills with literal grid classes", () => {
    expect(card).toMatch(/PILL_COLS: Record<number, string> = \{ 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" \}/);
  });
});

describe("the calculator's data badge tells the truth", () => {
  it("says Confirmed only for programmes the registry marks confirmed", () => {
    const card = readFileSync("src/modules/points/components/PointsCalculatorCard.tsx", "utf8");
    expect(card).toMatch(/\{program\.confirmed \? \(/);
    expect(card).toContain("<span>Scenario data</span>");
    expect(DEX_REGISTRY.find((p) => p.id === "arcus")!.pointsProgram!.confirmed).toBe(false);
  });
});
