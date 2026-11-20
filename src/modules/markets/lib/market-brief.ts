import type { BriefContent } from "@modules/academy/client/page-brief";
import { money, pct } from "@modules/academy/client/page-brief";
import type { CoinRow, GlobalMarket, MoverCoin, DefiMarket } from "./markets";
import type { LivePrice } from "./live-prices";

/**
 * What AneQue says about the market, from the numbers on the page (polled
 * CoinGecko data, overridden by live Binance prices where present). Pure, so
 * the tests pin exactly what she says.
 */
export function marketBrief(input: {
  coins?: CoinRow[] | null;
  gainers?: MoverCoin[] | null;
  losers?: MoverCoin[] | null;
  global?: GlobalMarket | null;
  defi?: DefiMarket | null;
  live?: Readonly<Record<string, LivePrice>>;
}): BriefContent {
  const live = input.live ?? {};
  const coins = (input.coins ?? []).map((c) => {
    const l = live[c.symbol.toUpperCase()];
    if (l && !(c.price > 0 && Math.abs(l.price - c.price) / c.price > 0.25)) return { ...c, price: l.price, change24h: l.change24h };
    return c;
  });
  const by = (sym: string) => coins.find((c) => c.symbol.toUpperCase() === sym);
  const spoken: string[] = [];
  const ctx: string[] = [];
  const majors = ["BTC", "ETH", "SOL"].map(by).filter(Boolean) as CoinRow[];
  if (majors.length) {
    spoken.push(majors.map((c) => `${c.name} is at ${money(c.price)}, ${pct(c.change24h)} today`).join(". ") + ".");
  }
  const g = input.global;
  if (g && g.marketCap > 0) {
    spoken.push(`The whole crypto market is worth ${money(g.marketCap)}, ${pct(g.mcapChange24h)} in 24 hours, and Bitcoin holds ${g.btcDominance.toFixed(1)} percent of it.`);
    if (g.fearGreed) spoken.push(`The Fear and Greed index reads ${g.fearGreed.value}, which means ${g.fearGreed.label.toLowerCase()}.`);
    ctx.push(`Total market cap ${money(g.marketCap)} (${g.mcapChange24h.toFixed(2)}% 24h), 24h volume ${money(g.volume24h)}, BTC dominance ${g.btcDominance.toFixed(1)}%, ETH dominance ${g.ethDominance.toFixed(1)}%${g.fearGreed ? `, Fear & Greed ${g.fearGreed.value} (${g.fearGreed.label})` : ""}${g.gasGwei != null ? `, ETH gas ${g.gasGwei} gwei` : ""}.`);
  }
  const up = (input.gainers ?? []).slice(0, 2);
  const down = (input.losers ?? []).slice(0, 2);
  if (up.length) spoken.push(`Top gainer${up.length > 1 ? "s" : ""}: ${up.map((m) => `${m.name}, ${pct(m.change24h)}`).join(", and ")}.`);
  if (down.length) spoken.push(`Biggest drop${down.length > 1 ? "s" : ""}: ${down.map((m) => `${m.name}, ${pct(m.change24h)}`).join(", and ")}.`);
  if (input.defi && input.defi.totalTvl > 0) {
    spoken.push(`DeFi has ${money(input.defi.totalTvl)} locked across protocols.`);
    ctx.push(`DeFi TVL ${money(input.defi.totalTvl)}; top protocols: ${input.defi.topProtocols.slice(0, 5).map((p) => `${p.name} ${money(p.tvl)}`).join(", ")}.`);
  }
  if (coins.length) {
    ctx.unshift(
      "Top coins (price, 24h, market cap): " +
        coins
          .slice(0, 25)
          .map((c) => `${c.symbol} ${money(c.price)} ${c.change24h >= 0 ? "+" : ""}${c.change24h.toFixed(2)}% ${money(c.marketCap)}`)
          .join("; ") +
        "."
    );
  }
  if (up.length || down.length) ctx.push(`Gainers: ${(input.gainers ?? []).slice(0, 5).map((m) => `${m.symbol} ${m.change24h.toFixed(1)}%`).join(", ")}. Losers: ${(input.losers ?? []).slice(0, 5).map((m) => `${m.symbol} ${m.change24h.toFixed(1)}%`).join(", ")}.`);
  if (spoken.length) spoken.push("This is information, not financial advice.");
  return { spoken, context: ctx.join("\n") };
}
