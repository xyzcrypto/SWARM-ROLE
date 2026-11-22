"use client";

// Academy sound: effects, three music tracks and AneQue's voice, each on its own
// bus with its own switch and volume under one master.
//
// Effects and music are synthesised with Web Audio: original, nothing
// licensed, nothing to download. AneQue's voice is a set of recorded mp3s (her
// scripted lines, plus every question, option, explanation and lesson summary
// of the starter curriculum), fetched one at a time when she speaks; anything
// without a recording is read by the browser's best female voice.
//
// Browsers block audio until a user gesture, so nothing here makes a sound
// before unlock() runs from a click or tap. Settings persist per browser.

import { VOICE_LINES, type VoiceLine } from "./voice-lines";
import { VOICE_LINES_HI } from "./voice-lines-hi";
import { chunkForSpeech } from "@modules/ai/lib/tts";
import { hapticError, hapticSelect, hapticSent, hapticTap, hapticToggle } from "@shared/utils/haptics";

export type Sfx =
  | "click"
  | "hover"
  | "select"
  | "correct"
  | "wrong"
  | "xp"
  | "coin"
  | "levelup"
  | "tick"
  | "count"
  | "go"
  | "heartbeat"
  | "winner"
  | "achievement"
  | "whoosh"
  | "fifty"
  | "fire"
  | "lock"
  | "reveal"
  | "pop"
  | "drumroll"
  | "rankup"
  | "streak";

export type Track = "auto" | "focus" | "arena" | "night";
export type Scene = "focus" | "arena";

export type AudioSettings = {
  master: boolean;
  masterVol: number;
  music: boolean;
  musicVol: number;
  track: Track;
  sfx: boolean;
  sfxVol: number;
  voice: boolean;
  voiceVol: number;
  /** "nova" = her recorded voice (+ best browser female voice for unrecorded text). */
  voiceName: string;
  /** AneQue reacts on her own at key moments (welcome, answers, results...). */
  guide: boolean;
  /** AneQue reads each new question aloud. */
  readQuestions: boolean;
  /** After a wrong answer, the guide reads the explanation. */
  explainWrong: boolean;
  /** After a RIGHT answer too: every answer explained, so people learn why. */
  explainRight: boolean;
  /** Academy language: lessons, quizzes and AneQue in English or Hinglish. */
  lang: "en" | "hi";
  /** Vibrate with the sound effects (phones that support it). */
  haptics: boolean;
};

export const DEFAULT_AUDIO: AudioSettings = {
  master: true,
  masterVol: 0.8,
  music: false,
  musicVol: 0.4,
  track: "auto",
  sfx: true,
  sfxVol: 0.6,
  voice: true,
  voiceVol: 0.9,
  voiceName: "nova",
  guide: true,
  readQuestions: true,
  explainWrong: true,
  explainRight: true,
  lang: "en",
  haptics: true,
};

const KEY = "xyz:academy:audio:v1";
const clamp = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const TRACKS: Track[] = ["auto", "focus", "arena", "night"];

/** Parse stored settings; anything unreadable falls back to the defaults. Pure, for tests. */
export function parseSettings(raw: string | null): AudioSettings {
  if (!raw) return { ...DEFAULT_AUDIO };
  try {
    const v = JSON.parse(raw) ?? {};
    return {
      master: bool(v.master, DEFAULT_AUDIO.master),
      masterVol: clamp(v.masterVol, DEFAULT_AUDIO.masterVol),
      music: bool(v.music, DEFAULT_AUDIO.music),
      musicVol: clamp(v.musicVol, DEFAULT_AUDIO.musicVol),
      track: TRACKS.includes(v.track) ? v.track : DEFAULT_AUDIO.track,
      sfx: bool(v.sfx, DEFAULT_AUDIO.sfx),
      sfxVol: clamp(v.sfxVol, DEFAULT_AUDIO.sfxVol),
      voice: bool(v.voice, DEFAULT_AUDIO.voice),
      voiceVol: clamp(v.voiceVol, DEFAULT_AUDIO.voiceVol),
      voiceName: typeof v.voiceName === "string" && v.voiceName ? v.voiceName.slice(0, 120) : DEFAULT_AUDIO.voiceName,
      guide: bool(v.guide, DEFAULT_AUDIO.guide),
      readQuestions: bool(v.readQuestions, DEFAULT_AUDIO.readQuestions),
      explainWrong: bool(v.explainWrong, DEFAULT_AUDIO.explainWrong),
      explainRight: bool(v.explainRight, DEFAULT_AUDIO.explainRight),
      lang: v.lang === "hi" ? "hi" : "en",
      haptics: bool(v.haptics, DEFAULT_AUDIO.haptics),
    };
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}

// ------------------------------------------------------------------ store

export type VoiceState = { speaking: boolean; paused: boolean; text: string; line: VoiceLine | null };
type Snapshot = { settings: AudioSettings; voice: VoiceState; unlocked: boolean; playing: Exclude<Track, "auto"> | null };

const SERVER_SNAPSHOT: Snapshot = { settings: DEFAULT_AUDIO, voice: { speaking: false, paused: false, text: "", line: null }, unlocked: false, playing: null };
let snap: Snapshot = SERVER_SNAPSHOT;
let loaded = false;
const listeners = new Set<() => void>();

function emit(next: Partial<Snapshot>) {
  snap = { ...snap, ...next };
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  if (!loaded) loadSettings();
  listeners.add(l);
  return () => listeners.delete(l);
}
export const getSnapshot = () => snap;
export const getServerSnapshot = () => SERVER_SNAPSHOT;

function loadSettings() {
  loaded = true;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* private mode: defaults */
  }
  snap = { ...snap, settings: parseSettings(raw) };
}

export function updateSettings(patch: Partial<AudioSettings>) {
  const settings = { ...snap.settings, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* still applies for this visit */
  }
  emit({ settings });
  applyGains();
  if (!settings.master || !settings.music) stopMusic();
  else if (patch.music || patch.master || patch.track) {
    stopMusic();
    startMusic();
  }
  if (!settings.master || !settings.voice) stopVoice();
}

// ------------------------------------------------------------------ scope
//
// ⚠️ Where sound is allowed at all. This module is a singleton that outlives
// client-side navigation, and the AudioContext with it: before scopes, the
// Academy's music scheduler (a 30ms setInterval) and AneQue's voice carried on
// after the learner left the Academy, so the rest of the site played Academy
// music and sound effects ("baki jagah bhi effect aata hai"), and the
// scheduler kept costing CPU on every page.
//
// Now a page has to claim sound while it is mounted:
//   "academy"  every /academy page (claimed by GuideDock in the Academy layout):
//              music, voice and effects.
//   "page"     a non-Academy page that uses AneQue's voice on purpose (the
//              Feedback room's greeting): voice and effects, NEVER music.
// Releasing the claim stops everything and suspends the AudioContext, so no
// timer or audio thread survives the page that started it.
export type AudioScope = "academy" | "page";
let scope: AudioScope | null = null;
let scopeToken = 0;

/** Claim sound for a mounted page. Returns the release function (call it on unmount). */
export function enterAudioScope(kind: AudioScope): () => void {
  if (!loaded) loadSettings();
  scope = kind;
  const my = ++scopeToken;
  if (ctx && ctx.state === "suspended" && snap.unlocked) void ctx.resume().catch(() => {});
  if (kind !== "academy") stopMusic();
  else if (snap.unlocked && snap.settings.master && snap.settings.music) startMusic();
  return () => {
    // A newer claim (the next page mounted first) owns the scope now.
    if (my === scopeToken) leaveAudioScope();
  };
}

/** Stop every sound and park the audio engine. Safe to call any time. */
export function leaveAudioScope() {
  scope = null;
  stopVoice();
  stopMusic();
  duckLevel = 1;
  if (ctx && ctx.state === "running") void ctx.suspend().catch(() => {});
}

export const audioScope = () => scope;

// ------------------------------------------------------------------ engine

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let voiceBus: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let noise: AudioBuffer | null = null;
let duckLevel = 1;

/** The shared room reverb (see ensure()). */
function buildRoom(c: AudioContext) {
  if (c !== ctx || !master || !sfxBus || !musicBus) return;
  // A small room: a generated stereo impulse (2.2s, darkening tail) shared
  // by effects and music, so everything sounds like it is in one space.
  try {
    // Same darkening exponential tail as before, computed with running
    // multipliers instead of a Math.pow per sample (several times cheaper),
    // both channels in one pass.
    const len = Math.floor(c.sampleRate * 1.6);
    const ir = c.createBuffer(2, len, c.sampleRate);
    const L = ir.getChannelData(0);
    const R = ir.getChannelData(1);
    const decay = Math.pow(0.0006, 1 / len); // ~-64 dB over the tail
    const dColor = 0.45 / len;
    let env = 1;
    let color = 0.6;
    let lpL = 0;
    let lpR = 0;
    // xorshift32 noise: several times faster than Math.random() here, and
    // noise is all a reverb tail needs.
    let seed = 0x9e3779b9;
    const rnd = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 2147483648 - 1;
    };
    for (let i = 0; i < len; i++) {
      lpL += (rnd() - lpL) * color;
      lpR += (rnd() - lpR) * color;
      L[i] = lpL * env;
      R[i] = lpR * env;
      env *= decay;
      color -= dColor;
    }
    const verb = c.createConvolver();
    verb.buffer = ir;
    const ret = c.createGain();
    ret.gain.value = 0.55;
    verb.connect(ret).connect(master);
    const sfxSend = c.createGain();
    sfxSend.gain.value = 0.22;
    sfxBus.connect(sfxSend).connect(verb);
    const musicSend = c.createGain();
    musicSend.gain.value = 0.45;
    musicBus.connect(musicSend).connect(verb);
  } catch {
    /* no convolver: dry sound */
  }
}

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      master.connect(comp).connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0;
      musicBus.connect(master);
      voiceBus = ctx.createGain();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      voiceBus.connect(analyser);
      analyser.connect(master);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // The room reverb is ~200k generated samples: built when the main
      // thread is idle, not while the page is still rendering (it was the
      // single biggest JS cost of opening an Academy page on a phone).
      const c = ctx;
      const idle = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (idle) idle(() => buildRoom(c), { timeout: 2000 });
      else setTimeout(() => buildRoom(c), 200);
      applyGains();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function applyGains() {
  if (!ctx || !master || !sfxBus || !musicBus || !voiceBus) return;
  const s = snap.settings;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(s.master ? s.masterVol : 0, t, 0.05);
  sfxBus.gain.setTargetAtTime(s.sfx ? s.sfxVol : 0, t, 0.05);
  voiceBus.gain.setTargetAtTime(s.voice ? s.voiceVol : 0, t, 0.05);
  // Music steps back while AneQue talks or a question is open.
  const voiceDuck = snap.voice.speaking && !snap.voice.paused ? 0.45 : 1;
  musicBus.gain.setTargetAtTime(s.music && musicOn ? s.musicVol * 0.55 * duckLevel * voiceDuck : 0, t, 0.35);
}

/**
 * Try to start sound WITHOUT a gesture, so AneQue can greet the moment an
 * Academy page opens. Browsers allow it when the visitor already interacted
 * with the site in this tab (an in-app link click carries over) or has played
 * media here often enough; otherwise the context stays suspended, this
 * returns false and nothing is heard, and the caller asks for a tap instead.
 */
export async function tryAutoUnlock(): Promise<boolean> {
  if (!loaded) loadSettings();
  if (snap.unlocked) return true;
  // No interaction with this tab yet: browsers will refuse, so do not even
  // build the audio graph (that work is wasted and lands on page load).
  // After any click on the site (including the link that brought them here)
  // `hasBeenActive` is true and this goes ahead.
  const ua = (navigator as unknown as { userActivation?: { hasBeenActive: boolean } }).userActivation;
  const policy = (navigator as unknown as { getAutoplayPolicy?: (t: string) => string }).getAutoplayPolicy?.("audiocontext");
  if (ua && !ua.hasBeenActive && policy !== "allowed") return false;
  const c = ensure();
  if (!c) return false;
  try {
    await Promise.race([c.resume(), new Promise((r) => setTimeout(r, 450))]);
  } catch {
    /* blocked */
  }
  if (c.state !== "running") return false;
  emit({ unlocked: true });
  if (snap.settings.master && snap.settings.music) startMusic();
  return true;
}

/** Call from a click/tap handler; safe to call repeatedly. */
export function unlock() {
  if (!loaded) loadSettings();
  if (ensure() && !snap.unlocked) {
    emit({ unlocked: true });
    if (snap.settings.master && snap.settings.music) startMusic();
  }
}

// ---------- instruments
//
// Three voices that sound like objects, not beeps:
//   pluck  marimba-ish: a sine with its 4th partial, both decaying fast
//   bell   FM bell: carrier + inharmonic modulator (ratio 3.5) whose depth decays
//   keys   electric-piano-ish FM with a gentle tremolo, for the Night track
// Everything is slightly humanised: a few ms of timing and ~15% of velocity
// jitter per note, the way a person never hits two notes identically.

type Voice = "pluck" | "bell" | "keys" | "osc" | "noise" | "thud";
type Tone = { f: number; to?: number; at: number; dur: number; type?: OscillatorType; gain?: number; v?: Voice; hp?: number };
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const human = (g: number) => g * (0.88 + Math.random() * 0.24);
const jitter = () => (Math.random() - 0.5) * 0.008;

function env(g: GainNode, at: number, peak: number, attack: number, dur: number) {
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
}

function playVoice(t: Tone, at: number, bus: AudioNode) {
  const c = ctx!;
  const peak = human(t.gain ?? 0.25);
  const out = c.createGain();
  const pan = c.createStereoPanner ? c.createStereoPanner() : null;
  if (pan) {
    pan.pan.value = (Math.random() - 0.5) * 0.3;
    out.connect(pan).connect(bus);
  } else out.connect(bus);
  const v = t.v ?? (t.type ? "osc" : "osc");
  if (v === "noise") {
    if (!noise) return;
    const s = c.createBufferSource();
    s.buffer = noise;
    const f = c.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = t.hp ?? 2000;
    s.connect(f).connect(out);
    env(out, at, peak, 0.005, t.dur);
    s.start(at, Math.random() * 0.5);
    s.stop(at + t.dur + 0.05);
    return;
  }
  if (v === "pluck") {
    for (const [mult, g, d] of [
      [1, 1, 1],
      [4, 0.25, 0.35],
      [10, 0.06, 0.12],
    ] as const) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.frequency.value = t.f * mult;
      env(og, at, peak * g, 0.003, t.dur * d);
      o.connect(og).connect(out);
      o.start(at);
      o.stop(at + t.dur + 0.05);
    }
    out.gain.value = 1;
    return;
  }
  if (v === "bell" || v === "keys") {
    const carrier = c.createOscillator();
    const mod = c.createOscillator();
    const modGain = c.createGain();
    const ratio = v === "bell" ? 3.5 : 1;
    carrier.frequency.value = t.f;
    mod.frequency.value = t.f * ratio;
    const depth = t.f * (v === "bell" ? 2.4 : 0.9);
    modGain.gain.setValueAtTime(depth, at);
    modGain.gain.exponentialRampToValueAtTime(Math.max(1, depth * 0.05), at + t.dur * (v === "bell" ? 0.6 : 0.3));
    mod.connect(modGain).connect(carrier.frequency);
    const cg = c.createGain();
    env(cg, at, peak, v === "bell" ? 0.002 : 0.008, t.dur);
    carrier.connect(cg).connect(out);
    if (v === "keys") {
      const trem = c.createOscillator();
      const tg = c.createGain();
      trem.frequency.value = 4.5;
      tg.gain.value = 0.12;
      trem.connect(tg).connect(cg.gain);
      trem.start(at);
      trem.stop(at + t.dur + 0.05);
    }
    out.gain.value = 1;
    carrier.start(at);
    mod.start(at);
    carrier.stop(at + t.dur + 0.05);
    mod.stop(at + t.dur + 0.05);
    return;
  }
  if (v === "thud") {
    const o = c.createOscillator();
    o.frequency.setValueAtTime(t.f, at);
    o.frequency.exponentialRampToValueAtTime(t.to ?? t.f * 0.6, at + t.dur);
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    o.connect(f).connect(out);
    env(out, at, peak, 0.006, t.dur);
    o.start(at);
    o.stop(at + t.dur + 0.05);
    return;
  }
  const o = c.createOscillator();
  o.type = t.type ?? "sine";
  o.frequency.setValueAtTime(t.f, at);
  if (t.to) o.frequency.exponentialRampToValueAtTime(t.to, at + t.dur);
  o.connect(out);
  env(out, at, peak, 0.008, t.dur);
  o.start(at);
  o.stop(at + t.dur + 0.05);
}

const SFX: Record<Sfx, Tone[]> = {
  click: [{ f: midi(96), at: 0, dur: 0.05, v: "pluck", gain: 0.06 }],
  hover: [{ f: midi(100), at: 0, dur: 0.03, v: "pluck", gain: 0.02 }],
  select: [{ f: midi(84), at: 0, dur: 0.14, v: "pluck", gain: 0.14 }],
  correct: [
    { f: midi(76), at: 0, dur: 0.5, v: "pluck", gain: 0.24 },
    { f: midi(80), at: 0.075, dur: 0.5, v: "pluck", gain: 0.22 },
    { f: midi(83), at: 0.15, dur: 0.7, v: "pluck", gain: 0.24 },
    { f: midi(88), at: 0.15, dur: 1.2, v: "bell", gain: 0.05 },
  ],
  wrong: [
    { f: 196, to: 150, at: 0, dur: 0.28, v: "thud", gain: 0.32 },
    { f: 165, to: 120, at: 0.13, dur: 0.38, v: "thud", gain: 0.26 },
  ],
  xp: [
    { f: midi(88), at: 0, dur: 0.5, v: "bell", gain: 0.06 },
    { f: midi(95), at: 0.07, dur: 0.6, v: "bell", gain: 0.05 },
  ],
  coin: [
    { f: midi(88), at: 0, dur: 0.45, v: "bell", gain: 0.07 },
    { f: midi(93), at: 0.06, dur: 0.7, v: "bell", gain: 0.07 },
  ],
  levelup: [
    { f: midi(72), at: 0, dur: 0.6, v: "pluck", gain: 0.22 },
    { f: midi(76), at: 0.11, dur: 0.6, v: "pluck", gain: 0.22 },
    { f: midi(79), at: 0.22, dur: 0.6, v: "pluck", gain: 0.22 },
    { f: midi(84), at: 0.33, dur: 1.6, v: "bell", gain: 0.12 },
    { f: midi(88), at: 0.4, dur: 1.8, v: "bell", gain: 0.08 },
    { f: midi(91), at: 0.47, dur: 2.0, v: "bell", gain: 0.06 },
    { f: 0, at: 0.33, dur: 0.9, v: "noise", hp: 7000, gain: 0.03 },
  ],
  tick: [{ f: midi(100), at: 0, dur: 0.04, v: "pluck", gain: 0.05 }],
  count: [{ f: midi(81), at: 0, dur: 0.4, v: "bell", gain: 0.1 }],
  go: [
    { f: midi(81), at: 0, dur: 0.3, v: "pluck", gain: 0.18 },
    { f: midi(88), at: 0.09, dur: 0.9, v: "bell", gain: 0.12 },
  ],
  heartbeat: [
    { f: 80, to: 48, at: 0, dur: 0.16, v: "thud", gain: 0.45 },
    { f: 72, to: 44, at: 0.2, dur: 0.16, v: "thud", gain: 0.32 },
  ],
  winner: [
    { f: midi(72), at: 0, dur: 0.4, v: "pluck", gain: 0.2 },
    { f: midi(76), at: 0.12, dur: 0.4, v: "pluck", gain: 0.2 },
    { f: midi(79), at: 0.24, dur: 0.4, v: "pluck", gain: 0.2 },
    { f: midi(84), at: 0.36, dur: 2.2, v: "bell", gain: 0.13 },
    { f: midi(88), at: 0.36, dur: 2.2, v: "bell", gain: 0.09 },
    { f: midi(91), at: 0.5, dur: 2.4, v: "bell", gain: 0.07 },
    { f: 0, at: 0.36, dur: 1.2, v: "noise", hp: 7500, gain: 0.025 },
  ],
  achievement: [
    { f: midi(83), at: 0, dur: 1.0, v: "bell", gain: 0.1 },
    { f: midi(88), at: 0.09, dur: 1.2, v: "bell", gain: 0.1 },
    { f: midi(95), at: 0.18, dur: 1.6, v: "bell", gain: 0.08 },
  ],
  whoosh: [{ f: 0, at: 0, dur: 0.28, v: "noise", hp: 1800, gain: 0.05 }],
  fifty: [
    { f: 0, at: 0, dur: 0.25, v: "noise", hp: 2500, gain: 0.05 },
    { f: midi(70), at: 0.02, dur: 0.3, v: "pluck", gain: 0.14 },
    { f: midi(65), at: 0.1, dur: 0.35, v: "pluck", gain: 0.12 },
  ],
  fire: [
    { f: 0, at: 0, dur: 0.45, v: "noise", hp: 900, gain: 0.05 },
    { f: midi(84), at: 0.05, dur: 0.4, v: "pluck", gain: 0.16 },
    { f: midi(91), at: 0.13, dur: 0.9, v: "bell", gain: 0.08 },
  ],
  lock: [
    { f: midi(79), at: 0, dur: 0.12, v: "pluck", gain: 0.14 },
    { f: midi(86), at: 0.06, dur: 0.2, v: "pluck", gain: 0.12 },
  ],
  reveal: [
    ...Array.from({ length: 12 }, (_, i): Tone => ({ f: 0, at: i * 0.04, dur: 0.035, v: "noise", hp: 700, gain: 0.025 + i * 0.004 })),
    { f: midi(86), at: 0.5, dur: 1.0, v: "bell", gain: 0.1 },
  ],
  pop: [{ f: midi(91), at: 0, dur: 0.12, v: "pluck", gain: 0.12 }],
  // Live quiz: a snare roll that builds for ~1.4s into the reveal.
  drumroll: [
    ...Array.from({ length: 22 }, (_, i): Tone => ({ f: 0, at: i * 0.062, dur: 0.05, v: "noise", hp: 1400 + i * 40, gain: 0.018 + i * 0.0022 })),
    { f: 95, to: 60, at: 1.36, dur: 0.22, v: "thud", gain: 0.34 },
  ],
  // Climbing the live leaderboard: a quick rising arpeggio with a bell on top.
  rankup: [
    { f: midi(79), at: 0, dur: 0.22, v: "pluck", gain: 0.16 },
    { f: midi(83), at: 0.07, dur: 0.22, v: "pluck", gain: 0.16 },
    { f: midi(86), at: 0.14, dur: 0.24, v: "pluck", gain: 0.16 },
    { f: midi(91), at: 0.21, dur: 1.0, v: "bell", gain: 0.09 },
  ],
  // A run of right answers: a bright double sparkle.
  streak: [
    { f: 0, at: 0, dur: 0.3, v: "noise", hp: 6500, gain: 0.03 },
    { f: midi(88), at: 0.02, dur: 0.5, v: "bell", gain: 0.08 },
    { f: midi(95), at: 0.11, dur: 0.7, v: "bell", gain: 0.07 },
  ],
};

function playTones(tones: Tone[], bus: AudioNode, at = 0) {
  const now = ctx!.currentTime + 0.01 + at;
  for (const t of tones) playVoice(t, now + t.at + (t.at ? jitter() : 0), bus);
}

let lastHover = 0;
export function sfx(name: Sfx) {
  // Haptics follow their own switch, so a muted phone still feels the answer.
  if (scope && name !== "hover") buzz(name);
  if (!scope || !snap.settings.master || !snap.settings.sfx) return;
  if (name === "hover") {
    if (performance.now() - lastHover < 60) return;
    lastHover = performance.now();
  }
  const c = ensure();
  if (!c || !sfxBus) return;
  playTones(SFX[name], sfxBus);
}

/** Haptics that match the sound (Android; iOS has no vibration API). Uses the site's own feel settings. */
function buzz(name: Sfx) {
  if (!snap.settings.haptics) return;
  if (name === "select" || name === "click") hapticSelect();
  else if (name === "correct" || name === "coin" || name === "lock") hapticSent();
  else if (name === "wrong" || name === "heartbeat") hapticError();
  else if (name === "go" || name === "count" || name === "fifty") hapticTap();
  else if (name === "levelup" || name === "achievement" || name === "winner" || name === "fire" || name === "rankup" || name === "streak") {
    hapticToggle();
    setTimeout(hapticSent, 180);
  }
}

// ------------------------------------------------------------------ music
//
// Three generative tracks on one look-ahead scheduler (a 16th-note grid,
// notes queued 150ms ahead), all on Am9 - Fmaj9 - Cmaj9 - G6 so switching
// never clashes, all through the same room reverb:
//   focus  slow chorused pads with a breathing filter, for reading
//   arena  112 bpm with swing: soft kick, brushed hats, round bass, marimba arp
//   night  76 bpm lo-fi: electric-piano chords, lazy kick, rim, faint vinyl

const CHORDS = [
  [45, 57, 60, 64, 71],
  [41, 53, 57, 64, 67],
  [48, 55, 59, 64, 71],
  [43, 55, 59, 62, 64],
];
const BPM: Record<Exclude<Track, "auto">, number> = { focus: 60, arena: 112, night: 76 };

let musicOn = false;
let scene: Scene = "focus";
let current: Exclude<Track, "auto"> | null = null;
let schedTimer: ReturnType<typeof setInterval> | null = null;
let nextStepAt = 0;
let step = 0;

function pad(n: number, at: number, dur: number, gain: number) {
  const c = ctx!;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(600, at);
  f.frequency.linearRampToValueAtTime(1500, at + dur * 0.5);
  f.frequency.linearRampToValueAtTime(700, at + dur);
  const g = c.createGain();
  env(g, at, gain, 1.8, dur + 1.5);
  f.connect(g).connect(musicBus!);
  for (const d of [-9, 0, 8]) {
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = midi(n);
    o.detune.value = d;
    o.connect(f);
    o.start(at);
    o.stop(at + dur + 1.6);
  }
}

function kick(at: number, gain = 0.3) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(110, at);
  o.frequency.exponentialRampToValueAtTime(42, at + 0.16);
  env(g, at, human(gain), 0.004, 0.28);
  o.connect(g).connect(musicBus!);
  o.start(at);
  o.stop(at + 0.32);
}

function brush(at: number, gain = 0.04, len = 0.05, hp = 6500) {
  playVoice({ f: 0, at: 0, dur: len, v: "noise", hp, gain }, at, musicBus!);
}

function scheduleStep(track: Exclude<Track, "auto">, i: number, at0: number, sixteenth: number) {
  const bar = Math.floor(i / 16);
  const s = i % 16;
  // swing the off-beat 16ths (arena, night) and humanise every hit
  const swing = track !== "focus" && s % 2 === 1 ? sixteenth * (track === "night" ? 0.22 : 0.12) : 0;
  const at = at0 + swing + jitter();
  const chord = CHORDS[Math.floor(bar / (track === "focus" ? 1 : 2)) % CHORDS.length];
  if (track === "focus") {
    if (s === 0) chord.forEach((n, k) => pad(n, at, sixteenth * 16, k === 0 ? 0.05 : 0.022));
    if (s === 8 && bar % 2 === 1) playVoice({ f: midi(chord[chord.length - 1] + 12), at: 0, dur: 2.4, v: "bell", gain: 0.02 }, at, musicBus!);
    return;
  }
  if (track === "arena") {
    if (s === 0 || s === 8 || (s === 14 && bar % 2 === 1)) kick(at, s === 0 ? 0.3 : 0.22);
    if (s === 4 || s === 12) brush(at, 0.05, 0.12, 2500);
    if (s % 2 === 0) brush(at, 0.016, 0.03, 8000);
    if (s % 4 === 0 || s === 6 || s === 14) playVoice({ f: midi(chord[0] - 12), at: 0, dur: sixteenth * 3, v: "thud", to: midi(chord[0] - 12) * 0.98, gain: 0.16 }, at, musicBus!);
    const arp = [chord[1], chord[2], chord[3], chord[4], chord[3], chord[2]];
    if (s % 2 === 0) playVoice({ f: midi(arp[(s / 2) % arp.length] + 12), at: 0, dur: 0.45, v: "pluck", gain: 0.05 }, at, musicBus!);
    return;
  }
  // night
  if (s === 0 || s === 10) kick(at, 0.18);
  if (s === 4 || s === 12) brush(at, 0.045, 0.1, 1800);
  if (s % 2 === 0) brush(at, 0.009, 0.03, 8500);
  if (Math.random() < 0.06) brush(at, 0.006, 0.01, 3000); // vinyl dust
  if (s === 0 || s === 7) chord.slice(1).forEach((n, k) => playVoice({ f: midi(n), at: 0, dur: sixteenth * 9, v: "keys", gain: 0.035 }, at + k * 0.012, musicBus!));
  if (s === 0) playVoice({ f: midi(chord[0] - 12), at: 0, dur: sixteenth * 12, v: "thud", to: midi(chord[0] - 12) * 0.99, gain: 0.14 }, at, musicBus!);
}

function pickTrack(): Exclude<Track, "auto"> {
  const t = snap.settings.track;
  return t === "auto" ? (scene === "arena" ? "arena" : "focus") : t;
}

export function startMusic() {
  // Music is the Academy's alone: never on any other page.
  if (scope !== "academy" || musicOn || !snap.settings.master || !snap.settings.music || !snap.unlocked) return;
  const c = ensure();
  if (!c) return;
  musicOn = true;
  current = pickTrack();
  emit({ playing: current });
  applyGains();
  step = 0;
  nextStepAt = c.currentTime + 0.1;
  schedTimer = setInterval(() => {
    if (!ctx || !current) return;
    const sixteenth = 60 / BPM[current] / 4;
    while (nextStepAt < ctx.currentTime + 0.15) {
      scheduleStep(current, step, nextStepAt, sixteenth);
      nextStepAt += sixteenth;
      step++;
    }
  }, 30);
}

export function stopMusic() {
  musicOn = false;
  if (schedTimer) clearInterval(schedTimer);
  schedTimer = null;
  current = null;
  if (snap.playing) emit({ playing: null });
  applyGains();
}

/** Pages say what they are; "Auto" music follows (focus for reading, arena for play). */
export function setScene(next: Scene) {
  if (scene === next) return;
  scene = next;
  if (musicOn && snap.settings.track === "auto" && current !== pickTrack()) {
    stopMusic();
    startMusic();
  }
}

/** Lower the music while a question is open; 1 = full. */
export function duck(level: number) {
  duckLevel = Math.max(0, Math.min(1, level));
  applyGains();
}

// ------------------------------------------------------------------ voice

let clip: HTMLAudioElement | null = null;
let clipSource: MediaElementAudioSourceNode | null = null;
let utter: SpeechSynthesisUtterance | null = null;

/** One spoken piece: a recorded clip if there is one, else the text through the browser voice. */
export type Piece = { url?: string | null; text: string };
let queue: Piece[] = [];
let token = 0;
// Where AneQue is inside the current caption, 0..1, for the word-by-word caption.
let pieceIndex = 0;
let pieceCount = 1;
let ttsChar = 0;
let ttsLen = 1;

// Best first. The Edge/Windows "Online (Natural)" neural voices (Ava, Jenny,
// Aria, Emma, Neerja for Indian English) and Apple's premium/enhanced voices
// sound close to a person; the old desktop SAPI voices (Zira) do not.
const FEMALE_HINTS = ["ava", "jenny", "aria", "emma", "neerja", "michelle", "sonia", "libby", "natasha", "samantha", "google uk english female", "allison", "susan", "victoria", "karen", "moira", "tessa", "serena", "zira", "female", "woman", "google us english"];

export function browserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("en"));
}

export function femaleScore(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  if (/\b(male|david|mark|daniel|alex|fred|george|james|guy|ryan)\b/.test(n) && !/female/.test(n)) return -1;
  const i = FEMALE_HINTS.findIndex((h) => n.includes(h));
  return (i < 0 ? 0 : 100 - i) + (/natural|neural/.test(n) ? 120 : /premium|enhanced/.test(n) ? 80 : 0) + (v.localService ? 0 : 5);
}

function pickVoice(): SpeechSynthesisVoice | null {
  // Hinglish (Latin script) reads far better in an Indian English voice.
  if (snap.settings.lang === "hi" && typeof window !== "undefined" && "speechSynthesis" in window) {
    const inVoices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase() === "en-in");
    const best = [...inVoices].sort((a, b) => femaleScore(b) - femaleScore(a))[0];
    if (best) return best;
  }
  const all = browserVoices();
  const chosen = snap.settings.voiceName;
  if (chosen && chosen !== "nova") {
    const v = all.find((x) => x.name === chosen);
    if (v) return v;
  }
  return [...all].sort((a, b) => femaleScore(b) - femaleScore(a))[0] ?? null;
}

function setVoice(v: Partial<VoiceState>) {
  emit({ voice: { ...snap.voice, ...v } });
  applyGains();
}

export function stopVoice() {
  token++;
  queue = [];
  clearWatchdog();
  if (clip) {
    clip.pause();
    clip.removeAttribute("src");
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  utter = null;
  if (snap.voice.speaking || snap.voice.paused) setVoice({ speaking: false, paused: false });
}

export function pauseVoice() {
  if (clip && !clip.paused) clip.pause();
  else if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.pause();
  setVoice({ paused: true });
}

export function resumeVoice() {
  if (clip && clip.getAttribute("src") && clip.paused) void clip.play().catch(() => {});
  else if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.resume();
  setVoice({ paused: false });
}

function canSpeak() {
  return !!scope && snap.settings.master && snap.settings.voice && snap.unlocked;
}

function ensureClip() {
  if (clip) return clip;
  clip = new Audio();
  clip.preload = "auto";
  const c = ensure();
  if (c && voiceBus) {
    try {
      clipSource = c.createMediaElementSource(clip);
      clipSource.connect(voiceBus);
    } catch {
      clipSource = null;
    }
  }
  return clip;
}

// Warms the browser cache with the NEXT clip while the current one plays, so
// there is no network gap between "Correct!" and the explanation on a phone.
let preloader: HTMLAudioElement | null = null;
function preload(url: string | null | undefined) {
  if (!url || typeof Audio === "undefined") return;
  try {
    preloader ??= new Audio();
    preloader.preload = "auto";
    if (preloader.getAttribute("src") !== url) {
      preloader.src = url;
      preloader.load();
    }
  } catch {
    /* preloading is only an optimisation */
  }
}

let watchdog: ReturnType<typeof setTimeout> | null = null;
function clearWatchdog() {
  if (watchdog) clearTimeout(watchdog);
  watchdog = null;
}

/**
 * Play the next queued piece; each piece resolves before the next starts.
 *
 * Every way a piece can end (ended, error, play() rejected, the watchdog) goes
 * through one `finish` that runs at most once. Before, a failing clip fired
 * BOTH `onerror` and the play() rejection, so the browser voice read the same
 * line twice and the queue advanced twice - AneQue skipped a piece and spoke
 * over herself ("the voice jumps around"). And a clip that stalled on a weak
 * connection never fired `ended`, so she went silent for good and every
 * queued explanation waited behind it.
 */
function pump(my: number) {
  if (my !== token) return;
  clearWatchdog();
  const piece = queue.shift();
  if (piece) {
    pieceIndex = pieceCount - queue.length - 1;
    ttsChar = 0;
    ttsLen = Math.max(1, piece.text.length);
  }
  if (!piece) {
    setVoice({ speaking: false, paused: false });
    return;
  }
  let settled = false;
  const done = () => {
    if (settled || my !== token) return;
    settled = true;
    clearWatchdog();
    pump(my);
  };
  const fallback = () => {
    if (settled || my !== token) return;
    settled = true;
    clearWatchdog();
    if (clip) {
      clip.onended = clip.onerror = clip.onloadedmetadata = null;
      clip.pause();
    }
    tts(piece.text, my, () => pump(my));
  };
  const useClip = piece.url && snap.settings.voiceName === "nova";
  if (useClip) {
    const a = ensureClip();
    if (!clipSource) a.volume = snap.settings.masterVol * snap.settings.voiceVol;
    a.onended = done;
    a.onerror = fallback;
    // Once the length is known, give it that long plus slack (pauses count as
    // playing time on purpose: a paused clip is restarted by resumeVoice).
    a.onloadedmetadata = () => {
      if (settled || my !== token || !Number.isFinite(a.duration)) return;
      clearWatchdog();
      const arm = () => {
        watchdog = setTimeout(() => {
          if (snap.voice.paused) return arm();
          if (!a.paused && a.currentTime < a.duration - 0.25) return arm();
          done();
        }, (a.duration - a.currentTime) * 1000 + 2500);
      };
      arm();
    };
    // Nothing at all after 8s (stalled download): read it with the browser voice.
    watchdog = setTimeout(fallback, 8000);
    a.src = piece.url!;
    void a.play().catch((e: unknown) => {
      // Interrupted by the next piece or by stopVoice: not a failure.
      if ((e as { name?: string })?.name === "AbortError") return;
      fallback();
    });
    preload(queue.find((p) => p.url)?.url);
    return;
  }
  tts(piece.text, my, done);
}

/**
 * The browser voice, in sentence-sized chunks. Chrome silently stops a single
 * utterance after about 15 seconds and some Android engines refuse long text
 * outright, so a long explanation used to just cut off mid-sentence.
 */
function tts(text: string, my: number, done: () => void) {
  if (my !== token) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return done();
  const chunks = chunkForSpeech(text, 180);
  if (!chunks.length) return done();
  let offset = 0;
  const next = (i: number) => {
    if (my !== token) return;
    if (i >= chunks.length) return done();
    const u = new SpeechSynthesisUtterance(chunks[i]);
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 1;
    // Neural voices are tuned at their natural pitch; nudging them sounds synthetic.
    u.pitch = v && /natural|neural|premium|enhanced/i.test(v.name) ? 1 : 1.05;
    u.volume = snap.settings.masterVol * snap.settings.voiceVol;
    const base = offset;
    u.onboundary = (e) => {
      ttsChar = base + e.charIndex;
    };
    let ended = false;
    const end = () => {
      if (ended || utter !== u) return;
      ended = true;
      clearWatchdog();
      offset += chunks[i].length + 1;
      next(i + 1);
    };
    u.onend = u.onerror = end;
    utter = u;
    window.speechSynthesis.speak(u);
    // Some Android/Chrome engines drop the end event now and then, which used to leave
    // AneQue "speaking" forever with everything after it stuck in the queue.
    clearWatchdog();
    const guard = () => {
      watchdog = setTimeout(() => (snap.voice.paused ? guard() : end()), 2500 + chunks[i].length * 110);
    };
    guard();
  };
  next(0);
}

/**
 * Speak a list of pieces in order with one caption. `queue: true` waits for
 * whatever AneQue is saying; otherwise it interrupts her.
 */
export function play(pieces: Piece[], opts: { caption?: string; line?: VoiceLine | null; queue?: boolean } = {}) {
  const caption = opts.caption ?? pieces.map((p) => p.text).join(" ");
  if (!opts.queue || !snap.voice.speaking) setVoice({ text: caption, line: opts.line ?? null });
  if (!canSpeak() || !pieces.length) return;
  if (opts.queue && snap.voice.speaking) {
    queue.push(...pieces);
    return;
  }
  stopVoice();
  const my = ++token;
  queue = [...pieces];
  pieceCount = pieces.length;
  pieceIndex = 0;
  setVoice({ speaking: true, paused: false, text: caption, line: opts.line ?? null });
  pump(my);
}

/**
 * Say a scripted line in AneQue's recorded voice. The caption always updates,
 * even when muted, so guidance is readable without sound. `auto` lines only
 * play when the member leaves "AneQue reacts on her own" on.
 */
export function say(line: VoiceLine, opts: { auto?: boolean; queue?: boolean } = {}) {
  if (!(line in VOICE_LINES)) return;
  const { text, url } = lineFor(line);
  if (opts.auto && !snap.settings.guide) {
    if (!snap.voice.speaking) setVoice({ text, line });
    return;
  }
  play([{ url, text }], { line, queue: opts.queue });
}

/**
 * A scripted line in the current language: Hinglish (caption + recording in
 * the same voice) when the learner chose it and it exists, else English.
 */
export function lineFor(line: VoiceLine): { text: string; url: string } {
  if (snap.settings.lang === "hi" && line in VOICE_LINES_HI) return { text: VOICE_LINES_HI[line]!, url: `/academy/voice/hi/${line}.mp3` };
  return { text: VOICE_LINES[line], url: `/academy/voice/${line}.mp3` };
}

/** Pick one of several variants of a line (correct_1..correct_10 etc.). */
export function sayOneOf(prefix: string, count: number, opts: { auto?: boolean; queue?: boolean } = {}) {
  const n = 1 + Math.floor(Math.random() * count);
  const key = (n === 1 && !(`${prefix}_1` in VOICE_LINES) ? prefix : `${prefix}_${n}`) as VoiceLine;
  say(key in VOICE_LINES ? key : (prefix as VoiceLine), opts);
}

/** Speak free text with the best available voice (no recording exists for it). */
export function speak(text: string) {
  play([{ text }]);
}

/** 0..1: how far AneQue is through the current caption (drives the word-by-word reveal). */
export function voiceProgress(): number {
  if (!snap.voice.speaking) return 1;
  let inPiece = 0;
  if (clip && clip.getAttribute("src") && !clip.paused && clip.duration > 0) inPiece = clip.currentTime / clip.duration;
  else inPiece = Math.min(1, ttsChar / ttsLen);
  return Math.max(0, Math.min(1, (pieceIndex + inPiece) / Math.max(1, pieceCount)));
}

/** 0..1 loudness of AneQue right now, for the orb. Browser speech cannot be measured, so it is animated. */
// One analyser read per animation frame, however many orbs and waves ask.
let lvlAt = -1;
let lvlVal = 0;
let lvlBuf: Uint8Array<ArrayBuffer> | null = null;
export function voiceLevel(t: number): number {
  if (!snap.voice.speaking || snap.voice.paused) return 0;
  if (analyser && clip && !clip.paused && clipSource) {
    if (t === lvlAt) return lvlVal;
    if (!lvlBuf || lvlBuf.length !== analyser.frequencyBinCount) lvlBuf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(lvlBuf);
    let sum = 0;
    for (let i = 2; i < 40; i++) sum += lvlBuf[i];
    lvlAt = t;
    lvlVal = Math.min(1, sum / (38 * 160));
    return lvlVal;
  }
  return 0.35 + 0.25 * Math.abs(Math.sin(t / 110)) * Math.abs(Math.sin(t / 47));
}
