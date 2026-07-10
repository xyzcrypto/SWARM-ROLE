"use client";

import { useMemo, useRef, MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GOLD_LIGHT, MINT, MINT_LIGHT } from "./constants";
import { moonTextures, robotFaceTexture } from "./textures";
import { GlowSprite } from "./Glow";

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const RADIUS = 0.4;

// Terminator shader → a thin lit CRESCENT (rest is night), lit from the XYZ core
// side. Only uses a sphere + a shell shader (both proven from the earlier scene),
// so it renders reliably; the crescent look comes from the lighting, not a risky
// extruded geometry.
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
    float lit = smoothstep(0.42, 0.82, d);   // only the strongly-lit cap stays bright
    float night = (1.0 - lit) * uStrength;    // everything else darkens -> crescent
    gl_FragColor = vec4(0.0, 0.0, 0.0, night);
  }
`;

// Layer 4 (left): a cratered CRESCENT moon (sphere + terminator) with the XYZ
// robot mascot sitting on its lit face (camera-facing sprite). Slow spin + float;
// parallax OPPOSITE to Saturn; slides in from the left.
export function Moon({ scrollRef, compact = false }: { scrollRef: MutableRefObject<number>; compact?: boolean }) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const robotMat = useRef<THREE.SpriteMaterial>(null);
  const robot = useRef<THREE.Sprite>(null);
  const start = useRef(-1);

  const { map, bump } = useMemo(() => moonTextures(), []);
  const robotTex = useMemo(() => robotFaceTexture(), []);
  const base = useMemo(
    () => (compact ? new THREE.Vector3(-1.2, 0.0, -0.35) : new THREE.Vector3(-1.95, 0.1, -0.35)),
    [compact]
  );
  const sizeK = compact ? 0.82 : 1;
  const nightUniforms = useMemo(
    () => ({ uLightDir: { value: new THREE.Vector3(1.0, 0.3, 0.7) }, uStrength: { value: 0.92 } }),
    []
  );

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (start.current < 0) start.current = t + 0.2;
    const e = easeOut(THREE.MathUtils.clamp((t - start.current) / 1.5, 0, 1));

    if (body.current) body.current.rotation.y += dt * 0.04;
    if (inner.current) {
      inner.current.position.y = Math.sin(t * 0.5 + 1.5) * 0.05;
      inner.current.scale.setScalar(sizeK);
    }
    if (mat.current) mat.current.opacity = e;
    if (robotMat.current) robotMat.current.opacity = e;
    if (robot.current) robot.current.position.y = -0.02 + Math.sin(t * 1.1) * 0.02; // bob

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
        {/* cool halo behind */}
        <GlowSprite color="#c8ccdc" scale={RADIUS * 3.6} opacity={0.18} position={[0, 0, -0.25]} />

        {/* moon body (cratered rock) */}
        <mesh ref={body}>
          <sphereGeometry args={[RADIUS, 48, 48]} />
          <meshStandardMaterial ref={mat} map={map} bumpMap={bump} bumpScale={0.02} roughness={0.98} metalness={0} transparent />
        </mesh>
        {/* night side → crescent */}
        <mesh scale={RADIUS * 1.006}>
          <sphereGeometry args={[1, 48, 48]} />
          <shaderMaterial uniforms={nightUniforms} vertexShader={nightVert} fragmentShader={nightFrag} transparent depthWrite={false} side={THREE.FrontSide} />
        </mesh>
        {/* warm light spill on the lit (core-facing) edge */}
        <GlowSprite color={GOLD_LIGHT} scale={RADIUS * 2.2} opacity={0.3} position={[RADIUS * 0.7, 0, 0.05]} />

        {/* XYZ robot mascot sitting on the lit crescent (camera-facing sprite) */}
        <GlowSprite color={MINT} scale={0.5} opacity={0.45} position={[RADIUS * 0.55, -0.02, 0.28]} />
        <sprite ref={robot} position={[RADIUS * 0.55, -0.02, 0.34]} scale={[0.4, 0.4, 0.4]}>
          <spriteMaterial ref={robotMat} map={robotTex} transparent depthWrite={false} />
        </sprite>
        {/* mint antenna sparkle */}
        <GlowSprite color={MINT_LIGHT} scale={0.1} opacity={0.7} position={[RADIUS * 0.55, 0.2, 0.36]} />
      </group>
    </group>
  );
}
