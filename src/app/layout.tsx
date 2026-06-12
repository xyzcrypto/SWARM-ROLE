import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "./providers";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Analytics } from "@/components/Analytics";
import { RealtimeSession } from "@/components/RealtimeSession";
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
    images: [{ url: "/logo.jpg", width: 640, height: 640, alt: "XYZ Crypto" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "XYZ Crypto · The Home Of Next Gen Web3",
    description:
      "A next-generation Web3 ecosystem: research, trading tools, perp DEX, airdrop tools, premium & education.",
    site: "@XYZCryptos",
    images: ["/logo.jpg"],
  },
  icons: { icon: "/logo.jpg", apple: "/logo.jpg" },
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
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        <SmoothScroll />
        <Providers>
          <RealtimeSession
            url={env.NEXT_PUBLIC_SUPABASE_URL}
            anonKey={env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
          />
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
