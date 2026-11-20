import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Real implementation paths (not the src/components re-export shims).
const read = (p: string) => readFileSync(p, "utf8");

describe("no lost taps, no endless spinners", () => {
  it("AneQue's greeting bubble never swallows a tap meant for the page", () => {
    // It grows when she starts talking and used to cover the Start quiz
    // button on phones: the first tap landed on the bubble and did nothing.
    const src = read("src/modules/academy/components/GreetBubble.tsx");
    expect(src).toMatch(/className="acad-greet pointer-events-none/);
    expect(src).toMatch(/line-clamp-3/);
  });

  it("Academy requests time out instead of spinning forever", () => {
    const hooks = read("src/modules/academy/client/hooks.ts");
    expect(hooks).toMatch(/new AbortController\(\)/);
    expect(hooks).toMatch(/timeoutMs \?\? 15_000/);
    expect(read("src/modules/academy/client/talk.ts")).toMatch(/AbortSignal\.timeout\(35_000\)/);
  });

  it("every internal click gets instant feedback", () => {
    expect(read("src/app/layout.tsx")).toMatch(/<NavProgress \/>/);
    for (const p of ["src/app/academy/loading.tsx", "src/app/academy/learn/[category]/[module]/loading.tsx", "src/app/markets/[id]/loading.tsx", "src/app/news/read/loading.tsx"]) {
      expect(read(p)).toMatch(/PageSkeleton/);
    }
  });
});

describe("smooth scrolling and rendering", () => {
  it("the Navbar and sticky CTA do not read scrollY on every scroll event", () => {
    const nav = read("src/shared/components/Navbar.tsx");
    expect(nav).not.toMatch(/addEventListener\("scroll"/);
    expect(nav).toMatch(/new IntersectionObserver/);
    expect(read("src/shared/components/StickyCta.tsx")).not.toMatch(/addEventListener\("scroll"/);
  });

  it("only the quiz clock re-renders on the timer, not the whole question", () => {
    const quiz = read("src/modules/academy/components/QuizClient.tsx");
    const player = quiz.slice(quiz.indexOf("function QuizPlayer("));
    expect(player).not.toMatch(/useTicker\(/);
    expect(quiz).toMatch(/function QuizClock\([\s\S]{0,600}useTicker\(!reveal, 200\)/);
  });

  it("captions re-render per word, not per frame", () => {
    const g = read("src/modules/academy/components/Guide.tsx");
    expect(g).toMatch(/if \(k !== last\)/);
    expect(g).not.toMatch(/setP\(voiceProgress\(\)\)/);
  });
});

describe("quiz fits one screen", () => {
  it("sets play mode while a question is up and sizes the play area to the viewport", () => {
    const quiz = read("src/modules/academy/components/QuizClient.tsx");
    expect(quiz).toMatch(/dataset\.acadPlaying = "1"/);
    expect(quiz).toMatch(/className="acad-play /);
    const css = read("src/app/academy/academy.css");
    expect(css).toMatch(/\.acad-play \{\s*height: calc\(100dvh/);
    expect(css).toMatch(/html\[data-acad-playing\] \.nav-shell/);
    expect(read("src/modules/academy/components/LiveArena.tsx")).toMatch(/dataset\.acadPlaying = "1"/);
  });
});

describe("R7 smoothness", () => {
  it("lists that re-render often do not use framer-motion layout measurement", () => {
    for (const p of ["src/modules/academy/components/Leaderboard.tsx", "src/modules/academy/components/LiveArena.tsx", "src/modules/creators/components/XBoard.tsx", "src/modules/creators/components/YoutubeBoard.tsx"]) {
      const s = read(p);
      expect(s, p).not.toMatch(/^\s*layout\s*$/m);
      expect(s, p).not.toMatch(/ layout initial=/);
      expect(s, p).not.toMatch(/layoutId=|LayoutGroup/);
    }
    expect(read("src/modules/academy/components/Leaderboard.tsx")).not.toMatch(/useTicker\(/);
  });

  it("the audio graph is not built on page load without a user gesture, and its reverb waits for idle", () => {
    const a = read("src/modules/academy/client/audio.ts");
    expect(a).toMatch(/ua && !ua\.hasBeenActive && policy !== "allowed"/);
    expect(a).toMatch(/requestIdleCallback/);
    expect(a).not.toMatch(/Math\.pow\(1 - t, 2\.6\)/);
  });
});
