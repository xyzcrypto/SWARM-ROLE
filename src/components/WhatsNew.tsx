import { Sparkles, Wrench, Bug } from "lucide-react";
import { Container, Section, SectionHeading } from "./ui/primitives";
import { Reveal } from "./Reveal";
import { WHATS_NEW, type WhatsNewEntry } from "@/lib/whatsnew";
import { formatDate } from "@/lib/utils";

const tagStyle: Record<WhatsNewEntry["tag"], { ring: string; text: string; Icon: typeof Sparkles }> = {
  New: { ring: "ring-mint-500/30 bg-mint-500/10", text: "text-mint-200", Icon: Sparkles },
  Improved: { ring: "ring-gold-500/30 bg-gold-500/10", text: "text-gold-200", Icon: Wrench },
  Fixed: { ring: "ring-violet-400/30 bg-violet-500/10", text: "text-violet-200", Icon: Bug },
};

// Homepage "What's New" feed - driven by src/lib/whatsnew.ts. Static + ISR-safe;
// add a new entry there to update this section instantly.
export function WhatsNew() {
  const entries = WHATS_NEW.slice(0, 4);
  if (entries.length === 0) return null;

  return (
    <Section id="whats-new">
      <Container>
        <SectionHeading
          eyebrow="What's new"
          title={
            <>
              Fresh from the <span className="text-gold-gradient">XYZ Crypto</span> lab
            </>
          }
          subtitle="The latest features and improvements shipping across the ecosystem."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {entries.map((e, i) => {
            const s = tagStyle[e.tag];
            return (
              <Reveal key={`${e.title}-${i}`} delay={i} variant="pop">
                <div className="surface surface-hover lift group h-full rounded-3xl p-6">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${s.ring} ${s.text}`}
                    >
                      <s.Icon className="h-3.5 w-3.5" strokeWidth={2} />
                      {e.tag}
                    </span>
                    <span className="mono text-[11px] text-zinc-500">{formatDate(e.date)}</span>
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold text-zinc-100">{e.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{e.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
