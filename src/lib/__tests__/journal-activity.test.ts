import { describe, expect, it } from "vitest";
import {
  activityForChallengeCompleted,
  activityForChallengeCreated,
  activityForChallengeJoined,
  activityForMilestone,
  activityForTradeClosed,
  activityForTradeOpened,
} from "../journal-activity";

describe("journal-activity content builders", () => {
  it("builds trade_opened copy with symbol and side", () => {
    expect(activityForTradeOpened("BTC", "long")).toEqual({ type: "trade_opened", title: "Opened a new BTC long trade" });
  });

  it("builds trade_closed copy with a win/loss sign, never a dollar amount", () => {
    const win = activityForTradeClosed("ETH", "short", true);
    expect(win).toEqual({ type: "trade_closed", title: "Closed ETH short with a win", win: true });
    const loss = activityForTradeClosed("ETH", "short", false);
    expect(loss.win).toBe(false);
    expect(loss.title).not.toMatch(/\$/);
    expect(win.title).not.toMatch(/\$/);
  });

  it("builds challenge_created copy", () => {
    expect(activityForChallengeCreated("90-Day Reset")).toEqual({ type: "challenge_created", title: "Started a new challenge: 90-Day Reset" });
  });

  it("builds challenge_joined copy", () => {
    expect(activityForChallengeJoined("90-Day Reset")).toEqual({ type: "challenge_joined", title: "Joined the challenge: 90-Day Reset" });
  });

  it("builds challenge_milestone copy", () => {
    expect(activityForMilestone("90-Day Reset", "Halfway review")).toEqual({
      type: "challenge_milestone",
      title: "Hit a milestone in 90-Day Reset: Halfway review",
    });
  });

  it("builds challenge_completed copy", () => {
    expect(activityForChallengeCompleted("90-Day Reset")).toEqual({ type: "challenge_completed", title: "Completed the challenge: 90-Day Reset" });
  });
});
