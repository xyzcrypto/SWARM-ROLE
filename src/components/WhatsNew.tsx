import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { Container, Section, SectionHeading } from "./ui/primitives";
import { AnimatedEmoji } from "./AnimatedEmoji";
import { WhatsNewFeed } from "./WhatsNewFeed";
import { WHATS_NEW, type WhatsNewEntry } from "@/lib/whatsnew";

// DB-driven "What's New" feed (model WhatsNewEntry), managed from the dashboard
// and auto-populated on research publish. Falls back to the static seed list when
// the DB is empty or not migrated, so the section always renders. Runs on the
// homepage ISR (revalidate 300) + on-demand revalidatePath on entry changes.
async function getEntries(): Promise<WhatsNewEntry[]> {
  try {
    const rows = await prisma.whatsNewEntry.findMany({
      where: { published: true },
      orderBy: { date: "desc" },
      take: 12,
    });
    if (rows.length === 0) return WHATS_NEW;
    return rows.map((r) => ({
      id: r.id,
      date: r.date.toISOString(),
      tag: r.tag as WhatsNewEntry["tag"],
      title: r.title,
      body: r.body,
    }));
  } catch {
    return WHATS_NEW; // table not migrated yet - graceful fallback
  }
}

export async function WhatsNew() {
  const entries = await getEntries();
  if (entries.length === 0) return null;

  return (
    <Section id="whats-new">
      <div className="glow-orb -left-16 top-8 h-64 w-64 bg-gold-500/[0.08]" />
      <Container className="relative">
        <SectionHeading
          eyebrow="What's new"
          title={
            <>
              Fresh from the <span className="text-gold-gradient">XYZ Crypto</span> lab{" "}
              <AnimatedEmoji emoji="✨" variant="twinkle" className="align-middle text-[0.8em]" />
            </>
          }
          subtitle="The latest features and improvements shipping across the ecosystem."
        />
        <WhatsNewFeed
          entries={entries}
          realtime={{ url: env.NEXT_PUBLIC_SUPABASE_URL, anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
        />
      </Container>
    </Section>
  );
}
