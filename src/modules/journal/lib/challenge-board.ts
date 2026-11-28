import "server-only";
import { prisma } from "@/lib/prisma";
import type { Standing } from "@modules/tools/lib/challenge";

/**
 * Every participant of a challenge with their realized P&L and trade count,
 * summed in the database. Same math as participantPnl() in challenge.ts:
 *
 *  - average-cost: exits are priced against the trade's size-weighted average
 *    entry, so gross = dir * (exit notional - avgEntry * exit size);
 *  - net of every fee on the trade;
 *  - a trade counts toward P&L only once it has both an entry and an exit
 *    (deriveStatus() !== "open"); `trades` counts every linked trade;
 *  - only participants are ranked: a trade linked to the challenge by someone
 *    who is not a participant is ignored, as before.
 *
 * Why: the detail route used to load every trade of every participant with
 * all fills and add them up in JS, on every view of a public or community
 * challenge (review M10). This returns one small row per participant.
 * Ordered by P&L (best first), ties by join time.
 */
export async function challengeStandings(challengeId: string): Promise<Standing[]> {
  const rows = await prisma.$queryRaw<{ userId: string; trades: number; pnl: number }[]>`
    WITH per_trade AS (
      SELECT t."userId", t."side",
        COALESCE(SUM(f."size") FILTER (WHERE f."kind" = 'entry'), 0) AS entry_size,
        COALESCE(SUM(f."size") FILTER (WHERE f."kind" = 'exit'), 0) AS exit_size,
        COALESCE(SUM(f."price" * f."size") FILTER (WHERE f."kind" = 'entry'), 0) AS entry_notional,
        COALESCE(SUM(f."price" * f."size") FILTER (WHERE f."kind" = 'exit'), 0) AS exit_notional,
        COALESCE(SUM(f."fee"), 0) AS fees
      FROM "Trade" t
      LEFT JOIN "TradeFill" f ON f."tradeId" = t."id"
      WHERE t."challengeId" = ${challengeId}
      GROUP BY t."id", t."userId", t."side"
    ),
    per_user AS (
      SELECT "userId", COUNT(*) AS trades,
        SUM(CASE WHEN entry_size > 0 AND exit_size > 0
          THEN (CASE WHEN side = 'long' THEN 1 ELSE -1 END) * (exit_notional - (entry_notional / entry_size) * exit_size) - fees
          ELSE 0 END) AS pnl
      FROM per_trade
      GROUP BY "userId"
    )
    SELECT p."userId", COALESCE(u.trades, 0)::int AS trades, COALESCE(u.pnl, 0)::float8 AS pnl
    FROM "ChallengeParticipant" p
    LEFT JOIN per_user u ON u."userId" = p."userId"
    WHERE p."challengeId" = ${challengeId}
    ORDER BY pnl DESC, p."joinedAt" ASC`;
  return rows.map((r) => ({ userId: r.userId, trades: Number(r.trades), pnl: Number(r.pnl) }));
}
