"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Maximize2, X, Search, Sparkles, ZoomIn, ZoomOut, RotateCcw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoinRow } from "@/lib/markets";
import { useCurrency } from "../context/CurrencyContext";

export interface MarketHeatmapProps {
  coins?: CoinRow[];
}

export interface TokenItem {
  symbol: string;
  name: string;
  id: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  sparkline: number[];
  category?: string;
  image?: string | null;
  binanceSymbol?: string;
}

interface SectorItem {
  id?: string;
  name: string;
  symbol: string;
  change24h: number;
  marketCap?: number;
  volume24h?: number;
  sparkline?: number[];
  topCoins?: string[];
}

/* ─────────────────────────────────────────────────────────────
   STABLECOINS LIST (Rendered with slate gray in heatmap)
   Matching CoinMarketCap: USDT, USDC, USDe, XAUT, PYUSD, PAXG, USDG, WLFI, USDD
   ───────────────────────────────────────────────────────────── */
const STABLECOINS = new Set([
  "USDT",
  "USDC",
  "DAI",
  "USDE",
  "USDS",
  "FDUSD",
  "PYUSD",
  "USDD",
  "TUSD",
  "RLUSD",
  "USYC",
  "USD1",
  "USDY",
  "EURC",
  "BUSD",
  "GUSD",
  "CC",
  "XAUT",
  "PAXG",
  "USDG",
  "WLFI",
]);

/* ─────────────────────────────────────────────────────────────
   COIN LOGOS MAP
   ───────────────────────────────────────────────────────────── */
const COIN_LOGOS: Record<string, string> = {
  BTC: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  ETH: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  USDT: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  SOL: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  BNB: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
  XRP: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png",
  USDC: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
  DOGE: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png",
  ADA: "https://assets.coingecko.com/coins/images/975/small/cardano.png",
  TRX: "https://assets.coingecko.com/coins/images/1094/small/tron-logo.png",
  LINK: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
  AVAX: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
  SUI: "https://assets.coingecko.com/coins/images/26375/small/sui-ocean-square.png",
  HYPE: "https://assets.coingecko.com/coins/images/50882/small/hyperliquid.jpg",
  DOT: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png",
  PEPE: "https://assets.coingecko.com/coins/images/29850/small/pepe-token.png",
  NEAR: "https://assets.coingecko.com/coins/images/10365/small/near.png",
  SHIB: "https://assets.coingecko.com/coins/images/11939/small/shiba.png",
  APT: "https://assets.coingecko.com/coins/images/26455/small/aptos_round.png",
  UNI: "https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png",
  FET: "https://assets.coingecko.com/coins/images/5681/small/Fetch.jpg",
  ICP: "https://assets.coingecko.com/coins/images/14495/small/Internet_Computer_logo.png",
  AAVE: "https://assets.coingecko.com/coins/images/12645/small/AAVE.png",
  FIL: "https://assets.coingecko.com/coins/images/12817/small/filecoin.png",
  ARB: "https://assets.coingecko.com/coins/images/16547/small/arbitrum_logo.png",
  RNDR: "https://assets.coingecko.com/coins/images/11636/small/rndr.png",
  OP: "https://assets.coingecko.com/coins/images/25244/small/Optimism.png",
  TIA: "https://assets.coingecko.com/coins/images/31967/small/tia.png",
  KAS: "https://assets.coingecko.com/coins/images/25751/small/kaspa-icon.png",
  STX: "https://assets.coingecko.com/coins/images/2069/small/Stacks_logo_full.png",
  INJ: "https://assets.coingecko.com/coins/images/12882/small/Secondary_Symbol.png",
  MKR: "https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png",
  SEI: "https://assets.coingecko.com/coins/images/28205/small/Sei_Logo_-_Transparent.png",
  LDO: "https://assets.coingecko.com/coins/images/13573/small/Lido_DAO.png",
  IMX: "https://assets.coingecko.com/coins/images/17233/small/imx.png",
  BONK: "https://assets.coingecko.com/coins/images/28600/small/bonk.jpg",
  FLOKI: "https://assets.coingecko.com/coins/images/16746/small/FLOKI.png",
  ZEC: "https://assets.coingecko.com/coins/images/486/small/circle-zcash-color.png",
  XLM: "https://assets.coingecko.com/coins/images/100/small/Stellar_symbol_black_RGB.png",
  BCH: "https://assets.coingecko.com/coins/images/780/small/bitcoin-cash-circle.png",
  XMR: "https://assets.coingecko.com/coins/images/69/small/monero_logo.png",
  LTC: "https://assets.coingecko.com/coins/images/2/small/litecoin.png",
  DAI: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
  HBAR: "https://assets.coingecko.com/coins/images/3688/small/hbar.png",
  TAO: "https://assets.coingecko.com/coins/images/29164/small/bittensor.png",
  PYTH: "https://assets.coingecko.com/coins/images/31924/small/pyth.png",
  JUP: "https://assets.coingecko.com/coins/images/34188/small/jup.png",
  WLD: "https://assets.coingecko.com/coins/images/31062/small/worldcoin.png",
};

/* ─────────────────────────────────────────────────────────────
   CURATED INITIAL SEEDS (Exact values from user reference image)
   Total market cap of top coins: ~$2.90 Trillion
   BTC Dominance: ~58.94%
   ETH Dominance: ~11.34%
   USDT Dominance: ~6.33%
   BNB Dominance: ~3.62%
   XRP Dominance: ~3.26%
   USDC Dominance: ~2.55%
   SOL Dominance: ~2.46%
   TRX Dominance: ~1.30%
   ───────────────────────────────────────────────────────────── */
const INITIAL_BTC: TokenItem = {
  symbol: "BTC",
  name: "Bitcoin",
  id: "bitcoin",
  price: 85253.33,
  change24h: 0.44,
  marketCap: 1714295691994.02,
  volume24h: 14848667279.24,
  sparkline: [35, 42, 38, 52, 48, 64, 72, 85, 96],
  category: "Layer 1",
  image: COIN_LOGOS.BTC,
  binanceSymbol: "BTCUSDT",
};

const INITIAL_ETH: TokenItem = {
  symbol: "ETH",
  name: "Ethereum",
  id: "ethereum",
  price: 2698.65,
  change24h: 0.63,
  marketCap: 329892145890.50,
  volume24h: 8425198420.10,
  sparkline: [40, 36, 48, 45, 58, 62, 70, 82, 92],
  category: "Layer 1",
  image: COIN_LOGOS.ETH,
  binanceSymbol: "ETHUSDT",
};

const INITIAL_USDT: TokenItem = {
  symbol: "USDT",
  name: "Tether USDt",
  id: "tether",
  price: 0.9999,
  change24h: 0.0,
  marketCap: 184291480120.00,
  volume24h: 24812940150.00,
  sparkline: [50, 50, 50, 50, 50, 50, 50, 50, 50],
  category: "Stablecoin",
  image: COIN_LOGOS.USDT,
  binanceSymbol: "USDTUSDC",
};

const INITIAL_SOL: TokenItem = {
  symbol: "SOL",
  name: "Solana",
  id: "solana",
  price: 121.73,
  change24h: 1.92,
  marketCap: 71691480120.80,
  volume24h: 3812940150.40,
  sparkline: [30, 40, 45, 55, 52, 68, 75, 88, 98],
  category: "Layer 1",
  image: COIN_LOGOS.SOL,
  binanceSymbol: "SOLUSDT",
};

const INITIAL_BNB: TokenItem = {
  symbol: "BNB",
  name: "BNB",
  id: "binancecoin",
  price: 789.90,
  change24h: 2.04,
  marketCap: 105182823849.15,
  volume24h: 1374758000.67,
  sparkline: [42, 48, 54, 60, 68, 75, 82, 90, 96],
  category: "Layer 1",
  image: COIN_LOGOS.BNB,
  binanceSymbol: "BNBUSDT",
};

const INITIAL_XRP: TokenItem = {
  symbol: "XRP",
  name: "XRP",
  id: "ripple",
  price: 1.5026,
  change24h: 1.14,
  marketCap: 94890120400.00,
  volume24h: 1820800100.00,
  sparkline: [45, 50, 55, 52, 62, 68, 74, 85, 92],
  category: "Layer 1",
  image: COIN_LOGOS.XRP,
  binanceSymbol: "XRPUSDT",
};

const INITIAL_USDC: TokenItem = {
  symbol: "USDC",
  name: "USD Coin",
  id: "usd-coin",
  price: 0.9999,
  change24h: -0.01,
  marketCap: 74291480120.00,
  volume24h: 5312940150.00,
  sparkline: [50, 50, 50, 50, 50, 50, 50, 50, 50],
  category: "Stablecoin",
  image: COIN_LOGOS.USDC,
  binanceSymbol: "USDCUSDT",
};

const INITIAL_TRX: TokenItem = {
  symbol: "TRX",
  name: "TRON",
  id: "tron",
  price: 0.3356,
  change24h: -0.37,
  marketCap: 37820300000.00,
  volume24h: 710200000.00,
  sparkline: [55, 52, 48, 45, 42, 40, 38, 35, 32],
  category: "Layer 1",
  image: COIN_LOGOS.TRX,
  binanceSymbol: "TRXUSDT",
};

const INITIAL_HYPE: TokenItem = {
  symbol: "HYPE",
  name: "Hyperliquid",
  id: "hyperliquid",
  price: 90.87,
  change24h: 1.89,
  marketCap: 22401000000.00,
  volume24h: 680400000.00,
  sparkline: [38, 44, 52, 60, 68, 75, 82, 89, 95],
  category: "DeFi",
  image: COIN_LOGOS.HYPE,
  binanceSymbol: "HYPEUSDT",
};

const INITIAL_ZEC: TokenItem = {
  symbol: "ZEC",
  name: "Zcash",
  id: "zcash",
  price: 1326.10,
  change24h: 0.82,
  marketCap: 18920400000.00,
  volume24h: 410200000.00,
  sparkline: [40, 48, 55, 62, 70, 78, 85, 90, 95],
  category: "Layer 1",
  image: COIN_LOGOS.ZEC,
  binanceSymbol: "ZECUSDT",
};

// Compact view Row 2
const INITIAL_ROW2: TokenItem[] = [
  INITIAL_BNB,
  INITIAL_XRP,
  { symbol: "DOGE", name: "Dogecoin", id: "dogecoin", price: 0.0938, change24h: 0.90, marketCap: 20120000000.00, volume24h: 1120400000.00, sparkline: [], category: "Meme", image: COIN_LOGOS.DOGE, binanceSymbol: "DOGEUSDT" },
  { symbol: "ADA", name: "Cardano", id: "cardano", price: 0.2442, change24h: -0.40, marketCap: 8720000000.00, volume24h: 420100000.00, sparkline: [], category: "Layer 1", image: COIN_LOGOS.ADA, binanceSymbol: "ADAUSDT" },
  INITIAL_TRX,
];

// Compact view Row 3
const INITIAL_ROW3: TokenItem[] = [
  { symbol: "LINK", name: "Chainlink", id: "chainlink", price: 18.42, change24h: 1.70, marketCap: 11420400000.00, volume24h: 380100000.00, sparkline: [], category: "DeFi", image: COIN_LOGOS.LINK, binanceSymbol: "LINKUSDT" },
  { symbol: "AVAX", name: "Avalanche", id: "avalanche-2", price: 42.12, change24h: -1.42, marketCap: 15890200000.00, volume24h: 620100000.00, sparkline: [], category: "Layer 1", image: COIN_LOGOS.AVAX, binanceSymbol: "AVAXUSDT" },
  { symbol: "SUI", name: "Sui", id: "sui", price: 2.14, change24h: 7.31, marketCap: 6120400000.00, volume24h: 490200000.00, sparkline: [], category: "Layer 1", image: COIN_LOGOS.SUI, binanceSymbol: "SUIUSDT" },
  INITIAL_HYPE,
  { symbol: "DOT", name: "Polkadot", id: "polkadot", price: 6.85, change24h: -2.10, marketCap: 9820400000.00, volume24h: 310200000.00, sparkline: [], category: "Layer 1", image: COIN_LOGOS.DOT, binanceSymbol: "DOTUSDT" },
];

const INITIAL_MOSAIC_ROW2: TokenItem[] = [
  { symbol: "PEPE", name: "Pepe", id: "pepe", price: 0.0000098, change24h: 8.2, marketCap: 4120300000.00, volume24h: 820100000.00, sparkline: [], category: "Meme", image: COIN_LOGOS.PEPE, binanceSymbol: "PEPEUSDT" },
  { symbol: "NEAR", name: "NEAR Protocol", id: "near", price: 4.86, change24h: 4.7, marketCap: 5820100000.00, volume24h: 310200000.00, sparkline: [], category: "Layer 1", image: COIN_LOGOS.NEAR, binanceSymbol: "NEARUSDT" },
  { symbol: "SHIB", name: "Shiba Inu", id: "shiba-inu", price: 0.0000185, change24h: -1.2, marketCap: 10920400000.00, volume24h: 420100000.00, sparkline: [], category: "Meme", image: COIN_LOGOS.SHIB, binanceSymbol: "SHIBUSDT" },
  { symbol: "APT", name: "Aptos", id: "aptos", price: 8.45, change24h: 4.15, marketCap: 4150200000.00, volume24h: 290100000.00, sparkline: [], category: "Layer 1", image: COIN_LOGOS.APT, binanceSymbol: "APTUSDT" },
  { symbol: "UNI", name: "Uniswap", id: "uniswap", price: 7.85, change24h: 3.42, marketCap: 4920300000.00, volume24h: 195400000.00, sparkline: [], category: "DeFi", image: COIN_LOGOS.UNI, binanceSymbol: "UNIUSDT" },
  { symbol: "FET", name: "Artificial Superintelligence", id: "fetch-ai", price: 1.34, change24h: -2.4, marketCap: 3410200000.00, volume24h: 182000000.00, sparkline: [], category: "AI", image: COIN_LOGOS.FET, binanceSymbol: "FETUSDT" },
];

const INITIAL_MOSAIC_ROW3: TokenItem[] = [
  { symbol: "XLM", name: "Stellar", id: "stellar", price: 0.2158, change24h: 0.20, marketCap: 6810200000.00, volume24h: 145000000.00, sparkline: [], category: "Layer 1", image: COIN_LOGOS.XLM, binanceSymbol: "XLMUSDT" },
  { symbol: "BCH", name: "Bitcoin Cash", id: "bitcoin-cash", price: 318.66, change24h: 2.00, marketCap: 6310200000.00, volume24h: 245000000.00, sparkline: [], category: "Layer 1", image: COIN_LOGOS.BCH, binanceSymbol: "BCHUSDT" },
  { symbol: "XMR", name: "Monero", id: "monero", price: 548.55, change24h: 0.05, marketCap: 9910200000.00, volume24h: 125000000.00, sparkline: [], category: "Privacy", image: COIN_LOGOS.XMR, binanceSymbol: "XMRUSDT" },
  { symbol: "LDO", name: "Lido DAO", id: "lido-dao", price: 8.99, change24h: -0.10, marketCap: 7920400000.00, volume24h: 76000000.00, sparkline: [], category: "DeFi", image: COIN_LOGOS.LDO, binanceSymbol: "LDOUSDT" },
  { symbol: "LTC", name: "Litecoin", id: "litecoin", price: 84.79, change24h: 0.50, marketCap: 6310200000.00, volume24h: 280100000.00, sparkline: [], category: "Layer 1", image: COIN_LOGOS.LTC, binanceSymbol: "LTCUSDT" },
  { symbol: "ICP", name: "Internet Computer", id: "internet-computer", price: 8.92, change24h: 2.91, marketCap: 4210300000.00, volume24h: 145000000.00, sparkline: [], category: "Layer 1", image: COIN_LOGOS.ICP, binanceSymbol: "ICPUSDT" },
  { symbol: "AAVE", name: "Aave", id: "aave", price: 165.2, change24h: 5.24, marketCap: 2450100000.00, volume24h: 280100000.00, sparkline: [], category: "DeFi", image: COIN_LOGOS.AAVE, binanceSymbol: "AAVEUSDT" },
  { symbol: "FIL", name: "Filecoin", id: "filecoin", price: 3.82, change24h: -1.8, marketCap: 2180400000.00, volume24h: 110200000.00, sparkline: [], category: "Storage", image: COIN_LOGOS.FIL, binanceSymbol: "FILUSDT" },
  { symbol: "ARB", name: "Arbitrum", id: "arbitrum", price: 0.58, change24h: 2.35, marketCap: 2310200000.00, volume24h: 195000000.00, sparkline: [], category: "Layer 2", image: COIN_LOGOS.ARB, binanceSymbol: "ARBUSDT" },
  { symbol: "RNDR", name: "Render", id: "render-token", price: 6.14, change24h: 4.72, marketCap: 3210400000.00, volume24h: 210400000.00, sparkline: [], category: "AI", image: COIN_LOGOS.RNDR, binanceSymbol: "RENDERUSDT" },
  { symbol: "OP", name: "Optimism", id: "optimism", price: 1.62, change24h: -0.85, marketCap: 2010300000.00, volume24h: 120400000.00, sparkline: [], category: "Layer 2", image: COIN_LOGOS.OP, binanceSymbol: "OPUSDT" },
  { symbol: "TIA", name: "Celestia", id: "celestia", price: 5.82, change24h: -3.2, marketCap: 1240100000.00, volume24h: 98000000.00, sparkline: [], category: "Modular", image: COIN_LOGOS.TIA, binanceSymbol: "TIAUSDT" },
  { symbol: "KAS", name: "Kaspa", id: "kaspa", price: 0.13, change24h: 4.5, marketCap: 3120400000.00, volume24h: 84000000.00, sparkline: [], category: "Layer 1", image: COIN_LOGOS.KAS, binanceSymbol: "KASUSDT" },
  { symbol: "STX", name: "Stacks", id: "blockstack", price: 1.74, change24h: -1.6, marketCap: 2610200000.00, volume24h: 72000000.00, sparkline: [], category: "Bitcoin L2", image: COIN_LOGOS.STX, binanceSymbol: "STXUSDT" },
  { symbol: "INJ", name: "Injective", id: "injective-protocol", price: 21.4, change24h: 6.8, marketCap: 2120400000.00, volume24h: 145000000.00, sparkline: [], category: "DeFi", image: COIN_LOGOS.INJ, binanceSymbol: "INJUSDT" },
  { symbol: "MKR", name: "Maker", id: "maker", price: 1540, change24h: -0.9, marketCap: 1420100000.00, volume24h: 65000000.00, sparkline: [], category: "DeFi", image: COIN_LOGOS.MKR, binanceSymbol: "MKRUSDT" },
  { symbol: "SEI", name: "Sei", id: "sei-network", price: 0.44, change24h: 3.8, marketCap: 1520300000.00, volume24h: 89000000.00, sparkline: [], category: "Layer 1", image: COIN_LOGOS.SEI, binanceSymbol: "SEIUSDT" },
  { symbol: "DAI", name: "Dai", id: "dai", price: 0.9999, change24h: 0.0, marketCap: 5410200000.00, volume24h: 120000000.00, sparkline: [], category: "Stablecoin", image: COIN_LOGOS.DAI, binanceSymbol: "DAIUSDT" },
  { symbol: "HBAR", name: "Hedera", id: "hedera-hashgraph", price: 0.0712, change24h: 1.20, marketCap: 2610200000.00, volume24h: 85000000.00, sparkline: [], category: "Layer 1", image: COIN_LOGOS.HBAR, binanceSymbol: "HBARUSDT" },
  { symbol: "BONK", name: "Bonk", id: "bonk", price: 0.000021, change24h: 5.1, marketCap: 1540100000.00, volume24h: 180000000.00, sparkline: [], category: "Meme", image: COIN_LOGOS.BONK, binanceSymbol: "BONKUSDT" },
  { symbol: "FLOKI", name: "FLOKI", id: "floki", price: 0.00014, change24h: -0.7, marketCap: 1320400000.00, volume24h: 140000000.00, sparkline: [], category: "Meme", image: COIN_LOGOS.FLOKI, binanceSymbol: "FLOKIUSDT" },
  { symbol: "TAO", name: "Bittensor", id: "bittensor", price: 480, change24h: 5.6, marketCap: 3510200000.00, volume24h: 110000000.00, sparkline: [], category: "AI", image: COIN_LOGOS.TAO, binanceSymbol: "TAOUSDT" },
];

/* ─────────────────────────────────────────────────────────────
   SECTORS DATA
   ───────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────
   FORMATTERS
   ───────────────────────────────────────────────────────────── */
function getActiveCurrency() {
  if (typeof window !== "undefined") {
    try {
      const c = (window as any).__XYZ_CURRENCY__ || localStorage.getItem("xyz_currency") || "USD";
      const r = (window as any).__XYZ_INR_RATE__ || 95.0;
      return { currency: c, rate: c === "INR" ? r : 1, sym: c === "INR" ? "₹" : "$", locale: c === "INR" ? "en-IN" : "en-US" };
    } catch {
      // ignore
    }
  }
  return { currency: "USD", rate: 1, sym: "$", locale: "en-US" };
}

function formatMcapCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "";
  const { rate, sym, locale } = getActiveCurrency();
  const val = n * rate;
  const abs = Math.abs(val);
  if (abs >= 1e12) return `${sym}${(val / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sym}${Math.round(val / 1e9)}B`;
  if (abs >= 1e6) return `${sym}${Math.round(val / 1e6)}M`;
  return `${sym}${Math.round(val).toLocaleString(locale)}`;
}

function formatFullCurrency(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "$0.00";
  const { currency, rate } = getActiveCurrency();
  const val = n * rate;
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

function formatPriceExact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "$0.00";
  const { currency, rate, sym } = getActiveCurrency();
  const val = n * rate;
  if (val < 0.0001) return `${sym}${val.toFixed(8)}`;
  if (val < 0.01) return `${sym}${val.toFixed(6)}`;
  if (val < 1) return `${sym}${val.toFixed(4)}`;
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

/* ─────────────────────────────────────────────────────────────
   COINMARKETCAP THEME COLORS (Matching user uploaded screenshot)
   ───────────────────────────────────────────────────────────── */
function getTreemapTileBg(token: TokenItem): string {
  if (STABLECOINS.has(token.symbol.toUpperCase()) || Math.abs(token.change24h) < 0.03) {
    return "#5a6578"; // Slate gray for stablecoins
  }
  if (token.change24h >= 0) {
    return "#00c087"; // Vibrant emerald green
  }
  return "#ea3943"; // Vibrant crimson red
}

/* ─────────────────────────────────────────────────────────────
   SATIN 3D CUSHION BEVEL STYLES (For compact page view)
   ───────────────────────────────────────────────────────────── */
const CUSHION_GREEN: React.CSSProperties = {
  background: "radial-gradient(130% 120% at 30% 22%, #10b981 0%, #059669 35%, #047857 68%, #02432e 100%)",
  boxShadow: "inset 0 1px 1px 0 rgba(255, 255, 255, 0.4), inset 0 -2px 5px 0 rgba(0, 0, 0, 0.45), 0 3px 8px rgba(0, 0, 0, 0.35)",
  borderColor: "rgba(52, 211, 153, 0.25)",
};

const CUSHION_RED: React.CSSProperties = {
  background: "radial-gradient(130% 120% at 30% 22%, #ef4444 0%, #dc2626 35%, #b91c1c 68%, #6b1419 100%)",
  boxShadow: "inset 0 1px 1px 0 rgba(255, 255, 255, 0.4), inset 0 -2px 5px 0 rgba(0, 0, 0, 0.45), 0 3px 8px rgba(0, 0, 0, 0.35)",
  borderColor: "rgba(248, 113, 113, 0.25)",
};

function getCushionStyle(isUp: boolean): React.CSSProperties {
  return isUp ? CUSHION_GREEN : CUSHION_RED;
}

const MICRO_CUSHION_GREEN: React.CSSProperties = {
  background: "linear-gradient(180deg, #10b981 0%, #059669 100%)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 1px 2px rgba(0, 0, 0, 0.25)",
  borderColor: "rgba(16, 185, 129, 0.45)",
};

const MICRO_CUSHION_RED: React.CSSProperties = {
  background: "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 1px 2px rgba(0, 0, 0, 0.25)",
  borderColor: "rgba(239, 68, 68, 0.45)",
};

function getMicroCushionStyle(isUp: boolean): React.CSSProperties {
  return isUp ? MICRO_CUSHION_GREEN : MICRO_CUSHION_RED;
}

/* ─────────────────────────────────────────────────────────────
   COIN LOGO AVATAR
   ───────────────────────────────────────────────────────────── */
function CoinLogo({
  symbol,
  image,
  name,
}: {
  symbol: string;
  image?: string | null;
  name: string;
}) {
  const [hasError, setHasError] = useState(false);
  const src = !hasError ? image || COIN_LOGOS[symbol.toUpperCase()] : null;

  if (src) {
    return (
      <img
        src={src}
        alt={name || symbol}
        className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-contain shrink-0"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 text-white font-bold text-[9px] flex items-center justify-center shrink-0 uppercase">
      {symbol.slice(0, 2)}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   NEON GLOWING SPARKLINE (UPWARD TRENDING)
   ───────────────────────────────────────────────────────────── */
function NeonSparkline({
  data,
  isUp,
  id,
  className = "w-20 sm:w-24 h-10",
}: {
  data?: number[];
  isUp: boolean;
  id: string;
  className?: string;
}) {
  const points = data && data.length > 2 ? data : [20, 28, 25, 40, 38, 55, 62, 75, 95];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const w = 100;
  const h = 40;
  const step = w / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * step;
    const y = h - ((p - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  });

  const pathD = `M ${coords.join(" L ")}`;
  const strokeColor = isUp ? "#34d399" : "#f87171";
  const filterId = `neon-glow-${id.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor={strokeColor} floodOpacity="0.9" />
        </filter>
      </defs>
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${filterId})`}
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   EXACT COINMARKETCAP CRYPTO TREEMAP ENGINE
   - BTC occupies entire left vertical column (~58-60% width, 100% height)
   - ETH (~11.34%) and USDT (~6.34% gray) occupy top right tier
   - BNB (~3.61%), SOL (~2.47%), TRX (red), HYPE (green) in middle tier
   - XRP (top) & USDC (bottom, gray) on lower tier left
   - CoinMarketCap Columnar Matrix for small coins:
     Divided into 6-8 neat vertical columns (3-4 coins stacked vertically per column)
     Eliminates 1-pixel barcode slivers completely!
   ───────────────────────────────────────────────────────────── */
export interface TreemapNode {
  token: TokenItem;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  w: number; // percentage (0 - 100)
  h: number; // percentage (0 - 100)
  dominance: number; // percentage (e.g. 58.94)
}

function layoutColumnarMatrix(
  tokens: TokenItem[],
  startX: number,
  startY: number,
  totalWidth: number,
  totalHeight: number,
  totalMetricSum: number,
  metric: "marketCap" | "volume24h",
  results: TreemapNode[]
) {
  if (!tokens || tokens.length === 0 || totalWidth <= 0.1 || totalHeight <= 0.1) return;

  // Render the top 36-40 most prominent tokens in this sub-grid so each box
  // is guaranteed a solid readable aspect ratio without collapsing into thin barcode strips
  const activeTokens = tokens.slice(0, 36);

  // 6 to 8 columns based on totalWidth
  const numCols = Math.min(8, Math.max(5, Math.ceil(activeTokens.length / 4)));
  const colWidth = totalWidth / numCols;
  const itemsPerCol = Math.ceil(activeTokens.length / numCols);

  for (let c = 0; c < numCols; c++) {
    const colTokens = activeTokens.slice(c * itemsPerCol, (c + 1) * itemsPerCol);
    if (!colTokens.length) break;

    const colX = startX + c * colWidth;
    const itemHeight = totalHeight / colTokens.length;

    for (let r = 0; r < colTokens.length; r++) {
      const itemY = startY + r * itemHeight;
      const t = colTokens[r];
      const val = metric === "volume24h" ? t.volume24h : t.marketCap;
      const dom = ((val || 1) / totalMetricSum) * 100;

      results.push({
        token: t,
        x: colX,
        y: itemY,
        w: colWidth,
        h: itemHeight,
        dominance: dom,
      });
    }
  }
}

function squarifyFallback(
  items: { token: TokenItem; value: number }[],
  x: number,
  y: number,
  w: number,
  h: number,
  totalSum: number,
  results: TreemapNode[]
) {
  if (!items.length || w <= 0.1 || h <= 0.1) return;
  if (items.length === 1) {
    results.push({
      token: items[0].token,
      x,
      y,
      w,
      h,
      dominance: (items[0].value / totalSum) * 100,
    });
    return;
  }

  const isWide = w >= h;
  const currentTotal = items.reduce((sum, it) => sum + it.value, 0);
  if (currentTotal <= 0) return;

  let row: { token: TokenItem; value: number }[] = [];
  let rowSum = 0;
  let bestWorst = Infinity;
  let splitIndex = 0;

  for (let i = 0; i < items.length; i++) {
    const candidate = [...row, items[i]];
    const candidateSum = rowSum + items[i].value;
    const side = isWide ? h : w;
    const rowThickness = (candidateSum / currentTotal) * (isWide ? w : h);

    if (rowThickness <= 0) continue;

    let worst = 0;
    for (const item of candidate) {
      const itemLen = (item.value / candidateSum) * side;
      if (itemLen <= 0) continue;
      const aspect = Math.max(rowThickness / itemLen, itemLen / rowThickness);
      if (aspect > worst) worst = aspect;
    }

    if (worst <= bestWorst) {
      bestWorst = worst;
      row = candidate;
      rowSum = candidateSum;
      splitIndex = i + 1;
    } else {
      break;
    }
  }

  if (row.length === 0) {
    row = [items[0]];
    rowSum = items[0].value;
    splitIndex = 1;
  }

  const rowThickness = (rowSum / currentTotal) * (isWide ? w : h);
  let offset = isWide ? y : x;

  for (const item of row) {
    const side = isWide ? h : w;
    const itemLen = (item.value / rowSum) * side;
    if (isWide) {
      results.push({
        token: item.token,
        x,
        y: offset,
        w: rowThickness,
        h: itemLen,
        dominance: (item.value / totalSum) * 100,
      });
      offset += itemLen;
    } else {
      results.push({
        token: item.token,
        x: offset,
        y,
        w: itemLen,
        h: rowThickness,
        dominance: (item.value / totalSum) * 100,
      });
      offset += itemLen;
    }
  }

  const remainingItems = items.slice(splitIndex);
  if (remainingItems.length > 0) {
    if (isWide) {
      squarifyFallback(remainingItems, x + rowThickness, y, w - rowThickness, h, totalSum, results);
    } else {
      squarifyFallback(remainingItems, x, y + rowThickness, w, h - rowThickness, totalSum, results);
    }
  }
}

export function computeCryptoTreemap(
  tokens: TokenItem[],
  metric: "marketCap" | "volume24h" = "marketCap"
): TreemapNode[] {
  if (!tokens || tokens.length === 0) return [];

  const getVal = (t: TokenItem) =>
    metric === "volume24h" ? t.volume24h || 1e6 : t.marketCap || 1e8;

  const totalMetricSum = tokens.reduce((acc, t) => acc + getVal(t), 0) || 1;
  const results: TreemapNode[] = [];

  // Check if BTC, ETH, and SOL are present (Curated Image 1 Dashboard Layout)
  const btc = tokens.find((t) => t.symbol === "BTC");
  const eth = tokens.find((t) => t.symbol === "ETH");
  const sol = tokens.find((t) => t.symbol === "SOL");

  if (btc && eth && sol && tokens.length >= 10) {
    const btcDom = (getVal(btc) / totalMetricSum) * 100;
    const btcW = 53.5; // Left Mega Column

    // 1. BTC takes entire left vertical column
    results.push({
      token: btc,
      x: 0,
      y: 0,
      w: btcW,
      h: 100,
      dominance: btcDom,
    });

    const rx = btcW;
    const rw = 100 - btcW; // ~46.5%

    // 2. Right Top Tier: ETH & SOL (Exact Row 1 from Image 1!)
    const topH = 36;
    const ethVal = getVal(eth);
    const solVal = getVal(sol);
    const topSum = ethVal + solVal;
    const ethW = rw * Math.max(0.58, Math.min(0.68, ethVal / topSum));
    const solW = rw - ethW;

    results.push({
      token: eth,
      x: rx,
      y: 0,
      w: ethW,
      h: topH,
      dominance: (ethVal / totalMetricSum) * 100,
    });

    results.push({
      token: sol,
      x: rx + ethW,
      y: 0,
      w: solW,
      h: topH,
      dominance: (solVal / totalMetricSum) * 100,
    });

    // 3. Right Middle Tier: BNB, XRP, DOGE, ADA, TRX (Exact Row 2 from Image 1!)
    const row2Symbols = ["BNB", "XRP", "DOGE", "ADA", "TRX"];
    const row2Coins = row2Symbols
      .map((sym) => tokens.find((t) => t.symbol === sym))
      .filter(Boolean) as TokenItem[];

    const midY = topH;
    const midH = 25.5;

    if (row2Coins.length > 0) {
      const row2Sum = row2Coins.reduce((sum, t) => sum + getVal(t), 0);
      let curX = rx;
      row2Coins.forEach((coin, idx) => {
        const isLast = idx === row2Coins.length - 1;
        const w = isLast
          ? rx + rw - curX
          : rw * Math.max(0.14, Math.min(0.30, getVal(coin) / row2Sum));
        results.push({
          token: coin,
          x: curX,
          y: midY,
          w,
          h: midH,
          dominance: (getVal(coin) / totalMetricSum) * 100,
        });
        curX += w;
      });
    }

    // 4. Right Lower Tier: LINK, AVAX, SUI, HYPE, DOT (Exact Row 3 from Image 1!)
    const row3Symbols = ["LINK", "AVAX", "SUI", "HYPE", "DOT"];
    const row3Coins = row3Symbols
      .map((sym) => tokens.find((t) => t.symbol === sym))
      .filter(Boolean) as TokenItem[];

    const lowY = midY + midH;
    const lowH = 21;

    if (row3Coins.length > 0) {
      const row3Sum = row3Coins.reduce((sum, t) => sum + getVal(t), 0);
      let curX = rx;
      row3Coins.forEach((coin, idx) => {
        const isLast = idx === row3Coins.length - 1;
        const w = isLast
          ? rx + rw - curX
          : rw * Math.max(0.15, Math.min(0.26, getVal(coin) / row3Sum));
        results.push({
          token: coin,
          x: curX,
          y: lowY,
          w,
          h: lowH,
          dominance: (getVal(coin) / totalMetricSum) * 100,
        });
        curX += w;
      });
    }

    // 5. Bottom Mosaic Matrix: Exact 26 Curated Mosaic Tokens from Image 1!
    const placed = new Set([
      "BTC",
      "ETH",
      "SOL",
      ...row2Symbols,
      ...row3Symbols,
    ]);

    const remainingCoins = tokens.filter((t) => !placed.has(t.symbol));
    const botY = lowY + lowH;
    const botH = 100 - botY; // 17.5%

    if (remainingCoins.length > 0) {
      // 13 columns x 2 rows = exactly 26 cells
      const numCols = Math.min(13, Math.ceil(remainingCoins.length / 2));
      const colW = rw / numCols;
      const rowH = botH / 2;

      remainingCoins.forEach((coin, idx) => {
        const colIdx = idx % numCols;
        const rowIdx = Math.floor(idx / numCols);
        if (rowIdx < 2) {
          results.push({
            token: coin,
            x: rx + colIdx * colW,
            y: botY + rowIdx * rowH,
            w: colW,
            h: rowH,
            dominance: (getVal(coin) / totalMetricSum) * 100,
          });
        }
      });
    }

    return results;
  }

  // Fallback: General Squarified Treemap for filtered subsets or search queries
  const sorted = [...tokens].sort((a, b) => getVal(b) - getVal(a));
  const items = sorted.map((t) => ({
    token: t,
    value: getVal(t),
  }));
  squarifyFallback(items, 0, 0, 100, 100, totalMetricSum, results);
  return results;
}

const NO_LIVE_UPDATES: Record<string, { price: number; change24h: number }> = {};

function useLiveMarketHeatmap(initialCoins?: CoinRow[]) {
  // A Binance `!miniTicker@arr` socket used to live here. The site CSP
  // (connect-src) never allowed stream.binance.com, so in production it failed
  // and reconnected every 4s forever; had it connected, it would have parsed
  // every symbol on the exchange once a second. Tiles refresh from the cached
  // /api/markets/* polls instead.
  const isLive = false;
  const liveUpdates = NO_LIVE_UPDATES;

  const coinMap = useMemo(() => {
    const map = new Map<string, CoinRow>();
    if (initialCoins) {
      for (const c of initialCoins) {
        map.set(c.symbol.toUpperCase(), c);
      }
    }
    return map;
  }, [initialCoins]);

  const resolveToken = useCallback(
    (base: TokenItem): TokenItem => {
      const sym = base.symbol.toUpperCase();
      const live = liveUpdates[sym];
      const coin = coinMap.get(sym);

      let price = base.price;
      let change24h = base.change24h;
      let marketCap = base.marketCap;
      let volume24h = base.volume24h;
      let sparkline = base.sparkline;
      let image = base.image;

      if (coin) {
        price = coin.price;
        change24h = coin.change24h;
        marketCap = coin.marketCap || base.marketCap;
        volume24h = coin.volume24h || base.volume24h;
        image = coin.image || base.image;
        if (coin.sparkline && coin.sparkline.length > 1) {
          sparkline = coin.sparkline.slice(-10);
        }
      }

      if (live) {
        price = live.price;
        change24h = live.change24h;
        const refPrice = coin?.price && coin.price > 0 ? coin.price : base.price;
        if (refPrice > 0) {
          if (marketCap > 0) {
            marketCap = marketCap * (live.price / refPrice);
          }
          if (volume24h > 0) {
            volume24h = volume24h * (live.price / refPrice);
          }
        }
      }

      return {
        ...base,
        price,
        change24h,
        marketCap,
        volume24h,
        sparkline,
        image,
      };
    },
    [liveUpdates, coinMap]
  );

  const btc = useMemo(() => resolveToken(INITIAL_BTC), [resolveToken]);
  const eth = useMemo(() => resolveToken(INITIAL_ETH), [resolveToken]);
  const usdt = useMemo(() => resolveToken(INITIAL_USDT), [resolveToken]);
  const sol = useMemo(() => resolveToken(INITIAL_SOL), [resolveToken]);

  // A tile only renders when the live feed has that coin. The INITIAL_* lists
  // fix the layout and logos; their numbers are never shown on their own.
  const live = useCallback((t: TokenItem) => coinMap.has(t.symbol.toUpperCase()), [coinMap]);
  const row2 = useMemo(() => INITIAL_ROW2.filter(live).map(resolveToken), [live, resolveToken]);
  const row3 = useMemo(() => INITIAL_ROW3.filter(live).map(resolveToken), [live, resolveToken]);

  const mosaicRow2 = useMemo(() => INITIAL_MOSAIC_ROW2.filter(live).map(resolveToken), [live, resolveToken]);
  const mosaicRow3 = useMemo(() => INITIAL_MOSAIC_ROW3.filter(live).map(resolveToken), [live, resolveToken]);

  const allTop100 = useMemo(() => {
    const list: TokenItem[] = [btc, eth, usdt, sol].filter(live).concat(row2, row3, mosaicRow2, mosaicRow3);
    if (initialCoins) {
      for (const c of initialCoins) {
        if (!list.find((x) => x.symbol === c.symbol)) {
          const live = liveUpdates[c.symbol];
          list.push({
            symbol: c.symbol,
            name: c.name,
            id: c.id,
            price: live ? live.price : c.price,
            change24h: live ? live.change24h : c.change24h,
            marketCap: c.marketCap,
            volume24h: c.volume24h,
            sparkline: c.sparkline || [],
            image: c.image || COIN_LOGOS[c.symbol.toUpperCase()],
          });
        }
      }
    }
    return list.sort(
      (a, b) =>
        ((b.marketCap || 0) - (a.marketCap || 0)) ||
        a.symbol.localeCompare(b.symbol)
    );
  }, [btc, eth, usdt, sol, row2, row3, mosaicRow2, mosaicRow3, initialCoins, liveUpdates, live]);

  return {
    isLive,
    btc,
    eth,
    usdt,
    sol,
    row2,
    row3,
    mosaicRow2,
    mosaicRow3,
    allTop100,
  };
}

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT: MarketHeatmap
   ───────────────────────────────────────────────────────────── */
export function MarketHeatmap({ coins }: MarketHeatmapProps) {
  const { currency } = useCurrency();
  const [view, setView] = useState<"top100" | "sectors">("top100");
  const [isExpanded, setIsExpanded] = useState(false);
  const [modalFilter, setModalFilter] = useState<string>("All Crypto");
  const [searchQuery, setSearchQuery] = useState("");
  const [metric, setMetric] = useState<"marketCap" | "volume24h">("marketCap");
  const [zoomLevel, setZoomLevel] = useState<number>(1.0); // 0.85 (zoom-out) | 1.0 (normal) | 1.25 (zoom-in)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle escape key and lock body scroll when expanded
  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isExpanded]);

  // Live Sectors Data State
  // Starts empty and fills from /api/markets/sectors; no sample sectors.
  const [sectors, setSectors] = useState<SectorItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadLiveSectors() {
      try {
        const res = await fetch("/api/markets/sectors");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && Array.isArray(data?.sectors) && data.sectors.length > 0) {
          setSectors(data.sectors);
        }
      } catch {
        // preserve fallback
      }
    }
    loadLiveSectors();
    // /api/markets/sectors is cached for 180s at the edge; polling faster only
    // re-fetches the same snapshot. Skipped while the tab is hidden.
    const interval = setInterval(() => { if (!document.hidden) loadLiveSectors(); }, 180_000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Hover state for tooltip with 4 unique micro-badges
  const [hoveredTile, setHoveredTile] = useState<{
    token: {
      name: string;
      symbol: string;
      price: number;
      change24h: number;
      marketCap?: number;
      volume24h?: number;
      image?: string | null;
      category?: string | null;
    };
    dominance?: number;
    x: number;
    y: number;
    placement: "top" | "bottom";
  } | null>(null);

  const { isLive, btc, eth, sol, row2, row3, mosaicRow2, mosaicRow3, allTop100 } =
    useLiveMarketHeatmap(coins);
  const coinsTotalCap = useMemo(() => (coins ?? []).reduce((sum, c) => sum + (c.marketCap || 0), 0), [coins]);

  // Curated dashboard coins (exact 39 tokens from Image 1)
  const dashboardCoins = useMemo(() => {
    return [
      btc,
      eth,
      sol,
      ...row2,
      ...row3,
      ...mosaicRow2,
      ...mosaicRow3,
    ];
  }, [btc, eth, sol, row2, row3, mosaicRow2, mosaicRow3]);

  // Filtered coins for the CoinMarketCap Treemap
  const treemapCoins = useMemo(() => {
    let list = dashboardCoins;
    if (modalFilter === "Top 20") {
      list = dashboardCoins.slice(0, 20);
    } else if (modalFilter === "Top 50") {
      list = allTop100.slice(0, 50);
    } else if (modalFilter === "Layer 1") {
      list = dashboardCoins.filter(
        (c) =>
          c.category === "Layer 1" ||
          ["BTC", "ETH", "SOL", "BNB", "ADA", "AVAX", "SUI", "DOT", "NEAR", "APT", "TRX", "XRP"].includes(c.symbol)
      );
    } else if (modalFilter === "DeFi") {
      list = dashboardCoins.filter(
        (c) =>
          c.category === "DeFi" ||
          ["UNI", "AAVE", "LINK", "HYPE", "MKR", "INJ", "LDO"].includes(c.symbol)
      );
    } else if (modalFilter === "Meme") {
      list = dashboardCoins.filter(
        (c) =>
          c.category === "Meme" ||
          ["DOGE", "SHIB", "PEPE", "BONK", "FLOKI"].includes(c.symbol)
      );
    } else {
      // Default "All Crypto": Exact match with Image 1!
      list = dashboardCoins;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = allTop100.filter(
        (c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [dashboardCoins, allTop100, modalFilter, searchQuery]);

  // Compute CoinMarketCap Treemap nodes
  const treemapNodes = useMemo(() => {
    return computeCryptoTreemap(treemapCoins, metric);
  }, [treemapCoins, metric]);

  const handleTileMouseEnter = (
    e: React.MouseEvent<HTMLElement>,
    token: TokenItem,
    dominance?: number
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceAbove = rect.top;
    const placement: "top" | "bottom" = spaceAbove > 140 ? "top" : "bottom";
    const rawX = rect.left + rect.width / 2;
    const clampedX = Math.max(140, Math.min(window.innerWidth - 140, rawX));
    const targetY = placement === "top" ? rect.top - 8 : rect.bottom + 8;

    setHoveredTile({
      token,
      dominance,
      x: clampedX,
      y: targetY,
      placement,
    });
  };

  const handleSectorMouseEnter = (
    e: React.MouseEvent<HTMLElement>,
    sec: SectorItem
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceAbove = rect.top;
    const placement: "top" | "bottom" = spaceAbove > 140 ? "top" : "bottom";
    const rawX = rect.left + rect.width / 2;
    const clampedX = Math.max(140, Math.min(window.innerWidth - 140, rawX));
    const targetY = placement === "top" ? rect.top - 8 : rect.bottom + 8;

    setHoveredTile({
      token: {
        name: sec.name,
        symbol: sec.symbol,
        price: 0,
        change24h: sec.change24h,
        marketCap: sec.marketCap,
        volume24h: sec.volume24h,
        category: sec.topCoins && sec.topCoins.length ? `Top: ${sec.topCoins.join(", ")}` : undefined,
      },
      // Share of the live top-250 market cap (the feed this page has), not a fixed total.
      dominance: sec.marketCap && coinsTotalCap ? Number(((sec.marketCap / coinsTotalCap) * 100).toFixed(1)) : undefined,
      x: clampedX,
      y: targetY,
      placement,
    });
  };

  const handleTileMouseLeave = () => {
    setHoveredTile(null);
  };

  return (
    <div className="neu-card relative w-full h-full flex flex-col justify-between rounded-2xl border border-white/60 dark:border-white/[0.06] p-3 sm:p-3.5 shadow-neu overflow-hidden select-none">
      {/* ── TOP HEADER ── */}
      <div className="flex items-center justify-between gap-2 pb-2 flex-none border-b border-black/[0.06] dark:border-white/[0.05]">
        <div className="flex items-center gap-2">
          <h2 className="text-sm sm:text-[15px] font-bold text-zinc-900 dark:text-white tracking-tight">
            Market Heatmap
          </h2>
          {/* Live indicator dot */}
          <span
            title={isLive ? "Real-time live ticker stream active" : "Connected (periodic refresh)"}
            className="flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400 font-medium ml-0.5"
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                isLive
                  ? "bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)] animate-pulse"
                  : "bg-emerald-500/70"
              )}
            />
          </span>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setView("top100")}
            className={cn(
              "px-2.5 sm:px-3 py-1 rounded-xl text-xs transition-all font-semibold",
              view === "top100"
                ? "neu-inset border border-amber-400/50 text-amber-800 dark:text-amber-300 bg-amber-400/25 shadow-neu-inset-sm"
                : "neu-btn text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-white/60 dark:border-white/[0.06] shadow-neu-sm"
            )}
          >
            Top 100
          </button>
          <button
            onClick={() => setView("sectors")}
            className={cn(
              "px-2.5 sm:px-3 py-1 rounded-xl text-xs transition-all font-semibold",
              view === "sectors"
                ? "neu-inset border border-amber-400/50 text-amber-800 dark:text-amber-300 bg-amber-400/25 shadow-neu-inset-sm"
                : "neu-btn text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-white/60 dark:border-white/[0.06] shadow-neu-sm"
            )}
          >
            Sectors
          </button>

          {/* Fullscreen / Expand button */}
          <button
            onClick={() => setIsExpanded(true)}
            title="Expand CoinMarketCap-style Crypto Treemap"
            className="neu-btn p-1.5 rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-white/60 dark:border-white/10 shadow-neu-sm transition-colors ml-0.5"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── COMPACT HEATMAP VIEWPORT (Top 100 3-Row Cushion Cards or Sectors) ── */}
      <div className="flex flex-col justify-between gap-1.5 flex-1 min-h-0 pt-2 relative">
        {(view === "top100" ? !coins?.length : !sectors.length) ? (
          <div className="grid h-full min-h-[160px] grid-cols-3 gap-1.5 sm:gap-2" aria-label="Loading live market data">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        ) : view === "top100" ? (
          <>
            {/* ROW 1: BTC, ETH, SOL (Big 3 Primary Cushion Cards) */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 flex-[1.3] min-h-0">
              {[btc, eth, sol].map((coin) => {
                const isUp = coin.change24h >= 0;
                return (
                  <Link
                    key={coin.symbol}
                    href={`/markets/${coin.id}`}
                    style={getCushionStyle(isUp)}
                    onMouseEnter={(e) => handleTileMouseEnter(e, coin)}
                    onMouseLeave={handleTileMouseLeave}
                    className="rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between border transition-all duration-200 hover:brightness-110 active:scale-[0.99] relative overflow-hidden group cursor-pointer"
                  >
                    <div className="flex flex-col justify-center h-full min-w-0 pr-1">
                      <span className="font-extrabold text-sm sm:text-[16px] lg:text-[17px] text-[#ffffff] !text-[#ffffff] leading-none tracking-tight">
                        {coin.symbol}
                      </span>
                      <span className="font-bold text-xs sm:text-[13px] text-[#ffffff] !text-[#ffffff]/95 leading-none tracking-tight mt-1.5">
                        {isUp ? "+" : ""}
                        {coin.change24h.toFixed(2)}%
                      </span>
                      <span className="font-medium text-[10px] sm:text-[11.5px] text-[#ffffff] !text-[#ffffff]/80 leading-none tracking-tight mt-1.5">
                        {formatMcapCompact(coin.marketCap)}
                      </span>
                    </div>

                    <div className="h-full flex items-center justify-end flex-1 pl-1">
                      <NeonSparkline data={coin.sparkline} isUp={isUp} id={coin.symbol} />
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* ROW 2: BNB, XRP, DOGE, ADA, TRX + Mosaic Treemap Cluster */}
            <div className="grid grid-cols-12 gap-1.5 sm:gap-2 flex-1 min-h-0">
              {row2.map((coin) => {
                const isUp = coin.change24h >= 0;
                return (
                  <Link
                    key={coin.symbol}
                    href={`/markets/${coin.id}`}
                    style={getCushionStyle(isUp)}
                    onMouseEnter={(e) => handleTileMouseEnter(e, coin)}
                    onMouseLeave={handleTileMouseLeave}
                    className="col-span-2 rounded-lg px-2 py-1.5 flex flex-col justify-center border transition-all duration-200 hover:brightness-110 active:scale-[0.99] cursor-pointer"
                  >
                    <span className="font-extrabold text-xs sm:text-[13px] text-[#ffffff] !text-[#ffffff] leading-none truncate">
                      {coin.symbol}
                    </span>
                    <span className="font-bold text-[10.5px] sm:text-xs text-[#ffffff] !text-[#ffffff]/95 leading-none mt-1.5">
                      {isUp ? "+" : ""}
                      {coin.change24h.toFixed(2)}%
                    </span>
                  </Link>
                );
              })}

              {/* Mini Mosaic Treemap Row 2 (6 Tokens) */}
              <div className="col-span-2 grid grid-cols-2 grid-rows-3 gap-0.5 sm:gap-1">
                {mosaicRow2.map((m) => {
                  const isUp = m.change24h >= 0;
                  return (
                    <Link
                      key={m.symbol}
                      href={`/markets/${m.id}`}
                      style={getMicroCushionStyle(isUp)}
                      onMouseEnter={(e) => handleTileMouseEnter(e, m)}
                      onMouseLeave={handleTileMouseLeave}
                      className="rounded-[3px] sm:rounded-[4px] border flex items-center justify-center overflow-hidden transition-all hover:scale-110 active:scale-110 cursor-pointer px-0.5"
                    >
                      <span className="font-extrabold text-[8.5px] sm:text-[9.5px] text-[#ffffff] !text-[#ffffff] leading-none uppercase select-none tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]">
                        {m.symbol}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* ROW 3: LINK, AVAX, SUI, HYPE, DOT + Micro Mosaic Matrix */}
            <div className="grid grid-cols-12 gap-1.5 sm:gap-2 flex-1 min-h-0">
              {row3.map((coin) => {
                const isUp = coin.change24h >= 0;
                return (
                  <Link
                    key={coin.symbol}
                    href={`/markets/${coin.id}`}
                    style={getCushionStyle(isUp)}
                    onMouseEnter={(e) => handleTileMouseEnter(e, coin)}
                    onMouseLeave={handleTileMouseLeave}
                    className="col-span-2 rounded-lg px-2 py-1.5 flex flex-col justify-center border transition-all duration-200 hover:brightness-110 active:scale-[0.99] cursor-pointer"
                  >
                    <span className="font-extrabold text-xs sm:text-[13px] text-[#ffffff] !text-[#ffffff] leading-none truncate">
                      {coin.symbol}
                    </span>
                    <span className="font-bold text-[10.5px] sm:text-xs text-[#ffffff] !text-[#ffffff]/95 leading-none mt-1.5">
                      {isUp ? "+" : ""}
                      {coin.change24h.toFixed(2)}%
                    </span>
                  </Link>
                );
              })}

              {/* Micro Mosaic Matrix Row 3 (20 Small Coins) */}
              <div className="col-span-2 grid grid-cols-5 grid-rows-4 gap-0.5">
                {mosaicRow3.slice(0, 20).map((m) => {
                  const isUp = m.change24h >= 0;
                  const symLen = m.symbol.length;
                  const scaleVal =
                    symLen >= 5 ? 0.46 : symLen === 4 ? 0.52 : symLen === 3 ? 0.66 : 0.82;
                  return (
                    <Link
                      key={m.symbol}
                      href={`/markets/${m.id}`}
                      style={getMicroCushionStyle(isUp)}
                      onMouseEnter={(e) => handleTileMouseEnter(e, m)}
                      onMouseLeave={handleTileMouseLeave}
                      className="rounded-[3px] border flex items-center justify-center overflow-hidden transition-all hover:scale-125 active:scale-125 cursor-pointer relative"
                    >
                      <span
                        style={{
                          fontSize: "9px",
                          transform: `scale(${scaleVal})`,
                          transformOrigin: "center center",
                          display: "inline-block",
                          lineHeight: 1,
                        }}
                        className="font-black text-[#ffffff] !text-[#ffffff] whitespace-nowrap tracking-tight select-none text-center drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
                      >
                        {m.symbol}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          /* ── SECTORS VIEW: Clean 3x3 Aligned Matrix (Zero Truncation, Live Data) ── */
          <div className="flex flex-col gap-1.5 sm:gap-2 h-full justify-between">
            {/* Tier 1: 3 Macro Powerhouse Sectors (Full width text, L1/DeFi/AI never clipped) */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 h-[74px] flex-none">
              {sectors.slice(0, 3).map((sec) => {
                const isUp = sec.change24h >= 0;
                return (
                  <div
                    key={sec.symbol}
                    style={getCushionStyle(isUp)}
                    onMouseEnter={(e) => handleSectorMouseEnter(e, sec)}
                    onMouseLeave={handleTileMouseLeave}
                    className="rounded-xl p-2 sm:p-2.5 flex flex-col justify-between border transition-all duration-200 hover:brightness-110 active:scale-[0.98] cursor-pointer shadow-sm overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-black text-xs sm:text-[13px] text-[#ffffff] !text-[#ffffff] tracking-tight leading-none">
                        {sec.name}
                      </span>
                      <span className="font-extrabold text-[10px] text-[#ffffff] !text-[#ffffff]/95 leading-none px-1.5 py-0.5 rounded bg-black/25 flex-shrink-0">
                        {isUp ? "+" : ""}{sec.change24h.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-end justify-between gap-1 mt-auto">
                      <div className="flex flex-col leading-none">
                        <span className="font-bold text-[11px] sm:text-xs text-white/90">
                          {formatMcapCompact(sec.marketCap)}
                        </span>
                        {sec.topCoins && sec.topCoins.length > 0 && (
                          <span className="text-[8.5px] font-semibold text-white/60 tracking-wider uppercase mt-0.5">
                            {sec.topCoins.slice(0, 2).join(" · ")}
                          </span>
                        )}
                      </div>
                      <div className="w-12 h-6 flex-shrink-0 flex items-center justify-end opacity-90">
                        <NeonSparkline data={sec.sparkline} isUp={isUp} id={`sec-${sec.symbol}`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tier 2: 6 Core Alt Sectors in balanced 3-column matrix (Aligned with Tier 1) */}
            <div className="grid grid-cols-3 grid-rows-2 gap-1.5 sm:gap-2 flex-1 min-h-0">
              {sectors.slice(3, 9).map((sec) => {
                const isUp = sec.change24h >= 0;
                return (
                  <div
                    key={sec.symbol}
                    style={getCushionStyle(isUp)}
                    onMouseEnter={(e) => handleSectorMouseEnter(e, sec)}
                    onMouseLeave={handleTileMouseLeave}
                    className="rounded-lg p-2 flex flex-col justify-between border transition-all duration-200 hover:brightness-110 active:scale-[0.98] cursor-pointer shadow-sm overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-black text-[11px] sm:text-xs text-white leading-tight">
                        {sec.name}
                      </span>
                      <span className="font-bold text-[10px] text-white/95 leading-none px-1.5 py-0.5 rounded bg-black/20 flex-shrink-0">
                        {isUp ? "+" : ""}{sec.change24h.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-1 mt-auto text-[10px] text-white/80 leading-none">
                      <span className="font-semibold">{formatMcapCompact(sec.marketCap)}</span>
                      <span className="text-white/50 text-[8.5px] uppercase font-bold tracking-wider">{sec.symbol}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── EXACT FLOATING HOVER CARD WITH UNIQUE CRYPTO BADGES (PORTAL TO BODY) ── */}
      {mounted &&
        hoveredTile &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: `${hoveredTile.x}px`,
              top: `${hoveredTile.y}px`,
              transform:
                hoveredTile.placement === "top"
                  ? "translate(-50%, -100%)"
                  : "translate(-50%, 0%)",
              zIndex: 999999,
            }}
            className="pointer-events-none rounded-xl bg-white border border-slate-200 p-2.5 sm:p-3 shadow-2xl shadow-black/40 min-w-[225px] sm:min-w-[250px] flex flex-col gap-1.5 select-none"
          >
            {/* Line 1: Coin Logo + Name + Symbol Badge */}
            <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100">
              <CoinLogo
                symbol={hoveredTile.token.symbol}
                image={hoveredTile.token.image}
                name={hoveredTile.token.name}
              />
              <span className="font-bold text-[13.5px] sm:text-sm text-zinc-950 tracking-tight leading-none">
                {hoveredTile.token.name}
              </span>
              <span className="bg-[#edf2f7] text-[#64748b] font-semibold text-[10px] px-1.5 py-0.5 rounded-[4px] leading-none uppercase ml-0.5">
                {hoveredTile.token.symbol}
              </span>
            </div>

            {/* Line 2: Price with UNIQUE Emerald Currency Badge */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-4 h-4 rounded-md bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center shrink-0 text-emerald-600 shadow-xs">
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-none stroke-current stroke-[2.5]" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="2" x2="12" y2="22" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </span>
              <span className="font-semibold text-[#64748b]">Price:</span>
              <span className="font-extrabold text-zinc-900 font-mono tracking-tight text-[12.5px] sm:text-xs">
                {hoveredTile.token.price > 0
                  ? formatPriceExact(hoveredTile.token.price)
                  : "Index Avg"}
              </span>
              <span
                className={cn(
                  "font-bold text-[10.5px] px-1.5 py-0.5 rounded-[4px] text-white flex items-center gap-0.5 ml-auto leading-none",
                  hoveredTile.token.change24h >= 0 ? "bg-[#00c087]" : "bg-[#f04438]"
                )}
              >
                <span>{hoveredTile.token.change24h >= 0 ? "▲" : "▼"}</span>
                <span>{Math.abs(hoveredTile.token.change24h).toFixed(2)}%</span>
              </span>
            </div>

            {/* Line 3: Market Cap with UNIQUE Royal Blue Valuation Pie-Chart Badge */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-4 h-4 rounded-md bg-blue-500/15 border border-blue-500/35 flex items-center justify-center shrink-0 text-blue-600 shadow-xs">
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-none stroke-current stroke-[2.5]" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                  <path d="M22 12A10 10 0 0 0 12 2v10z" />
                </svg>
              </span>
              <span className="font-semibold text-[#64748b]">Market Cap:</span>
              <span className="font-bold text-zinc-900 font-mono tracking-tight text-[11px] sm:text-[11.5px]">
                {formatFullCurrency(hoveredTile.token.marketCap)}
              </span>
            </div>

            {/* Line 4: Volume(24h) with UNIQUE Violet 24h Turnover Exchange Arrows Badge */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-4 h-4 rounded-md bg-purple-500/15 border border-purple-500/35 flex items-center justify-center shrink-0 text-purple-600 shadow-xs">
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-none stroke-current stroke-[2.5]" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m16 3 4 4-4 4" />
                  <path d="M20 7H4" />
                  <path d="m8 21-4-4 4-4" />
                  <path d="M4 17h16" />
                </svg>
              </span>
              <span className="font-semibold text-[#64748b]">Volume(24h):</span>
              <span className="font-bold text-zinc-900 font-mono tracking-tight text-[11px] sm:text-[11.5px]">
                {formatFullCurrency(hoveredTile.token.volume24h)}
              </span>
            </div>

            {/* Line 5: Dominance with UNIQUE Amber Crown Badge */}
            {hoveredTile.dominance != null && hoveredTile.dominance > 0 && (
              <div className="flex items-center gap-1.5 text-xs pt-0.5 border-t border-slate-100">
                <span className="w-4 h-4 rounded-md bg-amber-500/15 border border-amber-500/35 flex items-center justify-center shrink-0 text-amber-600 shadow-xs">
                  <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-none stroke-current stroke-[2.5]" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
                  </svg>
                </span>
                <span className="font-semibold text-[#64748b]">
                  {metric === "volume24h" ? "Vol Share:" : "Dominance:"}
                </span>
                <span className="font-bold text-zinc-900 font-mono tracking-tight text-[11px] sm:text-[11.5px]">
                  {hoveredTile.dominance.toFixed(2)}%
                </span>
              </div>
            )}
          </div>,
          document.body
        )}

      {/* ── EXPANDED FULLSCREEN MODAL: EXACT COINMARKETCAP CRYPTO TREEMAP (PORTAL TO BODY) ── */}
      {mounted &&
        isExpanded &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsExpanded(false);
            }}
            className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-5"
          >
            <div className="w-full max-w-7xl h-[94vh] rounded-2xl bg-[#090D14] border border-white/10 p-3 sm:p-4 shadow-2xl flex flex-col justify-between overflow-hidden">
              {/* Modal Header: Title + Metric Selector + Filters + Zoom Controls + Close */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-2.5 border-b border-white/10 flex-none">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Crypto Heatmap
                  </h3>

                  {/* Metric Selector Dropdown: By Market Cap / By 24h Volume */}
                  <div className="flex items-center bg-[#121822] p-0.5 rounded-lg border border-white/10 text-xs ml-1">
                    <button
                      onClick={() => setMetric("marketCap")}
                      className={cn(
                        "px-2.5 py-1 rounded-[6px] font-semibold transition-all",
                        metric === "marketCap"
                          ? "bg-[#1f293d] text-white shadow-xs"
                          : "text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      By Market Cap
                    </button>
                    <button
                      onClick={() => setMetric("volume24h")}
                      className={cn(
                        "px-2.5 py-1 rounded-[6px] font-semibold transition-all",
                        metric === "volume24h"
                          ? "bg-[#1f293d] text-white shadow-xs"
                          : "text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      By 24h Volume
                    </button>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                </div>

                {/* Filter controls + Zoom controls + Search */}
                <div className="flex items-center gap-2 flex-wrap justify-between lg:justify-end">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search coin..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:outline-hidden focus:border-amber-400/50 w-28 sm:w-32 transition-all"
                    />
                  </div>

                  {/* Sector / Category Filter Pills */}
                  <div className="flex items-center gap-1 bg-[#121822] p-0.5 rounded-lg border border-white/10 overflow-x-auto max-w-full">
                    {["All Crypto", "Top 50", "Top 20", "Layer 1", "DeFi", "Meme"].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setModalFilter(tab)}
                        className={cn(
                          "px-2.5 py-1 rounded-[6px] text-xs font-semibold whitespace-nowrap transition-all",
                          modalFilter === tab
                            ? "bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-xs"
                            : "text-zinc-400 hover:text-zinc-200"
                        )}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Zoom Controls: Zoom Out (-) | 100% | Zoom In (+) */}
                  <div className="flex items-center bg-[#121822] p-0.5 rounded-lg border border-white/10 text-xs">
                    <button
                      onClick={() => setZoomLevel((z) => Math.max(0.85, +(z - 0.15).toFixed(2)))}
                      title="Zoom out (see more macro tiles)"
                      className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setZoomLevel(1.0)}
                      title="Reset zoom to 100%"
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10.5px] font-mono transition-colors font-medium",
                        zoomLevel === 1.0 ? "text-amber-300 font-bold" : "text-zinc-400 hover:text-white"
                      )}
                    >
                      {Math.round(zoomLevel * 100)}%
                    </button>
                    <button
                      onClick={() => setZoomLevel((z) => Math.min(1.3, +(z + 0.15).toFixed(2)))}
                      title="Zoom in (enlarge small tiles)"
                      className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Close modal */}
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors ml-0.5"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* ── EXACT COINMARKETCAP SQUARIFIED TREEMAP VIEWPORT ── */}
              <div className="relative w-full flex-1 my-2 rounded-xl bg-[#060A10] border border-white/[0.08] overflow-hidden select-none">
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: "center center",
                    transition: "transform 200ms ease-out",
                  }}
                  className="w-full h-full"
                >
                  {treemapNodes.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                      No coins found matching criteria.
                    </div>
                  ) : (
                    treemapNodes.map((node) => {
                      const token = node.token;
                      const isUp = token.change24h >= 0;
                      const bg = getTreemapTileBg(token);
                      const dom = node.dominance;

                      // Dynamic sizing categories
                      const isMega = node.w >= 40 && node.h >= 75; // BTC
                      const isLarge = !isMega && node.w >= 14 && node.h >= 25; // ETH, USDT
                      const isMedium = !isMega && !isLarge && node.w >= 6 && node.h >= 10; // BNB, SOL, XRP, USDC, TRX
                      const isSmall = !isMega && !isLarge && !isMedium && (node.w >= 2.8 || node.h >= 5.5); // ZEC, DOGE, XLM, BCH, NEAR
                      const isMicro = !isMega && !isLarge && !isMedium && !isSmall; // Tiny matrix tiles

                      return (
                        <Link
                          key={token.symbol}
                          href={`/markets/${token.id}`}
                          onClick={() => setIsExpanded(false)}
                          style={{
                            position: "absolute",
                            left: `${node.x}%`,
                            top: `${node.y}%`,
                            width: `${node.w}%`,
                            height: `${node.h}%`,
                            padding: isMicro ? "0.75px" : "1.25px",
                          }}
                          onMouseEnter={(e) => handleTileMouseEnter(e, token, dom)}
                          onMouseLeave={handleTileMouseLeave}
                          className={cn(
                            "group cursor-pointer select-none transition-transform duration-150",
                            isMicro
                              ? "hover:scale-125 hover:z-40 hover:shadow-2xl hover:brightness-110"
                              : "hover:z-20 hover:brightness-105"
                          )}
                        >
                          <div
                            style={{ backgroundColor: bg }}
                            className="w-full h-full rounded-[2.5px] p-1 flex flex-col items-center justify-center text-center text-white overflow-hidden relative shadow-xs"
                          >
                            {isMega ? (
                              /* Mega Block: BTC */
                              <div className="flex flex-col items-center justify-between h-full w-full py-4 sm:py-6">
                                <div className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight">
                                  {token.symbol}
                                </div>
                                <div className="flex flex-col items-center my-auto">
                                  <div className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight font-mono">
                                    {formatPriceExact(token.price)}
                                  </div>
                                  <div className="text-xl sm:text-2xl lg:text-3xl font-semibold mt-2 flex items-center justify-center gap-1.5">
                                    <span>{isUp ? "▲" : "▼"}</span>
                                    <span>{Math.abs(token.change24h).toFixed(2)}%</span>
                                  </div>
                                </div>
                                <div className="text-lg sm:text-xl lg:text-2xl font-medium opacity-95">
                                  {metric === "volume24h"
                                    ? `Vol Share : ${dom.toFixed(2)}%`
                                    : `Dominance : ${dom.toFixed(2)}%`}
                                </div>
                              </div>
                            ) : isLarge ? (
                              /* Large Block: ETH, USDT */
                              <div className="flex flex-col items-center justify-between h-full w-full py-2 sm:py-3">
                                <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
                                  {token.symbol}
                                </div>
                                <div className="flex flex-col items-center my-auto">
                                  <div className="text-lg sm:text-2xl lg:text-3xl font-bold tracking-tight font-mono">
                                    {formatPriceExact(token.price)}
                                  </div>
                                  <div className="text-xs sm:text-base lg:text-lg font-semibold mt-1 flex items-center justify-center gap-1">
                                    <span>{isUp ? "▲" : "▼"}</span>
                                    <span>{Math.abs(token.change24h).toFixed(2)}%</span>
                                  </div>
                                </div>
                                <div className="text-xs sm:text-sm lg:text-base font-medium opacity-95">
                                  {metric === "volume24h"
                                    ? `Vol Share : ${dom.toFixed(2)}%`
                                    : `Dominance : ${dom.toFixed(2)}%`}
                                </div>
                              </div>
                            ) : isMedium ? (
                              /* Medium Block: BNB, SOL, XRP, USDC, TRX */
                              <div className="flex flex-col items-center justify-between h-full w-full py-1">
                                <div className="text-xs sm:text-sm lg:text-base font-bold leading-tight">
                                  {token.symbol}
                                </div>
                                <div className="flex flex-col items-center my-auto">
                                  <div className="text-[11px] sm:text-xs lg:text-sm font-bold leading-tight font-mono">
                                    {formatPriceExact(token.price)}
                                  </div>
                                  <div className="text-[9.5px] sm:text-[11px] font-semibold leading-tight mt-0.5">
                                    {isUp ? "▲" : "▼"} {Math.abs(token.change24h).toFixed(2)}%
                                  </div>
                                </div>
                                {node.h >= 9 && (
                                  <div className="text-[9px] sm:text-[10px] font-medium opacity-90 leading-tight">
                                    {metric === "volume24h"
                                      ? `Vol : ${dom.toFixed(2)}%`
                                      : `Dominance : ${dom.toFixed(2)}%`}
                                  </div>
                                )}
                              </div>
                            ) : isSmall ? (
                              /* Small Block: DOGE, XLM, BCH, NEAR, LINK, ZEC */
                              <div className="flex flex-col items-center justify-center h-full w-full p-0.5 leading-none">
                                <div className="text-[10px] sm:text-[11.5px] font-bold truncate">
                                  {token.symbol}
                                </div>
                                {node.h >= 6 && (
                                  <div className="text-[8.5px] sm:text-[9.5px] font-mono font-medium mt-0.5 truncate">
                                    {formatPriceExact(token.price)}
                                  </div>
                                )}
                                <div className="text-[8px] sm:text-[9px] font-semibold mt-0.5">
                                  {isUp ? "+" : ""}{token.change24h.toFixed(1)}%
                                </div>
                                {node.h >= 10 && (
                                  <div className="text-[7.5px] sm:text-[8px] opacity-80 mt-0.5">
                                    {`${dom.toFixed(1)}%`}
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Micro/Nano Matrix Tile (Eliminates Barcode Slivers) */
                              <div className="flex flex-col items-center justify-center h-full w-full leading-none p-0.5">
                                <span className="text-[8.5px] sm:text-[9.5px] font-black truncate">
                                  {token.symbol}
                                </span>
                                {node.h >= 4.5 && (
                                  <span className="text-[7px] sm:text-[7.5px] font-semibold opacity-90 mt-0.5">
                                    {isUp ? "+" : ""}{token.change24h.toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-400 flex-none">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span>Real-Time Crypto Treemap · Binance WebSocket Feed</span>
                  <span className="text-zinc-600">·</span>
                  <span>
                    Metric: <strong className="text-white capitalize">{metric === "marketCap" ? "Market Capitalization" : "24h Volume"}</strong>
                  </span>
                  <span className="text-zinc-600 hidden sm:inline">·</span>
                  <span className="hidden sm:inline">
                    Showing {treemapCoins.length} assets
                  </span>
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors font-medium self-end sm:self-auto"
                >
                  Close Treemap
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
