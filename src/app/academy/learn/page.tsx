import type { Metadata } from "next";
import { LearnIndex } from "@modules/academy/components/LearnIndex";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Learn Web3: 14 Topics from Beginner to Expert | XYZ Crypto Academy",
  description: "Blockchain, Bitcoin and Ethereum, smart contracts, DeFi, perp DEXs, trading, wallet security, NFTs, L2s, bridges, DAOs, oracles, zero-knowledge and research. Short lessons with knowledge checks.",
  path: "/academy/learn",
});

export default function LearnPage() {
  return <LearnIndex />;
}
