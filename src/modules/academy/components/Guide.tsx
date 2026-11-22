"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, AudioLines, Headphones, Music, Pause, PhoneOff, Play, RotateCcw, Settings2, Sparkles, Vibrate, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  browserVoices,
  enterAudioScope,
  femaleScore,
  getSnapshot,
  play,
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
import { GreetBubble } from "./GreetBubble";
import { HINGLISH_READY } from "../client/hinglish-ready";
import { dispatchCommand, parseCommand } from "../client/commands";
import { VOICE_LINES, type VoiceLine } from "../client/voice-lines";
import { askAneque, recordUtterance, releaseMic, talkSupported, transcribe, type TalkError, type Turn } from "../client/talk";

/**
 * AneQue's orb: layered light, a slow conic ring and a waveform that follows her
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
      <Toggle on={s.voice} onChange={(v) => set({ voice: v })} label="AneQue's voice" icon={<Headphones className="h-4 w-4 text-content-subtle" />} />
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
        <Toggle on={s.guide} onChange={(v) => set({ guide: v })} label="AneQue reacts on her own" />
        <Toggle on={s.readQuestions} onChange={(v) => set({ readQuestions: v })} label="Read each question aloud" />
        <Toggle on={s.explainWrong} onChange={(v) => set({ explainWrong: v })} label="Explain wrong answers aloud" />
        <Toggle on={s.explainRight} onChange={(v) => set({ explainRight: v })} label="Explain right answers too" />
        {HINGLISH_READY && <Toggle on={s.lang === "hi"} onChange={(v) => set({ lang: v ? "hi" : "en" })} label="Hinglish (lessons, quizzes, AneQue)" />}
        <Toggle on={s.haptics} onChange={(v) => set({ haptics: v })} label="Haptics (vibration)" icon={<Vibrate className="h-4 w-4 text-content-subtle" />} />
        <label className="mt-1 block px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-content-subtle">
          Voice
          <select
            value={s.voiceName}
            onChange={(e) => {
              set({ voiceName: e.target.value });
              unlock();
              if (e.target.value === "nova") say("intro");
              else speak("Hi, I'm Aneq. This is how I'll sound.");
            }}
            className="mt-1 w-full rounded-xl border border-hairline bg-ink-900/80 px-3 py-2 text-sm normal-case tracking-normal text-content focus:border-gold-400/50 focus:outline-none"
          >
            <option value="nova">AneQue (natural, recommended)</option>
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <p className="px-1 pt-2 text-[11px] leading-relaxed text-content-subtle">
          AneQue speaks in a natural recorded voice: her guidance, every question, option and explanation, and lesson summaries. Anything new an admin writes is read by your device&apos;s best female voice. Every line is also shown as text. Auto music plays Focus while you read and Arena while you play.
        </p>
      </div>
    </div>
  );
}

type TalkState = "idle" | "listening" | "transcribing" | "thinking" | "speaking";

/** Wait until AneQue has finished talking (or `maxMs`). */
function untilQuiet(maxMs = 60_000) {
  return new Promise<void>((resolve) => {
    const t0 = Date.now();
    const id = setInterval(() => {
      if (!getSnapshot().voice.speaking || Date.now() - t0 > maxMs) {
        clearInterval(id);
        resolve();
      }
    }, 150);
  });
}

/**
 * Live Talk: listen (record + server transcription), act on a command or ask
 * the AI, speak the answer, listen again, until the learner stops it.
 */
/** Retry once, after a short pause, when the failure looks transient. */
async function retryOnce<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const st = (e as TalkError).status;
    if (st === 0 || st === 502 || st === 504 || st === 429) {
      await new Promise((r) => setTimeout(r, st === 429 ? 1500 : 700));
      return fn();
    }
    throw e;
  }
}

/** Phrases speech-to-text produces from silence or room noise. Pure, for tests. */
export function isSilenceHallucination(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[.!?,]+$/g, "");
  return !t || /^(thank you|thanks|thanks for watching|thank you for watching|you|bye|hmm|uh|um|subtitles by.*|\.+)$/.test(t);
}

function useLiveTalk(router: ReturnType<typeof useRouter>) {
  const [state, setState] = useState<TalkState>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const history = useRef<Turn[]>([]);

  const stop = useCallback(() => {
    active.current = false;
    releaseMic();
    setState("idle");
    setLevel(0);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const handle = useCallback(
    async (text: string): Promise<boolean> => {
      const p = parseCommand(text);
      if (p && p.cmd !== "explain" && p.cmd !== "answer") {
        const nav: Partial<Record<string, [string, VoiceLine]>> = {
          leaderboard: ["/academy/leaderboard", "open_leaderboard"],
          live: ["/academy/live", "open_live"],
          learn: ["/academy/learn", "open_learn"],
        };
        const n = nav[p.cmd];
        if (n) {
          router.push(n[0]);
          say(n[1]);
          return true;
        }
        if (p.cmd === "start" && !location.pathname.startsWith("/academy/quiz")) {
          router.push("/academy/quiz");
          say("open_quiz");
          return true;
        }
        if (p.cmd === "help") {
          say("help");
          return true;
        }
        if (p.cmd === "mute" || p.cmd === "stop") {
          say("talk_bye");
          stop();
          return true;
        }
        dispatchCommand(p);
        return true;
      }
      if (p?.cmd === "answer") {
        dispatchCommand(p);
        return true;
      }
      return false;
    },
    [router, stop]
  );

  const loop = useCallback(async () => {
    let misses = 0;
    while (active.current) {
      setState("listening");
      sfx("pop");
      let rec;
      try {
        rec = await recordUtterance({ onLevel: setLevel });
      } catch {
        setError("Microphone permission is blocked. Allow the mic for this site in your browser's address bar, then tap Talk again.");
        stop();
        return;
      }
      if (!active.current) return;
      if (!rec) {
        misses++;
        if (misses >= 2) {
          say("talk_bye");
          stop();
          return;
        }
        say("talk_again");
        await untilQuiet(8000);
        continue;
      }
      misses = 0;
      setState("transcribing");
      let text = "";
      try {
        // One quiet retry on a network blip before telling the learner.
        text = (await retryOnce(() => transcribe(rec.blob))).text.trim();
        // Whisper invents these on near-silence; treat them as "didn't catch that".
        if (isSilenceHallucination(text)) text = "";
      } catch (e) {
        const st = (e as TalkError).status;
        if (st === 401) say("talk_login");
        else if (st === 503) say("talk_unavailable");
        else say("talk_error");
        if (st === 401 || st === 503) {
          stop();
          return;
        }
        await untilQuiet(8000);
        continue;
      }
      if (!active.current) return;
      if (!text) {
        say("talk_again");
        await untilQuiet(8000);
        continue;
      }
      setTurns((t) => [...t, { role: "user" as const, content: text }].slice(-6));
      if (await handle(text)) {
        await untilQuiet(10_000);
        continue;
      }
      setState("thinking");
      history.current = [...history.current, { role: "user" as const, content: text }].slice(-12);
      try {
        const { text: answer } = await retryOnce(() => askAneque(history.current));
        if (!active.current) return;
        history.current = [...history.current, { role: "assistant" as const, content: answer }].slice(-12);
        setTurns((t) => [...t, { role: "assistant" as const, content: answer }].slice(-6));
        setState("speaking");
        play([{ text: answer.replace(/AneQue/g, "Aneq") }], { caption: answer });
        await untilQuiet(90_000);
      } catch (e) {
        const st = (e as TalkError).status;
        say(st === 429 ? "talk_limit" : st === 401 ? "talk_login" : st === 503 ? "talk_unavailable" : "talk_error");
        if (st === 401 || st === 503) {
          stop();
          return;
        }
        await untilQuiet(8000);
      }
    }
  }, [handle, stop]);

  /**
   * A typed question: the same brain as Live Talk without the microphone, for
   * a blocked mic, a noisy room, or a learner who would rather type. Commands
   * typed here work too ("open leaderboard").
   */
  const ask = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, 500);
      if (!text || active.current) return;
      unlock();
      setError(null);
      setTurns((t) => [...t, { role: "user" as const, content: text }].slice(-6));
      if (await handle(text)) return;
      setState("thinking");
      history.current = [...history.current, { role: "user" as const, content: text }].slice(-12);
      try {
        const { text: answer } = await retryOnce(() => askAneque(history.current));
        history.current = [...history.current, { role: "assistant" as const, content: answer }].slice(-12);
        setTurns((t) => [...t, { role: "assistant" as const, content: answer }].slice(-6));
        setState("speaking");
        play([{ text: answer.replace(/AneQue/g, "Aneq") }], { caption: answer });
        await untilQuiet(90_000);
      } catch (e) {
        const st = (e as TalkError).status;
        setError((e as Error).message || "Something went wrong. Try again.");
        say(st === 429 ? "talk_limit" : st === 401 ? "talk_login" : st === 503 ? "talk_unavailable" : "talk_error");
      } finally {
        if (!active.current) setState("idle");
      }
    },
    [handle]
  );

  const start = useCallback(async () => {
    unlock();
    setError(null);
    if (!talkSupported()) {
      setError("This browser can't record audio. Try Chrome, Edge, Brave, Firefox or Safari on a recent version.");
      return;
    }
    stopVoice();
    active.current = true;
    if (!history.current.length) {
      say("talk_hi");
      await untilQuiet(8000);
    }
    void loop();
  }, [loop]);

  return { state, turns, level, error, start, stop, ask, active: state !== "idle" };
}

/** A tiny live meter for the learner's own voice while AneQue listens. */
function MicMeter({ level }: { level: number }) {
  return (
    <div className="flex h-6 items-center gap-[3px]" aria-hidden>
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-mint-400 transition-[height] duration-75"
          style={{ height: `${Math.max(12, Math.min(100, level * 100 * (0.5 + 0.5 * Math.abs(Math.sin(i * 1.7)))))}%` }}
        />
      ))}
    </div>
  );
}

const TALK_LABEL: Record<TalkState, string> = {
  idle: "Talk to AneQue",
  listening: "Listening…",
  transcribing: "Got it…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

/**
 * The floating guide: AneQue's caption, playback controls, Live Talk and the
 * sound settings, on every Academy page. Hidden entirely when the member
 * turns the guide and her voice off.
 */
export function GuideDock() {
  const router = useRouter();
  const { settings, voice } = useAudio();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"guide" | "settings">("guide");
  const path = usePathname();
  const talk = useLiveTalk(router);
  const [greeting, setGreeting] = useState(false);
  // On a phone at the top of /academy the hero already shows AneQue,
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

  // The Academy owns sound only while one of its pages is open: leaving it
  // (this dock unmounts with the Academy layout) stops the music, AneQue and
  // every effect, and parks the audio engine.
  useEffect(() => enterAudioScope("academy"), []);

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

  // Other parts of the page (the hero) can open the dock straight into Live Talk.
  useEffect(() => {
    const on = () => {
      setPanel("guide");
      setOpen(true);
      void talk.start();
    };
    window.addEventListener("academy:talk", on);
    return () => window.removeEventListener("academy:talk", on);
  }, [talk]);

  // The quiz header's AneQue button (phones hide the orb while a question is open).
  useEffect(() => {
    const on = () => {
      setPanel("guide");
      setOpen(true);
      sfx("click");
    };
    window.addEventListener("academy:open", on);
    return () => window.removeEventListener("academy:open", on);
  }, []);

  const replay = () => {
    unlock();
    if (voice.line) say(voice.line);
    else if (voice.text) speak(voice.text);
    else say("intro");
  };
  const speaking = voice.speaking && !voice.paused;

  return (
    // The site-wide XYZ AI button owns the bottom-right corner. On phones the
    // dock takes the left side, lifted well above the bottom nav so it and its
    // panel sit in easy thumb reach; from md up it sits directly above XYZ AI.
    <div className={cn("pointer-events-none fixed bottom-[calc(8.5rem+env(safe-area-inset-bottom))] left-4 z-40 transition-all duration-300 md:bottom-[5.5rem] md:left-auto md:right-6", tucked && !open && !talk.active && !greeting && "invisible translate-y-4 opacity-0")}>
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto mb-3 max-h-[calc(100dvh-17rem)] w-[min(23rem,calc(100vw-2rem))] origin-bottom-left overflow-y-auto overscroll-contain rounded-3xl border border-hairline bg-ink-950/95 p-4 shadow-elevate backdrop-blur-xl md:max-h-[calc(100dvh-14rem)] md:origin-bottom-right"
            role="dialog"
            aria-label="AneQue, your Academy guide"
          >
            {panel === "settings" ? (
              <SoundSettings onClose={() => setPanel("guide")} />
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <GuideOrb size={44} speaking={speaking} />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-sm font-semibold text-content">AneQue</div>
                    <div className="text-[11px] text-content-subtle">{talk.active ? TALK_LABEL[talk.state] : speaking ? "Speaking" : voice.paused ? "Paused" : "Your study partner · says “Aneq”"}</div>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 text-content-subtle hover:text-content" aria-label="Close AneQue">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {talk.turns.length > 0 && (
                  <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                    {talk.turns.map((t, i) => (
                      <div key={i} className={cn("max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed", t.role === "user" ? "ml-auto bg-gold-400/15 text-content" : "bg-white/[0.05] text-content-muted")}>
                        {t.content}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 rounded-2xl border border-hairline bg-ink-900/50 px-3.5 py-3">
                  {talk.state === "listening" ? <MicMeter level={talk.level} /> : <GuideWave speaking={speaking} bars={36} className="h-6" />}
                  <GuideCaption text={voice.text || VOICE_LINES.intro} speaking={speaking} className="mt-2 min-h-[2.5rem] text-sm leading-relaxed" />
                </div>

                <button
                  type="button"
                  onClick={() => (talk.active ? (talk.stop(), say("talk_bye")) : void talk.start())}
                  className={cn("mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-colors", talk.active ? "bg-red-500/90 text-white hover:bg-red-500" : "btn-primary")}
                >
                  {talk.active ? <PhoneOff className="h-4 w-4" /> : <AudioLines className="h-4 w-4" />}
                  {talk.active ? `End talk · ${TALK_LABEL[talk.state]}` : "Talk to AneQue"}
                </button>
                <form
                  className="mt-2 flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = e.currentTarget.elements.namedItem("q") as HTMLInputElement | null;
                    const v = f?.value ?? "";
                    if (f) f.value = "";
                    void talk.ask(v);
                  }}
                >
                  <input
                    name="q"
                    type="text"
                    maxLength={500}
                    autoComplete="off"
                    disabled={talk.active}
                    placeholder="Or type a question…"
                    aria-label="Type a question for AneQue"
                    className="h-10 min-w-0 flex-1 rounded-xl border border-hairline bg-ink-900/80 px-3 text-sm text-content placeholder:text-content-subtle focus:border-gold-400/50 focus:outline-none disabled:opacity-50"
                  />
                  <button type="submit" disabled={talk.active} className="acad-icon-btn shrink-0" aria-label="Ask AneQue">
                    <ArrowUp />
                  </button>
                </form>
                {talk.error && <p className="mt-2 rounded-xl bg-white/[0.04] px-3 py-2 text-[11px] leading-relaxed text-content-subtle">{talk.error}</p>}

                <div className="mt-2 flex items-center gap-2">
                  {speaking ? (
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
                    {settings.master ? <Volume2 /> : <VolumeX />}
                  </button>
                  <button type="button" onClick={() => setPanel("settings")} className="acad-icon-btn" aria-label="Sound settings" title="Settings">
                    <Settings2 />
                  </button>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-content-subtle">Live Talk records only while it says “Listening”. Try: “What is funding rate?”, “Start quiz”, “Open leaderboard”.</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <GreetBubble hidden={open} onVisible={setGreeting} />
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
          aria-label={open ? "Close AneQue" : "Open AneQue, your Academy guide"}
          aria-expanded={open}
        >
          <GuideOrb size={44} speaking={speaking} className="md:!h-[52px] md:!w-[52px]" />
          {(speaking || talk.active) && !open && <span className={cn("absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-ink-950", talk.state === "listening" ? "bg-red-400" : "bg-mint-400")} />}
        </button>
      </div>
    </div>
  );
}

/**
 * AneQue's caption, revealed word by word in step with her voice (recorded clip
 * time, or the browser voice's word boundaries). Static text when she is
 * silent, so it reads the same with sound off.
 */
export function GuideCaption({ text, speaking, className }: { text: string; speaking: boolean; className?: string }) {
  const words = text.split(/(\s+)/);
  const total = words.filter((w) => w.trim()).length || 1;
  // How many words are lit. It changes a few times a second, so the caption
  // re-renders only when another word lights up. It used to set state on
  // every animation frame (60 renders a second per caption, and up to three
  // captions on screen), which was a real share of the Academy's lag.
  const [lit, setLit] = useState(total);
  useEffect(() => {
    if (!speaking) {
      setLit(total);
      return;
    }
    let raf = 0;
    let last = -1;
    const tick = () => {
      const k = Math.min(total, Math.ceil((voiceProgress() + 0.04) * total));
      if (k !== last) {
        last = k;
        setLit(k);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking, text, total]);
  let n = 0;
  return (
    <p className={className} aria-live="polite">
      {words.map((w, i) => {
        if (!w.trim()) return w;
        n++;
        const on = !speaking || n <= lit;
        return (
          <span key={i} className={cn("transition-colors duration-200", on ? "text-content" : "text-content-subtle/60")}>
            {w}
          </span>
        );
      })}
    </p>
  );
}

/** A slim live waveform: bars follow AneQue's actual loudness while she talks, rest flat. */
export function GuideWave({ speaking, bars = 32, className }: { speaking: boolean; bars?: number; className?: string }) {
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
