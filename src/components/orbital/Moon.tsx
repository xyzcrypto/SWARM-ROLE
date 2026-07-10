"use client";

import { useMemo, useRef, MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GOLD_LIGHT } from "./constants";
import { moonTextures } from "./textures";
import { GlowSprite, FresnelShell } from "./Glow";

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const RADIUS = 0.34;

// Layer 4 (left): a cratered moon. Procedural bump map gives real relief under
// the gold key light, so the shadow side reads deep. Slow spin + float; parallax
// OPPOSITE to Saturn for depth; emerges from the left on entrance.
export function Moon({ scrollRef }: { scrollRef: MutableRefObject<number> }) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const start = useRef(-1);

  const { map, bump } = useMemo(() => moonTextures(), []);
  const base = useMemo(() => new THREE.Vector3(-1.95, 0.1, -0.35), []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (start.current < 0) start.current = t + 0.2; // moon leads the entrance
    const e = easeOut(THREE.MathUtils.clamp((t - start.current) / 1.5, 0, 1));

    if (body.current) body.current.rotation.y += dt * 0.045;
    if (inner.current) inner.current.position.y = Math.sin(t * 0.5 + 1.5) * 0.05;
    if (mat.current) mat.current.opacity = e;

    if (outer.current) {
      const px = state.pointer.x;
      const py = state.pointer.y;
      const sc = scrollRef.current;
      // slide in from the left (entrance) + opposite parallax
      const enter = (1 - e) * -0.7;
      const tx = base.x + enter - px * 0.16 - sc * 0.12;
      const ty = base.y - py * 0.12 + sc * 0.45;
      outer.current.position.x = THREE.MathUtils.lerp(outer.current.position.x, tx, 0.05);
      outer.current.position.y = THREE.MathUtils.lerp(outer.current.position.y, ty, 0.05);
      outer.current.position.z = base.z;
    }
  });

  return (
    <group ref={outer} position={base.toArray()}>
      <group ref={inner}>
        <GlowSprite color="#c8ccdc" scale={RADIUS * 4} opacity={0.28} position={[0, 0, -0.2]} />
        <mesh ref={body}>
          <sphereGeometry args={[RADIUS, 48, 48]} />
          <meshStandardMaterial
            ref={mat}
            map={map}
            bumpMap={bump}
            bumpScale={0.015}
            roughness={0.95}
            metalness={0}
            transparent
          />
        </mesh>
        <FresnelShell color={GOLD_LIGHT} scale={RADIUS * 1.05} power={3.5} intensity={0.35} />
      </group>
    </group>
  );
}
