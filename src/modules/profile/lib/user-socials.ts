import "server-only";
import { prisma } from "@/lib/prisma";

// The migration-20 social columns (discord/youtube/linkedin/instagram) may not
// exist yet on a DB that hasn't been migrated. Fetching them inline in the
// profile/settings queries would throw (Prisma P2022) and, via those pages'
// `.catch(() => null)`, 404/redirect the whole page. So read them in a separate
// guarded query that tolerates the columns' absence - profiles keep working and
// the links simply don't appear until the migration is applied.
export type ExtraSocials = {
  discord: string | null;
  youtube: string | null;
  linkedin: string | null;
  instagram: string | null;
};

const EMPTY: ExtraSocials = { discord: null, youtube: null, linkedin: null, instagram: null };

export async function fetchExtraSocials(where: { id: string } | { username: string }): Promise<ExtraSocials> {
  try {
    const r = await prisma.user.findUnique({
      where: where as { id: string },
      select: { discord: true, youtube: true, linkedin: true, instagram: true },
    });
    if (!r) return EMPTY;
    return { discord: r.discord, youtube: r.youtube, linkedin: r.linkedin, instagram: r.instagram };
  } catch {
    return EMPTY;
  }
}
