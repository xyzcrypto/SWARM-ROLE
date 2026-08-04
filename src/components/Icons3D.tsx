import { useId } from "react";

// Hand-built 3D icons in the RobotIcon spirit: a gradient body + gloss highlight
// + soft drop shadow for real depth, plus one always-on "signature" motion each
// (keyframes i3d-* in globals.css). Unique gradient/filter ids per instance so
// several on a page never clash. Pass a className to size (they fill it).

type IconProps = { className?: string };
type Palette = { a: string; b: string; c: string; shadow: string; ring: string };

// Curated dark-luxe palette — each icon gets a hue that fits its meaning so the
// set reads as a colourful system, not a wall of gold.
const GOLD: Palette = { a: "#ffe7a8", b: "#e2a72f", c: "#9a6810", shadow: "#6b4a0e", ring: "#f4d488" };
const AMBER: Palette = { a: "#ffd7a0", b: "#f5952a", c: "#b45309", shadow: "#7c3d08", ring: "#ffc27a" };
const EMERALD: Palette = { a: "#8ef6cf", b: "#22d692", c: "#037a54", shadow: "#025c3f", ring: "#7ef2c6" };
const SKY: Palette = { a: "#bfe6ff", b: "#38bdf8", c: "#0369a1", shadow: "#075985", ring: "#7dd3fc" };
const INDIGO: Palette = { a: "#c7d2fe", b: "#6366f1", c: "#3730a3", shadow: "#312e81", ring: "#a5b4fc" };
const VIOLET: Palette = { a: "#ecd5ff", b: "#a855f7", c: "#6b21a8", shadow: "#581c87", ring: "#d8b4fe" };
const ROSE: Palette = { a: "#ffd0d9", b: "#fb5c74", c: "#be123c", shadow: "#881337", ring: "#fda4af" };

function useIds(n: number) {
  const raw = useId().replace(/[:]/g, "");
  return Array.from({ length: n }, (_, i) => `${raw}${i}`);
}

// Shared gradient + gloss + drop-shadow defs for an icon.
function Defs({ face, gloss, glow, c }: { face: string; gloss: string; glow: string; c: Palette }) {
  return (
    <defs>
      <linearGradient id={face} x1="9" y1="7" x2="34" y2="41" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor={c.a} /><stop offset="0.5" stopColor={c.b} /><stop offset="1" stopColor={c.c} />
      </linearGradient>
      <radialGradient id={gloss} cx="0.4" cy="0.26" r="0.72">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" /><stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <filter id={glow} x="-30%" y="-30%" width="175%" height="180%">
        <feDropShadow dx="0" dy="1.6" stdDeviation="1.5" floodColor={c.shadow} floodOpacity="0.5" />
      </filter>
    </defs>
  );
}

const svgProps = { viewBox: "0 0 48 48", fill: "none", "aria-hidden": true } as const;

// ---- Research: magnifier, gold, scanning light ----------------------------
export function ResearchIcon({ className }: IconProps) {
  const [face, gloss, glow, clip] = useIds(4);
  const c = GOLD;
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <clipPath id={clip}><circle cx="20" cy="20" r="8" /></clipPath>
      <line x1="27.5" y1="27.5" x2="39" y2="39" stroke={`url(#${face})`} strokeWidth="7" strokeLinecap="round" filter={`url(#${glow})`} />
      <circle cx="20" cy="20" r="11.6" fill={`url(#${face})`} filter={`url(#${glow})`} />
      <circle cx="20" cy="20" r="8" fill="#07130f" /><circle cx="20" cy="20" r="8" fill={c.b} fillOpacity="0.16" />
      <g clipPath={`url(#${clip})`}><rect className="i3d-scan" x="16" y="9" width="4.6" height="22" rx="2.3" fill="#fff" fillOpacity="0.6" transform="rotate(18 20 20)" /></g>
      <circle cx="20" cy="20" r="11.6" fill={`url(#${gloss})`} />
      <circle cx="20" cy="20" r="11.6" stroke={c.ring} strokeOpacity="0.55" /><circle cx="20" cy="20" r="8" stroke="#000" strokeOpacity="0.28" />
    </svg>
  );
}

// ---- Research Lab: report card + magnifier + found-insight star -----------
// The hero's headline icon. A lone magnifier is just a search glyph; this is
// the whole act - a report with live bars, a lens held over it, and a star for
// the thing the lens found. Two palettes on purpose: emerald for the data
// (it is the market), gold for the instrument (it is the brand). Three
// independent signature motions, so it reads as working rather than decorated.
export function ResearchLabIcon({ className }: IconProps) {
  const [cFace, cGloss, cGlow, gFace, gGloss, gGlow, clip, sFace, sGloss, sGlow] = useIds(10);
  const card = EMERALD;
  const lens = GOLD;
  const star = AMBER;
  return (
    <svg {...svgProps} className={className}>
      <Defs face={cFace} gloss={cGloss} glow={cGlow} c={card} />
      <Defs face={gFace} gloss={gGloss} glow={gGlow} c={lens} />
      <Defs face={sFace} gloss={sGloss} glow={sGlow} c={star} />

      {/* the report, tilted so the lens has somewhere to sit */}
      <g transform="rotate(-7 20 23)" filter={`url(#${cGlow})`}>
        <rect x="4" y="9" width="31" height="28" rx="4.5" fill={`url(#${cFace})`} />
        <rect x="9" y="14" width="13" height="2.6" rx="1.3" fill="#04211a" fillOpacity="0.5" />
        <rect className="i3d-tick" x="9" y="24" width="4.2" height="8" rx="1.6" fill="#04211a" fillOpacity="0.55" />
        <rect className="i3d-tick" x="16" y="19" width="4.2" height="13" rx="1.6" fill="#04211a" fillOpacity="0.55" style={{ animationDelay: "0.35s" }} />
        <rect className="i3d-tick" x="23" y="22" width="4.2" height="10" rx="1.6" fill="#04211a" fillOpacity="0.55" style={{ animationDelay: "0.7s" }} />
        <rect x="4" y="9" width="31" height="28" rx="4.5" fill={`url(#${cGloss})`} />
        <rect x="4" y="9" width="31" height="28" rx="4.5" stroke={card.ring} strokeOpacity="0.5" />
      </g>

      {/* the instrument, overlapping the card's corner so there is real depth */}
      <clipPath id={clip}><circle cx="31.5" cy="30.5" r="7.4" /></clipPath>
      <line x1="37" y1="36" x2="43.5" y2="42.5" stroke={`url(#${gFace})`} strokeWidth="6" strokeLinecap="round" filter={`url(#${gGlow})`} />
      <circle cx="31.5" cy="30.5" r="10.4" fill={`url(#${gFace})`} filter={`url(#${gGlow})`} />
      <circle cx="31.5" cy="30.5" r="7.4" fill="#07130f" />
      <circle cx="31.5" cy="30.5" r="7.4" fill={card.b} fillOpacity="0.2" />
      <g clipPath={`url(#${clip})`}>
        <rect className="i3d-scan" x="27" y="20" width="4.2" height="21" rx="2.1" fill="#fff" fillOpacity="0.55" transform="rotate(18 31.5 30.5)" />
      </g>
      <circle cx="31.5" cy="30.5" r="10.4" fill={`url(#${gGloss})`} />
      <circle cx="31.5" cy="30.5" r="10.4" stroke={lens.ring} strokeOpacity="0.55" />
      <circle cx="31.5" cy="30.5" r="7.4" stroke="#000" strokeOpacity="0.3" />

      {/* what it found */}
      <g className="i3d-twinkle" filter={`url(#${sGlow})`}>
        <path d="M39.5 5.5 l1.9 4 4.1 0.6 -3 2.9 0.7 4.1 -3.7 -1.9 -3.7 1.9 0.7 -4.1 -3 -2.9 4.1 -0.6 Z" fill={`url(#${sFace})`} />
        <path d="M39.5 5.5 l1.9 4 4.1 0.6 -3 2.9 0.7 4.1 -3.7 -1.9 -3.7 1.9 0.7 -4.1 -3 -2.9 4.1 -0.6 Z" fill={`url(#${sGloss})`} />
      </g>
    </svg>
  );
}

// ---- Tooling: gear, sky, spins --------------------------------------------
export function ToolingIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = SKY;
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <g className="i3d-spin" filter={`url(#${glow})`}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <rect key={a} x="21.6" y="3.6" width="4.8" height="8.4" rx="1.8" fill={`url(#${face})`} transform={`rotate(${a} 24 24)`} />
        ))}
        <circle cx="24" cy="24" r="12.4" fill={`url(#${face})`} /><circle cx="24" cy="24" r="12.4" fill={`url(#${gloss})`} />
        <circle cx="24" cy="24" r="4.6" fill="#06121b" /><circle cx="24" cy="24" r="4.6" stroke={c.ring} strokeOpacity="0.5" />
      </g>
    </svg>
  );
}

// ---- Community: two figures, violet, front one bobs -----------------------
export function CommunityIcon({ className }: IconProps) {
  const [face, faceB, gloss, glow] = useIds(4);
  const c = VIOLET;
  return (
    <svg {...svgProps} className={className}>
      <defs>
        <linearGradient id={face} x1="7" y1="9" x2="30" y2="39" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={c.a} /><stop offset="0.55" stopColor={c.b} /><stop offset="1" stopColor={c.c} /></linearGradient>
        <linearGradient id={faceB} x1="24" y1="12" x2="42" y2="36" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={c.b} /><stop offset="1" stopColor={c.c} /></linearGradient>
        <radialGradient id={gloss} cx="0.4" cy="0.3" r="0.7"><stop offset="0" stopColor="#fff" stopOpacity="0.7" /><stop offset="0.6" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <filter id={glow} x="-30%" y="-30%" width="170%" height="170%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.4" floodColor={c.shadow} floodOpacity="0.5" /></filter>
      </defs>
      <g fill={`url(#${faceB})`} opacity="0.92"><circle cx="33" cy="17" r="4.4" /><path d="M25 34c0-4.7 3.7-8.2 8-8.2s8 3.5 8 8.2z" /></g>
      <g className="i3d-bob" filter={`url(#${glow})`}>
        <circle cx="18" cy="16.5" r="5.6" fill={`url(#${face})`} /><circle cx="18" cy="16.5" r="5.6" fill={`url(#${gloss})`} />
        <path d="M7.5 35c0-5.8 4.7-10.2 10.5-10.2S28.5 29.2 28.5 35z" fill={`url(#${face})`} />
        <path d="M7.5 35c0-5.8 4.7-10.2 10.5-10.2S28.5 29.2 28.5 35z" fill={`url(#${gloss})`} opacity="0.6" />
      </g>
    </svg>
  );
}

// ---- Security: shield + check, emerald, sweeping light + pulsing check -----
export function SecurityIcon({ className }: IconProps) {
  const [face, gloss, glow, clip] = useIds(4);
  const c = EMERALD;
  const shield = "M24 5 L40 11 V23.5 C40 32.5 33 38.6 24 42 C15 38.6 8 32.5 8 23.5 V11 Z";
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <clipPath id={clip}><path d={shield} /></clipPath>
      <path d={shield} fill={`url(#${face})`} filter={`url(#${glow})`} />
      <g clipPath={`url(#${clip})`}><rect className="i3d-scan" x="4" y="2" width="9" height="46" rx="4" fill="#fff" fillOpacity="0.4" transform="rotate(12 24 24)" /></g>
      <path d={shield} fill={`url(#${gloss})`} /><path d={shield} stroke={c.ring} strokeOpacity="0.5" />
      <path className="i3d-pulse" d="M17 24 l4.8 4.8 L31 18" stroke="#06231a" strokeOpacity="0.85" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 24 l4.8 4.8 L31 18" stroke="#eafff6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---- Markets: 3 bars, sky, ticking ----------------------------------------
export function MarketsIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = SKY;
  const bars = [{ x: 8, y: 26, h: 14, d: 0 }, { x: 19, y: 15, h: 25, d: 0.4 }, { x: 30, y: 21, h: 19, d: 0.8 }];
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      {bars.map((b) => (
        <g key={b.x} className="i3d-tick" style={{ animationDelay: `${b.d}s`, transformOrigin: "center bottom" }}>
          <rect x={b.x} y={b.y} width="10" height={b.h} rx="3.2" fill={`url(#${face})`} filter={`url(#${glow})`} />
          <rect x={b.x} y={b.y} width="10" height={b.h * 0.5} rx="3.2" fill={`url(#${gloss})`} />
        </g>
      ))}
    </svg>
  );
}

// ---- TrendUp: bold up arrow, emerald ---------------------------------------
export function TrendUpIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = EMERALD;
  const arrow = "M24 8 L39 25 H31 V39 H17 V25 H9 Z";
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <g className="i3d-float">
        <path d={arrow} fill={`url(#${face})`} filter={`url(#${glow})`} /><path d={arrow} fill={`url(#${gloss})`} /><path d={arrow} stroke={c.ring} strokeOpacity="0.5" />
      </g>
    </svg>
  );
}

// ---- TrendDown: bold down arrow, rose --------------------------------------
export function TrendDownIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = ROSE;
  const arrow = "M24 40 L9 23 H17 V9 H31 V23 H39 Z";
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <g className="i3d-float">
        <path d={arrow} fill={`url(#${face})`} filter={`url(#${glow})`} /><path d={arrow} fill={`url(#${gloss})`} /><path d={arrow} stroke={c.ring} strokeOpacity="0.5" />
      </g>
    </svg>
  );
}

// ---- Layers (DeFi): stacked isometric plates, indigo -----------------------
export function LayersIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = INDIGO;
  const dia = (y: number) => `M24 ${y} L39 ${y + 7} L24 ${y + 14} L9 ${y + 7} Z`;
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <g className="i3d-float">
        <path d={dia(24)} fill={`url(#${face})`} opacity="0.65" />
        <path d={dia(16)} fill={`url(#${face})`} opacity="0.82" />
        <path d={dia(8)} fill={`url(#${face})`} filter={`url(#${glow})`} /><path d={dia(8)} fill={`url(#${gloss})`} /><path d={dia(8)} stroke={c.ring} strokeOpacity="0.45" />
      </g>
    </svg>
  );
}

// ---- Activity: ECG pulse line + dot, emerald -------------------------------
export function ActivityIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = EMERALD;
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <rect x="6" y="12" width="36" height="24" rx="8" fill={`url(#${face})`} filter={`url(#${glow})`} />
      <rect x="6" y="12" width="36" height="12" rx="8" fill={`url(#${gloss})`} />
      <path d="M11 24 H17 L20 17 L25 31 L28 24 H37" stroke="#04241a" strokeOpacity="0.9" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 24 H17 L20 17 L25 31 L28 24 H37" stroke="#eafff6" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="i3d-pulse" cx="20" cy="17" r="2.4" fill="#eafff6" />
    </svg>
  );
}

// ---- Flame (trending): amber, flickers -------------------------------------
export function FlameIcon({ className }: IconProps) {
  const [face, faceB, gloss, glow] = useIds(4);
  const c = AMBER;
  return (
    <svg {...svgProps} className={className}>
      <defs>
        <linearGradient id={face} x1="14" y1="6" x2="30" y2="42" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffd7a0" /><stop offset="0.5" stopColor="#f5952a" /><stop offset="1" stopColor="#c2410c" /></linearGradient>
        <linearGradient id={faceB} x1="18" y1="20" x2="26" y2="40" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fff1c9" /><stop offset="1" stopColor="#fdba74" /></linearGradient>
        <radialGradient id={gloss} cx="0.42" cy="0.3" r="0.7"><stop offset="0" stopColor="#fff" stopOpacity="0.6" /><stop offset="0.6" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <filter id={glow} x="-30%" y="-30%" width="170%" height="170%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor={c.shadow} floodOpacity="0.55" /></filter>
      </defs>
      <g className="i3d-flick">
        <path d="M24 5 C29 13 34 17 34 26 A10 10 0 0 1 14 26 C14 21 17 19 19 15 C20 19 22 20 23 19 C24 17 23 12 24 5 Z" fill={`url(#${face})`} filter={`url(#${glow})`} />
        <path d="M24 21 C26.5 24 28 26 28 29.5 A4 4 0 0 1 20 29.5 C20 26.5 22 25 24 21 Z" fill={`url(#${faceB})`} />
        <path d="M24 5 C29 13 34 17 34 26 A10 10 0 0 1 14 26 C14 21 17 19 19 15 C20 19 22 20 23 19 C24 17 23 12 24 5 Z" fill={`url(#${gloss})`} />
      </g>
    </svg>
  );
}

// ---- Gift (airdrop): rose box, floats --------------------------------------
export function GiftIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = ROSE;
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <g className="i3d-float">
        <rect x="9" y="21" width="30" height="18" rx="3.5" fill={`url(#${face})`} filter={`url(#${glow})`} />
        <rect x="7" y="15" width="34" height="8" rx="3" fill={`url(#${face})`} filter={`url(#${glow})`} />
        <rect x="7" y="15" width="34" height="4.5" rx="3" fill={`url(#${gloss})`} />
        <rect x="21" y="15" width="6" height="24" fill={c.ring} fillOpacity="0.85" />
        <path d="M24 15 C21 9 13 9 15 15 M24 15 C27 9 35 9 33 15" stroke={c.ring} strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

// ---- Crown (premium): gold, floats -----------------------------------------
export function CrownIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = GOLD;
  const crown = "M7 34 L10 16 L18 25 L24 11 L30 25 L38 16 L41 34 Z";
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <g className="i3d-float">
        <path d={crown} fill={`url(#${face})`} filter={`url(#${glow})`} /><path d={crown} fill={`url(#${gloss})`} />
        <rect x="9" y="33" width="30" height="6.5" rx="2.4" fill={`url(#${face})`} />
        <circle cx="24" cy="11" r="2.4" fill={c.ring} /><circle cx="10" cy="16" r="2" fill={c.ring} /><circle cx="38" cy="16" r="2" fill={c.ring} />
      </g>
    </svg>
  );
}

// ---- Academy (learn): violet mortarboard, bobs -----------------------------
export function AcademyIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = VIOLET;
  const board = "M24 10 L43 18 L24 26 L5 18 Z";
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <path d="M13 21 V30 C13 33 18.5 35 24 35 S35 33 35 30 V21" fill={`url(#${face})`} opacity="0.9" />
      <g className="i3d-bob">
        <path d={board} fill={`url(#${face})`} filter={`url(#${glow})`} /><path d={board} fill={`url(#${gloss})`} /><path d={board} stroke={c.ring} strokeOpacity="0.4" />
      </g>
      <path d="M43 18 V29" stroke={c.ring} strokeWidth="1.6" strokeLinecap="round" /><circle cx="43" cy="31" r="2.4" fill={c.ring} />
    </svg>
  );
}

// ---- Gauge (trading): sky dial + sweeping needle ---------------------------
export function GaugeIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = SKY;
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <path d="M8 32 A16 16 0 0 1 40 32 Z" fill={`url(#${face})`} filter={`url(#${glow})`} />
      <path d="M8 32 A16 16 0 0 1 40 32 Z" fill={`url(#${gloss})`} />
      <path d="M13 32 A11 11 0 0 1 35 32 Z" fill="#06121b" fillOpacity="0.55" />
      <g className="i3d-sweep" style={{ transformBox: "view-box", transformOrigin: "24px 32px" }}>
        <path d="M24 32 L22 14 L26 14 Z" fill="#eaf6ff" />
      </g>
      <circle cx="24" cy="32" r="3" fill={c.ring} /><circle cx="24" cy="32" r="3" stroke="#06121b" strokeOpacity="0.4" />
    </svg>
  );
}

// ---- Lock (premium): gold padlock, floats ----------------------------------
export function LockIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = GOLD;
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <g className="i3d-float">
        <path d="M15 22 V17 A9 9 0 0 1 33 17 V22" stroke={`url(#${face})`} strokeWidth="5" fill="none" strokeLinecap="round" />
        <rect x="10" y="21" width="28" height="20" rx="5" fill={`url(#${face})`} filter={`url(#${glow})`} />
        <rect x="10" y="21" width="28" height="9" rx="5" fill={`url(#${gloss})`} />
        <circle cx="24" cy="29" r="3.4" fill="#3a2606" /><rect x="22.6" y="30" width="2.8" height="6" rx="1.4" fill="#3a2606" />
      </g>
    </svg>
  );
}

// ---- Newspaper (news): sky, shine scan -------------------------------------
export function NewspaperIcon({ className }: IconProps) {
  const [face, gloss, glow, clip] = useIds(4);
  const c = SKY;
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <clipPath id={clip}><rect x="8" y="10" width="32" height="28" rx="4" /></clipPath>
      <rect x="8" y="10" width="32" height="28" rx="4" fill={`url(#${face})`} filter={`url(#${glow})`} />
      <rect x="13" y="15" width="14" height="10" rx="2" fill="#06121b" fillOpacity="0.5" />
      <g fill="#06121b" fillOpacity="0.42">
        <rect x="30" y="15" width="6" height="2.4" rx="1.2" /><rect x="30" y="20" width="6" height="2.4" rx="1.2" />
        <rect x="13" y="28" width="23" height="2.4" rx="1.2" /><rect x="13" y="33" width="23" height="2.4" rx="1.2" />
      </g>
      <g clipPath={`url(#${clip})`}><rect className="i3d-scan" x="4" y="6" width="8" height="36" rx="4" fill="#fff" fillOpacity="0.4" transform="rotate(14 24 24)" /></g>
      <rect x="8" y="10" width="32" height="13" rx="4" fill={`url(#${gloss})`} />
    </svg>
  );
}

// ---- Calendar (since / active): gold, floats -------------------------------
export function CalendarIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = GOLD;
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <rect x="9" y="12" width="30" height="28" rx="5" fill={`url(#${face})`} filter={`url(#${glow})`} />
      <rect x="9" y="12" width="30" height="10" rx="5" fill="#3a2606" fillOpacity="0.55" />
      <rect x="15" y="8" width="3.4" height="9" rx="1.7" fill={c.ring} /><rect x="29.6" y="8" width="3.4" height="9" rx="1.7" fill={c.ring} />
      <g className="i3d-pulse" fill="#3a2606"><circle cx="17" cy="29" r="2.1" /><circle cx="24" cy="29" r="2.1" /><circle cx="31" cy="29" r="2.1" /><circle cx="17" cy="35" r="2.1" /><circle cx="24" cy="35" r="2.1" /></g>
      <rect x="9" y="22" width="30" height="9" rx="0" fill={`url(#${gloss})`} opacity="0.5" />
    </svg>
  );
}

// ---- Star (for you / featured): amber, twinkles ----------------------------
export function StarIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = AMBER;
  const star = "M24 6 L28.4 18.4 L41.5 18.8 L31 26.8 L34.7 39.4 L24 31.8 L13.3 39.4 L17 26.8 L6.5 18.8 L19.6 18.4 Z";
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <g className="i3d-twinkle">
        <path d={star} fill={`url(#${face})`} filter={`url(#${glow})`} /><path d={star} fill={`url(#${gloss})`} /><path d={star} stroke={c.ring} strokeOpacity="0.5" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// ---- Mail (messages / contact): sky envelope, floats -----------------------
export function MailIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = SKY;
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <g className="i3d-float">
        <rect x="7" y="12" width="34" height="24" rx="5" fill={`url(#${face})`} filter={`url(#${glow})`} />
        <path d="M9 16 L24 27 L39 16" stroke="#06121b" strokeOpacity="0.55" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 16 L24 27 L39 16" stroke="#eaf6ff" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="7" y="12" width="34" height="11" rx="5" fill={`url(#${gloss})`} />
      </g>
    </svg>
  );
}

// ---- Clock (response time): emerald face + spinning hand -------------------
export function ClockIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = EMERALD;
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <circle cx="24" cy="24" r="16" fill={`url(#${face})`} filter={`url(#${glow})`} />
      <circle cx="24" cy="24" r="16" fill={`url(#${gloss})`} />
      <circle cx="24" cy="24" r="12" fill="#04241a" fillOpacity="0.5" />
      <path d="M24 24 L24 15" stroke="#eafff6" strokeWidth="2.4" strokeLinecap="round" />
      <g className="i3d-spin" style={{ transformBox: "view-box", transformOrigin: "24px 24px" }}>
        <path d="M24 24 L31 27" stroke={c.ring} strokeWidth="2" strokeLinecap="round" />
      </g>
      <circle cx="24" cy="24" r="2.2" fill="#eafff6" />
    </svg>
  );
}

// ---- Coin (Web3 Market): gold token with a Web3 hexagon + a light sweep ------
export function CoinIcon({ className }: IconProps) {
  const [face, gloss, glow, clip] = useIds(4);
  const c = GOLD;
  const hex = "M24 13.5 L32.2 18.3 V27.7 L24 32.5 L15.8 27.7 V18.3 Z";
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <clipPath id={clip}><circle cx="24" cy="24" r="17" /></clipPath>
      <circle cx="24" cy="24" r="17" fill={`url(#${face})`} filter={`url(#${glow})`} />
      <circle cx="24" cy="24" r="13.4" fill="none" stroke={c.c} strokeOpacity="0.35" strokeWidth="1.2" />
      {/* Web3 token hexagon */}
      <path className="i3d-pulse" d={hex} fill="#3a2708" fillOpacity="0.85" style={{ transformBox: "view-box", transformOrigin: "24px 24px" }} />
      <path d={hex} fill="none" stroke={c.a} strokeOpacity="0.75" strokeWidth="1.2" strokeLinejoin="round" />
      {/* light sweep across the coin */}
      <g clipPath={`url(#${clip})`}><rect className="i3d-scan" x="13" y="3" width="8" height="42" rx="4" fill="#fff" fillOpacity="0.45" transform="rotate(16 24 24)" /></g>
      <circle cx="24" cy="24" r="17" fill={`url(#${gloss})`} />
      <circle cx="24" cy="24" r="17" stroke={c.ring} strokeOpacity="0.55" />
    </svg>
  );
}

// ---- Candles (Web3 Market): green/red candlesticks, rising, tick up ---------
export function CandlesIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = EMERALD;
  const candles = [
    { x: 8, by: 26, bh: 10, wt: 22, wb: 40, d: 0 },
    { x: 18, by: 20, bh: 13, wt: 15, wb: 36, d: 0.22, red: true },
    { x: 28, by: 15, bh: 15, wt: 11, wb: 33, d: 0.44 },
    { x: 37, by: 11, bh: 11, wt: 7, wb: 27, d: 0.66 },
  ];
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      {candles.map((k) => (
        <g
          key={k.x}
          className="i3d-tick"
          style={{ animationDelay: `${k.d}s`, transformBox: "view-box", transformOrigin: `${k.x + 3.5}px ${k.wb}px` }}
          filter={`url(#${glow})`}
        >
          <line x1={k.x + 3.5} y1={k.wt} x2={k.x + 3.5} y2={k.wb} stroke={k.red ? "#fb5c74" : c.b} strokeWidth="1.6" strokeLinecap="round" />
          <rect x={k.x} y={k.by} width="7" height={k.bh} rx="1.8" fill={k.red ? "#fb5c74" : `url(#${face})`} />
          <rect x={k.x} y={k.by} width="7" height={k.bh * 0.5} rx="1.8" fill={`url(#${gloss})`} />
        </g>
      ))}
    </svg>
  );
}

// ---- Gamepad (Gamified): violet controller, bobs; action buttons flicker -----
export function GamepadIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = VIOLET;
  const body =
    "M16 17 h16 a11 11 0 0 1 10.6 8 l1.9 8.3 a4.7 4.7 0 0 1 -8.6 3.4 l-3.1 -5 a3 3 0 0 0 -2.5 -1.4 h-8.6 a3 3 0 0 0 -2.5 1.4 l-3.1 5 a4.7 4.7 0 0 1 -8.6 -3.4 l1.9 -8.3 a11 11 0 0 1 10.6 -8 Z";
  return (
    <svg {...svgProps} className={className}>
      <Defs face={face} gloss={gloss} glow={glow} c={c} />
      <g className="i3d-bob">
        <path d={body} fill={`url(#${face})`} filter={`url(#${glow})`} />
        {/* d-pad */}
        <path d="M14.5 25 h5 M17 22.5 v5" stroke="#2a1247" strokeOpacity="0.9" strokeWidth="2.6" strokeLinecap="round" />
        {/* action buttons */}
        <circle className="i3d-flick" cx="31.5" cy="22.6" r="1.9" fill="#fbe8ff" />
        <circle className="i3d-flick" cx="35" cy="26.2" r="1.9" fill="#fbe8ff" style={{ animationDelay: "0.45s" }} />
        <path d={body} fill={`url(#${gloss})`} />
        <path d={body} fill="none" stroke={c.ring} strokeOpacity="0.5" />
      </g>
    </svg>
  );
}
