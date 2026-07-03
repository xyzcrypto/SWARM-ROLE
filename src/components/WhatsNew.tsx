import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { Container, Section, SectionHeading } from "./ui/primitives";
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
    return WHATS_NEW; // table not migrated yet — graceful fallback
  }
}

export async function WhatsNew() {
  const entries = await getEntries();
  if (entries.length === 0) return null;

  return (
    <Section id="whats-new">
      <Container>
        <SectionHeading
          eyebrow="What's new"
          title={
            <>
              Fresh from the XYZ Crypto lab
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
