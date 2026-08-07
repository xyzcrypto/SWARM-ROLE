// Turn the current pathname into one or two suggestions about what the member is
// actually looking at, so the panel opens with "explain this chart" rather than a
// generic menu.
//
// Pure and derived from the path alone - no fetch, no new data dependency. The
// assistant already receives live market and research grounding server-side, so
// these only need to phrase the question; the answer's accuracy comes from there.

export type PageSuggestion = { q: string; label: string };

/** Turn a slug or coin id into something readable: "perp-dex-2026" → "Perp Dex 2026". */
function humanise(seg: string): string {
  return seg
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Suggestions for the page the member is on, most specific first. Returns [] for
 * pages with no useful context - the caller then shows only the general set.
 */
export function pageSuggestions(pathname: string | null | undefined): PageSuggestion[] {
  if (!pathname) return [];
  const seg = pathname.split("?")[0].split("/").filter(Boolean);
  if (seg.length === 0) return [];

  // /markets/<id> - a single coin. Excludes /markets/protocol/... which is a
  // different shape handled below.
  if (seg[0] === "markets" && seg.length >= 2 && seg[1] !== "protocol") {
    const coin = humanise(seg[1]);
    return [
      { q: `What's driving ${coin}'s price action right now?`, label: `Explain ${coin}'s move` },
      { q: `What should I watch on ${coin} over the next few days?`, label: `What to watch on ${coin}` },
    ];
  }

  if (seg[0] === "markets" && seg[1] === "protocol" && seg.length >= 4) {
    const name = humanise(seg[3]);
    return [{ q: `Explain the ${name} protocol and how it makes money.`, label: `Explain ${name}` }];
  }

  // /research/<slug> - a specific article.
  if (seg[0] === "research" && seg.length >= 2) {
    const title = humanise(seg[1]);
    return [
      { q: `Summarise the key points of the "${title}" research post.`, label: "Summarise this post" },
      { q: `What are the practical takeaways from "${title}"?`, label: "Practical takeaways" },
    ];
  }

  if (seg[0] === "journal") {
    return [
      { q: "Review my recent trades and tell me what pattern is costing me the most.", label: "Review my trades" },
    ];
  }

  if (seg[0] === "news") {
    return [{ q: "What are the most important crypto headlines today and why do they matter?", label: "Today's headlines" }];
  }

  if (seg[0] === "markets") {
    return [{ q: "Give me a market overview: what moved today and what's driving it?", label: "Market overview" }];
  }

  return [];
}
