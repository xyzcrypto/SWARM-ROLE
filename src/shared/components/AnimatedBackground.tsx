// Pure-CSS animated background: drifting mesh handled by `.mesh`, plus an
// aurora ribbon and deterministic floating particles. No client JS needed.

const particles = [
  { left: "8%", top: "20%", size: 6, dur: "8s" },
  { left: "18%", top: "70%", size: 4, dur: "11s" },
  { left: "32%", top: "35%", size: 5, dur: "9s" },
  { left: "47%", top: "12%", size: 3, dur: "13s" },
  { left: "61%", top: "60%", size: 6, dur: "10s" },
  { left: "73%", top: "28%", size: 4, dur: "12s" },
  { left: "86%", top: "48%", size: 5, dur: "9s" },
  { left: "92%", top: "75%", size: 3, dur: "14s" },
  { left: "40%", top: "82%", size: 4, dur: "11s" },
  { left: "55%", top: "40%", size: 3, dur: "15s" },
];

export function AnimatedBackground({ aurora = true }: { aurora?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="mesh" />
      {aurora && <div className="aurora" />}
      <div className="grid-bg" />
      {particles.map((p, i) => (
        <span
          key={i}
          className="particle"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            // @ts-expect-error css var
            "--dur": p.dur,
            animationDelay: `${i * 0.7}s`,
          }}
        />
      ))}
      <div className="grain" />
    </div>
  );
}
