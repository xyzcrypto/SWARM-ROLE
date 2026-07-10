"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GOLD, MINT, VIOLET, Tier } from "./constants";
import { nebulaTexture, dotTexture } from "./textures";

function Nebula({ color, position, scale }: { color: string; position: [number, number, number]; scale: number }) {
  const tex = useMemo(() => nebulaTexture(color), [color]);
  return (
    <sprite position={position} scale={[scale, scale * 0.8, 1]}>
      <spriteMaterial map={tex} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
    </sprite>
  );
}

// Layer 2 (nebula clouds, behind stars) + Layer 5 (faint foreground dust, near
// camera). Dust only on the high tier. Both drift slowly; dust is the fastest
// parallax layer so it sells depth on scroll/cursor.
export function SpaceParticles({ tier }: { tier: Tier }) {
  const dust = useRef<THREE.Points>(null);
  const dotTex = useMemo(() => dotTexture(), []);
  const count = tier === "high" ? 70 : 0;

  const dustPos = useMemo(() => {
    const p = new Float32Array(Math.max(count, 1) * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 7;
      p[i * 3 + 1] = (Math.random() - 0.5) * 5;
      p[i * 3 + 2] = 1 + Math.random() * 2.5; // in front of the scene
    }
    return p;
  }, [count]);

  useFrame((_, dt) => {
    if (dust.current) {
      dust.current.rotation.z += dt * 0.01;
      dust.current.position.x = Math.sin(performance.now() * 0.00006) * 0.15;
    }
  });

  return (
    <group>
      {/* nebula depth clouds - warm gold around the core, green lower-right, faint violet upper-left */}
      <Nebula color={GOLD} position={[0, 0.2, -3]} scale={7.5} />
      <Nebula color={MINT} position={[2.6, -2, -5]} scale={6.5} />
      <Nebula color={VIOLET} position={[-2.6, 2.2, -6]} scale={5} />

      {count > 0 && (
        <points ref={dust}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[dustPos, 3]} />
          </bufferGeometry>
          <pointsMaterial
            map={dotTex}
            color={GOLD}
            size={0.06}
            sizeAttenuation
            transparent
            opacity={0.35}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}
    </group>
  );
}
