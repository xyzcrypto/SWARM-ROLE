import "server-only";
import { kv } from "@/lib/ai/kv";

/**
 * Last known good value for an upstream market source.
 *
 * Why: the markets routes read keyless public APIs (CoinGecko, DefiLlama) from
 * Vercel's shared egress IPs, and those APIs rate-limit or refuse intermittently.
 * When a call failed, the route regenerated with that source missing and the
 * edge then served the gap for a whole window - the Perp DEX board showed five
 * venues as "-" in production while every one of them was fine a minute earlier.
 *
 * What it does: a good result is remembered (in this instance's memory, and in
 * Upstash when configured, so a cold instance can recover too). A failed or
 * empty result falls back to the remembered value **only while it is younger
 * than `maxAgeMs`**. Past that, the failure is returned as it is and the page
 * shows "-" rather than old numbers presented as live.
 *
 * Cost: Upstash writes are throttled to one per key per instance per
 * WRITE_EVERY_MS, and reads happen only on an upstream failure. With no Upstash
 * configured it degrades to memory only, like every other env integration here.
 */

const PREFIX = "mkt:lkg:v1:";
const WRITE_EVERY_MS = 5 * 60_000;
const KV_TIMEOUT_MS = 1500;
/** Redis keeps a value a day; `maxAgeMs` decides what is still usable. */
const KV_TTL_S = 24 * 60 * 60;

type Saved<T> = { t: number; v: T };

const memory = new Map<string, Saved<unknown>>();
const lastWrite = new Map<string, number>();

function withTimeout<T>(p: Promise<T>): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), KV_TIMEOUT_MS))]).catch(() => null);
}

async function remember<T>(key: string, v: T, now: number): Promise<void> {
  memory.set(key, { t: now, v });
  const redis = kv();
  if (!redis || now - (lastWrite.get(key) ?? 0) < WRITE_EVERY_MS) return;
  lastWrite.set(key, now);
  await withTimeout(redis.set(PREFIX + key, { t: now, v }, { ex: KV_TTL_S }));
}

async function recall<T>(key: string, maxAgeMs: number, now: number): Promise<T | null> {
  const mem = memory.get(key) as Saved<T> | undefined;
  if (mem && now - mem.t <= maxAgeMs) return mem.v;
  const redis = kv();
  if (!redis) return null;
  const saved = (await withTimeout(redis.get<Saved<T>>(PREFIX + key))) as Saved<T> | null;
  if (!saved || typeof saved.t !== "number" || now - saved.t > maxAgeMs) return null;
  memory.set(key, saved);
  return saved.v;
}

export type LastGoodOptions<T> = {
  /** What counts as a usable answer (e.g. a non-empty list). */
  isGood: (v: T) => boolean;
  /** Oldest remembered value that may still be shown. */
  maxAgeMs: number;
};

/**
 * Run `fresh`; remember it when good, otherwise return the remembered value if
 * it is recent enough. With nothing usable remembered, the original outcome is
 * returned (or re-thrown) unchanged, so callers keep their existing fallbacks.
 */
export async function lastGood<T>(key: string, fresh: () => Promise<T>, opts: LastGoodOptions<T>): Promise<T> {
  let value: T | undefined;
  let error: unknown;
  let failed = false;
  try {
    value = await fresh();
  } catch (e) {
    error = e;
    failed = true;
  }
  const now = Date.now();
  if (!failed && opts.isGood(value as T)) {
    await remember(key, value as T, now);
    return value as T;
  }
  const saved = await recall<T>(key, opts.maxAgeMs, now);
  if (saved !== null) return saved;
  if (failed) throw error;
  return value as T;
}

/** Test hook: forget everything held in memory. */
export function __resetLastGood(): void {
  memory.clear();
  lastWrite.clear();
}
