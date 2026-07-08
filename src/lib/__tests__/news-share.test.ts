import { describe, expect, it } from "vitest";
import { encodeStory, decodeStory, shareUrl } from "@/lib/news-share";

describe("news-share encode/decode", () => {
  const story = {
    u: "https://example.com/article?id=1&x=2",
    t: "Bitcoin ETF sees record inflows - what it means",
    s: "A short excerpt with unicode: café, 数字货币, 🚀.",
    src: "CoinDesk",
    img: "https://img.example.com/a.jpg",
    ts: 1_720_000_000_000,
    cat: "Markets",
  };

  it("round-trips a story (unicode-safe, url-safe token)", () => {
    const tok = encodeStory(story);
    expect(tok).not.toMatch(/[+/=]/); // url-safe alphabet only
    const back = decodeStory(tok);
    expect(back).toMatchObject({ u: story.u, t: story.t, s: story.s, src: story.src, cat: story.cat, ts: story.ts });
  });

  it("returns null for malformed or url-less tokens", () => {
    expect(decodeStory("not-base64!!")).toBeNull();
    expect(decodeStory(encodeStory({ u: "", t: "x" }))).toBeNull();
  });

  it("builds an on-site share URL", () => {
    const url = shareUrl("https://xyz.example", story);
    expect(url.startsWith("https://xyz.example/news/read?d=")).toBe(true);
    expect(decodeStory(url.split("d=")[1])?.t).toBe(story.t);
  });
});
