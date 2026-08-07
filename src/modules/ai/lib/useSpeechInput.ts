"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useClientFlag } from "@/lib/useClientFlag";

// Browser-native speech-to-text. Zero cost and no dependency - but it is NOT a
// baseline feature: Chrome/Edge/Safari expose it (Safari behind the webkit
// prefix), Firefox does not. So `supported` is reported honestly and the caller
// hides the control entirely rather than showing a button that does nothing.
//
// `supported` goes through `useClientFlag` (useSyncExternalStore with a server
// snapshot of false) rather than being read during render. Reading `window`
// during render would make the server and client render different DOM - the
// exact hydration-mismatch class that has bitten this project hardest.

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function getCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechInput(onText: (text: string) => void) {
  const supported = useClientFlag(() => getCtor() !== null);
  const [listening, setListening] = useState(false);
  const ref = useRef<RecognitionLike | null>(null);
  // Keep the latest callback without re-creating the recognizer on every render.
  // Written in an effect, not during render - a ref write during render is a
  // side effect React is free to discard or double-invoke.
  const cb = useRef(onText);
  useEffect(() => {
    cb.current = onText;
  }, [onText]);

  const stop = useCallback(() => {
    ref.current?.abort();
    ref.current = null;
    setListening(false);
  }, []);

  useEffect(() => () => ref.current?.abort(), []);

  const start = useCallback(() => {
    if (listening) {
      stop();
      return;
    }
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = Array.from(e.results ?? [])
        .map((r: any) => r?.[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) cb.current(text);
    };
    // Permission denied, no mic, no network - all end the session. Nothing to
    // report beyond dropping out of the listening state; the member can type.
    rec.onerror = () => {
      ref.current = null;
      setListening(false);
    };
    rec.onend = () => {
      ref.current = null;
      setListening(false);
    };
    ref.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      ref.current = null;
      setListening(false);
    }
  }, [listening, stop]);

  return { supported, listening, start, stop };
}
