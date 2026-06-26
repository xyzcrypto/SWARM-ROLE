/**
 * Standalone, idempotent username backfill — gives every account without a
 * public handle a unique `@username` so /u/<handle> works and profiles show
 * full details. Safe to run any time in production (only touches rows where
 * username is null); does NOT seed posts/admin like `npm run seed`.
 *
 *   npm run backfill:usernames
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function handleBase(seed: string): string {
  const raw = (seed.split("@")[0] || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  const v = raw.length < 3 ? `user${raw}` : raw;
  return v.slice(0, 16) || "user";
}

async function main() {
  const users = await prisma.user.findMany({
    where: { username: null },
    select: { id: true, name: true, email: true },
  });
  if (!users.length) {
    console.log("All accounts already have a handle — nothing to backfill.");
    return;
  }
  let done = 0;
  for (const u of users) {
    const base = handleBase(u.name || u.email);
    for (let i = 0; i < 14; i++) {
      let candidate = i === 0 ? base : `${base.slice(0, 14)}_${Math.random().toString(36).slice(2, 7)}`;
      candidate = candidate.slice(0, 20);
      if (!USERNAME_RE.test(candidate)) continue;
      try {
        await prisma.user.update({ where: { id: u.id }, data: { username: candidate } });
        done++;
        break;
      } catch {
        // unique collision — try the next candidate
      }
    }
  }
  console.log(`Backfilled handles for ${done}/${users.length} account(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
