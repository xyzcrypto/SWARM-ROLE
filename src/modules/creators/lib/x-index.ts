import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  VARIATIONAL_QUERY,
  handleQuery,
  isOfficialHandle,
  isVariationalPost,
  searchPage,
  tweetsById,
  userInfo,
  type XTweetData,
  type XUser,
} from "./twitterapi";
import {
  LEVELS,
  activeWeeksIn,
  badgesFor,
  levelFor,
  levelProgress,
  postPoints,
  weeklyStreak,
  xyzScore,
  type Counts,
} from "./game";

// The X side of /creators. Two jobs:
//  WRITE - pull Variational posts from twitterapi.io into XTweet/XAccount.
//          Triggered by traffic (no cron - crons are paused on purpose), at
//          most once per INDEX_EVERY_MS, and always under a daily item budget.
//  READ  - rank accounts from what is stored. Reads never call the paid API.

export const INDEX_EVERY_MS = 30 * 60_000;
const MAX_LATEST_PAGES = 8; // up to ~160 new posts per run
const ROTATE_PER_RUN = 40; // older posts re-read per run, so views stay current
const ROTATE_MAX_AGE_DAYS = 45; // past this, counts barely move - not worth paying for
const SCAN_MAX_PAGES = 15; // a handle scan reads up to ~300 of their posts
export const SCAN_FRESH_MS = 6 * 3600_000;
const PAGE_COST = 20; // items billed per search page (reserved up front)

export function xConfigured(): boolean {
  return Boolean(env.TWITTERAPI_IO_KEY);
}

function dailyBudget(): number {
  const n = Number(env.TWITTERAPI_DAILY_ITEMS);
  return Number.isFinite(n) && n > 0 ? n : 6_000;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ------------------------------------------------------------------ budget

/**
 * Reserve `n` billed items from today's budget. Atomic: the increment only
 * applies while the row still has room, so concurrent runs cannot overspend.
 */
export async function reserve(n: number): Promise<boolean> {
  const day = today();
  const cap = dailyBudget();
  await prisma.creatorSync.upsert({ where: { key: "budget" }, create: { key: "budget", day, spent: 0 }, update: {} });
  await prisma.creatorSync.updateMany({ where: { key: "budget", NOT: { day } }, data: { day, spent: 0 } });
  const r = await prisma.creatorSync.updateMany({
    where: { key: "budget", day, spent: { lte: cap - n } },
    data: { spent: { increment: n } },
  });
  return r.count === 1;
}

export async function budgetState(): Promise<{ spent: number; cap: number }> {
  const row = await prisma.creatorSync.findUnique({ where: { key: "budget" } }).catch(() => null);
  return { spent: row && row.day === today() ? row.spent : 0, cap: dailyBudget() };
}

// ------------------------------------------------------------------ writes

async function saveAccount(u: XUser, extra: Partial<{ scannedAt: Date }> = {}) {
  const data = {
    handle: u.handle,
    xId: u.id,
    name: u.name,
    avatar: u.avatar,
    followers: u.followers,
    verified: u.verified,
    ...(u.bio ? { bio: u.bio } : {}),
    ...extra,
  };
  await prisma.xAccount.upsert({
    where: { handleLower: u.handle.toLowerCase() },
    create: { handleLower: u.handle.toLowerCase(), ...data },
    update: data,
  });
}

function tweetRow(t: XTweetData) {
  return {
    authorLower: t.author.handle.toLowerCase(),
    url: t.url,
    text: t.text,
    tweetCreatedAt: new Date(t.createdAt),
    views: t.views,
    likes: t.likes,
    replies: t.replies,
    reposts: t.reposts,
    quotes: t.quotes,
    bookmarks: t.bookmarks,
    isReply: t.isReply,
    fetchedAt: new Date(),
  };
}

/** Store the relevant posts from a batch; returns how many were already known. */
async function saveTweets(list: XTweetData[]): Promise<{ saved: number; known: number }> {
  const keep = list.filter((t) => !t.isRetweet && isVariationalPost(t.text));
  if (!keep.length) return { saved: 0, known: 0 };
  const existing = new Set(
    (await prisma.xTweet.findMany({ where: { tweetId: { in: keep.map((t) => t.id) } }, select: { tweetId: true } })).map((r) => r.tweetId)
  );
  const authors = new Map<string, XUser>();
  for (const t of keep) authors.set(t.author.handle.toLowerCase(), t.author);
  for (const u of authors.values()) await saveAccount(u);
  for (const t of keep) {
    await prisma.xTweet.upsert({ where: { tweetId: t.id }, create: { tweetId: t.id, ...tweetRow(t) }, update: tweetRow(t) });
  }
  return { saved: keep.length, known: keep.filter((t) => existing.has(t.id)).length };
}

/**
 * One incremental index run. Safe to call on every request: it claims a
 * lock row and returns immediately unless INDEX_EVERY_MS has passed.
 * Never throws (it runs inside after()).
 */
export async function runIndex(): Promise<{ ran: boolean; saved?: number; error?: string }> {
  if (!xConfigured()) return { ran: false };
  try {
    const now = new Date();
    await prisma.creatorSync.upsert({ where: { key: "index" }, create: { key: "index", runAt: new Date(0) }, update: {} });
    const claim = await prisma.creatorSync.updateMany({
      where: { key: "index", runAt: { lt: new Date(now.getTime() - INDEX_EVERY_MS) } },
      data: { runAt: now },
    });
    if (claim.count !== 1) return { ran: false };

    let saved = 0;
    let cursor: string | null = null;
    for (let page = 0; page < MAX_LATEST_PAGES; page++) {
      if (!(await reserve(PAGE_COST))) break;
      const res = await searchPage(VARIATIONAL_QUERY, "Latest", cursor, env.TWITTERAPI_IO_KEY);
      const r = await saveTweets(res.tweets);
      saved += r.saved;
      // Caught up with what we already have: stop paying for older pages.
      if (r.known > 0 || !res.nextCursor) break;
      cursor = res.nextCursor;
    }

    // Rotation: re-read the stalest recent posts so their views keep moving.
    const stale = await prisma.xTweet.findMany({
      where: { tweetCreatedAt: { gt: new Date(now.getTime() - ROTATE_MAX_AGE_DAYS * 86_400_000) }, fetchedAt: { lt: new Date(now.getTime() - 6 * 3600_000) } },
      orderBy: { fetchedAt: "asc" },
      take: ROTATE_PER_RUN,
      select: { tweetId: true },
    });
    if (stale.length && (await reserve(stale.length))) {
      const fresh = await tweetsById(stale.map((s) => s.tweetId), env.TWITTERAPI_IO_KEY);
      for (const t of fresh) {
        await prisma.xTweet.update({ where: { tweetId: t.id }, data: tweetRow(t) }).catch(() => null);
      }
      // Ones X no longer returns (deleted / protected) still get a fresh
      // fetchedAt, so the rotation moves on instead of paying for them forever.
      const got = new Set(fresh.map((t) => t.id));
      const missing = stale.map((s) => s.tweetId).filter((id) => !got.has(id));
      if (missing.length) await prisma.xTweet.updateMany({ where: { tweetId: { in: missing } }, data: { fetchedAt: now } });
    }
    return { ran: true, saved };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[creators:x:index]", msg);
    return { ran: true, error: msg };
  }
}

export type ScanResult = { status: "fresh" | "scanned" | "budget" | "not_found" | "unconfigured" | "error" };

/** Read one handle's Variational history from X (at most once per SCAN_FRESH_MS). */
export async function scanHandle(handle: string): Promise<ScanResult> {
  if (!xConfigured()) return { status: "unconfigured" };
  const acct = await prisma.xAccount.findUnique({ where: { handleLower: handle.toLowerCase() } });
  if (acct?.scannedAt && Date.now() - acct.scannedAt.getTime() < SCAN_FRESH_MS) return { status: "fresh" };
  try {
    if (!(await reserve(1))) return { status: "budget" };
    const user = await userInfo(handle, env.TWITTERAPI_IO_KEY).catch(() => null);
    if (!user) return { status: "not_found" };
    await saveAccount(user, { scannedAt: new Date() });

    let cursor: string | null = null;
    for (let page = 0; page < SCAN_MAX_PAGES; page++) {
      if (!(await reserve(PAGE_COST))) return { status: "budget" };
      const res = await searchPage(handleQuery(user.handle), "Latest", cursor, env.TWITTERAPI_IO_KEY);
      await saveTweets(res.tweets);
      if (!res.nextCursor || res.raw === 0) break;
      cursor = res.nextCursor;
    }
    // Account row again: saveTweets may have written an older snapshot of the
    // author from a post, and the user/info call is the authoritative one.
    await saveAccount(user, { scannedAt: new Date() });
    return { status: "scanned" };
  } catch (err) {
    console.error("[creators:x:scan]", err instanceof Error ? err.message : err);
    return { status: "error" };
  }
}

// ------------------------------------------------------------------ reads

export type XWindow = "7d" | "30d" | "all";
const WINDOW_MS: Record<XWindow, number | null> = { "7d": 7 * 86_400_000, "30d": 30 * 86_400_000, all: null };

export type BoardRow = Counts & {
  rank: number;
  handle: string;
  name: string;
  avatar: string | null;
  verified: boolean;
  followers: number;
  posts: number;
  points: number;
  level: number;
  score: number;
  activeWeeks: number;
  lastPost: string;
};

export type Board = {
  window: XWindow;
  rows: BoardRow[];
  totals: { accounts: number; posts: number; views: number; points: number };
  levels: { n: number; name: string; min: number; max: number | null; accounts: number }[];
  sync: { lastIndexAt: string | null; checked24h: number; budgetSpent: number; budgetCap: number };
  configured: boolean;
};

type AggRow = {
  author: string;
  posts: number;
  views: bigint | number;
  likes: bigint | number;
  replies: bigint | number;
  reposts: bigint | number;
  quotes: bigint | number;
  bookmarks: bigint | number;
  active_weeks: number;
  last_post: Date;
};

const num = (v: bigint | number | null | undefined) => Number(v ?? 0);

export async function buildBoard(win: XWindow): Promise<Board> {
  const span = WINDOW_MS[win];
  const since = span ? new Date(Date.now() - span) : new Date(0);
  const weeksSince = new Date(Date.now() - 84 * 86_400_000);

  const agg = await prisma.$queryRaw<AggRow[]>(Prisma.sql`
    SELECT t."authorLower" AS author,
           count(*)::int AS posts,
           sum(t.views) AS views, sum(t.likes) AS likes, sum(t.replies) AS replies,
           sum(t.reposts) AS reposts, sum(t.quotes) AS quotes, sum(t.bookmarks) AS bookmarks,
           count(DISTINCT date_trunc('week', t."tweetCreatedAt")) FILTER (WHERE t."tweetCreatedAt" >= ${weeksSince})::int AS active_weeks,
           max(t."tweetCreatedAt") AS last_post
    FROM "XTweet" t
    JOIN "XAccount" a ON a."handleLower" = t."authorLower"
    WHERE t."tweetCreatedAt" >= ${since} AND a.hidden = false AND t."authorLower" NOT LIKE 'variational%'
    GROUP BY t."authorLower"`);

  const accounts = await prisma.xAccount.findMany({
    where: { handleLower: { in: agg.map((a) => a.author) } },
    select: { handleLower: true, handle: true, name: true, avatar: true, verified: true, followers: true },
  });
  const byHandle = new Map(accounts.map((a) => [a.handleLower, a]));

  const rows: BoardRow[] = agg
    .map((a) => {
      const acc = byHandle.get(a.author);
      const c: Counts = {
        views: num(a.views),
        likes: num(a.likes),
        replies: num(a.replies),
        reposts: num(a.reposts),
        quotes: num(a.quotes),
        bookmarks: num(a.bookmarks),
      };
      const points = postPoints(c);
      const score = xyzScore({
        followers: acc?.followers ?? 0,
        posts: a.posts,
        views: c.views,
        engagements: c.likes + c.replies + c.reposts + c.quotes + c.bookmarks,
        activeWeeks: Math.min(12, a.active_weeks),
      }).total;
      return {
        ...c,
        rank: 0,
        handle: acc?.handle ?? a.author,
        name: acc?.name ?? a.author,
        avatar: acc?.avatar ?? null,
        verified: acc?.verified ?? false,
        followers: acc?.followers ?? 0,
        posts: a.posts,
        points,
        level: levelFor(points).n,
        score,
        activeWeeks: Math.min(12, a.active_weeks),
        lastPost: new Date(a.last_post).toISOString(),
      };
    })
    .sort((x, y) => y.points - x.points || y.views - x.views);
  rows.forEach((r, i) => (r.rank = i + 1));

  const [lastIndex, checked24h, budget] = await Promise.all([
    prisma.creatorSync.findUnique({ where: { key: "index" } }).catch(() => null),
    prisma.xTweet.count({ where: { fetchedAt: { gte: new Date(Date.now() - 86_400_000) } } }).catch(() => 0),
    budgetState(),
  ]);

  return {
    window: win,
    rows: rows.slice(0, 500),
    totals: {
      accounts: rows.length,
      posts: rows.reduce((s, r) => s + r.posts, 0),
      views: rows.reduce((s, r) => s + r.views, 0),
      points: rows.reduce((s, r) => s + r.points, 0),
    },
    levels: LEVELS.map((l) => ({ ...l, accounts: rows.filter((r) => r.level === l.n).length })),
    sync: {
      lastIndexAt: lastIndex && lastIndex.runAt.getTime() > 0 ? lastIndex.runAt.toISOString() : null,
      checked24h,
      budgetSpent: budget.spent,
      budgetCap: budget.cap,
    },
    configured: xConfigured(),
  };
}

export type ProfilePost = Counts & {
  tweetId: string;
  url: string;
  text: string;
  createdAt: string;
  points: number;
  isReply: boolean;
};

export type Profile = {
  handle: string;
  name: string;
  avatar: string | null;
  verified: boolean;
  followers: number;
  bio: string;
  official: boolean;
  scannedAt: string | null;
  totals: Counts & { posts: number; points: number; engagementRate: number; avgViews: number };
  score: ReturnType<typeof xyzScore>;
  level: ReturnType<typeof levelProgress>;
  streak: number;
  activeWeeks: number;
  badges: ReturnType<typeof badgesFor>;
  rank: number | null;
  ofAccounts: number;
  posts: ProfilePost[];
  /** Points per week for the last 12 weeks, oldest first. */
  weekly: { week: string; points: number; posts: number }[];
};

export async function buildProfile(handle: string, allTime: Board | null): Promise<Profile | null> {
  const acc = await prisma.xAccount.findUnique({ where: { handleLower: handle.toLowerCase() } });
  if (!acc || acc.hidden) return null;
  const tweets = await prisma.xTweet.findMany({
    where: { authorLower: acc.handleLower },
    orderBy: { tweetCreatedAt: "desc" },
    take: 500,
  });
  const now = Date.now();
  const posts: ProfilePost[] = tweets.map((t) => {
    const c: Counts = { views: t.views, likes: t.likes, replies: t.replies, reposts: t.reposts, quotes: t.quotes, bookmarks: t.bookmarks };
    return { ...c, tweetId: t.tweetId, url: t.url, text: t.text, createdAt: t.tweetCreatedAt.toISOString(), points: postPoints(c), isReply: t.isReply };
  });
  const sum = (k: keyof Counts) => posts.reduce((s, p) => s + p[k], 0);
  const c: Counts = { views: sum("views"), likes: sum("likes"), replies: sum("replies"), reposts: sum("reposts"), quotes: sum("quotes"), bookmarks: sum("bookmarks") };
  const points = postPoints(c);
  const eng = c.likes + c.replies + c.reposts + c.quotes + c.bookmarks;
  const dates = posts.map((p) => p.createdAt);
  const activeWeeks = activeWeeksIn(dates, now);
  const score = xyzScore({ followers: acc.followers, posts: posts.length, views: c.views, engagements: eng, activeWeeks });
  const streak = weeklyStreak(dates, now);
  const row = allTime?.rows.find((r) => r.handle.toLowerCase() === acc.handleLower) ?? null;

  const curWeek = Math.floor((now / 86_400_000 + 3) / 7);
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const w = curWeek - 11 + i;
    const inWeek = posts.filter((p) => Math.floor((Date.parse(p.createdAt) / 86_400_000 + 3) / 7) === w);
    const start = new Date((w * 7 - 3) * 86_400_000).toISOString().slice(0, 10);
    return { week: start, points: inWeek.reduce((s, p) => s + p.points, 0), posts: inWeek.length };
  });

  return {
    handle: acc.handle,
    name: acc.name,
    avatar: acc.avatar,
    verified: acc.verified,
    followers: acc.followers,
    bio: acc.bio,
    official: isOfficialHandle(acc.handle),
    scannedAt: acc.scannedAt?.toISOString() ?? null,
    totals: { ...c, posts: posts.length, points, engagementRate: c.views > 0 ? eng / c.views : 0, avgViews: posts.length ? c.views / posts.length : 0 },
    score,
    level: levelProgress(points),
    streak,
    activeWeeks,
    badges: badgesFor({
      posts: posts.length,
      points,
      views: c.views,
      bestPostViews: posts.reduce((m, p) => Math.max(m, p.views), 0),
      replies: c.replies,
      quotes: c.quotes,
      streak,
      rank: row?.rank ?? null,
      score: score.total,
    }),
    rank: row?.rank ?? null,
    ofAccounts: allTime?.totals.accounts ?? 0,
    posts: posts.slice(0, 200),
    weekly,
  };
}
