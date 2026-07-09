import { cn } from "@/lib/utils";

// Layered ambient backdrop for the product/content pages so they get the same
// sense of depth as the home hero instead of a flat wash: drifting mesh blobs +
// a masked grid that fades in at the top + a dual-tone glow (gold top, mint
// bottom, echoing the brand pair) + a fine grain texture for a tactile finish.
// All layers are pointer-events-none; mesh/glow shrink their blur on mobile
// (see globals.css) to keep scroll smooth on weaker GPUs. Dark-only (the
// light-theme remap neutralizes mesh/particles), so content stays crisp.
export function PageBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="mesh" />
      <div className="grid-bg" />
      <div className="glow-orb left-1/2 top-0 h-72 w-72 -translate-x-1/2 bg-gold-600/10" />
      <div className="glow-orb -bottom-24 right-[8%] h-64 w-64 bg-mint-600/[0.08]" />
      <div className="grain" />
    </div>
  );
}
