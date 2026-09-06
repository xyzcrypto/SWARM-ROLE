"use client";

import { useMemo } from "react";
import Link from "next/link";
import { safeHref, cleanBareUrl } from "@/lib/links";
import { MENTION_SPLIT_RE, MENTION_TOKEN_RE } from "@shared/utils/mentions";

/**
 * Message text with links and @mentions made real.
 *
 * ## Why this is shared
 *
 * The community room had this logic inline with its own regex literals, and DM
 * had none at all - `<p className="whitespace-pre-wrap">{m.body}</p>`, a raw
 * string. So the same message was a set of working links in one room and grey
 * text in the other, and the two could never have been kept in step because
 * they had no shared definition of what a mention or a link is.
 *
 * Now both render through here, and both get their patterns from
 * `shared/utils/mentions` - which is also what the SERVER extracts mentions
 * with when it decides who to notify. Three places, one definition; the thing
 * that highlights a mention and the thing that notifies on it cannot disagree
 * about which words are mentions.
 *
 * ## The unsafe-url rule
 *
 * Feed and message urls are attacker-controlled text. React sanitises `href`
 * on an `<a>` it renders, but `safeHref` is applied anyway and an unsafe url
 * falls through to plain text rather than becoming a link at all - the same
 * rule the news reader's share path uses.
 */
export function MessageText({ text, className }: { text: string; className?: string }) {
  // `MENTION_SPLIT_RE` has the /g flag, so it carries a mutable `lastIndex`.
  // `String.split` does not read it (unlike `.test`/`.exec`), which is why this
  // is safe to share as a module constant - but it is worth knowing, because
  // the same constant used with `.test()` would fail every other call.
  const parts = useMemo(() => text.split(MENTION_SPLIT_RE), [text]);

  return (
    <p className={className}>
      {parts.map((part, i) => {
        if (/^https?:\/\//.test(part)) {
          const url = cleanBareUrl(part);
          const href = safeHref(url);
          if (href) {
            return (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-gold-200 underline decoration-gold-500/40 underline-offset-2 hover:text-gold-100"
              >
                {url}
              </a>
            );
          }
        }
        if (MENTION_TOKEN_RE.test(part)) {
          return (
            <Link
              key={i}
              href={`/u/${part.slice(1).toLowerCase()}`}
              className="font-medium text-mint-300 hover:underline"
            >
              {part}
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}
