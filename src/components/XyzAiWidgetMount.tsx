"use client";

import dynamic from "next/dynamic";

// Defer the XYZ AI widget (framer-motion + markdown + auth UI) out of the shared
// first-load bundle on every page. It only renders for signed-in users and only
// on interaction, so ssr:false + lazy is safe and removes real weight up front.
const Widget = dynamic(() => import("./XyzAiWidget").then((m) => m.XyzAiWidget), { ssr: false });

export function XyzAiWidgetMount() {
  return <Widget />;
}
