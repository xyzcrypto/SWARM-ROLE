import { ImageResponse } from "next/og";

// Share card for xyzcrypto.io/bungee (X, Telegram, WhatsApp). Static: no
// params and no data, so it prerenders once at build and is served from the
// CDN, like the site-wide card in app/opengraph-image.tsx.
export const alt = "Win 1 of 3x $10K Bungee Funded Perps accounts with XYZ Crypto";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: "#0a0a0a", color: "#fafafa", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: 30, fontWeight: 800 }}>
          <span style={{ color: "#ffc700" }}>BUNGEE FUNDED PERPS</span>
          <span style={{ color: "#ff3d8b" }}>x</span>
          <span style={{ color: "#e2a72f" }}>XYZ Crypto</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 800, letterSpacing: "-0.02em" }}>GIVEAWAY</div>
          <div style={{ display: "flex", fontSize: 128, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", color: "#ffc700" }}>3x $10K</div>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 800, letterSpacing: "-0.02em" }}>funded accounts</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 28, color: "#d4d4d8" }}>Learn · Play the live quiz · Enter at xyzcrypto.io/bungee</div>
          <div style={{ display: "flex", padding: "12px 22px", border: "3px solid #ffc700", color: "#ffc700", fontSize: 26, fontWeight: 800 }}>CODE XYZCRYPTO</div>
        </div>
      </div>
    ),
    // Never changes, and link-preview bots refetch on every share.
    { ...size, headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
  );
}
