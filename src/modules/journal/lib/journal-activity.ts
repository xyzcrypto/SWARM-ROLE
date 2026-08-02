// Content/privacy policy for the public "Journal Activity" feed - pure
// builder functions, no DB/React (same style as challenge.ts/risk.ts). Each
// builder returns exactly what's safe to store/display: symbol + side are
// shown only because the caller already gated on that specific trade's own
// `visibility === "public"`, and dollar amounts are NEVER included, anywhere -
// stricter than even the opt-in share cards (see src/app/api/journal/share/*).

export type ActivityContent = { type: string; title: string; win?: boolean };

export function activityForTradeOpened(symbol: string, side: string): ActivityContent {
  return { type: "trade_opened", title: `Opened a new ${symbol} ${side} trade` };
}

export function activityForTradeClosed(symbol: string, side: string, win: boolean): ActivityContent {
  return { type: "trade_closed", title: `Closed ${symbol} ${side} with a ${win ? "win" : "loss"}`, win };
}

export function activityForChallengeCreated(title: string): ActivityContent {
  return { type: "challenge_created", title: `Started a new challenge: ${title}` };
}

export function activityForChallengeJoined(title: string): ActivityContent {
  return { type: "challenge_joined", title: `Joined the challenge: ${title}` };
}

export function activityForMilestone(challengeTitle: string, label: string): ActivityContent {
  return { type: "challenge_milestone", title: `Hit a milestone in ${challengeTitle}: ${label}` };
}

export function activityForChallengeCompleted(title: string): ActivityContent {
  return { type: "challenge_completed", title: `Completed the challenge: ${title}` };
}

/**
 * What produced an activity row, recorded on `JournalActivity.sourceType` so the
 * row can be removed when its source is made private or deleted.
 *
 * Publishing to the public feed has to be REVOCABLE. Before this existed, a row
 * could not be traced back to what created it - the title is pre-rendered text
 * like "Closed BTC long with a win", which collides with every other BTC long -
 * so setting a trade back to private left the row up permanently.
 *
 * Scoping rules for revocation, which differ by source and are not obvious:
 *  - `trade`     → delete by `sourceId` AND `userId`. A trade has one owner.
 *  - `challenge` → delete by `sourceId` ONLY, across all users. Participants'
 *    "Joined <title>" and milestone rows are derived from the challenge and
 *    embed its title, so the challenge owner making it private must revoke
 *    those too, even though another user owns the row.
 */
export const ACTIVITY_SOURCE = { trade: "trade", challenge: "challenge" } as const;
export type ActivitySource = (typeof ACTIVITY_SOURCE)[keyof typeof ACTIVITY_SOURCE];

/** `data` fragment for creating an activity row from a trade. */
export function tradeActivitySource(tradeId: string) {
  return { sourceType: ACTIVITY_SOURCE.trade, sourceId: tradeId };
}

/** `data` fragment for creating an activity row from a challenge. */
export function challengeActivitySource(challengeId: string) {
  return { sourceType: ACTIVITY_SOURCE.challenge, sourceId: challengeId };
}

/** `where` for every activity row derived from one trade. Scoped to its owner. */
export function tradeActivityWhere(tradeId: string, userId: string) {
  return { sourceType: ACTIVITY_SOURCE.trade, sourceId: tradeId, userId };
}

/**
 * `where` for every activity row derived from one challenge, **across all users**.
 * Participants' "Joined <title>" and milestone rows embed the challenge title, so
 * the owner making it private has to revoke those too even though someone else
 * owns the row. Deliberately NOT scoped by userId - see the callers.
 */
export function challengeActivityWhere(challengeId: string) {
  return { sourceType: ACTIVITY_SOURCE.challenge, sourceId: challengeId };
}
