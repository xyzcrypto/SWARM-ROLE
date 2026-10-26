"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

export type Currency = "USD" | "INR";

export interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rate: number; // 1 for USD, live rate for INR
  inrRate: number; // live USD to INR rate
  isLive: boolean;
  symbol: string; // "$" or "₹"
  formatCompact: (usdVal: number | null | undefined) => string;
  formatPrice: (usdVal: number | null | undefined, options?: { maxDecimals?: number }) => string;
  convert: (usdVal: number | null | undefined) => number;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("USD");
  const [inrRate, setInrRate] = useState<number>(95.0);
  const [isLive, setIsLive] = useState<boolean>(false);

  // Load saved preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("xyz_currency");
      if (saved === "INR" || saved === "USD") {
        setCurrencyState(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  // Update currency and persist to localStorage
  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem("xyz_currency", c);
      if (typeof window !== "undefined") {
        (window as any).__XYZ_CURRENCY__ = c;
      }
      window.dispatchEvent(new CustomEvent("xyz_currency_change", { detail: c }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__XYZ_CURRENCY__ = currency;
      (window as any).__XYZ_INR_RATE__ = inrRate;
    }
  }, [currency, inrRate]);

  // Fetch live exchange rate on mount and poll every 60 seconds
  useEffect(() => {
    let timer: any = null;

    async function fetchRate() {
      try {
        const res = await fetch("/api/markets/currency");
        if (res.ok) {
          const data = await res.json();
          const rate = Number(data?.rates?.INR);
          if (Number.isFinite(rate) && rate > 50 && rate < 200) {
            setInrRate(rate);
            setIsLive(Boolean(data.live));
          }
        }
      } catch {
        // keep fallback/cached rate
      }
    }

    fetchRate();
    timer = setInterval(fetchRate, 5_000); // 5s live update

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  const rate = currency === "INR" ? inrRate : 1;
  const symbol = currency === "INR" ? "₹" : "$";

  const convert = useCallback(
    (usdVal: number | null | undefined): number => {
      if (usdVal == null || !Number.isFinite(usdVal)) return 0;
      return usdVal * rate;
    },
    [rate]
  );

  const formatCompact = useCallback(
    (usdVal: number | null | undefined): string => {
      if (usdVal == null || !Number.isFinite(usdVal)) return "-";
      const val = usdVal * rate;
      const abs = Math.abs(val);

      if (currency === "INR") {
        if (abs >= 1e12) return `₹${(val / 1e12).toFixed(2)}T`;
        if (abs >= 1e9) return `₹${(val / 1e9).toFixed(2)}B`;
        if (abs >= 1e6) return `₹${(val / 1e6).toFixed(2)}M`;
        if (abs >= 1e3) return `₹${(val / 1e3).toFixed(1)}K`;
        return `₹${Math.round(val).toLocaleString("en-IN")}`;
      } else {
        if (abs >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
        if (abs >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
        if (abs >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
        if (abs >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
        return `$${Math.round(val).toLocaleString("en-US")}`;
      }
    },
    [rate, currency]
  );

  const formatPrice = useCallback(
    (usdVal: number | null | undefined, options?: { maxDecimals?: number }): string => {
      if (usdVal == null || !Number.isFinite(usdVal)) return "-";
      const val = usdVal * rate;

      if (currency === "INR") {
        if (val >= 100_000) {
          return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
        }
        if (val >= 1) {
          return `₹${val.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: options?.maxDecimals ?? 2,
          })}`;
        }
        if (val >= 0.01) {
          return `₹${val.toFixed(options?.maxDecimals ?? 4)}`;
        }
        return `₹${val.toPrecision(2)}`;
      } else {
        if (val >= 1000) {
          return `$${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
        }
        if (val >= 1) {
          return `$${val.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: options?.maxDecimals ?? 2,
          })}`;
        }
        if (val >= 0.01) {
          return `$${val.toFixed(options?.maxDecimals ?? 4)}`;
        }
        return `$${val.toPrecision(2)}`;
      }
    },
    [rate, currency]
  );

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      rate,
      inrRate,
      isLive,
      symbol,
      formatCompact,
      formatPrice,
      convert,
    }),
    [currency, setCurrency, rate, inrRate, isLive, symbol, formatCompact, formatPrice, convert]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextType {
  const context = useContext(CurrencyContext);
  if (!context) {
    // Graceful fallback if rendered outside provider
    return {
      currency: "USD",
      setCurrency: () => {},
      rate: 1,
      inrRate: 95.0,
      isLive: false,
      symbol: "$",
      formatCompact: (n) => {
        if (n == null || !Number.isFinite(n)) return "-";
        const abs = Math.abs(n);
        if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
        if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
        if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
        if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
        return `$${Math.round(n).toLocaleString("en-US")}`;
      },
      formatPrice: (n) => {
        if (n == null || !Number.isFinite(n)) return "-";
        if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
        if (n >= 1) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (n >= 0.01) return `$${n.toFixed(4)}`;
        return `$${n.toPrecision(2)}`;
      },
      convert: (n) => n ?? 0,
    };
  }
  return context;
}
