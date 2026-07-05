// Reputable, keyless crypto news RSS/Atom feeds aggregated by /api/news. Each is
// fetched best-effort — a down/blocked feed is simply skipped. Icons come from
// Google's favicon service (keyless).
export type NewsSource = { name: string; url: string; domain: string };

export const NEWS_SOURCES: NewsSource[] = [
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", domain: "coindesk.com" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss", domain: "cointelegraph.com" },
  { name: "Decrypt", url: "https://decrypt.co/feed", domain: "decrypt.co" },
  { name: "The Defiant", url: "https://thedefiant.io/feed", domain: "thedefiant.io" },
  { name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/feed", domain: "bitcoinmagazine.com" },
  { name: "Crypto Briefing", url: "https://cryptobriefing.com/feed/", domain: "cryptobriefing.com" },
  { name: "BeInCrypto", url: "https://beincrypto.com/feed/", domain: "beincrypto.com" },
  { name: "Bitcoinist", url: "https://bitcoinist.com/feed/", domain: "bitcoinist.com" },
  { name: "NewsBTC", url: "https://www.newsbtc.com/feed/", domain: "newsbtc.com" },
];

export function favicon(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}
