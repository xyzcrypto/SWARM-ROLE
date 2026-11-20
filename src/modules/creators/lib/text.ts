// Text from X and YouTube goes into Postgres (text columns and JSONB), and two
// things in ordinary third-party text break that write outright:
//
//  1. A LONE SURROGATE. `"🚀".slice(0, 1)` cuts an emoji in half; JSON keeps
//     the orphan as `\ud83d`, and Prisma's engine rejects the whole payload
//     with "unexpected end of hex escape". One emoji at the 1,500-character cut
//     of one video description failed the save of an entire venue's discovery,
//     so the YouTube tab showed an error instead of any data.
//  2. A NUL character (`\u0000`), which Postgres refuses in text and jsonb
//     ("unsupported Unicode escape sequence").
//
// cleanText() truncates by code point, never inside a pair, and drops both.

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function cleanText(input: unknown, max = Infinity): string {
  let s = typeof input === "string" ? input : input == null ? "" : String(input);
  // eslint-disable-next-line no-control-regex
  s = s.replace(/\u0000/g, "").replace(LONE_SURROGATE, "");
  if (s.length <= max) return s;
  return Array.from(s).slice(0, max).join("");
}
