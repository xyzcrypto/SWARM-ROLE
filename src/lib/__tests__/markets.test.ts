import { describe, expect, it } from "vitest";
import { compactUsd, pct, fngLabel, topByTvl, topBy, apyFmt, toGwei, coinPrice, sortCoins, defaultDirFor, protocolSlug, type CoinRow } from "@/lib/markets";

describe("compactUsd", () => {
  it("formats trillions/billions/millions/thousands", () => {
    expect(compactUsd(2_350_000_000_000)).toBe("$2.35T");
    expect(compactUsd(92_000_000_000)).toBe("$92.00B");
    expect(compactUsd(12_300_000)).toBe("$12.30M");
    expect(compactUsd(4_500)).toBe("$4.5K");
    expect(compactUsd(999)).toBe("$999");
  });
  it("returns - for bad input", () => {
    expect(compactUsd(null)).toBe("-");
    expect(compactUsd(undefined)).toBe("-");
    expect(compactUsd(NaN)).toBe("-");
  });
});

describe("pct", () => {
  it("adds a sign", () => {
    expect(pct(2.345)).toBe("+2.35%");
    expect(pct(-1.1)).toBe("-1.10%");
    expect(pct(0)).toBe("+0.00%");
  });
  it("honours digits + guards bad input", () => {
    expect(pct(3.14159, 1)).toBe("+3.1%");
    expect(pct(null)).toBe("-");
  });
});

describe("fngLabel", () => {
  it("maps the standard Fear & Greed bands", () => {
    expect(fngLabel(10)).toEqual({ label: "Extreme Fear", tone: "red" });
    expect(fngLabel(30)).toEqual({ label: "Fear", tone: "red" });
    expect(fngLabel(50)).toEqual({ label: "Neutral", tone: "amber" });
    expect(fngLabel(65)).toEqual({ label: "Greed", tone: "mint" });
    expect(fngLabel(90)).toEqual({ label: "Extreme Greed", tone: "mint" });
  });
  it("defaults to Neutral for bad input", () => {
    expect(fngLabel(NaN).label).toBe("Neutral");
  });
});

describe("topByTvl", () => {
  it("sorts desc and slices to N", () => {
    const list = [{ tvl: 5 }, { tvl: 100 }, { tvl: 20 }, { tvl: 1 }];
    expect(topByTvl(list, 2).map((x) => x.tvl)).toEqual([100, 20]);
  });
  it("drops non-finite tvl and tolerates non-arrays", () => {
    const list = [{ tvl: 5 }, { tvl: NaN }, { tvl: 9 }] as { tvl: number }[];
    expect(topByTvl(list, 5).map((x) => x.tvl)).toEqual([9, 5]);
    expect(topByTvl(null, 3)).toEqual([]);
    expect(topByTvl(undefined, 3)).toEqual([]);
  });
});

describe("topBy", () => {
  it("sorts desc by a key and slices", () => {
    const rows = [{ v: 3 }, { v: 10 }, { v: 1 }];
    expect(topBy(rows, (r) => r.v, 2).map((r) => r.v)).toEqual([10, 3]);
  });
  it("skips non-finite + tolerates non-array", () => {
    const rows = [{ v: 5 }, { v: NaN }, { v: 8 }];
    expect(topBy(rows, (r) => r.v, 5).map((r) => r.v)).toEqual([8, 5]);
    expect(topBy(null, (r: any) => r.v, 3)).toEqual([]);
  });
});

describe("apyFmt", () => {
  it("formats percent", () => {
    expect(apyFmt(12.345)).toBe("12.35%");
    expect(apyFmt(null)).toBe("-");
    expect(apyFmt(NaN)).toBe("-");
  });
});

describe("coinPrice", () => {
  it("scales precision by magnitude", () => {
    expect(coinPrice(68420)).toBe("$68,420");
    expect(coinPrice(3.54)).toBe("$3.54");
    expect(coinPrice(0.062)).toBe("$0.0620");
    expect(coinPrice(0.0000123)).toBe("$0.000012");
    expect(coinPrice(null)).toBe("-");
  });
});

describe("toGwei", () => {
  it("converts hex or number wei to gwei", () => {
    expect(toGwei(0x59682f00)).toBe("1.5 gwei"); // 1.5e9 wei
    expect(toGwei(23_400_000_000)).toBe("23.4 gwei");
    expect(toGwei(null)).toBe("-");
    expect(toGwei("0x")).toBe("-");
  });
});

describe("sortCoins", () => {
  const mk = (rank: number, name: string, price: number, change24h: number): CoinRow => ({
    id: name.toLowerCase(), rank, name, symbol: name.slice(0, 3).toUpperCase(), image: null, price,
    change1h: 0, change24h, change7d: 0, marketCap: 1000 - rank, volume24h: price * 10, ath: price * 2, athChange: -50, sparkline: [],
  });
  const rows = [mk(1, "Bitcoin", 67000, 2.1), mk(2, "Ethereum", 3400, -0.4), mk(3, "Solana", 150, 8.2)];

  it("sorts numeric columns asc/desc without mutating input", () => {
    const byPriceDesc = sortCoins(rows, "price", "desc");
    expect(byPriceDesc.map((r) => r.symbol)).toEqual(["BIT", "ETH", "SOL"]);
    const byChangeDesc = sortCoins(rows, "change24h", "desc");
    expect(byChangeDesc[0].symbol).toBe("SOL");
    expect(rows[0].symbol).toBe("BIT"); // original untouched
  });
  it("sorts name alphabetically", () => {
    expect(sortCoins(rows, "name", "asc").map((r) => r.name)).toEqual(["Bitcoin", "Ethereum", "Solana"]);
    expect(sortCoins(rows, "name", "desc").map((r) => r.name)).toEqual(["Solana", "Ethereum", "Bitcoin"]);
  });
  it("rank asc is the default market-cap order", () => {
    expect(sortCoins(rows, "rank", "asc").map((r) => r.rank)).toEqual([1, 2, 3]);
  });
});

describe("defaultDirFor", () => {
  it("ascends rank/name, descends value columns", () => {
    expect(defaultDirFor("rank")).toBe("asc");
    expect(defaultDirFor("name")).toBe("asc");
    expect(defaultDirFor("price")).toBe("desc");
    expect(defaultDirFor("marketCap")).toBe("desc");
  });
});

describe("protocolSlug", () => {
  it("prefers the API slug (lowercased)", () => {
    expect(protocolSlug("Hyperliquid", "Hyperliquid Perps")).toBe("hyperliquid");
  });
  it("derives a slug from the name when no API slug", () => {
    expect(protocolSlug(null, "dYdX v4")).toBe("dydx-v4");
    expect(protocolSlug("", "Uniswap  Labs!")).toBe("uniswap-labs");
    expect(protocolSlug(undefined, "  Jupiter ")).toBe("jupiter");
  });
});
