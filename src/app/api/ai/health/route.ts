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

  for (const provider of chain) {
    const model = provider.models.fast;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const res = await provider.complete({
        model,
        prompt: "Reply with just the word OK.",
        maxTokens: 10,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      results[provider.id] = { status: "ok", model, text: res.text?.trim() };
    } catch (err) {
      results[provider.id] = {
        status: "error",
        model,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return NextResponse.json(results);
}
