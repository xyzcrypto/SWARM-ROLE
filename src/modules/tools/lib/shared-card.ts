import { prisma } from "@/lib/prisma";

export type CardData = {
  platform?: string;
  domain?: string;
  sharePct?: number;
  tokens?: number;
  usd?: number;
  fdv?: number;
};

// In-memory LRU cache across requests for immutable shared card snapshots.
// Once created, a card never changes; caching avoids redundant DB lookups
// when Twitter/Telegram/Discord crawlers hit the page and OG image simultaneously.
const CARD_CACHE = new Map<string, { data: CardData; cachedAt: number }>();
const CACHE_TTL_MS = 300_000; // 5 minutes
const MAX_CACHE_ENTRIES = 500;

export async function getSharedPointsCard(id: string): Promise<CardData | null> {
  const now = Date.now();
  const hit = CARD_CACHE.get(id);
  if (hit && now - hit.cachedAt < CACHE_TTL_MS) {
    return hit.data;
  }

  const row = await prisma.sharedCard
    .findUnique({ where: { id }, select: { kind: true, data: true } })
    .catch(() => null);

  if (!row || row.kind !== "points-value") return null;

  const data = row.data as CardData;
  if (CARD_CACHE.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = CARD_CACHE.keys().next().value;
    if (oldestKey) CARD_CACHE.delete(oldestKey);
  }
  CARD_CACHE.set(id, { data, cachedAt: now });
  return data;
}
