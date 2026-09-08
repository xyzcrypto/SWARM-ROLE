import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Community chat, the second bug pass (after #314's destructive rollback).
// Three failures, one shared shape: the room quietly disagreeing with the
// server about what is in it.
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203, so reading one matches nothing and passes while
// verifying nothing.
const strip = (s: string) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");
const read = (p: string) => strip(readFileSync(p, "utf8"));
const C = read("src/modules/community/components/ChatClient.tsx");
const mod = read("src/app/api/chat/messages/moderate/route.ts");
const lib = read("src/modules/community/lib/chat.ts");

describe("neither arrival path runs side effects inside a state updater", () => {
  it("the poll counts unread and plays the blip outside it", () => {
    // A state updater must be pure - React may invoke it more than once for a
    // single update - and this one called `setUnread`, wrote `firstUnreadRef`
    // and played a sound. Two invocations counted every new message twice and
    // blipped twice.
    expect(C).toMatch(/const \{ incoming \} = reconcilePoll\(messagesRef\.current, fresh\)/);
    expect(C).not.toMatch(/setMessages\(\(prev\) => \{[\s\S]{0,900}playBlip\(/);
  });

  it("appendMessage does too - the realtime path, which is the hotter one", () => {
    // Found by the assertion below failing on a second call site, not by
    // looking: `appendMessage` had the identical shape, and every realtime
    // message goes through it.
    expect(C).toMatch(/if \(messagesRef\.current\.some\(\(x\) => x\.id === m\.id\)\) return;/);
    expect(C).toMatch(/setMessages\(\(prev\) => \(prev\.some\(\(x\) => x\.id === m\.id\) \? prev : \[\.\.\.prev, next\]\)\)/);
  });

  it("nowhere in the file bumps the badge from inside an updater", () => {
    // The general form, so a third call site cannot quietly reintroduce it.
    expect(C).not.toMatch(/setMessages\(\(prev\) => \{[\s\S]{0,700}setUnread\(/);
  });

  it("keeps the mirror ref honest for two arrivals in one tick", () => {
    // The ref is normally written by an effect, i.e. a render behind. Writing
    // it here as well is what stops two messages landing in the same tick from
    // both being counted as new.
    expect(C).toMatch(/messagesRef\.current = \[\.\.\.messagesRef\.current, next\]/);
  });

  it("still merges against `prev`, not against the mirror", () => {
    // The merge itself has to use the updater's own `prev`, or a message that
    // landed over realtime since the ref was last synced would be dropped.
    expect(C).toMatch(/setMessages\(\(prev\) => \{\s*const r = reconcilePoll\(prev, fresh\);/);
  });
});

describe("Load older cannot become a button that never finishes", () => {
  it("stops when the cursor cannot advance", () => {
    // It kept `hasMore` true whenever the SERVER said so and the page was
    // non-empty - even when every row in it was already on screen. A fully
    // de-duped page means the next request uses the same cursor and returns the
    // same rows, so the button stayed and every press re-fetched it forever.
    expect(C).toMatch(/setHasMore\(Boolean\(data\.hasMore\) && older\.length > 0\)/);
    expect(C).not.toMatch(/older\.length > 0 \|\| \(data\.messages as Message\[\]\)\.length > 0/);
  });
});

describe("a bulk restore is visible without a reload", () => {
  it("broadcasts once for the batch", () => {
    // It broadcast nothing, on the reasoning that clients pick the messages up
    // on their next poll. Half true, and the wrong half: a live client's poll
    // is throttled to a 60s safety reconcile, and it only fetches the LATEST
    // page - so an older restored message never came back at all.
    expect(mod).toMatch(/broadcastChatEvent\(\{ event: "messages_restored", payload: \{ count \} \}\)/);
    expect(mod).toMatch(/if \(count > 0\)/); // nothing restored, nothing to say
  });

  it("carries no messages, on purpose", () => {
    // The batch is every hidden message ever - unbounded. One event per message
    // to every connected client is not a thing to do on a bulk action.
    expect(lib).toMatch(/\{ event: "messages_restored"; payload: \{ count: number \} \}/);
  });

  it("the client forces a reconcile rather than waiting out the throttle", () => {
    expect(C).toMatch(/onBroadcast\("messages_restored", \(\) => \{ void tickRef\.current\?\.\(true\); \}\)/);
    // `force` has to exist on the ref's type or the call is a no-op the
    // compiler would have caught - it did, which is how this line got written.
    expect(C).toMatch(/tickRef: \{ current\?: \(force\?: boolean\) => Promise<void> \}/);
  });
});
