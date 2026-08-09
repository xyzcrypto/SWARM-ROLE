import type { Metadata } from "next";
import type { ComponentType } from "react";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, MapPin, MessageSquare } from "lucide-react";
import { JsonLd, personJsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/ui/primitives";
import { PremiumBadge } from "@/components/PremiumBadge";
import { Reveal } from "@/components/Reveal";
import { XIcon, GitHubIcon, TelegramIcon, DiscordIcon, YouTubeIcon, LinkedInIcon, InstagramIcon } from "@/components/BrandIcons";
import { MessageButton } from "@/components/MessageButton";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { ProfileStats } from "@/components/ProfileStats";
import { ProfileFollow } from "@/components/ProfileFollow";
import { JournalActivityFeed } from "@/components/JournalActivityFeed";
import { EditProfileButton } from "@/components/EditProfileButton";
import { ProfileBannerImage } from "@/components/ProfileBannerImage";
import { ImageLightbox } from "@/components/ImageLightbox";
import { cn, formatDate, formatDateTime, publicImageUrl } from "@/lib/utils";
import { schemaOrThrow } from "@/lib/db-error";
import { normalizeUsername } from "@/lib/profile";
import { safeHref } from "@/lib/links";
import { fetchExtraSocials } from "@/lib/user-socials";

// ISR: profiles render on demand (never at build) and cache for 60s; profile
// edits call revalidatePath so changes show immediately.
export const revalidate = 300;

type Props = { params: Promise<{ username: string }> };

// Look the user up by their canonical (lowercased) handle. Wrapped in
// React cache() so generateMetadata + the page share one DB query per request.
const getProfile = cache(async (usernameParam: string) => {
  const username = normalizeUsername(decodeURIComponent(usernameParam));
  if (!username) return null;
  const user = await prisma.user
    .findUnique({
      where: { username },
      select: {
        id: true, name: true, username: true, image: true, bannerImage: true,
        bio: true, location: true, website: true, twitter: true, github: true,
        telegram: true, role: true, membership: true, createdAt: true,
        _count: { select: { comments: true, likes: true } },
      },
    })
    // NOT `.catch(() => null)`. That fed `notFound()` from ANY failure, so an
    // unreachable database rendered as "Page not found" on a profile that
    // exists - a confident, plausible, wrong answer, and one a user cannot
    // tell from the real thing. A missing table still degrades to null (the
    // deliberate pre-migration path); anything else now surfaces as an error,
    // which is honest and clears itself the moment the database answers.
    .catch(schemaOrThrow);
  // Route an inline data: URL image through /api/media instead of embedding it
  // (see publicImageUrl). This page is ISR-cached (300s) and public, so a raw
  // base64 blob here would be re-shipped to every viewer on every cache fill -
  // but the previous fix for that dropped it to `null`, which is why an
  // uploaded profile photo never appeared on the profile at all.
  return user
    ? {
        ...user,
        image: publicImageUrl(user.image, user.id, "avatar"),
        bannerImage: publicImageUrl(user.bannerImage, user.id, "banner"),
      }
    : null;
});

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
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

export default async function ProfilePage(props: Props) {
  const params = await props.params;
  const user = await getProfile(params.username);
  if (!user) notFound();

  // Published posts authored by this user (most are non-authors → usually 0).
  // `extra` reads the migration-20 social columns through a guarded query so an
  // un-migrated DB doesn't break the page (returns nulls until applied).
  const [postCount, recentComments, extra, followersCount, followingCount, journalActivity] = await Promise.all([
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
    // Public Journal Activity - guarded so an un-migrated DB (no
    // JournalActivity table) shows an empty feed rather than erroring.
    prisma.journalActivity
      .findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, type: true, title: true, win: true, createdAt: true } })
      .catch(() => []),
  ]);

  const isPremium = user.membership === "Premium";
  const isAdmin = user.role === "ADMIN";

  type SocialIcon = ComponentType<{ className?: string }>;
  // Defense-in-depth: the profile schema already rejects non-http(s) URLs, but
  // this guards any data written before that check existed - `website` renders
  // straight into an <a href>, so a javascript:/data: value here would be XSS.
  const websiteHref = user.website ? safeHref(user.website) : null;
  // Each social shows its BRAND colour always (not just on hover), on a tinted
  // ring that matches — colourful + instantly recognisable.
  const socials = [
    websiteHref && { href: websiteHref, Icon: Globe as SocialIcon, label: "Website", color: "text-gold-300", ring: "border-gold-500/30 hover:border-gold-500/60 hover:bg-gold-500/10" },
    user.twitter && { href: `https://x.com/${user.twitter}`, Icon: XIcon as SocialIcon, label: `@${user.twitter}`, color: "text-zinc-100", ring: "border-white/15 hover:border-white/40 hover:bg-white/10" },
    user.telegram && { href: `https://t.me/${user.telegram}`, Icon: TelegramIcon as SocialIcon, label: user.telegram, color: "text-sky-400", ring: "border-sky-500/30 hover:border-sky-500/60 hover:bg-sky-500/10" },
    extra.discord && { href: `https://discord.gg/${extra.discord}`, Icon: DiscordIcon as SocialIcon, label: "Discord", color: "text-indigo-400", ring: "border-indigo-500/30 hover:border-indigo-500/60 hover:bg-indigo-500/10" },
    extra.youtube && { href: `https://youtube.com/@${extra.youtube}`, Icon: YouTubeIcon as SocialIcon, label: "YouTube", color: "text-red-500", ring: "border-red-500/30 hover:border-red-500/60 hover:bg-red-500/10" },
    extra.instagram && { href: `https://instagram.com/${extra.instagram}`, Icon: InstagramIcon as SocialIcon, label: `@${extra.instagram}`, color: "text-pink-500", ring: "border-pink-500/30 hover:border-pink-500/60 hover:bg-pink-500/10" },
    extra.linkedin && { href: `https://linkedin.com/in/${extra.linkedin}`, Icon: LinkedInIcon as SocialIcon, label: "LinkedIn", color: "text-blue-500", ring: "border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/10" },
    user.github && { href: `https://github.com/${user.github}`, Icon: GitHubIcon as SocialIcon, label: user.github, color: "text-zinc-100", ring: "border-white/15 hover:border-white/40 hover:bg-white/10" },
  ].filter(Boolean) as { href: string; Icon: SocialIcon; label: string; color: string; ring: string }[];

  return (
    <>
      {/* Public profile as a Person, plus a breadcrumb. Only fields the page
          already shows publicly - never an email.
          `username` is nullable in the schema even though this record was
          found BY username, so it is narrowed rather than asserted: no handle
          means no node, which beats emitting one with a broken url. */}
      {user.username && (
        <>
          <JsonLd data={personJsonLd({ ...user, username: user.username })} />
          <JsonLd
            data={breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: `@${user.username}`, path: `/u/${user.username}` },
            ])}
          />
        </>
      )}
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <div className="mesh" />
        <div className="relative mx-auto max-w-4xl px-4 pb-24 sm:px-6 lg:px-8">
          {/* Hero card */}
          <Reveal variant="blur">
          <div className={cn("glass overflow-hidden rounded-3xl", isPremium && "ring-1 ring-gold-500/40 shadow-gold")}>
            <div className="relative h-32 w-full sm:h-40">
              <ProfileBannerImage bannerImage={user.bannerImage} />
              {/* Premium wash: a quiet gold vignette blended over the banner (or the
                  plain gradient when there isn't one) - not a different banner, just
                  a warmer tint that reads as "premium" without competing with it. */}
              {isPremium && (
                <div className="absolute inset-0 bg-gradient-to-br from-gold-500/25 via-transparent to-transparent" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900/60 to-transparent" />
              <div className={cn("absolute inset-x-0 bottom-0 h-px", isPremium ? "bg-gold-400/30" : "bg-white/10")} />
            </div>
            <div className="px-5 pb-6 sm:px-8 sm:pb-8">
              {/* Header layout, rewritten to have ONE left edge.
                  It used to be four rows of different widths - two large stacked
                  count pills indented under the name, then badges, then actions,
                  then the bio - each starting at a different x. Now: identity
                  (avatar + name + handle + badges) with the actions pinned to the
                  right on desktop and dropping to their own full-width row on a
                  phone, then bio, then chips, then one counts bar. Everything
                  below the avatar row lines up with the card's padding. */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                {/* Only the avatar overlaps the banner; the name/handle stay in the
                    content area below it so the name is never hidden over the banner art. */}
                <div className="flex min-w-0 items-start gap-4 sm:gap-5">
                  {/* Tapping the photo opens it full-size (like X) - only when
                      there's a real photo to show, not the initials fallback. */}
                  {user.image ? (
                    <ImageLightbox
                      src={user.image}
                      alt={`${user.name ?? user.username} - profile photo`}
                      className="-mt-8 inline-flex shrink-0 cursor-zoom-in rounded-full sm:-mt-10"
                    >
                      <Avatar
                        name={user.name}
                        image={user.image}
                        size="xl"
                        premium={isPremium}
                        ring={false}
                        className={isPremium ? "shadow-gold ring-2 ring-gold-400" : "shadow-gold ring-[3px] ring-ink-900"}
                      />
                    </ImageLightbox>
                  ) : (
                    <Avatar
                      name={user.name}
                      image={user.image}
                      size="xl"
                      premium={isPremium}
                      ring={false}
                      className={cn(
                        "-mt-8 shrink-0 shadow-gold sm:-mt-10",
                        isPremium ? "ring-2 ring-gold-400" : "ring-[3px] ring-ink-900"
                      )}
                    />
                  )}
                  <div className="min-w-0 pt-1">
                    <h1
                      className={cn(
                        "font-display text-[26px] font-bold leading-[1.1] tracking-tight break-words sm:text-4xl lg:text-[2.6rem]",
                        isPremium ? "text-gold-gradient" : "text-zinc-50"
                      )}
                    >
                      {user.name ?? `@${user.username}`}
                    </h1>
                    <p className="mono mt-1 truncate text-sm text-zinc-500 sm:text-[15px]">@{user.username}</p>
                  </div>
                </div>
                {/* Actions. On a phone this is its own row at the card's left
                    edge, with Edit/Message sharing the width evenly so it reads
                    as a deliberate bar rather than three leftover buttons; from
                    sm up it pins to the top right, beside the name. */}
                <div className="flex items-center gap-2 sm:shrink-0">
                  <EditProfileButton username={user.username!} className="flex-1 justify-center sm:flex-none" />
                  <MessageButton username={user.username!} className="flex-1 sm:flex-none" />
                  <CopyLinkButton compact />
                </div>
              </div>

              {/* Badges get their own full-width band rather than living in the
                  name column. Inside the column they were indented past the
                  avatar, so they started at a different x from the bio, the
                  chips and the buttons - measured 149px against 37px on a
                  412px screen, which is precisely what read as "unaligned" -
                  and the column was too narrow to hold all three on one line. */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {isPremium && <PremiumBadge />}
                {isAdmin && <Badge tone="mint">Team</Badge>}
                <Badge tone="neutral">Joined {formatDate(user.createdAt)}</Badge>
              </div>

              {user.bio && (
                <p className="mt-4 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-zinc-300">{user.bio}</p>
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
                {socials.map(({ href, Icon, label, color, ring }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    title={label}
                    aria-label={label}
                    className={`group grid h-10 w-10 place-items-center rounded-full border bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 ${ring} ${color}`}
                  >
                    <Icon className="h-[19px] w-[19px] transition-transform duration-300 group-hover:scale-110" />
                  </a>
                ))}
              </div>

              {/* Follower/following counts close the card as one full-width bar
                  on the same left edge as the bio and the chips, with Follow
                  pushed to the far right. They used to sit indented in the name
                  column, where the two pills wrapped and pushed Follow onto a
                  line of its own. Sitting here also puts them next to the
                  Posts/Comments/Likes cards directly below - numbers with
                  numbers. */}
              <ProfileFollow
                username={user.username!}
                profileId={user.id}
                initialFollowers={followersCount}
                initialFollowing={followingCount}
                className="mt-5 border-t border-white/10 pt-5"
              />
            </div>
          </div>
          </Reveal>

          {/* Stats */}
          <div className="mt-6">
            <ProfileStats posts={postCount} comments={user._count.comments} likes={user._count.likes} premium={isPremium} />
          </div>

          {/* Journal Activity - a separate, live section: whatever a member does
              in their trading Journal (that they've marked public) shows up here. */}
          {journalActivity.length > 0 && (
            <Reveal variant="up" className="mt-8 block">
              <JournalActivityFeed
                userId={user.id}
                initialItems={journalActivity.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))}
              />
            </Reveal>
          )}

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
    </>
  );
}
