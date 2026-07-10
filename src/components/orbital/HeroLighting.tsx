"use client";

import { GOLD, MINT } from "./constants";

// Scene lighting: a warm gold key (upper-right, where Saturn sits) + a cool mint
// fill (lower-left) + soft ambient. This is what carves the terminator on the
// spheres and the metallic sheen on the core. Intensities are R3F v8 physical.
export function HeroLighting() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 3, 4]} intensity={60} color={GOLD} distance={40} decay={1.3} />
      <pointLight position={[-5, -2, 2]} intensity={30} color={MINT} distance={40} decay={1.5} />
      <pointLight position={[0, 0, 3.5]} intensity={14} color="#fff6e6" distance={16} decay={1.8} />
    </>
  );
}
