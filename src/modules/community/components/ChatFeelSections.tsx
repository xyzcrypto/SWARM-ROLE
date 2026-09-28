"use client";

import { Check, Vibrate, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACCENTS,
  setFeel,
  useChatFeel,
  type ChatAccent,
  type ChatDensity,
  type ChatText,
  type HapticLevel,
  type SoundLevel,
} from "@shared/utils/chat-feel";
import { hapticPreview, hapticsSupported } from "@shared/utils/haptics";
import { playSfx, unlockAudio } from "@shared/utils/sfx";
import { useClientFlag } from "@/lib/useClientFlag";

/** Swatch colours, matching the CSS in globals.css (`data-accent`). */
const SWATCH: Record<ChatAccent, string> = {
  auto: "conic-gradient(from 200deg, #d18f1b 0 50%, #0bbb7c 50% 100%)",
  gold: "#d18f1b",
  mint: "#0bbb7c",
  sky: "#38bdf8",
  violet: "#a78bfa",
  rose: "#fb7185",
  mono: "#a1a1aa",
};
const ACCENT_LABEL: Record<ChatAccent, string> = { auto: "Classic", gold: "Gold", mint: "Mint", sky: "Sky", violet: "Violet", rose: "Rose", mono: "Mono" };

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="mono text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">
      {children}
    </h3>
  );
}

function Segmented<T extends string>({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mt-2.5 grid gap-1 rounded-2xl border border-hairline bg-black/[0.04] p-1 dark:bg-white/[0.03]" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-labelledby={id}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "min-h-10 rounded-xl px-2 text-[12px] font-semibold transition-colors duration-150",
            value === v ? "bg-gold-500/15 text-gold-100 ring-1 ring-gold-500/40" : "text-content-muted hover:text-content"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Accent, text size, spacing, haptics and sounds - the "customise" half of the
 * Chat appearance sheet. Everything here is per device and applies to the
 * room and to DMs alike (chat-feel.ts). Each change gives immediate feedback:
 * the preview above re-renders, a haptic choice buzzes at its new strength,
 * a sound choice plays.
 */
export function ChatFeelSections() {
  const feel = useChatFeel();
  const canVibrate = useClientFlag(hapticsSupported);

  return (
    <>
      <section className="mt-6" aria-labelledby="feel-accent">
        <Heading id="feel-accent">Accent colour</Heading>
        <p className="mt-1 text-[11px] text-content-subtle">Your messages, in the room and in DMs.</p>
        <div className="mt-2.5 grid grid-cols-4 gap-2 sm:grid-cols-7" role="radiogroup" aria-labelledby="feel-accent">
          {ACCENTS.map((a) => {
            const on = feel.accent === a;
            return (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={ACCENT_LABEL[a]}
                onClick={() => setFeel({ accent: a })}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-all duration-200 active:scale-95",
                  on ? "border-gold-500/50 bg-gold-500/[0.07]" : "border-hairline hover:border-gold-500/25"
                )}
              >
                <span className="relative grid h-8 w-8 place-items-center rounded-full ring-2 ring-white/10" style={{ background: SWATCH[a] }}>
                  {on && <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />}
                </span>
                <span className={cn("text-[10px] font-medium", on ? "text-gold-200" : "text-content-muted")}>{ACCENT_LABEL[a]}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="feel-text">
        <Heading id="feel-text">Text size</Heading>
        <Segmented<ChatText> id="feel-text" value={feel.text} onChange={(text) => setFeel({ text })} options={[["s", "Small"], ["m", "Default"], ["l", "Large"]]} />
      </section>

      <section className="mt-6" aria-labelledby="feel-density">
        <Heading id="feel-density">Spacing</Heading>
        <Segmented<ChatDensity> id="feel-density" value={feel.density} onChange={(density) => setFeel({ density })} options={[["comfy", "Comfortable"], ["compact", "Compact"]]} />
      </section>

      <section className="mt-6" aria-labelledby="feel-haptics">
        <div className="flex items-center justify-between gap-3">
          <Heading id="feel-haptics">Haptics</Heading>
          <button
            type="button"
            onClick={() => hapticPreview("sent")}
            disabled={feel.haptics === "off" || !canVibrate}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-gold-300 transition-colors hover:bg-gold-500/10 disabled:opacity-40"
          >
            <Vibrate className="h-3.5 w-3.5" /> Test
          </button>
        </div>
        <Segmented<HapticLevel>
          id="feel-haptics"
          value={feel.haptics}
          onChange={(haptics) => {
            setFeel({ haptics, hapticsChosen: true });
            if (haptics !== "off") hapticPreview("toggle");
          }}
          options={[["off", "Off"], ["standard", "Standard"], ["strong", "Strong"]]}
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-content-subtle">
          {canVibrate
            ? "A tick on every tap, a double tick when a message sends."
            : "This device or browser can't vibrate from a web page (iPhone never can)."}
        </p>
      </section>

      <section className="mt-6" aria-labelledby="feel-sound">
        <div className="flex items-center justify-between gap-3">
          <Heading id="feel-sound">Sounds</Heading>
          <button
            type="button"
            onClick={() => { unlockAudio(); playSfx("receive", { force: true }); }}
            disabled={feel.sound === "off"}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-gold-300 transition-colors hover:bg-gold-500/10 disabled:opacity-40"
          >
            <Volume2 className="h-3.5 w-3.5" /> Test
          </button>
        </div>
        <Segmented<SoundLevel>
          id="feel-sound"
          value={feel.sound}
          onChange={(sound) => {
            setFeel({ sound });
            unlockAudio();
            if (sound !== "off") playSfx("send", { force: true });
          }}
          options={[["off", "Off"], ["messages", "Messages"], ["all", "Everything"]]}
        />
        <label className="mt-3 flex items-center gap-3">
          <span className="w-14 shrink-0 text-[11px] font-semibold text-content-muted">Volume</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(feel.volume * 100)}
            disabled={feel.sound === "off"}
            onChange={(e) => setFeel({ volume: Number(e.target.value) / 100 })}
            onPointerUp={() => playSfx("receive", { force: true })}
            aria-label="Sound volume"
            className="h-2 w-full cursor-pointer accent-gold-400 disabled:opacity-40"
          />
          <span className="mono w-9 shrink-0 text-right text-[11px] text-content-subtle">{Math.round(feel.volume * 100)}%</span>
        </label>
        <p className="mt-1.5 text-[11px] leading-relaxed text-content-subtle">
          Messages: sent, received, reactions. Everything: also a soft click on every button.
        </p>
      </section>
    </>
  );
}
