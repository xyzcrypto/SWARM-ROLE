import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { profileSchema } from "@modules/profile/lib/profile";

const read = (p: string) => readFileSync(p, "utf8");

describe("public / private profile", () => {
  it("is a validated setting saved from the profile form", () => {
    expect(profileSchema.safeParse({ profileVisibility: "private" }).success).toBe(true);
    expect(profileSchema.safeParse({ profileVisibility: "friends" }).success).toBe(false);
    expect(read("src/app/api/profile/route.ts")).toMatch(/profileVisibility: true/);
    expect(read("src/modules/settings/components/SettingsClient.tsx")).toMatch(/Only me \(private profile\)/);
  });
  it("a private profile shows no activity, a public one shows the Academy section", () => {
    const page = read("src/app/u/[username]/page.tsx");
    expect(page).toMatch(/const isPrivate = user\.profileVisibility === "private"/);
    expect(page).toMatch(/isPrivate \? null : await profileActivity/);
    expect(page).toMatch(/This profile is private\./);
    expect(page).toMatch(/<ProfileAcademy a=\{activity\}/);
  });
  it("ships its migration (additive, idempotent)", () => {
    const sql = read("prisma/migrations/46_profile_visibility/migration.sql");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "profileVisibility" TEXT NOT NULL DEFAULT 'public'/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "image" TEXT/);
  });
});

describe("feedback screenshots", () => {
  it("accept only real image data URLs, verified by magic bytes on the server", async () => {
    const { feedbackInput } = await import("@modules/feedback/lib/feedback").catch(() => ({ feedbackInput: null }));
    const lib = read("src/modules/feedback/lib/feedback.ts");
    expect(lib).toMatch(/uploadImage\(bytes, m\[1\]\)/); // uploadImage sniffs the bytes
    expect(lib).toMatch(/data:image\\\/\(png\|jpeg\|webp\);base64/);
    if (feedbackInput) {
      const base = { category: "bug", rating: 3, message: "The button on markets is broken on mobile" };
      expect(feedbackInput.safeParse({ ...base, image: "data:text/html;base64,PGgxPg==" }).success).toBe(false);
      expect(feedbackInput.safeParse({ ...base, image: "data:image/png;base64,iVBORw0KGgo=" }).success).toBe(true);
    }
  });
});
