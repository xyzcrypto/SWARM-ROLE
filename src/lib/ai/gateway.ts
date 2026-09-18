// The XYZ AI gateway: routes a task to a model, then tries the configured
// provider chain with per-attempt timeouts, bounded retries (transient errors),
// and automatic fallback to the next provider on genuine failure. It never
// rotates keys or multiplies free quota - fallback fires only on real failures.
import type { AiPlan, AiProvider, AiTask, CompleteResult, StreamHandle, StreamRequest, TokenUsage } from "./providers/types";
import { providerChain } from "./registry";
import { routeTier } from "./routing";
import { estimateTokens, estimateCostUsdMicros } from "./pricing";
import { recordAiUsage, errorKindOf } from "./usage";
import { cacheKey, isCacheable, getCached, setCached } from "./cache";

const STREAM_CONNECT_TIMEOUT_MS = 20_000; // time-to-first-response for streams
/**
 * Floor for a one-shot completion. The real budget SCALES with the requested
 * length - see `completeTimeoutMs`.
 *
 * ⚠️ This was a flat 15s for every completion, and it broke the news briefing
 * outright. `/api/ai/why-matters` asks for **2000 tokens** in `briefing` mode
 * and 2100 for a Hinglish translation. No model emits two thousand tokens in
 * fifteen seconds, so the briefing timed out **every single time** - and a
 * timeout is classified as a transient "retry", so it then burned MAX_RETRIES
 * more attempts against the same provider with backoff, then the next provider,
 * before finally raising AiCapacityError.
 *
 * The reader's experience was the two complaints exactly: it never worked, and
 * it took the better part of a minute not to work.
 */
const COMPLETE_TIMEOUT_MS = 15_000;

/**
 * How long a completion of this size may take.
 *
 * Generation time is roughly linear in output tokens, so the budget has to be
 * too. ~45ms per token is deliberately generous (most models beat it several
 * times over); the point is a ceiling that a legitimate long answer can finish
 * inside, not a tight estimate. Capped so a pathological request cannot hold a
 * serverless function open indefinitely.
 */
function completeTimeoutMs(maxTokens: number): number {
  return Math.min(MAX_COMPLETE_TIMEOUT_MS, Math.max(COMPLETE_TIMEOUT_MS, Math.round(maxTokens * 45)));
}

/**
 * The ceiling, and it is set by the PLATFORM rather than by preference.
 *
 * ⚠️ Vercel kills a function at its `maxDuration`. If this gateway's own budget
 * were larger, the platform would always win the race - and the platform's win
 * is an opaque 504 with no message, while the gateway's win is a clean
 * "couldn't generate that right now" the UI can explain and retry from.
 *
 * So this must stay comfortably BELOW the smallest `maxDuration` on any route
 * that calls `runComplete`. The AI routes declare 60s; 55s leaves room for the
 * response to be serialised and the usage row written after the model returns.
 * `ai-timeout-budget.test.ts` fails if a route's declared duration drops under
 * this.
 */
const MAX_COMPLETE_TIMEOUT_MS = 55_000;
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
// Implementation lives in a client-safe module (this file reaches prisma through
// the usage recorder, so the widget cannot import it). Re-exported for servers.
export { aiPlanFor } from "@shared/utils/ai-plan";

/**
 * Say out loud why every provider failed.
 *
 * ⚠️ Until this existed, nothing did. `AiCapacityError("all_failed")` carries the
 * provider's real error on `.cause`, and `recordAiUsage` buckets it into a
 * coarse `errorKind` - but the actual message ("Rate limit reached for model
 * …", "API key expired") was never written anywhere. With Sentry still dark
 * (HANDOFF §8) that meant an AI outage could only be described as "not
 * working", which is precisely what happened.
 *
 * ⚠️ REDACTED, and not optionally. Gemini's REST API takes the key as a query
 * parameter (`?key=…`), so a fetch/URL error can carry the live API key inside
 * its message. Logging that verbatim would publish a secret into the Vercel log
 * drain. Anything key-shaped is masked before it reaches the log.
 */
function logAllFailed(task: AiTask, chain: AiProvider[], err: unknown): void {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const safe = raw
    .replace(/([?&](?:key|api[_-]?key|access[_-]?token)=)[^&\s]+/gi, "$1***")
    .replace(/\b(sk|gsk|AIza)[A-Za-z0-9_\-]{12,}/g, "$1***")
    .slice(0, 500);
  console.error(
    `[ai] all providers failed task=${task} chain=${chain.map((p) => p.id).join(",") || "(empty)"} kind=${errorKindOf(err)} :: ${safe}`
  );
}

// --- one-shot completion ---------------------------------------------------

export async function runComplete(
  task: AiTask,
  req: { system?: string; prompt: string; maxTokens: number },
  ctx: GatewayCtx = {},
  chain: AiProvider[] = providerChain()
): Promise<CompleteResult & { provider: string; model: string }> {
  if (!chain.length) throw new AiCapacityError("no_provider");
  const tier = routeTier(task, ctx.plan ?? "Free");
  const started = Date.now();
  const firstId = chain[0]?.id;
  const inputEst = estimateTokens(`${req.system ?? ""} ${req.prompt}`);

  // Exact-match cache for deterministic one-shot tasks - a hit skips the provider
  // entirely (records a cached, $0 usage row so the saving is visible).
  const key = isCacheable(task) ? cacheKey(task, `${req.system ?? ""}\n${req.prompt}`) : null;
  if (key) {
    const hit = await getCached(key);
    if (hit != null) {
      await recordAiUsage({
        userId: ctx.userId ?? null,
        provider: "cache",
        model: "cache",
        task,
        inputTokens: 0,
        outputTokens: estimateTokens(hit),
        latencyMs: Date.now() - started,
        status: "ok",
        estCostUsdMicros: 0,
        cached: true,
      });
      return { text: hit, provider: "cache", model: "cache" };
    }
  }

  let lastErr: unknown;
  for (const provider of chain) {
    const model = provider.models[tier];
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await withTimeout(completeTimeoutMs(req.maxTokens), (signal) =>
          provider.complete({ ...req, model, signal })
        );
        // ⚠️ NEVER cache a truncated answer. The cache holds a response for
        // TWENTY-FOUR HOURS, and it stored anything non-empty - so one
        // half-finished briefing was then served to every identical request for
        // a day, across deploys. Three separate fixes to the briefing looked
        // like they had done nothing, because the reader kept being handed the
        // same cached fragment that predated them.
        //
        // A cut-off answer is not a cheaper answer; it is a wrong one, and
        // caching a wrong one is how a bug outlives its fix.
        if (key && res.text && res.finishReason !== "length") void setCached(key, res.text);
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
        // ⚠️ A TIMEOUT on a long generation is not worth retrying against the
        // same provider. The request did not fail transiently - it was simply
        // still working, and asking the identical question again takes at least
        // as long. Retrying tripled the wait before the user saw an error, and
        // paid for every attempt. Short requests keep the retry, where a timeout
        // really does suggest a blip.
        const timedOut = /timeout|timed out|abort/i.test(String((err as Error)?.message ?? err));
        const worthRetrying = kind === "retry" && !(timedOut && req.maxTokens > 600);
        if (worthRetrying && attempt < MAX_RETRIES) {
          await backoff(attempt);
          continue;
        }
        break; // exhausted retries or failover → next provider
      }
    }
  }
  await recordAiUsage(errorRow(ctx, "none", tier, task, started, lastErr));
  logAllFailed(task, chain, lastErr);
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
  const tier = routeTier(task, ctx.plan ?? "Free");
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
  logAllFailed(task, chain, lastErr);
  throw new AiCapacityError("all_failed", { cause: lastErr });
}
