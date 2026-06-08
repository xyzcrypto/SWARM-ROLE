import { Reveal } from "./Reveal";
import { TiltCard } from "./TiltCard";

const pillars = [
  {
    num: "01",
    title: "Research-Driven",
    body: "Deep, unbiased Web3 research and on-chain analysis — so you act on signal, not noise.",
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 8v3l2 2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    num: "02",
    title: "Builder Tooling",
    body: "A growing suite of trading tools, an upcoming perp DEX and automation built for performance.",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <path d="M17.5 14v7M14 17.5h7" strokeLinecap="round" />
      </>
    ),
  },
  {
    num: "03",
    title: "Community First",
    body: "An open ecosystem where the community shares in the upside — from airdrops to academies.",
    icon: (
      <>
        <circle cx="9" cy="7" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M1 21v-1a7 7 0 0 1 11.95-4.95" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 21v-1a5 5 0 0 1 10 0v1" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    num: "04",
    title: "Security & Trust",
    body: "Transparency by default. Every product is shipped with safety, custody and clarity in mind.",
    icon: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
];

export function About() {
  return (
    <section id="about" className="relative py-28">
      <hr className="section-sep" />

      <div className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-center text-xs font-bold uppercase tracking-[0.22em] text-gold-400">
            Who we are
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl text-center font-display text-3xl font-bold text-zinc-50 sm:text-5xl">
            One ecosystem for the{" "}
            <span className="text-gold-gradient">entire Web3 journey</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-center text-base leading-[1.8] text-zinc-500">
            XYZ Crypto unifies research, tooling, education and community into a
            single, trusted brand. We help newcomers learn, traders win, and
            builders ship.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ perspective: "1200px" }}>
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={i}>
              <TiltCard intensity={6}>
                <div className="card-gold-border group relative h-full overflow-hidden rounded-2xl p-7 hover:-translate-y-1.5">
                  {/* Spotlight overlay */}
                  <div className="spotlight" />
                  {/* Top accent */}
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/35 to-transparent" />

                  {/* Ghost number watermark */}
                  <div className="absolute -right-2 -top-4 font-display text-[5rem] font-extrabold leading-none text-white/[0.03] select-none">
                    {p.num}
                  </div>

                  <div className="mb-6 icon-box h-11 w-11">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      {p.icon}
                    </svg>
                  </div>

                  <h3 className="font-display text-[1rem] font-semibold text-zinc-100">
                    {p.title}
                  </h3>
                  <p className="mt-2.5 text-[0.83rem] leading-[1.7] text-zinc-500">
                    {p.body}
                  </p>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
