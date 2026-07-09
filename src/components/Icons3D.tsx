import { useId } from "react";

// Hand-built 3D icons in the RobotIcon spirit: gradient body + gloss highlight +
// soft drop shadow for depth, plus one always-on "signature" motion each (scan /
// spin / bob / pulse — keyframes live in globals.css). Unique gradient/filter ids
// per instance so multiple on one page never clash. Pass a className to size.

type IconProps = { className?: string };

// Palette per family (matches the site's gold/mint).
const GOLD = { a: "#ffe7a8", b: "#e2a72f", c: "#9a6810", shadow: "#6b4a0e", ring: "#f4d488" };
const MINT = { a: "#8ef6cf", b: "#22d692", c: "#037a54", shadow: "#025c3f", ring: "#7ef2c6" };

function useIds(n: number) {
  const raw = useId().replace(/[:]/g, "");
  return Array.from({ length: n }, (_, i) => `${raw}${i}`);
}

// Research — a glossy magnifier (gold rim + glass) with a light "scan" sweeping
// across the lens and a fat rounded handle.
export function ResearchIcon({ className }: IconProps) {
  const [face, gloss, glow, clip] = useIds(4);
  const c = GOLD;
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={face} x1="8" y1="8" x2="30" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c.a} /><stop offset="0.5" stopColor={c.b} /><stop offset="1" stopColor={c.c} />
        </linearGradient>
        <radialGradient id={gloss} cx="0.36" cy="0.28" r="0.72">
          <stop offset="0" stopColor="#fff" stopOpacity="0.85" /><stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id={glow} x="-30%" y="-30%" width="175%" height="175%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.5" floodColor={c.shadow} floodOpacity="0.5" />
        </filter>
        <clipPath id={clip}><circle cx="20" cy="20" r="8" /></clipPath>
      </defs>
      {/* handle (drawn first, tucks under the lens) */}
      <line x1="27.5" y1="27.5" x2="39" y2="39" stroke={`url(#${face})`} strokeWidth="7" strokeLinecap="round" filter={`url(#${glow})`} />
      {/* gold rim */}
      <circle cx="20" cy="20" r="11.6" fill={`url(#${face})`} filter={`url(#${glow})`} />
      {/* glass */}
      <circle cx="20" cy="20" r="8" fill="#07130f" />
      <circle cx="20" cy="20" r="8" fill="#0bbb7c" fillOpacity="0.14" />
      <g clipPath={`url(#${clip})`}>
        <rect className="i3d-scan" x="16" y="9" width="4.6" height="22" rx="2.3" fill="#ffffff" fillOpacity="0.6" transform="rotate(18 20 20)" />
      </g>
      {/* reflections + edges */}
      <circle cx="20" cy="20" r="11.6" fill={`url(#${gloss})`} />
      <circle cx="20" cy="20" r="11.6" stroke={c.ring} strokeOpacity="0.55" strokeWidth="1" />
      <circle cx="20" cy="20" r="8" stroke="#000000" strokeOpacity="0.28" strokeWidth="1" />
    </svg>
  );
}

// Builder tooling — a glossy gear that slowly rotates.
export function ToolingIcon({ className }: IconProps) {
  const [face, gloss, glow] = useIds(3);
  const c = MINT;
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={face} x1="12" y1="10" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c.a} /><stop offset="0.5" stopColor={c.b} /><stop offset="1" stopColor={c.c} />
        </linearGradient>
        <radialGradient id={gloss} cx="0.4" cy="0.32" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0.7" /><stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id={glow} x="-30%" y="-30%" width="170%" height="170%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.5" floodColor={c.shadow} floodOpacity="0.5" />
        </filter>
      </defs>
      <g className="i3d-spin" filter={`url(#${glow})`}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <rect key={a} x="21.6" y="3.6" width="4.8" height="8.4" rx="1.8" fill={`url(#${face})`} transform={`rotate(${a} 24 24)`} />
        ))}
        <circle cx="24" cy="24" r="12.4" fill={`url(#${face})`} />
        <circle cx="24" cy="24" r="12.4" fill={`url(#${gloss})`} />
        <circle cx="24" cy="24" r="4.6" fill="#0a0a0c" fillOpacity="0.4" />
        <circle cx="24" cy="24" r="4.6" stroke={c.ring} strokeOpacity="0.4" strokeWidth="1" />
      </g>
    </svg>
  );
}

// Community first — two glossy figures; the front one gently bobs.
export function CommunityIcon({ className }: IconProps) {
  const [face, faceB, gloss, glow] = useIds(4);
  const c = GOLD;
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={face} x1="14" y1="10" x2="30" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c.a} /><stop offset="0.55" stopColor={c.b} /><stop offset="1" stopColor={c.c} />
        </linearGradient>
        <linearGradient id={faceB} x1="14" y1="12" x2="30" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c.b} /><stop offset="1" stopColor={c.c} />
        </linearGradient>
        <radialGradient id={gloss} cx="0.4" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0.7" /><stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id={glow} x="-30%" y="-30%" width="170%" height="170%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" floodColor={c.shadow} floodOpacity="0.5" />
        </filter>
      </defs>
      {/* back figure */}
      <g fill={`url(#${faceB})`} opacity="0.9">
        <circle cx="33" cy="17" r="4.4" />
        <path d="M25 34c0-4.7 3.7-8.2 8-8.2s8 3.5 8 8.2z" />
      </g>
      {/* front figure (bobs) */}
      <g className="i3d-bob" filter={`url(#${glow})`}>
        <circle cx="18" cy="16.5" r="5.6" fill={`url(#${face})`} />
        <circle cx="18" cy="16.5" r="5.6" fill={`url(#${gloss})`} />
        <path d="M7.5 35c0-5.8 4.7-10.2 10.5-10.2S28.5 29.2 28.5 35z" fill={`url(#${face})`} />
        <path d="M7.5 35c0-5.8 4.7-10.2 10.5-10.2S28.5 29.2 28.5 35z" fill={`url(#${gloss})`} opacity="0.6" />
      </g>
    </svg>
  );
}

// Security & trust — a glossy shield; a light sweeps down it and the check pulses.
export function SecurityIcon({ className }: IconProps) {
  const [face, gloss, glow, clip] = useIds(4);
  const c = MINT;
  const shield = "M24 5 L40 11 V23.5 C40 32.5 33 38.6 24 42 C15 38.6 8 32.5 8 23.5 V11 Z";
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={face} x1="12" y1="7" x2="34" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c.a} /><stop offset="0.5" stopColor={c.b} /><stop offset="1" stopColor={c.c} />
        </linearGradient>
        <radialGradient id={gloss} cx="0.42" cy="0.24" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" /><stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id={glow} x="-30%" y="-30%" width="170%" height="170%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.6" floodColor={c.shadow} floodOpacity="0.55" />
        </filter>
        <clipPath id={clip}><path d={shield} /></clipPath>
      </defs>
      <path d={shield} fill={`url(#${face})`} filter={`url(#${glow})`} />
      <g clipPath={`url(#${clip})`}>
        <rect className="i3d-scan" x="4" y="2" width="9" height="46" rx="4" fill="#ffffff" fillOpacity="0.4" transform="rotate(12 24 24)" />
      </g>
      <path d={shield} fill={`url(#${gloss})`} />
      <path d={shield} stroke={c.ring} strokeOpacity="0.5" strokeWidth="1" />
      <path className="i3d-pulse" d="M17 24 l4.8 4.8 L31 18" stroke="#06231a" strokeOpacity="0.85" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 24 l4.8 4.8 L31 18" stroke="#eafff6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
