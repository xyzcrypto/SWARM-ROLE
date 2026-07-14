import { ImageResponse } from "next/og";

// Public share card for a Points/Airdrop Value calculator result - a branded
// 1200x630 image built entirely from query params (the client already
// computed these via airdropValue(), so no DB read is needed). No session
// gate by design, same as the challenge share card: generating/sharing this
// link is itself the "publish" action, and link-preview bots (Discord/
// Twitter/Telegram) fetch OG images without cookies.
export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 };
// Bot/preview fetches repeat on every share; the numbers are a point-in-time
// snapshot, not live data, so cache generously.
const CACHE = { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } };

function num(value: string | null, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = (searchParams.get("platform") || "Perp DEX").slice(0, 40);
  const sharePct = num(searchParams.get("sharePct"));
  const tokens = num(searchParams.get("tokens"));
  const usd = num(searchParams.get("usd"));
  const fdv = num(searchParams.get("fdv"));

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
            Points Value
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: 30, color: "#a1a1aa", display: "flex" }}>{platform} points, estimated at</div>
          <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: "-0.03em", color: "#22d692", display: "flex" }}>
            ${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#a1a1aa" }}>
            {sharePct.toFixed(4)}% share · {tokens.toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens · $
            {(fdv / 1_000_000_000).toFixed(1)}B FDV scenario
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 24, color: "#71717a" }}>
          Assumption-based estimate, not official data · xyzcrypto.com/tools
        </div>
      </div>
    ),
    { ...SIZE, ...CACHE }
  );
}
