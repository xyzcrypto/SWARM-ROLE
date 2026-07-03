import Link from "next/link";
import { ArrowUpRight, MessagesSquare } from "lucide-react";
import { Reveal } from "./Reveal";
import { site } from "@/lib/site";
import { YouTubeIcon, XIcon, TelegramIcon, LinkedInIcon } from "./BrandIcons";
import { Container, Section, SectionHeading } from "./ui/primitives";

const channels = [
  { name: "YouTube", handle: "@xyzcrypto", href: site.socials.youtube, Icon: YouTubeIcon, hover: "hover:border-red-500/40", color: "text-red-400", glow: "group-hover:shadow-[0_0_40px_-12px_rgba(239,68,68,0.5)]" },
  { name: "X (Twitter)", handle: "@XYZCryptos", href: site.socials.x, Icon: XIcon, hover: "hover:border-white/30", color: "text-zinc-100", glow: "group-hover:shadow-[0_0_40px_-12px_rgba(255,255,255,0.4)]" },
  { name: "Telegram", handle: "@X_Y_Z_Crypto", href: site.socials.telegram, Icon: TelegramIcon, hover: "hover:border-sky-500/40", color: "text-sky-400", glow: "group-hover:shadow-[0_0_40px_-12px_rgba(56,189,248,0.5)]" },
  { name: "LinkedIn", handle: "/company/xyzcrypto", href: site.socials.linkedin, Icon: LinkedInIcon, hover: "hover:border-blue-500/40", color: "text-blue-400", glow: "group-hover:shadow-[0_0_40px_-12px_rgba(59,130,246,0.5)]" },
];

export function Social() {
  return (
    <Section id="community">
      <Container>
        <SectionHeading
          eyebrow="Stay Connected"
          title={
            <>
              Join the community.
            </>
          }
          subtitle="Follow XYZ Crypto across every platform for research drops, alpha, product launches and live market coverage."
        />

        <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
          {channels.map((c, i) => (
            <Reveal key={c.name} delay={i} variant="pop">
              <a
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${c.name}, ${c.handle}`}
                className={`surface lift group relative flex h-full flex-col items-start rounded-3xl p-6 transition-all duration-300 ${c.hover} ${c.glow}`}
              >
                <div className="flex w-full items-start justify-between">
                  <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-105 ${c.color}`}>
                    <c.Icon className="h-6 w-6" />
                  </span>
                  <ArrowUpRight className="h-5 w-5 text-zinc-600 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-300" />
                </div>
                <span className="mt-5 font-display text-base font-semibold text-zinc-100">{c.name}</span>
                <span className="mt-1 mono text-xs text-zinc-500">{c.handle}</span>
              </a>
            </Reveal>
          ))}
        </div>

        {/* Live community chat entry point */}
        <Reveal delay={4} variant="fade" className="mt-8 flex justify-center">
          <Link href="/community" className="btn-gold inline-flex items-center gap-2">
            <MessagesSquare className="h-4 w-4" />
            Open Community Chat
          </Link>
        </Reveal>
      </Container>
    </Section>
  );
}
