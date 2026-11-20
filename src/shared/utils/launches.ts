// Product launches announced by the home-page popup (LaunchPopup). Newest
// first. A launch shows to each visitor once, for `days` after its date, then
// retires on its own. Admin "What's New" entries from the last week are shown
// after these, so day-to-day updates need no code change.
//
// Client-safe: plain data, no imports.

export type Launch = {
  id: string; // stable: a visitor who has seen it is keyed by this
  date: string; // YYYY-MM-DD, UTC
  days?: number; // how long it is announced (default 21)
  product: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  icon: "GraduationCap" | "AudioLines" | "Trophy" | "Coins" | "MessageSquareHeart" | "Sparkles";
};

export const LAUNCHES: Launch[] = [
  {
    id: "feedback-2026-11",
    date: "2026-11-20",
    product: "Feedback",
    title: "Tell us what to build next, earn XP",
    body: "A new feedback page: report a bug, share an idea, rate a feature. Every helpful note earns Academy XP.",
    href: "/feedback",
    cta: "Give feedback",
    icon: "MessageSquareHeart",
  },
  {
    id: "aneque-live-talk",
    date: "2026-11-20",
    product: "Academy",
    title: "Meet AneQue: talk to your Web3 tutor",
    body: "Ask anything out loud and AneQue answers in her own voice. Works in every browser, Hinglish too.",
    href: "/academy",
    cta: "Talk to AneQue",
    icon: "AudioLines",
  },
  {
    id: "academy-advanced-tracks",
    date: "2026-11-20",
    product: "Academy",
    title: "7 advanced tracks are live",
    body: "Perp DEX Masterclass, Airdrop Masterclass, on-chain trading, RWA, prop firms, AI and quantum. 46 lessons, quizzes for every one.",
    href: "/academy/learn",
    cta: "Start learning",
    icon: "GraduationCap",
  },
  {
    id: "creators-index",
    date: "2026-11-19",
    product: "Creators",
    title: "Creator Index: who is moving Variational",
    body: "Live X and YouTube leaderboards for perp DEX creators, plus the Arena game.",
    href: "/creators",
    cta: "See the index",
    icon: "Trophy",
  },
];

/** Launches still within their announcement window at `now`, newest first. Pure, for tests. */
export function activeLaunches(now: number, list: Launch[] = LAUNCHES): Launch[] {
  return list.filter((l) => {
    const start = Date.parse(`${l.date}T00:00:00Z`);
    return now >= start && now < start + (l.days ?? 21) * 86_400_000;
  });
}
