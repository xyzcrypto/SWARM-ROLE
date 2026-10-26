import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPerpVenues, coingeckoDerivativeRows, FEATURED_PERP_VENUES, type CgDerivRow } from "@modules/markets/lib/perp-venues";
import { normaliseVenue } from "@modules/points/lib/perp-sources";

const cg = (id: string, name: string, volume24h: number, openInterest: number): CgDerivRow => ({
  id,
  name,
  key: normaliseVenue(name),
  logo: `https://coin-images.coingecko.com/markets/images/${id}.png`,
  volume24h,
  openInterest,
});

// CoinGecko's derivatives list as production sees it when DefiLlama refuses.
const CG = [
  cg("binance_futures", "Binance (Futures)", 60e9, 30e9),
  cg("hyperliquid", "Hyperliquid (Futures)", 5e9, 8e9),
  cg("lighter", "Lighter", 3e9, 0.8e9),
  cg("variational_omni", "Variational Omni", 0.6e9, 0.9e9),
  cg("arcus-futures", "Arcus (Futures)", 49e6, 12e6),
  cg("risex", "RISEx", 63e6, 53e6),
  cg("sodex_futures", "SoDEX (Futures)", 52e6, 14e6),
];

describe("Perp DEX leaderboard venues", () => {
  it("is exactly the owner's seven venues", () => {
    expect(FEATURED_PERP_VENUES.map((v) => v.name)).toEqual(["Hyperliquid", "Lighter", "Variational", "TXFlow", "RiseX", "Arcus", "SoDEX"]);
  });

  it("fills every venue CoinGecko reports, with its real logo and OI, and never a CEX", () => {
    const v = buildPerpVenues([], CG, { volume24h: 0, openInterest: 0 });
    expect(v).toHaveLength(7);
    expect(v.map((x) => x.name)).not.toContain("Binance (Futures)");
    const by = Object.fromEntries(v.map((x) => [x.key, x]));
    expect(by.lighter.volume24h).toBe(3e9);
    expect(by.variational.openInterest).toBe(0.9e9);
    expect(by.arcus.logo).toContain("arcus-futures");
    expect(by.risex.volume24h).toBe(63e6);
    expect(by.sodex.volume24h).toBe(52e6);
  });

  it("shows a dash (null) for a venue no source reports, never an estimate", () => {
    const tx = buildPerpVenues([], CG, { volume24h: 0, openInterest: 0 }).find((x) => x.key === "txflow")!;
    expect(tx.volume24h).toBeNull();
    expect(tx.openInterest).toBeNull();
    expect(tx.change1d).toBeNull();
  });

  it("ranks by live volume, unreported venues last", () => {
    const v = buildPerpVenues([], CG, { volume24h: 0, openInterest: 0 });
    expect(v[0].key).toBe("hyperliquid");
    expect(v[v.length - 1].key).toBe("txflow");
  });

  it("prefers Hyperliquid's own API for Hyperliquid", () => {
    const hl = buildPerpVenues([], CG, { volume24h: 7.7e9, openInterest: 9.9e9 }).find((x) => x.key === "hyperliquid")!;
    expect(hl.volume24h).toBe(7.7e9);
    expect(hl.openInterest).toBe(9.9e9);
  });

  it("takes the 24h change from DefiLlama only, and only when it answered", () => {
    const llama = [{ slug: "txflow-perps", name: "TxFlow Perps", total24h: 150e6, openInterest: 31e6, change1d: 4.2, logo: "https://icons.llamao.fi/icons/protocols/txflow-perps" }];
    const v = buildPerpVenues(llama, CG, { volume24h: 0, openInterest: 0 });
    const tx = v.find((x) => x.key === "txflow")!;
    expect(tx.volume24h).toBe(150e6);
    expect(tx.change1d).toBe(4.2);
    expect(v.find((x) => x.key === "lighter")!.change1d).toBeNull();
  });
});

describe("coingeckoDerivativeRows", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("converts BTC-denominated volume and OI to USD", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.includes("simple/price")
            ? { bitcoin: { usd: 100_000 } }
            : url.endsWith("&page=1")
              ? [{ id: "risex", name: "RISEx", image: "https://x/risex.png", trade_volume_24h_btc: "630", open_interest_btc: 530 }]
              : [],
      }))
    );
    const rows = await coingeckoDerivativeRows(200);
    expect(rows).toEqual([{ id: "risex", name: "RISEx", key: "risex", logo: "https://x/risex.png", volume24h: 63e6, openInterest: 53e6 }]);
  });

  it("drops the whole source without a BTC price rather than emit BTC as USD", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: !url.includes("simple/price"),
        json: async () => [{ id: "risex", name: "RISEx", trade_volume_24h_btc: 630, open_interest_btc: 530 }],
      }))
    );
    expect(await coingeckoDerivativeRows(200)).toEqual([]);
  });
});
