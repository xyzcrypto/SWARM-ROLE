import { useId } from "react";

/**
 * Glossy 3D-style robot head for the "XYZ AI" identity. Built from gradients +
 * a top gloss highlight + a soft drop shadow so it reads with depth (not a flat
 * line icon). Green (mint) themed by default; pass a className for sizing.
 * Unique gradient/filter ids per instance so multiple robots on one page don't
 * clash.
 */
export function RobotIcon({ className }: { className?: string }) {
  const raw = useId().replace(/[:]/g, "");
  const face = `f-${raw}`;
  const gloss = `g-${raw}`;
  const eye = `e-${raw}`;
  const glow = `s-${raw}`;

  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={face} x1="24" y1="10" x2="24" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7ef2c6" />
          <stop offset="0.45" stopColor="#22d692" />
          <stop offset="1" stopColor="#037a54" />
        </linearGradient>
        <radialGradient id={gloss} cx="0.5" cy="0.28" r="0.6">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.65" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={eye} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#eafff6" />
          <stop offset="1" stopColor="#0a3f2c" />
        </radialGradient>
        <filter id={glow} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="1.4" stdDeviation="1.4" floodColor="#025c3f" floodOpacity="0.55" />
        </filter>
      </defs>

      {/* antenna */}
      <line x1="24" y1="8" x2="24" y2="14" stroke="#0bbb7c" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="6.5" r="2.6" fill="#9bf7d0" />
      <circle cx="24" cy="6.5" r="2.6" fill={`url(#${gloss})`} />

      {/* side ears */}
      <rect x="5" y="22" width="4.5" height="9" rx="2.25" fill="#0a8f66" filter={`url(#${glow})`} />
      <rect x="38.5" y="22" width="4.5" height="9" rx="2.25" fill="#0a8f66" filter={`url(#${glow})`} />

      {/* head */}
      <rect x="9" y="13" width="30" height="27" rx="9" fill={`url(#${face})`} filter={`url(#${glow})`} />
      {/* top gloss */}
      <rect x="12" y="15.5" width="24" height="15" rx="7.5" fill={`url(#${gloss})`} />

      {/* eyes */}
      <circle cx="18.5" cy="26.5" r="3.4" fill={`url(#${eye})`} />
      <circle cx="29.5" cy="26.5" r="3.4" fill={`url(#${eye})`} />
      <circle cx="17.6" cy="25.4" r="1.05" fill="#ffffff" />
      <circle cx="28.6" cy="25.4" r="1.05" fill="#ffffff" />

      {/* mouth */}
      <rect x="17.5" y="33" width="13" height="3.2" rx="1.6" fill="#0a3f2c" fillOpacity="0.55" />
    </svg>
  );
}
