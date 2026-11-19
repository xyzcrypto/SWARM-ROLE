import { describe, it, expect } from "vitest";
import {
  TOPICS,
  topicById,
  isRelevant,
  videoScore,
  withinWindow,
  rankYoutubeCreators,
  rankXCreators,
  xPostPoints,
  matchesQuery,
  compactCount,
  type YtVideo,
  type XPostRow,
} from "@modules/creators/lib/scoring";
import { fetchTopic, mergeTopics, parseDuration, YoutubeError } from "@modules/creators/lib/youtube";
import {
  parseTweetUrl,
  syndicationToken,
  normalizeTweet,
  mentionsVariational,
  fetchTweet,
  canonicalTweetUrl,
} from "@modules/creators/lib/x";

const NOW = Date.parse("2026-11-19T12:00:00Z");

function vid(over: Partial<YtVideo>): YtVideo {
  return {
    id: "v1",
    title: "t",
    description: "",
    publishedAt: "2026-11-10T00:00:00Z",
    thumbnail: "",
    channelId: "c1",
    channelTitle: "Chan",
    channelAvatar: null,
    channelSubs: 1000,
    views: 0,
    likes: 0,
    comments: 0,
    durationSec: 60,
    topics: ["variational"],
    ...over,
  };
}

function post(over: Partial<XPostRow>): XPostRow {
  return {
    id: "p1",
    tweetId: "1",
    url: "https://x.com/a/status/1",
    authorHandle: "alice",
    authorName: "Alice",
    authorAvatar: null,
    verified: false,
    text: "Variational",
    tweetCreatedAt: "2026-11-01T00:00:00Z",
    likes: 0,
    replies: 0,
    fetchedAt: "2026-11-01T00:00:00Z",
    ...over,
  };
}

describe("creators: relevance gate", () => {
  it("rejects the cigarette-lighter class of false positive", () => {
    const lighter = topicById("lighter")!;
    expect(isRelevant(lighter, "Best Zippo lighter review", "Refill guide")).toBe(false);
    expect(isRelevant(lighter, "Lighter perp DEX airdrop guide", "")).toBe(true);
  });

  it("needs Variational plus trading context, case-insensitive", () => {
    const v = topicById("variational")!;
    expect(isRelevant(v, "VARIATIONAL Omni explained", "")).toBe(true);
    expect(isRelevant(v, "Variational autoencoders in PyTorch", "machine learning")).toBe(false);
  });

  it("every topic has a query and at least one gate", () => {
    for (const t of TOPICS) {
      expect(t.query.length).toBeGreaterThan(2);
      expect(t.must.length).toBeGreaterThan(0);
    }
  });
});

describe("creators: scoring", () => {
  it("video score = views/100 + likes + 2 x comments; hidden counts score 0", () => {
    expect(videoScore({ views: 10_000, likes: 50, comments: 10 })).toBe(100 + 50 + 20);
    expect(videoScore({ views: 500, likes: null, comments: null })).toBe(5);
  });

  it("window filter is inclusive of the window and rejects junk dates", () => {
    expect(withinWindow("2026-11-13T12:00:00Z", "7d", NOW)).toBe(true);
    expect(withinWindow("2026-11-11T12:00:00Z", "7d", NOW)).toBe(false);
    expect(withinWindow("not a date", "90d", NOW)).toBe(false);
  });

  it("aggregates creators by channel and ranks by points", () => {
    const ranked = rankYoutubeCreators([
      vid({ id: "a", channelId: "c1", views: 10_000 }), // 100
      vid({ id: "b", channelId: "c1", views: 5_000, likes: 10 }), // 60
      vid({ id: "c", channelId: "c2", views: 100, likes: 120 }), // 121
    ]);
    expect(ranked.map((c) => c.channelId)).toEqual(["c1", "c2"]);
    expect(ranked[0]).toMatchObject({ videos: 2, views: 15_000, points: 160, best: { id: "a" } });
  });

  it("X points = likes + 2 x replies, creators merge case-insensitively", () => {
    expect(xPostPoints({ likes: 10, replies: 3 })).toBe(16);
    const ranked = rankXCreators([
      post({ id: "1", tweetId: "1", authorHandle: "Alice", likes: 10, replies: 1 }),
      post({ id: "2", tweetId: "2", authorHandle: "alice", likes: 5, replies: 0 }),
      post({ id: "3", tweetId: "3", authorHandle: "bob", likes: 13, replies: 0 }),
    ]);
    expect(ranked[0]).toMatchObject({ handle: "Alice", posts: 2, points: 17 });
    expect(ranked[1]).toMatchObject({ handle: "bob", points: 13 });
  });

  it("search and number formatting are deterministic", () => {
    expect(matchesQuery("", "x")).toBe(true);
    expect(matchesQuery("HYPE", "hyperliquid deep dive")).toBe(true);
    expect(matchesQuery("zzz", "a", null)).toBe(false);
    expect(compactCount(12_345)).toBe("12.3K");
    expect(compactCount(null)).toBe("-");
  });
});

// ---------------------------------------------------------------- YouTube client

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("creators: YouTube client", () => {
  it("parses ISO-8601 durations", () => {
    expect(parseDuration("PT1H2M3S")).toBe(3723);
    expect(parseDuration("PT45S")).toBe(45);
    expect(parseDuration("P1DT1S")).toBe(86401);
    expect(parseDuration("garbage")).toBe(0);
  });

  it("uses real statistics, drops irrelevant results, sends the key as a header", async () => {
    const calls: { url: string; key: string | null }[] = [];
    const f = async (url: string, init?: RequestInit) => {
      calls.push({ url, key: new Headers(init?.headers).get("X-Goog-Api-Key") });
      const u = new URL(url);
      if (u.pathname.endsWith("/search")) {
        return json({ items: [{ id: { videoId: "good" } }, { id: { videoId: "noise" } }] });
      }
      if (u.pathname.endsWith("/videos")) {
        return json({
          items: [
            {
              id: "good",
              snippet: { title: "Variational perp DEX deep dive", description: "RFQ explained", publishedAt: "2026-11-15T00:00:00Z", channelId: "UC1", channelTitle: "DeFi Dan", thumbnails: { medium: { url: "https://i.ytimg.com/vi/good/mqdefault.jpg" } } },
              statistics: { viewCount: "12000", likeCount: "340", commentCount: "25" },
              contentDetails: { duration: "PT12M" },
            },
            {
              id: "noise",
              snippet: { title: "Variational inference lecture", description: "Bayesian ML", publishedAt: "2026-11-15T00:00:00Z", channelId: "UC2", channelTitle: "Uni", thumbnails: {} },
              statistics: { viewCount: "99999" },
              contentDetails: { duration: "PT1H" },
            },
          ],
        });
      }
      if (u.pathname.endsWith("/channels")) {
        expect(u.searchParams.get("id")).toBe("UC1"); // the irrelevant channel is never looked up
        return json({ items: [{ id: "UC1", snippet: { thumbnails: { default: { url: "https://yt3/a.jpg" } } }, statistics: { subscriberCount: "4200" } }] });
      }
      throw new Error("unexpected " + url);
    };

    const out = await fetchTopic(topicById("variational")!, "k-123", NOW, f as any);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "good", views: 12000, likes: 340, comments: 25, channelSubs: 4200, durationSec: 720, channelAvatar: "https://yt3/a.jpg" });
    expect(calls.every((c) => c.key === "k-123")).toBe(true);
    expect(calls.some((c) => c.url.includes("k-123"))).toBe(false);
    expect(calls.filter((c) => c.url.includes("/search?")).map((c) => new URL(c.url).searchParams.get("order")).sort()).toEqual(["date", "viewCount"]);
  });

  it("surfaces a quota error with its reason (so the route can say so)", async () => {
    const f = async () => json({ error: { message: "quota", errors: [{ reason: "quotaExceeded" }] } }, 403);
    await expect(fetchTopic(topicById("hyperliquid")!, "k", NOW, f as any)).rejects.toMatchObject({ reason: "quotaExceeded", status: 403 });
    expect(new YoutubeError("x", 1, "y")).toBeInstanceOf(Error);
  });

  it("merges topics into one row per video, keeping every topic", () => {
    const merged = mergeTopics([[vid({ id: "a", topics: ["variational"] })], [vid({ id: "a", topics: ["perp-dex"] }), vid({ id: "b" })]]);
    expect(merged).toHaveLength(2);
    expect(merged.find((v) => v.id === "a")!.topics).toEqual(["variational", "perp-dex"]);
  });
});

// ---------------------------------------------------------------- X

const RAW_TWEET = {
  __typename: "Tweet",
  id_str: "1850000000000000000",
  text: "Just tried @variational_io Omni, RFQ fills are instant https://t.co/x",
  created_at: "2026-11-02T10:00:00.000Z",
  favorite_count: 420,
  conversation_count: 37,
  user: { screen_name: "perpqueen", name: "Perp Queen", profile_image_url_https: "https://pbs.twimg.com/a.jpg", is_blue_verified: true },
  entities: { urls: [{ expanded_url: "https://omni.variational.io/" }], user_mentions: [{ screen_name: "variational_io" }] },
};

describe("creators: X links and embed data", () => {
  it("parses x.com and twitter.com status links, rejects everything else", () => {
    expect(parseTweetUrl("https://x.com/perpqueen/status/1850000000000000000?s=20")).toEqual({ handle: "perpqueen", id: "1850000000000000000" });
    expect(parseTweetUrl("https://twitter.com/a_b/status/123456789/photo/1")).toEqual({ handle: "a_b", id: "123456789" });
    expect(parseTweetUrl("https://evil.com/a/status/123456789")).toBeNull();
    expect(parseTweetUrl("https://x.com.evil.com/a/status/123456789")).toBeNull();
    expect(parseTweetUrl("javascript:alert(1)")).toBeNull();
    expect(parseTweetUrl("https://x.com/perpqueen")).toBeNull();
    expect(canonicalTweetUrl("a", "1")).toBe("https://x.com/a/status/1");
  });

  it("derives a token without dots or zero runs", () => {
    const t = syndicationToken("1850000000000000000");
    expect(t).toMatch(/^[a-z1-9]+$/);
    expect(t.length).toBeGreaterThan(4);
  });

  it("normalizes the embed payload and prefers the long-post body", () => {
    const t = normalizeTweet(RAW_TWEET)!;
    expect(t).toMatchObject({ id: "1850000000000000000", likes: 420, replies: 37, handle: "perpqueen", verified: true });
    expect(normalizeTweet({ ...RAW_TWEET, note_tweet: { note_tweet_results: { result: { text: "LONG BODY" } } } })!.text).toBe("LONG BODY");
    expect(normalizeTweet({ __typename: "TweetTombstone" })).toBeNull();
    expect(normalizeTweet({ ...RAW_TWEET, favorite_count: -5 })!.likes).toBe(0);
  });

  it("only counts posts that are about Variational themselves", () => {
    expect(mentionsVariational({ text: "variational is cooking", links: [], mentions: [] })).toBe(true);
    expect(mentionsVariational({ text: "gm", links: [], mentions: ["variational_io"] })).toBe(true);
    expect(mentionsVariational({ text: "gm", links: ["https://omni.variational.io/x"], mentions: [] })).toBe(true);
    expect(mentionsVariational({ text: "gm", links: ["https://variational.io.evil.com"], mentions: [] })).toBe(false);
    expect(mentionsVariational({ text: "hyperliquid szn", links: [], mentions: ["hyperliquidx"] })).toBe(false);
  });

  it("fetchTweet maps 404, tombstones and network failure honestly", async () => {
    expect(await fetchTweet("1", (async () => new Response("", { status: 404 })) as any)).toEqual({ ok: false, reason: "not_found" });
    expect(await fetchTweet("1", (async () => json({ __typename: "TweetTombstone" })) as any)).toEqual({ ok: false, reason: "not_found" });
    expect(await fetchTweet("1", (async () => new Response("", { status: 500 })) as any)).toEqual({ ok: false, reason: "unavailable" });
    expect(await fetchTweet("1", (async () => { throw new Error("down"); }) as any)).toEqual({ ok: false, reason: "unavailable" });
    const okRes = await fetchTweet("1850000000000000000", (async (url: string) => {
      expect(url).toContain("cdn.syndication.twimg.com/tweet-result");
      expect(url).toContain("token=");
      return json(RAW_TWEET);
    }) as any);
    expect(okRes.ok && okRes.tweet.likes).toBe(420);
  });
});
