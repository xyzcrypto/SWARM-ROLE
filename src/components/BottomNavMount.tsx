"use client";

import dynamic from "next/dynamic";

// Code-split: the mobile bottom bar loads post-hydration in its own chunk.
const BottomNav = dynamic(() => import("./BottomNav").then((m) => m.BottomNav), { ssr: false });

export function BottomNavMount() {
  return <BottomNav />;
}
