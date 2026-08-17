import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { favicon } from "@/lib/news-sources";
import { SITE_URL } from "@/lib/seo";

// Only accept a bare hostname here, never a full attacker-suppliable URL - the
// actual logo <img> src is always built from our own trusted favicon()
// template below, so a crafted share record can never make this route fetch/
// render an arbitrary attacker-controlled image.
const SAFE_DOMAIN = /^[a-z0-9]([a-z0-9-]{0,62}\.)+[a-z]{2,}$/i;

// ⚠️ This lives at `/tools/share/points-value/<id>/card`, NOT under `/api/`,
// and moving it there is what makes the X preview work at all. `robots.ts`
// disallows `/api/`, and X's card crawler obeys robots.txt for the IMAGE, not
// just the page - so while it sat under `/api/` every points share on X went
// out with no banner, for every listed perp DEX. The metadata was correct the
// whole time; the crawler simply refused to fetch what it pointed at.
// `og-image-crawlable.test.ts` pins this.
//
// Public share card for a Points/Airdrop Value calculator result - a branded
// 1200x630 image with the real platform logo + our logo, not text wordmarks.
// No session gate (this is a "share to the world" action, not private data).
// Reads its numbers from a short-lived SharedCard row (see
// /api/tools/share/create) instead of a long query string, so the link stays
// short; falls back to a generic branded card for a missing/expired id.
export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 };
// Bot/preview fetches repeat on every share; the numbers are a point-in-time
// snapshot, not live data, so cache generously.
//
// `max-age` + `immutable` matter as much as `s-maxage` here, and were missing.
// This PNG is rendered with satori on every cache miss, and the share page
// embeds it with a plain <img> - so with an edge-only header the browser
// re-requested it on every view of the card. A card is keyed by an id whose
// contents can never change, which is the textbook case for `immutable`: the
// browser stops asking entirely. That is the difference between the card
// appearing instantly on a revisit and waiting on a PNG render.
const CACHE = {
  headers: {
    "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400",
  },
};
// The generic fallback must NOT inherit `immutable`. It is served for a missing
// id *and* for a transient DB failure - caching "sorry, no card" for a year
// would turn a two-second blip into a permanently broken share link. Short and
// revalidatable on purpose.
const FALLBACK_CACHE = { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } };

type CardData = { platform?: string; domain?: string; sharePct?: number; tokens?: number; usd?: number; fdv?: number };

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function fallbackCard() {
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
    { ...SIZE, ...FALLBACK_CACHE }
  );
}

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const row = await prisma.sharedCard
      .findUnique({ where: { id: params.id }, select: { kind: true, data: true } })
      .catch(() => null);
    if (!row || row.kind !== "points-value") return fallbackCard();

    const d = (row.data ?? {}) as CardData;
    const platform = (d.platform || "Perp DEX").slice(0, 40);
    const domain = (d.domain || "").slice(0, 253);
    const logo = SAFE_DOMAIN.test(domain) ? favicon(domain) : null;
    const fdv = num(d.fdv);
    const sharePct = num(d.sharePct);
    const tokens = num(d.tokens);
    const usd = num(d.usd);

    const fdvLabel =
      fdv >= 1_000_000_000 ? `$${(fdv / 1_000_000_000).toFixed(fdv >= 10_000_000_000 ? 0 : 1)}B FDV` : `$${(fdv / 1_000_000).toFixed(0)}M FDV`;

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
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                (<img src={logo} width={22} height={22} style={{ borderRadius: "6px" }} alt="" />)
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
    return fallbackCard();
  }
}
