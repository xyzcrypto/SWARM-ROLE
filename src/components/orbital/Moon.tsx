"use client";

import { useMemo, useRef, MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { GOLD_LIGHT, MINT, MINT_LIGHT } from "./constants";
import { moonTextures, robotFaceTexture } from "./textures";
import { GlowSprite } from "./Glow";

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const MOON = 0.46; // crescent scale

// Layer 4 (left): a 3D CRESCENT moon (extruded from a Shape = big circle minus an
// offset circle) with the cratered grey rock material, and the XYZ robot mascot
// sitting in its curve (a camera-facing billboard so its face always reads).
// Slow bob + tilt; parallax OPPOSITE to Saturn; slides in from the left.
export function Moon({ scrollRef, compact = false }: { scrollRef: MutableRefObject<number>; compact?: boolean }) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const robotMat = useRef<THREE.MeshBasicMaterial>(null);
  const robotGrp = useRef<THREE.Group>(null);
  const start = useRef(-1);

  const { map, bump } = useMemo(() => moonTextures(), []);
  const robotTex = useMemo(() => robotFaceTexture(), []);

  // Crescent outline: circle R1 at origin minus circle R2 offset to +x.
  const crescent = useMemo(() => {
    const R1 = 1;
    const R2 = 0.8;
    const d = 0.6;
    const xi = (R1 * R1 - R2 * R2 + d * d) / (2 * d);
    const yi = Math.sqrt(R1 * R1 - xi * xi);
    const a1 = Math.atan2(yi, xi);
    const b1 = Math.atan2(yi, xi - d);
    const s = new THREE.Shape();
    s.absarc(0, 0, R1, a1, Math.PI * 2 - a1, false); // outer edge (long way round)
    s.absarc(d, 0, R2, Math.PI * 2 - b1, b1, true); // inner concave carve
    s.closePath();
    return s;
  }, []);

  const base = useMemo(
    () => (compact ? new THREE.Vector3(-1.2, 0.0, -0.35) : new THREE.Vector3(-1.95, 0.1, -0.35)),
    [compact]
  );
  const sizeK = compact ? 0.82 : 1;

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (start.current < 0) start.current = t + 0.2; // moon leads the entrance
    const e = easeOut(THREE.MathUtils.clamp((t - start.current) / 1.5, 0, 1));

    if (spin.current) spin.current.rotation.z = 0.32 + Math.sin(t * 0.25) * 0.03; // gentle sway
    if (inner.current) {
      inner.current.position.y = Math.sin(t * 0.5 + 1.5) * 0.05;
      inner.current.scale.setScalar(sizeK);
    }
    if (mat.current) mat.current.opacity = e;
    if (robotMat.current) robotMat.current.opacity = e;
    if (robotGrp.current) robotGrp.current.position.y = 0.02 + Math.sin(t * 1.1) * 0.02; // robot bob

    if (outer.current) {
      const px = state.pointer.x;
      const py = state.pointer.y;
      const sc = scrollRef.current;
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
        {/* soft cool halo behind the crescent */}
        <GlowSprite color="#c8ccdc" scale={MOON * 3.4} opacity={0.18} position={[-0.1, 0, -0.25]} />

        {/* the 3D crescent (tilted) */}
        <group ref={spin} scale={MOON}>
          <mesh position={[0, 0, -0.09]}>
            <extrudeGeometry
              args={[
                crescent,
                { depth: 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, curveSegments: 64 },
              ]}
            />
            <meshStandardMaterial
              ref={mat}
              map={map}
              bumpMap={bump}
              bumpScale={0.02}
              roughness={0.98}
              metalness={0}
              transparent
            />
          </mesh>
        </group>

        {/* XYZ robot mascot sitting in the crescent's curve (billboard = faces camera) */}
        <group ref={robotGrp} position={[0.16, 0.02, 0.32]}>
          <GlowSprite color={MINT} scale={0.5} opacity={0.5} position={[0, 0, -0.08]} />
          <Billboard>
            <mesh>
              <planeGeometry args={[0.42, 0.42]} />
              <meshBasicMaterial ref={robotMat} map={robotTex} transparent depthWrite={false} />
            </mesh>
          </Billboard>
        </group>

        {/* faint mint sparkle above the robot's antenna */}
        <GlowSprite color={MINT_LIGHT} scale={0.12} opacity={0.7} position={[0.16, 0.24, 0.34]} />
      </group>
    </group>
  );
}
