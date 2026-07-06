import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// PWA web app manifest. Next.js serves this at /manifest.webmanifest and injects
// the <link rel="manifest"> tag. Together with the service worker (public/sw.js,
// registered globally by <ServiceWorkerRegister/>) this makes the site
// installable to a phone/desktop home screen and work offline.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: site.name,
    short_name: "XYZ Crypto",
    description: site.description,
    start_url: "/?utm_source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05060a",
    theme_color: "#05060a",
    categories: ["finance", "news", "productivity"],
    icons: [
      { src: "/logo.jpg", sizes: "192x192", type: "image/jpeg", purpose: "any" },
      { src: "/logo.jpg", sizes: "512x512", type: "image/jpeg", purpose: "any" },
      { src: "/logo.jpg", sizes: "512x512", type: "image/jpeg", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Markets", short_name: "Markets", url: "/markets" },
      { name: "News", short_name: "News", url: "/news" },
      { name: "Research", short_name: "Research", url: "/research" },
    ],
  };
}
