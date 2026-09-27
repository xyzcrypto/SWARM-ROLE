import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// "Tag pe page upar chala jata hai."
//
// Real source path on purpose: `src/components/*` is a re-export shim after
// #203, so reading one matches nothing and passes while verifying nothing.
const strip = (s: string) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");
const C = strip(readFileSync("src/modules/community/components/ChatClient.tsx", "utf8"));

describe("jumping to a message stays inside the message list", () => {
  it("scrolls the list, not the element's whole ancestor chain", () => {
    // `scrollIntoView` walks every ancestor and scrolls each scrollable box it
    // finds, and `block: "center"` always scrolls rather than doing the
    // minimum. The room is meant to be a fixed frame - `main` is
    // `h-[100svh] overflow-hidden` and only this list scrolls - but
    // "overflow-hidden ancestors" is not the same as "nothing above can move".
    expect(C).toMatch(/const list = listRef\.current;/);
    expect(C).toMatch(/list\.scrollTo\(\{ top: Math\.max\(0, top\), behavior: "smooth" \}\)/);
    expect(C).not.toMatch(/el\.scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
  });

  it("still centres the message, which is what `center` was for", () => {
    expect(C).toMatch(/el\.offsetTop - list\.clientHeight \/ 2 \+ el\.clientHeight \/ 2/);
  });

  it("still highlights it", () => {
    // The jump is only half the affordance; without the ring you cannot tell
    // which message you were sent to.
    // Now a one-shot gold wash (`.msg-flash` in globals.css), shared with DMs.
    expect(C).toMatch(/el\.classList\.add\("msg-flash"\)/);
  });
});

describe("picking a mention leaves you able to keep typing", () => {
  it("returns focus to the composer", () => {
    // Focus stayed on the suggestion button, so the caret was lost and on a
    // phone the keyboard closed the moment you picked someone.
    expect(C).toMatch(/const composerRef = useRef<HTMLTextAreaElement>\(null\)/);
    expect(C).toMatch(/ref=\{composerRef\}/);
    expect(C).toMatch(/el\.focus\(\);\s*el\.setSelectionRange\(el\.value\.length, el\.value\.length\)/);
  });

  it("waits for the value to commit before placing the caret", () => {
    // Without the frame the caret lands at the pre-insert length.
    expect(C).toMatch(/requestAnimationFrame\(\(\) => \{\s*const el = composerRef\.current;/);
  });
});
