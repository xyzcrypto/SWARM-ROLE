import type { BriefContent } from "@modules/academy/client/page-brief";
import { money } from "@modules/academy/client/page-brief";
import type { ProgramView } from "./programs";

/**
 * What AneQue says on /points: which programmes are tracked and live, the
 * biggest by 24h volume, and how each one earns. Pure, for tests.
 */
export function pointsBrief(programs: ProgramView[] | null | undefined): BriefContent {
  const list = programs ?? [];
  if (!list.length) return { spoken: [], context: "" };
  const phase = (p: ProgramView) => String(p.phase || "").toLowerCase();
  const live = list.filter((p) => /live|active|season/.test(phase(p)));
  const byVol = [...list].filter((p) => p.venue && p.venue.volume24h > 0).sort((a, b) => (b.venue!.volume24h || 0) - (a.venue!.volume24h || 0));
  const spoken: string[] = [];
  spoken.push(`I'm tracking ${list.length} points program${list.length === 1 ? "" : "s"}${live.length ? `, and ${live.length} ${live.length === 1 ? "is" : "are"} live right now` : ""}.`);
  if (byVol.length) {
    spoken.push(`By trading volume, the busiest today ${byVol.length > 1 ? "are" : "is"} ${byVol.slice(0, 3).map((p) => `${p.name}, with ${money(p.venue!.volume24h)} in 24 hours`).join("; ")}.`);
  }
  const first = live[0] ?? list[0];
  if (first?.earnRate || first?.rules) {
    spoken.push(`On ${first.name}, ${(first.earnRate || first.rules).replace(/\s+/g, " ").slice(0, 160)}.`);
  }
  spoken.push("Use the calculator below to estimate what your points could be worth. Remember, airdrops are never guaranteed.");
  const context =
    "Points programs on the page:\n" +
    list
      .slice(0, 12)
      .map((p) =>
        [
          `- ${p.name} (${p.phase}${p.confirmed ? ", confirmed" : ""}${p.season ? `, ${p.season}` : ""}, chain ${p.chain})`,
          p.venue ? `24h volume ${money(p.venue.volume24h)}, open interest ${money(p.venue.openInterest)}${p.venue.fdv ? `, FDV ${money(p.venue.fdv)}` : ""}` : "",
          p.earnRate ? `earn: ${p.earnRate}` : "",
          p.rules ? `rules: ${p.rules.slice(0, 160)}` : "",
          p.fees ? `fees: ${p.fees}` : "",
          p.maxLeverage ? `max leverage ${p.maxLeverage}` : "",
          p.tgeAt ? `TGE ${p.tgeAt}` : "",
        ]
          .filter(Boolean)
          .join("; ")
      )
      .join("\n");
  return { spoken, context };
}
