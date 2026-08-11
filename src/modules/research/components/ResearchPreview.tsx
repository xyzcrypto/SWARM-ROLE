import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { readingTime } from "@/lib/utils";
import { POST_CARD_SELECT } from "@/lib/post-select";
import { Reveal } from "@/components/Reveal";
import { PostCard } from "@/components/PostCard";
import { EarlyAccessCta } from "@/components/EarlyAccessCta";
import { Container, Section, Eyebrow } from "@/components/ui/primitives";

export async function ResearchPreview() {
  const rawPosts = await prisma.post
    .findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: POST_CARD_SELECT,
    })
    .catch(() => []);


  return (
    <Section id="research">
      <Container>
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
            <div className="max-w-xl">
              <Eyebrow>Knowledge Hub</Eyebrow>
              <h2 className="mt-5 font-display text-display-md font-semibold tracking-tight text-zinc-50">
                Latest <span className="text-shine">Web3 research.</span>
              </h2>
            </div>
            <Link href="/research" className="btn-ghost shrink-0">
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>

        {rawPosts.length > 0 ? (
          <div className="mt-10 grid gap-5 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
            {rawPosts.map((post, i) => (
              <Reveal key={post.id} delay={i} variant="pop">
                <PostCard post={post} />
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal>
            <div className="mt-12 rounded-4xl border border-dashed border-line-gold bg-ink-900/40 p-12 text-center">
              <p className="font-display text-lg font-semibold text-zinc-200">Research is dropping soon</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
                Our first reports, articles and deep-dives are being prepared.
                Sign up to be the first to read them.
              </p>
              <EarlyAccessCta className="btn-primary mt-6" />
            </div>
          </Reveal>
        )}
      </Container>
    </Section>
  );
}
