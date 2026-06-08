"use client";

import { useRef } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}

export function TiltCard({ children, className = "", intensity = 8 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const xRaw = useMotionValue(0);
  const yRaw = useMotionValue(0);

  const rotateX = useSpring(useTransform(yRaw, [-0.5, 0.5], [intensity, -intensity]), {
    stiffness: 260,
    damping: 28,
  });
  const rotateY = useSpring(useTransform(xRaw, [-0.5, 0.5], [-intensity, intensity]), {
    stiffness: 260,
    damping: 28,
  });

  function handleMouse(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    xRaw.set((e.clientX - rect.left) / rect.width - 0.5);
    yRaw.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function reset() {
    xRaw.set(0);
    yRaw.set(0);
  }

  return (
    <motion.div
      ref={ref}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      className={`h-full ${className}`}
    >
      {children}
    </motion.div>
  );
}
