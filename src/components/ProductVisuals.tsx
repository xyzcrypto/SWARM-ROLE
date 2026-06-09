// Lightweight, CSS-animated mini-visuals for the product cards.
import { Crown } from "lucide-react";

export function TradingVisual() {
  const bars = [0.5, 0.8, 0.45, 0.95, 0.65, 0.85, 0.55, 1];
  return (
    <div className="relative mt-5 h-24 overflow-hidden rounded-2xl border border-line bg-ink-950/60 p-3">
      <div className="flex h-full items-end gap-1.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 origin-bottom rounded-sm bg-gradient-to-t from-sky-500/30 to-sky-400/80"
            style={{
              height: `${h * 100}%`,
              animation: `bar-pulse ${1.6 + (i % 4) * 0.25}s ease-in-out infinite`,
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>
      <div className="absolute right-3 top-2.5 mono text-[10px] text-sky-300">SCANNING…</div>
    </div>
  );
}

export function AirdropVisual() {
  return (
    <div className="relative mt-5 h-24 overflow-hidden rounded-2xl border border-line bg-ink-950/60">
      {/* dropping coins */}
      {[12, 30, 50, 68, 86].map((left, i) => (
        <span
          key={i}
          className="absolute top-0 grid h-4 w-4 place-items-center rounded-full bg-gold-shine text-[8px] font-bold text-ink"
          style={{
            left: `${left}%`,
            animation: `coin-drop ${2.4 + (i % 3) * 0.6}s linear infinite`,
            animationDelay: `${i * 0.5}s`,
          }}
        >
          $
        </span>
      ))}
      {/* basket / progress */}
      <div className="absolute inset-x-3 bottom-3">
        <div className="mb-1 flex justify-between mono text-[9px] text-zinc-500">
          <span>ELIGIBILITY</span>
          <span className="text-gold-200">3 / 5 tasks</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-3/5 rounded-full bg-gold-shine" />
        </div>
      </div>
    </div>
  );
}

export function PremiumVisual() {
  return (
    <div className="relative mt-5 h-24 overflow-hidden rounded-2xl border border-gold-500/20 bg-gradient-to-br from-gold-500/12 to-ink-950/70 p-3">
      {/* pulsing premium glow */}
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gold-500/25 blur-2xl animate-pulse-dot" />
      {/* sheen sweep (gold, stronger) */}
      <div
        className="absolute inset-y-0 -left-1/4 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-gold-200/30 to-transparent blur-md"
        style={{ animation: "sheen 3.2s ease-in-out infinite" }}
      />

      <div className="relative flex items-center justify-between">
        <span className="mono text-[10px] uppercase tracking-wider text-gold-200">Members only</span>
        {/* animated VIP medallion with rotating shine ring */}
        <span className="relative inline-flex h-6 w-6 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, transparent, rgba(243,212,136,0.9), transparent 60%)",
              animation: "badge-orbit 3s linear infinite",
            }}
          />
          <span className="relative grid h-5 w-5 place-items-center rounded-full bg-ink-950 ring-1 ring-gold-500/50">
            <Crown className="h-3 w-3 text-gold-200" strokeWidth={2} />
          </span>
        </span>
      </div>

      <div className="relative mt-3 space-y-1.5">
        {["Early calls", "Private research", "Alpha drops"].map((t, i) => (
          <div key={t} className="flex items-center gap-2 text-[11px] text-zinc-300">
            <span
              className="h-1.5 w-1.5 rounded-full bg-gold-400"
              style={{ animation: `pulse-dot 1.8s ease-in-out ${i * 0.35}s infinite` }}
            />
            {t}
            <span className="ml-auto mono text-[9px] text-gold-300/70">PRO</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AcademyVisual() {
  const rows = [
    { l: "Wallets & security", w: "100%" },
    { l: "DeFi & trading", w: "72%" },
    { l: "On-chain mastery", w: "40%" },
  ];
  return (
    <div className="relative mt-5 h-24 overflow-hidden rounded-2xl border border-line bg-ink-950/60 p-3">
      <div className="flex items-center justify-between mono text-[9px] text-zinc-500">
        <span>COURSE PROGRESS</span>
        <span className="inline-flex items-center gap-1 text-mint-300">
          <span className="h-1.5 w-1.5 rounded-full bg-mint-400 animate-pulse-dot" /> LIVE
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((r, i) => (
          <div key={r.l}>
            <div className="mb-0.5 flex justify-between text-[10px] text-zinc-400">
              <span>{r.l}</span>
              <span className="mono text-mint-300/70">{r.w}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="relative h-full rounded-full" style={{ width: r.w }}>
                {/* fill grows in, then a shimmer keeps sweeping */}
                <div
                  className="h-full origin-left rounded-full bg-mint-shine"
                  style={{ animation: `grow-x 1.1s cubic-bezier(0.22,1,0.36,1) ${i * 0.18}s both` }}
                />
                <div
                  className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  style={{ animation: `sheen ${2.6 + i * 0.4}s ease-in-out ${i * 0.3}s infinite` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MoreVisual() {
  return (
    <div className="relative mt-5 grid h-24 place-items-center overflow-hidden rounded-2xl border border-line bg-ink-950/60">
      <div className="relative">
        <span className="absolute inset-0 rounded-full bg-violet-500/30" style={{ animation: "ping-soft 2.4s ease-out infinite" }} />
        <span className="relative grid h-10 w-10 place-items-center rounded-full bg-violet-500/15 mono text-lg font-bold text-violet-300 ring-1 ring-violet-500/30">
          +
        </span>
      </div>
      <span className="absolute bottom-2 mono text-[9px] text-zinc-600">SHIPPING SOON</span>
    </div>
  );
}
