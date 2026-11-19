// The game layer for /creators: points, levels, the XYZ Score, badges and
// streaks. Pure functions only (no I/O, no clock reads at import), so the
// server, the browser and the tests all compute the same thing. Every formula
// here is printed on the page.

// ------------------------------------------------------------------ points

export type Counts = {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  bookmarks: number;
};

/**
 * Post points. Weighted by how much effort each action costs the audience:
 * a view is free, a quote means writing your own post about it.
 * Linear on purpose, so a creator's total equals the formula applied to
 * their summed counts (the leaderboard query relies on that).
 */
export const POINT_WEIGHTS: Counts = { views: 0.1, likes: 1, replies: 2, reposts: 3, quotes: 4, bookmarks: 2 };

export function postPoints(c: Counts): number {
  let s = 0;
  for (const k of Object.keys(POINT_WEIGHTS) as (keyof Counts)[]) s += (c[k] || 0) * POINT_WEIGHTS[k];
  return Math.round(s);
}

export function engagements(c: Counts): number {
  return c.likes + c.replies + c.reposts + c.quotes + c.bookmarks;
}

// ------------------------------------------------------------------ levels

export type Level = { n: number; name: string; min: number; max: number | null };

export const LEVELS: Level[] = [
  { n: 1, name: "Spark", min: 0, max: 499 },
  { n: 2, name: "Scout", min: 500, max: 1_499 },
  { n: 3, name: "Builder", min: 1_500, max: 2_999 },
  { n: 4, name: "Creator", min: 3_000, max: 5_999 },
  { n: 5, name: "Voice", min: 6_000, max: 9_999 },
  { n: 6, name: "Elite", min: 10_000, max: 14_999 },
  { n: 7, name: "Legend", min: 15_000, max: 24_999 },
  { n: 8, name: "Apex", min: 25_000, max: null },
];

export function levelFor(points: number): Level {
  let lv = LEVELS[0]!;
  for (const l of LEVELS) if (points >= l.min) lv = l;
  return lv;
}

/** 0..1 progress through the current level, and points still needed for the next. */
export function levelProgress(points: number): { level: Level; next: Level | null; pct: number; toNext: number } {
  const level = levelFor(points);
  const next = LEVELS.find((l) => l.n === level.n + 1) ?? null;
  if (!next) return { level, next: null, pct: 1, toNext: 0 };
  const span = next.min - level.min;
  return { level, next, pct: Math.min(1, Math.max(0, (points - level.min) / span)), toNext: Math.max(0, next.min - points) };
}

// ------------------------------------------------------------------ XYZ Score

export type ScoreInput = {
  followers: number;
  posts: number;
  views: number;
  engagements: number;
  /** Distinct calendar weeks with at least one post, in the last 12. */
  activeWeeks: number;
};

export type ScoreParts = { reach: number; resonance: number; consistency: number; impact: number; total: number };

/**
 * XYZ Score, 0-1000, four equal parts of 250. Our own transparent stand-in
 * for an influence score:
 *  - Reach:       followers, log scale (1M followers = full marks)
 *  - Resonance:   engagement per view (5% or better = full marks)
 *  - Consistency: weeks active out of the last 12
 *  - Impact:      average views per post, log scale (100k = full marks)
 * Log scales stop one giant account from flattening everyone else.
 */
export function xyzScore(s: ScoreInput): ScoreParts {
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const reach = clamp(Math.log10(s.followers + 1) / 6) * 250;
  const rate = s.views > 0 ? s.engagements / s.views : 0;
  const resonance = (s.views >= 100 ? clamp(rate / 0.05) : 0) * 250;
  const consistency = clamp(s.activeWeeks / 12) * 250;
  const impact = s.posts > 0 ? clamp(Math.log10(s.views / s.posts + 1) / 5) * 250 : 0;
  const r = (x: number) => Math.round(x);
  return {
    reach: r(reach),
    resonance: r(resonance),
    consistency: r(consistency),
    impact: r(impact),
    total: r(reach + resonance + consistency + impact),
  };
}

export function scoreTier(total: number): { label: string; tone: "gold" | "mint" | "sky" | "muted" } {
  if (total >= 750) return { label: "Exceptional", tone: "gold" };
  if (total >= 550) return { label: "Strong", tone: "mint" };
  if (total >= 350) return { label: "Growing", tone: "sky" };
  return { label: "Early", tone: "muted" };
}

// ------------------------------------------------------------------ streaks

/** Monday-based UTC week index, so the server and every reader agree. */
export function weekIndex(iso: string): number {
  const t = Date.parse(iso);
  // 1970-01-01 was a Thursday; shift by 3 days so weeks start on Monday.
  return Math.floor((t / 86_400_000 + 3) / 7);
}

/** Consecutive weeks with a post, ending at the current week (or the one before, so a quiet Monday does not break it). */
export function weeklyStreak(postDates: string[], now: number): number {
  const weeks = new Set(postDates.map(weekIndex));
  let w = Math.floor((now / 86_400_000 + 3) / 7);
  if (!weeks.has(w)) w -= 1;
  let streak = 0;
  while (weeks.has(w)) {
    streak += 1;
    w -= 1;
  }
  return streak;
}

export function activeWeeksIn(postDates: string[], now: number, span = 12): number {
  const cur = Math.floor((now / 86_400_000 + 3) / 7);
  return new Set(postDates.map(weekIndex).filter((w) => w > cur - span && w <= cur)).size;
}

/**
 * Distinct Monday-based UTC weeks with a post among posts from the last
 * `days` days, capped at 12. This is the exact rule the leaderboard SQL uses
 * (count DISTINCT date_trunc('week') over the last 84 days, min 12), so a
 * creator's XYZ Score is identical on the board, in Head to Head and on their
 * profile. An earlier "last 12 calendar weeks" rule here made them differ.
 */
export function activeWeeksSince(postDates: string[], now: number, days = 84): number {
  const since = now - days * 86_400_000;
  return Math.min(12, new Set(postDates.filter((d) => Date.parse(d) >= since).map(weekIndex)).size);
}

// ------------------------------------------------------------------ badges

export type Badge = { id: string; label: string; hint: string; earned: boolean };

export type BadgeInput = {
  posts: number;
  points: number;
  views: number;
  bestPostViews: number;
  replies: number;
  quotes: number;
  streak: number;
  rank: number | null;
  score: number;
};

export function badgesFor(b: BadgeInput): Badge[] {
  return [
    { id: "first", label: "First Post", hint: "Post about Variational once", earned: b.posts >= 1 },
    { id: "regular", label: "Regular", hint: "10 Variational posts", earned: b.posts >= 10 },
    { id: "prolific", label: "Prolific", hint: "50 Variational posts", earned: b.posts >= 50 },
    { id: "viral", label: "Viral", hint: "One post past 50K views", earned: b.bestPostViews >= 50_000 },
    { id: "reach", label: "Reach 1M", hint: "1M total views", earned: b.views >= 1_000_000 },
    { id: "talker", label: "Conversation Starter", hint: "250 replies received", earned: b.replies >= 250 },
    { id: "quoted", label: "Quote Magnet", hint: "50 quote posts", earned: b.quotes >= 50 },
    { id: "streak", label: "On Fire", hint: "4-week posting streak", earned: b.streak >= 4 },
    { id: "top10", label: "Top 10", hint: "Reach the top 10", earned: b.rank != null && b.rank <= 10 },
    { id: "score", label: "Heavyweight", hint: "XYZ Score 750+", earned: b.score >= 750 },
  ];
}

// ------------------------------------------------------------------ helpers

/** "1.2K" / "3.4M", pinned to en-US so SSR and the browser agree. */
export function compact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function full(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function pct(x: number, digits = 1): string {
  if (!Number.isFinite(x)) return "-";
  return `${(x * 100).toFixed(digits)}%`;
}
