import type { BriefContent } from "@modules/academy/client/page-brief";
import type { NewsItem } from "./news";

const IMPACT_RANK: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
const ORD = ["First", "Second", "Third", "Fourth", "Fifth"];

/**
 * What AneQue reads from the news page: the five most important recent
 * stories (impact first, then newest), with their source. Pure, for tests.
 */
export function newsBrief(items: NewsItem[] | null | undefined, now = Date.now()): BriefContent {
  const list = (items ?? []).filter((n) => n && n.title);
  const recent = list.filter((n) => now - n.publishedAt < 24 * 3600_000);
  const pool = recent.length >= 3 ? recent : list;
  const top = [...pool]
    .sort((a, b) => (IMPACT_RANK[String(b.impact)] ?? 0) - (IMPACT_RANK[String(a.impact)] ?? 0) || b.publishedAt - a.publishedAt)
    .slice(0, 5);
  const spoken = top.map((n, i) => `${ORD[i]}, from ${n.source}: ${n.title.replace(/\s+/g, " ").trim()}.`);
  const context =
    "Latest headlines on the News page:\n" +
    list
      .slice(0, 15)
      .map((n) => `- ${n.title} (${n.source}, ${String(n.sentiment)} sentiment, ${String(n.impact)} impact${n.tokens?.length ? `, tokens: ${n.tokens.slice(0, 4).join(" ")}` : ""}): ${(n.summary || "").replace(/\s+/g, " ").slice(0, 180)}`)
      .join("\n");
  return { spoken, context: list.length ? context : "" };
}
