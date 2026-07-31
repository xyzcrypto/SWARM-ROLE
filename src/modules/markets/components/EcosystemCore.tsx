"use client";

import { useMemo, useRef, MutableRefObject } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GOLD, GOLD_LIGHT, MINT, MINT_LIGHT, SKY } from "./constants";
import { GlowSprite } from "./Glow";

// One tilted orbit carrying glowing product nodes + a faint guide ring + a few
// fast "energy" motes. Different rings get different tilts/speeds/colours.
function Orbit({
  radius,
  tilt,
  speed,
  color,
  nodeColor,
  nodes,
  motes,
}: {
  radius: number;
  tilt: [number, number, number];
  speed: number;
  color: string;
  nodeColor: string;
  nodes: number;
  motes: number;
}) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.z += dt * speed;
  });
  const nodeAngles = useMemo(() => Array.from({ length: nodes }, (_, i) => (i / nodes) * Math.PI * 2), [nodes]);
  const moteAngles = useMemo(
    () => Array.from({ length: motes }, (_, i) => (i / motes) * Math.PI * 2 + 0.4),
    [motes]
  );
  return (
    <group rotation={tilt}>
      {/* guide ring */}
      <mesh>
        <torusGeometry args={[radius, 0.006, 8, 128]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} />
      </mesh>
      <group ref={spin}>
        {nodeAngles.map((a, i) => (
          <group key={`n${i}`} position={[Math.cos(a) * radius, Math.sin(a) * radius, 0]}>
            <mesh>
              <sphereGeometry args={[0.05, 20, 20]} />
              <meshStandardMaterial color={nodeColor} emissive={nodeColor} emissiveIntensity={0.9} roughness={0.4} />
            </mesh>
            <GlowSprite color={nodeColor} scale={0.34} opacity={0.5} />
          </group>
        ))}
        {moteAngles.map((a, i) => (
          <mesh key={`m${i}`} position={[Math.cos(a) * radius, Math.sin(a) * radius, 0]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshBasicMaterial color={GOLD_LIGHT} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// Occasional light pulse travelling from the orbit inward to the XYZ core.
function Pulse({ color, radius, tilt, offset, period }: { color: string; radius: number; tilt: [number, number, number]; offset: number; period: number }) {
  const ref = useRef<THREE.Sprite>(null);
  const matRef = useRef<THREE.SpriteMaterial>(null);
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const dir = useMemo(() => {
    const e = new THREE.Euler(...tilt);
    return new THREE.Vector3(Math.cos(offset), Math.sin(offset), 0).applyEuler(e);
  }, [tilt, offset]);
  useFrame((state) => {
    const p = ((state.clock.elapsedTime + offset * 3) % period) / period; // 0..1
    const k = 1 - p; // start at ring, move to core
    if (ref.current) ref.current.position.copy(dir).multiplyScalar(radius * k);
    if (matRef.current) matRef.current.opacity = Math.sin(p * Math.PI) * 0.8;
  });
  return (
    <sprite ref={ref} scale={[0.28, 0.28, 0.28]}>
      <spriteMaterial ref={matRef} map={tex} color={color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
    </sprite>
  );
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Layer 3: the focal XYZ core. Breathing glow + logo billboard + gold frame ring
// + two tilted orbits of product nodes + inward energy pulses. Scales in on load.
export function EcosystemCore({ scrollRef }: { scrollRef: MutableRefObject<number> }) {
  const root = useRef<THREE.Group>(null);
  const logo = useLoader(THREE.TextureLoader, "/logo.png");
  const glowRef = useRef<THREE.Sprite>(null);
  const start = useRef(-1);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (start.current < 0) start.current = t + 0.65; // core scales in at ~650ms
    const e = easeOut(THREE.MathUtils.clamp((t - start.current) / 1.1, 0, 1));
    if (root.current) {
      root.current.scale.setScalar((0.92 + 0.08 * e) * e ** 0.2);
      // gentle counter-parallax so the core has depth without leaving centre
      const px = state.pointer.x;
      const py = state.pointer.y;
      root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, px * 0.12, 0.05);
      root.current.rotation.x = THREE.MathUtils.lerp(root.current.rotation.x, -py * 0.1 + scrollRef.current * 0.15, 0.05);
    }
    // breathing glow behind the logo
    if (glowRef.current) {
      const b = 0.5 + 0.18 * Math.sin(t * 1.4);
      (glowRef.current.material as THREE.SpriteMaterial).opacity = b * e;
    }
  });

  return (
    <group ref={root}>
      {/* breathing halo */}
      <sprite ref={glowRef} scale={[2.7, 2.7, 2.7]} position={[0, 0, -0.3]}>
        <GlowMat />
      </sprite>

      {/* logo billboard (always faces camera) + gold frame */}
      <sprite scale={[1.05, 1.05, 1.05]}>
        <spriteMaterial map={logo} transparent depthWrite={false} />
      </sprite>
      <mesh position={[0, 0, -0.01]}>
        <torusGeometry args={[0.6, 0.012, 12, 96]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.8} roughness={0.3} metalness={0.7} />
      </mesh>

      {/* orbits */}
      <Orbit radius={1.15} tilt={[1.2, 0, 0]} speed={0.14} color={GOLD} nodeColor={GOLD_LIGHT} nodes={4} motes={3} />
      <Orbit radius={1.5} tilt={[1.42, 0.4, 0]} speed={-0.1} color={MINT} nodeColor={MINT_LIGHT} nodes={4} motes={2} />
      <Orbit radius={1.9} tilt={[1.1, -0.5, 0.2]} speed={0.07} color={SKY} nodeColor={SKY} nodes={3} motes={2} />

      {/* energy pulses inward */}
      <Pulse color={GOLD_LIGHT} radius={1.15} tilt={[1.2, 0, 0]} offset={0.6} period={4.5} />
      <Pulse color={MINT_LIGHT} radius={1.5} tilt={[1.42, 0.4, 0]} offset={2.4} period={5.5} />
    </group>
  );
}

// Standalone glow material (own texture) for the breathing halo sprite.
function GlowMat() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <spriteMaterial map={tex} color={GOLD} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
  );
}
