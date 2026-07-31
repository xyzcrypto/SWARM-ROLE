import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fg from "fast-glob";
import {
  ACTIVITY_SOURCE,
  tradeActivitySource,
  challengeActivitySource,
  tradeActivityWhere,
  challengeActivityWhere,
} from "../journal-activity";

// Publishing to the public Journal Activity feed must be REVOCABLE.
//
// Before `sourceType`/`sourceId` existed, an activity row could not be traced
// back to what produced it: the title is pre-rendered text like "Closed BTC long
// with a win", which collides with every other BTC long. So setting a trade back
// to private, or deleting it outright, left a publicly readable row naming the
// symbol and the outcome, permanently, with no way to take it down. Consent was
// captured once and could never be withdrawn.
//
// Two things have to hold for revocation to work, and the second is the one that
// rots silently:
//   1. every revocation path deletes by source  (covered by the unit tests below)
//   2. every CREATE path records a source       (covered by the structural test)
//
// If (2) is ever missed on a new activity type, nothing fails - the row is simply
// created without a source and becomes permanently unrevocable, exactly the bug
// this fixes. Hence a test that reads the call sites.

describe("source builders", () => {
  it("tags rows with a stable source type", () => {
    // These strings are persisted, so changing them orphans existing rows.
    expect(ACTIVITY_SOURCE.trade).toBe("trade");
    expect(ACTIVITY_SOURCE.challenge).toBe("challenge");
    expect(tradeActivitySource("t1")).toEqual({ sourceType: "trade", sourceId: "t1" });
    expect(challengeActivitySource("c1")).toEqual({ sourceType: "challenge", sourceId: "c1" });
  });

  it("does NOT include userId in the create fragment", () => {
    // It used to. Spreading it into `create` collided with the userId already
    // being set there and silently overwrote it (TS2783). Keeping the write and
    // delete shapes distinct is what makes that impossible.
    expect(tradeActivitySource("t1")).not.toHaveProperty("userId");
    expect(challengeActivitySource("c1")).not.toHaveProperty("userId");
  });
});

describe("revocation scoping", () => {
  it("scopes trade revocation to the owner", () => {
    expect(tradeActivityWhere("t1", "u1")).toEqual({
      sourceType: "trade",
      sourceId: "t1",
      userId: "u1",
    });
  });

  it("does NOT scope challenge revocation by user", () => {
    // Participants' "Joined <title>" and milestone rows are owned by OTHER users
    // but embed the challenge title, so the owner making the challenge private
    // has to revoke those too. Adding a userId here would silently leave every
    // participant's row published.
    expect(challengeActivityWhere("c1")).toEqual({
      sourceType: "challenge",
      sourceId: "c1",
    });
    expect(challengeActivityWhere("c1")).not.toHaveProperty("userId");
  });
});

describe("every activity create site records a source", () => {
  const files = fg.sync("src/app/api/**/route.ts", { cwd: process.cwd() });
  // `prisma.journalActivity\n  .create({...})` spans lines - flatten first.
  const creates = files.flatMap((file) => {
    const flat = readFileSync(join(process.cwd(), file), "utf8").replace(/\s+/g, " ");
    return [...flat.matchAll(/prisma\.journalActivity\s*\.create\(([^;]*?)\)\s*\./g)].map((m) => ({
      file,
      body: m[1]!,
    }));
  });

  it("finds the create sites (guards against a silently empty sweep)", () => {
    expect(creates.length).toBeGreaterThanOrEqual(6);
  });

  it("passes a source builder at every one", () => {
    const missing = creates
      .filter((c) => !/ActivitySource\(/.test(c.body))
      .map((c) => c.file);
    expect(missing).toEqual([]);
  });
});
