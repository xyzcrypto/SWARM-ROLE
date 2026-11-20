"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import { useRealtime } from "@/lib/useRealtime";
import { CH_ACADEMY } from "@/lib/realtime-channels";
import { getServerSnapshot, getSnapshot, subscribe } from "./audio";
import type { AcademyMe } from "@modules/academy/lib/me";

/** Audio settings + Nova's current line. Server snapshot = defaults, so hydration never differs. */
export function useAudio() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export type Me = AcademyMe;

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(body?.error || `Request failed (${res.status})`), { status: res.status });
  return body as T;
}

export const postJson = <T,>(url: string, data: unknown) => getJson<T>(url, { method: "POST", body: JSON.stringify(data) });

/**
 * The signed-in member's Academy dashboard. `status` mirrors the session so
 * the page can show the sign-in prompt instead of a spinner for guests.
 */
export function useMe() {
  const { status } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setMe(await getJson<Me>("/api/academy/me"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (status === "authenticated") void load();
    if (status === "unauthenticated") setMe(null);
  }, [status, load]);
  return { me, status, error, reload: load };
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
