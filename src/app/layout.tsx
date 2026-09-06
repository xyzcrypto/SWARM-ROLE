import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { SmoothScrollMount } from "@/components/SmoothScrollMount";
import { HashScroll } from "@/components/HashScroll";
import { SameRouteTopScroll } from "@/components/SameRouteTopScroll";
import { RouteScroll } from "@/components/RouteScroll";
import { Analytics } from "@/components/Analytics";
import { RealtimeSession } from "@/components/RealtimeSession";
import { XyzAiWidgetMount } from "@/components/XyzAiWidgetMount";
import { PwaSetup } from "@/components/PwaSetup";
import { PauseOffscreenAnimations } from "@/components/PauseOffscreenAnimations";
import { CommandPaletteMount } from "@/components/CommandPaletteMount";
import { BottomNavMount } from "@/components/BottomNavMount";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/jsonld";
import { SITE_URL, GSC_VERIFICATION } from "@/lib/seo";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  ...(GSC_VERIFICATION ? { verification: { google: GSC_VERIFICATION } } : {}),
  title: {
    default: "XYZ Crypto · The Home Of Next Gen Web3",
    template: "%s · XYZ Crypto",
  },
  description:
    "XYZ Crypto is a next-generation Web3 ecosystem, research, trading tools, a perp DEX, airdrop tools, premium intelligence and education. Built for the next generation of Web3.",
  keywords: [
    "XYZ Crypto",
    "Web3",
    "crypto research",
    "perp dex",
    "trading tools",
    "airdrop",
    "DeFi",
    "blockchain",
    "TradeKaroVerse",
    "Web3 academy",
  ],
  authors: [{ name: "XYZ Crypto" }],
  openGraph: {
    title: "XYZ Crypto · The Home Of Next Gen Web3",
    description:
      "A next-generation Web3 ecosystem: research, trading tools, perp DEX, airdrop tools, premium intelligence & education.",
    url: SITE_URL,
    siteName: "XYZ Crypto",
    // No `images` here on purpose. Next's file convention picks up
    // `app/opengraph-image.tsx` (1200x630) for every route that has no card of
    // its own, and research posts keep their per-article one. Setting an
    // explicit image here would override both - which is how a 640x640 square
    // ended up in a `summary_large_image` slot and got centre-cropped on every
    // share.
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "XYZ Crypto · The Home Of Next Gen Web3",
    description:
      "A next-generation Web3 ecosystem: research, trading tools, perp DEX, airdrop tools, premium & education.",
    site: "@XYZCryptos",
    // Same reason as openGraph above - the generated card is the right ratio.
  },
  // `icon` is the browser tab favicon - same artwork as the site logo, at
  // favicon sizes.
  //
  // ⚠️ This line used to read `icon: "/logo.png"`, and that made it the single
  // heaviest request on the site: **338 KB fetched on every page load**, by
  // every browser, to paint a 16x16 tab icon. It was easy to miss in a network
  // panel because a favicon has no JS initiator - it shows up as "other" with
  // no stack, which reads like a service-worker fetch. (The service worker was
  // separately precaching the same file; that is fixed in public/sw.js.)
  //
  // Two sizes so the browser can pick: 32px for the tab (2 KB), 192px for the
  // places that want a crisp larger one - a pinned tab, a bookmark tile, a
  // high-DPI tab strip (20 KB). Together they are 6% of what one of them cost
  // before. The rule this is an instance of: `/logo.png` is a 512x512 RGBA
  // master and belongs behind next/image, never in a raw href.
  //
  // `apple` is the iOS home screen icon - the thing you tap to open the
  // installed app - so it gets the new coin, matching the Android icons in
  // manifest.ts. It is opaque because iOS renders transparency as black and
  // applies its own rounded-rect mask.
  icons: {
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/logo-app-apple.png",
  },
  applicationName: "XYZ Crypto",
  appleWebApp: {
    capable: true,
    title: "XYZ Crypto",
    statusBarStyle: "black-translucent",
  },
};

// Headline display face - a warm, high-contrast serif with real character,
// scoped to ONLY the hero's main headline (not the shared `font-display`
// class, which stays Geist Sans everywhere else) via its own CSS variable.
// Loaded via localFont to eliminate build/dev timeouts from Google Fonts CDN (docs/HANDOFF.md §7 #2).
const fraunces = localFont({
  src: "./fonts/fraunces-latin.woff2",
  variable: "--font-fraunces",
  display: "swap",
  weight: "500 700",
});

export const viewport: Viewport = {
  themeColor: "#05060a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${fraunces.variable} dark`}>
      <head>
        {/* Warm up connections to the third-party image CDNs used on the Markets
            and News pages (coin logos + source favicons) so those images paint
            sooner. Cheap DNS/TLS pre-work; the APIs themselves are server-side. */}
        <link rel="preconnect" href="https://assets.coingecko.com" crossOrigin="" />
        <link rel="preconnect" href="https://coin-images.coingecko.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://assets.coingecko.com" />
        <link rel="dns-prefetch" href="https://coin-images.coingecko.com" />
        <link rel="dns-prefetch" href="https://www.google.com" />
      </head>
      <body>
        {/* No-FOUC theme AND motion tier: both are decided before paint, in one
            script, for the same reason - a class on <html> that CSS reads is not
            a render input, so it can never disagree with what the server sent
            (the React #418 class of bug documented in CLAUDE.md).

            ## Why a motion tier exists

            Measured on this homepage at 390x844 with 6x CPU throttling (a
            mid-range Android, roughly): 54 CSS animations running on screen at
            once and 18-21 fps. Turning every animation off took the same page
            to 44 fps, while removing backdrop-filter, filter and box-shadow
            each changed nothing - so animation is the whole bottleneck here,
            and it is the COUNT that costs, not any one heavy effect (no single
            group was worth more than ~3 fps on its own).

            `prefers-reduced-motion` is deliberately NOT the lever. This project
            exempts its brand motion from that preference on purpose (see the
            reduced-motion note further down globals.css and the design-system
            skill), after repeated reports of the site reading as "static"
            because the preference was on in a test environment. Capability is a
            different axis: a fast phone keeps the full identity, a weak one
            gets a page that actually holds a frame rate.

            `deviceMemory` is Chromium-only and undefined on iOS Safari, which
            is the correct outcome rather than a gap - iPhones are not the
            devices dropping frames here, and `hardwareConcurrency` alone would
            wrongly demote them (an iPhone reports 4-6 cores). `saveData` is an
            explicit request from the reader, so it is honoured directly.
            `localStorage.motion` ('lite' / 'full') forces either tier for
            testing on a device you actually hold. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var d=document.documentElement;try{var t=localStorage.getItem('theme');if(t==='light'){d.classList.remove('dark');}else{d.classList.add('dark');}}catch(e){}try{var m=localStorage.getItem('motion');var n=navigator,c=n.connection||{},mem=n.deviceMemory,lite;if(m==='lite'){lite=true;}else if(m==='full'){lite=false;}else{lite=c.saveData===true||(typeof mem==='number'&&mem<=4)||(n.hardwareConcurrency||8)<=2;}if(lite){d.classList.add('lite-motion');}}catch(e){}})();",
          }}
        />
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        <SmoothScrollMount />
        <HashScroll />
        <SameRouteTopScroll />
        {/* Where the page sits after a navigation: the top on a forward
            click, the saved offset on back/forward. Pairs with
            SameRouteTopScroll above, which covers clicking a link to the page
            you are already on - no navigation, so this never fires for it. */}
        <RouteScroll />
        <Providers>
          <RealtimeSession
            url={env.NEXT_PUBLIC_SUPABASE_URL}
            anonKey={env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
          />
          {children}
          <XyzAiWidgetMount />
          <PwaSetup />
          <PauseOffscreenAnimations />
          <CommandPaletteMount />
          <BottomNavMount />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
