import { Container, Section, SectionHeading } from "./ui/primitives";
import { Reveal } from "./Reveal";
import { OrbitalEcosystem } from "./OrbitalEcosystem";

// Premium 3D orbital ecosystem showcase. Additive homepage section — no backend
// impact. The interactive orbital is a self-contained client component.
export function OrbitalSection() {
  return (
    <Section id="ecosystem-orbital" className="overflow-hidden">
      <Container>
        <SectionHeading
          eyebrow="One Unified Ecosystem"
          title={
            <>
              Everything orbits <span className="text-gold-gradient">XYZ Crypto.</span>
            </>
          }
          subtitle="Research, trading, a perp DEX, AI tools, airdrops, premium intel, education and community, one connected Web3 platform."
        />
        <Reveal>
          <div className="mt-12 sm:mt-16">
            <OrbitalEcosystem />
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
