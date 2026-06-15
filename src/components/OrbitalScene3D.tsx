"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles, Icosahedron, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

// Premium React-Three-Fiber orbital hero. Lazy-loaded + capability-gated by
// OrbitalLazy (desktop/WebGL only); the CSS OrbitalEcosystem is the fallback.
// Brand palette only. Perf-budgeted: capped dpr, low-poly, paused when offscreen.

const GOLD = "#e2a72f";
const MINT = "#22d692";

function Core() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.15;
  });
  return (
    <Float speed={1.1} rotationIntensity={0.4} floatIntensity={0.6}>
      <Icosahedron ref={ref} args={[1.15, 4]}>
        <MeshDistortMaterial
          color={GOLD}
          emissive={GOLD}
          emissiveIntensity={0.32}
          roughness={0.25}
          metalness={0.65}
          distort={0.22}
          speed={1.4}
        />
      </Icosahedron>
    </Float>
  );
}

function Nodes() {
  const group = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (group.current) group.current.rotation.y -= d * 0.1;
  });
  // Evenly distribute a handful of orbiting nodes on two tilted rings.
  const nodes = useMemo(() => {
    const out: { pos: [number, number, number]; color: string }[] = [];
    const count = 8;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 2.1;
      const tilt = i % 2 === 0 ? 0.25 : -0.2;
      out.push({
        pos: [Math.cos(a) * r, Math.sin(a) * r * tilt + Math.sin(a * 2) * 0.2, Math.sin(a) * r],
        color: i % 2 === 0 ? GOLD : MINT,
      });
    }
    return out;
  }, []);
  return (
    <group ref={group}>
      {/* faint ring */}
      <mesh rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[2.1, 0.006, 8, 96]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.25} />
      </mesh>
      {nodes.map((n, i) => (
        <mesh key={i} position={n.pos}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color={n.color} emissive={n.color} emissiveIntensity={0.7} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function ParallaxRig({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, state.pointer.x * 0.3, 0.04);
    ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, -state.pointer.y * 0.2, 0.04);
  });
  return <group ref={ref}>{children}</group>;
}

export default function OrbitalScene3D() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);

  // Pause the render loop when the section is offscreen or the tab is hidden.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let inView = true;
    const apply = () => setActive(inView && document.visibilityState === "visible");
    const io = new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting;
        apply();
      },
      { rootMargin: "120px" }
    );
    io.observe(el);
    const onVis = () => apply();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto aspect-square w-full max-w-[17.5rem] xs:max-w-[20rem] sm:max-w-lg lg:max-w-2xl"
    >
      <Canvas
        dpr={[1, 1.5]}
        frameloop={active ? "always" : "never"}
        camera={{ position: [0, 0, 4.2], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.55} />
        <pointLight position={[3, 3, 3]} intensity={40} color={GOLD} />
        <pointLight position={[-3, -2, -2]} intensity={22} color={MINT} />
        <ParallaxRig>
          <Core />
          <Nodes />
          <Sparkles count={60} scale={6} size={2.2} speed={0.25} color={GOLD} opacity={0.55} />
        </ParallaxRig>
      </Canvas>
    </div>
  );
}
