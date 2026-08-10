import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { chatMediaUrl } from "@/lib/chat-media";

// `chatMediaUrl` fails closed when no Supabase origin is configured, so without
// this the media assertion below would pass for the wrong reason.
const REF = "https://zlgfdqczvdewwpxaiusw.supabase.co";
const prev = process.env.SUPABASE_URL;
beforeAll(() => {
  process.env.SUPABASE_URL = REF;
});
afterAll(() => {
  process.env.SUPABASE_URL = prev;
});

const src = readFileSync("src/modules/messages/components/MessagesClient.tsx", "utf8");

// A photo is sent as a bare media URL in the message body, so anything that
// prints a body as TEXT has to run it through `inboxPreview` first. Replying to
// a photo showed the caller a wall of
// `https://<ref>.supabase.co/storage/v1/object/.../covers/…webp` where the
// message itself shows a picture - in the quote above the bubble, in the reply
// bar over the composer, and in the forward sheet.
describe("a quoted photo reads as a photo, not as a storage URL", () => {
  it("the reply quote above a bubble goes through inboxPreview", () => {
    expect(src).toMatch(/inboxPreview\(m\.replyTo\.body\)/);
    expect(src).not.toMatch(/:\s*m\.replyTo\.body\}/);
  });

  it("the reply bar above the composer goes through inboxPreview", () => {
    expect(src).toMatch(/inboxPreview\(replyTo\.body\)/);
  });

  it("the forward sheet preview goes through inboxPreview", () => {
    expect(src).toMatch(/inboxPreview\(forwarding\.body\)/);
  });

  // The helper itself only rewrites what is actually a media URL - ordinary text
  // must survive untouched, including text that merely mentions a link.
  it("only rewrites real media URLs", () => {
    expect(chatMediaUrl("Hlo buddy")).toBeFalsy();
    expect(
      chatMediaUrl(`${REF}/storage/v1/object/public/covers/covers/msno3q4d-kjjia7db.webp`)
    ).toBeTruthy();
  });
});
