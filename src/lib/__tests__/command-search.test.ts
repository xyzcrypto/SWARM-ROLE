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
    expect(scoreCommand({ label: "Ask XYZ AI", keywords: [] }, "")).toBe(1);
  });
});

describe("filterCommands (content-search: only the Ask AI action is static)", () => {
  const guest = { loggedIn: false, staff: false };

  it("has exactly one static action - Ask XYZ AI - and no page shortcuts", () => {
    expect(STATIC_COMMANDS).toHaveLength(1);
    expect(STATIC_COMMANDS[0].id).toBe("ask-ai");
    expect(STATIC_COMMANDS.some((c) => c.group === "pages")).toBe(false);
  });
  it("surfaces Ask AI on an empty query and for an ai query", () => {
    expect(filterCommands("", guest).map((c) => c.id)).toEqual(["ask-ai"]);
    expect(filterCommands("ai", guest).map((c) => c.id)).toEqual(["ask-ai"]);
  });
  it("returns nothing for a content query (coins/news handled by live sources)", () => {
    expect(filterCommands("ethereum", guest)).toHaveLength(0);
  });
});
