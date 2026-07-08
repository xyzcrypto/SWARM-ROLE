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
  // Expanded coverage (markets, DeFi, institutional). Best-effort — skipped if down.
  { name: "The Block", url: "https://www.theblock.co/rss.xml", domain: "theblock.co" },
  { name: "Blockworks", url: "https://blockworks.co/feed", domain: "blockworks.co" },
  { name: "DL News", url: "https://www.dlnews.com/arc/outboundfeeds/rss/", domain: "dlnews.com" },
  { name: "CryptoSlate", url: "https://cryptoslate.com/feed/", domain: "cryptoslate.com" },
  { name: "CryptoPotato", url: "https://cryptopotato.com/feed/", domain: "cryptopotato.com" },
  { name: "U.Today", url: "https://u.today/rss", domain: "u.today" },
  { name: "AMBCrypto", url: "https://ambcrypto.com/feed/", domain: "ambcrypto.com" },
  { name: "Watcher Guru", url: "https://watcher.guru/news/feed", domain: "watcher.guru" },
  { name: "CoinGape", url: "https://coingape.com/feed/", domain: "coingape.com" },
  { name: "crypto.news", url: "https://crypto.news/feed/", domain: "crypto.news" },
];

export function favicon(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}
