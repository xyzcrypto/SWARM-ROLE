import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueUsername } from "@/lib/username";

// Self-resolving profile route. Sends the signed-in user to their public
// /u/<handle> profile, minting a handle on the fly if they somehow don't have
// one yet. This guarantees "Profile" is always distinct from "Settings".
export const dynamic = "force-dynamic";

export default async function ProfileRedirect() {
  const session = await getServerSession(authOptions);
  const u = session?.user as any;
  if (!u?.id) redirect("/login");

  let username: string | undefined = u.username ?? undefined;

  if (!username) {
    const dbUser = await prisma.user
      .findUnique({ where: { id: u.id }, select: { username: true, name: true, email: true } })
      .catch(() => null);
    username = dbUser?.username ?? undefined;

    if (!username && dbUser) {
      const handle = await generateUniqueUsername(dbUser.name ?? dbUser.email);
      const saved = await prisma.user
        .update({ where: { id: u.id }, data: { username: handle } })
        .then(() => handle)
        .catch(() => null);
      username = saved ?? undefined;
    }
  }

  // Fall back to settings only if we truly couldn't resolve a handle.
  redirect(username ? `/u/${username}` : "/settings");
}
