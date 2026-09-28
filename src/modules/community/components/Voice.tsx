"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Pause, Play, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTap, hapticToggle } from "@shared/utils/haptics";

/** Hard ceiling on a recording. Long enough to say something, short enough to listen to. */
export const VOICE_MAX_SECONDS = 60;
const PLAY_EVENT = "xyz-voice-play";

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

  return (
    <div className="flex w-[min(260px,62vw)] items-center gap-2.5 py-0.5">
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
        const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        const mime = pickMime();
        const r = new MediaRecorder(s, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
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
