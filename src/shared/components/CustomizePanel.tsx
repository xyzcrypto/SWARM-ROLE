"use client";

import { Gauge, Moon, RotateCcw, Sun, Type, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { resetSitePrefs, setSitePrefs, useSitePrefs, type Motion, type Scale } from "@shared/utils/site-prefs";
import { setFeel, DEFAULT_FEEL } from "@shared/utils/chat-feel";
import { hapticToggle } from "@shared/utils/haptics";
import { ChatFeelSections } from "@modules/community/components/ChatFeelSections";

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return <h3 id={id} className="mono text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">{children}</h3>;
}

function Seg<T extends string | number>({ id, value, options, onChange }: { id: string; value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="mt-2.5 grid gap-1 rounded-2xl border border-hairline bg-black/[0.04] p-1 dark:bg-white/[0.03]" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-labelledby={id}>
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => { hapticToggle(); onChange(v); }}
          className={cn("min-h-10 rounded-xl px-2 text-[12px] font-semibold transition-colors duration-150", value === v ? "bg-gold-500/15 text-gold-100 ring-1 ring-gold-500/40" : "text-content-muted hover:text-content")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Switch({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-content">{label}</span>
        <span className="block text-[11px] leading-relaxed text-content-subtle">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => { hapticToggle(); onChange(!on); }}
        className={cn("relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200", on ? "border-gold-400/60 bg-gold-500/80" : "border-hairline bg-zinc-500/30")}
      >
        <span className={cn("absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200", on ? "translate-x-[1.375rem]" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

/**
 * Customize website: theme, text size, animations, background effects, glass
 * blur, a one-tap performance mode, and the haptics / sounds / chat style
 * controls. Everything is per device and applies instantly.
 */
export function CustomizePanel() {
  const p = useSitePrefs();
  const perfMode = p.motion === "lite" && !p.effects && !p.blur;

  return (
    <div>
      <section aria-labelledby="cz-look">
        <H id="cz-look">Appearance</H>
        <Seg<"dark" | "light"> id="cz-look" value={p.theme} onChange={(theme) => setSitePrefs({ theme })} options={[["dark", "Dark"], ["light", "Light"]]} />
        <div className="mt-4">
          <H id="cz-scale">Text size</H>
          <Seg<Scale> id="cz-scale" value={p.scale} onChange={(scale) => setSitePrefs({ scale })} options={[[90, "Small"], [100, "Default"], [110, "Large"], [125, "Extra large"]]} />
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-content-subtle"><Type className="h-3 w-3" /> Scales text across the whole website.</p>
        </div>
      </section>

      <section className="mt-7" aria-labelledby="cz-motion">
        <div className="flex items-center justify-between gap-3">
          <H id="cz-motion">Motion &amp; performance</H>
          <button
            type="button"
            onClick={() => { hapticToggle(); setSitePrefs(perfMode ? { motion: "auto", effects: true, blur: true } : { motion: "lite", effects: false, blur: false }); }}
            aria-pressed={perfMode}
            className={cn("inline-flex min-h-8 items-center gap-1 rounded-full px-3 text-[11px] font-semibold ring-1 transition-colors", perfMode ? "bg-mint-500/15 text-mint-200 ring-mint-500/40" : "text-gold-300 ring-gold-500/30 hover:bg-gold-500/10")}
          >
            <Gauge className="h-3.5 w-3.5" /> {perfMode ? "Performance mode on" : "Performance mode"}
          </button>
        </div>
        <Seg<Motion> id="cz-motion" value={p.motion} onChange={(motion) => setSitePrefs({ motion })} options={[["auto", "Auto"], ["full", "Full"], ["lite", "Lite"], ["off", "Off"]]} />
        <p className="mt-1.5 text-[11px] leading-relaxed text-content-subtle">
          {p.motion === "auto" && "Picks the best level for this device."}
          {p.motion === "full" && "Every animation, on any device."}
          {p.motion === "lite" && "Fewer, lighter animations - smoother on slower phones."}
          {p.motion === "off" && "No animations at all. Everything appears instantly."}
        </p>
        <div className="mt-2 divide-y divide-hairline">
          <Switch label="Background effects" hint="The animated starfield and glow behind pages." on={p.effects} onChange={(effects) => setSitePrefs({ effects })} />
          <Switch label="Glass blur" hint="Frosted-glass cards. Off is faster on older phones." on={p.blur} onChange={(blur) => setSitePrefs({ blur })} />
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-content-subtle">
          <Zap className="mt-0.5 h-3 w-3 shrink-0" /> If the site ever feels slow on your phone, turn on Performance mode.
        </p>
      </section>

      <div className="mt-7 border-t border-hairline pt-1">
        <p className="mt-4 font-display text-[15px] font-bold tracking-tight text-content">Haptics, sounds &amp; chat</p>
      </div>
      <ChatFeelSections />

      <div className="mt-7 flex items-center justify-between gap-3 border-t border-hairline pt-4">
        <span className="flex items-center gap-1.5 text-[11px] text-content-subtle">
          {p.theme === "dark" ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />} Saved on this device.
        </span>
        <button
          type="button"
          onClick={() => { hapticToggle(); resetSitePrefs(); setFeel({ ...DEFAULT_FEEL }); }}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-hairline px-3 text-[12px] font-semibold text-content-muted transition-colors hover:border-gold-500/30 hover:text-content"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset to default
        </button>
      </div>
    </div>
  );
}
