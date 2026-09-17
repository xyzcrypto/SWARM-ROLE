"use client";

import { RefreshCw, Link2, TrendingUp } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { CalcSegmented } from "@modules/tools/components/CalcField";
import {
  COMP_METRIC_LABEL,
  metricOf,
  usdCompact,
  type Comparable,
  type CompMetric,
  type CompRange,
  type CompVenue,
} from "@modules/points/lib/points";

const METRICS: { value: CompMetric; label: string }[] = [
  { value: "volume24h", label: "24h" },
  { value: "volume7d", label: "7d" },
  { value: "volume30d", label: "30d" },
  { value: "openInterest", label: "OI" },
];

export function CompsEngine({
  venues,
  target,
  metric,
  comps,
  range,
  state,
  fetchedAt,
  windows,
  onRefresh,
  onTarget,
  onMetric,
}: {
  venues: CompVenue[];
  target: CompVenue | null;
  metric: CompMetric;
  comps: Comparable[];
  range: CompRange;
  state: "loading" | "live" | "down";
  fetchedAt: number | null;
  /** Which comparison windows the upstream actually returned this time. */
  windows: Record<string, boolean>;
  onRefresh: () => void;
  onTarget: (slug: string) => void;
  onMetric: (m: CompMetric) => void;
}) {
  // Only offer a metric the data can actually answer on. Offering "OI" when
  // the upstream reported none produces an empty table and looks broken, when
  // the truth is simply that nobody publishes it.
  // ⚠️ Offer only what the upstream really returned. DefiLlama does not always
  // include the longer windows, and a metric that renders an empty table looks
  // broken when the truth is "nobody publishes that". `windows` is computed
  // server-side from the same payload, so the two cannot disagree.
  const usable = METRICS.filter((m) => windows[m.value] ?? venues.some((v) => metricOf(v, m.value) > 0));
  const unlisted = venues.filter((v) => v.fdv === null);

  return (
    <section className="surface rounded-3xl p-5 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow-glass inline-flex items-center gap-1.5 text-[11px]">
            <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.7} />
            Live comparables
          </p>
          <h2 className="mt-3 font-display text-xl font-semibold tracking-tight text-content sm:text-2xl">
            What is an <span className="text-shine">unlisted venue</span> worth?
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-content-muted">
            Every points calculator asks you to type an FDV, and that guess decides the answer. This derives it
            instead: peers that already have a token, priced against the volume they actually do.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="btn-ghost inline-flex shrink-0 items-center gap-1.5 text-xs"
          aria-label="Refresh comparables"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", state === "loading" && "animate-spin")} strokeWidth={1.7} />
          Refresh
        </button>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px]">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium",
            state === "live"
              ? "border-mint-500/30 bg-mint-500/10 text-mint-200"
              : state === "loading"
                ? "border-hairline text-content-subtle"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              state === "live" ? "bg-mint-400" : state === "loading" ? "bg-zinc-600" : "bg-rose-400"
            )}
          />
          {state === "live" ? `${venues.length} venues` : state === "loading" ? "Loading" : "Data unavailable"}
        </span>
        {state === "live" && (
          <span className="text-content-subtle">
            {venues.filter((v) => v.fdv !== null).length} with a listed token
            {unlisted.length > 0 && ` · ${unlisted.length} unlisted`}
          </span>
        )}
        {/* `fetchedAt` is null until the client has actually fetched, so this
            renders nothing on the server and cannot disagree at hydration.
            The formatter pins UTC - Vercel runs UTC and readers do not, and an
            unpinned timestamp near midnight renders a different day on each
            side of hydration (React #418, documented in CLAUDE.md). */}
        {fetchedAt !== null && (
          <span className="text-content-subtle">updated {formatDateTime(new Date(fetchedAt))}</span>
        )}
      </div>

      {state === "down" && (
        <p className="mt-5 rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm text-content-muted">
          Comparables need live market data and it is not reachable right now. The calculators below still work —
          enter an FDV by hand.
        </p>
      )}

      {venues.length > 0 && (
        <>
          {/* Target picker. A <select> rather than chips: this list is forty
              venues deep and a chip row that wraps to six lines is not a
              control, it is a wall.

              When a programme drives the target this becomes a read-only
              statement instead. Leaving an interactive select that the
              programme silently overrides is a dead control, and a dead control
              is the first thing a reader reaches for. */}
          <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-content-muted">
                Compare against
              </span>
              <select
                  value={target?.slug ?? ""}
                  onChange={(e) => onTarget(e.target.value)}
                  className="w-full rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm text-content outline-none transition-colors focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
                >
                  <option value="">Pick a venue to compare against…</option>
                  {unlisted.length > 0 && (
                    <optgroup label="No token yet">
                      {unlisted.map((v) => (
                        <option key={v.slug} value={v.slug}>
                          {v.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Already listed — for sanity-checking the method">
                    {venues
                      .filter((v) => v.fdv !== null)
                      .map((v) => (
                        <option key={v.slug} value={v.slug}>
                          {v.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
            </label>
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-content-muted">
                Compare on
              </span>
              {usable.length > 0 && <CalcSegmented options={usable} value={metric} onChange={onMetric} />}
            </div>
          </div>

          {/* A venue that already has a token is a TEST of the method, not a
              use of it - so say what the method gets wrong on it. This is the
              single most useful thing on the page for deciding whether to
              trust the number below. */}
          {target?.fdv != null && range.median > 0 && (
            <p className="mt-4 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] px-4 py-3 text-xs leading-relaxed text-sky-200">
              {target.name} already trades at{" "}
              <span className="mono font-semibold">{usdCompact(target.fdv)}</span>. On {COMP_METRIC_LABEL[metric]},
              its peers imply <span className="mono font-semibold">{usdCompact(range.median)}</span> — off by{" "}
              <span className="mono font-semibold">
                {(((range.median - target.fdv) / target.fdv) * 100).toFixed(0)}%
              </span>
              . That gap is how wrong this method is on a venue where the answer is known.
            </p>
          )}

          {!target && (
            <p className="mt-4 rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm leading-relaxed text-content-muted">
              Pick a venue above to build a comparable set.
            </p>
          )}

          {range.count > 0 && <RangeBar range={range} metric={metric} />}
          {/* Only a real target with no usable peers is a "try another window"
              situation. With no target at all the note above already explains
              why, and showing both reads as two different failures. */}
          {target && range.count === 0 && (
            <p className="mt-6 rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm text-content-muted">
              No peer with both a token and {COMP_METRIC_LABEL[metric]} data to compare against. Try another
              window.
            </p>
          )}

          {comps.length > 0 && <CompsTable comps={comps} target={target} metric={metric} />}
        </>
      )}
    </section>
  );
}

/**
 * The estimate as a RANGE, because that is what it is.
 *
 * A single "implied FDV: $3.4B" invites someone to plan around $3.4B. Drawing
 * the spread makes the width of the disagreement the first thing you see, and
 * the width is usually the finding.
 */
function RangeBar({ range, metric }: { range: CompRange; metric: CompMetric }) {
  const span = range.high - range.low;
  const pos = span > 0 ? ((range.median - range.low) / span) * 100 : 50;
  return (
    <div className="mt-6 rounded-2xl border border-hairline bg-surface-2 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs text-content-subtle">
            Implied FDV from {range.count} peer{range.count === 1 ? "" : "s"} on {COMP_METRIC_LABEL[metric]}
          </p>
          <p className="mt-1.5 mono text-3xl font-semibold sm:text-4xl">
            <span className="text-gold-gradient">{usdCompact(range.median)}</span>
          </p>
          <p className="mt-1 text-[11px] text-content-subtle">median of the peer set</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="relative h-1.5 rounded-full bg-white/10">
          <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-gradient-to-r from-gold-800/40 via-gold-500/50 to-gold-800/40" />
          <div
            className="absolute -top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-ink-950 bg-gold-300 shadow-gold"
            style={{ left: `${Math.min(100, Math.max(0, pos))}%` }}
          />
        </div>
        <div className="mt-2.5 flex justify-between text-[11px]">
          <span className="mono text-content-muted">{usdCompact(range.low)}</span>
          <span className="text-content-subtle">spread {span > 0 ? `${(range.high / range.low).toFixed(1)}x` : "—"}</span>
          <span className="mono text-content-muted">{usdCompact(range.high)}</span>
        </div>
      </div>
    </div>
  );
}

function CompsTable({
  comps,
  target,
  metric,
}: {
  comps: Comparable[];
  target: CompVenue | null;
  metric: CompMetric;
}) {
  return (
    <div className="mt-6">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-subtle">
        Peer by peer
      </p>
      {/* Only the table scrolls sideways, never the page. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full text-sm md:min-w-[640px]">
          <thead>
            <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-content-subtle">
              <th className="py-2 pr-3 font-medium">Peer</th>
              <th className="py-2 pr-3 text-right font-medium">Their {COMP_METRIC_LABEL[metric]}</th>
              <th className="hidden py-2 pr-3 text-right font-medium sm:table-cell">vs you</th>
              <th className="py-2 pr-3 text-right font-medium">Their FDV</th>
              <th className="py-2 text-right font-medium">Implies</th>
            </tr>
          </thead>
          <tbody>
            {comps.map((c) => (
              <tr key={c.peer.slug} className="border-b border-hairline last:border-0">
                <td className="py-2.5 pr-3">
                  <span className="flex items-center gap-2">
                    {c.peer.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.peer.logo}
                        alt=""
                        width={18}
                        height={18}
                        className="h-[18px] w-[18px] shrink-0 rounded-full"
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
                      />
                    )}
                    <span className="truncate text-content">{c.peer.name}</span>
                  </span>
                </td>
                <td className="mono py-2.5 pr-3 text-right text-content-muted">
                  {usdCompact(metricOf(c.peer, metric))}
                </td>
                <td className="mono hidden py-2.5 pr-3 text-right text-content-subtle sm:table-cell">
                  {c.ratio.toFixed(2)}x
                </td>
                <td className="mono py-2.5 pr-3 text-right text-content-muted">{usdCompact(c.peer.fdv ?? 0)}</td>
                <td className="mono py-2.5 text-right font-semibold text-gold-200">{usdCompact(c.impliedFdv)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-content-subtle">
        Implied FDV = peer FDV x ({target?.name ?? "your venue"}&apos;s {COMP_METRIC_LABEL[metric]} ÷ theirs). It
        assumes the market would price the same volume the same way, which it demonstrably does not — the spread
        above is that assumption failing, measured.
      </p>
    </div>
  );
}
