/**
 * Standalone, idempotent readMinutes backfill — computes and sets readMinutes
 * for every existing Post row in the database based on readingTime(content).
 *
 * Run once in production/staging to ensure legacy posts show accurate reading time:
 *   npx tsx scripts/backfill-read-minutes.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function readingTime(text: string): number {
  const words = (text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

async function main() {
  console.log("[backfill:read-minutes] Querying posts with readMinutes <= 0...");

  const posts = await prisma.post.findMany({
    where: {
      OR: [
        { readMinutes: 0 },
        { readMinutes: null as unknown as number },
      ],
    },
    select: {
      id: true,
      title: true,
      content: true,
      readMinutes: true,
    },
  });

  if (!posts.length) {
    console.log("[backfill:read-minutes] All posts already have calculated readMinutes. Nothing to do.");
    return;
  }

  console.log(`[backfill:read-minutes] Found ${posts.length} post(s) needing readMinutes calculation.`);
  let updatedCount = 0;

  for (const post of posts) {
    const minutes = readingTime(post.content || "");
    await prisma.post.update({
      where: { id: post.id },
      data: { readMinutes: minutes },
    });
    updatedCount++;
    console.log(`[backfill:read-minutes] (${updatedCount}/${posts.length}) Updated "${post.title.slice(0, 40)}" -> ${minutes}m`);
  }

  console.log(`[backfill:read-minutes] Done! Successfully backfilled ${updatedCount} post(s).`);
}

main()
  .catch((err) => {
    console.error("[backfill:read-minutes] Error during backfill:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
