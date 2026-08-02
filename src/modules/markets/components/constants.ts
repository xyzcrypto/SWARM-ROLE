// Shared palette for the WebGL orbital scene. Brand colours ONLY (same gold/mint
// the whole site uses) - the cinematic look comes from lighting + depth, never
// from new hues. Warm support tones (amber/beige/brown) are shades of the gold
// ramp used purely for Saturn's banded gas body.
export const GOLD = "#e2a72f";
export const GOLD_LIGHT = "#f4d488";
export const AMBER = "#f0c063";
export const BEIGE = "#e8c88a";
export const BROWN = "#8a5a17";
export const BROWN_DEEP = "#5c3a0e";
export const MINT = "#22d692";
export const MINT_LIGHT = "#7dffcf";
export const VIOLET = "#a78bfa";
export const SKY = "#7dd3fc";

// Device performance tiers drive particle counts / dpr / optional layers so the
// same composition renders on a phone and a workstation.
export type Tier = "high" | "low";
