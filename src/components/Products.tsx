import { Reveal } from "./Reveal";

const products = [
  {
    name: "Perp DEX",
    status: "Coming Soon",
    desc: "A high-performance decentralized perpetuals exchange — deep liquidity, low fees, self-custody.",
    icon: <path d="M3 3v18h18M7 14l4-4 3 3 5-6" />,
    featured: true,
  },
  {
    name: "Trading Tools",
    status: "In Development",
    desc: "Pro-grade screeners, on-chain scanners, alerts and analytics to give you a real trading edge.",
    icon: <path d="M9 17V9m4 8V5m4 12v-4M3 21h18" />,
  },
  {
    name: "Airdrop Tools",
    status: "Planned",
    desc: "Track, qualify and farm airdrops with automated checklists, wallets and eligibility tracking.",
    icon: <path d="M12 2a7 7 0 0 0-7 7c0 3 2 5 2 5h10s2-2 2-5a7 7 0 0 0-7-7ZM9 19a3 3 0 0 0 6 0M9 16h6" />,
  },
  {
    name: "XYZ Premium",
    status: "Planned",
    desc: "Premium intelligence — early calls, private research, curated alpha and members-only tooling.",
    icon: <path d="m12 2 3 6.5 7 .8-5 4.7 1.3 6.9L12 17.8 5.4 20.9 6.7 14l-5-4.7 7-.8L12 2Z" />,
  },
  {
    name: "Web3 Academy",
    status: "Live",
    desc: "Structured education from zero to on-chain pro — guides, cohorts and hands-on learning.",
    icon: <path d="M22 10 12 5 2 10l10 5 10-5ZM6 12v5c0 1 3 3 6 3s6-2 6-3v-5" />,
  },
  {
    name: "& More",
    status: "Next Version",
    desc: "The roadmap keeps growing. New products and integrations ship in upcoming version updates.",
    icon: <path d="M12 5v14M5 12h14" />,
  },
];

const statusStyles: Record<string, string> = {
  Live: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  "Coming Soon": "bg-gold-500/15 text-gold-200 ring-gold-500/30",
  "In Development": "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  Planned: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
  "Next Version": "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30",
};

export function Products() {
  return (
    <section id="products" className="relative py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="glow-orb left-1/2 top-0 h-72 w-72 -translate-x-1/2 bg-gold-600/10" />
      </div>
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">
            The Ecosystem
          </p>
          <h2 className="mx-auto mt-3 max-w-3xl text-center font-display text-3xl font-bold text-zinc-50 sm:text-5xl">
            Products built to{" "}
            <span className="text-gold-gradient">power your edge</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-center text-zinc-400">
            A full product suite, shipping in stages. Here&apos;s what&apos;s
            live, what&apos;s building, and what&apos;s next.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p, i) => (
            <Reveal key={p.name} delay={i}>
              <div
                className={`group relative h-full overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 ${
                  p.featured
                    ? "bg-gradient-to-br from-gold-500/15 to-ink-700 ring-1 ring-gold-500/40 hover:shadow-gold"
                    : "card-gold-border hover:shadow-gold-sm"
                }`}
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500/10 text-gold-300 ring-1 ring-gold-500/20 transition-transform group-hover:scale-110">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {p.icon}
                    </svg>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${statusStyles[p.status]}`}>
                    {p.status}
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold text-zinc-50">
                  {p.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {p.desc}
                </p>
                <div className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-gold-500/0 blur-2xl transition-all duration-500 group-hover:bg-gold-500/10" />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
