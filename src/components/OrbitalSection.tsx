import { Container, Section, SectionHeading } from "./ui/primitives";
import { Reveal } from "./Reveal";
import { OrbitalLazy } from "./OrbitalLazy";
import { OrbitalBackdrop } from "./OrbitalBackdrop";

// Premium 3D orbital ecosystem showcase. Additive homepage section - no backend
// impact. The interactive orbital is a self-contained client component.
export function OrbitalSection() {
  return (
    <Section id="ecosystem-orbital" className="relative overflow-hidden">
      {/* deep-space backdrop: full-bleed starfield + two faint distant glows
          (gold / mint) so the orbital reads like a little solar system. Drops its
          Saturn/Moon when the WebGL scene is active (that scene draws its own). */}
      <OrbitalBackdrop />
      <div className="glow-orb left-[12%] top-[18%] h-56 w-56 bg-gold-500/[0.06]" />
      <div className="glow-orb bottom-[10%] right-[14%] h-64 w-64 bg-mint-500/[0.05]" />
      <Container className="relative">
        <SectionHeading
          eyebrow="One Unified Ecosystem"
          title={
            <>
              Everything orbits <span className="text-shine">XYZ Crypto.</span>
            </>
          }
          subtitle="Research, trading, a perp DEX, AI tools, airdrops, premium intel, education and community, one connected Web3 platform."
        />
        <Reveal variant="scale">
          <div className="mt-12 sm:mt-16">
            <OrbitalLazy />
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
