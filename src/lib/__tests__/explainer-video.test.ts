import { describe, expect, it } from "vitest";
import { readFileSync, statSync, existsSync } from "node:fs";

const read = (f: string) => readFileSync(f, "utf8");
const player = read("src/components/ExplainerPlayer.tsx");
const pub = (url: string) => `public${url}`;
const PATHS = {
  desktop: "/media/explainer/xyz-explainer-v1-desktop.mp4",
  mobile: "/media/explainer/xyz-explainer-v1-mobile.mp4",
  posterDesktop: "/media/explainer/xyz-explainer-v1-poster-desktop.webp",
  posterMobile: "/media/explainer/xyz-explainer-v1-poster-mobile.webp",
  captions: "/media/explainer/xyz-explainer-v1-captions.vtt",
};
const MB = 1024 * 1024;

describe("the explainer costs nothing until someone presses play", () => {
  it("renders no <video> (and so requests no video bytes) before the click", () => {
    const beforeClick = player.slice(player.indexOf(") : ("));
    expect(player).toMatch(/\{src \? \(\s*<video/);
    expect(beforeClick).not.toMatch(/<video/);
    expect(player).toMatch(/useState<string \| null>\(null\)/);
  });
  it("picks the cut inside the click handler, from the same breakpoint as the CSS (no hydration mismatch)", () => {
    expect(player).toMatch(/const start = \(\) => \{\s*const desktop = typeof window !== "undefined" && window\.matchMedia\(EXPLAINER\.desktopQuery\)\.matches;/);
    expect(player).toMatch(/desktopQuery: "\(min-width: 768px\)"/); // Tailwind `md`
    expect(player).toMatch(/"aspect-\[9\/16\] /);
    expect(player).toMatch(/"md:aspect-video /);
  });
  it("is sized by the screen's height so the heading and the whole frame fit on one screen", () => {
    // Measured in a real browser on 7 screens, 360x740 to 1920x1080 (changelog 133).
    expect(player).toContain("max-w-[min(25rem,calc((100svh_-_20.625rem)*9/16))]");
    expect(player).toContain("md:max-w-[min(68.75rem,calc((100svh_-_21.25rem)*16/9))]");
  });
  it("keeps every file within its budget", () => {
    for (const p of Object.values(PATHS)) expect(existsSync(pub(p)), p).toBe(true);
    expect(statSync(pub(PATHS.desktop)).size).toBeLessThan(12 * MB);
    expect(statSync(pub(PATHS.mobile)).size).toBeLessThan(10 * MB);
    expect(statSync(pub(PATHS.posterDesktop)).size).toBeLessThan(250 * 1024);
    expect(statSync(pub(PATHS.posterMobile)).size).toBeLessThan(250 * 1024);
  });
  it("points the component at exactly these versioned files", () => {
    for (const p of Object.values(PATHS)) expect(player).toContain(p);
  });
});

describe("delivery", () => {
  it("is cached for a year (the file names carry the version)", () => {
    expect(read("next.config.mjs")).toMatch(/source: "\/media\/explainer\/:file\*", headers: \[\{ key: "Cache-Control", value: "public, max-age=31536000, immutable" \}\]/);
  });
  it("is left to the browser by the service worker, so range requests and seeking work", () => {
    const sw = read("public/sw.js");
    const m = sw.match(/function isStaticAsset\(url\) \{\s*return (.+);\s*\}/);
    expect(m).toBeTruthy();
    const isStaticAsset = new Function("url", `return ${m![1]};`) as (u: URL) => boolean;
    for (const p of Object.values(PATHS)) expect(isStaticAsset(new URL(`https://x.io${p}`)), p).toBe(false);
  });
  it("ships captions that are on by default", () => {
    const vtt = read(pub(PATHS.captions));
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt.match(/-->/g)!.length).toBeGreaterThan(15);
    expect(vtt).toContain("AneQue");
    expect(vtt).not.toMatch(/X Y Z|Aneek/); // spoken spellings never reach the screen
    expect(player).toMatch(/<track kind="captions" src=\{EXPLAINER\.captions\} srcLang="en" label="English" default \/>/);
  });
});

describe("placement and theming", () => {
  it("sits directly below the hero and its ticker", () => {
    expect(read("src/app/page.tsx")).toMatch(/<MarketTicker \/>\s*\{\/\*[^}]*\*\/\}\s*<ExplainerVideo \/>/);
  });
  it("uses literal light text on the dark poster (the light theme remaps text-white)", () => {
    expect(player).toContain("text-[#fff]");
    expect(player).not.toMatch(/className="[^"]*\btext-white\b/); // a comment may name it; a class may not
    // `base` is a colour token here, so `text-base` also sets color: var(--bg) - the page background.
    expect(player).not.toMatch(/className="[^"]*(?:^|[\s:])text-base\b/);
  });
});
