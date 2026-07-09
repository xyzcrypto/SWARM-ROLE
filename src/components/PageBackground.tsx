import { cn } from "@/lib/utils";

// Layered ambient backdrop for the product/content pages so they get the same
// sense of depth as the home hero instead of a flat wash: drifting mesh blobs +
// a masked grid that fades in at the top + one soft gold glow. All layers are
// pointer-events-none and dark-only (the light-theme remap neutralizes them),
// so content stays crisp and interactions are unaffected.
export function PageBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="mesh" />
      <div className="grid-bg" />
      <div className="glow-orb left-1/2 top-0 h-72 w-72 -translate-x-1/2 bg-gold-600/10" />
    </div>
  );
}
