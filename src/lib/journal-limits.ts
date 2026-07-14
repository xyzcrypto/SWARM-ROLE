// Trading OS Phase 6 - Free vs Premium tiering. Reuses the existing
// `membership` field (already gates AI limits and premium research) rather
// than building a new entitlements system. Free members get real value
// (unlimited trade logging, core stats, one active challenge); Premium
// unlocks the deep analytics dashboard and unlimited challenges.

export type Membership = "Free" | "Premium";

export const JOURNAL_LIMITS = {
  Free: { maxActiveChallenges: 1, fullAnalytics: false },
  Premium: { maxActiveChallenges: Infinity, fullAnalytics: true },
} as const;

export function journalLimitsFor(membership: string | null | undefined) {
  return membership === "Premium" ? JOURNAL_LIMITS.Premium : JOURNAL_LIMITS.Free;
}

export function isPremiumMember(membership: string | null | undefined): boolean {
  return membership === "Premium";
}
