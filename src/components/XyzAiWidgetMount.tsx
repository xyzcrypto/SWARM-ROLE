"use client";

import dynamic from "next/dynamic";

// Code-split the AI chat widget into its own chunk (loaded after hydration,
// not in the initial bundle) so every route - including /login, /signup and
// static marketing pages - doesn't pay for framer-motion + the streaming chat
// logic just to render a collapsed launcher button. Same pattern as
// CommandPaletteMount/BottomNavMount.
const XyzAiWidget = dynamic(() => import("./XyzAiWidget").then((m) => m.XyzAiWidget), { ssr: false });

export function XyzAiWidgetMount() {
  return <XyzAiWidget />;
}
