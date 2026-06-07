import { Reveal } from "./Reveal";

const pillars = [
  {
    title: "Research-Driven",
    body: "Deep, unbiased Web3 research and on-chain analysis — so you act on signal, not noise.",
    icon: (
      <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3" />
    ),
  },
  {
    title: "Builder Tooling",
    body: "A growing suite of trading tools, an upcoming perp DEX and automation built for performance.",
    icon: <path d="M14 7l-1.5-1.5a3.5 3.5 0 0 0-5 5L3 15v6h6l4.5-4.5a3.5 3.5 0 0 0 5-5L17 10" />,
  },
  {
    title: "Community First",
    body: "An open ecosystem where the community shares in the upside — from airdrops to academies.",
    icon: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  },
  {
    title: "Security & Trust",
    body: "Transparency by default. Every product is shipped with safety, custody and clarity in mind.",
    icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4" />,
  },
];

export function About() {
  return (
    <section id="about" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">
            Who we are
          </p>
          <h2 className="mx-auto mt-3 max-w-3xl text-center font-display text-3xl font-bold text-zinc-50 sm:text-5xl">
            One ecosystem for the{" "}
            <span className="text-gold-gradient">entire Web3 journey</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-center text-zinc-400">
            XYZ Crypto unifies research, tooling, education and community into a
            single, trusted brand. We help newcomers learn, traders win, and
            builders ship — all on-chain, all in one place.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={i}>
              <div className="card-gold-border group h-full rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-gold-sm">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500/10 text-gold-300 ring-1 ring-gold-500/20 transition-colors group-hover:bg-gold-500/20">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {p.icon}
                  </svg>
                </div>
                <h3 className="font-display text-lg font-semibold text-zinc-100">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {p.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
