import type { ComponentType, SVGProps } from "react";
import { Container } from "./ui/primitives";
import { Reveal } from "./Reveal";
import { YouTubeIcon, XIcon, TelegramIcon, LinkedInIcon } from "./BrandIcons";
import { site } from "@/lib/site";

type ProofItem = {
  label: string;
  href: string;
  hover: string;
  Icon?: ComponentType<SVGProps<SVGSVGElement>>;
  logo?: string;
  color?: string;
};

const items: ProofItem[] = [
  { label: "YouTube", href: site.socials.youtube, Icon: YouTubeIcon, color: "text-red-500", hover: "hover:border-red-500/50 hover:text-red-400" },
  { label: "X", href: site.socials.x, Icon: XIcon, color: "text-zinc-100", hover: "hover:border-white/40 hover:text-white" },
  { label: "Telegram", href: site.socials.telegram, Icon: TelegramIcon, color: "text-sky-400", hover: "hover:border-sky-500/50 hover:text-sky-300" },
  { label: "LinkedIn", href: site.socials.linkedin, Icon: LinkedInIcon, color: "text-blue-500", hover: "hover:border-blue-500/50 hover:text-blue-400" },
  { label: "Web3 Academy", href: site.ecosystem.web3Academy, logo: "/web3-academy.jpg", hover: "hover:border-gold-500/50 hover:text-gold-200" },
  { label: "TradeKaroVerse", href: site.ecosystem.tradeKaroVerse, logo: "/tradekaroverse.jpg", hover: "hover:border-mint-500/50 hover:text-mint-200" },
];

export function ProofStrip() {
  return (
    <div className="border-b border-line py-8 sm:py-10">
      <Container>
        <Reveal>
          <p className="text-center mono text-[11px] uppercase tracking-[0.2em] text-zinc-600">
            One ecosystem · trusted across every platform
          </p>
        </Reveal>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {items.map((it, i) => {
            const Icon = it.Icon;
            return (
              <Reveal key={it.label} delay={i} variant="pop">
              <a
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={it.label}
                className={`group flex items-center gap-2.5 rounded-xl border border-line bg-ink-900/50 px-4 py-2.5 text-zinc-400 transition-all duration-300 hover:-translate-y-0.5 ${it.hover}`}
              >
                {it.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.logo} alt={it.label} className="h-5 w-5 rounded-full object-cover ring-1 ring-white/10" />
                ) : Icon ? (
                  <Icon className={`h-5 w-5 transition-colors ${it.color ?? ""}`} />
                ) : null}
                <span className="text-sm font-medium">{it.label}</span>
              </a>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </div>
  );
}
