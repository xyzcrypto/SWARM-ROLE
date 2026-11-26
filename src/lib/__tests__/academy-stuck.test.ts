import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getJson } from "@modules/academy/client/hooks";

const read = (p: string) => readFileSync(p, "utf8");

describe("getJson never hangs on a body that stops arriving", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("a response whose headers arrived but whose body stalled fails as a lost connection (status 0), so withRetry retries it", async () => {
    vi.useFakeTimers();
    // Headers arrive; the body never does, until the request is aborted.
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          new Promise<string>((_, reject) => {
            init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
          }),
      })
    );
    const p = getJson("/api/academy/quiz/x", { timeoutMs: 8000 });
    const settled = expect(p).rejects.toMatchObject({ status: 0 });
    await vi.advanceTimersByTimeAsync(8001);
    await settled;
  });

  it("a normal JSON body still parses, and a 4xx still carries its message and status", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{"a":1}') }));
    await expect(getJson("/x")).resolves.toEqual({ a: 1 });
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: false, status: 409, text: () => Promise.resolve('{"error":"That question is already answered."}') }));
    await expect(getJson("/x")).rejects.toMatchObject({ status: 409, message: "That question is already answered." });
  });

  it("a 2xx that is not JSON (a captive portal page) is a lost connection, not data", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve("<html>login to wifi</html>") }));
    await expect(getJson("/x")).rejects.toMatchObject({ status: 0 });
  });
});

describe("content the server renders is never hidden until JS runs", () => {
  // framer-motion's initial={{ opacity: 0 }} is written into the server HTML as
  // style="opacity:0": on a slow phone the page looked blank, and when a JS
  // chunk failed to load it never appeared at all ("the page is stuck").
  const SSR = ["Hero", "ui", "AcademyHome", "LessonView", "CategoryView", "CertificateView", "CertificateShowcase"];
  for (const f of SSR)
    it(`${f} uses the CSS rise() entrance, not an opacity-0 framer initial`, () => {
      const code = read(`src/modules/academy/components/${f}.tsx`).replace(/^\s*(\*|\/\/).*$/gm, "");
      expect(code).not.toMatch(/initial=\{\{ opacity: 0/);
    });

  it("rise() is a CSS animation with backwards fill (ends visible, then hands the transform back)", () => {
    expect(read("src/modules/academy/components/ui.tsx")).toMatch(/animation: `acad-in \$\{o\.dur \?\? 0\.5\}s cubic-bezier\(0\.22, 1, 0\.36, 1\) \$\{o\.delay \?\? 0\}s backwards`/);
    expect(read("src/app/academy/academy.css")).toMatch(/@keyframes acad-in/);
  });

  it("<Reveal> content shows on its own if hydration has not happened 2.5s after load", () => {
    expect(read("src/shared/components/Reveal.tsx")).toMatch(/data-reveal=""/);
    expect(read("src/modules/notifications/components/PwaSetup.tsx")).toMatch(/document\.documentElement\.dataset\.hydrated = "1";/);
    expect(read("src/app/globals.css")).toMatch(/html:not\(\[data-hydrated\]\) \[data-reveal\] \{\s*animation: reveal-failsafe 0\.4s ease-out 2\.5s forwards;/);
  });
});

describe("a stalled music download falls back instead of silencing the scene", () => {
  it("is bounded and forgotten on failure", () => {
    const a = read("src/modules/academy/client/audio.ts");
    expect(a).toMatch(/fetch\(`\/academy\/music\/\$\{track\}\.mp3`, \{ signal: AbortSignal\.timeout\(25_000\) \}\)/);
    expect(a).toMatch(/if \(loopBuf\?\.track === track\) loopBuf = null;/);
  });
});
