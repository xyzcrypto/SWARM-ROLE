"use client";

import { cn } from "@/lib/utils";

// Shared input primitives for the /tools calculators - one look across every
// calculator, mirrors the Field styling already used in LoginForm.tsx.
export function CalcField({
  label,
  value,
  onChange,
  suffix,
  step,
  min,
  hint,
}: {
  label: string;
  value: number | string;
  onChange: (v: string) => void;
  suffix?: string;
  step?: string;
  min?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          step={step ?? "any"}
          min={min}
          className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500">{suffix}</span>
        )}
      </div>
      {hint && <span className="mt-1 block text-[11px] text-zinc-600">{hint}</span>}
    </label>
  );
}

export function CalcSegmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-ink-950/50 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
            value === o.value
              ? "bg-gold-500/15 text-gold-100 ring-1 ring-gold-500/30"
              : "text-zinc-400 hover:text-zinc-100"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ResultTile({
  label,
  value,
  tone = "plain",
  hint,
}: {
  label: string;
  value: string;
  tone?: "plain" | "mint" | "gold" | "rose";
  hint?: string;
}) {
  const num =
    tone === "mint"
      ? "text-mint-gradient"
      : tone === "gold"
        ? "text-gold-gradient"
        : tone === "rose"
          ? "text-rose-400"
          : "text-zinc-50";
  return (
    <div className="surface surface-hover lift rounded-2xl p-6">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={cn("mt-2 mono text-3xl font-semibold", num)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-600">{hint}</p>}
    </div>
  );
}

export function AssumptionBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-200">
      <span aria-hidden className="mt-0.5">⚠</span>
      <p>{children}</p>
    </div>
  );
}
