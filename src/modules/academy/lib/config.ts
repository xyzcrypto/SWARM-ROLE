// XYZ Crypto Academy: every tunable number in one place.
//
// These are the DEFAULTS. Admins override any of them from /dashboard/academy;
// overrides are stored per key in AcademyConfig and merged over these by
// loadConfig() (server only, see config-store.ts). Client-safe: no imports.

export type Difficulty = "easy" | "medium" | "hard" | "expert";
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert"];

export type Level = "beginner" | "intermediate" | "advanced" | "expert";
export const LEVELS: Level[] = ["beginner", "intermediate", "advanced", "expert"];
export const LEVEL_DIFFICULTY: Record<Level, Difficulty> = {
  beginner: "easy",
  intermediate: "medium",
  advanced: "hard",
  expert: "expert",
};

export type QuizMode = "quick" | "topic" | "daily" | "weekly" | "advanced" | "module" | "challenge";
export const QUIZ_MODES: QuizMode[] = ["quick", "topic", "daily", "weekly", "advanced", "module", "challenge"];

export type XpConfig = {
  /** Points for a correct answer, by difficulty. Score -> XP is score / scoreToXp. */
  base: Record<Difficulty, number>;
  /** Up to this fraction of `base` extra for answering instantly, falling to 0 at the time limit. */
  speedBonus: number;
  /** Consecutive correct answers from this run length on earn a streak bonus... */
  streakFrom: number;
  /** ...of this fraction per extra correct answer... */
  streakStep: number;
  /** ...capped here. */
  streakCap: number;
  /** Score points per 1 XP. */
  scoreToXp: number;
  /** Seconds allowed per question, by difficulty. */
  seconds: Record<Difficulty, number>;
  /** Flat XP for finishing with at least one correct answer, by mode. */
  modeBonus: Record<QuizMode, number>;
  /** Extra fraction of quiz XP for a perfect run (min 5 questions). */
  perfectBonus: number;
  /** Most quiz XP one member can earn in a UTC day (anti-farming). 0 = no cap. */
  dailyQuizCap: number;
  /** A question answered correctly for XP is worth 0 XP again for this many days. */
  repeatCooldownDays: number;
  /** XP for completing a learning module (passing its knowledge check). */
  module: number;
  /** Knowledge-check accuracy needed to complete a module, 0-100. */
  modulePass: number;
  /** XP per day of a continuing learning streak, and the milestone bonuses. */
  streakDay: number;
  streakMilestones: Record<string, number>;
  /** Live quiz: XP per point scored, and a bonus for the podium. */
  livePerPoint: number;
  livePodium: [number, number, number];
};

export const DEFAULT_XP: XpConfig = {
  base: { easy: 100, medium: 150, hard: 220, expert: 300 },
  speedBonus: 0.5,
  streakFrom: 3,
  streakStep: 0.1,
  streakCap: 0.5,
  scoreToXp: 10,
  seconds: { easy: 25, medium: 30, hard: 40, expert: 45 },
  modeBonus: { quick: 10, topic: 15, daily: 50, weekly: 150, advanced: 40, module: 0, challenge: 20 },
  perfectBonus: 0.25,
  dailyQuizCap: 2500,
  repeatCooldownDays: 7,
  module: 60,
  modulePass: 60,
  streakDay: 10,
  streakMilestones: { "3": 30, "7": 100, "14": 200, "30": 500 },
  livePerPoint: 0.1,
  livePodium: [300, 200, 100],
};

export type LevelDef = { name: string; xp: number };

export const DEFAULT_LEVELS: LevelDef[] = [
  { name: "Web3 Beginner", xp: 0 },
  { name: "Blockchain Explorer", xp: 300 },
  { name: "DeFi Learner", xp: 1_000 },
  { name: "Onchain Expert", xp: 2_500 },
  { name: "Web3 Master", xp: 6_000 },
  { name: "Crypto Legend", xp: 15_000 },
];

export type AwardRule = {
  /** How many top places receive a certificate. 0 turns the award off. */
  top: number;
  /** Minimum XP in the period to qualify, so a quiet day is not won with 10 XP. */
  minXp: number;
  /** true: issue on finalization. false: create as "pending" for an admin to approve. */
  auto: boolean;
};

export type AwardKind = "daily" | "weekly" | "monthly" | "live";

export const DEFAULT_AWARDS: Record<AwardKind, AwardRule> = {
  daily: { top: 1, minXp: 150, auto: true },
  weekly: { top: 3, minXp: 500, auto: true },
  monthly: { top: 3, minXp: 1500, auto: true },
  live: { top: 3, minXp: 0, auto: true },
};

export type AchievementCode =
  | "first_quiz"
  | "answers_100"
  | "answers_500"
  | "perfect_run"
  | "streak_7"
  | "streak_30"
  | "blockchain_expert"
  | "defi_specialist"
  | "trading_pro"
  | "security_guardian"
  | "live_champion"
  | "top_10"
  | "level_5"
  | "certified";

export type AchievementDef = {
  code: AchievementCode;
  title: string;
  description: string;
  icon: string; // lucide-react name
  xp: number;
  enabled: boolean;
};

export const DEFAULT_ACHIEVEMENTS: AchievementDef[] = [
  { code: "first_quiz", title: "First Quiz Completed", description: "Finish your first quiz.", icon: "Sparkles", xp: 25, enabled: true },
  { code: "answers_100", title: "100 Questions Answered", description: "Answer 100 questions.", icon: "ListChecks", xp: 100, enabled: true },
  { code: "answers_500", title: "500 Questions Answered", description: "Answer 500 questions.", icon: "Medal", xp: 300, enabled: true },
  { code: "perfect_run", title: "Flawless", description: "Get every answer right in a quiz of 10 or more.", icon: "Target", xp: 100, enabled: true },
  { code: "streak_7", title: "7-Day Learning Streak", description: "Learn on 7 days in a row.", icon: "Flame", xp: 100, enabled: true },
  { code: "streak_30", title: "30-Day Learning Streak", description: "Learn on 30 days in a row.", icon: "Flame", xp: 500, enabled: true },
  { code: "blockchain_expert", title: "Blockchain Expert", description: "Complete every Blockchain Fundamentals module.", icon: "Blocks", xp: 150, enabled: true },
  { code: "defi_specialist", title: "DeFi Specialist", description: "Complete every DeFi & Lending module.", icon: "Landmark", xp: 150, enabled: true },
  { code: "trading_pro", title: "Perp Pro", description: "Complete every DEX & Perpetual DEX module.", icon: "ArrowLeftRight", xp: 150, enabled: true },
  { code: "security_guardian", title: "Security Guardian", description: "Complete every Wallets & Security module.", icon: "ShieldCheck", xp: 150, enabled: true },
  { code: "live_champion", title: "Live Quiz Champion", description: "Win a live quiz.", icon: "Crown", xp: 250, enabled: true },
  { code: "top_10", title: "Top 10 Leaderboard", description: "Reach the all-time top 10.", icon: "Trophy", xp: 200, enabled: true },
  { code: "level_5", title: "Web3 Master", description: "Reach level 5.", icon: "GraduationCap", xp: 250, enabled: true },
  { code: "certified", title: "Certified", description: "Earn an official XYZ Crypto certificate.", icon: "BadgeCheck", xp: 100, enabled: true },
];

/** Which category's modules unlock which "complete them all" achievement. */
export const CATEGORY_ACHIEVEMENTS: Record<string, AchievementCode> = {
  "blockchain-fundamentals": "blockchain_expert",
  "defi-lending": "defi_specialist",
  "dex-perps": "trading_pro",
  "wallets-security": "security_guardian",
};

export type AcademyConfigShape = {
  xp: XpConfig;
  levels: LevelDef[];
  awards: Record<AwardKind, AwardRule>;
  achievements: AchievementDef[];
};

export const DEFAULT_CONFIG: AcademyConfigShape = {
  xp: DEFAULT_XP,
  levels: DEFAULT_LEVELS,
  awards: DEFAULT_AWARDS,
  achievements: DEFAULT_ACHIEVEMENTS,
};

/** Deep-ish merge of a stored override over a default object (one level of nesting). */
export function mergeConfig<T>(def: T, override: unknown): T {
  if (Array.isArray(def)) return (Array.isArray(override) && override.length ? override : def) as T;
  if (!override || typeof override !== "object" || Array.isArray(override)) return def;
  const out: Record<string, unknown> = { ...(def as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    if (!(k in out)) continue;
    const d = out[k];
    if (d && typeof d === "object" && !Array.isArray(d) && v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = { ...(d as object), ...(v as object) };
    } else if (typeof v === typeof d || (Array.isArray(d) && Array.isArray(v))) {
      out[k] = v;
    }
  }
  return out as T;
}

/** Achievements: stored list may toggle/retune known codes only; unknown codes are dropped. */
export function mergeAchievements(override: unknown): AchievementDef[] {
  if (!Array.isArray(override)) return DEFAULT_ACHIEVEMENTS;
  const by = new Map<string, Partial<AchievementDef>>();
  for (const a of override) if (a && typeof a === "object" && typeof (a as AchievementDef).code === "string") by.set((a as AchievementDef).code, a);
  return DEFAULT_ACHIEVEMENTS.map((d) => {
    const o = by.get(d.code);
    if (!o) return d;
    return {
      ...d,
      title: typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 60) : d.title,
      description: typeof o.description === "string" && o.description.trim() ? o.description.trim().slice(0, 140) : d.description,
      xp: typeof o.xp === "number" && Number.isFinite(o.xp) ? Math.max(0, Math.min(10_000, Math.round(o.xp))) : d.xp,
      enabled: typeof o.enabled === "boolean" ? o.enabled : d.enabled,
    };
  });
}
