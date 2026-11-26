"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import { useRealtime } from "@/lib/useRealtime";
import { CH_ACADEMY } from "@/lib/realtime-channels";
import { getServerSnapshot, getSnapshot, subscribe } from "./audio";
import type { AcademyMe } from "@modules/academy/lib/me";

/** Audio settings + AneQue's current line. Server snapshot = defaults, so hydration never differs. */
export function useAudio() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export type Me = AcademyMe;

/**
 * JSON fetch with a hard timeout. A request that never answers (a dropped
 * mobile connection, a stalled function) used to leave its button spinning
 * forever, which is the "stuck, I have to refresh" the owner kept hitting.
 * Now it fails after `timeoutMs` with a readable error the caller shows, and
 * the action can simply be tried again.
 */
export async function getJson<T>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), init?.timeoutMs ?? 15_000);
  init?.signal?.addEventListener("abort", () => ctl.abort());
  const lost = (e: unknown) =>
    Object.assign(new Error((e as Error)?.name === "AbortError" ? "The connection is slow. Try again." : "You seem to be offline. Try again."), { status: 0 });
  let res: Response;
  let body: { error?: string } | null = null;
  let garbled = false;
  try {
    res = await fetch(url, { ...init, signal: ctl.signal, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    // ⚠️ The timeout must also cover reading the body. It used to be cleared
    // as soon as the headers arrived, so a mobile connection that stalled
    // mid-body left `res.json()` pending forever: no error, no retry, and the
    // quiz sat on "Checking your answer…" until a refresh. A body that dies
    // half-way is now a lost connection (status 0), which withRetry retries.
    const text = await res.text();
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      garbled = true;
    }
  } catch (e) {
    throw lost(e);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw Object.assign(new Error(body?.error || `Request failed (${res.status})`), { status: res.status });
  // A 2xx whose body is not JSON (a proxy or captive-portal page) is not data.
  if (garbled && res.ok) throw Object.assign(new Error("The connection is slow. Try again."), { status: 0 });
  return body as T;
}

export const postJson = <T,>(url: string, data: unknown, opts?: { timeoutMs?: number }) => getJson<T>(url, { method: "POST", body: JSON.stringify(data), timeoutMs: opts?.timeoutMs });

/**
 * Quiz steps are small and must feel instant. With the general 15s timeout and
 * three tries, one dropped request kept "Checking your answer…" spinning for
 * up to ~47s, which nobody waits through: they refresh. 8s x 3 tries puts the
 * worst case near 26s, and a request lost on a mobile network now retries
 * after 8s instead of 15s.
 */
export const QUIZ_TIMEOUT_MS = 8_000;

/**
 * Retry a request that failed for a reason that is not the server saying no:
 * a dropped connection, a timeout (status 0) or a 5xx (a cold start that fell
 * over). 4xx answers are final and come straight back. The quiz uses this for
 * every step, so a flaky mobile connection costs a second, not a stuck screen
 * with a Retry button. Every quiz action is safe to repeat: the server answers
 * a repeated answer/next with 409 and the player re-syncs.
 */
export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const st = (e as { status?: number }).status ?? 0;
      if (st >= 400 && st < 500) throw e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }
  }
  throw last;
}

// One shared copy of /api/academy/me per page. Several components show parts
// of it (hero, dashboard, leaderboard, certificates); each fetching its own was
// two or three identical, fairly heavy requests on every Academy page.
let meCache: { data: Me | null; error: string | null; at: number; inflight: Promise<void> | null } = { data: null, error: null, at: 0, inflight: null };
const meListeners = new Set<() => void>();
const meEmit = () => meListeners.forEach((l) => l());

async function fetchMe(force = false) {
  if (meCache.inflight) return meCache.inflight;
  if (!force && meCache.data && Date.now() - meCache.at < 5_000) return;
  meCache.inflight = getJson<Me>("/api/academy/me")
    .then((d) => {
      meCache = { ...meCache, data: d, error: null, at: Date.now() };
    })
    .catch((e) => {
      meCache = { ...meCache, error: (e as Error).message };
    })
    .finally(() => {
      meCache.inflight = null;
      meEmit();
    });
  return meCache.inflight;
}

/**
 * The signed-in member's Academy dashboard. `status` mirrors the session so
 * the page can show the sign-in prompt instead of a spinner for guests.
 */
export function useMe(enabled = true) {
  const { status } = useSession();
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    meListeners.add(l);
    return () => {
      meListeners.delete(l);
    };
  }, []);
  useEffect(() => {
    if (status === "authenticated" && enabled) void fetchMe();
    if (status === "unauthenticated" && meCache.data) {
      meCache = { data: null, error: null, at: 0, inflight: null };
      meEmit();
    }
  }, [status, enabled]);
  const reload = useCallback(() => fetchMe(true), []);
  return { me: status === "authenticated" ? meCache.data : null, status, error: meCache.error, reload };
}

/**
 * Run `fn` when the Academy realtime ping arrives (someone earned XP, a
 * certificate was issued...), at most once per `minGapMs`. The endpoints it
 * refetches are edge-cached, so this cannot turn into an origin storm. Falls
 * back to a slow poll only while the realtime channel is down.
 */
export function useAcademyPing(fn: () => void | Promise<void>, minGapMs = 15_000, pollMs = 120_000) {
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef(fn);
  useEffect(() => {
    cb.current = fn;
  });
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useRealtime({
    channel: CH_ACADEMY,
    event: "academy",
    pollMs,
    onMessage: () => {
      const wait = Math.max(0, last.current + minGapMs - Date.now());
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        last.current = Date.now();
        void cb.current();
      }, wait + Math.random() * 1500);
    },
  });
}

/** Offset between the server's clock and this device's: serverNow - Date.now(). */
export function useServerClock() {
  const offset = useRef(0);
  const sync = useCallback((serverNow: number, sentAt: number) => {
    const rtt = Date.now() - sentAt;
    offset.current = serverNow + rtt / 2 - Date.now();
  }, []);
  const now = useCallback(() => Date.now() + offset.current, []);
  return useMemo(() => ({ sync, now }), [sync, now]);
}

/** Re-render every `ms` while `on` (for countdowns). */
export function useTicker(on: boolean, ms = 250) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [on, ms]);
}

/** A Hinglish translation of one string, with AneQue's recording of it. */
export type HiText = { text: string; voice: string | null };

/**
 * Academy language helpers. `tx(en, hi)` is the text to show and `vx(enUrl,
 * hi)` the recording to play: Hinglish when the learner chose it and a
 * translation exists, English otherwise.
 */
export function useLang() {
  const { settings } = useAudio();
  const hiOn = settings.lang === "hi";
  return useMemo(
    () => ({
      hiOn,
      tx: (en: string, hi?: HiText | null) => (hiOn && hi?.text ? hi.text : en),
      vx: (en: string | null, hi?: HiText | null) => (hiOn && hi?.text ? hi.voice : en),
    }),
    [hiOn]
  );
}
