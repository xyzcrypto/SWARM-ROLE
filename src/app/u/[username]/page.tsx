import type { Metadata } from "next";
import type { ComponentType } from "react";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, MapPin, MessageSquare, Heart, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/ui/primitives";
import { Reveal } from "@/components/Reveal";
import { XIcon, GitHubIcon, TelegramIcon } from "@/components/BrandIcons";
import { formatDate, formatDateTime } from "@/lib/utils";
import { normalizeUsername } from "@/lib/profile";

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
  const [postCount, recentComments] = await Promise.all([
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
  ]);

  const isPremium = user.membership === "Premium";
  const isAdmin = user.role === "ADMIN";

  type SocialIcon = ComponentType<{ className?: string }>;
  const socials = [
    user.website && { href: user.website, Icon: Globe as SocialIcon, label: "Website" },
    user.twitter && { href: `https://x.com/${user.twitter}`, Icon: XIcon as SocialIcon, label: `@${user.twitter}` },
    user.github && { href: `https://github.com/${user.github}`, Icon: GitHubIcon as SocialIcon, label: user.github },
    user.telegram && { href: `https://t.me/${user.telegram}`, Icon: TelegramIcon as SocialIcon, label: user.telegram },
  ].filter(Boolean) as { href: string; Icon: SocialIcon; label: string }[];

  const stats = [
    { label: "Posts", value: postCount, Icon: FileText, tone: "gold" as const },
    { label: "Comments", value: user._count.comments, Icon: MessageSquare, tone: "mint" as const },
    { label: "Likes given", value: user._count.likes, Icon: Heart, tone: "violet" as const },
  ];
  const statTone = {
    gold: { icon: "text-gold-400/80", value: "text-gold-gradient" },
    mint: { icon: "text-mint-400/80", value: "text-mint-gradient" },
    violet: { icon: "text-violet-400/80", value: "text-violet-200" },
  };

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
              <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-end gap-4">
                  <Avatar name={user.name} image={user.image} size="xl" className="ring-[3px] ring-ink-900 shadow-gold" />
                  <div className="pb-1">
                    <h1 className="font-display text-2xl font-bold text-zinc-50 sm:text-3xl">
                      {user.name ?? `@${user.username}`}
                    </h1>
                    <p className="mono text-sm text-zinc-500">@{user.username}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isPremium && <Badge tone="gold">★ Premium</Badge>}
                  {isAdmin && <Badge tone="mint">Team</Badge>}
                  <Badge tone="neutral">Member since {formatDate(user.createdAt)}</Badge>
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
                {socials.map(({ href, Icon, label }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-zinc-400 transition-colors hover:border-gold-500/30 hover:text-gold-200"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </a>
                ))}
              </div>
            </div>
          </div>
          </Reveal>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-5">
            {stats.map((s, i) => (
              <Reveal key={s.label} variant="pop" delay={i}>
                <div className="surface surface-hover lift h-full rounded-2xl p-4 text-center sm:p-6">
                  <s.Icon className={`mx-auto h-5 w-5 ${statTone[s.tone].icon}`} />
                  <p className={`mono mt-2 text-2xl font-semibold sm:text-3xl ${statTone[s.tone].value}`}>{s.value}</p>
                  <p className="mt-1 text-xs text-zinc-500">{s.label}</p>
                </div>
              </Reveal>
            ))}
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
                  <li key={c.id} className="surface surface-hover rounded-2xl p-4 transition-colors sm:p-5">
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
