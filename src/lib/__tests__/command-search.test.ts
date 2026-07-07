import { describe, expect, it } from "vitest";
import { scoreCommand, filterCommands, STATIC_COMMANDS } from "@/lib/command-search";

describe("scoreCommand", () => {
  it("ranks prefix matches above substring above keyword", () => {
    const item = { label: "Markets", keywords: ["price", "coins"] };
    expect(scoreCommand(item, "mar")).toBe(4); // label prefix
    expect(scoreCommand(item, "ket")).toBe(2); // label substring
    expect(scoreCommand(item, "coin")).toBe(1); // keyword
    expect(scoreCommand(item, "xyz")).toBe(0); // no match
  });
  it("treats an empty query as browse-all", () => {
    expect(scoreCommand({ label: "Home", keywords: [] }, "")).toBe(1);
  });
  it("matches a non-first word by prefix", () => {
    expect(scoreCommand({ label: "Admin Dashboard", keywords: [] }, "dash")).toBe(3);
  });
});

describe("filterCommands", () => {
  const guest = { loggedIn: false, staff: false };
  const member = { loggedIn: true, staff: false };
  const staff = { loggedIn: true, staff: true };

  it("hides auth-only and staff-only items from guests", () => {
    const ids = filterCommands("", guest).map((c) => c.id);
    expect(ids).not.toContain("settings");
    expect(ids).not.toContain("dashboard");
    expect(ids).toContain("markets");
  });
  it("shows settings to members but not the dashboard", () => {
    const ids = filterCommands("", member).map((c) => c.id);
    expect(ids).toContain("settings");
    expect(ids).not.toContain("dashboard");
  });
  it("shows the dashboard to staff", () => {
    expect(filterCommands("", staff).map((c) => c.id)).toContain("dashboard");
  });
  it("ranks and filters by query", () => {
    const res = filterCommands("ai", staff);
    expect(res[0].id).toBe("ask-ai");
  });
  it("returns nothing for a no-match query", () => {
    expect(filterCommands("zzzzz", staff)).toHaveLength(0);
  });
  it("STATIC_COMMANDS all have unique ids", () => {
    const ids = STATIC_COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
