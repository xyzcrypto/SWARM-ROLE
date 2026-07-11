// A filled paper-plane "send" glyph as inline SVG. We use this instead of the
// lucide <Send/> outline on the green send buttons because a solid white glyph
// is unmistakable on the mint gradient and can never render invisible (the fill
// is hard-set, not inherited via currentColor / a class that might not apply).
export function SendGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true" className={className}>
      <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .65.67 1.1 1.39.91z" />
    </svg>
  );
}
