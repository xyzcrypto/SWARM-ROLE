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
    <section id="research" className="relative py-28">
      <hr className="section-sep" />

      <div className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-500">
                Knowledge Hub
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold text-zinc-50 sm:text-5xl">
                Latest{" "}
                <span className="text-gold-gradient">Web3 Research</span>
              </h2>
            </div>
            <Link href="/research" className="btn-ghost shrink-0">
              View all research
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
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
            <div className="mt-12 rounded-2xl border border-dashed border-gold-500/20 bg-ink-700/40 px-8 py-16 text-center">
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500/10 ring-1 ring-gold-500/20">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e9bd54" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="13" x2="15" y2="13" />
                  <line x1="9" y1="17" x2="13" y2="17" />
                </svg>
              </div>
              <p className="font-display text-lg font-semibold text-zinc-100">
                Research is dropping soon
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
                Our first reports, articles and deep-dives are being prepared.
                Sign up to be the first to read them.
              </p>
              <Link href="/signup" className="btn-gold mt-7 inline-flex">
                Get early access
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
