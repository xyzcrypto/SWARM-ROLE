import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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

describe("keyboard navigation keeps the highlighted row on screen", () => {
  // Real source path on purpose: `src/components/*` is a re-export shim.
  const P = readFileSync("src/shared/components/CommandPalette.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

  it("scrolls the active row into view", () => {
    // Nothing did. A full result set is one action + up to 5 coins + 6 research
    // posts + 5 news items in a scrolling panel, so holding ArrowDown moved the
    // highlight past the fold and Enter opened a result the reader could not
    // see - while the footer advertised "↑↓ navigate".
    expect(P).toMatch(/querySelector<HTMLElement>\(`\[data-row="\$\{active\}"\]`\)\?\.scrollIntoView\(\{ block: "nearest" \}\)/);
  });

  it("labels each row with its index into `rows`", () => {
    expect(P).toMatch(/data-row=\{i\}/);
  });

  it("holds a ref to the scrolling list", () => {
    expect(P).toMatch(/const listRef = useRef<HTMLDivElement>\(null\)/);
    expect(P).toMatch(/<div ref=\{listRef\} className="flex-1 overflow-y-auto/);
  });
});
