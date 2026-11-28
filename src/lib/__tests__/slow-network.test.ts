import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { guardFor, GUARD_GET_MS, GUARD_UPLOAD_MS, GUARD_WRITE_MS } from "@shared/utils/fetch-guard";
import { iconSrc, photoSrc } from "@shared/utils/img";

const read = (p: string) => readFileSync(p, "utf8");
const O = "https://xyzcrypto.io";

describe("fetch guard: no site API call can hang for ever", () => {
  it("same-origin /api GETs get 20s, writes 30s, uploads 2 minutes", () => {
    expect(guardFor("/api/news", undefined, O)).toBe(GUARD_GET_MS);
    expect(guardFor(`${O}/api/journal/trades`, { method: "POST", body: "{}" }, O)).toBe(GUARD_WRITE_MS);
    expect(guardFor("/api/profile/avatar", { method: "POST" }, O)).toBe(GUARD_UPLOAD_MS);
    expect(guardFor("/api/feedback", { method: "POST", body: new FormData() }, O)).toBe(GUARD_UPLOAD_MS);
  });
  it("leaves alone: callers with their own signal, other origins, pages, streams and audio", () => {
    expect(guardFor("/api/news", { signal: new AbortController().signal }, O)).toBeNull();
    expect(guardFor("https://api.coingecko.com/api/v3/ping", undefined, O)).toBeNull();
    expect(guardFor("/academy?_rsc=1", undefined, O)).toBeNull();
    expect(guardFor("/api/ai/assistant", { method: "POST" }, O)).toBeNull();
    expect(guardFor("/api/academy/voice/say?t=hi", undefined, O)).toBeNull();
    expect(guardFor("/api/track", { method: "POST" }, O)).toBeNull();
  });
  it("is installed at module load by NavProgress (root layout), before components fetch", () => {
    expect(read("src/shared/components/NavProgress.tsx")).toMatch(/if \(typeof window !== "undefined"\) installFetchGuard\(\);/);
  });
});

describe("slow connections get more time before a navigation counts as stuck", () => {
  it("2G/3G/save-data/<1.5 Mbps wait 25s, others 10s", async () => {
    const { stuckAfter } = await import("@shared/components/NavProgress");
    expect(stuckAfter(null)).toBe(10_000);
    expect(stuckAfter({ effectiveType: "4g", downlink: 10 })).toBe(10_000);
    expect(stuckAfter({ effectiveType: "3g" })).toBe(25_000);
    expect(stuckAfter({ effectiveType: "slow-2g" })).toBe(25_000);
    expect(stuckAfter({ effectiveType: "4g", downlink: 0.8 })).toBe(25_000);
    expect(stuckAfter({ saveData: true })).toBe(25_000);
  });
});

describe("right-sized third-party images", () => {
  it("CoinGecko icons use /small/ (50px, ~2 KB) instead of /large/ (250px, ~21 KB)", () => {
    expect(iconSrc("https://coin-images.coingecko.com/coins/images/4128/large/solana.png?1718769756")).toBe("https://coin-images.coingecko.com/coins/images/4128/small/solana.png?1718769756");
    expect(iconSrc("https://assets.coingecko.com/coins/images/1/small/bitcoin.png")).toBe("https://assets.coingecko.com/coins/images/1/small/bitcoin.png");
  });
  it("DefiLlama icons are requested at display size", () => {
    expect(iconSrc("https://icons.llamao.fi/icons/protocols/uniswap-v4")).toBe("https://icons.llamao.fi/icons/protocols/uniswap-v4?w=48&h=48");
    expect(iconSrc("https://icons.llamao.fi/icons/protocols/x", 96)).toBe("https://icons.llamao.fi/icons/protocols/x?w=96&h=96");
  });
  it("photos: Sanity resizes itself (and its &amp; bug is fixed); others go through the resizer; local, SVG and GIF untouched", () => {
    const s = photoSrc("https://cdn.sanity.io/images/p/prod/a-2048x1152.webp?fm=webp&amp;q=8", 720)!;
    expect(s).toContain("w=720");
    expect(s).toContain("auto=format");
    expect(s).not.toContain("&amp;");
    expect(photoSrc("https://cryptoslate.com/a/b.webp", 720)).toBe(`https://wsrv.nl/?url=${encodeURIComponent("https://cryptoslate.com/a/b.webp")}&w=720&output=webp&q=72&we`);
    expect(photoSrc("/tradekaroverse.jpg", 720)).toBe("/tradekaroverse.jpg");
    expect(photoSrc("https://x.com/a.svg", 720)).toBe("https://x.com/a.svg");
    expect(photoSrc(null, 720)).toBeNull();
  });
  it("every resized photo keeps the original as a fallback", () => {
    for (const f of ["src/modules/points/components/LiveWire.tsx", "src/modules/points/components/UpdatesFeed.tsx", "src/modules/news/components/NewsLayout.tsx", "src/modules/news/components/SavedClient.tsx"]) {
      const c = read(f);
      const n = (c.match(/photoSrc\(/g) ?? []).length;
      expect((c.match(/data-orig=/g) ?? []).length, f).toBe(n);
    }
  });
  it("the ticker on every page and the markets lists send small icons", () => {
    expect(read("src/app/api/ticker/route.ts")).toMatch(/image: iconSrc\(d\?\.image\) \?\? LOGO\[c\.symbol\]/);
    expect(read("src/app/api/markets/coins/route.ts")).toMatch(/iconSrc\(d\.image\)/);
    expect(read("src/modules/markets/lib/llama.ts")).toMatch(/iconSrc\(p\.logo\)/);
  });
});

describe("nothing optional competes with the page while it loads", () => {
  it("realtime, the AI widget, the palette and the customize sheet wait for the idle gate", () => {
    expect(read("src/core/realtime/realtimeClient.ts")).toMatch(/whenIdle\(\)\.then\(\(\) => import\("@supabase\/supabase-js"\)\)/);
    expect(read("src/modules/ai/components/XyzAiWidgetMount.tsx")).toMatch(/useIdleGate\(\) \? <Widget \/> : null/);
    expect(read("src/shared/components/CommandPaletteMount.tsx")).toMatch(/useDeferredMount\(XYZ_CMDK_EVENT, opensPalette\)/);
    expect(read("src/shared/components/CustomizeSheetMount.tsx")).toMatch(/useDeferredMount\(CUSTOMIZE_EVENT\)/);
  });
  it("a search tap before the palette loads still opens it", () => {
    expect(read("src/shared/components/CommandPalette.tsx")).toMatch(/if \(consumePending\(XYZ_CMDK_EVENT\)\)/);
  });
  it("the homepage serif is not preloaded on every route", () => {
    expect(read("src/components/Hero.tsx")).toMatch(/preload: false,/);
  });
});
