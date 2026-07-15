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
