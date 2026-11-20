import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Premium 1200x630 share cards for the Academy (certificate, quiz result,
// leaderboard rank). One renderer so all three look like one family.
// Served from routes OUTSIDE /api (robots.txt disallows /api/, and X's card
// crawler obeys it for images) - see og-image-crawlable.test.ts.

export const CARD_SIZE = { width: 1200, height: 630 };

// Fonts and logo live next to this module (src/modules/academy/assets) and
// are listed in next.config.mjs outputFileTracingIncludes, so the serverless
// function that renders a card always has them.
const ASSETS = join(process.cwd(), "src/modules/academy/assets");
let logoData: string | null = null;
function logo(): string | null {
  if (logoData) return logoData;
  try {
    logoData = `data:image/png;base64,${readFileSync(join(ASSETS, "logo-192.png")).toString("base64")}`;
  } catch {
    logoData = null;
  }
  return logoData;
}
type Font = { name: string; data: ArrayBuffer; weight: 400 | 700 | 900; style: "normal" };
let fonts: Font[] | null = null;
function loadFonts(): Font[] {
  if (fonts) return fonts;
  try {
    const f = (file: string, weight: 400 | 700 | 900): Font => {
      const b = readFileSync(join(ASSETS, file));
      return { name: "Geist", data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, weight, style: "normal" };
    };
    fonts = [f("Geist-Regular.ttf", 400), f("Geist-Bold.ttf", 700), f("Geist-Black.ttf", 900)];
  } catch {
    fonts = [];
  }
  return fonts;
}

export type CardStat = { label: string; value: string };
export type CardInput = {
  eyebrow: string; // "VERIFIED CERTIFICATE"
  title: string; // big gold line
  name: string; // who
  subtitle?: string;
  stats: CardStat[]; // up to 3
  badge?: string; // "#1", "9/10"
  footer?: string; // "xyzcrypto.io/academy"
  tone?: "gold" | "mint";
};

const GOLD = "#e2a72f";
const GOLD_SOFT = "#f3d488";
const MINT = "#34e3a1";

export function shareCard(c: CardInput, cache: string) {
  const accent = c.tone === "mint" ? MINT : GOLD;
  const lg = logo();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "radial-gradient(120% 90% at 20% 0%, #1b160c 0%, #0a0907 50%, #050505 100%)",
          color: "#f6f1e6",
          fontFamily: "Geist, sans-serif",
        }}
      >
        {/* foil glow + frame */}
        <div style={{ position: "absolute", top: -200, right: -120, width: 620, height: 620, borderRadius: 620, background: `radial-gradient(circle, ${accent}33 0%, transparent 65%)`, display: "flex" }} />
        <div style={{ position: "absolute", left: 22, top: 22, right: 22, bottom: 22, borderRadius: 28, border: `2px solid ${GOLD}aa`, display: "flex" }} />
        <div style={{ position: "absolute", left: 34, top: 34, right: 34, bottom: 34, borderRadius: 20, border: `1px solid ${GOLD}44`, display: "flex" }} />

        <div style={{ display: "flex", flexDirection: "column", padding: "64px 76px", width: "100%", height: "100%" }}>
          {/* header */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {lg ? <img src={lg} width={56} height={56} style={{ borderRadius: 14 }} alt="" /> : null}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: GOLD_SOFT }}>XYZ CRYPTO ACADEMY</div>
              <div style={{ fontSize: 17, letterSpacing: 4, color: "#a8a093", marginTop: 2 }}>{c.eyebrow}</div>
            </div>
            {c.badge ? (
              <div
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 96,
                  minWidth: 96,
                  padding: "0 22px",
                  borderRadius: 96,
                  background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD} 55%, #b07816)`,
                  color: "#0b0b0f",
                  fontSize: c.badge.length > 4 ? 34 : 44,
                  fontWeight: 900,
                  boxShadow: `0 10px 40px ${GOLD}55`,
                }}
              >
                {c.badge}
              </div>
            ) : null}
          </div>

          {/* body */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
            <div style={{ fontSize: 30, color: "#cfc7b6" }}>{c.name}</div>
            <div
              style={{
                fontSize: c.title.length > 26 ? 60 : 76,
                fontWeight: 900,
                lineHeight: 1.04,
                marginTop: 10,
                letterSpacing: -1.5,
                backgroundImage: `linear-gradient(100deg, #b07816, ${GOLD_SOFT} 30%, #fff3c4 45%, ${GOLD} 65%, #b07816)`,
                backgroundClip: "text",
                color: "transparent",
                maxWidth: 1000,
              }}
            >
              {c.title}
            </div>
            {c.subtitle ? <div style={{ fontSize: 26, color: "#a8a093", marginTop: 14 }}>{c.subtitle}</div> : null}
          </div>

          {/* stats */}
          <div style={{ display: "flex", gap: 18, marginTop: "auto" }}>
            {c.stats.slice(0, 3).map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  padding: "18px 24px",
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(226,167,47,0.28)",
                }}
              >
                <div style={{ fontSize: 16, letterSpacing: 3, color: "#a8a093" }}>{s.label.toUpperCase()}</div>
                <div style={{ fontSize: s.value.length > 14 ? 26 : s.value.length > 10 ? 31 : 38, fontWeight: 700, color: s.label.toLowerCase().includes("xp") ? MINT : "#f6f1e6", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, fontSize: 20, color: "#8d8577" }}>
            <span>{c.footer ?? "xyzcrypto.io/academy"}</span>
            <span style={{ color: GOLD_SOFT }}>Learn · Compete · Earn XP</span>
          </div>
        </div>
      </div>
    ),
    { ...CARD_SIZE, fonts: loadFonts(), headers: { "Cache-Control": cache } }
  );
}
