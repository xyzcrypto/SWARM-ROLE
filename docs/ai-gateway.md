# XYZ AI Gateway

The single seam through which **all** AI flows. Everything under `src/lib/ai/` is
provider-agnostic; the rest of the app only ever calls `streamAssistant` /
`completeText` from `src/lib/ai.ts` (the back-compat shim over the gateway).

## Providers & fallback
- **Groq** (`groq-sdk`, Llama) — works today. **Gemini** (Google REST, no SDK dep) —
  activates the moment `GEMINI_API_KEY` is set.
- Order comes from `AI_PROVIDER_ORDER` (default **`gemini,groq`**), filtered to the
  providers whose key is configured. So adding a Gemini key makes Gemini **primary** with
  Groq **auto-fallback**; with no Gemini key the chain is just Groq (unchanged).
- The gateway (`gateway.ts`) tries providers in order with a per-attempt **timeout**,
  **bounded retry + backoff** on transient errors, and **fallback to the next provider** on
  genuine failure (429 / quota / auth / 5xx). Safety/content blocks surface immediately.
- **ToS guardrail:** one key per provider; **no key rotation / quota evasion**. Fallback
  fires only on real failures.

## Model routing (`routing.ts`)
| Task | Free | Premium / Admin |
|------|------|-----------------|
| assistant (chat) | fast | **quality** |
| summary / moderation / why / digest | fast | fast |

Groq tiers: fast `llama-3.1-8b-instant`, quality `llama-3.3-70b-versatile`.
Gemini tiers: fast `gemini-1.5-flash`, quality `gemini-1.5-pro`.

## Per-plan daily limits (`limits.ts`)
Only **user-initiated** tasks count (assistant / why / digest); auto-moderation and article
summaries don't. Enforced in the assistant + why-matters routes → a friendly 429.

| Plan | Default / day | Env override |
|------|---------------|--------------|
| Free | 25 | `AI_DAILY_LIMIT_FREE` |
| Premium | 300 | `AI_DAILY_LIMIT_PREMIUM` |
| Admin | 3000 | `AI_DAILY_LIMIT_ADMIN` |

Per-user override: `User.aiDailyLimit` (set from the admin **AI Usage** tab; blank = plan
default). **No plan is "unlimited."**

## Caching & concurrency
- **Exact-match cache** (`cache.ts`): deterministic one-shot tasks keyed by
  `sha256(task + normalized input)` — Upstash Redis if configured, else a bounded
  in-process LRU (24h TTL). **Never caches the live chat assistant.** A hit is a $0 usage row.
- **Concurrency** (`concurrency.ts`): one in-flight AI request per member. Both fail **open**
  without Upstash.

## Usage analytics (`usage.ts`, model `AiUsage`)
One row per call: provider, model, task, tokens, latency, `status` (ok/fallback/error),
errorKind, `estCostUsdMicros`, `cached`. **Metadata only — never prompt/response text.**
Surfaced in **Dashboard → AI Usage** (`ai:manage`): requests + cost charts, provider health,
top members, abuse watch, and the per-user limit editor.

## Cost behavior
Groq + Gemini free tiers bill **$0**; the gateway tracks notional cost from `pricing.ts` so
spend is visible if you ever move to paid. Caching removes duplicate summary/moderation/
news-AI calls; daily caps bound worst-case per-user volume.

## Thinking models and token budgets (2026-10)
Both default models think before they answer, and their thinking is spent from the
same output budget as the answer. Every `maxTokens` in the codebase means **the length
of the visible answer**; `providers/reasoning.ts` adds a separate allowance on top:
- **Gemini** - `thinkingConfig.thinkingBudget` 512 (0 for answers ≤ 64 tokens, e.g.
  moderation), and `maxOutputTokens` = answer + 2048 headroom. If the API rejects the
  thinking field, the same model is retried without it; if the model id is not found
  (404), `gemini-flash-latest` then `gemini-2.5-flash` are tried and the working one is
  remembered.
- **Groq** - for reasoning models only (`gpt-oss`, `qwen3`, `deepseek-r1`):
  `reasoning_effort: "low"` and the same headroom. Never sent to Llama (it would 400).
- **Gateway** - an empty answer (or a stream that ends with no text) is a failure and
  fails over to the next provider, instead of reaching the reader as a blank.
- **Diagnose live:** `GET /api/ai/health` (admin) reports each provider's answer,
  `finishReason`, `servedModel` and latency.

## Env reference (all server-only — never `NEXT_PUBLIC_*`)
```
GROQ_API_KEY=…            # provider (works today)
GEMINI_API_KEY=…          # optional; promotes Gemini to primary
AI_PROVIDER_ORDER=gemini,groq
GEMINI_MODEL=…             # optional; default gemini-3.6-flash, auto-falls back to gemini-flash-latest on 404
GROQ_MODEL=…               # optional; default openai/gpt-oss-120b
AI_DAILY_LIMIT_FREE=25
AI_DAILY_LIMIT_PREMIUM=300
AI_DAILY_LIMIT_ADMIN=3000
UPSTASH_REDIS_REST_URL / _TOKEN   # optional; enables shared cache + concurrency
```

## Owner ops (Supabase SQL — idempotent)
Apply once for full analytics + limits (until then everything degrades cleanly):
- `prisma/migrations/15_ai_usage/migration.sql` — the `AiUsage` log.
- `prisma/migrations/16_ai_limits/migration.sql` — `User.aiDailyLimit`.
