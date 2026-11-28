"use client";

import dynamic from "next/dynamic";
import { CUSTOMIZE_EVENT } from "@shared/utils/site-prefs";
import { useDeferredMount } from "@shared/hooks/useIdleGate";

// Client-only and lazy: the sheet is only ever opened by a tap, so it loads
// once the page is idle, or straight away if that tap comes first.
const CustomizeSheet = dynamic(() => import("./CustomizeSheet").then((m) => m.CustomizeSheet), { ssr: false });

export function CustomizeSheetMount() {
  return useDeferredMount(CUSTOMIZE_EVENT) ? <CustomizeSheet /> : null;
}
