import { env } from "@/lib/env";
import type { AiProvider } from "./providers/types";
import { groqProvider } from "./providers/groq";
import { geminiProvider } from "./providers/gemini";

// All known providers. Default order puts Gemini first so that simply adding a
// GEMINI_API_KEY promotes it to primary (with Groq as automatic fallback); with
// no Gemini key the chain collapses to Groq alone - identical to today.
const ALL: AiProvider[] = [groqProvider, geminiProvider];
const DEFAULT_ORDER = "gemini,groq";

/**
 * Pure ordering: given a comma-separated preference string and the set of
 * available providers, return the ordered list of **enabled** providers,
 * de-duplicated. Providers not named in the order are appended in their
 * registration order so a new key is never silently ignored.
 */
export function orderProviders(
  order: string,
  available: Pick<AiProvider, "id" | "enabled">[]
): string[] {
  const prefs = (order || DEFAULT_ORDER)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const byId = new Map(available.map((p) => [p.id, p]));
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    const p = byId.get(id);
    if (p && p.enabled && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  };
  for (const id of prefs) push(id);
  for (const p of available) push(p.id); // catch any enabled provider not listed
  return out;
}

/** The ordered, enabled provider chain for this deployment. */
export function providerChain(): AiProvider[] {
  const ids = orderProviders(env.AI_PROVIDER_ORDER || DEFAULT_ORDER, ALL);
  const byId = new Map(ALL.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)!).filter(Boolean);
}

/** Configured/health snapshot for the admin dashboard. */
export function providerHealth(): { id: string; enabled: boolean }[] {
  return ALL.map((p) => ({ id: p.id, enabled: p.enabled }));
}
