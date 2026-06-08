// Lightweight, CSS-animated mini-visuals for the product cards.

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
    <div className="relative mt-5 h-24 overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-gold-500/10 to-ink-950/60 p-3">
      {/* sheen sweep */}
      <div
        className="absolute inset-y-0 left-0 w-1/3 skew-x-12 bg-white/10 blur-md"
        style={{ animation: "sheen 4s ease-in-out infinite" }}
      />
      <div className="relative flex items-center justify-between">
        <span className="mono text-[10px] uppercase tracking-wider text-gold-200">Members only</span>
        <span className="rounded-full bg-gold-500/20 px-2 py-0.5 mono text-[9px] text-gold-100 ring-1 ring-gold-500/40">VIP</span>
      </div>
      <div className="relative mt-3 space-y-1.5">
        {["Early calls", "Private research", "Alpha drops"].map((t) => (
          <div key={t} className="flex items-center gap-2 text-[11px] text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AcademyVisual() {
  return (
    <div className="relative mt-5 h-24 overflow-hidden rounded-2xl border border-line bg-ink-950/60 p-3">
      <div className="flex items-center justify-between mono text-[9px] text-zinc-500">
        <span>COURSE PROGRESS</span>
        <span className="text-mint-300">LIVE</span>
      </div>
      <div className="mt-3 space-y-2">
        {[
          { l: "Wallets & security", w: "100%" },
          { l: "DeFi & trading", w: "72%" },
          { l: "On-chain mastery", w: "40%" },
        ].map((r) => (
          <div key={r.l}>
            <div className="mb-0.5 flex justify-between text-[10px] text-zinc-400">
              <span>{r.l}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-mint-shine" style={{ width: r.w }} />
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
