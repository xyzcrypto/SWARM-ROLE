import { Reveal } from "./Reveal";

const products = [
  {
    name: "Perp DEX",
    status: "Coming Soon",
    desc: "A high-performance decentralized perpetuals exchange — deep liquidity, low fees, self-custody. The flagship XYZ product.",
    icon: (
      <>
        <polyline points="3 3 3 21 21 21" />
        <polyline points="7 14 11 10 14 13 20 6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    featured: true,
  },
  {
    name: "Trading Tools",
    status: "In Development",
    desc: "Pro-grade screeners, on-chain scanners, real-time alerts and analytics to give you a genuine trading edge.",
    icon: (
      <>
        <rect x="2" y="2" width="5" height="20" rx="1" />
        <rect x="9.5" y="7" width="5" height="15" rx="1" />
        <rect x="17" y="4" width="5" height="18" rx="1" />
      </>
    ),
  },
  {
    name: "Airdrop Tools",
    status: "Planned",
    desc: "Track, qualify and farm airdrops with automated checklists, wallet management and eligibility tracking.",
    icon: (
      <>
        <path d="M12 3v4M8.5 5.5l2.83 2.83M15.5 5.5l-2.83 2.83" strokeLinecap="round" />
        <path d="M6 10h12a1 1 0 0 1 .95 1.32l-2.5 7A1 1 0 0 1 15.5 19h-7a1 1 0 0 1-.95-.68l-2.5-7A1 1 0 0 1 6 10Z" strokeLinejoin="round" />
      </>
    ),
  },
  {
    name: "XYZ Premium",
    status: "Planned",
    desc: "Premium intelligence — early calls, private research, curated alpha and members-only tooling for serious traders.",
    icon: (
      <>
        <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinejoin="round" />
      </>
    ),
  },
  {
    name: "Web3 Academy",
    status: "Live",
    desc: "Structured education from zero to on-chain pro — guides, cohorts and hands-on learning for every level.",
    icon: (
      <>
        <path d="M22 10 12 5 2 10l10 5 10-5Z" strokeLinejoin="round" />
        <path d="M6 12.5v5c0 1.1 2.69 3 6 3s6-1.9 6-3v-5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    name: "& More",
    status: "Next Version",
    desc: "The roadmap keeps growing. New products and integrations will ship in upcoming version updates.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="16" strokeLinecap="round" />
        <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" />
      </>
    ),
  },
];

const statusStyle: Record<string, string> = {
  Live:             "text-emerald-300 bg-emerald-500/12 ring-emerald-500/25",
  "Coming Soon":    "text-gold-200   bg-gold-500/12    ring-gold-500/30",
  "In Development": "text-sky-300    bg-sky-500/12     ring-sky-500/25",
  Planned:          "text-zinc-300   bg-zinc-500/12    ring-zinc-500/20",
  "Next Version":   "text-fuchsia-300 bg-fuchsia-500/12 ring-fuchsia-500/25",
};

const statusDot: Record<string, string> = {
  Live:             "bg-emerald-400",
  "Coming Soon":    "bg-gold-400",
  "In Development": "bg-sky-400",
  Planned:          "bg-zinc-500",
  "Next Version":   "bg-fuchsia-400",
};

export function Products() {
  return (
    <section id="products" className="relative py-28">
      <hr className="section-sep" />

      <div className="pointer-events-none absolute inset-0">
        <div className="glow-orb left-1/2 top-12 h-80 w-80 -translate-x-1/2 bg-gold-500/8" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-center text-xs font-bold uppercase tracking-[0.22em] text-gold-500">
            The Ecosystem
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl text-center font-display text-3xl font-bold text-zinc-50 sm:text-5xl">
            Products built to{" "}
            <span className="text-gold-gradient">power your edge</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-center text-base leading-relaxed text-zinc-400">
            A full product suite, shipping in stages. Here&apos;s what&apos;s
            live, what&apos;s building, and what&apos;s next.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p, i) => (
            <Reveal key={p.name} delay={i}>
              <div
                className={`group relative h-full overflow-hidden rounded-2xl p-7 transition-all duration-300 ${
                  p.featured
                    ? "feature-card hover:-translate-y-2 hover:shadow-gold"
                    : "card-gold-border hover:-translate-y-1.5 hover:shadow-gold-sm"
                }`}
              >
                {/* Top accent line */}
                <div className={`absolute inset-x-0 top-0 h-[2px] rounded-t-2xl ${
                  p.featured
                    ? "bg-gradient-to-r from-gold-700 via-gold-400 to-gold-700"
                    : "bg-gradient-to-r from-transparent via-gold-500/25 to-transparent"
                }`} />

                <div className="mb-6 flex items-start justify-between gap-3">
                  <div className="icon-box h-12 w-12 shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {p.icon}
                    </svg>
                  </div>
                  <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${statusStyle[p.status]}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusDot[p.status]}`} />
                    {p.status}
                  </span>
                </div>

                <h3 className="font-display text-xl font-bold text-zinc-50">
                  {p.name}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
                  {p.desc}
                </p>

                {/* Hover glow spot */}
                <div className="pointer-events-none absolute -bottom-10 -right-10 h-36 w-36 rounded-full bg-gold-500/0 blur-2xl transition-all duration-500 group-hover:bg-gold-500/12" />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
