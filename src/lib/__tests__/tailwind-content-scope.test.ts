import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Tailwind's scanner reads every `content` file as plain text and compiles
// anything class-shaped into CSS - regex literals in tests included. A test
// asserting `/\[@media\(hover:none\)\]:h-11/` became the "class"
// `[@media\(hover:none\)\]:h-11`, compiled into the invalid at-rule
// `@media\(hover:none\)\undefined`, and every build from #363 on printed
// "Parsing CSS source code failed". Nothing failed, so nothing noticed.
describe("Tailwind never scans test files", () => {
  const cfg = readFileSync("tailwind.config.ts", "utf8");

  it("still scans the whole of src", () => {
    expect(cfg).toMatch(/"\.\/src\/\*\*\/\*\.\{js,ts,jsx,tsx,mdx\}"/);
  });

  it("excludes __tests__ folders and *.test files", () => {
    expect(cfg).toMatch(/"!\.\/src\/\*\*\/__tests__\/\*\*"/);
    expect(cfg).toMatch(/"!\.\/src\/\*\*\/\*\.test\.\{js,ts,jsx,tsx\}"/);
  });
});
