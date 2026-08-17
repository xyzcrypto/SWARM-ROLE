import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

// The default social share card for every route that does not generate its own
// (research posts do). Replaces `/logo.png`, which was **640x640** - a square
// image in a 1.91:1 slot, so X, LinkedIn and WhatsApp centre-cropped it on every
// share of every page. It was also a 655 KB PNG fetched by link-preview bots on
// each share; this renders at the right ratio and is cached hard.
//
// ⚠️ Deliberately does NOT set `runtime = "edge"`, and the reason is the exact
// opposite of the one that used to be written here.
//
// It said: "unlike the research card this needs no database, so it can be
// generated at the edge rather than waking a Node function." Needing no database
// is real — and it is precisely why this should be **static**, built once and
// then served from the CDN forever, rather than run per request anywhere. Edge
// was buying a cheaper way to do work that does not need doing at all.
//
// Two build warnings came from that one line:
//   ⚠ The Edge Runtime is deprecated. You can use the "nodejs" runtime instead.
//   ⚠ Using edge runtime on a page currently disables static generation
// The second is the one that cost something: it held this route at `ƒ` (Dynamic)
// in the route table. Without it the route prerenders to `○` (Static), which is
// the direction this project's cost baseline cares about most.
//
// The image markup below is untouched, so the rendered card is identical.
export const alt = `${site.name} - ${site.slogan}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: "#e2a72f" }}>
            XYZ
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#fafafa" }}>Crypto</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              maxWidth: "980px",
            }}
          >
            Everything you need to win in Web3.
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#a1a1aa", maxWidth: "900px" }}>
            On-chain research · perp DEX · trading tools · airdrop intelligence
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ display: "flex", width: "10px", height: "10px", borderRadius: "999px", background: "#22d692" }} />
          <div style={{ display: "flex", fontSize: 26, color: "#f3d488" }}>{site.slogan}</div>
        </div>
      </div>
    ),
    {
      ...size,
      // Link-preview bots (WhatsApp/Telegram/X/Discord) refetch this on every
      // share and it never changes, so cache it hard to keep origin transfer down.
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    }
  );
}
