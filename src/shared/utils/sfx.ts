"use client";

/**
 * Chat sound effects, synthesised with Web Audio - no audio files, nothing to
 * download, nothing for the CSP to block.
 *
 * Levels (from chat-feel): "off"; "messages" = sent / received / reaction /
 * error; "all" = those plus a soft tick on every control. Browsers only let a
 * page make sound after a user gesture, so the context is unlocked on the
 * first tap (`unlockAudio`) and every sound is best-effort.
 */

import { getFeel } from "./chat-feel";

export type Sfx = "send" | "receive" | "reaction" | "tick" | "open" | "error" | "recordStart" | "recordStop" | "success";

const MESSAGE_SOUNDS: ReadonlySet<Sfx> = new Set(["send", "receive", "reaction", "error", "success", "recordStart", "recordStop"]);

let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return;
      ctx = new C();
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch { /* no audio */ }
}

type Note = { f: number; to?: number; at: number; dur: number; type?: OscillatorType; gain?: number };

const SOUNDS: Record<Sfx, Note[]> = {
  // A short upward swish: "gone".
  send: [{ f: 520, to: 980, at: 0, dur: 0.14, type: "sine", gain: 0.9 }],
  // Two soft rising notes: "something arrived".
  receive: [{ f: 660, at: 0, dur: 0.12, gain: 0.8 }, { f: 880, at: 0.09, dur: 0.16, gain: 0.7 }],
  reaction: [{ f: 1040, to: 1320, at: 0, dur: 0.09, type: "triangle", gain: 0.7 }],
  tick: [{ f: 1800, at: 0, dur: 0.025, type: "square", gain: 0.12 }],
  open: [{ f: 420, to: 560, at: 0, dur: 0.09, type: "sine", gain: 0.45 }],
  error: [{ f: 220, at: 0, dur: 0.12, type: "square", gain: 0.35 }, { f: 180, at: 0.13, dur: 0.14, type: "square", gain: 0.35 }],
  recordStart: [{ f: 740, at: 0, dur: 0.08, gain: 0.7 }, { f: 988, at: 0.08, dur: 0.1, gain: 0.7 }],
  recordStop: [{ f: 988, at: 0, dur: 0.08, gain: 0.7 }, { f: 740, at: 0.08, dur: 0.1, gain: 0.7 }],
  success: [{ f: 784, at: 0, dur: 0.1, gain: 0.7 }, { f: 1175, at: 0.08, dur: 0.18, gain: 0.6 }],
};

/** Would `kind` play at the member's current setting? Pure; exported for tests. */
export function soundAllowed(kind: Sfx, level: "off" | "messages" | "all"): boolean {
  if (level === "off") return false;
  if (level === "all") return true;
  return MESSAGE_SOUNDS.has(kind);
}

export function playSfx(kind: Sfx, opts: { force?: boolean } = {}): void {
  const feel = getFeel();
  if (!opts.force && !soundAllowed(kind, feel.sound)) return;
  try {
    unlockAudio();
    if (!ctx || ctx.state !== "running") return;
    const master = ctx.createGain();
    master.gain.value = 0.09 * feel.volume;
    master.connect(ctx.destination);
    const t0 = ctx.currentTime;
    for (const n of SOUNDS[kind]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = n.type ?? "sine";
      osc.frequency.setValueAtTime(n.f, t0 + n.at);
      if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t0 + n.at + n.dur);
      g.gain.setValueAtTime(0.0001, t0 + n.at);
      g.gain.exponentialRampToValueAtTime(n.gain ?? 0.8, t0 + n.at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0 + n.at);
      osc.stop(t0 + n.at + n.dur + 0.02);
    }
  } catch { /* audio blocked / unavailable */ }
}
