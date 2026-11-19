import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  VENUES,
  handleQuery,
  isOfficialHandle,
  searchPage,
  tweetsById,
  userInfo,
  venueQuery,
  venuesFor,
  type VenueId,
  type XTweetData,
  type XUser,
} from "./twitterapi";
import {
  LEVELS,
  activeWeeksSince,
  badgesFor,
  levelFor,
  levelProgress,
  postPoints,
  weeklyStreak,
  xyzScore,
  type Counts,
} from "./game";

// The X side of /creators. Two jobs:
//  WRITE - pull venue posts from twitterapi.io into XTweet/XAccount.
//          Triggered by traffic (no cron - crons are paused on purpose), at
//          most once per INDEX_EVERY_MS per venue, always under a daily item
//          budget.
//  READ  - rank accounts from what is stored. Reads never call the paid API.

// New posts every 15 min; the paid rotation of older posts stays at 30 min.
// One venue at 15 min costs the same baseline as two did at 30.
export const INDEX_EVERY_MS = 15 * 60_000;
const ROTATE_EVERY_MS = 30 * 60_000;
const MAX_LATEST_PAGES = 6; // per venue per run: up to ~120 new posts
const ROTATE_PER_RUN = 40; // older posts re-read per run, so views stay current
const ROTATE_MAX_AGE_DAYS = 45; // past this, counts barely move - not worth paying for
const SCAN_MAX_PAGES = 15; // a handle scan reads up to ~300 of their posts
export const SCAN_FRESH_MS = 6 * 3600_000;
const PAGE_COST = 20; // items billed per search page (reserved up front)

export type VenueFilter = VenueId | "all";

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
/**
 * Known Variational creators to seed the board with (from the owner's
 * reference leaderboard). Seeded accounts get a full history scan in the
 * background, so the board starts from the real top of the scene instead of
 * whoever happened to post in the last hour. Anyone else gets in by posting,
 * by backfill, or by being looked up.
 */
export const SEED_HANDLES = [
  "muarmemuar",
  "onchainmonk",
  "VictorTopDefiG",
  "givenoxbt",
  "linenmito",
  "Ryuzaki_SEI",
  "Muallimin_biri",
  "corgil",
  "me_cool_off",
  "JoestarCrypto",
  "Absoluto92",
];

/** Background jobs may use this share of the daily budget; the rest stays free for people's look-ups. */
const BG_SHARE = 0.75;
const BACKFILL_DAYS = 180;
const BACKFILL_WINDOW_DAYS = 7;
const BACKFILL_PAGES = 5; // Top posts per weekly window
const DEEP_SCANS_PER_RUN = 1;
/** Stop starting new background work after this much time in one run (the route's maxDuration is 60s). */
const RUN_DEADLINE_MS = 40_000;

/**
 * Reserve `n` billed items from today's budget. Atomic: the increment only
 * applies while the row still has room, so concurrent runs cannot overspend.
 * `background` jobs stop at BG_SHARE of the cap.
 */
export async function reserve(n: number, background = false): Promise<boolean> {
  const day = today();
  const cap = background ? Math.floor(dailyBudget() * BG_SHARE) : dailyBudget();
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

/** Keep the last indexer error visible on the board (it is otherwise only in server logs). */
async function noteError(msg: string | null) {
  await prisma.creatorSync
    .upsert({ where: { key: "error" }, create: { key: "error", cursor: msg, runAt: new Date() }, update: { cursor: msg, runAt: new Date() } })
    .catch(() => null);
}

/** Claim a job lock row; true only for the one caller that gets it. */
async function claim(key: string, everyMs: number): Promise<boolean> {
  const now = new Date();
  await prisma.creatorSync.upsert({ where: { key }, create: { key, runAt: new Date(0) }, update: {} });
  const r = await prisma.creatorSync.updateMany({
    where: { key, runAt: { lt: new Date(now.getTime() - everyMs) } },
    data: { runAt: now },
  });
  return r.count === 1;
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

function tweetRow(t: XTweetData, venues: VenueId[]) {
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
    venues,
    fetchedAt: new Date(),
  };
}

/** Store the relevant posts from a batch; returns how many were already known. */
export async function saveTweets(list: XTweetData[]): Promise<{ saved: number; known: number }> {
  const keep = list
    .filter((t) => !t.isRetweet)
    .map((t) => ({ t, venues: venuesFor(t.text) }))
    .filter((x) => x.venues.length > 0);
  if (!keep.length) return { saved: 0, known: 0 };
  const existing = new Set(
    (await prisma.xTweet.findMany({ where: { tweetId: { in: keep.map((x) => x.t.id) } }, select: { tweetId: true } })).map((r) => r.tweetId)
  );
  const authors = new Map<string, XUser>();
  for (const { t } of keep) authors.set(t.author.handle.toLowerCase(), t.author);
  for (const u of authors.values()) await saveAccount(u);
  for (const { t, venues } of keep) {
    const row = tweetRow(t, venues);
    await prisma.xTweet.upsert({ where: { tweetId: t.id }, create: { tweetId: t.id, ...row }, update: row });
  }
  return { saved: keep.length, known: keep.filter((x) => existing.has(x.t.id)).length };
}

/**
 * One incremental index pass over every venue, plus the rotation refresh.
 * Safe to call on every request: each part claims its own lock row and does
 * nothing unless INDEX_EVERY_MS has passed. Never throws (runs in after()).
 */
export async function runIndex(): Promise<{ ran: boolean; saved?: number; error?: string }> {
  if (!xConfigured()) return { ran: false };
  let ran = false;
  let saved = 0;
  const started = Date.now();
  const timeLeft = () => Date.now() - started < RUN_DEADLINE_MS;
  try {
    for (const v of VENUES) {
      if (!(await claim(`index:${v.id}`, INDEX_EVERY_MS))) continue;
      ran = true;
      let cursor: string | null = null;
      for (let page = 0; page < MAX_LATEST_PAGES; page++) {
        if (!(await reserve(PAGE_COST, true))) break;
        const res = await searchPage(venueQuery(v), "Latest", cursor, env.TWITTERAPI_IO_KEY);
        const r = await saveTweets(res.tweets);
        saved += r.saved;
        // Caught up with what we already have: stop paying for older pages.
        if (r.known > 0 || !res.nextCursor) break;
        cursor = res.nextCursor;
      }
    }

    if (await claim("rotate", ROTATE_EVERY_MS)) {
      ran = true;
      const now = Date.now();
      const stale = await prisma.xTweet.findMany({
        where: { tweetCreatedAt: { gt: new Date(now - ROTATE_MAX_AGE_DAYS * 86_400_000) }, fetchedAt: { lt: new Date(now - 6 * 3600_000) } },
        orderBy: { fetchedAt: "asc" },
        take: ROTATE_PER_RUN,
        select: { tweetId: true, venues: true },
      });
      if (stale.length && (await reserve(stale.length, true))) {
        const fresh = await tweetsById(stale.map((s) => s.tweetId), env.TWITTERAPI_IO_KEY);
        for (const t of fresh) {
          const venues = venuesFor(t.text);
          const keepVenues = venues.length ? venues : (stale.find((s) => s.tweetId === t.id)?.venues as VenueId[]) ?? [];
          await prisma.xTweet.update({ where: { tweetId: t.id }, data: tweetRow(t, keepVenues) }).catch(() => null);
        }
        // Ones X no longer returns (deleted / protected) still get a fresh
        // fetchedAt, so the rotation moves on instead of paying for them forever.
        const got = new Set(fresh.map((t) => t.id));
        const missing = stale.map((s) => s.tweetId).filter((id) => !got.has(id));
        if (missing.length) await prisma.xTweet.updateMany({ where: { tweetId: { in: missing } }, data: { fetchedAt: new Date() } });
      }
    }
    // Backfill: walk back through history a week at a time, taking each
    // week's most-engaged posts (queryType Top). This is what puts the
    // established creators on the board; "Latest" alone only ever sees the
    // last few hours.
    if (timeLeft() && (await claim("backfill", INDEX_EVERY_MS))) {
      ran = true;
      saved += await backfillStep();
    }

    // Deep scans: complete the history of seeded creators first, then of the
    // highest-ranked accounts we only know from a few sampled posts.
    if (timeLeft() && (await claim("deep", INDEX_EVERY_MS))) {
      ran = true;
      await deepScanStep();
    }
    await noteError(null);
    return { ran, saved };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[creators:x:index]", msg);
    await noteError(msg.slice(0, 300));
    return { ran: true, saved, error: msg };
  }
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** One backfill step; returns posts saved. Progress lives in CreatorSync("backfill-state"). */
async function backfillStep(): Promise<number> {
  const v = VENUES[0]!;
  const row = await prisma.creatorSync.findUnique({ where: { key: "backfill-state" } });
  let state: { until: string; cursor: string | null; done?: boolean } = { until: ymd(new Date(Date.now() + 86_400_000)), cursor: null };
  try {
    if (row?.cursor) state = JSON.parse(row.cursor);
  } catch {
    /* reset on a corrupt state */
  }
  if (state.done) return 0;
  const until = new Date(`${state.until}T00:00:00Z`);
  const since = new Date(until.getTime() - BACKFILL_WINDOW_DAYS * 86_400_000);
  const query = `${venueQuery(v)} since:${ymd(since)} until:${ymd(until)}`;
  let cursor = state.cursor;
  let saved = 0;
  let finishedWindow = false;
  for (let page = 0; page < BACKFILL_PAGES; page++) {
    if (!(await reserve(PAGE_COST, true))) break;
    const res = await searchPage(query, "Top", cursor, env.TWITTERAPI_IO_KEY);
    saved += (await saveTweets(res.tweets)).saved;
    if (!res.nextCursor || res.raw === 0) {
      finishedWindow = true;
      break;
    }
    cursor = res.nextCursor;
    if (page === BACKFILL_PAGES - 1) finishedWindow = true; // enough of this week's top posts
  }
  const next = finishedWindow ? { until: ymd(since), cursor: null } : { until: state.until, cursor };
  const done = finishedWindow && since.getTime() <= Date.now() - BACKFILL_DAYS * 86_400_000;
  await prisma.creatorSync.upsert({
    where: { key: "backfill-state" },
    create: { key: "backfill-state", cursor: JSON.stringify({ ...next, done }) },
    update: { cursor: JSON.stringify({ ...next, done }) },
  });
  return saved;
}

/** Full-history scans in the background: seeds first, then top accounts never scanned. */
async function deepScanStep(): Promise<void> {
  const scanned = new Set(
    (await prisma.xAccount.findMany({ where: { scannedAt: { not: null } }, select: { handleLower: true } })).map((a) => a.handleLower)
  );
  const queue: string[] = SEED_HANDLES.filter((h) => !scanned.has(h.toLowerCase()));
  if (queue.length < DEEP_SCANS_PER_RUN) {
    const top = await aggregate(VENUES[0]!.id, new Date(0));
    queue.push(
      ...top
        .map((a) => ({ a, p: postPoints(countsOf(a)) }))
        .sort((x, y) => y.p - x.p)
        .map(({ a }) => a.author)
        .filter((h) => !scanned.has(h))
        .slice(0, DEEP_SCANS_PER_RUN)
    );
  }
  for (const h of queue.slice(0, DEEP_SCANS_PER_RUN)) {
    const r = await scanHandle(h, true);
    if (r.status === "budget") break;
  }
}

export type ScanResult = { status: "fresh" | "scanned" | "budget" | "not_found" | "unconfigured" | "error" };

/** Read one handle's venue posts from X (at most once per SCAN_FRESH_MS). */
export async function scanHandle(handle: string, background = false): Promise<ScanResult> {
  if (!xConfigured()) return { status: "unconfigured" };
  const acct = await prisma.xAccount.findUnique({ where: { handleLower: handle.toLowerCase() } });
  if (acct?.scannedAt && Date.now() - acct.scannedAt.getTime() < SCAN_FRESH_MS) return { status: "fresh" };
  try {
    if (!(await reserve(1, background))) return { status: "budget" };
    // An API failure must not read as "no such account": only a clean
    // response without a user is not_found. Errors fall to the catch below.
    const user = await userInfo(handle, env.TWITTERAPI_IO_KEY);
    if (!user) return { status: "not_found" };
    await saveAccount(user, { scannedAt: new Date() });

    let cursor: string | null = null;
    for (let page = 0; page < SCAN_MAX_PAGES; page++) {
      if (!(await reserve(PAGE_COST, background))) return { status: "budget" };
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
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[creators:x:scan]", msg);
    await noteError(`scan @${handle}: ${msg}`.slice(0, 300));
    return { status: "error" };
  }
}

// ------------------------------------------------------------------ reads

export type XWindow = "7d" | "30d" | "all";
const WINDOW_MS: Record<XWindow, number | null> = { "7d": 7 * 86_400_000, "30d": 30 * 86_400_000, all: null };

export type BoardRow = Counts & {
  rank: number;
  /** Places gained (+) or lost (-) against the same board as it stood 7 days ago; null = new on the board. */
  move: number | null;
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

export type TopPost = Counts & {
  tweetId: string;
  url: string;
  text: string;
  createdAt: string;
  points: number;
  handle: string;
  name: string;
  avatar: string | null;
  verified: boolean;
  venues: VenueId[];
};

export type Board = {
  venue: VenueFilter;
  /** Whether replies are counted (default: original posts and quotes only). */
  replies: boolean;
  window: XWindow;
  rows: BoardRow[];
  /** Every ranked handle (lowercase) in rank order - rows stop at 500, ranks don't. */
  ranking: string[];
  totals: { accounts: number; posts: number; views: number; points: number; engagements: number };
  levels: { n: number; name: string; min: number; max: number | null; accounts: number }[];
  topPosts: TopPost[];
  /** Last 30 UTC days, oldest first. */
  daily: { day: string; posts: number; views: number; creators: number }[];
  /** Newest stored posts, newest first. */
  latest: TopPost[];
  /** What the window's posts talk about: posts mentioning each term, last 30 days. */
  topics: { term: string; posts: number }[];
  /** Distinct creators who posted in the last 7 days. */
  active7d: number;
  /** Biggest point earners of the last 7 days. */
  rising: { handle: string; name: string; avatar: string | null; points: number; posts: number }[];
  sync: {
    lastIndexAt: string | null;
    checked24h: number;
    budgetSpent: number;
    budgetCap: number;
    /** Last indexer/scan error in the past 24h, so a broken key or API is visible, not silent. */
    lastError: string | null;
    /** How far back history has been filled, YYYY-MM-DD (null = not started). */
    backfilledTo: string | null;
  };
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

/**
 * Replies are left out by default: "gm @variational_io" under someone else's
 * post is not creating content, and reply-farming would otherwise outrank
 * people who actually write about the venue.
 */
function replyClause(replies: boolean) {
  return replies ? Prisma.empty : Prisma.sql`AND t."isReply" = false`;
}

function venueClause(venue: VenueFilter) {
  return venue === "all" ? Prisma.sql`TRUE` : Prisma.sql`${venue} = ANY(t.venues)`;
}

async function aggregate(venue: VenueFilter, since: Date, until?: Date, replies = false): Promise<AggRow[]> {
  // Optional upper bound, as a clause rather than a sentinel date: a far-future
  // Date (year 275760) cannot be sent to Postgres at all.
  const upper = until ? Prisma.sql`AND t."tweetCreatedAt" < ${until}` : Prisma.empty;
  const weeksSince = new Date(Date.now() - 84 * 86_400_000);
  const rows = await prisma.$queryRaw<AggRow[]>(Prisma.sql`
    SELECT t."authorLower" AS author,
           count(*)::int AS posts,
           sum(t.views) AS views, sum(t.likes) AS likes, sum(t.replies) AS replies,
           sum(t.reposts) AS reposts, sum(t.quotes) AS quotes, sum(t.bookmarks) AS bookmarks,
           count(DISTINCT date_trunc('week', t."tweetCreatedAt")) FILTER (WHERE t."tweetCreatedAt" >= ${weeksSince})::int AS active_weeks,
           max(t."tweetCreatedAt") AS last_post
    FROM "XTweet" t
    JOIN "XAccount" a ON a."handleLower" = t."authorLower"
    WHERE t."tweetCreatedAt" >= ${since} ${upper} AND a.hidden = false AND ${venueClause(venue)} ${replyClause(replies)}
    GROUP BY t."authorLower"`);
  // Venue accounts are shown on their own profiles, never ranked against creators.
  return rows.filter((r) => !isOfficialHandle(r.author));
}

function countsOf(a: AggRow): Counts {
  return {
    views: num(a.views),
    likes: num(a.likes),
    replies: num(a.replies),
    reposts: num(a.reposts),
    quotes: num(a.quotes),
    bookmarks: num(a.bookmarks),
  };
}

export async function buildBoard(venue: VenueFilter, win: XWindow, replies = false): Promise<Board> {
  const span = WINDOW_MS[win];
  const since = span ? new Date(Date.now() - span) : new Date(0);
  const agg = await aggregate(venue, since, undefined, replies);

  const accounts = await prisma.xAccount.findMany({
    where: { handleLower: { in: agg.map((a) => a.author) } },
    select: { handleLower: true, handle: true, name: true, avatar: true, verified: true, followers: true },
  });
  const byHandle = new Map(accounts.map((a) => [a.handleLower, a]));

  const rows: BoardRow[] = agg
    .map((a) => {
      const acc = byHandle.get(a.author);
      const c = countsOf(a);
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
        move: null as number | null,
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
    .sort((x, y) => y.points - x.points || y.views - x.views || x.handle.localeCompare(y.handle));
  rows.forEach((r, i) => (r.rank = i + 1));

  // Movement: the same board computed as it stood a week ago (same window
  // length, shifted back 7 days; all-time = everything before then).
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const prevSince = span ? new Date(since.getTime() - 7 * 86_400_000) : new Date(0);
  const prevAgg = await aggregate(venue, prevSince, weekAgo, replies);
  const prevRank = new Map(
    prevAgg
      .map((a) => ({ a, p: postPoints(countsOf(a)) }))
      .sort((x, y) => y.p - x.p || num(y.a.views) - num(x.a.views) || x.a.author.localeCompare(y.a.author))
      .map(({ a }, i) => [a.author, i + 1] as const)
  );
  for (const r of rows) {
    const pr = prevRank.get(r.handle.toLowerCase());
    r.move = pr == null ? null : pr - r.rank;
  }

  const thirty = new Date(Date.now() - 30 * 86_400_000);
  const seven = new Date(Date.now() - 7 * 86_400_000);
  const TERMS = ["Omni", "RFQ", "Points", "TGE", "Airdrop", "OLP", "Funding", "Leverage", "Arbitrum", "Fees"];
  const [topRaw, dailyRaw, risingAgg, lastIndex, checked24h, budget, latestRaw, topicRaw] = await Promise.all([
    prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT t."tweetId", t.url, t.text, t."tweetCreatedAt", t.views, t.likes, t.replies, t.reposts, t.quotes, t.bookmarks, t.venues,
             a.handle, a.name, a.avatar, a.verified
      FROM "XTweet" t JOIN "XAccount" a ON a."handleLower" = t."authorLower"
      WHERE t."tweetCreatedAt" >= ${since} AND a.hidden = false AND ${venueClause(venue)} ${replyClause(replies)}
      ORDER BY (t.views * 0.1 + t.likes + t.replies * 2 + t.reposts * 3 + t.quotes * 4 + t.bookmarks * 2) DESC
      LIMIT 40`),
    prisma.$queryRaw<{ day: Date; posts: number; views: bigint | number; creators: number }[]>(Prisma.sql`
      SELECT date_trunc('day', t."tweetCreatedAt") AS day, count(*)::int AS posts, sum(t.views) AS views, count(DISTINCT t."authorLower")::int AS creators
      FROM "XTweet" t JOIN "XAccount" a ON a."handleLower" = t."authorLower"
      WHERE t."tweetCreatedAt" >= ${thirty} AND a.hidden = false AND ${venueClause(venue)} ${replyClause(replies)}
      GROUP BY 1`),
    win === "7d" ? Promise.resolve(null) : aggregate(venue, seven, undefined, replies),
    prisma.creatorSync.findMany({ where: { key: { in: ["index:variational", "error", "backfill-state"] } }, select: { key: true, runAt: true, cursor: true } }).catch(() => []),
    prisma.xTweet.count({ where: { fetchedAt: { gte: new Date(Date.now() - 86_400_000) } } }).catch(() => 0),
    budgetState(),
    prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT t."tweetId", t.url, t.text, t."tweetCreatedAt", t.views, t.likes, t.replies, t.reposts, t.quotes, t.bookmarks, t.venues,
             a.handle, a.name, a.avatar, a.verified
      FROM "XTweet" t JOIN "XAccount" a ON a."handleLower" = t."authorLower"
      WHERE a.hidden = false AND ${venueClause(venue)} ${replyClause(replies)}
      ORDER BY t."tweetCreatedAt" DESC
      LIMIT 20`),
    prisma.$queryRaw<Record<string, number>[]>(Prisma.sql`
      SELECT ${Prisma.join(TERMS.map((term) => Prisma.sql`count(*) FILTER (WHERE t.text ~* ${"\\m" + term})::int AS ${Prisma.raw(`"${term}"`)}`))}
      FROM "XTweet" t JOIN "XAccount" a ON a."handleLower" = t."authorLower"
      WHERE t."tweetCreatedAt" >= ${thirty} AND a.hidden = false AND ${venueClause(venue)} ${replyClause(replies)}`),
  ]);

  const toTop = (t: any): TopPost => {
    const c: Counts = { views: num(t.views), likes: num(t.likes), replies: num(t.replies), reposts: num(t.reposts), quotes: num(t.quotes), bookmarks: num(t.bookmarks) };
    return {
      ...c,
      tweetId: String(t.tweetId),
      url: String(t.url),
      text: String(t.text),
      createdAt: new Date(t.tweetCreatedAt).toISOString(),
      points: postPoints(c),
      handle: String(t.handle),
      name: String(t.name),
      avatar: t.avatar ?? null,
      verified: Boolean(t.verified),
      venues: (t.venues ?? []) as VenueId[],
    };
  };
  const latest = latestRaw.filter((t) => !isOfficialHandle(String(t.handle))).slice(0, 12).map(toTop);
  const topicRow = topicRaw[0] ?? {};
  const topics = TERMS.map((term) => ({ term, posts: Number(topicRow[term] ?? 0) })).sort((a, b) => b.posts - a.posts);

  const topPosts: TopPost[] = topRaw
    .filter((t) => !isOfficialHandle(String(t.handle)))
    .slice(0, 24)
    .map((t) => {
      const c: Counts = { views: num(t.views), likes: num(t.likes), replies: num(t.replies), reposts: num(t.reposts), quotes: num(t.quotes), bookmarks: num(t.bookmarks) };
      return {
        ...c,
        tweetId: String(t.tweetId),
        url: String(t.url),
        text: String(t.text),
        createdAt: new Date(t.tweetCreatedAt).toISOString(),
        points: postPoints(c),
        handle: String(t.handle),
        name: String(t.name),
        avatar: t.avatar ?? null,
        verified: Boolean(t.verified),
        venues: (t.venues ?? []) as VenueId[],
      };
    });

  const dayMap = new Map(dailyRaw.map((d) => [new Date(d.day).toISOString().slice(0, 10), d]));
  const startDay = Math.floor(Date.now() / 86_400_000) - 29;
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = new Date((startDay + i) * 86_400_000).toISOString().slice(0, 10);
    const d = dayMap.get(day);
    return { day, posts: d?.posts ?? 0, views: num(d?.views), creators: d?.creators ?? 0 };
  });

  const risingSource = risingAgg ?? agg;
  const rising = risingSource
    .map((a) => ({ a, points: postPoints(countsOf(a)) }))
    .sort((x, y) => y.points - x.points)
    .slice(0, 8)
    .map(({ a, points }) => {
      const acc = byHandle.get(a.author);
      return { handle: acc?.handle ?? a.author, name: acc?.name ?? a.author, avatar: acc?.avatar ?? null, points, posts: a.posts };
    });
  // Rising rows can include accounts outside this window's set; fill their names.
  const missing = rising.filter((r) => !byHandle.has(r.handle.toLowerCase())).map((r) => r.handle.toLowerCase());
  if (missing.length) {
    const extra = await prisma.xAccount.findMany({ where: { handleLower: { in: missing } }, select: { handleLower: true, handle: true, name: true, avatar: true } });
    const m = new Map(extra.map((e) => [e.handleLower, e]));
    for (const r of rising) {
      const e = m.get(r.handle.toLowerCase());
      if (e) Object.assign(r, { handle: e.handle, name: e.name, avatar: e.avatar });
    }
  }

  const lastRun = lastIndex.filter((r) => r.key.startsWith("index")).map((r) => r.runAt.getTime()).filter((t) => t > 0);
  const errRow = lastIndex.find((r) => r.key === "error");
  const lastError = errRow?.cursor && Date.now() - errRow.runAt.getTime() < 86_400_000 ? errRow.cursor : null;
  let backfilledTo: string | null = null;
  try {
    const st = lastIndex.find((r) => r.key === "backfill-state")?.cursor;
    if (st) backfilledTo = JSON.parse(st).until ?? null;
  } catch {
    /* ignore */
  }
  return {
    venue,
    replies,
    window: win,
    rows: rows.slice(0, 500),
    ranking: rows.map((r) => r.handle.toLowerCase()),
    totals: {
      accounts: rows.length,
      posts: rows.reduce((s, r) => s + r.posts, 0),
      views: rows.reduce((s, r) => s + r.views, 0),
      points: rows.reduce((s, r) => s + r.points, 0),
      engagements: rows.reduce((s, r) => s + r.likes + r.replies + r.reposts + r.quotes + r.bookmarks, 0),
    },
    levels: LEVELS.map((l) => ({ ...l, accounts: rows.filter((r) => r.level === l.n).length })),
    topPosts,
    latest,
    topics,
    active7d: risingSource.length,
    daily,
    rising,
    sync: {
      lastIndexAt: lastRun.length ? new Date(Math.max(...lastRun)).toISOString() : null,
      checked24h,
      budgetSpent: budget.spent,
      budgetCap: budget.cap,
      lastError,
      backfilledTo,
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
  venues: VenueId[];
};

export type Profile = {
  handle: string;
  name: string;
  avatar: string | null;
  verified: boolean;
  followers: number;
  bio: string;
  official: boolean;
  venue: VenueFilter;
  scannedAt: string | null;
  totals: Counts & { posts: number; points: number; engagementRate: number; avgViews: number; originals: number; replyPosts: number };
  score: ReturnType<typeof xyzScore>;
  level: ReturnType<typeof levelProgress>;
  streak: number;
  activeWeeks: number;
  badges: ReturnType<typeof badgesFor>;
  rank: number | null;
  ofAccounts: number;
  /** Share of ranked accounts this one beats, 0..1 (null when unranked). */
  percentile: number | null;
  /** Points per venue, across all of their stored posts. */
  byVenue: { venue: VenueId; posts: number; points: number; views: number }[];
  posts: ProfilePost[];
  /** Points per week for the last 12 weeks, oldest first. */
  weekly: { week: string; points: number; posts: number }[];
  /** Average points per post by UTC hour (0-23) and by weekday (Mon-Sun). */
  byHour: { posts: number; avg: number }[];
  byWeekday: { posts: number; avg: number }[];
  firstPost: string | null;
};

export async function buildProfile(handle: string, venue: VenueFilter, board: Board | null, replies = false): Promise<Profile | null> {
  const acc = await prisma.xAccount.findUnique({ where: { handleLower: handle.toLowerCase() } });
  if (!acc || acc.hidden) return null;
  const tweets = await prisma.xTweet.findMany({
    where: { authorLower: acc.handleLower },
    orderBy: { tweetCreatedAt: "desc" },
    take: 1000,
  });
  const toPost = (t: (typeof tweets)[number]): ProfilePost => {
    const c: Counts = { views: t.views, likes: t.likes, replies: t.replies, reposts: t.reposts, quotes: t.quotes, bookmarks: t.bookmarks };
    return { ...c, tweetId: t.tweetId, url: t.url, text: t.text, createdAt: t.tweetCreatedAt.toISOString(), points: postPoints(c), isReply: t.isReply, venues: t.venues as VenueId[] };
  };
  const allPosts = tweets.map(toPost);
  // Same rule as the board, so a profile's totals, score and rank always agree with its row.
  const posts = (venue === "all" ? allPosts : allPosts.filter((p) => p.venues.includes(venue))).filter((p) => replies || !p.isReply);

  const now = Date.now();
  const sum = (k: keyof Counts) => posts.reduce((s, p) => s + p[k], 0);
  const c: Counts = { views: sum("views"), likes: sum("likes"), replies: sum("replies"), reposts: sum("reposts"), quotes: sum("quotes"), bookmarks: sum("bookmarks") };
  const points = postPoints(c);
  const eng = c.likes + c.replies + c.reposts + c.quotes + c.bookmarks;
  const dates = posts.map((p) => p.createdAt);
  const activeWeeks = activeWeeksSince(dates, now);
  const score = xyzScore({ followers: acc.followers, posts: posts.length, views: c.views, engagements: eng, activeWeeks });
  const streak = weeklyStreak(dates, now);
  const idx = board ? board.ranking.indexOf(acc.handleLower) : -1;
  const rank = idx >= 0 ? idx + 1 : null;
  const of = board?.totals.accounts ?? 0;

  const curWeek = Math.floor((now / 86_400_000 + 3) / 7);
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const w = curWeek - 11 + i;
    const inWeek = posts.filter((p) => Math.floor((Date.parse(p.createdAt) / 86_400_000 + 3) / 7) === w);
    const start = new Date((w * 7 - 3) * 86_400_000).toISOString().slice(0, 10);
    return { week: start, points: inWeek.reduce((s, p) => s + p.points, 0), posts: inWeek.length };
  });

  const bucket = (n: number, key: (d: Date) => number) => {
    const b = Array.from({ length: n }, () => ({ posts: 0, total: 0 }));
    for (const p of posts) {
      const k = key(new Date(p.createdAt));
      b[k]!.posts += 1;
      b[k]!.total += p.points;
    }
    return b.map((x) => ({ posts: x.posts, avg: x.posts ? Math.round(x.total / x.posts) : 0 }));
  };

  return {
    handle: acc.handle,
    name: acc.name,
    avatar: acc.avatar,
    verified: acc.verified,
    followers: acc.followers,
    bio: acc.bio,
    official: isOfficialHandle(acc.handle),
    venue,
    scannedAt: acc.scannedAt?.toISOString() ?? null,
    totals: {
      ...c,
      posts: posts.length,
      points,
      engagementRate: c.views > 0 ? eng / c.views : 0,
      avgViews: posts.length ? c.views / posts.length : 0,
      originals: posts.filter((p) => !p.isReply).length,
      replyPosts: posts.filter((p) => p.isReply).length,
    },
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
      rank,
      score: score.total,
    }),
    rank,
    ofAccounts: of,
    percentile: rank && of > 1 ? (of - rank) / (of - 1) : rank === 1 ? 1 : null,
    byVenue: VENUES.map((v) => {
      const mine = allPosts.filter((p) => p.venues.includes(v.id));
      const vc = mine.reduce(
        (s, p) => ({ views: s.views + p.views, points: s.points + p.points }),
        { views: 0, points: 0 }
      );
      return { venue: v.id, posts: mine.length, points: vc.points, views: vc.views };
    }),
    posts: posts.slice(0, 200),
    weekly,
    // getUTC* on purpose: the server and every reader must agree.
    byHour: bucket(24, (d) => d.getUTCHours()),
    byWeekday: bucket(7, (d) => (d.getUTCDay() + 6) % 7),
    firstPost: posts.length ? posts[posts.length - 1]!.createdAt : null,
  };
}
