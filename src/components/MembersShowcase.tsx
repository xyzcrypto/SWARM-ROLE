import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Container, Section, SectionHeading, Badge } from "./ui/primitives";
import { Reveal } from "./Reveal";
import { Avatar } from "./Avatar";

// Live community showcase - recent members who set a public handle. Mint/green
// themed to contrast the gold sections. Server component; only public profiles
// (users with a username) are shown, each linking to /u/<handle>.
export async function MembersShowcase({ memberCount = 0 }: { memberCount?: number }) {
  const members = await prisma.user
    .findMany({
      where: { username: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 14,
      select: { name: true, username: true, image: true, membership: true },
    })
    .catch(() => [] as { name: string | null; username: string | null; image: string | null; membership: string }[]);

  if (members.length === 0) return null;

  return (
    <Section className="overflow-hidden">
      <Container>
        <SectionHeading
          eyebrow="The Community"
          title={
            <>
              Meet the <span className="text-mint-gradient">XYZ Crypto members</span>
            </>
          }
          subtitle="Real people building, trading and researching together. Tap any member to view their public profile."
        />

        <div className="mt-12 flex flex-wrap justify-center gap-3 sm:gap-4">
          {members.map((m, i) => (
            <Reveal key={m.username} variant="pop" delay={i % 8}>
              <Link
                href={`/u/${m.username}`}
                className="group flex w-[8.5rem] flex-col items-center rounded-2xl border border-mint-500/15 bg-gradient-to-b from-mint-500/[0.06] to-transparent p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:border-mint-500/40 hover:shadow-[0_0_28px_-8px_rgba(34,214,146,0.5)]"
              >
                <span className="ring-2 ring-mint-500/20 transition-all duration-300 group-hover:ring-mint-400/50 rounded-full">
                  <Avatar name={m.name} image={m.image} size="lg" />
                </span>
                <span className="mt-3 max-w-full truncate text-sm font-semibold text-zinc-100 group-hover:text-mint-100">
                  {m.name ?? `@${m.username}`}
                </span>
                <span className="mono max-w-full truncate text-[11px] text-zinc-500">@{m.username}</span>
                {m.membership === "Premium" && (
                  <span className="mt-2">
                    <Badge tone="gold" className="!px-1.5 !py-0 text-[10px]">★ Premium</Badge>
                  </span>
                )}
              </Link>
            </Reveal>
          ))}
        </div>

        {memberCount > members.length && (
          <Reveal>
            <p className="mt-8 text-center text-sm text-zinc-500">
              Join{" "}
              <span className="font-semibold text-mint-200">{memberCount.toLocaleString()}+</span>{" "}
              members already inside the ecosystem.
            </p>
          </Reveal>
        )}
      </Container>
    </Section>
  );
}
