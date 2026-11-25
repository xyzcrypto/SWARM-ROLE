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
    // ⚠️ These are the ONLY place the new 3D coin logo is used. The website
    // itself (navbar, footer, hero, loaders, favicon, share cards) deliberately
    // stays on the original `/logo.png` - this is the installed-app identity
    // only: home screen icon and the splash Android draws while the app opens.
    //
    // Three files rather than one, because each slot crops differently:
    //  - "any"      transparent, coin near full-bleed. Android centres this on
    //               `background_color` for the splash, so transparency is right.
    //  - "maskable" opaque and edge-to-edge, coin at 70%. Adaptive icons get
    //               cropped to a circle/squircle and only the centre 80% is
    //               guaranteed, so a full-bleed coin would lose its gold rim.
    // The previous entries declared a 192x192 and a 512x512 that both pointed at
    // the same 640x640 file; these sizes are the files' real dimensions.
    icons: [
      { src: "/logo-app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/logo-app.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/logo-app-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Markets", short_name: "Markets", url: "/markets" },
      { name: "News", short_name: "News", url: "/news" },
      { name: "Research", short_name: "Research", url: "/academy/research" },
    ],
  };
}
