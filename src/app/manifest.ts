import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// PWA web app manifest. Next.js automatically serves this at
// /manifest.webmanifest and injects the <link rel="manifest"> tag.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.name,
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#05060a",
    theme_color: "#05060a",
    icons: [
      { src: "/logo.jpg", sizes: "192x192", type: "image/jpeg" },
      { src: "/logo.jpg", sizes: "512x512", type: "image/jpeg" },
    ],
  };
}
