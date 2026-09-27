import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * PR 3 - "the site feels stuck". Each fix here was measured before it was
 * made (numbers in docs/changelog.md), and each assertion pins the code-level
 * reason the measurement moved, so a refactor cannot quietly undo it.
 */

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
const read = (f: string) => readFileSync(f, "utf8");

/** The body of a top-level `function name(` up to the next top-level function. */
function fnBody(src: string, name: string): string {
  const start = src.search(new RegExp(`\\nfunction ${name}\\(|\\nexport function ${name}\\(`));
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const rest = src.slice(start + 1);
  const next = rest.slice(1).search(/\n(export )?function [A-Z]/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

describe("typing re-renders the composer, not the conversation", () => {
  // Measured with 150 messages: every keystroke re-rendered every row, because
  // the draft lived in the component that also renders the list. Room: 58ms
  // of main-thread work per key on desktop, 230ms throttled 4x. DM: 100ms and
  // 400ms+. Both are now single-digit.
  const room = read("src/modules/community/components/ChatClient.tsx");
  const dm = read("src/modules/messages/components/MessagesClient.tsx");

  it("the room's draft lives in RoomComposer", () => {
    expect(fnBody(room, "RoomComposer")).toMatch(/const \[body, setBody\] = useState\(""\)/);
    expect(fnBody(room, "ChatClient")).not.toMatch(/\[body, setBody\]/);
    expect(room).toMatch(/<RoomComposer\b/);
  });

  it("the DM draft lives in DmComposer", () => {
    expect(fnBody(dm, "DmComposer")).toMatch(/const \[draft, setDraft\] = useState\(""\)/);
    expect(fnBody(dm, "Thread")).not.toMatch(/\[draft, setDraft\]/);
    expect(dm).toMatch(/<DmComposer\b/);
  });

  it("both still give the text back when a send fails", () => {
    // Moving the draft is exactly the change that could drop this.
    expect(fnBody(room, "RoomComposer")).toMatch(/if \(!ok\) setBody\(\(b\) => \(b\.trim\(\) \? b : text\)\)/);
    expect(fnBody(dm, "DmComposer")).toMatch(/if \(!ok\) setDraft\(\(d\) => \(d\.trim\(\) \? d : body\)\)/);
    // ...which only works if the senders say whether they succeeded.
    expect(room).toMatch(/async function doSend\(raw: string, isMedia = false\): Promise<boolean>/);
    expect(dm).toMatch(/const postMessage = async \(raw: string, opts\?: \{ forwarded\?: boolean \}\): Promise<boolean>/);
  });

  it("media sends still never touch the composer", () => {
    expect(room).toMatch(/await doSend\(url, true\)/);
    expect(room).toMatch(/await doSend\(String\(j\.url\), true\)/);
  });
});

describe("the offscreen-animation pauser does not force a layout per DOM change", () => {
  const src = strip(read("src/shared/components/PauseOffscreenAnimations.tsx"));

  it("coalesces mutations into one delayed scan", () => {
    expect(src).toMatch(/new MutationObserver\(\(\) => \{\s*if \(!timer\) timer = window\.setTimeout\(scan, SCAN_MS\);/);
    expect(src).not.toMatch(/new MutationObserver\(\(\) => observe\(\)\)/);
  });

  it("does not re-read the height of what it already watches, and lets go of detached nodes", () => {
    expect(src).toMatch(/if \(watched\.has\(el\)\) return;/);
    expect(src).toMatch(/if \(!el\.isConnected\) \{\s*io\.unobserve\(el\);/);
  });

  it("clears its timer on unmount", () => {
    expect(src).toMatch(/window\.clearTimeout\(timer\)/);
  });
});

describe("every always-dynamic page shows something the moment you tap it", () => {
  // A force-dynamic page waits on a server round trip before anything paints.
  // Without a `loading.tsx` - its own or an ancestor's - tapping a link to it
  // does visibly nothing until the server answers, which is what "stuck"
  // means to the person tapping. /profile and /saved had none.
  const pages: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === "page.tsx" && /export const dynamic = "force-dynamic"/.test(read(p))) pages.push(p);
    }
  };
  walk("src/app");

  it("finds the dynamic pages at all", () => {
    expect(pages.length).toBeGreaterThan(5);
  });

  for (const page of pages) {
    it(page, () => {
      let dir = dirname(page);
      let covered = false;
      while (dir.startsWith("src/app")) {
        if (existsSync(join(dir, "loading.tsx"))) { covered = true; break; }
        dir = dirname(dir);
      }
      expect(covered, `${page} has no loading.tsx on its path`).toBe(true);
    });
  }
});
