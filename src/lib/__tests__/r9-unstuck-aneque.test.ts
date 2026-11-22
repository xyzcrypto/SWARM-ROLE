import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { parseCommand } from "@modules/academy/client/commands";
import { isChunkError, mayReload, RELOAD_GAP_MS } from "@shared/utils/recover";
import { navTarget } from "@shared/components/NavProgress";
import { formatPassages, rankPassages, tokens, type Passage } from "@modules/academy/lib/aneque-knowledge";
import { cleanReply } from "@modules/academy/lib/aneque";

const read = (p: string) => readFileSync(p, "utf8");

describe("AneQue: questions are not swallowed as commands", () => {
  it.each([
    "why is funding rate negative?",
    "how do live quizzes work",
    "what's my rank",
    "can you read about staking",
    "what is a DEX",
    "kya hota hai staking",
    "explain to me how liquidation works on a perp DEX",
  ])("%s -> AI", (said) => {
    expect(parseCommand(said)).toBeNull();
  });
  it.each([
    ["Hey Aneq, can you open the leaderboard", "leaderboard"],
    ["take me to live quiz", "live"],
    ["could you start a new quiz", "start"],
    ["why", "explain"],
    ["say that again", "repeat"],
    ["stop", "stop"],
  ])("%s -> %s", (said, cmd) => {
    expect(parseCommand(said)?.cmd).toBe(cmd);
  });
  it("still picks an option however it is phrased", () => {
    expect(parseCommand("I think the answer is option C")).toEqual({ cmd: "answer", option: 2 });
  });
});

describe("AneQue: grounded in the Academy's own lessons", () => {
  const P = (module: string, heading: string, text: string, category = "DEX & Perps"): Passage => ({ category, module, heading, text, href: "/x" });
  const corpus = [
    P("Funding rates", "What funding does", "Funding is a periodic payment between longs and shorts that keeps the perpetual price close to the spot index price."),
    P("Liquidity pools", "How pools work", "A pool holds two tokens supplied by liquidity providers who earn trading fees.", "DeFi"),
    P("Bitcoin basics", "Halving", "Every 210,000 blocks the block subsidy halves.", "Bitcoin"),
  ];
  it("finds the passage that answers the question", () => {
    const top = rankPassages(corpus, "why is the funding rate negative on perps?");
    expect(top[0]?.module).toBe("Funding rates");
  });
  it("returns nothing for chatter rather than a random lesson", () => {
    expect(rankPassages(corpus, "hello how are you")).toEqual([]);
  });
  it("boosts the lesson on screen", () => {
    const top = rankPassages(corpus, "who earns fees", { lesson: "Liquidity pools" });
    expect(top[0]?.module).toBe("Liquidity pools");
  });
  it("keeps notes inside the prompt budget", () => {
    const long = Array.from({ length: 20 }, (_, i) => P(`M${i}`, "H", "x".repeat(400)));
    expect(formatPassages(long, 1000).length).toBeLessThanOrEqual(1000);
  });
  it("tokenises plurals and drops stop words", () => {
    expect(tokens("What are the liquidity pools?")).toEqual(["liquidity", "pool"]);
  });
  it("cleans replies for speech and never stops mid-word when cut off", () => {
    expect(cleanReply("AneQue: **Funding** keeps perps near spot.\nLearner: and then?")).toBe("Funding keeps perps near spot.");
    expect(cleanReply("Funding keeps perps near spot. When longs pay shor", true)).toBe("Funding keeps perps near spot.");
  });
  it("the chat route grounds every answer server-side, and the client cannot inject page data any more", () => {
    const r = read("src/app/api/academy/aneque/chat/route.ts");
    expect(r).toMatch(/lessonNotes\(/);
    expect(r).toMatch(/learnerSnapshot\(me\.id\)/);
    expect(r).not.toMatch(/pageData/);
    expect(read("src/modules/academy/lib/aneque.ts")).toMatch(/HOW TO THINK/);
  });
  it("the dock takes typed questions too", () => {
    expect(read("src/modules/academy/components/Guide.tsx")).toMatch(/Type a question for AneQue/);
  });
});

describe("Academy sound stays in the Academy", () => {
  const a = read("src/modules/academy/client/audio.ts");
  it("music needs the Academy scope; voice and effects need some scope", () => {
    expect(a).toMatch(/if \(scope !== "academy" \|\| musicOn/);
    expect(a).toMatch(/return !!scope && snap\.settings\.master/);
    expect(a).toMatch(/if \(!scope \|\| !snap\.settings\.master \|\| !snap\.settings\.sfx\) return;/);
  });
  it("leaving stops everything and parks the engine", () => {
    expect(a).toMatch(/export function leaveAudioScope\(\)[\s\S]{0,200}stopVoice\(\);[\s\S]{0,40}stopMusic\(\);[\s\S]{0,120}ctx\.suspend\(\)/);
  });
  it("the Academy layout's dock claims the Academy scope; Feedback claims voice only", () => {
    expect(read("src/modules/academy/components/Guide.tsx")).toMatch(/enterAudioScope\("academy"\)/);
    expect(read("src/modules/feedback/components/FeedbackClient.tsx")).toMatch(/enterAudioScope\("page"\)/);
  });
  it("AneQue is gone from Markets, News and Points", () => {
    for (const p of ["src/app/markets/page.tsx", "src/app/news/page.tsx", "src/app/points/page.tsx"]) {
      expect(read(p), p).not.toMatch(/AneQue|academy\.css/);
    }
    expect(existsSync("src/modules/academy/components/AneQueDockLazy.tsx")).toBe(false);
    expect(existsSync("src/modules/academy/client/page-brief.ts")).toBe(false);
  });
});

describe("site: recovering from a deploy without a manual refresh", () => {
  it("recognises chunk errors from every browser", () => {
    for (const m of ["ChunkLoadError: Loading chunk 123 failed.", "Failed to fetch dynamically imported module: https://x/_next/static/chunks/a.js", "Importing a module script failed.", "Loading CSS chunk 9 failed"]) expect(isChunkError(m), m).toBe(true);
    expect(isChunkError("TypeError: x is undefined")).toBe(false);
  });
  it("reloads at most once per gap, but again for a later deploy (not once per session)", () => {
    expect(mayReload(null, 1000)).toBe(true);
    expect(mayReload(1000, 1000 + RELOAD_GAP_MS - 1)).toBe(false);
    expect(mayReload(1000, 1000 + RELOAD_GAP_MS + 1)).toBe(true);
    expect(read("src/modules/notifications/components/PwaSetup.tsx")).not.toMatch(/xyz-chunk-reload-once/);
  });
  it("error boundary refetches from the server instead of only re-rendering", () => {
    const e = read("src/app/error.tsx");
    expect(e).toMatch(/router\.refresh\(\)/);
    expect(e).toMatch(/window\.location\.reload\(\)/);
  });
  it("tracks the router's page loads but not prefetches or server actions", () => {
    const o = "https://xyzcrypto.io";
    expect(navTarget("/academy/quiz?_rsc=abc", { headers: { RSC: "1" } }, o)).toEqual({ href: "/academy/quiz", path: "/academy/quiz" });
    expect(navTarget("/academy?_rsc=abc", { headers: { RSC: "1", "Next-Router-Prefetch": "1" } }, o)).toBeNull();
    expect(navTarget("/academy", { method: "POST", headers: { "Next-Action": "x", RSC: "1" } }, o)).toBeNull();
    expect(navTarget("/api/ticker", {}, o)).toBeNull();
  });
});

describe("quiz: a lost response can no longer wedge the player", () => {
  const q = read("src/modules/academy/components/QuizClient.tsx");
  it("a re-sync clears a stale reveal when the server already moved on", () => {
    expect(q).toMatch(/if \(!s\.revealed\) \{\s*setReveal\(null\);\s*setPicked\(null\);/);
  });
  it("409/410 re-sync quietly instead of showing an error", () => {
    expect(q.match(/st === 409 \|\| st === 410/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
  it("an active quiz with nothing to show finishes instead of spinning", () => {
    expect(q).toMatch(/s\.status !== "active" \|\| !s\.question/);
    expect(read("src/modules/academy/lib/quiz.ts")).toMatch(/a\.status === "active" && !q && !a\.revealed && depth < 3/);
  });
  it("quiz steps time out fast", () => {
    expect(read("src/modules/academy/client/hooks.ts")).toMatch(/QUIZ_TIMEOUT_MS = 8_000/);
  });
});
