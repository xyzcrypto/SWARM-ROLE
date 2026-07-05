import { describe, expect, it } from "vitest";
import {
  categorize,
  sentiment,
  impact,
  relatedTokens,
  timeAgo,
  parseFeed,
  eventKey,
  dedupe,
  type NewsItem,
} from "@/lib/news";

describe("categorize", () => {
  it("flags Breaking first when present", () => {
    const { primary, all } = categorize("BREAKING: Bitcoin ETF approved");
    expect(primary).toBe("Breaking News");
    expect(all).toContain("Bitcoin");
  });
  it("maps hacks / regulations / bitcoin", () => {
    expect(categorize("Protocol exploited for $50M").primary).toBe("Hacks");
    expect(categorize("SEC sues exchange over securities").primary).toBe("Regulations");
    expect(categorize("Bitcoin hits new all-time high").primary).toBe("Bitcoin");
  });
  it("falls back to Market News", () => {
    expect(categorize("Some vague market update").all).toEqual(["Market News"]);
  });
});

describe("sentiment", () => {
  it("detects bullish/bearish/neutral", () => {
    expect(sentiment("ETH surges to new highs")).toBe("bullish");
    expect(sentiment("Token crashes after exploit")).toBe("bearish");
    expect(sentiment("Company announces conference")).toBe("neutral");
  });
});

describe("impact", () => {
  it("grades by keywords", () => {
    expect(impact("Major exchange hacked")).toBe("High");
    expect(impact("New partnership announced")).toBe("Medium");
    expect(impact("Weekly recap of prices")).toBe("Low");
  });
});

describe("relatedTokens", () => {
  it("extracts token symbols", () => {
    expect(relatedTokens("Ethereum and Solana rally, Bitcoin steady")).toEqual(["BTC", "ETH", "SOL"]);
    expect(relatedTokens("nothing here")).toEqual([]);
  });
});

describe("timeAgo", () => {
  const now = 1_000_000_000_000;
  it("formats relative time", () => {
    expect(timeAgo(now, now)).toBe("just now");
    expect(timeAgo(now - 3 * 60_000, now)).toBe("3 min ago");
    expect(timeAgo(now - 2 * 3_600_000, now)).toBe("2 h ago");
    expect(timeAgo(now - 4 * 86_400_000, now)).toBe("4 d ago");
  });
});

describe("parseFeed", () => {
  it("parses an RSS 2.0 item with CDATA + media", () => {
    const xml = `<rss><channel>
      <item>
        <title><![CDATA[Bitcoin jumps 5%]]></title>
        <link>https://example.com/a</link>
        <description><![CDATA[<p>BTC &amp; ETH up today</p>]]></description>
        <pubDate>Wed, 01 Jan 2025 12:00:00 GMT</pubDate>
        <enclosure url="https://img.example.com/x.jpg" type="image/jpeg"/>
      </item>
    </channel></rss>`;
    const items = parseFeed(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Bitcoin jumps 5%");
    expect(items[0].url).toBe("https://example.com/a");
    expect(items[0].summary).toContain("BTC & ETH up today");
    expect(items[0].image).toBe("https://img.example.com/x.jpg");
    expect(items[0].publishedAt).toBe(Date.parse("Wed, 01 Jan 2025 12:00:00 GMT"));
  });
  it("parses an Atom entry", () => {
    const xml = `<feed><entry>
      <title>Ethereum upgrade ships</title>
      <link href="https://example.com/e"/>
      <summary>Dencun is live</summary>
      <published>2025-02-01T00:00:00Z</published>
    </entry></feed>`;
    const items = parseFeed(xml);
    expect(items[0].url).toBe("https://example.com/e");
    expect(items[0].title).toBe("Ethereum upgrade ships");
  });
  it("returns [] for junk", () => {
    expect(parseFeed("")).toEqual([]);
    expect(parseFeed("<html>no items</html>")).toEqual([]);
  });
});

describe("dedupe", () => {
  const mk = (title: string, publishedAt: number): NewsItem => ({
    id: title, title, url: title, summary: "", source: "s", sourceIcon: null, image: null,
    publishedAt, category: "Market News", categories: ["Market News"], sentiment: "neutral", impact: "Low", tokens: [],
  });
  it("groups the same event across outlets, keeps newest", () => {
    const items = [
      mk("Bitcoin ETF approved by regulators today", 1000),
      mk("ETF for Bitcoin approved by regulators today", 2000),
      mk("Solana network outage reported", 1500),
    ];
    const out = dedupe(items);
    expect(out).toHaveLength(2); // two BTC-ETF reports collapse to one
    expect(out[0].publishedAt).toBe(2000);
  });
  it("eventKey normalizes to significant words", () => {
    expect(eventKey("Bitcoin ETF Approved!!")).toBe(eventKey("approved bitcoin etf"));
  });
});
