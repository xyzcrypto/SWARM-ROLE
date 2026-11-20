import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { marketBrief } from "@modules/markets/lib/market-brief";
import { newsBrief } from "@modules/news/lib/news-brief";
import { pointsBrief } from "@modules/points/lib/points-brief";
import { greetPage, greeting } from "@modules/academy/client/greet";
import { VOICE_LINES } from "@modules/academy/client/voice-lines";
import { money, pct } from "@modules/academy/client/page-brief";

const coin = (symbol: string, name: string, price: number, change24h: number, marketCap = 1e9) =>
  ({ id: name.toLowerCase(), rank: 1, name, symbol, image: null, price, change1h: 0, change24h, change7d: 0, marketCap, volume24h: 1e8 }) as never;

describe("AneQue market brief", () => {
  it("speaks the numbers on the page, live price first", () => {
    const b = marketBrief({
      coins: [coin("BTC", "Bitcoin", 100000, 1.2), coin("ETH", "Ethereum", 3000, -2.5)],
      global: { marketCap: 3.4e12, volume24h: 1e11, btcDominance: 57.3, ethDominance: 12, mcapChange24h: 0.8, fearGreed: { value: 71, label: "Greed" }, defiMcap: null, stableMcap: null, gasGwei: 3 },
      live: { BTC: { price: 101000, change24h: 2, at: 0 } },
    });
    expect(b.spoken[0]).toBe("Bitcoin is at $101,000, up 2.0 percent today. Ethereum is at $3,000, down 2.5 percent today.");
    expect(b.spoken.join(" ")).toMatch(/Fear and Greed index reads 71, which means greed/);
    expect(b.spoken.at(-1)).toMatch(/not financial advice/);
    expect(b.context).toMatch(/BTC \$101,000 \+2\.00%/);
  });
  it("ignores a live price for a different asset with the same ticker", () => {
    const b = marketBrief({ coins: [coin("BTC", "Bitcoin", 100000, 1)], live: { BTC: { price: 5, change24h: 0, at: 0 } } });
    expect(b.spoken[0]).toMatch(/\$100,000/);
  });
  it("says nothing (and asks to wait) before data arrives", () => {
    expect(marketBrief({}).spoken).toEqual([]);
  });
  it("formats money and percentages for speech", () => {
    expect(money(3.4e12)).toBe("$3.40 trillion");
    expect(money(0.2442)).toBe("$0.244");
    expect(pct(-0.04)).toBe("down 0.0 percent");
    expect(pct(12.3)).toBe("up 12 percent");
  });
});

describe("AneQue news and points briefs", () => {
  it("reads the most important recent stories first, with sources", () => {
    const now = 1_800_000_000_000;
    const item = (title: string, impact: string, ago: number) => ({ id: title, title, url: "", summary: "s", source: "CoinDesk", sourceIcon: null, image: null, publishedAt: now - ago, category: "x", categories: [], sentiment: "neutral", impact, tokens: [] }) as never;
    const b = newsBrief([item("Small", "Low", 1000), item("Big", "High", 5000), item("Mid", "Medium", 2000)], now);
    expect(b.spoken[0]).toBe("First, from CoinDesk: Big.");
    expect(b.spoken[1]).toMatch(/^Second, from CoinDesk: Mid/);
    expect(b.context).toMatch(/High impact/);
  });
  it("summarises programmes and never promises an airdrop", () => {
    const p = (name: string, vol: number) => ({ id: name, name, logo: null, phase: "Live", confirmed: true, rules: "trade to earn", rewardLogic: "", supportedMarkets: "", maxLeverage: "50x", fees: "", notes: "", chain: "Arbitrum", links: {}, scenario: {}, venue: { volume24h: vol, openInterest: 1, fdv: null } }) as never;
    const b = pointsBrief([p("Alpha", 2e8), p("Beta", 9e8)]);
    expect(b.spoken[0]).toBe("I'm tracking 2 points programs, and 2 are live right now.");
    expect(b.spoken[1]).toMatch(/busiest today are Beta/);
    expect(b.spoken.join(" ")).toMatch(/never guaranteed/);
    expect(pointsBrief([]).spoken).toEqual([]);
  });
});

describe("AneQue on Markets, News and Points", () => {
  it("is mounted lazily on each page and greets there", () => {
    for (const p of ["src/app/markets/page.tsx", "src/app/news/page.tsx", "src/app/points/page.tsx"]) {
      expect(readFileSync(p, "utf8"), p).toMatch(/<AneQueDockLazy \/>/);
    }
    expect(readFileSync("src/modules/academy/components/AneQueDockLazy.tsx", "utf8")).toMatch(/ssr: false/);
    expect(greetPage("/markets")).toBe("markets");
    expect(greeting({ name: "Riya", signedIn: true, page: "news", hour: 9, first: false }).map((x) => x.text)).toEqual(["Hey Riya!", VOICE_LINES.greet_news]);
  });
  it("sends the page's live data with Live Talk and the prompt forbids inventing numbers", () => {
    expect(readFileSync("src/modules/academy/client/talk.ts", "utf8")).toMatch(/pageData: brief \? safeContext\(brief\)/);
    const prompt = readFileSync("src/modules/academy/lib/aneque.ts", "utf8");
    expect(prompt).toMatch(/never invent numbers/);
    expect(readFileSync("src/app/api/academy/aneque/chat/route.ts", "utf8")).toMatch(/pageData: z\.string\(\)\.max\(3200\)/);
  });
});
