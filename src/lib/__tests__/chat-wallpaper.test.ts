import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DIM_MAX,
  TARGET_CONTRAST,
  WALLPAPER_THEME,
  composite,
  contrastRatio,
  effectiveDim,
  minScrimAlpha,
  photoReadability,
  relativeLuminance,
  worstRegionFor,
  type Rgb,
  type WallpaperTheme,
} from "@modules/community/lib/chat-wallpaper";

/**
 * "The message text must always remain readable" is a claim about EVERY photo
 * a member could pick, so it is tested as one: a property test over thousands
 * of random colours, not a handful of hand-picked cases that happen to pass.
 */

// Deterministic, so a failure reproduces.
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const THEMES: WallpaperTheme[] = ["dark", "light"];

describe("the colour maths is WCAG's, not an approximation", () => {
  it("anchors at black and white", () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 10);
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 6);
  });

  it("composites in sRGB, the way the browser blends an rgba layer", () => {
    expect(composite([255, 255, 255], [0, 0, 0], 0.5)).toEqual([127.5, 127.5, 127.5]);
    expect(composite([10, 20, 30], [200, 200, 200], 0)).toEqual([10, 20, 30]);
    expect(composite([10, 20, 30], [200, 200, 200], 1)).toEqual([200, 200, 200]);
  });

  it("the scrim alone always clears AA against the text it protects", () => {
    // If this ever failed, no amount of dimming could rescue a photo.
    for (const t of THEMES) {
      const { scrim, text } = WALLPAPER_THEME[t];
      expect(contrastRatio(scrim, text), t).toBeGreaterThan(TARGET_CONTRAST);
    }
  });
});

describe("the floor is the least dim that keeps text AA", () => {
  it("a white photo in dark mode needs real dimming, and gets exactly enough", () => {
    const floor = minScrimAlpha([255, 255, 255], "dark");
    expect(floor).toBeGreaterThan(0.5);
    const { scrim, text } = WALLPAPER_THEME.dark;
    expect(contrastRatio(text, composite([255, 255, 255], scrim, floor))).toBeGreaterThanOrEqual(TARGET_CONTRAST);
    // And not more than needed: a hundredth less falls below AA.
    expect(contrastRatio(text, composite([255, 255, 255], scrim, floor - 0.01))).toBeLessThan(TARGET_CONTRAST);
  });

  it("a black photo in dark mode needs none", () => {
    expect(minScrimAlpha([0, 0, 0], "dark")).toBe(0);
  });

  it("mirrors in light mode: black photo needs dimming, white needs none", () => {
    expect(minScrimAlpha([0, 0, 0], "light")).toBeGreaterThan(0.5);
    expect(minScrimAlpha([255, 255, 255], "light")).toBe(0);
  });

  it("defends each theme against the right region", () => {
    const regions = { bright: [250, 250, 250] as Rgb, dark: [5, 5, 5] as Rgb };
    expect(worstRegionFor("dark", regions)).toBe(regions.bright);
    expect(worstRegionFor("light", regions)).toBe(regions.dark);
  });

  for (const theme of THEMES) {
    it(`holds for 5,000 random photos in ${theme} mode`, () => {
      // ⚠️ The property that matters: for ANY colour a photo region could be,
      // dimming to the computed floor keeps body text at or above 4.5:1. And
      // the floor is tight - a hundredth less and it would not.
      const rand = prng(theme === "dark" ? 0xd4c : 0x119);
      const { scrim, text } = WALLPAPER_THEME[theme];
      for (let i = 0; i < 5000; i++) {
        const px: Rgb = [Math.floor(rand() * 256), Math.floor(rand() * 256), Math.floor(rand() * 256)];
        const floor = minScrimAlpha(px, theme);
        expect(floor).toBeGreaterThanOrEqual(0);
        expect(floor).toBeLessThanOrEqual(1);
        const at = contrastRatio(text, composite(px, scrim, floor));
        expect(at, `rgb(${px}) at ${floor}`).toBeGreaterThanOrEqual(TARGET_CONTRAST);
        if (floor > 0.01) {
          const under = contrastRatio(text, composite(px, scrim, floor - 0.01));
          expect(under, `floor for rgb(${px}) is not tight`).toBeLessThan(TARGET_CONTRAST);
        }
      }
    });
  }
});

describe("the member's dim is honoured, above the floor", () => {
  it("never goes under the floor", () => {
    expect(effectiveDim(0.1, 0.62)).toBe(0.62);
  });

  it("keeps a darker choice", () => {
    expect(effectiveDim(0.8, 0.62)).toBe(0.8);
  });

  it("caps at the maximum", () => {
    expect(effectiveDim(0.99, 0.2)).toBe(DIM_MAX);
  });

  it("survives a corrupted stored value", () => {
    expect(effectiveDim(Number.NaN, 0.4)).toBe(0.4);
  });
});

describe("one calculation feeds the slider, the scrim and the label", () => {
  it("reports AA or better for any stored dim, including a corrupted one", () => {
    const regions = { bright: [250, 248, 240] as Rgb, dark: [12, 10, 8] as Rgb };
    for (const theme of THEMES) {
      for (const dim of [0, 0.1, 0.45, 0.9, Number.NaN, -3, 7]) {
        const r = photoReadability(regions, dim, theme);
        expect(r.dim, `${theme} ${dim}`).toBeGreaterThanOrEqual(r.floor);
        expect(r.contrast, `${theme} ${dim}`).toBeGreaterThanOrEqual(TARGET_CONTRAST);
      }
    }
  });

  it("a dark photo in dark mode is left almost untouched", () => {
    // Proportionate, not blanket: dimming a photo that does not need it just
    // throws the photo away.
    const r = photoReadability({ bright: [40, 60, 40], dark: [5, 5, 5] }, 0, "dark");
    expect(r.floor).toBe(0);
  });
});

describe("the constants match what the room actually renders", () => {
  it("dark text is the colour MessageBody uses", () => {
    // `text-zinc-200` = #e4e4e7. If MessageBody's colour changes, the floor
    // would be protecting a colour nobody sees.
    const chat = readFileSync("src/modules/community/components/ChatClient.tsx", "utf8");
    expect(chat).toMatch(/<MessageText text=\{text\} className="[^"]*text-zinc-200/);
    expect(WALLPAPER_THEME.dark.text).toEqual([228, 228, 231]);
  });

  it("light text is the light-theme override of that class", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/html:not\(\.dark\) \.text-zinc-200 \{ color: #26262c; \}/);
    expect(WALLPAPER_THEME.light.text).toEqual([0x26, 0x26, 0x2c]);
  });
});

describe("the CSS that draws the scrim uses the colours the maths assumed", () => {
  // ⚠️ The floor is computed against WALLPAPER_THEME's scrim colours, but the
  // scrim is PAINTED by `.chat-wp-scrim` in globals.css. If the two drift, the
  // floor protects text over a colour nobody sees.
  const css = readFileSync("src/app/globals.css", "utf8");
  const [dr, dg, db] = WALLPAPER_THEME.dark.scrim;
  const [lr, lg, lb] = WALLPAPER_THEME.light.scrim;

  it("dark scrim", () => {
    expect(css).toMatch(new RegExp(`\\.chat-wp-scrim \\{\\s*background-color: rgba\\(${dr}, ${dg}, ${db}, var\\(--dim-dark`));
  });

  it("light scrim", () => {
    expect(css).toMatch(new RegExp(`html:not\\(\\.dark\\) \\.chat-wp-scrim \\{\\s*background-color: rgba\\(${lr}, ${lg}, ${lb}, var\\(--dim-light`));
  });

  it("the theme is chosen by CSS, not by a prop fed from an observer", () => {
    // The first version lagged a render behind the page's theme and a probe
    // caught the dark scrim 400ms after the page went light.
    const wp = readFileSync("src/modules/community/components/ChatWallpaper.tsx", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
    expect(wp).not.toMatch(/theme\s*[:=?]/);
    expect(wp).toMatch(/"--dim-dark": dimDark, "--dim-light": dimLight/);
  });
});

describe("the encoder and store make the promises the UI makes", () => {
  const lib = readFileSync("src/modules/community/lib/chat-wallpaper.ts", "utf8");
  const code = lib.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

  it("never uploads the photo", () => {
    // "Stays on this device" is printed in the UI. This is what keeps it true.
    expect(code).not.toMatch(/fetch\(|XMLHttpRequest|\/api\/upload|navigator\.sendBeacon/);
  });

  it("stores the photo in IndexedDB, not localStorage", () => {
    expect(code).toMatch(/indexedDB\.open\(/);
    expect(code).not.toMatch(/localStorage/);
  });

  it("always re-encodes - a GIF is flattened to one frame, never kept animated", () => {
    expect(code).toMatch(/createImageBitmap\(file\)/);
    expect(code).toMatch(/canvas\.toBlob\(resolve, "image\/webp"/);
    expect(code).not.toMatch(/image\/gif/);
  });

  it("refuses rather than falling back to the raw file", () => {
    expect(code).not.toMatch(/return file;/);
    expect(code).toMatch(/throw new WallpaperError\(/);
  });

  it("caps both the input and the stored size", () => {
    expect(code).toMatch(/WALLPAPER_MAX_INPUT_BYTES = 20 \* 1024 \* 1024/);
    expect(code).toMatch(/WALLPAPER_MAX_EDGE = 1600/);
  });
});
