// XYZ Crypto x Bungee Funded Perps giveaway: the constants every part of the
// campaign shares (the lesson CTA, the entry form, the short links, the staff
// view). Client-safe: no server imports.

export const BUNGEE_CAMPAIGN = "bungee-10k-2026";

/** The Academy track the giveaway is built on (seeded from content/bungee-funded-perps.json). */
export const BUNGEE_CATEGORY = "bungee-funded-perps";
export const BUNGEE_LAST_MODULE = "funded-account-payouts-and-your-plan";

/** XYZ Crypto's referral link and checkout code on Bungee. */
export const BUNGEE_REF_URL = "https://www.bungee.exchange/dashboard/evaluations?ref=XYZCRYPTO";
export const BUNGEE_CODE = "XYZCRYPTO";

/** Short, shareable links. */
export const BUNGEE_LINKS = {
  giveaway: "/bungee",
  learn: "/bungee/learn",
  live: "/bungee/live",
} as const;

export const BUNGEE_LEARN_PATH = `/academy/learn/${BUNGEE_CATEGORY}`;

export const BUNGEE_PRIZE = "3x $10K Bungee Funded Perps accounts";

/** Answers faster than this after a live question opens cannot be a person reading it. */
export const MIN_HUMAN_ANSWER_MS = 800;

/** Telegram username (5-32 of a-z, 0-9, _) with or without @, or a numeric user id. */
export function normalizeTelegram(raw: string): string | null {
  const t = raw.trim().replace(/^(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.me\//i, "").replace(/\/+$/, "").replace(/^@/, "");
  if (/^\d{5,15}$/.test(t)) return t;
  if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(t)) return `@${t}`;
  return null;
}

/** Bungee account id as shown in the dashboard: letters, digits, dash, underscore, dot. */
export function normalizeBungeeUid(raw: string): string | null {
  const t = raw.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/.test(t) ? t : null;
}
