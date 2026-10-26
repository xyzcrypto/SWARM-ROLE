import type { PostCardData } from "@/modules/community/components/PostCard";

export const DEMO_RESEARCH_POSTS: PostCardData[] = [
  {
    id: "demo-post-1",
    slug: "monad-megaeth-parallel-evm-tps-deep-dive",
    title: "The Architecture of Monad & MegaETH: Can Parallel EVM Break the 10,000 TPS Frontier?",
    excerpt:
      "A technical teardown of state access bottlenecks, parallel execution pipelining, and optimistic concurrency models reshaping Ethereum scaling in 2026.",
    cover: "/images/research/featured-monad.jpg",
    category: "Research",
    tags: "Featured, Layer 2, Monad, Infrastructure",
    content: "",
    readMinutes: 9,
    premium: true,
    views: 2840,
    createdAt: new Date("2026-10-05T14:30:00Z").toISOString(),
    author: {
      name: "Alex Rivera",
      image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    },
  },
  {
    id: "demo-post-2",
    slug: "the-next-phase-of-ethereum-scaling",
    title: "The Next Phase of Ethereum Scaling",
    excerpt:
      "Comparing Rollups, Validiums and AppChains in 2026.",
    cover: "/images/research/featured-ethereum.jpg",
    category: "Research",
    tags: "Layer 2, Ethereum, Rollups, Scaling",
    content: "",
    readMinutes: 7,
    premium: false,
    views: 1920,
    createdAt: new Date("2026-10-02T10:00:00Z").toISOString(),
    author: {
      name: "Priya Shah",
      image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80",
    },
  },
  {
    id: "demo-post-3",
    slug: "solana-tokenomics-deep-dive",
    title: "Solana Tokenomics Deep Dive",
    excerpt:
      "Supply dynamics, inflation, real yield and the path to long-term sustainability.",
    cover: "/images/research/featured-solana.jpg",
    category: "Research",
    tags: "Tokenomics, Solana, DeFi, Staking",
    content: "",
    readMinutes: 8,
    premium: false,
    views: 3410,
    createdAt: new Date("2026-09-28T09:00:00Z").toISOString(),
    author: {
      name: "Daniel Kim",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    },
  },
  {
    id: "demo-post-4",
    slug: "ai-agents-autonomous-trading-swarms-intent-defi",
    title: "AI Agents on Base: Autonomous Trading Swarms, ERC-4337, and Intent-Centric DeFi",
    excerpt:
      "How autonomous LLM agents execute cross-chain arbitrage and yield rebalancing via account abstraction paymasters without human intervention.",
    cover:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1600&auto=format&fit=crop",
    category: "Article",
    tags: "AI Agents, DeFi, Base, Airdrops",
    content: "",
    readMinutes: 6,
    premium: true,
    views: 4120,
    createdAt: new Date("2026-10-02T11:20:00Z").toISOString(),
    author: { name: "XYZ AI Research" },
  },
  {
    id: "demo-post-5",
    slug: "perp-dex-liquidity-wars-hyperliquid-dydx-drift",
    title: "Perp DEX Liquidity Wars: Comparing Hyperliquid, dYdX v4, and Drift v2 Across $10M Slips",
    excerpt:
      "Comprehensive benchmark comparing fee tiers, slippage metrics on 7-figure orders, and proof-of-liquidity vaults across dominant derivatives platforms.",
    cover:
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=1600&auto=format&fit=crop",
    category: "Research",
    tags: "Perp DEX, DeFi, Derivatives",
    content: "",
    readMinutes: 10,
    premium: false,
    views: 5200,
    createdAt: new Date("2026-10-01T08:00:00Z").toISOString(),
    author: { name: "Marcus Thorne (Derivatives Lead)" },
  },
  {
    id: "demo-post-6",
    slug: "airdrop-hunter-matrix-points-sybil-filters",
    title: "Airdrop Hunter Matrix Q4: Season 2 Point Systems, Sybil Filters & Capital Allocation",
    excerpt:
      "Tactical handbook detailing tier-1 testnets, cluster activity scores, and multi-sig volume requirements to avoid sybil blacklists.",
    cover:
      "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?q=80&w=1600&auto=format&fit=crop",
    category: "Article",
    tags: "Airdrops, Strategy, DeFi",
    content: "",
    readMinutes: 5,
    premium: false,
    views: 6730,
    createdAt: new Date("2026-09-30T17:10:00Z").toISOString(),
    author: { name: "Airdrop Alpha Desk" },
  },
  {
    id: "demo-post-7",
    slug: "zk-rollups-vs-optimistic-cost-curves-proofs",
    title: "Zero-Knowledge Rollups vs Optimistic Provers: 2026 Cost Curves & Proof Generation",
    excerpt:
      "Hardware acceleration via FPGA clusters is closing the prover cost gap, enabling 10-second finality on modern ZK-EVMs.",
    cover:
      "https://images.unsplash.com/photo-1639762681057-408e52192e55?q=80&w=1600&auto=format&fit=crop",
    category: "Research",
    tags: "Layer 2, Restaking, Infrastructure",
    content: "",
    readMinutes: 8,
    premium: true,
    views: 2190,
    createdAt: new Date("2026-09-28T13:00:00Z").toISOString(),
    author: { name: "Dr. Ethan Wright" },
  },
  {
    id: "demo-post-8",
    slug: "bitcoin-halving-cycles-etf-institutional-flows",
    title: "The Macro Outlook: Bitcoin Halving Cycles, ETF Institutional Flows, and Global Liquidity",
    excerpt:
      "Correlating global M2 money supply expansions with spot ETF inflows to model Bitcoin price distribution scenarios through late 2026.",
    cover:
      "https://images.unsplash.com/photo-1516245834210-c4c142787335?q=80&w=1600&auto=format&fit=crop",
    category: "Post",
    tags: "DeFi, Layer 2, Bitcoin",
    content: "",
    readMinutes: 4,
    premium: false,
    views: 8940,
    createdAt: new Date("2026-09-26T10:30:00Z").toISOString(),
    author: { name: "XYZ Macro Desk" },
  },
  {
    id: "demo-post-9",
    slug: "tokenomics-teardown-low-float-high-fdv-collapse",
    title: "Tokenomics Teardown: Why 80% of Low-Float High-FDV Tokens Collapsed (and the Fix)",
    excerpt:
      "An empirical autopsy of venture unlock schedules, cliff dumps, and how dynamic emission curves are replacing predatory token models.",
    cover:
      "https://images.unsplash.com/photo-1642790106117-e829e14a795f?q=80&w=1600&auto=format&fit=crop",
    category: "Research",
    tags: "DeFi, Tokenomics, Solana",
    content: "",
    readMinutes: 9,
    premium: false,
    views: 4610,
    createdAt: new Date("2026-09-24T12:00:00Z").toISOString(),
    author: { name: "Kavita Patel (Tokenomics Lead)" },
  },
  {
    id: "demo-post-10",
    slug: "depin-compute-networks-gpu-arbitrage-economics",
    title: "DePIN Infrastructure: Decentralized Compute Networks & GPU Arbitrage Economics",
    excerpt:
      "How render networks and decentralized training clusters are undercutting AWS pricing by 65% while generating verified on-chain yields.",
    cover:
      "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1600&auto=format&fit=crop",
    category: "Article",
    tags: "AI Agents, Infrastructure, Solana",
    content: "",
    readMinutes: 6,
    premium: false,
    views: 3120,
    createdAt: new Date("2026-09-22T15:40:00Z").toISOString(),
    author: { name: "Alex Rivera (Chief Quant)" },
  },
  {
    id: "demo-post-11",
    slug: "cross-chain-security-state-proof-bridges",
    title: "Cross-Chain Security Post-Mortem: Interoperability Protocols & State Proof Bridges",
    excerpt:
      "Evaluating consensus-level verification, optimistic challenge windows, and multi-sig federation failure modes across modern cross-chain rails.",
    cover:
      "https://images.unsplash.com/photo-1634704784915-aacf363b021f?q=80&w=1600&auto=format&fit=crop",
    category: "Research",
    tags: "Layer 2, Restaking, Infrastructure",
    content: "",
    readMinutes: 12,
    premium: true,
    views: 1840,
    createdAt: new Date("2026-09-20T09:00:00Z").toISOString(),
    author: { name: "Security Sentinel" },
  },
  {
    id: "demo-post-12",
    slug: "mastering-mev-protection-private-mempools-bundles",
    title: "Mastering MEV Protection: Private Mempools, Bundles, and Sandwich Avoidance for Retail",
    excerpt:
      "Practical steps to configure RPC endpoints, leverage Flashbots Protect, and prevent front-running loss on decentralized AMM trades.",
    cover:
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1600&auto=format&fit=crop",
    category: "Post",
    tags: "DeFi, Perp DEX, Solana",
    content: "",
    readMinutes: 4,
    premium: false,
    views: 5890,
    createdAt: new Date("2026-09-18T18:20:00Z").toISOString(),
    author: { name: "Sarah Chen (DeFi Lead)" },
  },
  {
    id: "demo-post-13",
    slug: "crypto-trading-basic-terms-explained-in-simple-words-part-1",
    title: "CRYPTO TRADING BASIC TERMS EXPLAINED IN SIMPLE WORDS PART 1",
    excerpt:
      "A simplified handbook breaking down on-chain perpetual trading, orderbooks, slippage mechanics, and top DEX platforms.",
    cover:
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=1600&auto=format&fit=crop",
    category: "Post",
    tags: "Perp DEX, Trading, Airdrops, DeFi",
    content: `You can get a better on-chain trading experience while also gaining exposure to potential airdrop opportunities 👀

Here are my Top 3 Perp DEX picks, ranked based on trading experience + airdrop potential:

🥇 Lighter
• Zero trading fees
• Best-in-class execution
• Smooth trading experience
📈 Start Trading Now
https://robinhoodchain.lighter.xyz/?referral=XYZCRYPTO

🥈 Txflow
• Built on an L1
• Best-in-class liquidity
• Clean UI & UX
• Strong ecosystem potential
🔥 Start Trading Now
https://app.txflow.com/r/TXANEQUE

🥉 Variational
• Leading Perp DEX for RWA exposure
• Institutional-grade matching engine
• Low slippage on blue chips
⚡ Start Trading Now
https://app.variational.io`,
    readMinutes: 7,
    premium: false,
    views: 100,
    createdAt: new Date("2026-07-23T12:00:00Z").toISOString(),
    author: { name: "XYZCrypto" },
  },
];
