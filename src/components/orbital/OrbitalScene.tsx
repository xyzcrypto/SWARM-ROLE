"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AnimatePresence, motion } from "framer-motion";
import * as THREE from "three";
import { Tier } from "./constants";
import { HeroLighting } from "./HeroLighting";
import { StarField } from "./StarField";
import { SpaceParticles } from "./SpaceParticles";
import { Saturn } from "./Saturn";
import { Moon } from "./Moon";
import { EcosystemCore } from "./EcosystemCore";

// Global "solar-system" tilt driven by section scroll progress - this is the
// "living solar system + parallax depth" motion: the whole plane tilts a few
// degrees as the section travels through the viewport.
function SceneRig({ scrollRef, children }: { scrollRef: React.MutableRefObject<number>; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, scrollRef.current * 0.14, 0.05);
  });
  return <group ref={ref}>{children}</group>;
}

// Very subtle camera dolly on scroll for the "advance forward" feel.
function CameraDolly({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  useFrame((state) => {
    const z = 7.4 - scrollRef.current * 0.7;
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, z, 0.05);
  });
  return null;
}

// Feed R3F's pointer even though the canvas is pointer-events-none at the wrapper
// (we forward pointer via the overlay). Not needed here - Canvas gets its own
// pointer events. Kept simple.
function useTier(): Tier {
  const [tier, setTier] = useState<Tier>("high");
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setTier(mq.matches ? "low" : "high");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return tier;
}

export default function OrbitalScene() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(0);
  const [active, setActive] = useState(true);
  const [label, setLabel] = useState(false);
  const tier = useTier();

  // Pause the render loop when offscreen or the tab is hidden (perf).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let inView = true;
    const apply = () => setActive(inView && document.visibilityState === "visible");
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; apply(); }, { rootMargin: "120px" });
    io.observe(el);
    const onVis = () => apply();
    document.addEventListener("visibilitychange", onVis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  // Section scroll progress (-1 above → 0 centred → 1 below), rAF-throttled so it
  // cooperates with Lenis instead of adding a second scroll loop.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = r.top + r.height / 2;
      scrollRef.current = THREE.MathUtils.clamp((vh / 2 - center) / vh, -1, 1);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const dpr = useMemo<[number, number]>(() => (tier === "high" ? [1, 1.5] : [1, 1]), [tier]);
  const starCount = tier === "high" ? 900 : 380;

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto aspect-square w-full max-w-[17.5rem] xs:max-w-[20rem] sm:max-w-lg lg:max-w-2xl"
    >
      <Canvas
        dpr={dpr}
        frameloop={active ? "always" : "never"}
        camera={{ position: [0, 0, 7.4], fov: 40 }}
        gl={{ antialias: tier === "high", alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <HeroLighting />
          <StarField count={starCount} pixelRatio={dpr[1]} />
          <SpaceParticles tier={tier} />
          <CameraDolly scrollRef={scrollRef} />
          <SceneRig scrollRef={scrollRef}>
            <EcosystemCore scrollRef={scrollRef} />
            <Saturn scrollRef={scrollRef} onHover={setLabel} />
            <Moon scrollRef={scrollRef} />
          </SceneRig>
        </Suspense>
      </Canvas>

      {/* soft radial vignette (frames the scene, darkens edges) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 45%, transparent 55%, rgba(5,5,9,0.55) 100%)" }}
      />

      {/* proximity label near Saturn - an integrated eyebrow chip, not a tooltip.
          Click smooth-scrolls to the products/ecosystem section. */}
      <AnimatePresence>
        {label && (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.25 }}
            onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })}
            className="eyebrow eyebrow-glass absolute right-3 top-3 z-10 text-zinc-100 sm:right-5 sm:top-5"
          >
            <span className="mono text-[10px] uppercase tracking-[0.14em]">Explore the XYZ Ecosystem</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
