import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "./providers";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Analytics } from "@/components/Analytics";
import { RealtimeSession } from "@/components/RealtimeSession";
import { XyzAiWidget } from "@/components/XyzAiWidget";
import { PwaSetup } from "@/components/PwaSetup";
import { CommandPaletteMount } from "@/components/CommandPaletteMount";
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
    images: [{ url: "/logo.png", width: 640, height: 640, alt: "XYZ Crypto" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "XYZ Crypto · The Home Of Next Gen Web3",
    description:
      "A next-generation Web3 ecosystem: research, trading tools, perp DEX, airdrop tools, premium & education.",
    site: "@XYZCryptos",
    images: ["/logo.png"],
  },
  icons: { icon: "/logo.png", apple: "/logo.png" },
  applicationName: "XYZ Crypto",
  appleWebApp: {
    capable: true,
    title: "XYZ Crypto",
    statusBarStyle: "black-translucent",
  },
};

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
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
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
        {/* No-FOUC theme: apply the saved choice before paint. Dark is the default. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark');}else{document.documentElement.classList.add('dark');}}catch(e){}})();",
          }}
        />
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        <SmoothScroll />
        <Providers>
          <RealtimeSession
            url={env.NEXT_PUBLIC_SUPABASE_URL}
            anonKey={env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
          />
          {children}
          <XyzAiWidget />
          <PwaSetup />
          <CommandPaletteMount />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
