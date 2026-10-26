import { NextResponse } from "next/server";

export const revalidate = 120; // 2 minutes server-side cache

interface CurrencyResponse {
  rates: {
    USD: number;
    INR: number | null;
  };
  timestamp: number;
  live: boolean;
  source: string;
}

// Last good rate from an upstream, kept per instance in case one rate-limits.
// Starts empty: until a real rate arrives the route says so (INR: null).
let cachedRate: number | null = null;
let lastSuccessTime = 0;

export async function GET() {
  try {
    // 1. Primary: open.er-api.com (Reliable, high limit, returns accurate live forex)
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD", {
        next: { revalidate: 120 },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        const inr = Number(data?.rates?.INR);
        if (Number.isFinite(inr) && inr > 50 && inr < 200) {
          cachedRate = inr;
          lastSuccessTime = Date.now();
          return NextResponse.json<CurrencyResponse>({
            rates: { USD: 1, INR: inr },
            timestamp: lastSuccessTime,
            live: true,
            source: "open.er-api",
          });
        }
      }
    } catch {
      // try secondary
    }

    // 2. Secondary: Frankfurter ECB forex feed
    try {
      const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=INR", {
        next: { revalidate: 120 },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        const inr = Number(data?.rates?.INR);
        if (Number.isFinite(inr) && inr > 50 && inr < 200) {
          cachedRate = inr;
          lastSuccessTime = Date.now();
          return NextResponse.json<CurrencyResponse>({
            rates: { USD: 1, INR: inr },
            timestamp: lastSuccessTime,
            live: true,
            source: "frankfurter",
          });
        }
      }
    } catch {
      // try tertiary
    }

    // 3. Tertiary: CoinGecko USDT / INR crypto exchange rate
    try {
      const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=inr", {
        next: { revalidate: 120 },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        const inr = Number(data?.tether?.inr);
        if (Number.isFinite(inr) && inr > 50 && inr < 200) {
          cachedRate = inr;
          lastSuccessTime = Date.now();
          return NextResponse.json<CurrencyResponse>({
            rates: { USD: 1, INR: inr },
            timestamp: lastSuccessTime,
            live: true,
            source: "coingecko",
          });
        }
      }
    } catch {
      // use memory cache
    }

    return NextResponse.json<CurrencyResponse>({
      rates: { USD: 1, INR: cachedRate },
      timestamp: lastSuccessTime,
      live: cachedRate != null && Date.now() - lastSuccessTime < 3600_000,
      source: "cached",
    });
  } catch (error) {
    return NextResponse.json<CurrencyResponse>({
      rates: { USD: 1, INR: cachedRate },
      timestamp: lastSuccessTime,
      live: false,
      source: "fallback",
    });
  }
}
