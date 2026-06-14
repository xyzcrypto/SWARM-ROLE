import type { Metadata } from "next";
import { Mail, Clock } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Container, Section, Badge } from "@/components/ui/primitives";
import { Reveal } from "@/components/Reveal";
import { AnimatedEmoji } from "@/components/AnimatedEmoji";
import { ContactForm } from "@/components/ContactForm";
import { YouTubeIcon, XIcon, TelegramIcon, LinkedInIcon } from "@/components/BrandIcons";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the XYZ Crypto team - questions, partnerships, support and feedback. Reach us by email or on our community channels.",
  alternates: { canonical: "/contact" },
};

// Brand colours mirror src/components/Social.tsx so the icons read as their real
// platform colours (with a matching hover border).
const socials = [
  { href: site.socials.youtube, Icon: YouTubeIcon, label: "YouTube", color: "text-red-400", hover: "hover:border-red-500/40" },
  { href: site.socials.x, Icon: XIcon, label: "X (Twitter)", color: "text-zinc-100", hover: "hover:border-white/30" },
  { href: site.socials.telegram, Icon: TelegramIcon, label: "Telegram", color: "text-sky-400", hover: "hover:border-sky-500/40" },
  { href: site.socials.linkedin, Icon: LinkedInIcon, label: "LinkedIn", color: "text-blue-400", hover: "hover:border-blue-500/40" },
];

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-24">
        <div className="mesh" />
        <Section className="relative">
          <Container>
            <div className="mx-auto max-w-2xl text-center">
              <Reveal>
                <Badge tone="mint" className="!px-3 !py-1">
                  <AnimatedEmoji emoji="👋" variant="wobble" className="text-sm" /> We&apos;d love to hear from you
                </Badge>
              </Reveal>
              <Reveal delay={1}>
                <h1 className="mt-5 font-display text-display-lg font-semibold tracking-tight text-zinc-50">
                  Contact <span className="text-gold-gradient">XYZ Crypto</span>
                </h1>
              </Reveal>
              <Reveal delay={2}>
                <p className="mt-4 text-base leading-relaxed text-zinc-400">
                  Questions, partnerships, support or feedback - send us a message and the team
                  will get back to you. You can also reach us directly on any of our channels.
                </p>
              </Reveal>
            </div>

            <div className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
              {/* Info column */}
              <Reveal>
                <div className="space-y-5">
                  <div className="surface flex items-start gap-3.5 rounded-2xl p-5">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/12 text-gold-200 ring-1 ring-gold-500/30">
                      <Mail className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">
                        <AnimatedEmoji emoji="✉️" variant="float" className="mr-1.5 text-sm" />
                        Email us
                      </p>
                      <a
                        href={`mailto:${site.email}`}
                        className="mono text-[13px] text-mint-300 transition-colors hover:text-mint-200"
                      >
                        {site.email}
                      </a>
                      <p className="mt-1 text-[12px] text-zinc-500">
                        For support, partnerships and general enquiries.
                      </p>
                    </div>
                  </div>

                  <div className="surface flex items-start gap-3.5 rounded-2xl p-5">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-300 ring-1 ring-sky-500/30">
                      <TelegramIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">
                        <AnimatedEmoji emoji="💬" variant="float" className="mr-1.5 text-sm" />
                        Telegram
                      </p>
                      <a
                        href={site.support.telegramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono text-[13px] text-mint-300 transition-colors hover:text-mint-200"
                      >
                        @{site.support.telegram}
                      </a>
                      <p className="mt-1 text-[12px] text-zinc-500">
                        Fastest way to reach us directly.
                      </p>
                    </div>
                  </div>

                  <div className="surface flex items-start gap-3.5 rounded-2xl p-5">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint-500/12 text-mint-300 ring-1 ring-mint-500/30">
                      <Clock className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">
                        <AnimatedEmoji emoji="⏱️" variant="wobble" className="mr-1.5 text-sm" />
                        Response time
                      </p>
                      <p className="mt-0.5 text-[13px] text-zinc-400">
                        We typically reply within 1-2 business days.
                      </p>
                    </div>
                  </div>

                  <div className="surface rounded-2xl p-5">
                    <p className="text-sm font-semibold text-zinc-100">Community channels</p>
                    <p className="mt-0.5 text-[12px] text-zinc-500">Fastest answers are often in the community.</p>
                    <div className="mt-4 flex flex-wrap gap-2.5">
                      {socials.map((s) => (
                        <a
                          key={s.label}
                          href={s.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={s.label}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/5 transition-all hover:-translate-y-0.5 ${s.color} ${s.hover}`}
                        >
                          <s.Icon className="h-5 w-5" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </Reveal>

              {/* Form column */}
              <Reveal delay={1}>
                <ContactForm />
              </Reveal>
            </div>
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  );
}
