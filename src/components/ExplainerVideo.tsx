import { Container, Section, SectionHeading } from "./ui/primitives";
import { Reveal } from "./Reveal";
import { ExplainerPlayer } from "./ExplainerPlayer";

// "What is XYZ Crypto?" - a one-minute film for first-time visitors, directly
// below the hero. Server-rendered shell; only the player is a client component,
// and it downloads nothing until the visitor presses play.
export function ExplainerVideo() {
  return (
    <Section id="what-is-xyz">
      <Container>
        <SectionHeading
          eyebrow="What is XYZ Crypto?"
          title={
            <>
              The whole story in <span className="text-shine">one minute.</span>
            </>
          }
          subtitle="Research, live markets, airdrop intelligence, an AI assistant and a 50K+ community. See how it all fits together."
        />
        <Reveal delay={2} className="mt-8 block sm:mt-10">
          <ExplainerPlayer />
        </Reveal>
      </Container>
    </Section>
  );
}
