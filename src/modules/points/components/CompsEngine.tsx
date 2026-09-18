"use client";

import { RefreshCw, Link2, TrendingUp } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { CalcSegmented } from "@modules/tools/components/CalcField";
import { LiveChip, PointsPanel } from "./PointsPanel";
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
  requestedMetric,
  comps,
  range,
  state,
  fetchedAt,
  windows,
  diag,
  onRefresh,
  onTarget,
  onMetric,
  allComps = [],
  excluded = [],
  onTogglePeer,
  manualVolume = "",
  onManualVolume,
}: {
  venues: CompVenue[];
  target: CompVenue | null;
  /** The window actually used, which may be wider than the one asked for when
   *  this target has no history on that one. */
  metric: CompMetric;
  /** The window the reader selected. Equal to `metric` unless it was widened. */
  requestedMetric?: CompMetric;
  comps: Comparable[];
  range: CompRange;
  state: "loading" | "live" | "down";
  fetchedAt: number | null;
  /** Which comparison windows the upstream actually returned this time. */
  windows: Record<string, boolean>;
  /** Stage counts from the route, shown only when there is nothing to show.
   *  A failure a reader can describe is a failure someone can fix. */
  diag: {
    protocols: number;
    afterFilter: number;
    pricedTokens: number;
    matched: number;
    /** Which upstream produced the venue list: "llama", a fallback, or "none". */
    source?: string;
    upstream: string | null;
  } | null;
  onRefresh: () => void;
  onTarget: (slug: string) => void;
  onMetric: (m: CompMetric) => void;
  /**
   * Peer slugs the reader switched off.
   *
   * A comparable set is a JUDGEMENT, not a fact. Whether Hyperliquid is a fair
   * analogue for a venue doing a thousandth of its volume is exactly the thing
   * an experienced farmer disagrees about, and a panel that will not let them
   * disagree is asking to be ignored. Excluding a peer removes it from the
   * median, and the count says how many are left so nobody ends up reading a
   * "range" built from one survivor.
   */
  excluded?: string[];
  /** Every peer, including switched-off ones, so an exclusion is reversible.
   *  Hiding an excluded peer would make the control a one-way door. */
  allComps?: Comparable[];
  onTogglePeer?: (slug: string) => void;
  /** 24h volume the reader supplied for a venue no feed reports. */
  manualVolume?: string;
  onManualVolume?: (v: string) => void;
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

  /** Live market rows, independent of whether any peer can be matched to a token. */
  const byVolume = [...venues].sort((a, b) => b.volume24h - a.volume24h).slice(0, 8);
  const priced = venues.filter((v) => v.fdv !== null).length;

  return (
    <PointsPanel
      eyebrow="Live comparables"
      icon={TrendingUp}
      title="What is an"
      accent="unlisted venue worth?"
      description="Every points calculator asks you to type an FDV, and that guess decides the answer. This derives it instead: peers that already have a token, priced against the volume they actually do."
      actions={
        <button
          type="button"
          onClick={onRefresh}
          className="btn-ghost inline-flex shrink-0 items-center gap-1.5 text-xs"
          aria-label="Refresh comparables"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", state === "loading" && "animate-spin")} strokeWidth={1.7} />
          Refresh
        </button>
      }
      meta={
        <>
          <LiveChip state={state}>
            {state === "live" ? `${venues.length} venues` : state === "loading" ? "Loading" : "Data unavailable"}
          </LiveChip>
          {state === "live" && (
            <span className="text-content-subtle">
              {priced} with a listed token
              {venues.length - priced > 0 && ` · ${venues.length - priced} unlisted`}
            </span>
          )}
          {/* `fetchedAt` is null until the client has actually fetched, so this
              renders nothing on the server and cannot disagree at hydration.
              The formatter pins UTC - Vercel runs UTC and readers do not, and an
              unpinned timestamp near midnight renders a different day on each
              side of hydration (React #418, documented in CLAUDE.md). */}
          {fetchedAt !== null && (
            <span className="text-content-subtle">
              updated {formatDateTime(new Date(fetchedAt))} · refreshes every 5 min
            </span>
          )}
        </>
      }
    >
      {state === "down" && (
        <div className="mt-5 rounded-xl border border-hairline bg-surface-2 px-4 py-3">
          <p className="text-sm text-content-muted">
            Comparables need live market data and it is not reachable right now. The calculators below still work —
            enter an FDV by hand.
          </p>
          {diag && (
            <p className="mono mt-2 text-[11px] leading-relaxed text-content-subtle">
              source: {diag.source ?? "?"} · venues from upstream: {diag.protocols} · past the volume filter:{" "}
              {diag.afterFilter} · priced tokens: {diag.pricedTokens} · matched: {diag.matched}
              {diag.upstream ? ` · ${diag.upstream}` : ""}
            </p>
          )}
        </div>
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
                className="min-h-11 w-full rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm text-content outline-none transition-colors focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
              >
                <option value="">Pick a venue to compare against…</option>
                {unlisted.filter((v) => v.volume24h <= 0).length > 0 && (
                  <optgroup label="Tracked here — no feed data, enter volume">
                    {unlisted
                      .filter((v) => v.volume24h <= 0)
                      .map((v) => (
                        <option key={v.slug} value={v.slug}>
                          {v.name}
                        </option>
                      ))}
                  </optgroup>
                )}
                {unlisted.filter((v) => v.volume24h > 0).length > 0 && (
                  <optgroup label="No token yet">
                    {unlisted
                      .filter((v) => v.volume24h > 0)
                      .map((v) => (
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

          {/* ⚠️ The venues this page exists for - Variational, Sodex, RiseX,
              Pacifica - appear in NO market feed. They are too new. And the
              comparables engine needs the target's own volume to form a ratio,
              so the one thing a reader came to price was the one thing it could
              never price.

              There is no honest way to invent that number, so it is asked for.
              Everything downstream then runs against real peers, and the figure
              is labelled as the reader's own wherever it shows up. */}
          {target && metricOf(target, "volume24h") <= 0 && onManualVolume && (
            <div className="mt-4 rounded-xl border border-gold-500/25 bg-gold-500/[0.06] px-4 py-3.5">
              <label className="block">
                <span className="text-xs font-semibold text-gold-200">
                  No feed reports {target.name}&apos;s volume yet
                </span>
                <span className="mt-1 block text-[11px] leading-relaxed text-content-muted">
                  It is too new to be listed. Enter its 24h volume and it will be priced against the peers below,
                  the same way every listed venue is.
                </span>
                <span className="mt-2.5 flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    value={manualVolume}
                    onChange={(e) => onManualVolume(e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="e.g. 40000000"
                    className="mono min-h-11 w-full rounded-xl border border-hairline bg-surface-2 px-4 py-2.5 text-sm text-content outline-none transition-colors focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
                  />
                  <span className="shrink-0 text-xs text-content-subtle">USD / 24h</span>
                </span>
              </label>
            </div>
          )}

          {target && manualVolume && metricOf(target, "volume24h") > 0 && onManualVolume && (
            <p className="mt-4 rounded-xl border border-gold-500/25 bg-gold-500/[0.06] px-4 py-2.5 text-[11px] leading-relaxed text-gold-200">
              Using <span className="mono font-semibold">{usdCompact(metricOf(target, "volume24h"))}</span> 24h
              volume for {target.name} — <span className="font-semibold">your figure</span>, not a feed&apos;s.{" "}
              <button
                type="button"
                onClick={() => onManualVolume("")}
                className="underline underline-offset-2 hover:text-gold-100"
              >
                Clear
              </button>
            </p>
          )}

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

          {/* ⚠️ Say it out loud when the window was widened. This panel exists to
              value venues that are NEW, and a new venue has no 30-day history -
              so the honest window is often not the one selected. Silently
              swapping it would make the number depend on something invisible,
              which is how the whole section came to show nothing at all. */}
          {target && requestedMetric && requestedMetric !== metric && (
            <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-200">
              {target.name} has no {COMP_METRIC_LABEL[requestedMetric]} history yet — it is too new. Comparing on{" "}
              <span className="font-semibold">{COMP_METRIC_LABEL[metric]}</span> instead, which is the widest window
              it can actually answer on.
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

          {(comps.length > 0 || excluded.length > 0) && (
            <CompsTable
              comps={comps}
              allComps={allComps}
              excluded={excluded}
              onTogglePeer={onTogglePeer}
              target={target}
              metric={metric}
            />
          )}
        </>
      )}

      {/* ⚠️ The live market, shown whether or not a single peer could be matched
          to a token.

          Everything above depends on a peer having BOTH volume and an FDV. When
          CoinGecko returns nothing that matches, all of it collapses and the
          panel went blank while holding forty venues of live, real volume data.
          "Live" that disappears whenever the derived number cannot be computed
          is not live; it is a calculator with a status light.

          This is the floor: what is trading right now, refreshed on the same
          cycle, useful on its own. */}
      {byVolume.length > 0 && <VenueTape venues={byVolume} priced={priced} diag={diag} />}
    </PointsPanel>
  );
}

/**
 * The live tape: who is doing volume right now, and what the market pays for it.
 *
 * Sorted by 24h volume rather than by anything derived, so it says something
 * true even when every valuation is missing.
 */
function VenueTape({
  venues,
  priced,
  diag,
}: {
  venues: CompVenue[];
  priced: number;
  diag: {
    protocols: number;
    afterFilter: number;
    pricedTokens: number;
    matched: number;
    /** Which upstream produced the venue list: "llama", a fallback, or "none". */
    source?: string;
    upstream: string | null;
  } | null;
}) {
  return (
    <div className="mt-8 border-t border-hairline pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-content-subtle">The live tape</p>
        <p className="text-[11px] text-content-subtle">Top venues by 24h volume</p>
      </div>

      {/* Peer valuations can be entirely absent while volumes are perfect. Say
          which of the two is missing, here, rather than leaving a column of
          dashes to be read as zero. */}
      {priced === 0 && (
        <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-200">
          Volumes are live, but no peer could be matched to a listed token this cycle, so there is nothing to
          derive an FDV from. The venue activity below is still current.
          {diag && (
            <span className="mono mt-1.5 block text-[11px] opacity-80">
              source {diag.source ?? "?"} · venues {diag.protocols} · past filter {diag.afterFilter} · priced
              tokens {diag.pricedTokens} · matched {diag.matched}
              {diag.upstream ? ` · ${diag.upstream}` : ""}
            </span>
          )}
        </p>
      )}

      <div className="-mx-1 mt-4 overflow-x-auto px-1">
        <table className="w-full text-sm md:min-w-[560px]">
          <thead>
            <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-content-subtle">
              <th className="py-2 pr-3 font-medium">Venue</th>
              <th className="py-2 pr-3 text-right font-medium">24h volume</th>
              <th className="hidden py-2 pr-3 text-right font-medium sm:table-cell">Open interest</th>
              <th className="py-2 text-right font-medium">FDV</th>
            </tr>
          </thead>
          <tbody>
            {venues.map((v) => (
              <tr key={v.slug} className="border-b border-hairline last:border-0">
                <td className="py-2.5 pr-3">
                  <span className="flex items-center gap-2">
                    {v.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.logo}
                        alt=""
                        width={18}
                        height={18}
                        className="h-[18px] w-[18px] shrink-0 rounded-full"
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
                      />
                    )}
                    <span className="truncate text-content">{v.name}</span>
                  </span>
                </td>
                <td className="mono py-2.5 pr-3 text-right tabular-nums text-content-muted">
                  {usdCompact(v.volume24h)}
                </td>
                <td className="mono hidden py-2.5 pr-3 text-right tabular-nums text-content-subtle sm:table-cell">
                  {v.openInterest > 0 ? usdCompact(v.openInterest) : "not reported"}
                </td>
                <td className="mono py-2.5 text-right tabular-nums">
                  {v.fdv !== null ? (
                    <span className="text-content-muted">{usdCompact(v.fdv)}</span>
                  ) : (
                    <span className="text-[11px] text-gold-200">no token yet</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
  allComps,
  excluded,
  onTogglePeer,
}: {
  comps: Comparable[];
  target: CompVenue | null;
  metric: CompMetric;
  /** Every peer including the switched-off ones, so they stay visible and can
   *  be switched back on. Hiding an excluded peer would make the control a
   *  one-way door. */
  allComps: Comparable[];
  excluded: string[];
  onTogglePeer?: (slug: string) => void;
  /** 24h volume the reader supplied for a venue no feed reports. */
  manualVolume?: string;
  onManualVolume?: (v: string) => void;
}) {
  const off = new Set(excluded);
  const rows = onTogglePeer ? allComps : comps;
  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-content-subtle">Peer by peer</p>
        {onTogglePeer && (
          <p className="text-[11px] text-content-subtle">
            Tap a peer to drop it from the median
            {off.size > 0 && <span className="text-gold-200"> · {off.size} excluded</span>}
          </p>
        )}
      </div>
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
            {rows.map((c) => (
              <tr
                key={c.peer.slug}
                onClick={onTogglePeer ? () => onTogglePeer(c.peer.slug) : undefined}
                aria-hidden={false}
                className={cn(
                  "border-b border-hairline last:border-0",
                  onTogglePeer && "cursor-pointer transition-opacity hover:bg-white/[0.02]",
                  off.has(c.peer.slug) && "opacity-40"
                )}
              >
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
                    <span
                      className={cn(
                        "truncate text-content",
                        off.has(c.peer.slug) && "line-through decoration-content-subtle"
                      )}
                    >
                      {c.peer.name}
                    </span>
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
