"use client";

import { useMemo, useRef, MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GOLD_LIGHT } from "./constants";
import { moonTextures } from "./textures";
import { GlowSprite, FresnelShell } from "./Glow";

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const RADIUS = 0.34;

// Terminator shade: darkens the hemisphere facing away from the core so the moon
// reads as a real half / "night" phase, independent of the scene lights (fully
// deterministic). Lit side faces uLightDir (≈ from the XYZ core, to the right).
const nightVert = /* glsl */ `
  varying vec3 vN;
  void main() {
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const nightFrag = /* glsl */ `
  uniform vec3 uLightDir;
  uniform float uStrength;
  varying vec3 vN;
  void main() {
    float d = dot(normalize(vN), normalize(uLightDir));
    float night = smoothstep(0.30, -0.16, d); // 0 on lit side -> 1 on night side
    gl_FragColor = vec4(0.0, 0.0, 0.0, night * uStrength);
  }
`;

// Layer 4 (left): a cratered HALF moon. Procedural bump map gives real relief;
// the terminator shade paints a crisp day/night line. Slow spin + float; parallax
// OPPOSITE to Saturn; emerges from the left on entrance.
export function Moon({ scrollRef, compact = false }: { scrollRef: MutableRefObject<number>; compact?: boolean }) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const start = useRef(-1);

  const { map, bump } = useMemo(() => moonTextures(), []);
  const base = useMemo(
    () => (compact ? new THREE.Vector3(-1.18, 0.0, -0.35) : new THREE.Vector3(-1.95, 0.1, -0.35)),
    [compact]
  );
  const sizeK = compact ? 0.82 : 1;
  const nightUniforms = useMemo(
    () => ({ uLightDir: { value: new THREE.Vector3(1.0, 0.35, 0.55) }, uStrength: { value: 0.86 } }),
    []
  );

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (start.current < 0) start.current = t + 0.2; // moon leads the entrance
    const e = easeOut(THREE.MathUtils.clamp((t - start.current) / 1.5, 0, 1));

    if (body.current) body.current.rotation.y += dt * 0.045;
    if (inner.current) {
      inner.current.position.y = Math.sin(t * 0.5 + 1.5) * 0.05;
      inner.current.scale.setScalar(sizeK);
    }
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
        <GlowSprite color="#c8ccdc" scale={RADIUS * 4} opacity={0.22} position={[0, 0, -0.2]} />
        {/* warm light spilling from the XYZ orbit onto the moon's lit (core-facing) edge */}
        <GlowSprite color={GOLD_LIGHT} scale={RADIUS * 2.6} opacity={0.32} position={[RADIUS * 0.7, 0, 0.05]} />
        <mesh ref={body}>
          <sphereGeometry args={[RADIUS, 48, 48]} />
          <meshStandardMaterial
            ref={mat}
            map={map}
            bumpMap={bump}
            bumpScale={0.015}
            roughness={0.97}
            metalness={0}
            transparent
          />
        </mesh>
        {/* night side */}
        <mesh scale={RADIUS * 1.006}>
          <sphereGeometry args={[1, 48, 48]} />
          <shaderMaterial
            uniforms={nightUniforms}
            vertexShader={nightVert}
            fragmentShader={nightFrag}
            transparent
            depthWrite={false}
            side={THREE.FrontSide}
          />
        </mesh>
        {/* thin warm rim only on the lit limb */}
        <FresnelShell color={GOLD_LIGHT} scale={RADIUS * 1.05} power={3.8} intensity={0.28} />
      </group>
    </group>
  );
}
