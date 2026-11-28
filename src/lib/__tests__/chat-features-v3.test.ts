import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isFetchableUrl, isPublicAddress } from "@core/net/safe-fetch";
import { sniffAudioType } from "@core/storage/storage";
import { chatAudioUrl, mediaLabel } from "@modules/community/lib/chat-media";
import { firstLink, parsePreview, decodeEntities } from "@modules/community/lib/link-preview";

const read = (f: string) => readFileSync(f, "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

describe("link previews cannot be pointed at the server's own network", () => {
  it("refuses every private, loopback, link-local and metadata address", () => {
    for (const ip of [
      "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
      "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fc00::1", "fd12::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1",
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it("allows ordinary public addresses, including ones next to private ranges", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "11.0.0.1", "2606:4700:4700::1111"]) {
      expect(isPublicAddress(ip), ip).toBe(true);
    }
  });

  it("only http(s), default ports, no credentials, no literal private hosts", () => {
    expect(isFetchableUrl("https://example.com/a")).not.toBeNull();
    for (const bad of [
      "file:///etc/passwd", "gopher://x", "http://127.0.0.1/", "http://[::1]/", "http://169.254.169.254/latest",
      "http://example.com:6379/", "http://user:pw@example.com/", "http://localhost/", "http://db.internal/", "not a url",
    ]) {
      expect(isFetchableUrl(bad), bad).toBeNull();
    }
  });

  it("checks the address it dials, not a hostname it resolved earlier", () => {
    // The DNS-rebinding shape: validate-then-fetch resolves twice. The socket's
    // own `lookup` is the only place the answer cannot change afterwards.
    const src = strip(read("src/core/net/safe-fetch.ts"));
    expect(src).toMatch(/lookup: guardedLookup/);
    expect(src).toMatch(/if \(r\.location\) \{ u = isFetchableUrl\(/);
    expect(src).not.toMatch(/\bfetch\(/);
  });
});

describe("the preview is text-only and the route is cheap", () => {
  const html = `<html><head><title>Fallback &amp; title</title>
    <meta property="og:title" content="Bitcoin ETF flows &#8212; weekly">
    <meta content="Net inflows hit a record." name="description">
    <meta property="og:site_name" content="CoinDesk"><meta property="og:image" content="https://evil.example/pixel.gif"></head>`;

  it("reads og tags in either attribute order and decodes entities", () => {
    const p = parsePreview(html, "https://www.coindesk.com/x")!;
    expect(p.title).toBe("Bitcoin ETF flows — weekly");
    expect(p.description).toBe("Net inflows hit a record.");
    expect(p.siteName).toBe("CoinDesk");
    expect(p.host).toBe("coindesk.com");
    // No image field at all: a third-party image would leak every reader's IP.
    expect(Object.keys(p)).not.toContain("image");
  });

  it("falls back to <title>, and gives up without one", () => {
    expect(parsePreview("<title>Just a title</title>", "https://a.com")!.title).toBe("Just a title");
    expect(parsePreview("<p>nothing</p>", "https://a.com")).toBeNull();
    expect(decodeEntities("a &lt;b&gt; &#x41;")).toBe("a <b> A");
  });

  it("finds the first link and drops trailing punctuation", () => {
    expect(firstLink("see https://example.com/a?b=1).")).toBe("https://example.com/a?b=1");
    expect(firstLink("no links here")).toBeNull();
  });

  it("route: signed-in only, own bucket on both keys, cached privately (never at the edge), reduced value cached", () => {
    const r = strip(read("src/app/api/link-preview/route.ts"));
    expect(r).toMatch(/getSessionUser\(\)/);
    expect([...r.matchAll(/rateLimit\("linkPreview"/g)]).toHaveLength(2);
    // A shared cache never runs the handler, so `public` let anonymous callers
    // read every cached preview past the sign-in gate (review L4).
    expect(r).toMatch(/private, max-age=\$\{TTL\}/);
    expect(r).not.toMatch(/public, s-maxage/);
    expect(r).toMatch(/unstable_cache\(/);
    expect(read("src/core/ratelimit/ratelimit.ts")).toMatch(/linkPreview: make\(30, 60, "link_preview"\)/);
  });

  it("the card only fetches once the message is on screen", () => {
    const c = read("src/modules/community/components/LinkPreviewCard.tsx");
    expect(c).toMatch(/new IntersectionObserver\(/);
    expect(c).toMatch(/const memo = new Map</);
  });
});

describe("voice messages", () => {
  const bytes = (...h: number[]) => new Uint8Array([...h, ...new Array(16).fill(0)]).buffer;

  it("sniffs the real container, not the declared type", () => {
    expect(sniffAudioType(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe("audio/webm");
    expect(sniffAudioType(bytes(0x4f, 0x67, 0x67, 0x53))).toBe("audio/ogg");
    expect(sniffAudioType(bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20))).toBe("audio/mp4");
    // An AVIF image is also `ftyp` - it must not pass as audio.
    expect(sniffAudioType(bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66))).toBeNull();
    expect(sniffAudioType(bytes(0xff, 0xd8, 0xff))).toBeNull();
  });

  it("is never stored inline in the database", () => {
    // A base64 voice note in a message row would ride every thread response -
    // the Fast Origin Transfer trap (cost-check, trap 4).
    const s = strip(read("src/core/storage/storage.ts"));
    const fn = s.slice(s.indexOf("export async function uploadAudio"));
    expect(fn).not.toMatch(/data:audio|toString\("base64"\)|inline\(\)/);
    expect(fn).toMatch(/if \(!storageEnabled\)/);
  });

  it("the route is limited on two keys and refuses a huge body before reading it", () => {
    const r = strip(read("src/app/api/media/voice/route.ts"));
    expect([...r.matchAll(/if \(!success\) return/g)]).toHaveLength(2);
    expect(r).toMatch(/content-length/);
  });

  it("only our own Storage voice URLs play; the length rides in the fragment", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    const own = "https://abc.supabase.co/storage/v1/object/public/post-covers/voice/k3-x9.webm";
    expect(chatAudioUrl(`${own}#d=12.5`)).toEqual({ src: own, duration: 12.5 });
    expect(chatAudioUrl(own)).toEqual({ src: own, duration: null });
    expect(chatAudioUrl("https://evil.example/storage/v1/object/public/b/voice/a.webm")).toBeNull();
    expect(chatAudioUrl("https://abc.supabase.co/storage/v1/object/public/b/covers/a.webm")).toBeNull();
    expect(chatAudioUrl(`${own} hello`)).toBeNull();
    expect(chatAudioUrl(`${own}#d=99999`)).toEqual({ src: own, duration: null });
    expect(mediaLabel(`${own}#d=3`)).toBe("\u{1F3A4} Voice message");
  });

  it("does not download a note until someone presses play", () => {
    expect(read("src/modules/community/components/Voice.tsx")).toMatch(/preload="none"/);
  });
});

describe("DM typing indicator", () => {
  const dm = read("src/modules/messages/components/MessagesClient.tsx");
  it("goes browser to browser on a per-conversation topic - no server, no content", () => {
    expect(dm).toMatch(/joinSharedChannel\(url, key, dmChannel\(id\)\)/);
    expect(dm).toMatch(/typingCh\.current\?\.send\("typing", \{ userId: meId \}\)/);
    expect(dm).not.toMatch(/fetch\([^)]*typing/);
  });
  it("one ping per burst, and it clears itself", () => {
    expect(dm).toMatch(/now - lastTypingSent\.current < 2500/);
    expect(dm).toMatch(/setTimeout\(\(\) => setTheyTyping\(false\), 4000\)/);
  });
  it("the channel name comes from the client-safe module", () => {
    expect(read("src/core/realtime/realtime-channels.ts")).toMatch(/export const dmChannel = \(conversationId: string\) => `dm:\$\{conversationId\}`/);
    expect(dm).toMatch(/import \{ dmChannel \} from "@\/lib\/realtime-channels"/);
  });
});
