"use client";

// Arena sound: effects and a background music loop, synthesised with Web
// Audio - no audio files to download, nothing for the CSP to block, nothing
// on the network. Separate from the chat sounds (src/shared/utils/sfx.ts),
// which follow the chat's own settings.
//
// Browsers only allow sound after a user gesture, so nothing plays until the
// first tap inside the Arena (unlock()). Both channels have their own on/off
// switch, remembered in this browser only.

export type ArenaSfx = "correct" | "wrong" | "combo" | "start" | "over" | "click" | "tick";
export type AudioSettings = { sound: boolean; music: boolean };

const KEY = "xyz:arena:audio";
export const DEFAULT_AUDIO: AudioSettings = { sound: true, music: true };

/** Parse stored settings; anything unreadable falls back to the defaults. Pure, for tests. */
export function parseAudioSettings(raw: string | null): AudioSettings {
  if (!raw) return { ...DEFAULT_AUDIO };
  try {
    const v = JSON.parse(raw);
    return { sound: typeof v?.sound === "boolean" ? v.sound : DEFAULT_AUDIO.sound, music: typeof v?.music === "boolean" ? v.music : DEFAULT_AUDIO.music };
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}

export function loadAudioSettings(): AudioSettings {
  try {
    return parseAudioSettings(localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}

export function saveAudioSettings(s: AudioSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* not remembered; still applies for this visit */
  }
}

// ------------------------------------------------------------------ engine

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;

function ensure(): AudioContext | null {
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.55;
      sfxBus.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0;
      musicBus.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a click/tap handler. */
export function unlock(): void {
  ensure();
}

type Tone = { f: number; to?: number; at: number; dur: number; type?: OscillatorType; gain?: number };

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

const SFX: Record<ArenaSfx, Tone[]> = {
  // Bright rising major arpeggio: "yes".
  correct: [
    { f: midi(72), at: 0, dur: 0.09, type: "triangle", gain: 0.6 },
    { f: midi(76), at: 0.06, dur: 0.09, type: "triangle", gain: 0.6 },
    { f: midi(79), at: 0.12, dur: 0.16, type: "triangle", gain: 0.55 },
  ],
  // Low falling buzz: "no".
  wrong: [
    { f: 220, to: 150, at: 0, dur: 0.22, type: "sawtooth", gain: 0.22 },
    { f: 110, at: 0.02, dur: 0.22, type: "sine", gain: 0.35 },
  ],
  // Sparkle run for a 5-streak.
  combo: [72, 76, 79, 84, 88].map((n, i) => ({ f: midi(n), at: i * 0.05, dur: 0.12, type: "sine" as OscillatorType, gain: 0.45 })),
  start: [
    { f: 300, to: 900, at: 0, dur: 0.22, type: "sine", gain: 0.45 },
    { f: midi(79), at: 0.18, dur: 0.14, type: "triangle", gain: 0.4 },
  ],
  // A small cadence to close the round.
  over: [
    { f: midi(67), at: 0, dur: 0.18, type: "triangle", gain: 0.5 },
    { f: midi(64), at: 0.16, dur: 0.18, type: "triangle", gain: 0.5 },
    { f: midi(60), at: 0.32, dur: 0.4, type: "triangle", gain: 0.5 },
  ],
  click: [{ f: 1400, at: 0, dur: 0.03, type: "square", gain: 0.08 }],
  tick: [{ f: 1000, at: 0, dur: 0.04, type: "square", gain: 0.12 }],
};

function tone(c: AudioContext, out: AudioNode, t0: number, n: Tone) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = n.type ?? "sine";
  o.frequency.setValueAtTime(n.f, t0 + n.at);
  if (n.to) o.frequency.exponentialRampToValueAtTime(n.to, t0 + n.at + n.dur);
  const peak = n.gain ?? 0.5;
  g.gain.setValueAtTime(0.0001, t0 + n.at);
  g.gain.exponentialRampToValueAtTime(peak, t0 + n.at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
  o.connect(g).connect(out);
  o.start(t0 + n.at);
  o.stop(t0 + n.at + n.dur + 0.02);
}

export function playSfx(kind: ArenaSfx, settings: AudioSettings): void {
  if (!settings.sound) return;
  const c = ensure();
  if (!c || !sfxBus || c.state !== "running") return;
  const t0 = c.currentTime + 0.005;
  for (const n of SFX[kind]) tone(c, sfxBus, t0, n);
}

// ------------------------------------------------------------------ music

// A soft lo-fi loop: Am - F - C - G, one bar each. Bass on the beat, a pad
// under it, a quiet arpeggio and hats on the eighths. A lookahead scheduler
// (setInterval 100ms, notes queued ~0.3s ahead) keeps it in time without
// timers drifting.
const PROGRESSION = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 52, 55], // C
  [55, 59, 62], // G
];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];

let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0;
let step = 0; // eighth notes
let tempo = 92;
let noise: AudioBuffer | null = null;

function hat(c: AudioContext, out: AudioNode, t: number, gain: number) {
  if (!noise) {
    noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.05), c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noise;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7000;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  src.connect(hp).connect(g).connect(out);
  src.start(t);
}

function scheduleStep(c: AudioContext, out: AudioNode, t: number) {
  const eighth = 60 / tempo / 2;
  const bar = Math.floor(step / 8) % PROGRESSION.length;
  const pos = step % 8;
  const chord = PROGRESSION[bar]!;
  if (pos === 0) {
    // Pad: the chord, low and soft, through a lowpass.
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    lp.connect(out);
    for (const n of chord) tone(c, lp, t, { f: midi(n), at: 0, dur: eighth * 8 * 0.98, type: "sine", gain: 0.06 });
  }
  if (pos === 0 || pos === 4) tone(c, out, t, { f: midi(chord[0]! - 12), at: 0, dur: eighth * 3.5, type: "triangle", gain: 0.16 });
  tone(c, out, t, { f: midi(chord[ARP[pos]!]! + 12), at: 0, dur: eighth * 0.9, type: "triangle", gain: 0.035 });
  hat(c, out, t, pos % 2 === 0 ? 0.035 : 0.018);
}

/** Start (or keep) the loop. `fast` = Rush tempo. No-op unless music is on. */
export function startMusic(settings: AudioSettings, fast = false): void {
  tempo = fast ? 118 : 92;
  if (!settings.music) return;
  const c = ensure();
  if (!c || !musicBus) return;
  musicBus.gain.cancelScheduledValues(c.currentTime);
  musicBus.gain.setTargetAtTime(0.5, c.currentTime, 0.4);
  if (timer) return;
  nextTime = c.currentTime + 0.1;
  timer = setInterval(() => {
    if (!ctx || !musicBus) return;
    while (nextTime < ctx.currentTime + 0.3) {
      scheduleStep(ctx, musicBus, nextTime);
      nextTime += 60 / tempo / 2;
      step++;
    }
  }, 100);
}

export function setMusicTempo(fast: boolean): void {
  tempo = fast ? 118 : 92;
}

/** Fade out and stop scheduling. */
export function stopMusic(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (ctx && musicBus) {
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  }
}

export function musicPlaying(): boolean {
  return timer != null;
}
