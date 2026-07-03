import { Container, Section, SectionHeading } from "./ui/primitives";
import { Reveal } from "./Reveal";
import { FAQ } from "@/lib/faq";

// Visible FAQ — pairs with the FAQPage JSON-LD (same `FAQ` source) so the answers
// can surface directly on the "XYZ Crypto" search result. Native <details> = no JS.
export function Faq() {
  return (
    <Section id="faq">
      <Container>
        <SectionHeading
          eyebrow="FAQ"
          title={
            <>
              Questions about XYZ Crypto
            </>
          }
          subtitle="The quick answers — what XYZ Crypto is, what's free, and how to get started."
        />
        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {FAQ.map((f, i) => (
            <Reveal key={f.q} delay={i} variant="fade">
              <details className="surface group rounded-2xl p-5 sm:p-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display text-base font-semibold text-zinc-100">
                  {f.q}
                  <span className="shrink-0 text-xl leading-none text-gold-300 transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
