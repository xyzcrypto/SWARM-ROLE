"use client";

// Academy sound: effects, three music tracks and Nova's voice, each on its own
// bus with its own switch and volume under one master.
//
// Effects and music are synthesised with Web Audio: original, nothing
// licensed, nothing to download. Nova's voice is a set of recorded mp3s (her
// scripted lines, plus every question, option, explanation and lesson summary
// of the starter curriculum), fetched one at a time when she speaks; anything
// without a recording is read by the browser's best female voice.
//
// Browsers block audio until a user gesture, so nothing here makes a sound
// before unlock() runs from a click or tap. Settings persist per browser.

import { VOICE_LINES, type VoiceLine } from "./voice-lines";

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
  | "pop";

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
  /** Nova reacts on her own at key moments (welcome, answers, results...). */
  guide: boolean;
  /** Nova reads each new question aloud. */
  readQuestions: boolean;
  /** After a wrong answer, Nova reads the explanation. */
  explainWrong: boolean;
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

// ------------------------------------------------------------------ engine

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let voiceBus: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let noise: AudioBuffer | null = null;
let duckLevel = 1;

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
  // Music steps back while Nova talks or a question is open.
  const voiceDuck = snap.voice.speaking && !snap.voice.paused ? 0.45 : 1;
  musicBus.gain.setTargetAtTime(s.music && musicOn ? s.musicVol * 0.55 * duckLevel * voiceDuck : 0, t, 0.35);
}

/** Call from a click/tap handler; safe to call repeatedly. */
export function unlock() {
  if (!loaded) loadSettings();
  if (ensure() && !snap.unlocked) {
    emit({ unlocked: true });
    if (snap.settings.master && snap.settings.music) startMusic();
  }
}

type Tone = { f: number; to?: number; at: number; dur: number; type?: OscillatorType; gain?: number; noise?: boolean; hp?: number };
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

const SFX: Record<Sfx, Tone[]> = {
  click: [{ f: 1800, at: 0, dur: 0.035, type: "triangle", gain: 0.16 }],
  hover: [{ f: 2600, at: 0, dur: 0.018, type: "sine", gain: 0.05 }],
  select: [{ f: 900, to: 1300, at: 0, dur: 0.07, type: "sine", gain: 0.22 }],
  correct: [
    { f: midi(76), at: 0, dur: 0.14, type: "triangle", gain: 0.35 },
    { f: midi(81), at: 0.09, dur: 0.16, type: "triangle", gain: 0.35 },
    { f: midi(88), at: 0.18, dur: 0.34, type: "sine", gain: 0.3 },
  ],
  wrong: [
    { f: midi(57), at: 0, dur: 0.18, type: "sine", gain: 0.35 },
    { f: midi(52), at: 0.12, dur: 0.34, type: "sine", gain: 0.3 },
  ],
  xp: [
    { f: midi(84), at: 0, dur: 0.08, type: "square", gain: 0.07 },
    { f: midi(88), at: 0.06, dur: 0.08, type: "square", gain: 0.07 },
    { f: midi(91), at: 0.12, dur: 0.14, type: "square", gain: 0.07 },
  ],
  coin: [
    { f: midi(83), at: 0, dur: 0.06, type: "square", gain: 0.08 },
    { f: midi(88), at: 0.05, dur: 0.22, type: "square", gain: 0.08 },
  ],
  levelup: [
    { f: midi(72), at: 0, dur: 0.18, type: "triangle", gain: 0.3 },
    { f: midi(76), at: 0.12, dur: 0.18, type: "triangle", gain: 0.3 },
    { f: midi(79), at: 0.24, dur: 0.18, type: "triangle", gain: 0.3 },
    { f: midi(84), at: 0.36, dur: 0.7, type: "triangle", gain: 0.32 },
    { f: midi(88), at: 0.36, dur: 0.8, type: "sine", gain: 0.2 },
    { f: midi(91), at: 0.36, dur: 0.9, type: "sine", gain: 0.14 },
    { f: 0, at: 0.3, dur: 0.6, noise: true, hp: 6000, gain: 0.06 },
  ],
  tick: [{ f: 1200, at: 0, dur: 0.03, type: "square", gain: 0.05 }],
  count: [{ f: midi(81), at: 0, dur: 0.16, type: "triangle", gain: 0.28 }],
  go: [
    { f: midi(67), at: 0, dur: 0.12, type: "triangle", gain: 0.3 },
    { f: midi(79), at: 0.1, dur: 0.38, type: "triangle", gain: 0.32 },
  ],
  heartbeat: [
    { f: 70, to: 45, at: 0, dur: 0.12, type: "sine", gain: 0.5 },
    { f: 66, to: 42, at: 0.16, dur: 0.12, type: "sine", gain: 0.38 },
  ],
  winner: [
    { f: midi(72), at: 0, dur: 0.16, type: "triangle", gain: 0.3 },
    { f: midi(72), at: 0.16, dur: 0.16, type: "triangle", gain: 0.3 },
    { f: midi(72), at: 0.32, dur: 0.16, type: "triangle", gain: 0.3 },
    { f: midi(79), at: 0.5, dur: 0.5, type: "triangle", gain: 0.34 },
    { f: midi(84), at: 0.5, dur: 0.9, type: "sine", gain: 0.24 },
    { f: midi(88), at: 0.75, dur: 0.9, type: "sine", gain: 0.16 },
    { f: 0, at: 0.5, dur: 1.0, noise: true, hp: 7000, gain: 0.05 },
  ],
  achievement: [
    { f: midi(83), at: 0, dur: 0.12, type: "sine", gain: 0.28 },
    { f: midi(88), at: 0.08, dur: 0.12, type: "sine", gain: 0.28 },
    { f: midi(95), at: 0.16, dur: 0.55, type: "sine", gain: 0.24 },
  ],
  whoosh: [{ f: 0, at: 0, dur: 0.22, noise: true, hp: 2500, gain: 0.08 }],
  fifty: [
    { f: 1400, to: 300, at: 0, dur: 0.25, type: "sawtooth", gain: 0.05 },
    { f: 0, at: 0, dur: 0.2, noise: true, hp: 3000, gain: 0.06 },
  ],
  fire: [
    { f: 0, at: 0, dur: 0.35, noise: true, hp: 1200, gain: 0.08 },
    { f: midi(79), at: 0.05, dur: 0.12, type: "triangle", gain: 0.2 },
    { f: midi(86), at: 0.14, dur: 0.26, type: "triangle", gain: 0.2 },
  ],
  lock: [
    { f: 520, at: 0, dur: 0.05, type: "square", gain: 0.1 },
    { f: 780, at: 0.05, dur: 0.08, type: "square", gain: 0.08 },
  ],
  reveal: [
    ...Array.from({ length: 10 }, (_, i) => ({ f: 0, at: i * 0.045, dur: 0.04, noise: true, hp: 900, gain: 0.04 + i * 0.006 })),
    { f: midi(74), at: 0.46, dur: 0.3, type: "triangle" as OscillatorType, gain: 0.25 },
  ],
  pop: [{ f: 600, to: 1600, at: 0, dur: 0.06, type: "sine", gain: 0.2 }],
};

function playTones(tones: Tone[], bus: GainNode, at = 0) {
  const c = ctx!;
  const now = c.currentTime + 0.01 + at;
  for (const t of tones) {
    const g = c.createGain();
    const peak = t.gain ?? 0.25;
    g.gain.setValueAtTime(0.0001, now + t.at);
    g.gain.exponentialRampToValueAtTime(peak, now + t.at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t.at + t.dur);
    if (t.noise && noise) {
      const src = c.createBufferSource();
      src.buffer = noise;
      const f = c.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = t.hp ?? 2000;
      src.connect(f).connect(g).connect(bus);
      src.start(now + t.at, Math.random() * 0.5);
      src.stop(now + t.at + t.dur + 0.05);
    } else {
      const o = c.createOscillator();
      o.type = t.type ?? "sine";
      o.frequency.setValueAtTime(t.f, now + t.at);
      if (t.to) o.frequency.exponentialRampToValueAtTime(t.to, now + t.at + t.dur);
      o.connect(g).connect(bus);
      o.start(now + t.at);
      o.stop(now + t.at + t.dur + 0.05);
    }
  }
}

let lastHover = 0;
export function sfx(name: Sfx) {
  if (!snap.settings.master || !snap.settings.sfx) return;
  if (name === "hover") {
    if (performance.now() - lastHover < 60) return;
    lastHover = performance.now();
  }
  const c = ensure();
  if (!c || !sfxBus) return;
  playTones(SFX[name], sfxBus);
}

// ------------------------------------------------------------------ music
//
// Three generative tracks on one look-ahead scheduler (a 16th-note grid,
// notes queued 150ms ahead), all on Am9 - Fmaj9 - Cmaj9 - G6 so switching
// never clashes:
//   focus  slow wide pads for reading and lessons
//   arena  112 bpm pulse: soft kick, hats, bass and a plucked arp, for quizzes
//   night  76 bpm lo-fi keys with a brushed beat

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

function note(n: number, at: number, dur: number, type: OscillatorType, gain: number, cutoff = 2400, detune = 0) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = cutoff;
  o.type = type;
  o.frequency.value = midi(n);
  o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.02, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(f).connect(g).connect(musicBus!);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function kick(at: number, gain = 0.35) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(120, at);
  o.frequency.exponentialRampToValueAtTime(40, at + 0.18);
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
  o.connect(g).connect(musicBus!);
  o.start(at);
  o.stop(at + 0.3);
}

function hat(at: number, gain = 0.05, len = 0.04, hp = 7000) {
  const c = ctx!;
  if (!noise) return;
  const s = c.createBufferSource();
  s.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  s.connect(f).connect(g).connect(musicBus!);
  s.start(at, Math.random() * 0.5);
  s.stop(at + len + 0.02);
}

function scheduleStep(track: Exclude<Track, "auto">, i: number, at: number, sixteenth: number) {
  const bar = Math.floor(i / 16);
  const s = i % 16;
  const chord = CHORDS[Math.floor(bar / (track === "focus" ? 1 : 2)) % CHORDS.length];
  if (track === "focus") {
    if (s === 0) {
      const len = sixteenth * 16 + 2;
      chord.forEach((n, k) => {
        note(n, at, len, k === 0 ? "sine" : "triangle", k === 0 ? 0.07 : 0.028, 1200, -6);
        if (k > 0) note(n, at, len, "triangle", 0.028, 1200, 6);
      });
    }
    if (s === 8 && bar % 2 === 1) note(chord[chord.length - 1] + 12, at, 1.6, "sine", 0.025, 4000);
    return;
  }
  if (track === "arena") {
    if (s % 4 === 0) kick(at, s === 0 ? 0.32 : 0.24);
    if (s % 4 === 2) hat(at, 0.045);
    if (s % 2 === 1) hat(at, 0.018, 0.02, 9000);
    if (s % 2 === 0) note(chord[0] - 12 + (s % 8 === 6 ? 7 : 0), at, sixteenth * 1.8, "sawtooth", 0.05, 500);
    const arp = [chord[1], chord[2], chord[3], chord[4], chord[3], chord[2]];
    if (s % 2 === 0) note(arp[(s / 2) % arp.length] + 12, at, sixteenth * 1.4, "triangle", 0.03, 3200);
    if (s === 0 && bar % 2 === 0) chord.slice(1).forEach((n) => note(n, at, sixteenth * 30, "triangle", 0.012, 900));
    return;
  }
  // night
  if (s === 0 || s === 10) kick(at, 0.2);
  if (s === 4 || s === 12) hat(at, 0.06, 0.12, 1800);
  if (s % 2 === 0) hat(at, 0.012, 0.03, 8000);
  const keys = [0, 3, 6, 10, 12];
  if (keys.includes(s)) note(chord[1 + (keys.indexOf(s) % 4)], at + 0.012 * Math.random(), sixteenth * 5, "triangle", 0.045, 1500);
  if (s === 0) note(chord[0] - 12, at, sixteenth * 14, "sine", 0.09, 400);
}

function pickTrack(): Exclude<Track, "auto"> {
  const t = snap.settings.track;
  return t === "auto" ? (scene === "arena" ? "arena" : "focus") : t;
}

export function startMusic() {
  if (musicOn || !snap.settings.master || !snap.settings.music || !snap.unlocked) return;
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

const FEMALE_HINTS = ["samantha", "ava", "allison", "susan", "victoria", "karen", "moira", "tessa", "serena", "zira", "aria", "jenny", "sonia", "libby", "natasha", "female", "woman", "google uk english female", "google us english"];

export function browserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("en"));
}

export function femaleScore(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  if (/\b(male|david|mark|daniel|alex|fred|george|james|guy|ryan)\b/.test(n) && !/female/.test(n)) return -1;
  const i = FEMALE_HINTS.findIndex((h) => n.includes(h));
  return (i < 0 ? 0 : 100 - i) + (/natural|neural|premium|enhanced/.test(n) ? 50 : 0) + (v.localService ? 0 : 5);
}

function pickVoice(): SpeechSynthesisVoice | null {
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
  return snap.settings.master && snap.settings.voice && snap.unlocked;
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

/** Play the next queued piece; each piece resolves before the next starts. */
function pump(my: number) {
  if (my !== token) return;
  const piece = queue.shift();
  if (!piece) {
    setVoice({ speaking: false, paused: false });
    return;
  }
  const done = () => pump(my);
  const useClip = piece.url && snap.settings.voiceName === "nova";
  if (useClip) {
    const a = ensureClip();
    if (!clipSource) a.volume = snap.settings.masterVol * snap.settings.voiceVol;
    a.onended = done;
    a.onerror = () => tts(piece.text, my, done);
    a.src = piece.url!;
    void a.play().catch(() => tts(piece.text, my, done));
    return;
  }
  tts(piece.text, my, done);
}

function tts(text: string, my: number, done: () => void) {
  if (my !== token) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return done();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = 1;
  u.pitch = 1.05;
  u.volume = snap.settings.masterVol * snap.settings.voiceVol;
  u.onend = u.onerror = () => {
    if (utter === u) done();
  };
  utter = u;
  window.speechSynthesis.speak(u);
}

/**
 * Speak a list of pieces in order with one caption. `queue: true` waits for
 * whatever Nova is saying; otherwise it interrupts her.
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
  setVoice({ speaking: true, paused: false, text: caption, line: opts.line ?? null });
  pump(my);
}

/**
 * Say a scripted line in Nova's recorded voice. The caption always updates,
 * even when muted, so guidance is readable without sound. `auto` lines only
 * play when the member leaves "Nova reacts on her own" on.
 */
export function say(line: VoiceLine, opts: { auto?: boolean; queue?: boolean } = {}) {
  if (!(line in VOICE_LINES)) return;
  const text = VOICE_LINES[line];
  if (opts.auto && !snap.settings.guide) {
    if (!snap.voice.speaking) setVoice({ text, line });
    return;
  }
  play([{ url: `/academy/voice/${line}.mp3`, text }], { line, queue: opts.queue });
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

/** 0..1 loudness of Nova right now, for the orb. Browser speech cannot be measured, so it is animated. */
export function voiceLevel(t: number): number {
  if (!snap.voice.speaking || snap.voice.paused) return 0;
  if (analyser && clip && !clip.paused && clipSource) {
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(buf);
    let sum = 0;
    for (let i = 2; i < 40; i++) sum += buf[i];
    return Math.min(1, sum / (38 * 160));
  }
  return 0.35 + 0.25 * Math.abs(Math.sin(t / 110)) * Math.abs(Math.sin(t / 47));
}
