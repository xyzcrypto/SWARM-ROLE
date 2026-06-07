import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "./providers";

const SITE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "XYZ Crypto — Built for the Next Generation of Web3",
    template: "%s · XYZ Crypto",
  },
  description:
    "XYZ Crypto is a next-generation Web3 ecosystem — research, trading tools, a perp DEX, airdrop tools, premium intelligence and education. Built for the next generation of Web3.",
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
    title: "XYZ Crypto — Built for the Next Generation of Web3",
    description:
      "A next-generation Web3 ecosystem: research, trading tools, perp DEX, airdrop tools, premium intelligence & education.",
    url: SITE_URL,
    siteName: "XYZ Crypto",
    images: [{ url: "/logo.jpg", width: 640, height: 640, alt: "XYZ Crypto" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "XYZ Crypto — Built for the Next Generation of Web3",
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
