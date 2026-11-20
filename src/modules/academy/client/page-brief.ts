"use client";

import { useSyncExternalStore } from "react";

/**
 * What AneQue knows about the page she is docked on outside the Academy
 * (Markets, News, Points). The page's own client component publishes it from
 * the data already on screen, so she speaks the same numbers the reader sees
 * and Live Talk answers from them instead of guessing.
 *
 *  `build()` returns, at the moment it is needed:
 *  - `spoken`: short sentences read aloud by "Explain this page".
 *  - `context`: a compact plain-text snapshot sent with Live Talk questions.
 */
export type BriefContent = { spoken: string[]; context: string };
export type PageBrief = {
  page: "markets" | "news" | "points";
  /** Button label, e.g. "Explain the market". */
  label: string;
  /** Built at the moment she speaks, from the freshest data the page has. */
  build: () => BriefContent;
};

let brief: PageBrief | null = null;
const listeners = new Set<() => void>();

export function setPageBrief(next: PageBrief | null) {
  if (brief && next && brief.page === next.page && brief.label === next.label && brief.build === next.build) return;
  brief = next;
  listeners.forEach((l) => l());
}
export const getPageBrief = () => brief;

const sub = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export function usePageBrief(): PageBrief | null {
  return useSyncExternalStore(sub, getPageBrief, () => null);
}

/** "$67,420", "$0.2442", "$1.23T". Pure, for tests. */
export function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "unknown";
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)} trillion`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)} billion`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)} million`;
  if (a >= 1000) return `$${Math.round(n).toLocaleString("en-US")}`;
  if (a >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(3)}`;
}
export function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "flat";
  const v = Math.abs(n).toFixed(Math.abs(n) >= 10 ? 0 : 1);
  return n >= 0 ? `up ${v} percent` : `down ${v} percent`;
}
