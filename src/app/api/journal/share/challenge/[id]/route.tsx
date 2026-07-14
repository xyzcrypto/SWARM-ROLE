import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { currentCapital, participantPnl, returnPct, daysElapsed, totalDurationDays } from "@/lib/challenge";

// Public share card for a challenge's progress - a branded 1200x630 image,
// same ImageResponse pattern as src/app/research/[slug]/opengraph-image.tsx.
// PRIVACY: private challenges (and any lookup failure) fall back to a
// generic, data-free card - never leak a private challenge's title/numbers
// to an unauthenticated image request (this route has no session gate by
// design, so public/community challenges can be shared to Discord/Twitter,
// which fetch OG images without cookies).
export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 };
// Share cards are fetched repeatedly by link-preview bots on every share;
// progress numbers don't need per-request freshness, so cache generously to
// cut origin-transfer usage.
const CACHE = { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } };

function fallbackCard() {
  return new ImageResponse(<GenericCard />, { ...SIZE, ...CACHE });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const challenge = await prisma.challenge.findUnique({ where: { id: params.id } });
    if (!challenge || challenge.visibility === "private") return fallbackCard();

    const rows = await prisma.trade
      .findMany({
        where: { challengeId: challenge.id, userId: challenge.creatorId },
        select: { side: true, fills: { select: { kind: true, price: true, size: true, fee: true } } },
      })
      .catch(() => [] as { side: string; fills: { kind: string; price: number; size: number; fee: number }[] }[]);
    const trades = rows.map((t) => ({ side: t.side, fills: t.fills.map((f) => ({ ...f, kind: f.kind as "entry" | "exit" })) }));

    const pnl = participantPnl(trades);
    const capital = currentCapital(challenge.startingCapital, pnl);
    const pct = returnPct(challenge.startingCapital, capital);
    const window = {
      startDate: challenge.startDate.toISOString(),
      endDate: challenge.endDate.toISOString(),
      startingCapital: challenge.startingCapital,
    };
    const elapsed = daysElapsed(window, new Date());
    const total = totalDurationDays(window);
    const positive = pct >= 0;

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
              Trading Challenge
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", maxWidth: "1000px", display: "flex" }}>
              {challenge.title}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "16px", marginTop: "12px" }}>
              <div style={{ fontSize: 110, fontWeight: 800, letterSpacing: "-0.03em", color: positive ? "#22d692" : "#f43f5e", display: "flex" }}>
                {positive ? "+" : ""}
                {pct.toFixed(1)}%
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 26, color: "#a1a1aa" }}>
              Day {elapsed} of {total} · ${challenge.startingCapital.toLocaleString()} → ${Math.round(capital).toLocaleString()}
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 24, color: "#71717a" }}>xyzcrypto - The Home Of Next Gen Web3</div>
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
      <div style={{ display: "flex", fontSize: 28, color: "#a1a1aa" }}>Trading Challenges</div>
    </div>
  );
}
