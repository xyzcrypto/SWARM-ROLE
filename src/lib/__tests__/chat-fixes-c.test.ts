import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isMediaBody, mediaLabel, splitLeadingMedia } from "@modules/community/lib/chat-media";

const read = (f: string) => readFileSync(f, "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
const VOICE = "https://abc.supabase.co/storage/v1/object/public/post-covers/voice/mul4iq96-t9myne5d.webm";
const GIF = "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExabc/giphy.gif";

describe("editing a voice message corrupted it (owner's screenshot)", () => {
  it("media cannot be edited - on the server, in both chats", () => {
    for (const f of ["src/app/api/chat/messages/[id]/route.ts", "src/app/api/dm/[id]/message/[messageId]/route.ts"]) {
      expect(strip(read(f)), f).toMatch(/if \(isMediaBody\(msg\.body\)\) return fail\("Photos, GIFs and voice messages can't be edited\.", 400\)/);
    }
    // ...and the room no longer offers Edit on one.
    expect(read("src/modules/community/components/ChatClient.tsx")).toMatch(/m\.kind !== "poll" && !isMediaBody\(m\.body\) && canEditMessage/);
  });

  it("a row already saved as <voice url> + text renders as the voice note with a caption", () => {
    const lead = splitLeadingMedia(`${VOICE}#d=3.4\n\n\nAap sabhi ka swagat h`)!;
    expect(lead.audio).toEqual({ src: VOICE, duration: 3.4 });
    expect(lead.caption).toBe("Aap sabhi ka swagat h");
    expect(mediaLabel(`${VOICE}#d=3.4\n\nhi`)).toBe("\u{1F3A4} Voice message · hi");
  });

  it("plain text, and links that are not ours, are not media", () => {
    expect(isMediaBody("hello https://abc.supabase.co/x")).toBe(false);
    expect(isMediaBody("https://evil.example/voice/a.webm")).toBe(false);
    expect(splitLeadingMedia("just words")).toBeNull();
  });

  it("a quote of a GIF says GIF, not the giphy URL", () => {
    expect(mediaLabel(GIF)).toBe("GIF");
    expect(read("src/modules/community/components/ChatClient.tsx")).toMatch(/\{mediaLabel\(m\.replyTo\.body\) \?\? m\.replyTo\.body\}/);
  });
});

describe("voice transcription", () => {
  const r = strip(read("src/app/api/media/voice/transcribe/route.ts"));
  it("only ever fetches OUR voice notes", () => {
    expect(r).toMatch(/const voice = chatAudioUrl\(parsed\.data\.url\);\s*if \(!voice\) return fail/);
  });
  it("signed-in, two AI rate-limit keys", () => {
    expect(r).toMatch(/getSessionUser\(\)/);
    expect([...r.matchAll(/rateLimit\("ai", `transcribe/g)]).toHaveLength(2);
  });
  it("never caches a failure (every failure throws inside unstable_cache)", () => {
    const fn = r.slice(r.indexOf("unstable_cache("), r.indexOf('["voice-transcript-v1"]'));
    expect(fn).not.toMatch(/return null/);
    expect(fn).toMatch(/throw new Error\("transcription unavailable"\)/);
  });
  it("records at 64 kbps with auto gain", () => {
    const v = read("src/modules/community/components/Voice.tsx");
    expect(v).toMatch(/audioBitsPerSecond: 64000/);
    expect(v).toMatch(/autoGainControl: true/);
    expect(v).toMatch(/const SPEEDS = \[1, 1\.5, 2\] as const/);
  });
});

describe("a control inside a message is not a message gesture", () => {
  it("double-tap, long-press and the room's double-click / tap ignore presses on controls", () => {
    const sw = strip(read("src/modules/community/components/SwipeBubble.tsx"));
    expect(sw).toMatch(/if \(!moved\.current && onDoubleTap && !start\.current\?\.control\)/);
    expect(sw).toMatch(/if \(touch && onLongPress && !control\)/);
    const room = read("src/modules/community/components/ChatClient.tsx");
    expect([...room.matchAll(/if \(fromControl\(e\.target\)\) return;/g)]).toHaveLength(2);
  });
});

describe("profile + settings get the same press feedback", () => {
  it("the ISR profile page wraps its markup in a client leaf (stays ISR)", () => {
    const pg = read("src/app/u/[username]/page.tsx");
    expect(pg).toMatch(/<PressFeedback>/);
    expect(pg).not.toMatch(/^"use client"/m);
    expect(read("src/shared/components/PressFeedback.tsx")).toMatch(/className="contents" onPointerDownCapture=\{chatPressFeedback\}/);
  });
  it("settings has the Customize tab (was 'Haptics & sound', now the full panel)", () => {
    const s = read("src/modules/settings/components/SettingsClient.tsx");
    expect(s).toMatch(/\{ id: "feel", label: "Customize" \}/);
    expect(s).toMatch(/<div onPointerDownCapture=\{chatPressFeedback\}>/);
  });
});
