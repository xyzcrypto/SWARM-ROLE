"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Award, CalendarDays, Crown, Gift, Radio, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { CertificateCard } from "./CertificateView";
import { SectionTitle, rise } from "./ui";

// A decorative block pattern where the real QR goes. Deliberately NOT a QR
// code: a sample must never scan to anything.
const SAMPLE_PATTERN = `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${Array.from({ length: 100 }, (_, i) => {
  const x = i % 10;
  const y = Math.floor(i / 10);
  const corner = (x < 3 && y < 3) || (x > 6 && y < 3) || (x < 3 && y > 6);
  const on = corner ? !(x % 9 === 1 && y % 9 === 1) && !(x === 8 && y === 1) : (x * 7 + y * 3 + x * y) % 5 < 2;
  return on ? `<rect x="${x}" y="${y}" width="1" height="1" fill="#f3d488" opacity="0.55"/>` : "";
}).join("")}</svg>`;

const WAYS = [
  { icon: CalendarDays, title: "Daily Quiz Champion", body: "Top the daily leaderboard. Closes at 00:00 UTC." },
  { icon: Trophy, title: "Weekly Quiz Champion", body: "Finish in the weekly top three." },
  { icon: Crown, title: "Monthly Web3 Champion", body: "Lead the month. The long game." },
  { icon: Radio, title: "Live Quiz Winner", body: "Make the podium in a live quiz." },
];

/** The certificate, shown off: tilts toward the pointer with a moving sheen. */
export function CertificateShowcase() {
  const card = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    const el = card.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 7).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`);
    el.style.setProperty("--sx", `${((x + 0.5) * 100).toFixed(1)}%`);
  };
  const onLeave = () => {
    card.current?.style.setProperty("--rx", "0deg");
    card.current?.style.setProperty("--ry", "0deg");
  };

  return (
    <section className="mt-16 sm:mt-20">
      <SectionTitle
        eyebrow="Recognition"
        title="Earn an official XYZ Crypto certificate"
        sub="Learn, play and finish on top. Winners get a certificate with a unique ID, a QR code and a public verification page, downloadable as a PDF and ready to share."
      />
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12">
        <div className="space-y-3">
          {WAYS.map((w, i) => (
            <motion.div
              key={w.title}
              style={rise({ x: -14, dur: 0.45, delay: 0.08 * i })}
              className="flex items-start gap-3 rounded-2xl border border-hairline bg-ink-900/40 p-4"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-400/15 text-gold-300">
                <w.icon className="h-5 w-5" strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <div className="font-semibold text-content">{w.title}</div>
                <div className="text-sm text-content-muted">{w.body}</div>
              </div>
            </motion.div>
          ))}
          <div className="rounded-2xl border border-dashed border-gold-400/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gold-300">
              <Gift className="h-4 w-4" /> On the roadmap
            </div>
            <p className="mt-1 text-sm leading-relaxed text-content-muted">
              Perks for certificate holders and special-event certificates with partners. They will be announced here when they go live.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/academy/certificates" className="btn-gold h-11 px-5 text-sm">
              <Award className="h-4 w-4" /> How certificates work
            </Link>
            <span className="inline-flex items-center gap-1.5 px-2 text-xs text-content-subtle">
              <ShieldCheck className="h-4 w-4 text-mint-300" /> Every certificate is publicly verifiable
            </span>
          </div>
        </div>

        <div className="acad-cert-stage" onPointerMove={onMove} onPointerLeave={onLeave}>
          <motion.div ref={card} style={rise({ y: 24, r: 1.5, dur: 0.8 })} className="acad-cert-tilt relative">
            <CertificateCard
              cert={{
                code: "XYZ-SAMP-LE00",
                kind: "weekly",
                title: "Weekly Quiz Champion",
                displayName: "Your Name Here",
                rank: 1,
                score: 4820,
                status: "issued",
                issuedAt: "2026-11-23T00:00:00.000Z",
                line: "1st place on the weekly leaderboard",
                username: null,
              }}
              issuer={{ name: "XYZ Crypto", unit: "XYZ Crypto Academy", signatory: "XYZ Crypto Academy Board", contact: "hi@xyzcrypto.io", site: "xyzcrypto.io" }}
              url="https://xyzcrypto.io/academy/certificates"
              qr={SAMPLE_PATTERN}
            />
            <span className="acad-cert-sheen pointer-events-none absolute inset-0 rounded-2xl" aria-hidden />
            <span className="pointer-events-none absolute right-4 top-4 flex items-center gap-1 rounded-full border border-gold-400/50 bg-black/60 px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-[0.2em] text-gold-200">
              <Sparkles className="h-3 w-3" /> Sample
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
