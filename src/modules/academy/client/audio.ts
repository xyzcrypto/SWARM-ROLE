"use client";

// Academy sound: effects, an ambient music bed and Nova's voice, each on its
// own bus with its own switch and volume under one master. Everything is
// synthesised with Web Audio (original, nothing licensed, nothing to download)
// except Nova's pre-recorded lines, which are small mp3s fetched on first use.
//
// Browsers block audio until a user gesture, so nothing here makes a sound
// before unlock() runs from a click or tap. Settings persist per browser.

import { VOICE_LINES, type VoiceLine } from "./voice-lines";

export type Sfx = "click" | "select" | "correct" | "wrong" | "xp" | "levelup" | "tick" | "go" | "winner" | "achievement" | "whoosh";

export type AudioSettings = {
  master: boolean;
  masterVol: number;
  music: boolean;
  musicVol: number;
  sfx: boolean;
  sfxVol: number;
  voice: boolean;
  voiceVol: number;
  /** "nova" = the natural pre-recorded voice (+ best browser female voice for free text). */
  voiceName: string;
  /** Nova speaks on her own at key moments (welcome, results...). Off = only when asked. */
  guide: boolean;
};

export const DEFAULT_AUDIO: AudioSettings = {
  master: true,
  masterVol: 0.8,
  music: false,
  musicVol: 0.35,
  sfx: true,
  sfxVol: 0.6,
  voice: true,
  voiceVol: 0.9,
  voiceName: "nova",
  guide: true,
};

const KEY = "xyz:academy:audio:v1";
const clamp = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

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
      sfx: bool(v.sfx, DEFAULT_AUDIO.sfx),
      sfxVol: clamp(v.sfxVol, DEFAULT_AUDIO.sfxVol),
      voice: bool(v.voice, DEFAULT_AUDIO.voice),
      voiceVol: clamp(v.voiceVol, DEFAULT_AUDIO.voiceVol),
      voiceName: typeof v.voiceName === "string" && v.voiceName ? v.voiceName.slice(0, 120) : DEFAULT_AUDIO.voiceName,
      guide: bool(v.guide, DEFAULT_AUDIO.guide),
    };
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}

// ------------------------------------------------------------------ store

export type VoiceState = { speaking: boolean; paused: boolean; text: string; line: VoiceLine | null };

type Snapshot = { settings: AudioSettings; voice: VoiceState; unlocked: boolean };

const SERVER_SNAPSHOT: Snapshot = { settings: DEFAULT_AUDIO, voice: { speaking: false, paused: false, text: "", line: null }, unlocked: false };
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
  else if (patch.music || patch.master) startMusic();
  if (!settings.master || !settings.voice) stopVoice();
}

// ------------------------------------------------------------------ engine

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let voiceBus: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let duckLevel = 1;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      master = ctx.createGain();
      master.connect(ctx.destination);
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
  musicBus.gain.setTargetAtTime(s.music && musicOn ? s.musicVol * 0.5 * duckLevel : 0, t, 0.4);
}

/** Call from a click/tap handler; safe to call repeatedly. */
export function unlock() {
  if (!loaded) loadSettings();
  if (ensure() && !snap.unlocked) {
    emit({ unlocked: true });
    if (snap.settings.master && snap.settings.music) startMusic();
  }
}

type Tone = { f: number; to?: number; at: number; dur: number; type?: OscillatorType; gain?: number };
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

const SFX: Record<Sfx, Tone[]> = {
  click: [{ f: 1800, at: 0, dur: 0.035, type: "triangle", gain: 0.18 }],
  select: [{ f: 900, to: 1300, at: 0, dur: 0.07, type: "sine", gain: 0.22 }],
  correct: [
    { f: midi(76), at: 0, dur: 0.14, type: "triangle", gain: 0.35 },
    { f: midi(81), at: 0.09, dur: 0.16, type: "triangle", gain: 0.35 },
    { f: midi(88), at: 0.18, dur: 0.32, type: "sine", gain: 0.3 },
  ],
  wrong: [
    { f: midi(57), at: 0, dur: 0.18, type: "sine", gain: 0.35 },
    { f: midi(52), at: 0.12, dur: 0.32, type: "sine", gain: 0.3 },
  ],
  xp: [
    { f: midi(84), at: 0, dur: 0.08, type: "square", gain: 0.08 },
    { f: midi(88), at: 0.06, dur: 0.08, type: "square", gain: 0.08 },
    { f: midi(91), at: 0.12, dur: 0.14, type: "square", gain: 0.08 },
  ],
  levelup: [
    { f: midi(72), at: 0, dur: 0.18, type: "triangle", gain: 0.3 },
    { f: midi(76), at: 0.12, dur: 0.18, type: "triangle", gain: 0.3 },
    { f: midi(79), at: 0.24, dur: 0.18, type: "triangle", gain: 0.3 },
    { f: midi(84), at: 0.36, dur: 0.6, type: "triangle", gain: 0.32 },
    { f: midi(91), at: 0.36, dur: 0.7, type: "sine", gain: 0.18 },
  ],
  tick: [{ f: 1200, at: 0, dur: 0.03, type: "square", gain: 0.06 }],
  go: [
    { f: midi(67), at: 0, dur: 0.12, type: "triangle", gain: 0.3 },
    { f: midi(79), at: 0.1, dur: 0.35, type: "triangle", gain: 0.32 },
  ],
  winner: [
    { f: midi(72), at: 0, dur: 0.16, type: "triangle", gain: 0.3 },
    { f: midi(72), at: 0.16, dur: 0.16, type: "triangle", gain: 0.3 },
    { f: midi(72), at: 0.32, dur: 0.16, type: "triangle", gain: 0.3 },
    { f: midi(79), at: 0.5, dur: 0.5, type: "triangle", gain: 0.34 },
    { f: midi(84), at: 0.5, dur: 0.9, type: "sine", gain: 0.24 },
    { f: midi(88), at: 0.75, dur: 0.9, type: "sine", gain: 0.16 },
  ],
  achievement: [
    { f: midi(83), at: 0, dur: 0.12, type: "sine", gain: 0.28 },
    { f: midi(88), at: 0.08, dur: 0.12, type: "sine", gain: 0.28 },
    { f: midi(95), at: 0.16, dur: 0.5, type: "sine", gain: 0.24 },
  ],
  whoosh: [{ f: 300, to: 1600, at: 0, dur: 0.22, type: "sawtooth", gain: 0.05 }],
};

export function sfx(name: Sfx) {
  if (!snap.settings.master || !snap.settings.sfx) return;
  const c = ensure();
  if (!c || !sfxBus) return;
  const now = c.currentTime + 0.01;
  for (const t of SFX[name]) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = t.type ?? "sine";
    o.frequency.setValueAtTime(t.f, now + t.at);
    if (t.to) o.frequency.exponentialRampToValueAtTime(t.to, now + t.at + t.dur);
    const peak = t.gain ?? 0.25;
    g.gain.setValueAtTime(0.0001, now + t.at);
    g.gain.exponentialRampToValueAtTime(peak, now + t.at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t.at + t.dur);
    o.connect(g).connect(sfxBus);
    o.start(now + t.at);
    o.stop(now + t.at + t.dur + 0.05);
  }
}

// ------------------------------------------------------------------ music

let musicOn = false;
let musicTimer: ReturnType<typeof setTimeout> | null = null;
let chordIdx = 0;

// Am9 - Fmaj9 - Cmaj9 - G6, slow and wide: a calm bed, not a tune.
const CHORDS = [
  [45, 57, 60, 64, 71],
  [41, 53, 57, 64, 67],
  [48, 55, 59, 64, 71],
  [43, 55, 59, 62, 64],
];
const CHORD_SEC = 8;

function playChord() {
  const c = ensure();
  if (!c || !musicBus || !musicOn) return;
  const now = c.currentTime;
  const chord = CHORDS[chordIdx++ % CHORDS.length];
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(700, now);
  filter.frequency.linearRampToValueAtTime(1400, now + CHORD_SEC / 2);
  filter.frequency.linearRampToValueAtTime(700, now + CHORD_SEC + 2);
  filter.connect(musicBus);
  chord.forEach((n, i) => {
    for (const detune of [-6, 6]) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = midi(n);
      o.detune.value = detune;
      const peak = i === 0 ? 0.09 : 0.035;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(peak, now + 2.5);
      g.gain.setValueAtTime(peak, now + CHORD_SEC - 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, now + CHORD_SEC + 2.5);
      o.connect(g).connect(filter);
      o.start(now);
      o.stop(now + CHORD_SEC + 2.6);
    }
  });
  // a soft high glint now and then
  if (chordIdx % 2 === 0) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = midi(chord[chord.length - 1] + 12);
    g.gain.setValueAtTime(0.0001, now + 3);
    g.gain.exponentialRampToValueAtTime(0.02, now + 3.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 5);
    o.connect(g).connect(musicBus);
    o.start(now + 3);
    o.stop(now + 5.1);
  }
  musicTimer = setTimeout(playChord, CHORD_SEC * 1000);
}

export function startMusic() {
  if (musicOn || !snap.settings.master || !snap.settings.music || !snap.unlocked) return;
  if (!ensure()) return;
  musicOn = true;
  applyGains();
  playChord();
}

export function stopMusic() {
  musicOn = false;
  if (musicTimer) clearTimeout(musicTimer);
  musicTimer = null;
  applyGains();
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

/** Female-sounding browser voices, best first. Names vary by OS and browser. */
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

export function stopVoice() {
  if (clip) {
    clip.pause();
    clip.currentTime = 0;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  utter = null;
  if (snap.voice.speaking || snap.voice.paused) emit({ voice: { ...snap.voice, speaking: false, paused: false } });
}

export function pauseVoice() {
  if (clip && !clip.paused) clip.pause();
  else if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.pause();
  emit({ voice: { ...snap.voice, paused: true } });
}

export function resumeVoice() {
  if (clip && snap.voice.line && clip.paused && clip.currentTime > 0) void clip.play().catch(() => {});
  else if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.resume();
  emit({ voice: { ...snap.voice, paused: false } });
}

/**
 * Say a scripted line with the natural recorded voice (or, if the member picked
 * a browser voice, with that). The caption always updates, even when muted, so
 * the guidance is readable without sound.
 */
export function say(line: VoiceLine, opts: { auto?: boolean } = {}) {
  const text = VOICE_LINES[line];
  emit({ voice: { speaking: false, paused: false, text, line } });
  if (opts.auto && !snap.settings.guide) return;
  if (!snap.settings.master || !snap.settings.voice || !snap.unlocked) return;
  if (snap.settings.voiceName !== "nova") return speak(text, { keepLine: line });
  const c = ensure();
  stopVoice();
  if (!clip) {
    clip = new Audio();
    clip.preload = "auto";
    clip.crossOrigin = "anonymous";
    clip.addEventListener("ended", () => emit({ voice: { ...snap.voice, speaking: false, paused: false } }));
    clip.addEventListener("error", () => {
      // Clip missing or blocked: fall back to the browser voice for the same words.
      const l = snap.voice.line;
      if (l) speak(VOICE_LINES[l], { keepLine: l });
    });
    if (c && voiceBus) {
      try {
        clipSource = c.createMediaElementSource(clip);
        clipSource.connect(voiceBus);
      } catch {
        clipSource = null;
      }
    }
  }
  if (!clipSource) clip.volume = snap.settings.masterVol * snap.settings.voiceVol;
  clip.src = `/academy/voice/${line}.mp3`;
  emit({ voice: { speaking: true, paused: false, text, line } });
  void clip.play().catch(() => emit({ voice: { ...snap.voice, speaking: false } }));
}

/** Speak free text (a question, an explanation) with the best available browser voice. */
export function speak(text: string, opts: { keepLine?: VoiceLine } = {}) {
  emit({ voice: { speaking: false, paused: false, text, line: opts.keepLine ?? null } });
  if (!snap.settings.master || !snap.settings.voice || !snap.unlocked) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  stopVoice();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = 1;
  u.pitch = 1.05;
  u.volume = snap.settings.masterVol * snap.settings.voiceVol;
  u.onstart = () => emit({ voice: { speaking: true, paused: false, text, line: opts.keepLine ?? null } });
  u.onend = u.onerror = () => {
    if (utter === u) emit({ voice: { ...snap.voice, speaking: false, paused: false } });
  };
  utter = u;
  window.speechSynthesis.speak(u);
  emit({ voice: { speaking: true, paused: false, text, line: opts.keepLine ?? null } });
}

/** 0..1 loudness of Nova right now, for the orb. Browser TTS cannot be measured, so it is animated. */
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
