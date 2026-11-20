"use client";

import { useEffect, useRef } from "react";
import { useReducedMotionSafe } from "@/lib/useClientFlag";

/**
 * Floating blockchain-network particles behind the hero: nodes drift, nearby
 * nodes link, and now and then a "block" pulse travels along a link.
 *
 * Heavy-ish ambient loop, so per the design system it is the one Academy
 * effect gated on prefers-reduced-motion (drawn once, static), and it stops
 * whenever it is off screen or the tab is hidden.
 */
export function NetworkCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotionSafe();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    type Node = { x: number; y: number; vx: number; vy: number; r: number; gold: boolean };
    let nodes: Node[] = [];
    type Pulse = { a: number; b: number; t: number };
    let pulses: Pulse[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(70, Math.max(26, (w * h) / 16000)));
      nodes = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: 1 + Math.random() * 1.6,
        gold: i % 5 === 0,
      }));
    };

    const LINK = 130;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < LINK) {
            ctx.strokeStyle = `rgba(226,167,47,${(1 - d / LINK) * 0.16})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const p of pulses) {
        const a = nodes[p.a];
        const b = nodes[p.b];
        if (!a || !b) continue;
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 6);
        g.addColorStop(0, "rgba(253,247,231,0.95)");
        g.addColorStop(1, "rgba(243,212,136,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const n of nodes) {
        ctx.fillStyle = n.gold ? "rgba(243,212,136,0.85)" : "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = () => {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -10) n.x = w + 10;
        if (n.x > w + 10) n.x = -10;
        if (n.y < -10) n.y = h + 10;
        if (n.y > h + 10) n.y = -10;
      }
      pulses = pulses.map((p) => ({ ...p, t: p.t + 0.02 })).filter((p) => p.t < 1);
      if (pulses.length < 4 && Math.random() < 0.03) {
        const a = Math.floor(Math.random() * nodes.length);
        let best = -1;
        let bd = LINK;
        for (let j = 0; j < nodes.length; j++) {
          if (j === a) continue;
          const d = Math.hypot(nodes[a].x - nodes[j].x, nodes[a].y - nodes[j].y);
          if (d < bd) {
            bd = d;
            best = j;
          }
        }
        if (best >= 0) pulses.push({ a, b: best, t: 0 });
      }
    };

    resize();
    draw();
    if (reduced) return;

    let raf = 0;
    let visible = true;
    const loop = () => {
      if (visible && document.visibilityState === "visible") {
        step();
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, [reduced]);

  return <canvas ref={ref} className={className} aria-hidden />;
}
