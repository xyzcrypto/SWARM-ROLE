"use client";

// AneQue Live Talk: listen -> transcribe -> answer -> speak, in a loop.
//
// Listening records a short clip with MediaRecorder and transcribes it on the
// server (Whisper), because the browser's built-in speech recognition fails
// in Brave ("Speech service unreachable"), does not exist in Firefox, and
// needs Siri on Safari. A small voice-activity detector ends the clip when
// the learner stops talking, so there is no button to hold.

export type TalkContext = {
  page?: string;
  lesson?: string | null;
  topic?: string | null;
  questionOpen?: boolean;
  question?: string | null;
};

let context: TalkContext = {};
/** Pages describe what is on screen (lesson, open question) so AneQue can help without giving answers away. */
export function setTalkContext(patch: TalkContext) {
  context = { ...context, ...patch };
}
export function clearTalkContext(keys: (keyof TalkContext)[]) {
  const next = { ...context };
  for (const k of keys) delete next[k];
  context = next;
}
export const getTalkContext = () => context;

export type RecordResult = { blob: Blob; ms: number } | null;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return undefined;
}

export function talkSupported(): boolean {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

let stream: MediaStream | null = null;
let abortCurrent: (() => void) | null = null;

/** Release the microphone (the browser's recording indicator goes away). */
export function releaseMic() {
  abortCurrent?.();
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

/**
 * Record one utterance. Resolves when the speaker has been quiet for
 * `silenceMs` after talking, after `maxMs`, or with null if nobody spoke
 * within `waitMs`. `onLevel` gets 0..1 loudness for the waveform.
 */
export async function recordUtterance(opts: { onLevel?: (v: number) => void; silenceMs?: number; maxMs?: number; waitMs?: number } = {}): Promise<RecordResult> {
  const { onLevel, silenceMs = 1200, maxMs = 15_000, waitMs = 8_000 } = opts;
  if (!stream || stream.getTracks().every((t) => t.readyState === "ended")) {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  }
  const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const ac = new C();
  const src = ac.createMediaStreamSource(stream);
  const an = ac.createAnalyser();
  an.fftSize = 1024;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const parts: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data);

  return new Promise<RecordResult>((resolve) => {
    const started = performance.now();
    let spoke = false;
    let lastLoud = 0;
    let noise = 0.008; // adapts to the room in the first moments
    let done = false;
    let raf = 0;
    const finish = (keep: boolean) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      abortCurrent = null;
      rec.onstop = () => {
        void ac.close();
        onLevel?.(0);
        if (!keep || !parts.length) return resolve(null);
        resolve({ blob: new Blob(parts, { type: rec.mimeType || mime || "audio/webm" }), ms: performance.now() - started });
      };
      if (rec.state !== "inactive") rec.stop();
      else rec.onstop?.(new Event("stop"));
    };
    abortCurrent = () => finish(false);
    const tick = () => {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();
      if (!spoke && now - started < 600) noise = noise * 0.9 + rms * 0.1;
      const loud = rms > Math.max(0.015, noise * 3);
      onLevel?.(Math.min(1, rms * 12));
      if (loud) {
        spoke = true;
        lastLoud = now;
      }
      if (spoke && now - lastLoud > silenceMs) return finish(true);
      if (!spoke && now - started > waitMs) return finish(false);
      if (now - started > maxMs) return finish(spoke);
      raf = requestAnimationFrame(tick);
    };
    rec.start(250);
    raf = requestAnimationFrame(tick);
  });
}

export class TalkError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new TalkError(body?.error || "Something went wrong.", res.status);
  return body as T;
}

export const transcribe = (blob: Blob) => call<{ text: string }>("/api/academy/aneque/listen", { method: "POST", headers: { "Content-Type": blob.type || "audio/webm" }, body: blob });

export type Turn = { role: "user" | "assistant"; content: string };
export const askAneque = (messages: Turn[]) =>
  call<{ text: string }>("/api/academy/aneque/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: messages.slice(-12), context: { ...context, page: context.page ?? (typeof location !== "undefined" ? location.pathname : undefined) } }),
  });
