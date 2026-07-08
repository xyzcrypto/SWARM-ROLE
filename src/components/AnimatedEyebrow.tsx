import type { ReactNode } from "react";

// The animated page eyebrow used across product pages (Markets "Live Data",
// Research "Knowledge Hub", Community, ...). Reuses the homepage shimmer:
// a glass pill with a moving gold sweep (.eyebrow-glass), a live mint pulse,
// and the moving-gradient .text-shine label. Presentational + server-safe.
export function AnimatedEyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`eyebrow eyebrow-glass mx-auto ${className}`}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400/80" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
      </span>
      <span className="mono text-shine text-[10px] font-semibold uppercase tracking-[0.16em] sm:text-[11px]">
        {children}
      </span>
    </span>
  );
}
