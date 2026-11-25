import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("Academy UI step 4: lessons", () => {
  const lesson = read("src/modules/academy/components/LessonView.tsx");
  const fc = read("src/modules/academy/components/Flashcards.tsx");
  const rp = read("src/modules/academy/components/ReadingProgress.tsx");
  const css = read("src/app/academy/academy.css");

  it("every lesson gets a reading progress bar and a flashcard deck of its key concepts", () => {
    expect(lesson).toMatch(/<ReadingProgress \/>/);
    expect(lesson).toMatch(/<Flashcards lessonId=\{lesson\.id\} cards=\{lesson\.concepts\.map/);
  });

  it("the progress bar moves by transform from a rAF-throttled passive listener, never a React render", () => {
    expect(rp).toMatch(/requestAnimationFrame\(read\)/);
    expect(rp).toMatch(/\{ passive: true \}/);
    expect(rp).toMatch(/style\.transform = `scaleX\(/);
    expect(rp).not.toMatch(/useState/);
  });

  it("the deck renders nothing until opened (no server/client mismatch) and keeps progress on the device", () => {
    expect(fc).toMatch(/\{open &&\s*createPortal\(/);
    expect(fc).toMatch(/xyz:academy:flash:\$\{id\}/);
    expect(fc).toMatch(/e\.key === "Escape"/);
    expect(fc).toMatch(/document\.body\.style\.overflow = prev;/);
  });

  it("the deck is dark in both themes and never uses classes the light theme remaps", () => {
    expect(fc).not.toMatch(/text-white|bg-white/);
    expect(css).toMatch(/\.acad-flash \.fc-ink \{ color: #fff; \}/);
  });

  it("the card flip is 3D and hides each face's back", () => {
    expect(css).toMatch(/\.acad-flip-card\.is-flipped \{ transform: rotateY\(180deg\); \}/);
    expect(css).toMatch(/backface-visibility: hidden;/);
  });
});
