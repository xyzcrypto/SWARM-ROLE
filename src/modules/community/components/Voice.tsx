"use client";

import { useEffect, useRef, useState } from "react";
import { Languages, Loader2, Mic, Pause, Play, Send, Trash2, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTap, hapticToggle } from "@shared/utils/haptics";
import { playSfx } from "@shared/utils/sfx";

/** Hard ceiling on a recording. Long enough to say something, short enough to listen to. */
export const VOICE_MAX_SECONDS = 60;
const PLAY_EVENT = "xyz-voice-play";
const SPEEDS = [1, 1.5, 2] as const;
// The listener's last speed, for the rest of the visit - someone who plays one
// note at 2x almost always wants the next one at 2x too.
let lastSpeed: number = 1;

/** Transcripts, per voice URL, for this page load. A failure is forgotten so a later tap retries. */
const transcripts = new Map<string, Promise<{ text?: string; error?: string }>>();
function fetchTranscript(src: string): Promise<{ text?: string; error?: string }> {
  let p = transcripts.get(src);
  if (!p) {
    p = fetch("/api/media/voice/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: src }) })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (r.ok && typeof j?.text === "string") return { text: j.text as string };
        transcripts.delete(src);
        return { error: (j?.error as string) ?? "Couldn't transcribe this voice message." };
      })
      .catch(() => { transcripts.delete(src); return { error: "Couldn't reach the server." }; });
    transcripts.set(src, p);
  }
  return p;
}

type TextState = { loading?: boolean; transcript?: string; translation?: string; error?: string; show?: "transcript" | "translation" };

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/** A stable pseudo-waveform from the URL, so a note looks the same every time it renders. */
function bars(seed: string, n = 28): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return Array.from({ length: n }, () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return 0.28 + (((h >>> 0) % 1000) / 1000) * 0.72;
  });
}

/**
 * A voice note in a message. One plays at a time across the page - starting
 * a second pauses the first, the way every messenger behaves.
 *
 * `preload="none"` on purpose: a thread with twenty voice notes must not
 * download twenty files just because they scrolled past. Nothing is fetched
 * until someone presses play.
 */
export function VoiceNote({ src, duration, mine }: { src: string; duration: number | null; mine?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState(0);
  const [len, setLen] = useState<number | null>(duration);
  // Why a note will not play, in words. A silent failure is what made this
  // look like "the button does nothing".
  const [failed, setFailed] = useState<string | null>(null);
  const [speed, setSpeed] = useState<number>(1);
  const [text, setText] = useState<TextState | null>(null);

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length] ?? 1;
    lastSpeed = next;
    setSpeed(next);
    if (audio.current) audio.current.playbackRate = next;
  };

  /** Show (or hide) the transcript, or its translation. Each is fetched once. */
  const showText = async (want: "transcript" | "translation") => {
    if (text?.show === want && !text.loading) { setText({ ...text, show: undefined }); return; }
    if (want === "translation" && text?.translation) { setText({ ...text, show: want }); return; }
    if (want === "transcript" && text?.transcript) { setText({ ...text, show: want }); return; }
    setText((t) => ({ ...(t ?? {}), loading: true, error: undefined, show: want }));
    const r = await fetchTranscript(src);
    if (r.error || r.text === undefined) { setText((t) => ({ ...(t ?? {}), loading: false, error: r.error })); return; }
    if (!r.text) { setText((t) => ({ ...(t ?? {}), loading: false, error: "No words detected in this voice message." })); return; }
    const transcript = r.text;
    if (want === "transcript") { setText((t) => ({ ...(t ?? {}), loading: false, transcript })); return; }
    try {
      const tr = await fetch("/api/chat/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: transcript.slice(0, 500) }) });
      const j = await tr.json().catch(() => null);
      if (tr.ok && j?.text) setText((t) => ({ ...(t ?? {}), loading: false, transcript, translation: j.text as string }));
      else setText((t) => ({ ...(t ?? {}), loading: false, transcript, error: (j?.error as string) ?? "Couldn't translate that." }));
    } catch {
      setText((t) => ({ ...(t ?? {}), loading: false, transcript, error: "Couldn't translate that." }));
    }
  };
  const shape = bars(src);

  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent<HTMLAudioElement>).detail !== audio.current) audio.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, onOther);
    return () => window.removeEventListener(PLAY_EVENT, onOther);
  }, []);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    hapticTap();
    if (a.paused) {
      window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: a }));
      setFailed(null);
      // Carry the listener's speed over from the last note they played.
      if (speed !== lastSpeed) setSpeed(lastSpeed);
      a.playbackRate = lastSpeed;
      setLoading(true);
      // iOS/Safari keeps a paused, never-loaded element at networkState 0;
      // load() first so the tap that starts playback is the one that fetches.
      if (a.networkState === HTMLMediaElement.NETWORK_EMPTY) a.load();
      void a.play().catch((err: unknown) => {
        setLoading(false);
        const name = (err as { name?: string } | null)?.name;
        // NotAllowedError = autoplay policy (should not happen on a tap);
        // NotSupportedError = the format or the source was refused.
        setFailed(name === "NotAllowedError" ? "Tap again to play." : "This voice message can't play here.");
      });
    } else {
      a.pause();
    }
  };

  const total = len ?? 0;
  const progress = total > 0 ? Math.min(1, pos / total) : 0;

  const panel = text?.show === "translation" ? text.translation : text?.show === "transcript" ? text.transcript : undefined;
  const chip = "inline-flex min-h-7 items-center gap-1 rounded-full px-2 text-[10px] font-semibold ring-1 transition-colors";
  return (
    <div className="w-[min(280px,66vw)]">
    <div className="flex items-center gap-2.5 py-0.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform active:scale-95",
          mine ? "bg-gold-500/90 text-ink-950" : "bg-mint-500/90 text-ink-950"
        )}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className="flex h-7 cursor-pointer items-center gap-[2px]"
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(pos)}
          tabIndex={0}
          onClick={(e) => {
            const a = audio.current;
            if (!a || !total) return;
            const r = e.currentTarget.getBoundingClientRect();
            a.currentTime = ((e.clientX - r.left) / r.width) * total;
          }}
          onKeyDown={(e) => {
            const a = audio.current;
            if (!a || !total) return;
            if (e.key === "ArrowRight") a.currentTime = Math.min(total, a.currentTime + 5);
            if (e.key === "ArrowLeft") a.currentTime = Math.max(0, a.currentTime - 5);
          }}
        >
          {shape.map((h, i) => (
            <span
              key={i}
              className={cn(
                "w-[3px] flex-1 rounded-full transition-colors",
                i / shape.length < progress ? (mine ? "bg-gold-300" : "bg-mint-300") : "bg-zinc-500/50"
              )}
              style={{ height: `${Math.round(h * 100)}%` }}
            />
          ))}
        </div>
        {failed ? (
          <span className="block text-[11px] text-amber-400" role="status">{failed}</span>
        ) : (
          <span className="mono text-[10px] text-zinc-500">{fmt(playing || pos > 0 ? pos : total)}</span>
        )}
      </div>
      <audio
        ref={audio}
        src={src}
        preload="none"
        onPlaying={() => { setPlaying(true); setLoading(false); }}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setPos(0); }}
        onError={() => {
          setPlaying(false);
          setLoading(false);
          setFailed("This voice message can't play here.");
        }}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setLen(d);
        }}
      />
    </div>
    {/* Speed, transcript, translation: small text-first chips under the note. */}
    <div className="mt-1 flex flex-wrap items-center gap-1 pl-[3.1rem]">
      <button type="button" onClick={cycleSpeed} aria-label={`Playback speed ${speed}x`} className={cn(chip, "mono", speed !== 1 ? "bg-gold-500/15 text-gold-200 ring-gold-500/40" : "text-zinc-400 ring-white/10 hover:text-zinc-200")}>
        {speed}x
      </button>
      <button type="button" onClick={() => void showText("transcript")} aria-pressed={text?.show === "transcript"} aria-label="Show transcript" className={cn(chip, text?.show === "transcript" ? "bg-white/[0.08] text-zinc-100 ring-white/20" : "text-zinc-400 ring-white/10 hover:text-zinc-200")}>
        <Type className="h-3 w-3" /> Text
      </button>
      <button type="button" onClick={() => void showText("translation")} aria-pressed={text?.show === "translation"} aria-label="Translate voice message" className={cn(chip, text?.show === "translation" ? "bg-mint-500/15 text-mint-200 ring-mint-500/40" : "text-zinc-400 ring-white/10 hover:text-zinc-200")}>
        <Languages className="h-3 w-3" /> Translate
      </button>
    </div>
    {text?.show && (
      <div className="mt-1.5 rounded-xl bg-black/[0.08] px-3 py-2 text-[13px] leading-relaxed dark:bg-white/[0.05]" aria-live="polite">
        {text.loading ? (
          <span className="inline-flex items-center gap-1.5 text-zinc-400"><Loader2 className="h-3 w-3 animate-spin" /> {text.show === "translation" ? "Translating…" : "Transcribing…"}</span>
        ) : panel ? (
          <>
            <span className="mono mr-1.5 text-[9px] uppercase tracking-wider text-zinc-500">{text.show === "translation" ? "Translation" : "Transcript"}</span>
            <span className="text-zinc-200">{panel}</span>
          </>
        ) : (
          <span className="text-amber-400">{text.error ?? "Nothing to show."}</span>
        )}
      </div>
    )}
    </div>
  );
}

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

export function voiceSupported(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * Upload a finished recording and return the message body for it: the Storage
 * URL plus its length in the fragment (see `chatAudioUrl`).
 */
export async function uploadVoice(blob: Blob, seconds: number): Promise<{ body?: string; error?: string }> {
  const fd = new FormData();
  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  fd.append("file", new File([blob], `voice.${ext}`, { type: blob.type || "audio/webm" }));
  try {
    const r = await fetch("/api/media/voice", { method: "POST", body: fd });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.url) return { error: j?.error ?? "Couldn't send the voice message." };
    return { body: `${j.url}#d=${Math.max(0.5, Math.min(VOICE_MAX_SECONDS, seconds)).toFixed(1)}` };
  } catch {
    return { error: "Couldn't send the voice message. Check your connection." };
  }
}

/**
 * The recording bar. Starts recording the moment it mounts (the member already
 * chose "Voice message"), shows a live level meter and a timer, and stops by
 * itself at `VOICE_MAX_SECONDS`. Cancel throws the recording away; send hands
 * the blob up. The microphone is released in every exit path.
 */
export function VoiceRecorder({ onSend, onCancel }: { onSend: (blob: Blob, seconds: number) => void; onCancel: () => void }) {
  const [secs, setSecs] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const intent = useRef<"send" | "cancel">("cancel");
  const cbs = useRef({ onSend, onCancel });
  useEffect(() => { cbs.current = { onSend, onCancel }; }, [onSend, onCancel]);

  useEffect(() => {
    let raf = 0;
    let timer = 0;
    let ctx: AudioContext | null = null;
    let alive = true;
    (async () => {
      try {
        // Voice-tuned capture: mono, with the browser's echo cancellation,
        // noise suppression AND automatic gain - AGC is what brings a quiet or
        // distant voice up to a comfortable level.
        const s = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        const mime = pickMime();
        // 64 kbps Opus: audibly fuller than the old 32 kbps, and 60s is still
        // only ~480 KB, well under the 2 MB cap.
        const r = new MediaRecorder(s, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : { audioBitsPerSecond: 64000 });
        rec.current = r;
        r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
        r.onstop = () => {
          s.getTracks().forEach((t) => t.stop());
          const seconds = (performance.now() - startedAt.current) / 1000;
          if (intent.current === "send" && chunks.current.length) {
            cbs.current.onSend(new Blob(chunks.current, { type: r.mimeType || mime || "audio/webm" }), seconds);
          }
        };
        r.start(250);
        startedAt.current = performance.now();
        hapticToggle();
        playSfx("recordStart");
        timer = window.setInterval(() => {
          const t = (performance.now() - startedAt.current) / 1000;
          setSecs(t);
          if (t >= VOICE_MAX_SECONDS) { intent.current = "send"; r.state !== "inactive" && r.stop(); }
        }, 200);
        // Level meter - purely visual, so it degrades to nothing if Web Audio is unavailable.
        try {
          ctx = new AudioContext();
          const an = ctx.createAnalyser();
          an.fftSize = 256;
          ctx.createMediaStreamSource(s).connect(an);
          const buf = new Uint8Array(an.frequencyBinCount);
          const tick = () => {
            an.getByteTimeDomainData(buf);
            let peak = 0;
            for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
            setLevel(Math.min(1, peak / 64));
            raf = requestAnimationFrame(tick);
          };
          tick();
        } catch { /* no meter */ }
      } catch {
        setError("Microphone unavailable. Allow microphone access to record.");
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
      void ctx?.close().catch(() => {});
      if (rec.current && rec.current.state !== "inactive") rec.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stop = (how: "send" | "cancel") => {
    intent.current = how;
    hapticTap();
    playSfx(how === "send" ? "recordStop" : "error");
    const r = rec.current;
    if (r && r.state !== "inactive") r.stop();
    if (how === "cancel" || !r) cbs.current.onCancel();
  };

  return (
    <div className="app-fade-in flex min-w-0 flex-1 items-center gap-2" role="group" aria-label="Recording a voice message">
      <button type="button" onClick={() => stop("cancel")} aria-label="Discard recording" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-300">
        <Trash2 className="h-5 w-5" />
      </button>
      <div className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-[22px] border border-red-500/30 bg-red-500/[0.06] px-4">
        {error ? (
          <span className="truncate text-[13px] text-amber-400">{error}</span>
        ) : (
          <>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400/70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="mono shrink-0 text-[13px] text-zinc-200" aria-live="off">{fmt(secs)}</span>
            <span className="flex h-6 min-w-0 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden>
              {Array.from({ length: 24 }, (_, i) => (
                <span key={i} className="w-[3px] shrink-0 rounded-full bg-red-300/70 transition-[height] duration-100" style={{ height: `${Math.max(12, Math.round(level * 100 * (0.5 + ((i * 37) % 10) / 20)))}%` }} />
              ))}
            </span>
            <span className="mono hidden shrink-0 text-[10px] text-zinc-500 sm:inline">max {VOICE_MAX_SECONDS}s</span>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => stop("send")}
        disabled={!!error}
        aria-label="Send voice message"
        className="btn-primary grid h-11 w-11 shrink-0 place-items-center !rounded-full !p-0 disabled:opacity-50"
      >
        <Send className="relative z-10 h-4 w-4 !text-white" />
      </button>
    </div>
  );
}

export { Mic as VoiceIcon };
