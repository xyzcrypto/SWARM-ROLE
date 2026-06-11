import { describe, it, expect } from "vitest";
import {
  normalizeUsername,
  normalizeHandle,
  profileSchema,
  passwordChangeSchema,
  RESERVED_USERNAMES,
  USERNAME_RE,
} from "@/lib/profile";

describe("normalizeUsername", () => {
  it("lowercases, trims and strips a leading @", () => {
    expect(normalizeUsername("  @Satoshi ")).toBe("satoshi");
    expect(normalizeUsername("@@Foo_99")).toBe("foo_99");
  });
});

describe("normalizeHandle", () => {
  it("strips a leading @", () => {
    expect(normalizeHandle("@vitalik")).toBe("vitalik");
  });
  it("extracts the handle from a full profile URL", () => {
    expect(normalizeHandle("https://x.com/XYZCryptos")).toBe("XYZCryptos");
    expect(normalizeHandle("https://github.com/torvalds")).toBe("torvalds");
    expect(normalizeHandle("https://t.me/X_Y_Z_Crypto")).toBe("X_Y_Z_Crypto");
  });
  it("drops trailing query/path noise", () => {
    expect(normalizeHandle("https://x.com/foo?ref=1")).toBe("foo");
    expect(normalizeHandle("bar/extra")).toBe("bar");
  });
  it("returns empty string for empty input", () => {
    expect(normalizeHandle("   ")).toBe("");
  });
});

describe("USERNAME_RE", () => {
  it("accepts valid handles", () => {
    expect(USERNAME_RE.test("satoshi")).toBe(true);
    expect(USERNAME_RE.test("foo_99")).toBe(true);
    expect(USERNAME_RE.test("abc")).toBe(true);
  });
  it("rejects too short / too long / bad chars", () => {
    expect(USERNAME_RE.test("ab")).toBe(false);
    expect(USERNAME_RE.test("a".repeat(21))).toBe(false);
    expect(USERNAME_RE.test("Has Space")).toBe(false);
    expect(USERNAME_RE.test("UPPER")).toBe(false);
    expect(USERNAME_RE.test("dash-no")).toBe(false);
  });
});

describe("profileSchema", () => {
  it("normalizes a username via @ and casing", () => {
    const out = profileSchema.parse({ username: "@Satoshi" });
    expect(out.username).toBe("satoshi");
  });

  it("rejects reserved handles", () => {
    expect(profileSchema.safeParse({ username: "admin" }).success).toBe(false);
    expect(profileSchema.safeParse({ username: "settings" }).success).toBe(false);
    // sanity: the reserved set is actually populated
    expect(RESERVED_USERNAMES.has("api")).toBe(true);
  });

  it("rejects an invalid username shape", () => {
    expect(profileSchema.safeParse({ username: "no" }).success).toBe(false);
    expect(profileSchema.safeParse({ username: "bad handle" }).success).toBe(false);
  });

  it("normalizes social handles from URLs and @", () => {
    const out = profileSchema.parse({
      twitter: "@me",
      github: "https://github.com/octocat",
      telegram: "  ",
    });
    expect(out.twitter).toBe("me");
    expect(out.github).toBe("octocat");
    // blank handle clears to undefined
    expect(out.telegram).toBeUndefined();
  });

  it("enforces bio + location length caps", () => {
    expect(profileSchema.safeParse({ bio: "x".repeat(281) }).success).toBe(false);
    expect(profileSchema.safeParse({ bio: "x".repeat(280) }).success).toBe(true);
    expect(profileSchema.safeParse({ location: "x".repeat(81) }).success).toBe(false);
  });

  it("validates website as a URL", () => {
    expect(profileSchema.safeParse({ website: "notaurl" }).success).toBe(false);
    expect(profileSchema.safeParse({ website: "https://xyz.io" }).success).toBe(true);
  });

  it("rejects an empty name but allows omitting it", () => {
    expect(profileSchema.safeParse({ name: "" }).success).toBe(false);
    expect(profileSchema.safeParse({}).success).toBe(true);
  });
});

describe("passwordChangeSchema", () => {
  it("requires a current password and a 6+ char new password", () => {
    expect(
      passwordChangeSchema.safeParse({ currentPassword: "x", newPassword: "abcdef" }).success
    ).toBe(true);
    expect(
      passwordChangeSchema.safeParse({ currentPassword: "", newPassword: "abcdef" }).success
    ).toBe(false);
    expect(
      passwordChangeSchema.safeParse({ currentPassword: "x", newPassword: "123" }).success
    ).toBe(false);
  });
});
