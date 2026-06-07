import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Reveal } from "./Reveal";
import { PostCard } from "./PostCard";
import { Container, Section, Eyebrow } from "./ui/primitives";

export async function ResearchPreview() {
  const posts = await prisma.post
    .findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { author: { select: { name: true } } },
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
                Latest <span className="text-gold-gradient">Web3 research.</span>
              </h2>
            </div>
            <Link href="/research" className="btn-ghost shrink-0">
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>

        {posts.length > 0 ? (
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p, i) => (
              <Reveal key={p.id} delay={i}>
                <PostCard post={p} />
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
              <Link href="/signup" className="btn-primary mt-6">Get early access</Link>
            </div>
          </Reveal>
        )}
      </Container>
    </Section>
  );
}
