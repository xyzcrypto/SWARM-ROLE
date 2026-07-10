"use client";

import { useMemo, useRef, useState, MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GOLD, GOLD_LIGHT } from "./constants";
import { saturnBodyTexture, saturnRingTexture } from "./textures";
import { GlowSprite, FresnelShell } from "./Glow";

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const RADIUS = 0.62;

// Layer 4 (upper-right): a procedural ringed planet. The ring is a real 3D disc
// around the equator, so it occludes behind the top of the globe and draws in
// front of the bottom for free. Slow spin + float + tiny wobble; hover brightens
// the glow + rim; cinematic scale/opacity/position entrance with a ring flash.
export function Saturn({ scrollRef, onHover }: { scrollRef: MutableRefObject<number>; onHover?: (h: boolean) => void }) {
  const outer = useRef<THREE.Group>(null); // parallax target (scene moves this)
  const inner = useRef<THREE.Group>(null); // float + entrance
  const tilt = useRef<THREE.Group>(null); // axial tilt + wobble (body + ring)
  const body = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null);
  const [hover, setHover] = useState(false);
  const start = useRef(-1);
  const hoverK = useRef(0);

  const bodyTex = useMemo(() => saturnBodyTexture(), []);
  const ringTex = useMemo(() => saturnRingTexture(), []);

  const base = useMemo(() => new THREE.Vector3(1.85, 1.15, -0.6), []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (start.current < 0) start.current = t + 0.35; // rings begin ~350ms after
    const e = easeOut(THREE.MathUtils.clamp((t - start.current) / 1.6, 0, 1));

    // spin + float + wobble
    if (body.current) body.current.rotation.y += dt * 0.06;
    if (inner.current) inner.current.position.y = Math.sin(t * 0.6) * 0.06;
    if (tilt.current) {
      tilt.current.rotation.set(0.46, 0, -0.28 + Math.sin(t * 0.4) * 0.02);
    }

    // entrance: scale + opacity + slide from upper-right
    if (inner.current) {
      const s = 0.8 + 0.2 * e;
      inner.current.scale.setScalar(s);
    }
    if (bodyMat.current) bodyMat.current.opacity = e;

    // hover ease
    hoverK.current = THREE.MathUtils.lerp(hoverK.current, hover ? 1 : 0, 0.08);
    if (bodyMat.current) bodyMat.current.emissiveIntensity = 0.12 + hoverK.current * 0.18;
    // one-time ring light-sweep near end of entrance + hover liveliness
    if (ringMat.current) {
      const sweep = Math.exp(-Math.pow((e - 0.85) / 0.12, 2)) * 0.5;
      ringMat.current.opacity = e * (0.85 + sweep + hoverK.current * 0.15);
    }

    // parallax (pointer + scroll) - Saturn drifts WITH the pointer, up on scroll
    if (outer.current) {
      const px = state.pointer.x;
      const py = state.pointer.y;
      const sc = scrollRef.current;
      const tx = base.x + px * 0.18 + sc * 0.15;
      const ty = base.y + py * 0.14 - sc * 0.55;
      outer.current.position.x = THREE.MathUtils.lerp(outer.current.position.x, tx, 0.05);
      outer.current.position.y = THREE.MathUtils.lerp(outer.current.position.y, ty, 0.05);
      outer.current.position.z = base.z;
    }
  });

  return (
    <group ref={outer} position={base.toArray()}>
      <group ref={inner}>
        {/* fake-bloom halo (additive) - also the atmospheric glow */}
        <GlowSprite color={GOLD} scale={RADIUS * 5.2} opacity={0.5 + hoverK.current * 0.2} position={[0, 0, -0.2]} />
        <group ref={tilt}>
          {/* body */}
          <mesh
            ref={body}
            onPointerOver={() => {
              setHover(true);
              onHover?.(true);
            }}
            onPointerOut={() => {
              setHover(false);
              onHover?.(false);
            }}
          >
            <sphereGeometry args={[RADIUS, 64, 64]} />
            <meshStandardMaterial
              ref={bodyMat}
              map={bodyTex}
              roughness={0.92}
              metalness={0.05}
              emissive={GOLD}
              emissiveIntensity={0.12}
              transparent
            />
          </mesh>
          {/* atmospheric rim */}
          <FresnelShell color={GOLD_LIGHT} scale={RADIUS * 1.06} power={3.2} intensity={0.8} />
          {/* equatorial ring disc (real occlusion). RingGeometry is in XY; rotate
              into the equatorial plane so the axial tilt above orients it. */}
          <mesh
            rotation={[Math.PI / 2, 0, 0]}
            onPointerOver={() => setHover(true)}
            onPointerOut={() => setHover(false)}
          >
            <ringGeometry args={[RADIUS * 1.25, RADIUS * 2.15, 128]} />
            <meshBasicMaterial
              ref={ringMat}
              map={ringTex}
              color={GOLD_LIGHT}
              transparent
              opacity={0}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.NormalBlending}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
