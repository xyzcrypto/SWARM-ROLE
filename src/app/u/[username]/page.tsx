import type { Metadata } from "next";
import type { ComponentType } from "react";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, MapPin, MessageSquare } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/ui/primitives";
import { Reveal } from "@/components/Reveal";
import { XIcon, GitHubIcon, TelegramIcon, DiscordIcon, YouTubeIcon, LinkedInIcon, InstagramIcon } from "@/components/BrandIcons";
import { MessageButton } from "@/components/MessageButton";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { ProfileStats } from "@/components/ProfileStats";
import { ProfileFollow } from "@/components/ProfileFollow";
import { EditProfileButton } from "@/components/EditProfileButton";
import { formatDate, formatDateTime } from "@/lib/utils";
import { normalizeUsername } from "@/lib/profile";
import { fetchExtraSocials } from "@/lib/user-socials";

// ISR: profiles render on demand (never at build) and cache for 60s; profile
// edits call revalidatePath so changes show immediately.
export const revalidate = 60;

type Props = { params: { username: string } };

// Look the user up by their canonical (lowercased) handle. Wrapped in
// React cache() so generateMetadata + the page share one DB query per request.
const getProfile = cache(async (usernameParam: string) => {
  const username = normalizeUsername(decodeURIComponent(usernameParam));
  if (!username) return null;
  return prisma.user
    .findUnique({
      where: { username },
      select: {
        id: true, name: true, username: true, image: true, bannerImage: true,
        bio: true, location: true, website: true, twitter: true, github: true,
        telegram: true, role: true, membership: true, createdAt: true,
        _count: { select: { comments: true, likes: true } },
      },
    })
    .catch(() => null);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await getProfile(params.username);
  if (!user) return { title: "Profile not found" };
  const title = user.name ? `${user.name} (@${user.username})` : `@${user.username}`;
  return {
    title,
    description: user.bio ?? `${title} on XYZ Crypto.`,
    alternates: { canonical: `/u/${user.username}` },
    openGraph: { title, description: user.bio ?? undefined, images: user.image ? [user.image] : undefined },
  };
}

export default async function ProfilePage({ params }: Props) {
  const user = await getProfile(params.username);
  if (!user) notFound();

  // Published posts authored by this user (most are non-authors → usually 0).
  // `extra` reads the migration-20 social columns through a guarded query so an
  // un-migrated DB doesn't break the page (returns nulls until applied).
  const [postCount, recentComments, extra, followersCount, followingCount] = await Promise.all([
    prisma.post.count({ where: { authorId: user.id, published: true } }).catch(() => 0),
    prisma.comment
      .findMany({
        where: { userId: user.id, status: "visible" },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true, body: true, createdAt: true,
          post: { select: { title: true, slug: true, published: true } },
        },
      })
      .catch(() => []),
    fetchExtraSocials({ id: user.id }),
    // Follow counts - guarded so an un-migrated DB (no Follow table) shows 0.
    prisma.follow.count({ where: { followingId: user.id } }).catch(() => 0),
    prisma.follow.count({ where: { followerId: user.id } }).catch(() => 0),
  ]);

  const isPremium = user.membership === "Premium";
  const isAdmin = user.role === "ADMIN";

  type SocialIcon = ComponentType<{ className?: string }>;
  const socials = [
    user.website && { href: user.website, Icon: Globe as SocialIcon, label: "Website", hover: "hover:border-gold-500/40 hover:text-gold-200" },
    user.twitter && { href: `https://x.com/${user.twitter}`, Icon: XIcon as SocialIcon, label: `@${user.twitter}`, hover: "hover:border-white/30 hover:text-zinc-100" },
    user.telegram && { href: `https://t.me/${user.telegram}`, Icon: TelegramIcon as SocialIcon, label: user.telegram, hover: "hover:border-sky-500/40 hover:text-sky-300" },
    extra.discord && { href: `https://discord.gg/${extra.discord}`, Icon: DiscordIcon as SocialIcon, label: "Discord", hover: "hover:border-indigo-500/40 hover:text-indigo-300" },
    extra.youtube && { href: `https://youtube.com/@${extra.youtube}`, Icon: YouTubeIcon as SocialIcon, label: "YouTube", hover: "hover:border-red-500/40 hover:text-red-300" },
    extra.instagram && { href: `https://instagram.com/${extra.instagram}`, Icon: InstagramIcon as SocialIcon, label: `@${extra.instagram}`, hover: "hover:border-pink-500/40 hover:text-pink-300" },
    extra.linkedin && { href: `https://linkedin.com/in/${extra.linkedin}`, Icon: LinkedInIcon as SocialIcon, label: "LinkedIn", hover: "hover:border-blue-500/40 hover:text-blue-300" },
    user.github && { href: `https://github.com/${user.github}`, Icon: GitHubIcon as SocialIcon, label: user.github, hover: "hover:border-white/30 hover:text-zinc-100" },
  ].filter(Boolean) as { href: string; Icon: SocialIcon; label: string; hover: string }[];

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="mesh" />
        <div className="relative mx-auto max-w-4xl px-4 pb-24 sm:px-6 lg:px-8">
          {/* Hero card */}
          <Reveal variant="blur">
          <div className="glass overflow-hidden rounded-3xl">
            <div className="relative h-32 w-full sm:h-40">
              <div
                className="absolute inset-0 bg-gold-shine"
                style={
                  user.bannerImage
                    ? { backgroundImage: `url(${user.bannerImage})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : undefined
                }
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900/60 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
            </div>
            <div className="px-5 pb-6 sm:px-8 sm:pb-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                {/* Only the avatar overlaps the banner; the name/handle stay in the
                    content area below it so the name is never hidden over the banner art. */}
                <div className="flex min-w-0 items-start gap-4 sm:gap-5">
                  <Avatar name={user.name} image={user.image} size="xl" className="-mt-14 shrink-0 ring-[3px] ring-ink-900 shadow-gold sm:-mt-16" />
                  <div className="min-w-0 pt-1">
                    <h1 className="font-display text-[26px] font-bold leading-[1.1] tracking-tight text-zinc-50 break-words sm:text-4xl lg:text-[2.6rem]">
                      {user.name ?? `@${user.username}`}
                    </h1>
                    <p className="mono mt-1 truncate text-sm text-zinc-500 sm:text-[15px]">@{user.username}</p>
                    <ProfileFollow
                      username={user.username!}
                      profileId={user.id}
                      initialFollowers={followersCount}
                      initialFollowing={followingCount}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isPremium && <Badge tone="gold">★ Premium</Badge>}
                  {isAdmin && <Badge tone="mint">Team</Badge>}
                  <Badge tone="neutral">Member since {formatDate(user.createdAt)}</Badge>
                  <EditProfileButton username={user.username!} />
                  <MessageButton username={user.username!} />
                  <CopyLinkButton compact />
                </div>
              </div>

              {user.bio && (
                <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-zinc-300">{user.bio}</p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
                {user.location && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-zinc-400">
                    <MapPin className="h-4 w-4 text-zinc-500" />
                    {user.location}
                  </span>
                )}
                {/* Icon-only social logos - tap the logo to open. Compact so they
                    take little space; the full handle is the tooltip/aria-label. */}
                {socials.map(({ href, Icon, label, hover }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    title={label}
                    aria-label={label}
                    className={`group grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-400 transition-all duration-300 hover:-translate-y-0.5 ${hover}`}
                  >
                    <Icon className="h-[18px] w-[18px] transition-transform duration-300 group-hover:scale-110" />
                  </a>
                ))}
              </div>
            </div>
          </div>
          </Reveal>

          {/* Stats */}
          <div className="mt-6">
            <ProfileStats posts={postCount} comments={user._count.comments} likes={user._count.likes} />
          </div>

          {/* Recent activity */}
          <Reveal variant="up" className="mt-8 block">
            <h2 className="font-display text-lg font-semibold text-zinc-100">Recent activity</h2>
            {recentComments.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-line bg-white/[0.02] px-5 py-10 text-center">
                <MessageSquare className="mx-auto h-6 w-6 text-zinc-600" />
                <p className="mt-3 text-sm text-zinc-400">No public activity yet.</p>
                <p className="mt-1 text-xs text-zinc-600">Comments on research will show up here.</p>
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {recentComments.map((c) => (
                  <li key={c.id} className="surface surface-hover lift group relative overflow-hidden rounded-2xl p-4 transition-colors sm:p-5">
                    <span className="absolute inset-y-0 left-0 w-0.5 bg-gold-400/0 transition-colors duration-300 group-hover:bg-gold-400/60" />
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Commented{c.post?.title ? " on" : ""}</span>
                      {c.post?.published && c.post.slug ? (
                        <Link href={`/research/${c.post.slug}`} className="font-medium text-gold-200 hover:underline">
                          {c.post.title}
                        </Link>
                      ) : (
                        c.post?.title && <span className="text-zinc-400">{c.post.title}</span>
                      )}
                      <span className="ml-auto">{formatDateTime(c.createdAt)}</span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-zinc-300">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        </div>
      </main>
      <Footer />
    </>
  );
}
