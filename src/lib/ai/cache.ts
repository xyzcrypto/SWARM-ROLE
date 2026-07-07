// Exact-match response cache for deterministic one-shot AI tasks (summaries,
// moderation, news why-matters/digest). NEVER used for the live-grounded chat
// assistant — those answers are time-sensitive. Backed by Upstash Redis when
// configured, else a bounded in-process LRU; both fail open (a cache miss/error
// just means we call the provider).
import { createHash } from "node:crypto";
import { kv } from "./kv";
import type { AiTask } from "./providers/types";

const TTL_SECONDS = 60 * 60 * 24; // 24h — the prompts are deterministic
const PREFIX = "xyz:ai:cache:";
const LRU_MAX = 500;

/** Deterministic key from the task + normalized input (same input → same key). */
export function cacheKey(task: AiTask, input: string): string {
  const norm = input.replace(/\s+/g, " ").trim().toLowerCase();
  return `${PREFIX}${task}:${createHash("sha256").update(norm).digest("hex")}`;
}

/** One-shot tasks are cacheable; the streamed assistant is not. */
export function isCacheable(task: AiTask): boolean {
  return task !== "assistant";
}

// In-process fallback (bounded). Map insertion order gives cheap LRU eviction.
const mem = new Map<string, { v: string; exp: number }>();
function memGet(key: string): string | null {
  const e = mem.get(key);
  if (!e) return null;
  if (e.exp < Date.now()) {
    mem.delete(key);
    return null;
  }
  mem.delete(key);
  mem.set(key, e); // refresh recency
  return e.v;
}
function memSet(key: string, v: string): void {
  mem.set(key, { v, exp: Date.now() + TTL_SECONDS * 1000 });
  if (mem.size > LRU_MAX) {
    const oldest = mem.keys().next().value;
    if (oldest) mem.delete(oldest);
  }
}

export async function getCached(key: string): Promise<string | null> {
  const redis = kv();
  if (redis) {
    try {
      const v = await redis.get<string>(key);
      return typeof v === "string" ? v : null;
    } catch {
      return null;
    }
  }
  return memGet(key);
}

export async function setCached(key: string, value: string): Promise<void> {
  if (!value) return;
  const redis = kv();
  if (redis) {
    try {
      await redis.set(key, value, { ex: TTL_SECONDS });
    } catch {
      /* ignore */
    }
    return;
  }
  memSet(key, value);
}
