import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 80);
}

const posts = [
  {
    title: "Welcome to XYZ Crypto: Built for the Next Generation of Web3",
    category: "Post",
    excerpt:
      "An introduction to the XYZ Crypto ecosystem — what we're building, why it matters, and how to get involved early.",
    cover:
      "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=1600&auto=format&fit=crop",
    tags: "xyz, web3, intro",
    content: `## A new home for Web3 builders and traders

XYZ Crypto is a unified Web3 ecosystem. We bring **research, trading tools, a perp DEX, airdrop tools, premium intelligence and education** under one trusted brand.

## Why we exist
The space is noisy. New chains, tokens and narratives appear every day. Our mission is simple:

- Cut through the noise with honest research
- Give traders a genuine edge with pro tooling
- Help newcomers learn safely through Web3 Academy

> Built for the Next Generation of Web3.

## What's next
This is **v1**. Expect rapid updates — the Perp DEX, advanced trading tools and premium intel are all on the roadmap. Create an account to be first in line.`,
  },
  {
    title: "Understanding Perp DEXs: The Future of On-Chain Trading",
    category: "Research",
    excerpt:
      "A clear breakdown of how decentralized perpetual exchanges work, why they matter, and what to look for.",
    cover:
      "https://images.unsplash.com/photo-1621761191319-c6fb62004040?q=80&w=1600&auto=format&fit=crop",
    tags: "perp, dex, derivatives, defi",
    content: `## What is a Perp DEX?
A perpetual DEX lets you trade perpetual futures fully on-chain — no centralized custody of your funds.

## Core mechanics
- **Funding rate** keeps the perp price anchored to spot
- **Margin & leverage** let you size positions efficiently
- **Liquidations** protect the protocol from bad debt

## What to evaluate
When judging a perp DEX, look at liquidity depth, fees, oracle quality and risk controls.

The XYZ Crypto Perp DEX is being designed around these principles — performance with safety.`,
  },
  {
    title: "Airdrop Farming 101: A Practical Framework",
    category: "Article",
    excerpt:
      "How to approach airdrops methodically — qualifying, tracking and managing risk without burning out.",
    cover:
      "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?q=80&w=1600&auto=format&fit=crop",
    tags: "airdrop, strategy, defi",
    content: `## Treat airdrops like a portfolio
Not every protocol will reward you. Spread effort across credible projects.

## A simple checklist
- Use a dedicated wallet
- Interact genuinely with the protocol
- Track tasks and snapshots
- Never sign suspicious transactions

## Stay safe
Security first — a single bad signature can undo months of farming. XYZ Crypto's upcoming **Airdrop Tools** will automate tracking and eligibility so you can focus on the opportunities that matter.`,
  },
];

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@xyzcrypto.io").toLowerCase();

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: {
      email: adminEmail,
      name: "XYZ Crypto Admin",
      role: "ADMIN",
      provider: "credentials",
      isMember: true,
      passwordHash: await bcrypt.hash("changeme123", 10),
    },
  });

  for (const p of posts) {
    const slug = slugify(p.title);
    await prisma.post.upsert({
      where: { slug },
      update: {},
      create: { ...p, slug, published: true, authorId: admin.id },
    });
  }

  console.log("Seed complete. Sample posts + admin user ready.");
  console.log(`Admin login (email/password): ${adminEmail} / changeme123`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
