import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Reveal } from "./Reveal";
import { PostCard } from "./PostCard";

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
    <section id="research" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">
                Knowledge Hub
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold text-zinc-50 sm:text-5xl">
                Latest <span className="text-gold-gradient">Web3 Research</span>
              </h2>
            </div>
            <Link href="/research" className="btn-ghost shrink-0">
              View all
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </Reveal>

        {posts.length > 0 ? (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p, i) => (
              <Reveal key={p.id} delay={i}>
                <PostCard post={p} />
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal>
            <div className="mt-12 rounded-2xl border border-dashed border-gold-500/20 bg-ink-700/40 p-12 text-center">
              <p className="font-display text-lg font-semibold text-zinc-200">
                Research is dropping soon
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
                Our first reports, articles and deep-dives are being prepared.
                Sign up to be the first to read them.
              </p>
              <Link href="/signup" className="btn-gold mt-6">
                Get early access
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
