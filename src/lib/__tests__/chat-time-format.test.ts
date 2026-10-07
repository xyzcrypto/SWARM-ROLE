import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { clockTime, dayLabel } from "@shared/utils/chat-time";
import { formatDate, formatDateTime, formatDateWithDay } from "@shared/utils/utils";

// PR 3: the date helpers now reuse one Intl.DateTimeFormat instead of calling
// `toLocale*String`, which builds a new one on every call. That was 58ms of a
// 100ms keystroke in a 150-message DM. The only acceptable version of that
// change is one whose output is byte-for-byte what it replaced - a different
// string between server and client is a hydration failure (#418) - so this
// compares against the old implementation directly, over thousands of dates.

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = prng(0x5eed);
const DATES = Array.from({ length: 3000 }, () => new Date(Date.UTC(2020, 0, 1) + Math.floor(rand() * 10 * 365 * 864e5)).toISOString());

// The previous implementations, verbatim.
const old = {
  clock: (iso: string, local: boolean) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: local ? undefined : "UTC" }),
  day: (iso: string, local: boolean, now: number) => {
    const d = new Date(iso);
    const zone = local ? undefined : "UTC";
    const dayKey = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: zone });
    if (dayKey(d) === dayKey(new Date(now))) return "Today";
    if (dayKey(d) === dayKey(new Date(now - 864e5))) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: zone });
  },
  date: (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }),
  withDay: (d: string) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }),
  dateTime: (d: string) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }),
};

describe("cached formatters say exactly what toLocale*String said", () => {
  for (const local of [false, true]) {
    it(`clockTime, local=${local}`, () => {
      for (const iso of DATES) expect(clockTime(iso, local), iso).toBe(old.clock(iso, local));
    });
    it(`dayLabel, local=${local}, including Today and Yesterday`, () => {
      for (const iso of DATES) {
        const t = new Date(iso).getTime();
        // Around the message itself, so Today/Yesterday are actually hit.
        for (const now of [t, t + 864e5, t + 3 * 864e5, t + 5 * 3600e3]) {
          expect(dayLabel(iso, local, now), `${iso} @ ${now}`).toBe(old.day(iso, local, now));
        }
      }
      // The toLocale*String reference is slow (it builds a formatter per call), and
      // under the full parallel run this took 5.2-6.1s, failing on the 5s default.
    }, 30_000);
  }

  it("formatDate / formatDateWithDay / formatDateTime", () => {
    for (const iso of DATES) {
      expect(formatDate(iso)).toBe(old.date(iso));
      expect(formatDateWithDay(iso)).toBe(old.withDay(iso));
      expect(formatDateTime(iso)).toBe(old.dateTime(iso));
    }
    expect(formatDateTime(null)).toBe("Never");
  });

  it("a malformed timestamp still renders 'Invalid Date' instead of throwing", () => {
    // `Intl.DateTimeFormat#format` throws a RangeError where toLocale*String
    // quietly returned "Invalid Date" - one bad row must not crash a list.
    for (const bad of ["", "not a date", "2026-13-45T99:00:00Z"]) {
      expect(clockTime(bad, false)).toBe(old.clock(bad, false));
      expect(dayLabel(bad, true, Date.now())).toBe(old.day(bad, true, Date.now()));
      expect(formatDate(bad)).toBe(old.date(bad));
      // "" is `!date`, which has always meant "Never" - unchanged.
      expect(formatDateTime(bad)).toBe(bad ? old.dateTime(bad) : "Never");
    }
  });

  it("neither helper builds a formatter per call any more", () => {
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
    for (const f of ["src/shared/utils/chat-time.ts", "src/shared/utils/utils.ts"]) {
      expect(strip(readFileSync(f, "utf8")), f).not.toMatch(/\.toLocale(Date|Time)?String\(\s*"en-/);
    }
  });
});
