import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// DM: reading history in a thread used to be impossible while it was active.
//
// `useEffect(() => { scrollToEnd(); }, [messages.length])` jumped the thread to
// the bottom on EVERY new message - one from the other side, or one picked up
// by the 5s poll - so scrolling up to find something and then being thrown back
// down is what the thread did on its own, roughly every five seconds in a live
// conversation. Community chat has had a stick-to-bottom guard since it was
// built; DM never got one, and had no `scrollTop` read anywhere in the file.
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203.
const strip = (s: string) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");
const M = strip(readFileSync("src/modules/messages/components/MessagesClient.tsx", "utf8"));

describe("the thread follows the conversation only when the reader is", () => {
  it("measures whether it is at the bottom at all", () => {
    // There was no such measurement anywhere in the file.
    expect(M).toMatch(/el\.scrollHeight - el\.scrollTop - el\.clientHeight < 80/);
    expect(M).toMatch(/onScroll=\{onScroll\}/);
  });

  it("only auto-scrolls when following", () => {
    expect(M).toMatch(/useEffect\(\(\) => \{ if \(stick\) scrollToEnd\(\); \}, \[messages\.length, stick\]\)/);
    expect(M).not.toMatch(/useEffect\(\(\) => \{ scrollToEnd\(\); \}, \[messages\.length\]\)/);
  });

  it("still jumps for your own message", () => {
    // Sending is an explicit "take me there" - a composer that leaves your own
    // message off-screen is its own bug.
    expect(M).toMatch(/if \(grew && last\?\.mine\) setStick\(true\)/);
  });

  it("says a message arrived instead of silently staying put", () => {
    // Not yanking the reader is only half of it: without this, a message that
    // lands while they read history is completely invisible.
    expect(M).toMatch(/else if \(grew && !stick\) setHasNew\(true\)/);
    expect(M).toMatch(/\{hasNew && \(/);
    expect(M).toMatch(/New messages ↓/);
  });

  it("clears the pill whenever the thread is back at the bottom", () => {
    // By the button, by sending, or by scrolling there - all three land here.
    expect(M).toMatch(/if \(at\) setHasNew\(false\)/);
    expect(M).toMatch(/setStick\(true\);\s*setHasNew\(false\);\s*\}\)/);
  });

  it("uses state, not a ref, for the part read during render", () => {
    // The decision is made during render, and a ref may not be read or written
    // there - the lint rule says so, and it is right: the first version of this
    // fix did exactly that.
    expect(M).toMatch(/const \[stick, setStick\] = useState\(true\)/);
    expect(M).not.toMatch(/stickRef/);
  });

  it("does not carry 'not following' into another conversation", () => {
    // Scrolling up in one thread and switching to another opened the new one
    // part-way up, with a "New messages" pill for what were simply its
    // contents.
    expect(M).toMatch(/setMessages\(\[\]\);[\s\S]{0,80}setStick\(true\);\s*setHasNew\(false\);/);
  });
});

describe("people search cannot show the results of a query you moved past", () => {
  it("aborts the in-flight request and guards the response", () => {
    // The same race #316 fixed in the markets search, in a second place: the
    // cleanup cancelled the TIMER but never the REQUEST, and nothing guarded
    // the response, so of two searches in flight the slower one won.
    expect(M).toMatch(/const ctrl = new AbortController\(\)/);
    expect(M).toMatch(/signal: ctrl\.signal/);
    expect(M).toMatch(/return \(\) => \{ active = false; ctrl\.abort\(\); clearTimeout\(t\); \}/);
    expect(M).not.toMatch(/return \(\) => clearTimeout\(t\);\s*\}, \[q\]\)/);
  });

  it("does not clear `searching` from a stale response", () => {
    // The stale `.finally` flipped it off while a newer request was still
    // running, flashing "no one found" mid-typing.
    expect(M).toMatch(/\.finally\(\(\) => \{ if \(active\) setSearching\(false\); \}\)/);
    expect(M).not.toMatch(/\.finally\(\(\) => setSearching\(false\)\)/);
  });
});
