import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { computeStats, type TradeLike } from "@/lib/journal";

// Public share card for a member's OVERALL trading-journal performance - a
// branded 1200x630 image, same ImageResponse pattern as the challenge share
// card.
//
// PRIVACY - two independent rules, both required:
//  1. Only PUBLIC trades are counted, and only for a non-private profile.
//     (Anonymous trades are published without a name, so they cannot be
//     counted on a card that prints one.)
//     `Trade.visibility` defaults to "private", so the query MUST filter on it.
//     Without that filter this endpoint disclosed a member's real total P&L to
//     any unauthenticated caller who knew their userId - and a userId is not a
//     secret (it is serialized into the RSC payload of every public profile).
//  2. Only aggregate numbers (win rate / total P&L / trade count) are ever
//     rendered - never symbols, entry/exit prices, notes, or screenshots -
//     mirroring the challenge card's "aggregate only, never raw" rule.
//
// No session gate by design (link-preview bots on Discord/Twitter/Telegram must
// fetch it without cookies), which is exactly why rule 1 carries the whole
// authorization burden: the visibility filter IS the access control here, not
// the URL. Any lookup failure falls back to a generic, data-free card.
export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 };
const CACHE = { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } };

function fallbackCard() {
  return new ImageResponse(<GenericCard />, { ...SIZE, ...CACHE });
}

export async function GET(_req: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: params.userId }, select: { name: true, username: true, profileVisibility: true } });
    // A private profile shows nothing beyond a name and photo, here too: the
    // sibling activity route was fixed for exactly this (audit F-04), this card
    // was not, so a member who went private still had their P&L served to
    // anyone holding their id (it travels in chat payloads).
    if (!user || user.profileVisibility === "private") return fallbackCard();

    const rows = await prisma.trade
      .findMany({
        // Only trades the member actually published. `Trade.visibility` defaults
        // to "private", so without this filter the card aggregated every trade
        // the user had ever logged and served their real P&L to anyone holding
        // a userId - which is not a secret (it ships in the RSC payload of every
        // public profile). Mirrors the challenge card, which refuses to render
        // anything for a private challenge.
        // PUBLIC trades only. "anonymous" means published WITHOUT the member's
        // name; counting them here printed them under @username, which undid
        // the anonymity the member chose.
        where: { userId: params.userId, visibility: "public" },
        select: { side: true, stopLoss: true, takeProfit: true, fills: { select: { kind: true, price: true, size: true, fee: true } } },
      })
      .catch(() => [] as { side: string; stopLoss: number | null; takeProfit: number | null; fills: { kind: string; price: number; size: number; fee: number }[] }[]);

    const trades: TradeLike[] = rows.map((t) => ({
      side: t.side,
      stopLoss: t.stopLoss,
      takeProfit: t.takeProfit,
      fills: t.fills.map((f) => ({ ...f, kind: f.kind as "entry" | "exit" })),
    }));
    const stats = computeStats(trades);
    if (stats.totalTrades === 0) return fallbackCard();

    const positive = stats.totalPnl >= 0;
    const displayName = user.username ? `@${user.username}` : user.name || "A trader";

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "72px",
            background: "linear-gradient(135deg, #08080a 0%, #0e0e12 60%, #15110a 100%)",
            color: "#fafafa",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: "#e2a72f" }}>XYZ</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: "#fafafa" }}>Crypto</div>
            <div
              style={{
                display: "flex",
                marginLeft: "auto",
                padding: "8px 18px",
                borderRadius: "999px",
                border: "1px solid rgba(226,167,47,0.4)",
                color: "#f3d488",
                fontSize: 20,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              Trading Journal
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: 30, color: "#a1a1aa", display: "flex" }}>{displayName} - overall performance</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "16px", marginTop: "12px" }}>
              <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: "-0.03em", color: positive ? "#22d692" : "#f43f5e", display: "flex" }}>
                {positive ? "+" : ""}
                {stats.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 26, color: "#a1a1aa" }}>
              {stats.winRate.toFixed(1)}% win rate · {stats.totalTrades} trades logged
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 24, color: "#71717a" }}>xyzcrypto.com/journal - The Home Of Next Gen Web3</div>
        </div>
      ),
      { ...SIZE, ...CACHE }
    );
  } catch {
    return fallbackCard();
  }
}

function GenericCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        background: "linear-gradient(135deg, #08080a 0%, #0e0e12 60%, #15110a 100%)",
        color: "#fafafa",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.02em", color: "#e2a72f" }}>XYZ</div>
        <div style={{ fontSize: 48, fontWeight: 700, color: "#fafafa" }}>Crypto</div>
      </div>
      <div style={{ display: "flex", fontSize: 28, color: "#a1a1aa" }}>Trading Journal</div>
    </div>
  );
}
