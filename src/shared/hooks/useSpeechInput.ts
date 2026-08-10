"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useClientFlag } from "@/lib/useClientFlag";

// Browser-native speech-to-text, shared by every composer and search box.
//
// Zero cost and no dependency, but NOT a baseline feature: Chrome/Edge/Safari
// expose it (Safari behind the webkit prefix), Firefox does not. `supported` is
// reported honestly so callers hide the control rather than show a dead button.
//
// Three things the first version got wrong, all of which read as "voice doesn't
// work" to someone using it:
//   1. `interimResults` was off, so nothing appeared until the whole utterance
//      was finalised - several seconds of a live-looking button doing nothing
//      visible. Live partials are the feedback that proves it is listening.
//   2. Errors were swallowed. A denied mic permission or Chrome's `network`
//      failure just dropped out of the listening state with no explanation.
//      Now every failure produces a message the caller can show.
//   3. Stopping called `abort()`, which discards the result. Pressing the
//      button to finish dictating threw away what you had just said. `stop()`
//      finalises; `cancel()` is the one that discards.
//
// `supported` goes through `useClientFlag` (useSyncExternalStore with a server
// snapshot of false), never read during render - reading `window` in render is
// the hydration-mismatch class behind this project's worst bug.

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

function getCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Turn a SpeechRecognition error code into something worth showing a person. */
export function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      // Two very different causes share this code: the visitor declined the
      // browser prompt, or the site's own Permissions-Policy refused the mic
      // before the prompt could appear. The second is what actually shipped in
      // #259, so the message names the browser prompt without blaming it.
      return "Microphone unavailable. Check that this site is allowed to use your mic.";
    case "no-speech":
      return "Didn't catch that - try speaking again.";
    case "audio-capture":
      return "No microphone found.";
    case "network":
      // Chrome's recognizer is a Google service, so this fires on restricted
      // networks even though the page itself is loading fine.
      return "Speech service unreachable. Check your connection and try again.";
    case "aborted":
      return "";
    default:
      return "Voice input failed. You can type instead.";
  }
}

export type SpeechInput = {
  supported: boolean;
  listening: boolean;
  /** Live partial transcript while speaking; "" when idle. */
  interim: string;
  error: string | null;
  /** Toggle: starts listening, or finalises if already listening. */
  toggle: () => void;
  /** Discard the current utterance. */
  cancel: () => void;
  clearError: () => void;
};

export function useSpeechInput(onText: (text: string) => void, opts?: { continuous?: boolean }): SpeechInput {
  const supported = useClientFlag(() => getCtor() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<RecognitionLike | null>(null);
  // How many results from `e.results` have already been handed to the caller.
  //
  // ⚠️ This is what stops dictation doubling. With `continuous: true`,
  // `e.results` is CUMULATIVE - every event carries the whole session, not just
  // what changed - and `e.resultIndex` is only a hint about where the change
  // started. Chrome routinely fires a second event whose `resultIndex` still
  // covers a result that was already final, so looping from `resultIndex` and
  // emitting every final it sees delivered the same words twice. Counting what
  // has actually been delivered is the only reliable boundary.
  const deliveredRef = useRef(0);

  // Keep the latest callback without re-creating the recognizer. Written in an
  // effect, not during render - a ref write during render is a side effect
  // React is free to discard or double-invoke.
  const cb = useRef(onText);
  useEffect(() => {
    cb.current = onText;
  }, [onText]);

  const teardown = useCallback(() => {
    ref.current = null;
    deliveredRef.current = 0;
    setListening(false);
    setInterim("");
  }, []);

  const cancel = useCallback(() => {
    ref.current?.abort();
    teardown();
  }, [teardown]);

  useEffect(() => () => ref.current?.abort(), []);

  const toggle = useCallback(() => {
    // Already running: stop() finalises and lets onresult deliver the text.
    // abort() here would throw away what was just dictated.
    if (ref.current) {
      ref.current.stop();
      setListening(false);
      return;
    }

    const Ctor = getCtor();
    if (!Ctor) return;
    setError(null);

    const rec = new Ctor();
    rec.lang = (typeof navigator !== "undefined" && navigator.language) || "en-US";
    rec.continuous = opts?.continuous ?? false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);

    rec.onresult = (e: any) => {
      const results = e.results;
      let finalText = "";
      let partial = "";

      // Start from what we have already delivered, NOT from `e.resultIndex`.
      // Anything before this point has been emitted once and must never be
      // emitted again.
      for (let i = deliveredRef.current; i < results.length; i++) {
        const r = results[i];
        const t = r?.[0]?.transcript ?? "";
        if (r?.isFinal) {
          finalText += t;
          // Consume it the moment it is final, so the next event skips it.
          deliveredRef.current = i + 1;
        } else {
          partial += t;
        }
      }

      const done = finalText.trim();
      if (done) cb.current(done);
      // Interim is whatever is still un-finalised; once a chunk finalises its
      // partial text is gone, so this clears itself without a special case.
      setInterim(partial.trim());
    };

    rec.onerror = (e: any) => {
      const msg = speechErrorMessage(String(e?.error ?? ""));
      if (msg) setError(msg);
      teardown();
    };

    rec.onend = () => teardown();

    ref.current = rec;
    deliveredRef.current = 0;
    try {
      rec.start();
      // Chrome fires onstart, but Safari has been seen to skip it; set the flag
      // optimistically so the button always reflects the attempt.
      setListening(true);
    } catch {
      // start() throws if a recognizer is somehow already running.
      teardown();
      setError("Voice input is already running.");
    }
  }, [opts?.continuous, teardown]);

  return {
    supported,
    listening,
    interim,
    error,
    toggle,
    cancel,
    clearError: useCallback(() => setError(null), []),
  };
}
