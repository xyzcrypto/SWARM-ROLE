// The XYZ AI gateway: routes a task to a model, then tries the configured
// provider chain with per-attempt timeouts, bounded retries (transient errors),
// and automatic fallback to the next provider on genuine failure. It never
// rotates keys or multiplies free quota — fallback fires only on real failures.
import type { AiPlan, AiProvider, AiTask, CompleteResult, StreamHandle, StreamRequest, TokenUsage } from "./providers/types";
import { providerChain } from "./registry";
import { routeTier } from "./routing";
import { estimateTokens, estimateCostUsdMicros } from "./pricing";
import { recordAiUsage, errorKindOf } from "./usage";

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
  ctx: GatewayCtx = {},
  chain: AiProvider[] = providerChain()
): Promise<CompleteResult & { provider: string; model: string }> {
  if (!chain.length) throw new AiCapacityError("no_provider");
  const tier = routeTier(task);
  const started = Date.now();
  const firstId = chain[0]?.id;
  const inputEst = estimateTokens(`${req.system ?? ""} ${req.prompt}`);
  let lastErr: unknown;
  for (const provider of chain) {
    const model = provider.models[tier];
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await withTimeout(COMPLETE_TIMEOUT_MS, (signal) => provider.complete({ ...req, model, signal }));
        const usage: TokenUsage = res.usage ?? { inputTokens: inputEst, outputTokens: estimateTokens(res.text) };
        await recordAiUsage({
          userId: ctx.userId ?? null,
          provider: provider.id,
          model,
          task,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          latencyMs: Date.now() - started,
          status: provider.id === firstId ? "ok" : "fallback",
          estCostUsdMicros: estimateCostUsdMicros(model, usage),
        });
        return { ...res, provider: provider.id, model };
      } catch (err) {
        lastErr = err;
        const kind = classifyError(err);
        if (kind === "fatal") {
          await recordAiUsage(errorRow(ctx, provider.id, model, task, started, err));
          throw err;
        }
        if (kind === "retry" && attempt < MAX_RETRIES) {
          await backoff(attempt);
          continue;
        }
        break; // exhausted retries or failover → next provider
      }
    }
  }
  await recordAiUsage(errorRow(ctx, "none", tier, task, started, lastErr));
  throw new AiCapacityError("all_failed", { cause: lastErr });
}

function errorRow(ctx: GatewayCtx, provider: string, model: string, task: AiTask, started: number, err: unknown) {
  return {
    userId: ctx.userId ?? null,
    provider,
    model,
    task,
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: Date.now() - started,
    status: "error" as const,
    errorKind: errorKindOf(err),
    estCostUsdMicros: 0,
  };
}

// --- streaming chat --------------------------------------------------------
// Failover is only possible before the first byte is sent. Connection/first-
// response errors (429, auth, 5xx at connect) are thrown by streamChat() and
// trigger failover here; errors mid-generation propagate to the caller (which
// appends an inline error) since we can't un-send bytes.

export async function runStream(
  task: AiTask,
  req: { system: string; messages: StreamRequest["messages"]; maxTokens: number },
  ctx: GatewayCtx = {},
  chain: AiProvider[] = providerChain()
): Promise<StreamHandle & { provider: string; model: string }> {
  if (!chain.length) throw new AiCapacityError("no_provider");
  const tier = routeTier(task);
  const started = Date.now();
  const firstId = chain[0]?.id;
  const inputEst = estimateTokens(`${req.system} ${req.messages.map((m) => m.content).join(" ")}`);
  let lastErr: unknown;

  for (const provider of chain) {
    const model = provider.models[tier];
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const handle = await withTimeout(STREAM_CONNECT_TIMEOUT_MS, (signal) => provider.streamChat({ ...req, model, signal }));
        // Wrap the stream so we record one usage row once it's fully consumed
        // (output tokens known then) or if it errors mid-generation.
        let outChars = 0;
        const wrapped = (async function* () {
          try {
            for await (const delta of handle.stream) {
              outChars += delta.length;
              yield delta;
            }
            const u = handle.getUsage() ?? { inputTokens: inputEst, outputTokens: Math.ceil(outChars / 4) };
            await recordAiUsage({
              userId: ctx.userId ?? null,
              provider: provider.id,
              model,
              task,
              inputTokens: u.inputTokens,
              outputTokens: u.outputTokens,
              latencyMs: Date.now() - started,
              status: provider.id === firstId ? "ok" : "fallback",
              estCostUsdMicros: estimateCostUsdMicros(model, u),
            });
          } catch (err) {
            await recordAiUsage(errorRow(ctx, provider.id, model, task, started, err));
            throw err;
          }
        })();
        return { stream: wrapped, getUsage: handle.getUsage, provider: provider.id, model };
      } catch (err) {
        lastErr = err;
        const kind = classifyError(err);
        if (kind === "fatal") {
          await recordAiUsage(errorRow(ctx, provider.id, model, task, started, err));
          throw err;
        }
        if (kind === "retry" && attempt < MAX_RETRIES) {
          await backoff(attempt);
          continue;
        }
        break;
      }
    }
  }
  await recordAiUsage(errorRow(ctx, "none", tier, task, started, lastErr));
  throw new AiCapacityError("all_failed", { cause: lastErr });
}
