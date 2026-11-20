import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { isSilenceHallucination } from "@modules/academy/components/Guide";

const read = (p: string) => readFileSync(p, "utf8");

describe("share cards", () => {
  it("are served outside /api so X's crawler (which obeys robots.txt) can fetch them", () => {
    for (const p of ["src/app/academy/card/quiz/[id]/route.tsx", "src/app/academy/card/rank/[handle]/route.tsx", "src/app/academy/certificate/[code]/opengraph-image.tsx"]) {
      expect(existsSync(p), p).toBe(true);
    }
    expect(read("src/app/robots.ts")).not.toMatch(/"\/academy/);
  });

  it("ship their fonts and logo with the function", () => {
    const cfg = read("next.config.mjs");
    expect(cfg).toMatch(/"\/academy\/card\/\*\*": \["\.\/src\/modules\/academy\/assets\/\*\*"\]/);
    for (const f of ["Geist-Regular.ttf", "Geist-Bold.ttf", "Geist-Black.ttf", "logo-192.png"]) expect(existsSync(`src/modules/academy/assets/${f}`), f).toBe(true);
  });

  it("cache a finished quiz forever and a moving rank briefly", () => {
    expect(read("src/app/academy/card/quiz/[id]/route.tsx")).toMatch(/immutable/);
    expect(read("src/app/academy/card/rank/[handle]/route.tsx")).toMatch(/s-maxage=300/);
  });

  it("share pages carry the card as their link preview", () => {
    for (const p of ["src/app/academy/s/quiz/[id]/page.tsx", "src/app/academy/s/rank/[handle]/page.tsx"]) {
      const s = read(p);
      expect(s, p).toMatch(/openGraph: \{[^}]*images/);
      expect(s, p).toMatch(/summary_large_image/);
    }
  });

  it("the certificate, quiz results and leaderboard all offer the share sheet", () => {
    expect(read("src/modules/academy/components/CertificateView.tsx")).toMatch(/<ShareSheet/);
    expect(read("src/modules/academy/components/QuizResults.tsx")).toMatch(/<ShareSheet/);
    expect(read("src/modules/academy/components/Leaderboard.tsx")).toMatch(/<ShareSheet/);
  });
});

describe("certificate design", () => {
  it("has a light-theme (ivory) variant and a scannable QR on it", () => {
    const css = read("src/app/academy/academy.css");
    expect(css).toMatch(/html:not\(\.dark\) \.acad-cert \{/);
    expect(css).toMatch(/html:not\(\.dark\) \.acad-cert-qr/);
  });
});

describe("Live Talk robustness", () => {
  it("drops speech-to-text hallucinations on silence", () => {
    expect(isSilenceHallucination("Thank you.")).toBe(true);
    expect(isSilenceHallucination("you")).toBe(true);
    expect(isSilenceHallucination("")).toBe(true);
    expect(isSilenceHallucination("what is funding rate")).toBe(false);
    expect(isSilenceHallucination("ok")).toBe(false);
  });
  it("retries a transient failure once before telling the learner", () => {
    const g = read("src/modules/academy/components/Guide.tsx");
    expect(g).toMatch(/retryOnce\(\(\) => transcribe\(rec\.blob\)\)/);
    expect(g).toMatch(/retryOnce\(\(\) => askAneque\(history\.current\)\)/);
  });
});
