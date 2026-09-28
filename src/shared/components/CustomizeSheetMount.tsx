"use client";

import dynamic from "next/dynamic";

// Client-only and lazy: the sheet is only ever opened by a tap, so none of it
// belongs in the first-load bundle of any page.
const CustomizeSheet = dynamic(() => import("./CustomizeSheet").then((m) => m.CustomizeSheet), { ssr: false });

export function CustomizeSheetMount() {
  return <CustomizeSheet />;
}
