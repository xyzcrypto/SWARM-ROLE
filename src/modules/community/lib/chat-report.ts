/**
 * The reasons a member may report a chat message.
 *
 * ⚠️ This lives HERE, not in the route file, and that is a correctness fix
 * rather than tidiness. A Next.js route module may only export HTTP handlers
 * and segment config (`dynamic`, `revalidate`, ...). Exporting this constant
 * from `api/chat/messages/[id]/report/route.ts` was tolerated by the Turbopack
 * build and REJECTED by the webpack build's route-type validation - found by
 * building a test harness with webpack. Invalid under one builder is invalid.
 *
 * One list, used by both the server's validation and the dialog's labels, so a
 * reason can never be offered in the UI that the server then refuses.
 */
export const REPORT_REASONS = ["harassment", "spam", "scam", "threat", "illegal", "other"] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];
