import { parsePeriod, PERIOD_LABEL, rankShare } from "@modules/academy/lib/share";
import { shareCard } from "@modules/academy/lib/share-card";

export const runtime = "nodejs";

// PNG share card of a member's leaderboard standing. Standings move, so it is
// edge-cached for 5 minutes, not forever.
export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const period = parsePeriod(new URL(req.url).searchParams.get("p"));
  const r = await rankShare(handle, period).catch(() => null);
  const cache = "public, max-age=300, s-maxage=300, stale-while-revalidate=600";
  if (!r) {
    return shareCard({ eyebrow: "LEADERBOARD", title: "Climb the board", name: "XYZ Crypto Academy", stats: [{ label: "Daily", value: "Board" }, { label: "Weekly", value: "Board" }, { label: "Certificates", value: "Verified" }] }, "public, s-maxage=60");
  }
  return shareCard(
    {
      eyebrow: `LEADERBOARD · ${PERIOD_LABEL[period].toUpperCase()}`,
      title: r.rank ? `Rank #${r.rank}` : `Level ${r.level.level} · ${r.level.name}`,
      name: r.name,
      subtitle: r.rank ? `of ${r.size.toLocaleString("en-US")} learner${r.size === 1 ? "" : "s"} ${PERIOD_LABEL[period].toLowerCase()}` : "On the XYZ Crypto Academy leaderboard",
      badge: r.rank ? `#${r.rank}` : `Lv${r.level.level}`,
      stats: [
        { label: `XP ${PERIOD_LABEL[period].toLowerCase()}`, value: r.periodXp.toLocaleString("en-US") },
        { label: `Level ${r.level.level}`, value: r.level.name },
        { label: "Streak", value: `${r.streak} day${r.streak === 1 ? "" : "s"}` },
      ],
      footer: `xyzcrypto.io/u/${r.username}`,
    },
    cache
  );
}
