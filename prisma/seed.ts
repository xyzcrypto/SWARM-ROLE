import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 80);
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function handleBase(seed: string): string {
  const raw = (seed.split("@")[0] || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  const v = raw.length < 3 ? `user${raw}` : raw;
  return v.slice(0, 16) || "user";
}

// Backfill: give every account without a public handle a unique username so
// /u/<username> works and navbar "Profile" never falls back to Settings.
// Idempotent - only touches rows where username is null.
async function backfillUsernames() {
  const users = await prisma.user.findMany({
    where: { username: null },
    select: { id: true, name: true, email: true },
  });
  for (const u of users) {
    const base = handleBase(u.name || u.email);
    let assigned: string | null = null;
    for (let i = 0; i < 12 && !assigned; i++) {
      let candidate = i === 0 ? base : `${base.slice(0, 14)}_${Math.random().toString(36).slice(2, 7)}`;
      candidate = candidate.slice(0, 20);
      if (!USERNAME_RE.test(candidate)) continue;
      try {
        await prisma.user.update({ where: { id: u.id }, data: { username: candidate } });
        assigned = candidate;
      } catch {
        // unique collision - try the next candidate
      }
    }
  }
  if (users.length) console.log(`Backfilled handles for ${users.length} user(s).`);
}

// Seed the initial "What's New" entries (idempotent: only when the table is empty).
async function seedWhatsNew() {
  const count = await prisma.whatsNewEntry.count().catch(() => -1);
  if (count !== 0) return; // already has entries, or table not migrated yet
  const date = new Date("2026-06-14");
  await prisma.whatsNewEntry.createMany({
    data: [
      { tag: "New", title: "In-app notifications", body: "A bell in the navbar now alerts you to new research and replies, with unread badges on the bell and community chat.", date },
      { tag: "Improved", title: "Faster, smoother navigation", body: "Pages now open instantly with polished transitions and tactile button animations across the site.", date },
      { tag: "New", title: "Clickable member profiles", body: "Tap any name or avatar in the community chat or post comments to view that member's public profile.", date },
      { tag: "Improved", title: "Refined orbital ecosystem", body: "The signature ecosystem showcase has a richer, smoother animation on desktop.", date },
    ],
  });
  console.log("Seeded initial What's New entries.");
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
  // Both are REQUIRED - no defaults. Previously these fell back to a hardcoded
  // address and the password "changeme123", so running the seed without them
  // (e.g. to repair a drifted production schema) provisioned an ADMIN account
  // with publicly-known credentials. Failing loudly is the whole point: a seed
  // that silently creates a known-password admin is worse than one that stops.
  const adminEmailRaw = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmailRaw || !adminPassword) {
    const missing = [!adminEmailRaw && "ADMIN_EMAIL", !adminPassword && "SEED_ADMIN_PASSWORD"]
      .filter(Boolean)
      .join(" and ");
    console.error(
      `[seed] Refusing to run: ${missing} must be set. ` +
        `Set them in your environment and re-run - the seed will not invent an admin account.`
    );
    process.exit(1);
  }
  if (adminPassword.length < 12) {
    console.error("[seed] Refusing to run: SEED_ADMIN_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }
  const adminEmail = adminEmailRaw.toLowerCase();

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: {
      email: adminEmail,
      name: "XYZ Crypto Admin",
      role: "ADMIN",
      provider: "credentials",
      passwordHash: await bcrypt.hash(adminPassword, 10),
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

  await backfillUsernames();
  await seedWhatsNew();

  console.log("Seed complete. Sample posts + admin user ready.");
  console.log(`Admin login: ${adminEmail} (password from SEED_ADMIN_PASSWORD or default)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
