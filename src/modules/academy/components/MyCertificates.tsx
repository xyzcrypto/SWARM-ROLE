"use client";

import Link from "next/link";
import { Award, CalendarDays, Crown, Download, LogIn, Radio, Trophy } from "lucide-react";
import { useMe } from "../client/hooks";
import { Empty, Panel, SectionTitle, Skeleton, utcDate } from "./ui";

const KIND_ICON: Record<string, typeof Award> = { daily: CalendarDays, weekly: Trophy, monthly: Crown, live: Radio };

export function MyCertificates() {
  const { me, status } = useMe();
  const rules = me?.awards;
  return (
    <div>
      <SectionTitle
        eyebrow="Official recognition"
        title="Certificates"
        sub="Certificates go to the top of each finished leaderboard period and to live quiz winners. Each one has a unique ID, a QR code and a public verification page."
      />
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Panel>
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-content-subtle">Your certificates</div>
          {status === "unauthenticated" ? (
            <Empty>
              <Link href="/login?callbackUrl=/academy/certificates" className="btn-gold h-10 px-5 text-sm">
                <LogIn className="h-4 w-4" /> Sign in to see yours
              </Link>
            </Empty>
          ) : !me ? (
            <div className="space-y-2">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : me.certificates.length === 0 ? (
            <Empty>
              <Award className="mx-auto mb-2 h-7 w-7 text-gold-300" />
              No certificates yet. Finish at the top of a daily, weekly or monthly leaderboard, or win a live quiz.
            </Empty>
          ) : (
            <ul className="space-y-2.5">
              {me.certificates.map((c, i) => {
                const I = KIND_ICON[c.kind] ?? Award;
                return (
                  <li key={c.code} style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }} className="acad-cert-item acad-row-in relative flex flex-wrap items-center gap-3 overflow-hidden rounded-2xl border border-gold-400/30 bg-gold-400/[0.04] p-4">
                    <span className="acad-cert-medal grid h-11 w-11 place-items-center rounded-2xl text-ink-950">
                      <I className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-content">{c.title}</div>
                      <div className="text-xs text-content-subtle">
                        #{c.rank} · {c.score.toLocaleString("en-US")} · {c.status === "pending" ? "awaiting approval" : utcDate(c.issuedAt)} · <span className="font-mono">{c.code}</span>
                      </div>
                    </div>
                    <Link href={`/academy/certificate/${c.code}`} className="btn-secondary h-9 px-4 text-xs">
                      View
                    </Link>
                    <a href={`/api/academy/certificates/${c.code}/pdf`} className="btn-ghost h-9 px-3 text-xs" download aria-label="Download PDF">
                      <Download className="h-4 w-4" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel delay={0.05}>
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-content-subtle">How certificates are awarded</div>
          <ul className="space-y-3 text-sm text-content-muted">
            {(
              [
                ["daily", "Daily Quiz Champion", "the day ends at 00:00 UTC"],
                ["weekly", "Weekly Quiz Champion", "the week ends Monday 00:00 UTC"],
                ["monthly", "Monthly Web3 Champion", "the month ends"],
                ["live", "Live Quiz Winner", "the live quiz ends"],
              ] as const
            ).map(([k, title, when]) => {
              const r = rules?.[k];
              return (
                <li key={k} className="rounded-2xl border border-hairline p-3.5">
                  <div className="font-semibold text-content">{title}</div>
                  <div className="mt-0.5 text-[13px]">
                    {r ? (r.top > 0 ? `Top ${r.top}${r.minXp ? ` with at least ${r.minXp.toLocaleString("en-US")} ${k === "live" ? "points" : "XP"}` : ""}, finalized after ${when}.` : "Currently paused.") : `Finalized after ${when}.`}
                    {r && !r.auto && r.top > 0 ? " Approved by an administrator before issue." : ""}
                  </div>
                </li>
              );
            })}
            <li className="rounded-2xl border border-hairline p-3.5">
              <div className="font-semibold text-content">Special events and milestones</div>
              <div className="mt-0.5 text-[13px]">Issued by XYZ Crypto administrators for events and all-time milestones, never automatically.</div>
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
