"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink, RefreshCw, Rss } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { wakeIsDue } from "@/lib/useLiveData";
import type { RadarItem } from "@modules/points/lib/airdrop-radar";
import { LiveChip, PointsPanel } from "./PointsPanel";

/** The radar route's own window. Refetching sooner returns the same body. */
const RADAR_WINDOW_MS = 120_000;
const STORE_KEY = "xyz.points.radar.open";

/**
 * The second lane of the airdrop desk: what the outlets are reporting.
 *
 * The desk's own posts are the team's word and sit at the top of the page. This
 * sits at the bottom, because it is the wider, noisier, less authoritative lane
 * and a reader should meet the curated thing first. Every row names its source
 * and links out, so the reader can tell whose claim they are reading - which is
 * the whole difference between a feed and a rumour mill.
 *
 * Collapsible, and the choice is remembered. A reader who does not want a news
 * column should not have to scroll past one every visit.
 */
export function AirdropRadar() {
  const [items, setItems] = useState<RadarItem[]>([]);
  const [state, setState] = useState<"loading" | "live" | "down">("loading");
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [open, setOpen] = useState(true);
  const [venue, setVenue] = useState<string>("");
  const fetchedAtRef = useRef(0);

  // ⚠️ Restored in an effect, never read during render. A value from
  // localStorage reaching the DOM on the first render is the React #418
  // hydration trap documented in CLAUDE.md.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw !== null) setOpen(raw === "1");
    } catch {
      // Private window or blocked storage: open is a fine default.
    }
  }, []);

  const toggle = useCallback(() => {
    setOpen((v) => {
      try {
        localStorage.setItem(STORE_KEY, v ? "0" : "1");
      } catch {
        // Never let a storage failure break the control.
      }
      return !v;
    });
  }, []);

  const load = useCallback(async () => {
    setState((s) => (s === "live" ? s : "loading"));
    try {
      const res = await fetch("/api/points/radar", { cache: "no-store" });
      const j = await res.json();
      if (res.ok && Array.isArray(j.items)) {
        setItems(j.items);
        setState("live");
        setFetchedAt(Date.now());
        fetchedAtRef.current = Date.now();
      } else {
        setState("down");
      }
    } catch {
      setState("down");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // No interval: this route inherits a 120s window from the shared news cache,
  // and a poll under that is an expensive shape for a news column. Wake is
  // where staleness actually matters - you come back to the tab and want today.
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === "hidden") return;
      if (wakeIsDue(Date.now(), fetchedAtRef.current, RADAR_WINDOW_MS)) void load();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [load]);

  /** Venues actually present in this batch, so a chip never filters to nothing. */
  const venueChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) for (const v of i.venues) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [items]);

  const shown = venue ? items.filter((i) => i.venues.includes(venue)) : items;

  return (
    <PointsPanel
      id="points-radar"
      eyebrow="Trusted sources"
      icon={Rss}
      title="What the desk is"
      accent="reading"
      description="Airdrop, points and perp DEX stories picked up automatically from the outlets this site already follows. The desk's own posts are at the top of the page; these are other people's reporting, each one credited and linked."
      actions={
        <>
          <button
            type="button"
            onClick={() => void load()}
            className="btn-ghost inline-flex shrink-0 items-center gap-1.5 text-xs"
            aria-label="Refresh the radar"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", state === "loading" && "animate-spin")} strokeWidth={1.7} />
            Refresh
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls="points-radar-list"
            className="btn-ghost inline-flex shrink-0 items-center gap-1.5 text-xs"
          >
            {open ? "Hide" : "Show"}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} strokeWidth={1.7} />
          </button>
        </>
      }
      meta={
        <>
          <LiveChip state={state}>
            {state === "live" ? `${items.length} stories` : state === "loading" ? "Loading" : "Feed unreachable"}
          </LiveChip>
          {/* Null until the client has fetched, so nothing renders on the server
              and hydration cannot disagree. UTC-pinned formatter. */}
          {fetchedAt !== null && (
            <span className="text-content-subtle">updated {formatDateTime(new Date(fetchedAt))}</span>
          )}
        </>
      }
    >
      <div
        id="points-radar-list"
        className={cn(
          "grid transition-all duration-300",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        {/* The collapsing trick needs a min-h-0 overflow-hidden child, or the
            content sets the row height and nothing animates. */}
        <div className="min-h-0 overflow-hidden">
          {venueChips.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              <Chip active={venue === ""} onClick={() => setVenue("")}>
                All
              </Chip>
              {venueChips.map(([name, n]) => (
                <Chip key={name} active={venue === name} onClick={() => setVenue(venue === name ? "" : name)}>
                  {name} <span className="mono opacity-60">{n}</span>
                </Chip>
              ))}
            </div>
          )}

          <div className="mt-4 space-y-2.5">
            {state === "live" && shown.length === 0 && (
              <p className="rounded-xl border border-hairline bg-surface-2 px-4 py-6 text-center text-sm text-content-muted">
                {venue
                  ? `Nothing about ${venue} in this batch.`
                  : "No airdrop or perp DEX stories in the current window. The desk's own updates are at the top of the page."}
              </p>
            )}

            {state === "down" && (
              <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-4 text-sm leading-relaxed text-amber-200">
                The source feed is not reachable right now. Everything else on this page still works.
              </p>
            )}

            {shown.map((i) => (
              <a
                key={i.id}
                href={i.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-2xl border border-hairline bg-surface-2 p-4 transition-colors hover:border-gold-500/25 active:border-gold-500/25"
              >
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="inline-flex items-center gap-1.5 font-medium text-content-muted">
                    {i.sourceIcon && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={i.sourceIcon}
                        alt=""
                        width={14}
                        height={14}
                        className="h-3.5 w-3.5 rounded-sm"
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
                      />
                    )}
                    {i.source}
                  </span>
                  <span className="rounded-full border border-hairline px-2 py-0.5 font-medium text-content-subtle">
                    {i.category}
                  </span>
                  {i.venues.slice(0, 3).map((v) => (
                    <span
                      key={v}
                      className="rounded-full border border-gold-500/30 bg-gold-500/10 px-2 py-0.5 font-medium text-gold-200"
                    >
                      {v}
                    </span>
                  ))}
                  <span className="ml-auto text-content-subtle">{formatDateTime(new Date(i.publishedAt))}</span>
                </div>
                <h3 className="mt-2 text-sm font-semibold leading-snug text-content transition-colors group-hover:text-gold-100">
                  {i.title}
                </h3>
                {i.summary && (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-content-muted">{i.summary}</p>
                )}
                <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium text-content-subtle">
                  Read at {i.source} <ExternalLink className="h-3 w-3" strokeWidth={1.7} />
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </PointsPanel>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-9 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-medium transition-colors",
        active
          ? "border-gold-500/40 bg-gold-500/15 text-gold-200"
          : "border-hairline text-content-muted hover:text-content active:text-content"
      )}
    >
      {children}
    </button>
  );
}
