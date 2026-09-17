"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown, ExternalLink, Pin, Plus, Radio, RefreshCw } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { useRealtime } from "@/lib/useRealtime";
import { CH_POINTS } from "@/lib/realtime-channels";
import { wakeIsDue } from "@/lib/useLiveData";
import { KIND_LABEL, KIND_TONE, sortUpdates, type PointsUpdateDto } from "@modules/points/lib/points-updates";
import type { RadarItem } from "@modules/points/lib/airdrop-radar";

const RADAR_WINDOW_MS = 120_000;
const STORE_KEY = "xyz.points.wire.open";

/**
 * The wire: one live band at the top of the page, two lanes inside it.
 *
 * ## Why it is one component and not two panels
 *
 * The desk's own posts sat at the top of the page and the press feed sat at the
 * bottom, and both were full-height panels. A reader looking for "what changed
 * today" had to check two places a screen apart, and on a phone the second one
 * was past six other sections. They answer the same question, so they are one
 * band now, above everything else.
 *
 * ## The two lanes stay distinguishable
 *
 * They carry different authority and must never be confused:
 *
 * - **Desk** - written by the team. Few, exact, accountable to a person, and
 *   able to be pinned.
 * - **Press** - picked up automatically from the outlets this site follows.
 *   Many, unreviewed, and only as good as the outlet.
 *
 * Every row says which it is. A press item is never presented as the desk's own
 * word, because "we are telling you" and "someone reported" are different
 * claims and a farmer acts differently on each.
 *
 * ## Why one item is promoted
 *
 * A list of twelve equal rows has no answer to "what matters right now". The
 * top item is rendered as a banner and the rest fold behind a count, so the
 * band costs one line of attention when nothing is urgent and earns more when
 * something is.
 *
 * ## X / Twitter
 *
 * ⚠️ There is no free X API, and scraping a logged-out timeline returns
 * something different every week. Reading an outlet that quotes X and calling it
 * "from X" would be a false claim about sourcing. So X appears here the honest
 * way: when the desk posts a link to a tweet, the row is badged with its host.
 * The desk lane is where a specific tweet belongs, with a person behind it.
 */

type WireItem = {
  id: string;
  lane: "desk" | "press";
  title: string;
  body: string;
  url: string | null;
  /** Who is making the claim: the desk, or a named outlet. */
  source: string;
  sourceIcon: string | null;
  at: number;
  /** Desk kind ("snapshot", "tge", ...) or press category. */
  tag: string;
  tone: string | null;
  pinned: boolean;
  venues: string[];
};

/** Host of a URL, for badging a desk link with where it points. */
function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** X links are worth naming as X rather than as a hostname. */
function prettyHost(host: string | null): string | null {
  if (!host) return null;
  if (host === "x.com" || host === "twitter.com") return "X";
  if (host === "t.me") return "Telegram";
  return host;
}

export function LiveWire() {
  const { data: session } = useSession();
  const canManage = hasPermission(session?.user as never, "points:manage");

  const [desk, setDesk] = useState<PointsUpdateDto[]>([]);
  const [press, setPress] = useState<RadarItem[]>([]);
  const [deskState, setDeskState] = useState<"loading" | "ready" | "down">("loading");
  const [pressState, setPressState] = useState<"loading" | "ready" | "down">("loading");
  const [open, setOpen] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const pressAtRef = useRef(0);

  // ⚠️ Restored in an effect. A localStorage value reaching the DOM during the
  // first render is the React #418 trap documented in CLAUDE.md.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw !== null) setOpen(raw === "1");
    } catch {
      // Blocked storage: closed is a fine default.
    }
  }, []);

  const toggle = useCallback(() => {
    setOpen((v) => {
      try {
        localStorage.setItem(STORE_KEY, v ? "0" : "1");
      } catch {
        // Never let storage break the control.
      }
      return !v;
    });
  }, []);

  const loadDesk = useCallback(async () => {
    try {
      const res = await fetch(`/api/points/updates${canManage ? "?all=1" : ""}`, { cache: "no-store" });
      const j = await res.json();
      if (res.ok && Array.isArray(j.updates)) {
        setDesk(sortUpdates(j.updates));
        setDeskState("ready");
      } else setDeskState("down");
    } catch {
      setDeskState("down");
    }
  }, [canManage]);

  const loadPress = useCallback(async () => {
    try {
      const res = await fetch("/api/points/radar", { cache: "no-store" });
      const j = await res.json();
      if (res.ok && Array.isArray(j.items)) {
        setPress(j.items);
        setPressState("ready");
        pressAtRef.current = Date.now();
        setFetchedAt(Date.now());
      } else setPressState("down");
    } catch {
      setPressState("down");
    }
  }, []);

  useEffect(() => {
    void loadDesk();
    void loadPress();
  }, [loadDesk, loadPress]);

  // The desk lane is genuinely realtime: a post broadcasts and every open page
  // refetches. `useRealtime` carries the retry-with-backoff, the armed fallback
  // poll and the wake refetch that seven other surfaces needed and that this one
  // would otherwise get wrong the same way they did.
  useRealtime({ channel: CH_POINTS, event: "points_update", onMessage: () => void loadDesk() });

  // The press lane is a cached news read, so wake is where staleness matters -
  // you come back to the tab and want today. No interval: its route inherits a
  // 120s window from the shared news cache and a poll under that is expensive
  // for a news column.
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === "hidden") return;
      if (wakeIsDue(Date.now(), pressAtRef.current, RADAR_WINDOW_MS)) void loadPress();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [loadPress]);

  const items: WireItem[] = useMemo(() => {
    const d: WireItem[] = desk.map((u) => ({
      id: `desk-${u.id}`,
      lane: "desk",
      title: u.title,
      body: u.body,
      url: u.url ?? null,
      source: "XYZ desk",
      sourceIcon: null,
      at: new Date(u.createdAt).getTime(),
      tag: KIND_LABEL[u.kind] ?? u.kind,
      tone: KIND_TONE[u.kind] ?? null,
      pinned: Boolean(u.pinned),
      venues: u.program ? [u.program] : [],
    }));
    const p: WireItem[] = press.map((i) => ({
      id: `press-${i.id}`,
      lane: "press",
      title: i.title,
      body: i.summary,
      url: i.url,
      source: i.source,
      sourceIcon: i.sourceIcon,
      at: i.publishedAt,
      tag: i.category,
      tone: null,
      pinned: false,
      venues: i.venues,
    }));
    // A pinned desk post outranks everything: pinning is the desk saying "this
    // is the thing". After that it is simply newest first, and the desk wins a
    // tie because it is the reviewed lane.
    return [...d, ...p].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (b.at !== a.at) return b.at - a.at;
      return a.lane === "desk" ? -1 : 1;
    });
  }, [desk, press]);

  const [hot, ...rest] = items;
  const live = deskState !== "down" || pressState !== "down";

  return (
    <section aria-label="Live updates" className="relative">
      <div className="surface overflow-hidden rounded-3xl">
        {/* ── the band header ───────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline px-4 py-2.5 sm:px-5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-mint-300">
            <span className="relative flex h-1.5 w-1.5">
              {live && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-75" />
              )}
              <span
                className={cn(
                  "relative inline-flex h-1.5 w-1.5 rounded-full",
                  live ? "bg-mint-400" : "bg-rose-400"
                )}
              />
            </span>
            <Radio className="h-3.5 w-3.5" strokeWidth={1.7} />
            Live wire
          </span>
          <span className="text-[11px] text-content-subtle">Perp DEX &amp; airdrops</span>

          <div className="ml-auto flex items-center gap-1.5">
            {canManage && (
              <a
                href="#points-desk"
                className="btn-ghost inline-flex min-h-8 shrink-0 items-center gap-1.5 text-[11px]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.7} />
                Post
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                void loadDesk();
                void loadPress();
              }}
              className="btn-ghost inline-flex min-h-8 shrink-0 items-center gap-1.5 text-[11px]"
              aria-label="Refresh the wire"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  (deskState === "loading" || pressState === "loading") && "animate-spin"
                )}
                strokeWidth={1.7}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* ── the hot item, as a banner ─────────────────────────────────── */}
        {hot ? (
          <WireHero item={hot} />
        ) : (
          <p className="px-4 py-4 text-xs text-content-muted sm:px-5">
            {deskState === "loading" || pressState === "loading"
              ? "Loading the wire…"
              : "Nothing on the wire right now. Snapshots, TGE dates and new programmes land here live."}
          </p>
        )}

        {/* ── the rest, behind a count ──────────────────────────────────── */}
        {rest.length > 0 && (
          <>
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls="points-wire-more"
              className="flex min-h-11 w-full items-center gap-2 border-t border-hairline px-4 text-[11px] font-medium text-content-muted transition-colors hover:text-content sm:px-5"
            >
              {open ? "Hide" : `${rest.length} more`} related update{rest.length === 1 ? "" : "s"}
              {fetchedAt !== null && (
                <span className="text-content-subtle">· updated {formatDateTime(new Date(fetchedAt))}</span>
              )}
              <ChevronDown
                className={cn("ml-auto h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
                strokeWidth={1.7}
              />
            </button>

            {/* grid-rows 0fr -> 1fr animates a height nobody has to measure. The
                inner min-h-0 overflow-hidden child is required, or the content
                sets the row height and nothing moves. */}
            <div
              id="points-wire-more"
              className={cn(
                "grid transition-all duration-300",
                open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <ul className="divide-y divide-hairline border-t border-hairline">
                  {rest.slice(0, 12).map((i) => (
                    <li key={i.id}>
                      <WireRow item={i} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** The promoted item. Bigger type, the claim, and where it came from. */
function WireHero({ item }: { item: WireItem }) {
  const host = prettyHost(hostOf(item.url));
  const Wrapper = item.url ? "a" : "div";
  return (
    <Wrapper
      {...(item.url ? { href: item.url, target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "block px-4 py-4 sm:px-5",
        item.url && "group transition-colors hover:bg-white/[0.02]"
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        <LaneBadge item={item} />
        {item.pinned && (
          <span className="inline-flex items-center gap-1 font-medium text-gold-200">
            <Pin className="h-3 w-3" strokeWidth={1.7} /> Pinned
          </span>
        )}
        {item.venues.slice(0, 2).map((v) => (
          <span
            key={v}
            className="rounded-full border border-gold-500/30 bg-gold-500/10 px-2 py-0.5 font-medium text-gold-200"
          >
            {v}
          </span>
        ))}
        <span className="ml-auto text-content-subtle">{formatDateTime(new Date(item.at))}</span>
      </div>

      <h2
        className={cn(
          "mt-2 font-display text-base font-semibold leading-snug tracking-tight text-content sm:text-lg",
          item.url && "transition-colors group-hover:text-gold-100"
        )}
      >
        {item.title}
      </h2>
      {item.body && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-content-muted">{item.body}</p>
      )}
      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-content-subtle">
        {item.lane === "desk" ? "Posted by the XYZ desk" : `Reported by ${item.source}`}
        {host && ` · ${host}`}
        {item.url && <ExternalLink className="h-3 w-3" strokeWidth={1.7} />}
      </span>
    </Wrapper>
  );
}

/** A folded row. One line of claim, one line of provenance. */
function WireRow({ item }: { item: WireItem }) {
  const host = prettyHost(hostOf(item.url));
  const Wrapper = item.url ? "a" : "div";
  return (
    <Wrapper
      {...(item.url ? { href: item.url, target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "flex min-h-11 flex-col gap-1 px-4 py-3 sm:px-5",
        item.url && "group transition-colors hover:bg-white/[0.02]"
      )}
    >
      <span className="flex flex-wrap items-center gap-2 text-[10px]">
        <LaneBadge item={item} />
        {item.venues.slice(0, 2).map((v) => (
          <span key={v} className="rounded-full border border-hairline px-2 py-0.5 font-medium text-content-muted">
            {v}
          </span>
        ))}
        <span className="ml-auto text-content-subtle">{formatDateTime(new Date(item.at))}</span>
      </span>
      <span
        className={cn(
          "text-xs font-medium leading-snug text-content",
          item.url && "transition-colors group-hover:text-gold-100"
        )}
      >
        {item.title}
      </span>
      <span className="text-[10px] text-content-subtle">
        {item.lane === "desk" ? "XYZ desk" : item.source}
        {host && ` · ${host}`}
      </span>
    </Wrapper>
  );
}

/**
 * Which lane a row belongs to, always visible.
 *
 * The desk's word and an outlet's report are different claims. A reader acts on
 * them differently, so the distinction is never left to be inferred from the
 * wording of a headline.
 */
function LaneBadge({ item }: { item: WireItem }) {
  if (item.lane === "desk") {
    return (
      <span
        className={cn(
          "rounded-full border px-2 py-0.5 font-medium",
          item.tone ?? "border-mint-500/30 bg-mint-500/10 text-mint-200"
        )}
      >
        {item.tag}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-content-muted">
      {item.sourceIcon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.sourceIcon}
          alt=""
          width={12}
          height={12}
          className="h-3 w-3 rounded-sm"
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
        />
      )}
      {item.source}
    </span>
  );
}
