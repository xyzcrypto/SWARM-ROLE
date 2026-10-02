import "server-only";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/api";
import { env, groqEnabled, geminiEnabled } from "@/lib/env";
import { providerChain } from "@/lib/ai/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only endpoint: tests each configured provider with a tiny prompt
// so you can see the exact error without digging through function logs.
// GET /api/ai/health
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const chain = providerChain();
  const results: Record<string, unknown> = {
    groqEnabled,
    geminiEnabled,
    groqKeySet: !!env.GROQ_API_KEY,
    geminiKeySet: !!env.GEMINI_API_KEY,
    providerOrder: chain.map((p) => p.id),
  };

  // ⚠️ A realistic probe, not "reply OK in 10 tokens". A thinking model spends
  // a budget that small reasoning and answers with nothing, so the old probe could
  // not tell a working provider from a broken one. `finishReason` and
  // `servedModel` are reported because they are the two facts that explain a bad
  // answer: cut off at the ceiling, or a retired model id quietly replaced.
  for (const provider of chain) {
    const model = provider.models.fast;
    const started = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20_000);
      const res = await provider.complete({
        model,
        prompt: "In one short sentence, what is Bitcoin?",
        maxTokens: 80,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      results[provider.id] = {
        status: res.text?.trim() ? "ok" : "empty",
        model,
        servedModel: res.servedModel ?? model,
        finishReason: res.finishReason ?? "unknown",
        ms: Date.now() - started,
        text: res.text?.trim().slice(0, 200),
      };
    } catch (err) {
      results[provider.id] = {
        status: "error",
        model,
        ms: Date.now() - started,
        // Gemini takes its key as a query parameter, so an error can carry it.
        error: (err instanceof Error ? err.message : String(err)).replace(/([?&]key=)[^&\s]+/gi, "$1***").slice(0, 300),
      };
    }
  }

  return NextResponse.json(results);
}
