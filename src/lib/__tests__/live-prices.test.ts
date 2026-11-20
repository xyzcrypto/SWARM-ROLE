import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

// Fake browser globals for the socket manager.
class FakeWS {
  static last: FakeWS | null = null;
  static count = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeWS.last = this;
    FakeWS.count++;
  }
  send(s: string) {
    this.sent.push(s);
  }
  close() {
    this.onclose?.();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeWS.last = null;
  FakeWS.count = 0;
  (globalThis as unknown as { window: unknown }).window = globalThis;
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWS;
  (globalThis as unknown as { document: unknown }).document = { hidden: false, addEventListener() {} };
});
afterEach(() => {
  vi.useRealTimers();
});

describe("live prices manager", async () => {
  const mod = await import("@modules/markets/lib/live-prices");
  const { __live, liveBases, overlayLive } = mod;

  it("subscribes only to what is shown, skipping stablecoins and duplicates", () => {
    expect(liveBases(["btc", "ETH", "USDT", "usdc", "BTC", "wbtc", "SOL"])).toEqual(["BTC", "ETH", "SOL"]);
  });

  it("opens one market-data socket, SUBSCRIBEs, and batches frames into one update", () => {
    __live.reset();
    __live.add(["BTC", "ETH"]);
    const ws = FakeWS.last!;
    expect(ws.url).toBe("wss://data-stream.binance.vision/ws");
    ws.onopen!();
    expect(JSON.parse(ws.sent[0])).toMatchObject({ method: "SUBSCRIBE", params: ["btcusdt@miniTicker", "ethusdt@miniTicker"] });
    ws.onmessage!({ data: JSON.stringify({ e: "24hrMiniTicker", s: "BTCUSDT", c: "110", o: "100" }) });
    ws.onmessage!({ data: JSON.stringify({ e: "24hrMiniTicker", s: "ETHUSDT", c: "3000", o: "3000" }) });
    expect(__live.snapshot().BTC).toBeUndefined(); // not yet: batched
    vi.advanceTimersByTime(1300);
    expect(__live.snapshot().BTC).toMatchObject({ price: 110, change24h: 10 });
    expect(__live.snapshot().ETH).toMatchObject({ price: 3000, change24h: 0 });
    // a second component sharing BTC does not open a second socket
    __live.add(["BTC", "SOL"]);
    expect(FakeWS.count).toBe(1);
    expect(JSON.parse(ws.sent[1]).params).toEqual(["solusdt@miniTicker"]);
  });

  it("unsubscribes when the last viewer leaves and closes when nobody is left", () => {
    __live.reset();
    __live.add(["BTC"]);
    const ws = FakeWS.last!;
    ws.onopen!();
    __live.remove(["BTC"]);
    expect(JSON.parse(ws.sent.at(-1)!)).toMatchObject({ method: "UNSUBSCRIBE", params: ["btcusdt@miniTicker"] });
    expect(__live.connected()).toBe(false);
  });

  it("gives up after repeated failed connects and stays on polled data", () => {
    __live.reset();
    __live.add(["BTC"]);
    for (let i = 0; i < 10; i++) {
      FakeWS.last!.onclose!(); // never opened = a failed connect
      vi.advanceTimersByTime(60_000);
    }
    expect(FakeWS.count).toBeLessThanOrEqual(5);
  });

  it("ignores a live price that disagrees wildly with the polled one (same ticker, different asset)", () => {
    const row = { symbol: "abc", price: 1, change24h: 2 };
    expect(overlayLive(row, { ABC: { price: 1.05, change24h: 5, at: 0 } })).toMatchObject({ price: 1.05, change24h: 5 });
    expect(overlayLive(row, { ABC: { price: 9, change24h: 5, at: 0 } })).toBe(row);
    expect(overlayLive(row, {})).toBe(row);
  });

  it("is allowed by the CSP, and the heatmap no longer claims a feed it does not have", () => {
    expect(readFileSync("next.config.mjs", "utf8")).toMatch(/connect-src[^"]*wss:\/\/data-stream\.binance\.vision/);
    const h = readFileSync("src/modules/markets/components/MarketHeatmap.tsx", "utf8");
    expect(h).toMatch(/useLivePrices\(liveSymbols\)/);
    expect(h).not.toMatch(/Binance WebSocket Feed<\/span>/);
  });
});
