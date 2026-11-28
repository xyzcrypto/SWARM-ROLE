"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BadgeCheck, Clock, Download, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { burstConfetti, utcDate, rise } from "./ui";
import { sfx } from "../client/audio";
import { ShareSheet } from "./ShareSheet";

type Cert = {
  code: string;
  kind: string;
  title: string;
  displayName: string;
  rank: number;
  score: number;
  status: string;
  issuedAt: string;
  line: string;
  username: string | null;
};
type Issuer = { name: string; unit: string; signatory: string; contact: string; site: string };

/**
 * The certificate as a page: same layout as the PDF, scaled for any screen.
 * Colours come from --cert-* variables (academy.css): black and gold on the
 * dark theme, ivory paper with ink and gold foil on the light theme, so it
 * reads like a real certificate either way.
 */
export function CertificateCard({ cert, issuer, url, qr }: { cert: Cert; issuer: Issuer; url: string; qr: string }) {
  return (
    <div className="acad-cert relative aspect-[842/595] w-full overflow-hidden rounded-2xl text-center [container-type:inline-size]">
      {/* guilloche + foil glow */}
      <div className="acad-cert-guilloche pointer-events-none absolute inset-0" aria-hidden />
      <div className="acad-cert-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="acad-cert-frame absolute inset-[2.4%] rounded-lg" aria-hidden />
      <div className="acad-cert-frame-inner absolute inset-[3.5%] rounded" aria-hidden />
      {[
        "left-[4.4%] top-[6.2%] border-l-2 border-t-2",
        "right-[4.4%] top-[6.2%] border-r-2 border-t-2",
        "left-[4.4%] bottom-[6.2%] border-l-2 border-b-2",
        "right-[4.4%] bottom-[6.2%] border-r-2 border-b-2",
      ].map((c) => (
        <span key={c} className={cn("acad-cert-corner absolute h-[6%] w-[4.2%]", c)} aria-hidden />
      ))}
      <div className="relative flex h-full flex-col items-center px-[9%] pt-[5%]">
        <div className="flex items-center gap-[1cqw]">
          <span className="acad-cert-rule h-px w-[7cqw]" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-192.webp" alt="XYZ Crypto" width={96} height={96} className="h-[7cqw] w-auto drop-shadow-[0_0.4cqw_1cqw_rgba(176,120,22,0.45)]" />
          <span className="acad-cert-rule h-px w-[7cqw]" aria-hidden />
        </div>
        <div className="acad-cert-gold mt-[0.8cqw] text-[1.15cqw] font-bold tracking-[0.42em]">XYZ CRYPTO ACADEMY</div>
        <div className="mt-[1.9cqw] font-serif text-[3.7cqw] font-bold tracking-[0.06em]">
          <span className="acad-cert-foil">CERTIFICATE OF ACHIEVEMENT</span>
        </div>
        <div className="acad-cert-rule mt-[0.9cqw] h-[0.18cqw] w-[20%]" aria-hidden />
        <div className="acad-cert-muted mt-[2cqw] text-[1.45cqw] italic">This is proudly presented to</div>
        <div className="acad-cert-ink mt-[0.5cqw] max-w-full truncate font-serif text-[5.6cqw] font-bold italic leading-tight">{cert.displayName}</div>
        <div className="acad-cert-rule mt-[0.3cqw] h-px w-[50%] opacity-70" aria-hidden />
        <div className="acad-cert-muted mt-[1.6cqw] text-[1.45cqw]">for earning the title of</div>
        <div className="mt-[0.7cqw] font-serif text-[3.2cqw] font-bold uppercase tracking-[0.05em]">
          <span className="acad-cert-foil">{cert.title}</span>
        </div>
        <div className="acad-cert-ink mt-[0.8cqw] text-[1.45cqw] font-medium">{cert.line}</div>
        <div className="acad-cert-muted mt-[0.5cqw] font-mono text-[1.25cqw]">
          FINAL RANK #{cert.rank} &nbsp;·&nbsp; SCORE {cert.score.toLocaleString("en-US")}
        </div>

        {/* wax seal */}
        <div className="acad-cert-seal absolute bottom-[8%] right-[20.5%] grid h-[10cqw] w-[10cqw] place-items-center rounded-full" aria-hidden>
          <div className="grid h-[7.6cqw] w-[7.6cqw] place-items-center rounded-full border border-dashed border-white/40 text-center">
            <div className="text-[0.85cqw] font-black leading-tight tracking-[0.16em] text-white">
              VERIFIED
              <br />
              <span className="text-[1.6cqw]">★</span>
              <br />
              XYZ
            </div>
          </div>
        </div>

        <div className="absolute inset-x-[9.5%] bottom-[7%] flex items-end justify-between text-left">
          <div>
            <div className="acad-cert-gold text-[0.95cqw] font-bold tracking-[0.2em]">ISSUED</div>
            <div className="acad-cert-ink text-[1.45cqw]">{utcDate(cert.issuedAt)}</div>
            <div className="acad-cert-gold mt-[0.9cqw] text-[0.95cqw] font-bold tracking-[0.2em]">CERTIFICATE ID</div>
            <div className="acad-cert-ink font-mono text-[1.45cqw]">{cert.code}</div>
          </div>
          <div className="text-center">
            <div className="acad-cert-ink font-serif text-[2.1cqw] italic leading-none [font-family:'Brush_Script_MT','Segoe_Script',cursive]">{issuer.signatory}</div>
            <div className="acad-cert-rule mx-auto mt-[0.5cqw] h-px w-[22cqw]" />
            <div className="acad-cert-ink mt-[0.5cqw] font-serif text-[1.45cqw] font-bold">{issuer.signatory}</div>
            <div className="acad-cert-muted text-[1cqw]">
              {issuer.name} · {issuer.site}
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="acad-cert-qr h-[9.3cqw] w-[9.3cqw] rounded p-[0.4cqw] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} aria-label={`QR code linking to ${url}`} role="img" />
            <div className="acad-cert-muted mt-[0.5cqw] text-[0.9cqw]">Scan to verify</div>
          </div>
        </div>
        {cert.status !== "issued" && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="-rotate-12 rounded-xl border-4 border-red-500/80 px-[3cqw] py-[1cqw] text-[6cqw] font-black tracking-widest text-red-500/80">{cert.status === "revoked" ? "REVOKED" : "PENDING"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function CertificateView({ cert, issuer, url, qr }: { cert: Cert; issuer: Issuer; url: string; qr: string }) {
  const valid = cert.status === "issued";
  const card = useRef<HTMLDivElement>(null);
  // The reveal itself is CSS (it plays even if JS never runs). JS only adds
  // the seal's thud and, the first time this device opens this certificate,
  // confetti, timed to the stamp.
  useEffect(() => {
    if (!valid || document.documentElement.classList.contains("motion-off")) return;
    const key = `xyz:academy:cert-seen:${cert.code}`;
    let first = false;
    try {
      first = !localStorage.getItem(key);
      localStorage.setItem(key, "1");
    } catch {
      /* no storage: treat as seen */
    }
    const id = setTimeout(() => {
      sfx("stinger");
      if (first) burstConfetti(undefined, 90);
    }, 1150);
    return () => clearTimeout(id);
  }, [valid, cert.code]);
  const onMove = (e: React.PointerEvent) => {
    const el = card.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
  };
  const onLeave = () => {
    card.current?.style.setProperty("--rx", "0deg");
    card.current?.style.setProperty("--ry", "0deg");
  };
  return (
    <div className="mx-auto max-w-5xl">
      <motion.div
        style={rise({ y: 10 })}
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3",
          valid ? "border-mint-400/40 bg-mint-400/[0.06]" : cert.status === "pending" ? "border-gold-400/40 bg-gold-400/[0.06]" : "border-red-400/40 bg-red-400/[0.06]"
        )}
      >
        {valid ? <BadgeCheck className="h-6 w-6 text-mint-600 dark:text-mint-300" /> : cert.status === "pending" ? <Clock className="h-6 w-6 text-gold-600 dark:text-gold-300" /> : <ShieldAlert className="h-6 w-6 text-red-500 dark:text-red-300" />}
        <div className="min-w-0 flex-1">
          <div className={cn("font-semibold", valid ? "text-mint-700 dark:text-mint-200" : cert.status === "pending" ? "text-gold-700 dark:text-gold-200" : "text-red-600 dark:text-red-200")}>
            {valid ? "Verified certificate" : cert.status === "pending" ? "Awaiting approval" : "This certificate has been revoked"}
          </div>
          <div className="text-xs text-content-muted">
            {valid ? `Issued by ${issuer.unit} on ${utcDate(cert.issuedAt)}. ID ${cert.code}.` : cert.status === "pending" ? "Recorded, not yet approved by an XYZ Crypto administrator." : `ID ${cert.code} is no longer valid.`}
          </div>
        </div>
      </motion.div>

      <div className="acad-cert-stage acad-cert-reveal mt-6" onPointerMove={onMove} onPointerLeave={onLeave}>
        <div ref={card} className="acad-cert-tilt relative">
          <CertificateCard cert={cert} issuer={issuer} url={url} qr={qr} />
          <span className="acad-cert-sweep pointer-events-none absolute inset-0 rounded-2xl" aria-hidden />
          {valid && <span className="acad-cert-sheen pointer-events-none absolute inset-0 rounded-2xl" aria-hidden />}
        </div>
      </div>

      {valid && (
        <div className="mt-6 rounded-2xl border border-hairline bg-white/[0.02] p-4">
          <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-content-subtle">Share your certificate</div>
          <ShareSheet url={url} image={`/academy/certificate/${cert.code}/opengraph-image`} text={`I earned "${cert.title}" on XYZ Crypto Academy. Verify it here:`} fileName={`xyz-certificate-${cert.code}.png`} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2.5">
        <a href={`/api/academy/certificates/${cert.code}/pdf`} className="btn-gold h-11 px-5 text-sm" download>
          <Download className="h-4 w-4" /> Download PDF
        </a>
        <Link href="/academy" className="btn-ghost h-11 px-5 text-sm">
          XYZ Crypto Academy
        </Link>
      </div>

      <dl className="mt-8 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Awarded to", cert.username ? <Link key="u" href={`/u/${cert.username}`} className="text-gold-200 hover:underline">{cert.displayName}</Link> : cert.displayName],
          ["Achievement", cert.title],
          ["Final rank / score", `#${cert.rank} / ${cert.score.toLocaleString("en-US")}`],
          ["Issuer", `${issuer.unit} (${issuer.contact})`],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-2xl border border-hairline p-4">
            <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-content-subtle">{k}</dt>
            <dd className="mt-1 text-content">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
