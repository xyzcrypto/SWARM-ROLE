// Feedback rules shared by the server and the /feedback page. Client-safe:
// plain data and pure functions only.

export const CATEGORIES = [
  { id: "bug", label: "Bug", hint: "Something broke or looks wrong", emoji: "🐞" },
  { id: "idea", label: "Idea", hint: "A feature you want next", emoji: "💡" },
  { id: "design", label: "Design", hint: "Layout, colours, mobile", emoji: "🎨" },
  { id: "content", label: "Content", hint: "Research, news, lessons", emoji: "📚" },
  { id: "praise", label: "Praise", hint: "Something you love", emoji: "💛" },
  { id: "other", label: "Other", hint: "Anything else", emoji: "✨" },
] as const;

export type Category = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [Category, ...Category[]];

export const STATUSES = ["new", "seen", "done"] as const;
export type Status = (typeof STATUSES)[number];

export const MIN_MESSAGE = 12;
export const MAX_MESSAGE = 2000;

/** XP for the first feedback of each UTC day (members only). */
export const XP_DAILY = 40;
/** One-time bonus on a member's very first feedback. */
export const XP_FIRST = 60;
/** Paid when staff mark a member's feedback "done" (it shipped or was fixed). */
export const XP_SHIPPED = 100;

/**
 * 0-100 "how useful will this be" meter shown while typing. Rewards length up
 * to a point, a few concrete details (where, steps, numbers) and penalises
 * shouting. Pure, so the page and the tests agree.
 */
export function quality(message: string): number {
  const t = message.trim();
  if (!t) return 0;
  const words = t.split(/\s+/).filter(Boolean).length;
  let score = Math.min(55, words * 2.2);
  if (/\b(when|after|before|steps?|page|button|mobile|desktop|iphone|android|chrome|safari|brave)\b/i.test(t)) score += 15;
  if (/\d/.test(t)) score += 8;
  if (/[.!?]\s+\S/.test(t)) score += 10; // more than one sentence
  if (/\b(because|so that|would|could|should|instead)\b/i.test(t)) score += 12;
  const letters = t.replace(/[^a-z]/gi, "");
  if (letters.length > 12 && letters === letters.toUpperCase()) score -= 30;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export type BadgeCode = "first" | "bug-hunter" | "idea-machine" | "community-voice" | "shipped";

export const BADGES: { code: BadgeCode; title: string; hint: string; emoji: string }[] = [
  { code: "first", title: "First Feedback", hint: "Send your first note", emoji: "🌱" },
  { code: "bug-hunter", title: "Bug Hunter", hint: "Report 3 bugs", emoji: "🐞" },
  { code: "idea-machine", title: "Idea Machine", hint: "Share 3 ideas", emoji: "💡" },
  { code: "community-voice", title: "Community Voice", hint: "Send 10 notes", emoji: "📣" },
  { code: "shipped", title: "Shipped It", hint: "Get one marked done", emoji: "🚀" },
];

export function badgesFor(items: { category: string; status: string }[]): BadgeCode[] {
  const n = (c: string) => items.filter((i) => i.category === c).length;
  const out: BadgeCode[] = [];
  if (items.length >= 1) out.push("first");
  if (n("bug") >= 3) out.push("bug-hunter");
  if (n("idea") >= 3) out.push("idea-machine");
  if (items.length >= 10) out.push("community-voice");
  if (items.some((i) => i.status === "done")) out.push("shipped");
  return out;
}
