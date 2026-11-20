"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BadgeCheck, Clock, Copy, Download, ShieldAlert, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { shareOnX, utcDate } from "./ui";

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

/** The certificate as a page: same layout as the PDF, scaled for any screen. */
export function CertificateCard({ cert, issuer, url, qr }: { cert: Cert; issuer: Issuer; url: string; qr: string }) {
  return (
    <div className="relative aspect-[842/595] w-full overflow-hidden rounded-2xl bg-[#08080a] text-center shadow-[0_40px_120px_-40px_rgba(226,167,47,0.45)] [container-type:inline-size]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-gold-500/10 to-transparent" />
      <div className="absolute inset-[2.6%] rounded-lg border border-gold-400/80" />
      <div className="absolute inset-[3.6%] rounded border border-gold-400/35" />
      {[
        "left-[4.5%] top-[6.4%] border-l border-t",
        "right-[4.5%] top-[6.4%] border-r border-t",
        "left-[4.5%] bottom-[6.4%] border-l border-b",
        "right-[4.5%] bottom-[6.4%] border-r border-b",
      ].map((c) => (
        <span key={c} className={cn("absolute h-[5.7%] w-[4%] border-gold-200", c)} />
      ))}
      <div className="relative flex h-full flex-col items-center px-[9%] pt-[5.5%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="XYZ Crypto" className="h-[7.7cqw] w-auto" />
        <div className="mt-[0.6cqw] text-[1.2cqw] font-bold tracking-[0.3em] text-gold-400">XYZ CRYPTO ACADEMY</div>
        <div className="mt-[2.4cqw] font-serif text-[3.6cqw] font-bold tracking-wide text-gold-200">CERTIFICATE OF ACHIEVEMENT</div>
        <div className="mt-[0.9cqw] h-px w-[17%] bg-gold-400" />
        <div className="mt-[2.2cqw] text-[1.45cqw] text-zinc-400">This certifies that</div>
        <div className="mt-[0.6cqw] max-w-full truncate font-serif text-[5.4cqw] font-bold italic leading-tight text-white">{cert.displayName}</div>
        <div className="mt-[0.4cqw] h-px w-[48%] bg-gold-400/60" />
        <div className="mt-[1.8cqw] text-[1.45cqw] text-zinc-400">has been awarded the title of</div>
        <div className="mt-[0.9cqw] font-serif text-[3.1cqw] font-bold uppercase tracking-wide text-gold-200">{cert.title}</div>
        <div className="mt-[0.9cqw] text-[1.4cqw] text-zinc-100">{cert.line}</div>
        <div className="mt-[0.6cqw] text-[1.3cqw] text-zinc-400">
          Final rank: #{cert.rank} &nbsp;&nbsp; Score: {cert.score.toLocaleString("en-US")}
        </div>
        <div className="absolute inset-x-[9.5%] bottom-[7%] flex items-end justify-between text-left">
          <div>
            <div className="text-[0.95cqw] font-bold tracking-[0.2em] text-gold-400">ISSUED</div>
            <div className="text-[1.45cqw] text-white">{utcDate(cert.issuedAt)}</div>
            <div className="mt-[0.9cqw] text-[0.95cqw] font-bold tracking-[0.2em] text-gold-400">CERTIFICATE ID</div>
            <div className="font-mono text-[1.45cqw] text-white">{cert.code}</div>
          </div>
          <div className="text-center">
            <div className="mx-auto h-px w-[22cqw] bg-gold-400" />
            <div className="mt-[0.6cqw] font-serif text-[1.6cqw] font-bold italic text-white">{issuer.signatory}</div>
            <div className="text-[1cqw] text-zinc-400">
              Issued by {issuer.name} · {issuer.site}
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="h-[9.3cqw] w-[9.3cqw] rounded bg-transparent [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} aria-label={`QR code linking to ${url}`} role="img" />
            <div className="mt-[0.5cqw] text-[0.9cqw] text-zinc-400">Scan to verify</div>
          </div>
        </div>
        {cert.status !== "issued" && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="-rotate-12 rounded-xl border-4 border-red-400/80 px-[3cqw] py-[1cqw] text-[6cqw] font-black tracking-widest text-red-400/80">{cert.status === "revoked" ? "REVOKED" : "PENDING"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function CertificateView({ cert, issuer, url, qr }: { cert: Cert; issuer: Issuer; url: string; qr: string }) {
  const [copied, setCopied] = useState(false);
  const valid = cert.status === "issued";
  return (
    <div className="mx-auto max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3",
          valid ? "border-mint-400/40 bg-mint-400/[0.06]" : cert.status === "pending" ? "border-gold-400/40 bg-gold-400/[0.06]" : "border-red-400/40 bg-red-400/[0.06]"
        )}
      >
        {valid ? <BadgeCheck className="h-6 w-6 text-mint-300" /> : cert.status === "pending" ? <Clock className="h-6 w-6 text-gold-300" /> : <ShieldAlert className="h-6 w-6 text-red-300" />}
        <div className="min-w-0 flex-1">
          <div className={cn("font-semibold", valid ? "text-mint-200" : cert.status === "pending" ? "text-gold-200" : "text-red-200")}>
            {valid ? "Verified certificate" : cert.status === "pending" ? "Awaiting approval" : "This certificate has been revoked"}
          </div>
          <div className="text-xs text-content-muted">
            {valid ? `Issued by ${issuer.unit} on ${utcDate(cert.issuedAt)}. ID ${cert.code}.` : cert.status === "pending" ? "Recorded, not yet approved by an XYZ Crypto administrator." : `ID ${cert.code} is no longer valid.`}
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="mt-6">
        <CertificateCard cert={cert} issuer={issuer} url={url} qr={qr} />
      </motion.div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <a href={`/api/academy/certificates/${cert.code}/pdf`} className="btn-gold h-11 px-5 text-sm" download>
          <Download className="h-4 w-4" /> Download PDF
        </a>
        <button type="button" onClick={() => shareOnX(`I earned "${cert.title}" on XYZ Crypto Academy. Verify it here:`, url)} className="btn-secondary h-11 px-5 text-sm" disabled={!valid}>
          <Share2 className="h-4 w-4" /> Share on X
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard blocked */
            }
          }}
          className="btn-secondary h-11 px-5 text-sm"
        >
          <Copy className="h-4 w-4" /> {copied ? "Link copied" : "Copy link"}
        </button>
        <Link href="/academy" className="btn-ghost h-11 px-5 text-sm">
          XYZ Crypto Academy
        </Link>
      </div>

      <dl className="mt-8 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Awarded to", cert.username ? <Link key="u" href={`/u/${cert.username}`} className="text-gold-200 hover:underline">{cert.displayName}</Link> : cert.displayName],
          ["Achievement", cert.title],
          ["Final rank / score", `#${cert.rank} / ${cert.score.toLocaleString("en-US")}`],
          ["Issuer", `${issuer.unit} (${issuer.contact})`],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-2xl border border-hairline p-4">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">{k}</dt>
            <dd className="mt-1 text-content">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
