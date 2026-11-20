"use client";

import dynamic from "next/dynamic";

// AneQue's dock on Markets, News and Points. Loaded after the page is
// interactive (no SSR, separate chunk) so it adds nothing to first paint or
// to the page's initial JavaScript; the page publishes what she should say via
// setPageBrief().
const GuideDock = dynamic(() => import("./Guide").then((m) => m.GuideDock), { ssr: false });

export function AneQueDockLazy() {
  return <GuideDock />;
}
