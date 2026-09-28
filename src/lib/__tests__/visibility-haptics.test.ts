import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (f: string) => readFileSync(f, "utf8");
const css = read("src/app/globals.css");

describe("light theme: everything is visible (2026-09-28 contrast audit)", () => {
  it("legal-page links use the readable green (was mint-600, 3.37:1)", () => {
    expect(css).toMatch(/html:not\(\.dark\) \.prose-xyz a \{ color: var\(--data-up\);/);
    expect(css).not.toMatch(/html:not\(\.dark\) \.prose-xyz a \{ color: #039567/);
  });
  it("the Points disclaimer's amber opacity variants are covered", () => {
    expect(css).toMatch(/html:not\(\.dark\) \.text-amber-200\\\/90, html:not\(\.dark\) \.text-amber-200\\\/80 \{ color: #8a4b09; \}/);
  });
  it("the cream eyebrow word is dark on light", () => {
    expect(css).toMatch(/html:not\(\.dark\) \.text-\\\[\\#fdf7e7\\\] \{ color: #26262c; \}/);
  });
  it("the empty-state panels are a surface, not a grey slab", () => {
    expect(css).toMatch(/html:not\(\.dark\) \.bg-ink-700\\\/40 \{ background-color: var\(--surface-2\); \}/);
  });
  it("the coming-soon veil is light on the light theme", () => {
    expect(css).toMatch(/html:not\(\.dark\) \.soon-veil \{/);
    expect(read("src/modules/points/components/MyAirdropsCard.tsx")).toMatch(/soon-veil absolute inset-0/);
  });
  it("the Coming Soon pill keeps white text on its dark pill in both themes", () => {
    expect(read("src/modules/points/components/FeaturedProgramsBar.tsx")).toMatch(/bg-black\/60 px-3 py-1 text-\[11px\] font-semibold text-\[#fff\]/);
  });
});

describe("the orbit's labelled links are always readable", () => {
  it("they float without fading (floatY fades to 25% opacity - dust, not labels)", () => {
    const orb = read("src/components/OrbitalEcosystem.tsx");
    expect(orb).toMatch(/className="motion-decor orbit-node" style=\{\{ animation: `floatNode /);
    expect(orb).not.toMatch(/className="motion-decor" style=\{\{ animation: `floatY/);
    const node = /@keyframes floatNode \{[\s\S]*?\n\}/.exec(css)?.[0] ?? "";
    expect(node).not.toBe("");
    expect(node).not.toMatch(/opacity/);
  });
  it("Background effects: Off never hides them - they are navigation", () => {
    expect(css).toMatch(/html\.no-effects \.motion-decor:not\(\.orbit-node\)/);
  });
});

describe("haptics on the entire website", () => {
  it("one passive, capture-phase listener on the document, mounted in the root layout", () => {
    const g = read("src/shared/components/GlobalPressFeedback.tsx");
    expect(g).toMatch(/document\.addEventListener\("pointerdown", on, \{ capture: true, passive: true \}\)/);
    expect(read("src/app/layout.tsx")).toMatch(/<GlobalPressFeedback \/>/);
  });
  it("each press is handled once, however many listeners see it", () => {
    const f = read("src/shared/utils/chat-feedback.ts");
    expect(f).toMatch(/if \(e\.__xyzPress\) return;\s*e\.__xyzPress = true;/);
    expect(f).toMatch(/export function chatPressFeedback\(e: ReactPointerEvent<HTMLElement>\): void \{\s*pressFeedback\(e\.nativeEvent\);/);
  });
});

describe("remove a bookmark from the profile", () => {
  it("owner only, optimistic, restored on failure", () => {
    const lib = read("src/modules/profile/components/ProfileLibrary.tsx");
    expect(lib).toMatch(/onRemove=\{isOwner \? \(\) => void remove\(b\) : undefined\}/);
    expect(lib).toMatch(/method: "DELETE"/);
    expect(lib).toMatch(/if \(!r\?\.ok\) \{\s*setItems\(before\);/);
  });
});

describe("large text size never pushes the page sideways", () => {
  it("125% is capped only where the layout measurably overflowed", () => {
    expect(css).toMatch(/@media \(max-width: 379px\) \{ html\.text-scale-125 \{ font-size: 110%; \} \}/);
    expect(css).toMatch(/@media \(min-width: 1280px\) and \(max-width: 1439px\) \{ html\.text-scale-125 \{ font-size: 118\.75%; \} \}/);
    // Everywhere else the reader gets exactly what they picked.
    expect(css).toMatch(/html\.text-scale-125 \{ font-size: 125%; \}/);
  });
  it("the Communities grid bounds its single column (min-content would overflow)", () => {
    const eco = read("src/components/Ecosystem.tsx");
    expect(eco).toMatch(/grid grid-cols-1 gap-5/);
    expect(eco).toMatch(/mono truncate text-xs text-zinc-500">\{b\.handle\}/);
  });
});
