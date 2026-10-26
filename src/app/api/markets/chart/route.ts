import { NextResponse } from "next/server";

export const revalidate = 60; // 1-minute server-side cache

interface ChartPoint {
  timestamp: number;
  time: string;
  date: string;
  value: number;
  volume?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

interface ChartResponse {
  metric: string;
  timeframe: string;
  title: string;
  currentValue: number;
  change24h: number | null;
  points: ChartPoint[];
  minVal: number;
  maxVal: number;
  live: boolean;
  /** Where the curve comes from, shown under the chart when it is a proxy. */
  note?: string;
  ts: number;
}

// Format timestamp into HH:mm or short date
function formatPointTime(ts: number, timeframe: string): { time: string; date: string } {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = monthNames[d.getMonth()];
  const day = d.getDate();

  if (timeframe === "1H" || timeframe === "4H" || timeframe === "1D") {
    return {
      time: `${hh}:${mm}`,
      date: `${m} ${day}, ${hh}:${mm}`,
    };
  }
  if (timeframe === "1W" || timeframe === "1M") {
    return {
      time: `${m} ${day}`,
      date: `${m} ${day}, ${hh}:${mm}`,
    };
  }
  return {
    time: `${m} ${day}`,
    date: `${m} ${day}, ${d.getFullYear()}`,
  };
}

// Fetch Binance Klines for real crypto market price & volume curves
async function getBinanceKlines(timeframe: string): Promise<any[]> {
  const tfConfig: Record<string, { interval: string; limit: number }> = {
    "1H": { interval: "1m", limit: 60 },
    "4H": { interval: "5m", limit: 48 },
    "1D": { interval: "30m", limit: 48 },
    "1W": { interval: "4h", limit: 42 },
    "1M": { interval: "1d", limit: 30 },
    "3M": { interval: "1d", limit: 90 },
    "1Y": { interval: "1w", limit: 52 },
    ALL: { interval: "1M", limit: 60 },
  };

  const { interval, limit } = tfConfig[timeframe] || tfConfig["1D"];
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`,
    {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
    }
  );
  if (!res.ok) throw new Error(`Binance klines ${res.status}`);
  return res.json();
}

// Fetch CoinGecko global market data. Null on failure - never a sample figure.
async function getCoinGeckoGlobal(): Promise<{ marketCap: number; volume24h: number; btcDominance: number; mcapChange24h: number | null } | null> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/global", {
      headers: { accept: "application/json" },
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    const marketCap = Number(data?.total_market_cap?.usd);
    if (!(marketCap > 0)) return null;
    const change = Number(data?.market_cap_change_percentage_24h_usd);
    return {
      marketCap,
      volume24h: Number(data?.total_volume?.usd) || 0,
      btcDominance: Number(data?.market_cap_percentage?.btc) || 0,
      mcapChange24h: Number.isFinite(change) ? change : null,
    };
  } catch {
    return null;
  }
}

// Fetch DefiLlama historical TVL
async function getDefiLlamaTvl(): Promise<{ date: number; tvl: number }[]> {
  try {
    const res = await fetch("https://api.llama.fi/v2/historicalChainTvl", {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`DefiLlama ${res.status}`);
    return res.json();
  } catch {
    return [];
  }
}

// Fetch DefiLlama historical stablecoins
async function getDefiLlamaStablecoins(): Promise<any[]> {
  try {
    const res = await fetch("https://stablecoins.llama.fi/stablecoincharts/all", {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`DefiLlama Stables ${res.status}`);
    return res.json();
  } catch {
    return [];
  }
}

const CACHE = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" };

const TITLES: Record<string, string> = {
  marketCap: "Total Crypto Market Cap",
  volume: "24h Crypto Volume",
  btcDom: "Bitcoin Dominance",
  stablecoins: "Stablecoins Market Cap",
  defiTvl: "DeFi Total Value Locked",
};

/** Daily rows sliced to the selected timeframe (DefiLlama series are daily). */
function sliceDaily<T>(rows: T[], timeframe: string): T[] {
  if (timeframe === "1H" || timeframe === "4H" || timeframe === "1D" || timeframe === "1M") return rows.slice(-30);
  if (timeframe === "1W") return rows.slice(-7);
  if (timeframe === "3M") return rows.slice(-90);
  if (timeframe === "1Y") return rows.slice(-365);
  const step = Math.max(1, Math.floor(rows.length / 60));
  return rows.filter((_, i) => i % step === 0);
}

function respond(metric: string, timeframe: string, points: ChartPoint[], currentValue: number | null, change24h: number | null, note?: string) {
  const values = points.map((p) => p.value);
  const resp = {
    metric,
    timeframe,
    title: TITLES[metric] ?? TITLES.marketCap,
    currentValue,
    change24h,
    points,
    minVal: values.length ? Math.min(...values) : 0,
    maxVal: values.length ? Math.max(...values) : 0,
    live: points.length > 0 || currentValue != null,
    note,
    ts: Date.now(),
  };
  // A miss is cached briefly so the next poll retries the upstream soon.
  return NextResponse.json(resp, { headers: resp.live ? CACHE : { "Cache-Control": "public, s-maxage=30" } });
}

function pctChange(points: ChartPoint[]): number | null {
  const first = points[0]?.value;
  const last = points[points.length - 1]?.value;
  return first && last ? ((last - first) / first) * 100 : null;
}

// Every value here comes from an upstream. When one is unavailable the route
// returns an empty series and the chart says so - it used to draw a sine wave
// and hard-coded headline figures (volume always "+8.42%") instead.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const metric = searchParams.get("metric") || "marketCap";
  const timeframe = searchParams.get("timeframe") || "1D";

  try {
    if (metric === "defiTvl") {
      const rows = sliceDaily((await getDefiLlamaTvl()).filter((r) => Number(r.tvl) > 0), timeframe);
      const points = rows.map((r) => ({ timestamp: r.date * 1000, ...formatPointTime(r.date * 1000, timeframe), value: Number(r.tvl) }));
      return respond(metric, timeframe, points, points.at(-1)?.value ?? null, pctChange(points), "Daily DeFi TVL via DefiLlama.");
    }

    if (metric === "stablecoins") {
      const rows = (await getDefiLlamaStablecoins())
        .map((r) => ({ date: Number(r?.date), value: Number(r?.totalCirculatingUSD?.peggedUSD) || Number(r?.totalCirculating?.peggedUSD) || 0 }))
        .filter((r) => r.date > 0 && r.value > 0);
      const points = sliceDaily(rows, timeframe).map((r) => ({ timestamp: r.date * 1000, ...formatPointTime(r.date * 1000, timeframe), value: r.value }));
      return respond(metric, timeframe, points, points.at(-1)?.value ?? null, pctChange(points), "Daily stablecoin supply via DefiLlama.");
    }

    const globalData = await getCoinGeckoGlobal();

    if (metric === "btcDom") {
      // No free source publishes dominance history, so only the live value is shown.
      return respond(metric, timeframe, [], globalData?.btcDominance || null, null, "Live value via CoinGecko. History needs a paid feed.");
    }

    const klines = await getBinanceKlines(timeframe);
    if (!Array.isArray(klines) || !klines.length) return respond(metric, timeframe, [], null, null);

    if (metric === "volume") {
      const points = klines.map((k) => {
        const v = parseFloat(k[7]) || 0;
        return { timestamp: k[0], ...formatPointTime(k[0], timeframe), value: v, volume: v, open: v, high: v, low: v, close: v };
      });
      return respond(metric, timeframe, points, globalData?.volume24h || null, null, "Headline: total 24h volume (CoinGecko). Bars: BTC/USDT spot volume per candle (Binance).");
    }

    // Market cap: the shape is BTC/USDT, scaled so the last candle equals the
    // live total market cap. Labelled as such - it is a proxy, not an index.
    if (!globalData) return respond(metric, timeframe, [], null, null);
    const latestClose = parseFloat(klines[klines.length - 1][4]);
    if (!(latestClose > 0)) return respond(metric, timeframe, [], globalData.marketCap, globalData.mcapChange24h);
    const scale = globalData.marketCap / latestClose;
    const points = klines.map((k) => {
      const [o, h, l, c] = [k[1], k[2], k[3], k[4]].map((x: string) => (parseFloat(x) || latestClose) * scale);
      return { timestamp: k[0], ...formatPointTime(k[0], timeframe), value: c, volume: parseFloat(k[7]) || 0, open: o, high: h, low: l, close: c };
    });
    return respond(metric, timeframe, points, globalData.marketCap, globalData.mcapChange24h, "Total from CoinGecko. Curve follows BTC/USDT (Binance), scaled to the total.");
  } catch {
    return respond(metric, timeframe, [], null, null);
  }
}
