// The XYZ AI gateway: routes a task to a model, then tries the configured
// provider chain with per-attempt timeouts, bounded retries (transient errors),
// and automatic fallback to the next provider on genuine failure. It never
// rotates keys or multiplies free quota — fallback fires only on real failures.
import type { AiPlan, AiProvider, AiTask, CompleteResult, StreamHandle, StreamRequest } from "./providers/types";
import { providerChain } from "./registry";
import { routeTier } from "./routing";

const STREAM_CONNECT_TIMEOUT_MS = 20_000; // time-to-first-response for streams
const COMPLETE_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2; // per provider, transient errors only

export type GatewayCtx = { userId?: string | null; plan?: AiPlan; isAdmin?: boolean };

/** All configured providers failed (or none are configured). Routes turn this into graceful UI. */
export class AiCapacityError extends Error {
  reason: "no_provider" | "all_failed";
  constructor(reason: "no_provider" | "all_failed", options?: { cause?: unknown }) {
    super(reason === "no_provider" ? "No AI provider is configured." : "All AI providers failed.");
    this.name = "AiCapacityError";
    this.reason = reason;
    if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

/**
 * Decide what to do with a provider error:
 *  - "fatal"   → surface immediately (content blocked/safety; the user must rephrase).
 *  - "retry"   → transient (5xx/network/timeout); retry the SAME provider with backoff.
 *  - "failover"→ this provider is out (429/quota/auth/key); move to the NEXT provider.
 */
export function classifyError(err: unknown): "fatal" | "retry" | "failover" {
  const s = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (/(safety|blocked|content.?filter|flagged|recitation)/.test(s)) return "fatal";
  if (/(429|resource_exhausted|quota|rate.?limit|too many requests|api.?key|401|403|permission.?denied|unauthorized|invalid.*key)/.test(s))
    return "failover";
  if (/(50\d|timeout|timed out|aborted|abort|econnreset|network|fetch failed|unavailable|overloaded|socket)/.test(s))
    return "retry";
  return "failover"; // unknown → be lenient and try the next provider
}

function backoff(attempt: number): Promise<void> {
  return new Promise((r) => setTimeout(r, 250 * Math.pow(4, attempt))); // 250ms, 1s
}

/** Run `fn` with an abort deadline; the timer is cleared once `fn` resolves so a
 *  successfully-opened stream is never aborted mid-flight. */
async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error("timeout")), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

/** Map a SessionUser-ish object to its effective AI plan. */
export function aiPlanFor(u: { membership?: string | null; role?: string | null; isSuperAdmin?: boolean | null } | null): AiPlan {
  if (!u) return "Free";
  if (u.isSuperAdmin || u.role === "ADMIN") return "Admin";
  return u.membership === "Premium" ? "Premium" : "Free";
}

// --- one-shot completion ---------------------------------------------------

export async function runComplete(
  task: AiTask,
  req: { system?: string; prompt: string; maxTokens: number },
  _ctx: GatewayCtx = {},
  chain: AiProvider[] = providerChain()
): Promise<CompleteResult & { provider: string; model: string }> {
  if (!chain.length) throw new AiCapacityError("no_provider");
  const tier = routeTier(task);
  let lastErr: unknown;
  for (const provider of chain) {
    const model = provider.models[tier];
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await withTimeout(COMPLETE_TIMEOUT_MS, (signal) => provider.complete({ ...req, model, signal }));
        return { ...res, provider: provider.id, model };
      } catch (err) {
        lastErr = err;
        const kind = classifyError(err);
        if (kind === "fatal") throw err;
        if (kind === "retry" && attempt < MAX_RETRIES) {
          await backoff(attempt);
          continue;
        }
        break; // exhausted retries or failover → next provider
      }
    }
  }
  throw new AiCapacityError("all_failed", { cause: lastErr });
}

// --- streaming chat --------------------------------------------------------
// Failover is only possible before the first byte is sent. Connection/first-
// response errors (429, auth, 5xx at connect) are thrown by streamChat() and
// trigger failover here; errors mid-generation propagate to the caller (which
// appends an inline error) since we can't un-send bytes.

export async function runStream(
  task: AiTask,
  req: { system: string; messages: StreamRequest["messages"]; maxTokens: number },
  _ctx: GatewayCtx = {},
  chain: AiProvider[] = providerChain()
): Promise<StreamHandle & { provider: string; model: string }> {
  if (!chain.length) throw new AiCapacityError("no_provider");
  const tier = routeTier(task);
  let lastErr: unknown;
  for (const provider of chain) {
    const model = provider.models[tier];
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const handle = await withTimeout(STREAM_CONNECT_TIMEOUT_MS, (signal) => provider.streamChat({ ...req, model, signal }));
        return { ...handle, provider: provider.id, model };
      } catch (err) {
        lastErr = err;
        const kind = classifyError(err);
        if (kind === "fatal") throw err;
        if (kind === "retry" && attempt < MAX_RETRIES) {
          await backoff(attempt);
          continue;
        }
        break;
      }
    }
  }
  throw new AiCapacityError("all_failed", { cause: lastErr });
}
