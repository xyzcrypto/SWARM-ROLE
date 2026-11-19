import { describe, it, expect } from "vitest";
import {
  TOPICS,
  topicById,
  isRelevant,
  videoScore,
  withinWindow,
  rankYoutubeCreators,
  creatorScore,
  topicsFor,
  matchesQuery,
  compactCount,
  engagementRate,
  isShort,
  viewsPerDay,
  type YtVideo,
} from "@modules/creators/lib/scoring";
import { fetchTopic, fetchStats, withStats, mergeTopics, classify, parseDuration, YoutubeError } from "@modules/creators/lib/youtube";
import {
  normalizeTweet,
  normalizeUser,
  isVariationalPost,
  isEntropyPost,
  venuesFor,
  VENUES,
  isOfficialHandle,
  validHandle,
  handleQuery,
  searchPage,
  tweetsById,
  TwitterApiError,
} from "@modules/creators/lib/twitterapi";
import {
  postPoints,
  levelFor,
  levelProgress,
  xyzScore,
  weeklyStreak,
  activeWeeksIn,
  activeWeeksSince,
  badgesFor,
  LEVELS,
} from "@modules/creators/lib/game";

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
  it("video score = views/100 x (1 + depth) + likes + 2 x comments; hidden counts score 0", () => {
    // A Short gets (almost) no watch-time credit, a 20-min video doubles view credit.
    expect(videoScore({ views: 10_000, likes: 50, comments: 10, durationSec: 0 })).toBe(100 + 50 + 20);
    expect(videoScore({ views: 10_000, likes: 50, comments: 10, durationSec: 1200 })).toBe(200 + 50 + 20);
    expect(videoScore({ views: 10_000, likes: 50, comments: 10, durationSec: 3600 })).toBe(200 + 50 + 20); // capped
    expect(videoScore({ views: 10_000, likes: 0, comments: 0, durationSec: 600 })).toBe(150);
    expect(videoScore({ views: 500, likes: null, comments: null, durationSec: 0 })).toBe(5);
  });

  it("window filter is inclusive of the window and rejects junk dates", () => {
    expect(withinWindow("2026-11-13T12:00:00Z", "7d", NOW)).toBe(true);
    expect(withinWindow("2026-11-11T12:00:00Z", "7d", NOW)).toBe(false);
    expect(withinWindow("not a date", "90d", NOW)).toBe(false);
    expect(withinWindow("2009-01-01T00:00:00Z", "all", NOW)).toBe(true);
    expect(withinWindow("2025-12-01T00:00:00Z", "1y", NOW)).toBe(true);
    expect(withinWindow("2025-11-01T00:00:00Z", "1y", NOW)).toBe(false);
  });

  it("aggregates creators by channel and ranks by points", () => {
    const ranked = rankYoutubeCreators([
      vid({ id: "a", channelId: "c1", views: 10_000 }), // 100
      vid({ id: "b", channelId: "c1", views: 5_000, likes: 10 }), // 60
      vid({ id: "c", channelId: "c2", views: 100, likes: 120 }), // 121
    ]);
    expect(ranked.map((c) => c.channelId)).toEqual(["c1", "c2"]);
    // 60s videos: depth 0.05. a = round(100*1.05) = 105, b = round(50*1.05 + 10) = 63,
    // plus 25 per video for output.
    expect(ranked[0]).toMatchObject({ videos: 2, views: 15_000, points: 105 + 63 + 50, durationSec: 120, best: { id: "a" } });
    expect(ranked[1]!.points).toBe(121 + 25);
    expect(ranked[0]!.score.total).toBeGreaterThan(0);
  });

  it("search and number formatting are deterministic", () => {
    expect(matchesQuery("", "x")).toBe(true);
    expect(matchesQuery("HYPE", "hyperliquid deep dive")).toBe(true);
    expect(matchesQuery("zzz", "a", null)).toBe(false);
    expect(compactCount(12_345)).toBe("12.3K");
    expect(compactCount(null)).toBe("-");
    expect(engagementRate({ views: 1000, likes: 40, comments: 10 })).toBeCloseTo(0.05);
    expect(engagementRate({ views: 50, likes: 40, comments: 10 })).toBeNull();
    expect(isShort({ durationSec: 59 })).toBe(true);
    expect(isShort({ durationSec: 600 })).toBe(false);
    expect(isShort({ durationSec: 0 })).toBe(false);
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

    const raw = await fetchTopic(topicById("variational")!, "k-123", NOW, f as any);
    // Discovery keeps every hit (relevance is applied at read time)...
    expect(raw.map((v) => v.id).sort()).toEqual(["good", "noise"]);
    // ...and classify() drops the ML lecture and tags the real one.
    const out = classify([raw]);
    expect(out).toHaveLength(1);
    expect(out[0]!.topics).toEqual(["variational", "perp-dex"]); // its title names both
    expect(out[0]).toMatchObject({ id: "good", views: 12000, likes: 340, comments: 25, channelSubs: 4200, durationSec: 720, channelAvatar: "https://yt3/a.jpg" });
    expect(calls.every((c) => c.key === "k-123")).toBe(true);
    expect(calls.some((c) => c.url.includes("k-123"))).toBe(false);
    const searches = calls.filter((c) => c.url.includes("/search?")).map((c) => new URL(c.url).searchParams);
    // all-time most viewed + 90-day most viewed + 90-day newest
    expect(searches.map((p) => `${p.get("order")}:${p.has("publishedAfter")}`).sort()).toEqual(["date:true", "viewCount:false", "viewCount:false", "viewCount:false", "viewCount:true"]);
    // Variational's extra phrases are searched too.
    expect(searches.map((p) => p.get("q"))).toEqual(expect.arrayContaining(["Variational Omni", "Variational airdrop"]));
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

// ---------------------------------------------------------------- X (twitterapi.io)

const RAW = {
  type: "tweet",
  id: "1850000000000000000",
  text: "Variational Omni RFQ fills are instant. @variational_io",
  createdAt: "Sat Nov 02 10:00:00 +0000 2026",
  viewCount: 12000,
  likeCount: 420,
  replyCount: 37,
  retweetCount: 20,
  quoteCount: 5,
  bookmarkCount: 9,
  isReply: false,
  author: { userName: "perpqueen", name: "Perp Queen", profilePicture: "https://pbs.twimg.com/a_normal.jpg", isBlueVerified: true, followers: 15400, id: "77" },
};

describe("creators: twitterapi.io parsing", () => {
  it("normalizes a post with every count and a larger avatar", () => {
    const t = normalizeTweet(RAW)!;
    expect(t).toMatchObject({ id: "1850000000000000000", views: 12000, likes: 420, replies: 37, reposts: 20, quotes: 5, bookmarks: 9, isRetweet: false });
    expect(t.createdAt).toBe("2026-11-02T10:00:00.000Z");
    expect(t.url).toBe("https://x.com/perpqueen/status/1850000000000000000");
    expect(t.author).toMatchObject({ handle: "perpqueen", followers: 15400, verified: true, avatar: "https://pbs.twimg.com/a_200x200.jpg" });
  });

  it("drops posts it cannot read cleanly instead of storing half of them", () => {
    expect(normalizeTweet({ ...RAW, author: null })).toBeNull();
    expect(normalizeTweet({ ...RAW, createdAt: "nope" })).toBeNull();
    expect(normalizeTweet({ ...RAW, likeCount: -3 })!.likes).toBe(0);
    expect(normalizeTweet({ ...RAW, text: "RT @x: Variational" })!.isRetweet).toBe(true);
    expect(normalizeUser({ name: "no handle" })).toBeNull();
  });

  it("tells the exchange apart from the maths word", () => {
    expect(isVariationalPost("Variational is cooking, farming points daily")).toBe(true);
    expect(isVariationalPost("gm to everyone at @variational_io")).toBe(true);
    expect(isVariationalPost("variational is the best perp venue")).toBe(true);
    expect(isVariationalPost("Variational autoencoders explained")).toBe(false);
    expect(isVariationalPost("A variational inference primer for Bayesian models")).toBe(false);
    expect(isVariationalPost("hyperliquid szn")).toBe(false);
  });

  it("validates handles from @names and profile links", () => {
    expect(validHandle("@perpqueen")).toBe("perpqueen");
    expect(validHandle("https://x.com/Perp_Queen/status/1")).toBe("Perp_Queen");
    expect(validHandle("bad handle!")).toBeNull();
    expect(validHandle("a".repeat(16))).toBeNull();
    expect(handleQuery("abc")).toContain("from:abc");
    expect(isOfficialHandle("variational_io")).toBe(true);
    expect(isOfficialHandle("perpqueen")).toBe(false);
  });

  it("searchPage sends the key as a header and follows the cursor contract", async () => {
    let seen: { url: string; key: string | null } | null = null;
    const f = async (url: string, init?: RequestInit) => {
      seen = { url, key: new Headers(init?.headers).get("X-API-Key") };
      return json({ tweets: [RAW, { junk: true }], has_next_page: true, next_cursor: "C2" });
    };
    const page = await searchPage("q", "Latest", "C1", "secret", f as any);
    expect(page.tweets).toHaveLength(1);
    expect(page.raw).toBe(2);
    expect(page.nextCursor).toBe("C2");
    expect(seen!.key).toBe("secret");
    expect(seen!.url).not.toContain("secret");
    expect(new URL(seen!.url).searchParams.get("cursor")).toBe("C1");
    const last = await searchPage("q", "Latest", null, "k", (async () => json({ tweets: [], has_next_page: false })) as any);
    expect(last.nextCursor).toBeNull();
  });

  it("surfaces API errors and skips the call for no ids", async () => {
    await expect(searchPage("q", "Top", null, "k", (async () => json({ status: "error", msg: "bad key" }, 401)) as any)).rejects.toBeInstanceOf(TwitterApiError);
    let called = false;
    expect(await tweetsById([], "k", (async () => ((called = true), json({}))) as any)).toEqual([]);
    expect(called).toBe(false);
  });
});

describe("creators: game layer", () => {
  const c = { views: 10_000, likes: 100, replies: 10, reposts: 5, quotes: 2, bookmarks: 4 };

  it("points are linear, so summed counts give summed points", () => {
    expect(postPoints(c)).toBe(1000 + 100 + 20 + 15 + 8 + 8);
    const twice = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v * 2])) as typeof c;
    expect(postPoints(twice)).toBe(postPoints(c) * 2);
  });

  it("levels cover every value with no gaps", () => {
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i]!.min).toBe(LEVELS[i - 1]!.max! + 1);
    expect(levelFor(0).n).toBe(1);
    expect(levelFor(24_999).n).toBe(7);
    expect(levelFor(25_000).n).toBe(8);
    const p = levelProgress(750);
    expect(p.level.name).toBe("Scout");
    expect(p.toNext).toBe(750);
    expect(p.pct).toBeCloseTo(0.25);
    expect(levelProgress(99_999)).toMatchObject({ next: null, pct: 1, toNext: 0 });
  });

  it("XYZ Score stays in 0-1000 and rewards each part", () => {
    expect(xyzScore({ followers: 0, posts: 0, views: 0, engagements: 0, activeWeeks: 0 }).total).toBe(0);
    const max = xyzScore({ followers: 5_000_000, posts: 10, views: 5_000_000, engagements: 500_000, activeWeeks: 12 });
    expect(max.total).toBe(1000);
    const mid = xyzScore({ followers: 1000, posts: 10, views: 20_000, engagements: 500, activeWeeks: 6 });
    expect(mid.consistency).toBe(125);
    expect(mid.resonance).toBe(125); // 2.5% of a 5% target
    expect(mid.total).toBeGreaterThan(0);
    expect(mid.total).toBeLessThan(1000);
    // Under 100 views, resonance is too noisy to count.
    expect(xyzScore({ followers: 10, posts: 1, views: 50, engagements: 50, activeWeeks: 1 }).resonance).toBe(0);
  });

  it("weekly streak tolerates a quiet current week but breaks on a gap", () => {
    const now = Date.parse("2026-11-19T12:00:00Z"); // Thursday
    const d = (s: string) => `${s}T12:00:00Z`;
    expect(weeklyStreak([d("2026-11-17"), d("2026-11-10"), d("2026-11-03")], now)).toBe(3);
    expect(weeklyStreak([d("2026-11-11"), d("2026-11-04")], now)).toBe(2); // nothing yet this week
    expect(weeklyStreak([d("2026-11-17"), d("2026-10-27")], now)).toBe(1);
    expect(weeklyStreak([], now)).toBe(0);
    expect(activeWeeksIn([d("2026-11-17"), d("2026-11-18"), d("2026-11-03"), d("2025-01-01")], now)).toBe(2);
  });

  it("badges unlock from real thresholds", () => {
    const b = badgesFor({ posts: 12, points: 0, views: 1_200_000, bestPostViews: 60_000, replies: 10, quotes: 0, streak: 4, rank: 7, score: 300 });
    const earned = b.filter((x) => x.earned).map((x) => x.id);
    expect(earned).toEqual(["first", "regular", "viral", "reach", "streak", "top10"]);
  });
});

describe("creators: venues (Variational + Entropy)", () => {
  it("recognises Entropy the venue, not the physics word or Pyth's RNG", () => {
    expect(isEntropyPost("Trading Anthropic pre-IPO perps on @EntropyIO")).toBe(true);
    expect(isEntropyPost("entropy.io just listed SNDK")).toBe(true);
    expect(isEntropyPost("Entropy on Hyperliquid HIP-3 is doing real volume")).toBe(true);
    expect(isEntropyPost("The entropy of a closed system never decreases")).toBe(false);
    expect(isEntropyPost("Pyth Entropy gives you on-chain randomness for perps games")).toBe(false);
    expect(isEntropyPost("password entropy matters")).toBe(false);
  });

  it("the X board is Variational only", () => {
    expect(VENUES.map((v) => v.id)).toEqual(["variational"]);
    expect(venuesFor("Variational RFQ vs @EntropyIO pre-IPO perps")).toEqual(["variational"]);
    expect(venuesFor("@EntropyIO pre-IPO perps")).toEqual([]);
    expect(venuesFor("gm, farming Variational points")).toEqual(["variational"]);
    expect(venuesFor("gm")).toEqual([]);
  });

  it("one handle scan searches every venue, and official accounts are not ranked", () => {
    const q = handleQuery("perpqueen");
    for (const v of VENUES) expect(q).toContain(v.match);
    expect(q).toContain("-filter:retweets");
    expect(isOfficialHandle("variational_io")).toBe(true);
    expect(isOfficialHandle("entropy_maxi")).toBe(false);
  });

  it("YouTube Entropy topic needs Entropy's own context", () => {
    const t = topicById("entropy")!;
    expect(isRelevant(t, "Entropy on Hyperliquid: pre-IPO perps explained", "")).toBe(true);
    expect(isRelevant(t, "Entropy explained in 5 minutes", "thermodynamics lecture")).toBe(false);
    expect(topicById("gmx")).toBeTruthy();
    expect(topicById("dydx")).toBeTruthy();
  });

  it("trending = views per day since upload, at least one day", () => {
    const now = Date.parse("2026-11-19T00:00:00Z");
    expect(viewsPerDay({ views: 1000, publishedAt: "2026-11-09T00:00:00Z" }, now)).toBe(100);
    expect(viewsPerDay({ views: 500, publishedAt: "2026-11-18T23:00:00Z" }, now)).toBe(500);
    expect(viewsPerDay({ views: 500, publishedAt: "bad" }, now)).toBe(0);
  });
});

describe("creators: one XYZ Score everywhere", () => {
  it("profile active weeks use the board's 84-day rule, capped at 12", () => {
    const now = Date.parse("2026-11-19T12:00:00Z");
    const d = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();
    // 83 days ago counts on the board; it must count here too.
    expect(activeWeeksSince([d(0), d(7), d(83)], now)).toBe(3);
    expect(activeWeeksSince([d(85)], now)).toBe(0);
    expect(activeWeeksSince(Array.from({ length: 30 }, (_, i) => d(i * 2.5)), now)).toBe(11);
    expect(activeWeeksSince(Array.from({ length: 120 }, (_, i) => d(i * 0.7)), now)).toBeLessThanOrEqual(12);
  });
});

describe("creators: YouTube live stats", () => {
  it("reads only statistics, 50 ids per call, and overlays them on the snapshot", async () => {
    const calls: URL[] = [];
    const ids = Array.from({ length: 120 }, (_, i) => `v${i}`);
    const f = async (url: string) => {
      const u = new URL(url);
      calls.push(u);
      const items = (u.searchParams.get("id") ?? "").split(",").map((id) => ({ id, statistics: { viewCount: "999", likeCount: "9" } }));
      return json({ items });
    };
    const stats = await fetchStats(ids, "k", f as any);
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.searchParams.get("part") === "statistics")).toBe(true);
    expect(stats.v0).toEqual({ views: 999, likes: 9, comments: null });
    const merged = withStats([vid({ id: "v0", views: 1 }), vid({ id: "gone", views: 5 })], stats);
    expect(merged[0]!.views).toBe(999);
    expect(merged[1]!.views).toBe(5); // not returned -> keeps its snapshot
  });
});

describe("creators: YouTube accuracy and composite ranking", () => {
  it("needs the venue in the TITLE - a referral link in the description is not enough", () => {
    const hl = topicById("hyperliquid")!;
    expect(isRelevant(hl, "My weekly crypto portfolio update", "Trade on Hyperliquid with my code: ...")).toBe(false);
    expect(isRelevant(hl, "Hyperliquid HIP-3 explained", "")).toBe(true);
    const v = topicById("variational")!;
    expect(isRelevant(v, "Best airdrops this month", "variational omni perp dex points")).toBe(false);
  });

  it("Creator Score adds five bounded parts and rewards each metric", () => {
    const zero = creatorScore({ views: 0, videos: 0, likes: 0, comments: 0, durationSec: 0 });
    expect(zero.total).toBe(0);
    const max = creatorScore({ views: 5_000_000, videos: 12, likes: 400_000, comments: 40_000, durationSec: 12 * 1500 });
    expect(max).toMatchObject({ reach: 250, output: 150, approval: 200, conversation: 150, depth: 250, total: 1000 });
    const base = { views: 100_000, videos: 5, likes: 2_000, comments: 200, durationSec: 5 * 600 };
    const more = (k: keyof typeof base, f: number) => creatorScore({ ...base, [k]: base[k] * f }).total;
    const b0 = creatorScore(base).total;
    // Same audience behaviour at 10x the reach scores higher...
    expect(creatorScore({ ...base, views: base.views * 10, likes: base.likes * 10, comments: base.comments * 10 }).total).toBeGreaterThan(b0);
    // ...but 10x views with the same likes means a weaker approval rate, on purpose.
    expect(creatorScore({ ...base, views: base.views * 10 }).approval).toBeLessThan(creatorScore(base).approval);
    expect(more("videos", 2)).toBeGreaterThan(b0);
    expect(more("likes", 2)).toBeGreaterThan(b0);
    expect(more("durationSec", 2)).toBeGreaterThan(b0);
  });

  it("a consistent channel can out-rank one viral upload", () => {
    const viral = Array.from({ length: 1 }, (_, i) => vid({ id: `v${i}`, channelId: "viral", views: 40_000, likes: 200, comments: 10, durationSec: 30 }));
    const steady = Array.from({ length: 8 }, (_, i) => vid({ id: `s${i}`, channelId: "steady", views: 3_000, likes: 120, comments: 15, durationSec: 1200 }));
    const ranked = rankYoutubeCreators([...viral, ...steady]);
    expect(ranked[0]!.channelId).toBe("steady");
  });
});

describe("creators: YouTube all-time coverage", () => {
  it("reads a second page of all-time most viewed when YouTube offers one", async () => {
    const searches: URLSearchParams[] = [];
    const f = async (url: string) => {
      const u = new URL(url);
      if (u.pathname.endsWith("/search")) {
        searches.push(u.searchParams);
        const first = u.searchParams.get("order") === "viewCount" && !u.searchParams.has("publishedAfter") && !u.searchParams.has("pageToken");
        return json({ items: [], ...(first ? { nextPageToken: "P2" } : {}) });
      }
      return json({ items: [] });
    };
    await fetchTopic(topicById("hyperliquid")!, "k", NOW, f as any);
    expect(searches).toHaveLength(4);
    expect(searches.filter((p) => p.get("pageToken") === "P2")).toHaveLength(1);
  });
});

describe("creators: YouTube classification", () => {
  it("tags a video with every venue named in its title, across discovery sets", () => {
    const a = vid({ id: "x1", title: "Hyperliquid vs Lighter: best perp DEX?", description: "perp dex comparison" });
    const b = vid({ id: "x1", title: "dup" });
    const c = vid({ id: "x2", title: "My crypto week", description: "Trade on Hyperliquid with my referral code" });
    const out = classify([[a], [b, c]]);
    expect(out).toHaveLength(1); // x2 is a referral link only; x1 de-duplicated
    expect(out[0]!.topics).toEqual(expect.arrayContaining(["hyperliquid", "lighter", "perp-dex"]));
  });

  it("keeps maths / physics out of Variational and Entropy", () => {
    expect(topicsFor("Variational Quantum Eigensolver lecture", "crypto points")).not.toContain("variational");
    expect(topicsFor("Entropy in thermodynamics explained", "hyperliquid perp")).not.toContain("entropy");
    expect(topicsFor("Variational Omni airdrop guide", "")).toContain("variational");
  });
});

describe("creators: Arena audio settings", () => {
  it("defaults to sound and music on, and survives bad storage", async () => {
    const { parseAudioSettings, DEFAULT_AUDIO } = await import("@modules/creators/lib/arena-audio");
    expect(DEFAULT_AUDIO).toEqual({ sound: true, music: true });
    expect(parseAudioSettings(null)).toEqual({ sound: true, music: true });
    expect(parseAudioSettings("not json")).toEqual({ sound: true, music: true });
    expect(parseAudioSettings('{"sound":false}')).toEqual({ sound: false, music: true });
    expect(parseAudioSettings('{"sound":true,"music":false}')).toEqual({ sound: true, music: false });
    expect(parseAudioSettings('{"music":"no"}')).toEqual({ sound: true, music: true });
  });
});
