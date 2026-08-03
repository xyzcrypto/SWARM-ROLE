import { describe, it, expect } from "vitest";
import { formatDate, formatDateWithDay, formatDateTime } from "@/lib/utils";

/**
 * The bug these guard against was a hydration failure, not a formatting nit.
 *
 * These stamps render inside server-rendered surfaces. Vercel runs UTC and the
 * reader's browser does not, so a timestamp near midnight used to format to a
 * different calendar day on each side - measured on /settings from an IST
 * browser, the server sent "Aug 2, 2026" and the client rendered "Aug 3, 2026".
 * React treats a text difference as a hard hydration failure (#418) and
 * recovers by discarding the server-rendered subtree.
 *
 * The test works by moving the process timezone, which is the only thing that
 * differed between the two sides.
 */
const withTZ = <T,>(tz: string, fn: () => T): T => {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    process.env.TZ = prev;
  }
};

// Deliberately just before UTC midnight: this is the instant where a
// timezone-dependent formatter disagrees with itself.
const LATE = "2026-08-02T23:30:00.000Z";
const ZONES = ["UTC", "Asia/Kolkata", "America/Los_Angeles", "Pacific/Kiritimati"];

describe("date formatters are timezone-independent", () => {
  it("formatDate reads the same in every timezone", () => {
    const seen = new Set(ZONES.map((tz) => withTZ(tz, () => formatDate(LATE))));
    expect([...seen]).toEqual(["Aug 2, 2026"]);
  });

  it("formatDateWithDay reads the same in every timezone", () => {
    const seen = new Set(ZONES.map((tz) => withTZ(tz, () => formatDateWithDay(LATE))));
    expect(seen.size).toBe(1);
  });

  it("formatDateTime reads the same in every timezone", () => {
    const seen = new Set(ZONES.map((tz) => withTZ(tz, () => formatDateTime(LATE))));
    expect(seen.size).toBe(1);
  });

  it("still handles a null date", () => {
    expect(formatDateTime(null)).toBe("Never");
  });

  it("would have caught the original bug", () => {
    // Same instant, same options, but without the timeZone pin - the shape the
    // code had before. Kept as a live demonstration that the zones chosen here
    // actually do disagree, so the assertions above are not vacuous.
    const unpinned = (tz: string) =>
      withTZ(tz, () =>
        new Date(LATE).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      );
    expect(new Set(ZONES.map(unpinned)).size).toBeGreaterThan(1);
  });
});
