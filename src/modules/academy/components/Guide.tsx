"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Headphones, Mic, MicOff, Music, Pause, Play, RotateCcw, Settings2, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechInput } from "@shared/hooks/useSpeechInput";
import {
  browserVoices,
  femaleScore,
  pauseVoice,
  resumeVoice,
  say,
  setScene,
  sfx,
  speak,
  stopVoice,
  unlock,
  updateSettings,
  voiceLevel,
  voiceProgress,
  type AudioSettings,
} from "../client/audio";
import { useAudio } from "../client/hooks";
import { dispatchCommand, parseCommand } from "../client/commands";
import { VOICE_LINES } from "../client/voice-lines";

/**
 * Nova's orb: layered light, a slow conic ring and a waveform that follows her
 * voice. The level is written to a CSS variable from requestAnimationFrame, so
 * React never re-renders per frame.
 */
export function GuideOrb({ size = 220, className, speaking }: { size?: number; className?: string; speaking: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!speaking) {
      ref.current?.style.setProperty("--lvl", "0");
      return;
    }
    let raf = 0;
    let smooth = 0;
    const tick = (t: number) => {
      smooth += (voiceLevel(t) - smooth) * 0.25;
      ref.current?.style.setProperty("--lvl", smooth.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);
  const bars = 28;
  return (
    <div ref={ref} className={cn("acad-orb relative", speaking && "is-speaking", className)} style={{ width: size, height: size }} aria-hidden>
      <div className="acad-orb-halo" />
      <div className="acad-orb-ring" />
      <div className="acad-orb-core">
        <div className="acad-orb-swirl" />
        <div className="acad-orb-glint" />
      </div>
      <div className="acad-orb-wave">
        {Array.from({ length: bars }, (_, i) => (
          <span key={i} style={{ transform: `rotate(${(360 / bars) * i}deg)`, ["--i" as string]: String(i % 7) }} />
        ))}
      </div>
    </div>
  );
}

function Toggle({ on, onChange, label, icon }: { on: boolean; onChange: (v: boolean) => void; label: string; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        unlock();
        onChange(!on);
        sfx("click");
      }}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-2 text-left text-sm text-content"
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-gold-400" : "bg-white/15")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-ink-950 transition-all", on ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

function Slider({ value, onChange, label, disabled }: { value: number; onChange: (v: number) => void; label: string; disabled?: boolean }) {
  return (
    <label className={cn("block px-1 pb-2", disabled && "opacity-40")}>
      <span className="sr-only">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="acad-range w-full"
        aria-label={label}
      />
    </label>
  );
}

/** Sound + voice settings. Persisted per browser by the audio store. */
export function SoundSettings({ onClose }: { onClose?: () => void }) {
  const { settings: s } = useAudio();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const load = () => setVoices([...browserVoices()].sort((a, b) => femaleScore(b) - femaleScore(a)).filter((v) => femaleScore(v) >= 0).slice(0, 12));
    load();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.removeEventListener?.("voiceschanged", load);
    };
  }, []);
  const set = (p: Partial<AudioSettings>) => updateSettings(p);
  return (
    <div className="space-y-1">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-display text-sm font-semibold text-content">Sound & voice</div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-content-subtle hover:text-content" aria-label="Close settings">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <Toggle on={s.master} onChange={(v) => set({ master: v })} label="All sound" icon={s.master ? <Volume2 className="h-4 w-4 text-gold-300" /> : <VolumeX className="h-4 w-4 text-content-subtle" />} />
      <Slider value={s.masterVol} onChange={(v) => set({ masterVol: v })} label="Master volume" disabled={!s.master} />
      <Toggle on={s.voice} onChange={(v) => set({ voice: v })} label="Nova's voice" icon={<Headphones className="h-4 w-4 text-content-subtle" />} />
      <Slider value={s.voiceVol} onChange={(v) => set({ voiceVol: v })} label="Voice volume" disabled={!s.master || !s.voice} />
      <Toggle on={s.sfx} onChange={(v) => set({ sfx: v })} label="Sound effects" icon={<Sparkles className="h-4 w-4 text-content-subtle" />} />
      <Slider value={s.sfxVol} onChange={(v) => set({ sfxVol: v })} label="Effects volume" disabled={!s.master || !s.sfx} />
      <Toggle on={s.music} onChange={(v) => set({ music: v })} label="Background music" icon={<Music className="h-4 w-4 text-content-subtle" />} />
      <Slider value={s.musicVol} onChange={(v) => set({ musicVol: v })} label="Music volume" disabled={!s.master || !s.music} />
      <div className={cn("grid grid-cols-4 gap-1 px-1 pb-2", (!s.master || !s.music) && "opacity-40")} role="radiogroup" aria-label="Music track">
        {(
          [
            ["auto", "Auto"],
            ["focus", "Focus"],
            ["arena", "Arena"],
            ["night", "Night"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={s.track === id}
            disabled={!s.master || !s.music}
            onClick={() => {
              unlock();
              set({ track: id });
              sfx("click");
            }}
            className={cn("rounded-lg border py-1.5 text-[11px] font-semibold", s.track === id ? "border-gold-400/60 bg-gold-400/10 text-gold-100" : "border-hairline text-content-muted")}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="border-t border-hairline pt-2">
        <Toggle on={s.guide} onChange={(v) => set({ guide: v })} label="Nova reacts on her own" />
        <Toggle on={s.readQuestions} onChange={(v) => set({ readQuestions: v })} label="Read each question aloud" />
        <Toggle on={s.explainWrong} onChange={(v) => set({ explainWrong: v })} label="Explain wrong answers aloud" />
        <label className="mt-1 block px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-content-subtle">
          Voice
          <select
            value={s.voiceName}
            onChange={(e) => {
              set({ voiceName: e.target.value });
              unlock();
              if (e.target.value === "nova") say("welcome");
              else speak("Hi, I'm Nova. This is how I'll sound.");
            }}
            className="mt-1 w-full rounded-xl border border-hairline bg-ink-900/80 px-3 py-2 text-sm normal-case tracking-normal text-content focus:border-gold-400/50 focus:outline-none"
          >
            <option value="nova">Nova (natural, recommended)</option>
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <p className="px-1 pt-2 text-[11px] leading-relaxed text-content-subtle">
          Nova speaks in a natural recorded voice: her guidance, every question, option and explanation, and lesson summaries. Anything new an admin writes is read by your device&apos;s best female voice. Every line is also shown as text. Auto music plays Focus while you read and Arena while you play.
        </p>
      </div>
    </div>
  );
}

/**
 * The floating guide: Nova's caption, playback controls, voice commands and
 * the sound settings, on every Academy page. Hidden entirely when the member
 * turns the guide and her voice off.
 */
export function GuideDock() {
  const router = useRouter();
  const { settings, voice } = useAudio();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"guide" | "settings">("guide");
  const [heard, setHeard] = useState<string | null>(null);
  const path = usePathname();
  // On a phone at the top of /academy the hero already shows Nova's big orb,
  // and the dock would sit on the hero's buttons. Hide it there until the
  // reader scrolls. Starts visible (matches the server), decided after mount.
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    if (path !== "/academy") {
      setTucked(false);
      return;
    }
    const on = () => setTucked(window.innerWidth < 768 && window.scrollY < 520);
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [path]);

  const mic = useSpeechInput(
    (text) => {
      setHeard(text);
      const p = parseCommand(text);
      if (!p) return;
      if (p.cmd === "leaderboard") router.push("/academy/leaderboard");
      else if (p.cmd === "live") router.push("/academy/live");
      else if (p.cmd === "learn") router.push("/academy#library");
      else if (p.cmd === "mute") updateSettings({ master: false });
      else if (p.cmd === "unmute") updateSettings({ master: true });
      else if (p.cmd === "pause") pauseVoice();
      else if (p.cmd === "resume") resumeVoice();
      else if (p.cmd === "stop") stopVoice();
      else if (p.cmd === "help") say("help");
      else if (p.cmd === "start" && !window.location.pathname.startsWith("/academy/quiz")) router.push("/academy/quiz");
      dispatchCommand(p);
    },
    { continuous: false }
  );

  // Any first tap on an Academy page unlocks audio (browsers require a gesture).
  useEffect(() => {
    const on = () => unlock();
    window.addEventListener("pointerdown", on, { once: true });
    window.addEventListener("keydown", on, { once: true });
    return () => {
      window.removeEventListener("pointerdown", on);
      window.removeEventListener("keydown", on);
    };
  }, []);

  // Auto music: Arena while playing, Focus everywhere else.
  useEffect(() => {
    setScene(path?.startsWith("/academy/quiz") || path?.startsWith("/academy/live/") ? "arena" : "focus");
  }, [path]);

  const replay = () => {
    unlock();
    if (voice.line) say(voice.line);
    else if (voice.text) speak(voice.text);
    else say("welcome");
  };

  return (
    // The site-wide XYZ AI button owns the bottom-right corner. On phones Nova
    // takes the bottom-left (stacking two buttons on the right covered the
    // hero CTAs); from md up she sits directly above the AI button.
    <div className={cn("pointer-events-none fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 z-40 transition-all duration-300 md:bottom-[5.5rem] md:left-auto md:right-6", tucked && !open && "invisible translate-y-4 opacity-0")}>
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto mb-3 max-h-[calc(100dvh-12rem)] w-[min(22rem,calc(100vw-2rem))] origin-bottom-left overflow-y-auto overscroll-contain rounded-3xl border border-hairline bg-ink-950/95 p-4 shadow-elevate backdrop-blur-xl md:max-h-[calc(100dvh-14rem)] md:origin-bottom-right"
            role="dialog"
            aria-label="Nova, your Academy guide"
          >
            {panel === "settings" ? (
              <SoundSettings onClose={() => setPanel("guide")} />
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <GuideOrb size={48} speaking={voice.speaking && !voice.paused} />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-sm font-semibold text-content">Nova</div>
                    <div className="text-[11px] text-content-subtle">{voice.speaking ? (voice.paused ? "Paused" : "Speaking") : "Your Academy guide"}</div>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 text-content-subtle hover:text-content" aria-label="Close guide">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 rounded-2xl border border-hairline bg-ink-900/50 px-3.5 py-3">
                  <NovaWave speaking={voice.speaking && !voice.paused} bars={36} className="mb-2 h-6" />
                  <NovaCaption text={voice.text || VOICE_LINES.welcome} speaking={voice.speaking && !voice.paused} className="min-h-[2.5rem] text-sm leading-relaxed" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {voice.speaking && !voice.paused ? (
                    <button type="button" onClick={pauseVoice} className="btn-secondary h-9 flex-1 justify-center text-xs" aria-label="Pause voice">
                      <Pause className="h-4 w-4" /> Pause
                    </button>
                  ) : voice.paused ? (
                    <button type="button" onClick={resumeVoice} className="btn-secondary h-9 flex-1 justify-center text-xs" aria-label="Resume voice">
                      <Play className="h-4 w-4" /> Resume
                    </button>
                  ) : (
                    <button type="button" onClick={replay} className="btn-secondary h-9 flex-1 justify-center text-xs" aria-label="Replay">
                      <RotateCcw className="h-4 w-4" /> Replay
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      unlock();
                      updateSettings({ master: !settings.master });
                    }}
                    className="acad-icon-btn"
                    aria-label={settings.master ? "Mute all sound" : "Unmute"}
                    title={settings.master ? "Mute" : "Unmute"}
                  >
                    {settings.master ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </button>
                  {mic.supported && (
                    <button
                      type="button"
                      onClick={() => {
                        unlock();
                        setHeard(null);
                        if (!mic.listening) say("mic_on");
                        mic.toggle();
                      }}
                      className={cn("acad-icon-btn", mic.listening && "border-gold-400/60 text-gold-200")}
                      aria-label={mic.listening ? "Stop listening" : "Voice command"}
                      title="Voice command"
                    >
                      {mic.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  )}
                  <button type="button" onClick={() => setPanel("settings")} className="acad-icon-btn" aria-label="Sound settings" title="Settings">
                    <Settings2 className="h-4 w-4" />
                  </button>
                </div>
                {(mic.listening || heard || mic.error) && (
                  <div className="mt-2 rounded-xl bg-white/[0.04] px-3 py-2 text-[11px] text-content-subtle">
                    {mic.error
                      ? mic.error
                      : mic.listening
                        ? mic.interim || "Listening… try “start quiz”, “next question”, “repeat question”, “explain answer” or “open leaderboard”."
                        : parseCommand(heard ?? "")
                          ? `Heard: “${heard}”`
                          : `Heard “${heard}”, which isn't a command I know yet.`}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex md:justify-end">
        <button
          type="button"
          onClick={() => {
            unlock();
            setPanel("guide");
            setOpen((o) => !o);
            sfx("click");
          }}
          className="acad-dock-btn pointer-events-auto relative grid h-12 w-12 place-items-center rounded-full md:h-14 md:w-14"
          aria-label={open ? "Close Nova" : "Open Nova, your Academy guide"}
          aria-expanded={open}
        >
          <GuideOrb size={44} speaking={voice.speaking && !voice.paused} className="md:!h-[52px] md:!w-[52px]" />
          {voice.speaking && !open && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-ink-950 bg-mint-400" />}
        </button>
      </div>
    </div>
  );
}


/**
 * Nova's caption, revealed word by word in step with her voice (recorded clip
 * time, or the browser voice's word boundaries). Static text when she is
 * silent, so it reads the same with sound off.
 */
export function NovaCaption({ text, speaking, className }: { text: string; speaking: boolean; className?: string }) {
  const [p, setP] = useState(1);
  useEffect(() => {
    if (!speaking) {
      setP(1);
      return;
    }
    let raf = 0;
    const tick = () => {
      setP(voiceProgress());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking, text]);
  const words = text.split(/(\s+)/);
  const total = words.filter((w) => w.trim()).length || 1;
  let n = 0;
  return (
    <p className={className} aria-live="polite">
      {words.map((w, i) => {
        if (!w.trim()) return w;
        n++;
        const on = !speaking || n / total <= p + 0.04;
        return (
          <span key={i} className={cn("transition-colors duration-200", on ? "text-content" : "text-content-subtle/60")}>
            {w}
          </span>
        );
      })}
    </p>
  );
}

/** A slim live waveform: bars follow Nova's actual loudness while she talks, rest flat. */
export function NovaWave({ speaking, bars = 32, className }: { speaking: boolean; bars?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.children) as HTMLElement[];
    if (!speaking) {
      spans.forEach((sp) => (sp.style.transform = "scaleY(0.12)"));
      return;
    }
    let raf = 0;
    const tick = (t: number) => {
      const lvl = voiceLevel(t);
      spans.forEach((sp, i) => {
        const wobble = 0.55 + 0.45 * Math.abs(Math.sin(t / (90 + i * 7) + i));
        sp.style.transform = `scaleY(${Math.max(0.12, Math.min(1, lvl * wobble * 1.6))})`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);
  return (
    <div ref={ref} className={cn("flex h-8 items-center gap-[3px]", className)} aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className="h-full w-[3px] origin-center rounded-full bg-gradient-to-t from-gold-500 to-gold-200 transition-transform duration-75" style={{ transform: "scaleY(0.12)" }} />
      ))}
    </div>
  );
}
