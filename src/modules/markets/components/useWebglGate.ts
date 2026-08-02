"use client";

// WebGL orbital is TEMPORARILY DISABLED. The three.js scene rendered
// inconsistently across some desktop setups (blank on the owner's machine) and
// couldn't be verified in CI. The centerpiece is now the reliable, always-rendering
// CSS orbital (realistic gold Saturn + crescent moon + XYZ robot on desktop), which
// is screenshot-verifiable. The WebGL code stays in the repo (OrbitalScene, etc.)
// for a future, properly-verified pass — flip this back to the capability check then.
export function useWebglGate(): boolean {
  return false;
}
