import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { NavProgress } from "@shared/components/NavProgress";
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
import { CustomizeSheetMount } from "@shared/components/CustomizeSheetMount";
import { GlobalPressFeedback } from "@shared/components/GlobalPressFeedback";
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
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal"],
  variable: "--font-fraunces",
  display: "swap",
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
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${GeistSans.variable} ${GeistMono.variable} ${fraunces.variable} dark`}>
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

            `saveData` is an explicit request from the reader, so it is honoured
            directly. `localStorage.motion` ('lite' / 'full') forces either tier,
            and is what the Motion control in the navbar writes. 'full' also adds
            `html.motion-full`, which overrides the reduced-motion media blocks
            in globals.css and makes `useReducedMotionSafe()` report false - one
            switch that turns everything on, whatever the device or the OS says.

            ⚠️ THE TIER IS DECIDED BY DEVICE CLASS, NOT BY `deviceMemory`, and
            that is what this paragraph is for. The clause used to read
            `coarse && typeof mem === 'number' && mem <= 4`, and `deviceMemory`
            is the wrong input twice over:

              - It does not exist on iOS Safari or Firefox, so those browsers
                fell through to the FULL tier - the expensive one.
              - Chrome quantises it to a power of two capped at 8, so a 6 GB
                phone reports **4** and a 4 GB phone reports **4**. There is no
                way to tell them apart, and 8 GB+ phones report 8 and escaped.

            Measured on the homepage at 393x844 (production build, this build):

                Android reporting 4 GB ....... lite ... 17 anims ... 55.5 fps @4x
                iPhone (no deviceMemory) ..... FULL ... 55 anims ... 31.4 fps @4x
                Android reporting 8 GB ....... FULL ... 55 anims ... 31.0 fps @4x

            So the phones the heuristic could not identify were the ones being
            handed the janky page, and two phones of the same class disagreed
            purely on which browser was open. That is the whole of "kuch device
            me animation hai kuch me nahi", and it cut both ways: some readers
            saw a static site, others saw a stuttering one.

            A phone is a phone whatever it reports. `(pointer: coarse)` plus a
            short min-dimension identifies one on every browser, does not change
            on rotation (`Math.min` of the screen's two sides), and leaves
            tablets and desktops - where the frame-rate problem was never
            measured - on the full tier. A genuinely weak machine of any shape is
            still caught by the `<= 2` cores clause.

            ## Customize website (site-prefs.ts)

            The same script applies the reader's own choices from the
            Customize panel before paint, so none of them flashes in:
            `motion: 'off'` (lite tier + `motion-off`), and from `xyz.ui` the
            text size (`text-scale-*`), background effects (`no-effects`) and
            glass blur (`no-blur`). `applySitePrefs` mirrors this exactly for
            live changes. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var d=document.documentElement;try{var t=localStorage.getItem('theme');if(t==='light'){d.classList.remove('dark');}else{d.classList.add('dark');}}catch(e){}try{var m=localStorage.getItem('motion');var n=navigator,c=n.connection||{},coarse=false;try{coarse=matchMedia('(pointer: coarse)').matches;}catch(e){}var s=window.screen||{},w=s.width||window.innerWidth||0,h=s.height||window.innerHeight||0,phone=coarse&&Math.min(w,h)>0&&Math.min(w,h)<600;var lite;if(m==='lite'||m==='off'){lite=true;}else if(m==='full'){lite=false;}else{lite=c.saveData===true||(n.hardwareConcurrency||8)<=2||phone;}if(lite){d.classList.add('lite-motion');}if(m==='full'){d.classList.add('motion-full');}if(m==='off'){d.classList.add('motion-off');}}catch(e){}try{var u=JSON.parse(localStorage.getItem('xyz.ui')||'{}');if(u.scale===90||u.scale===110||u.scale===125){d.classList.add('text-scale-'+u.scale);}if(u.effects===false){d.classList.add('no-effects');}if(u.blur===false){d.classList.add('no-blur');}}catch(e){}})();",
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
        <NavProgress />
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
          <CustomizeSheetMount />
          <GlobalPressFeedback />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
