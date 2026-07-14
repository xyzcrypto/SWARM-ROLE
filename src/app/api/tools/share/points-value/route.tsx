import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/seo";

// Public share card for a Points/Airdrop Value calculator result - a branded
// 1200x630 image with the real platform logo + our logo, not text wordmarks.
// No session gate (this is a "share to the world" action, not private data);
// every number comes straight from the query string - the client already
// computed them via airdropValue()/priceFromFdv(), so no DB read is needed.
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
  const logo = (searchParams.get("logo") || "").slice(0, 300);
  const fdv = num(searchParams.get("fdv"));
  const sharePct = num(searchParams.get("sharePct"));
  const tokens = num(searchParams.get("tokens"));
  const usd = num(searchParams.get("usd"));

  const fdvLabel =
    fdv >= 1_000_000_000 ? `$${(fdv / 1_000_000_000).toFixed(fdv >= 10_000_000_000 ? 0 : 1)}B FDV` : `$${(fdv / 1_000_000).toFixed(0)}M FDV`;

  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px",
            background: "linear-gradient(135deg, #08080a 0%, #0e0e12 55%, #15110a 100%)",
            color: "#fafafa",
            fontFamily: "sans-serif",
          }}
        >
          {/* header: our logo + platform badge (real images, not text wordmarks) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${SITE_URL}/logo.png`} width={40} height={40} style={{ borderRadius: "10px" }} alt="" />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: "#e2a72f", display: "flex" }}>XYZ Crypto</div>
                <div style={{ fontSize: 15, color: "#71717a", display: "flex" }}>Points / Airdrop Value Calculator</div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 18px",
                borderRadius: "999px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              {logo.startsWith("https://") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} width={22} height={22} style={{ borderRadius: "6px" }} alt="" />
              )}
              <div style={{ fontSize: 20, fontWeight: 700, color: "#fafafa", display: "flex" }}>{platform}</div>
            </div>
          </div>

          {/* hero number */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ fontSize: 22, color: "#a1a1aa", display: "flex" }}>Estimated points value</div>
            <div style={{ fontSize: 128, fontWeight: 800, letterSpacing: "-0.03em", color: "#e2a72f", display: "flex" }}>
              ${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "6px" }}>
              <div
                style={{
                  display: "flex",
                  padding: "8px 18px",
                  borderRadius: "999px",
                  border: "1px solid rgba(34,214,146,0.4)",
                  color: "#8fe8c9",
                  fontSize: 20,
                  fontWeight: 600,
                }}
              >
                {sharePct.toFixed(4)}% share
              </div>
              <div
                style={{
                  display: "flex",
                  padding: "8px 18px",
                  borderRadius: "999px",
                  border: "1px solid rgba(226,167,47,0.4)",
                  color: "#f3d488",
                  fontSize: 20,
                  fontWeight: 600,
                }}
              >
                {fdvLabel}
              </div>
              <div style={{ display: "flex", fontSize: 20, color: "#71717a" }}>
                {tokens.toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens (est.)
              </div>
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 22, color: "#71717a" }}>
            Estimate only, based on your assumptions - try it yourself at xyzcrypto
          </div>
        </div>
      ),
      { ...SIZE, ...CACHE }
    );
  } catch {
    return new ImageResponse(
      (
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
          <div style={{ display: "flex", fontSize: 28, color: "#a1a1aa" }}>Points / Airdrop Value Calculator</div>
        </div>
      ),
      { ...SIZE, ...CACHE }
    );
  }
}
