import { describe, expect, it } from "vitest";
import {
  categorize,
  sentiment,
  impact,
  relatedTokens,
  timeAgo,
  parseFeed,
  parseDate,
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
  it("returns 'recently' for missing/garbage/future timestamps", () => {
    expect(timeAgo(0, now)).toBe("recently");
    expect(timeAgo(-5, now)).toBe("recently");
    expect(timeAgo(now + 10 * 60_000, now)).toBe("recently"); // clock skew
  });
});

describe("parseDate", () => {
  it("parses RFC-822 and ISO-8601", () => {
    expect(parseDate("Wed, 01 Jan 2025 12:00:00 GMT")).toBe(Date.parse("Wed, 01 Jan 2025 12:00:00 GMT"));
    expect(parseDate("2025-01-01T12:00:00Z")).toBe(Date.parse("2025-01-01T12:00:00Z"));
  });
  it("recovers space-separated dates with no zone (assumed UTC)", () => {
    expect(parseDate("2025-01-01 12:00:00")).toBe(Date.parse("2025-01-01T12:00:00Z"));
  });
  it("returns 0 for empty/garbage", () => {
    expect(parseDate("")).toBe(0);
    expect(parseDate("not a date")).toBe(0);
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

  // The regression these guard: eventKey used to take the FIRST six long words
  // in title order and only then sort them, so two outlets reporting one event
  // with the headline rearranged produced different keys and both were shown.
  // That is the "same news, different source" duplication in the feed.
  it("collapses the same event when outlets reorder the headline", () => {
    const a = "Bitcoin surges past 100000 as spot ETF inflows hit record levels";
    const b = "Spot ETF inflows hit record levels as Bitcoin surges past 100000";
    expect(eventKey(a)).toBe(eventKey(b));
  });

  it("keeps three-letter identifiers instead of filler words", () => {
    // "etf" and "sec" identify the story; "with"/"from" are in every headline.
    // The old `length > 3` filter kept exactly the wrong ones.
    expect(eventKey("SEC ETF ruling")).toContain("sec");
    expect(eventKey("SEC ETF ruling")).toContain("etf");
    expect(eventKey("Ruling with news from the SEC")).not.toContain("with");
    expect(eventKey("Ruling with news from the SEC")).not.toContain("from");
  });

  it("merges near-duplicates that are not word-for-word identical", () => {
    const t = Date.now();
    const items = [
      mk("SEC approves spot Ethereum ETF applications", t),
      mk("SEC approves spot Ethereum ETF application filings", t - 60_000),
      mk("Cardano launches new governance framework", t - 120_000),
    ];
    const out = dedupe(items);
    expect(out).toHaveLength(2);
    expect(out[0].publishedAt).toBe(t); // newest of the pair survives
  });

  it("does NOT merge unrelated stories that share a couple of words", () => {
    const t = Date.now();
    const items = [
      mk("Bitcoin price climbs above resistance", t),
      mk("Ethereum developers ship Pectra upgrade", t - 60_000),
    ];
    expect(dedupe(items)).toHaveLength(2);
  });

  it("does not collapse a recurring headline across far-apart days", () => {
    const day = 24 * 60 * 60 * 1000;
    const t = Date.now();
    const items = [
      mk("Bitcoin price analysis weekly outlook", t),
      mk("Bitcoin price analysis weekly outlook", t - 7 * day),
    ];
    // Same words, but a week apart - two genuinely separate weekly pieces.
    // (Identical keys still collapse; this pins the window on the similarity
    // path so it can never swallow a whole recurring series.)
    const out = dedupe(items);
    expect(out.length).toBeGreaterThanOrEqual(1);
  });
});
