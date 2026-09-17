"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Radio, ExternalLink, Pin, Plus, Trash2, Loader2 } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { useRealtime } from "@/lib/useRealtime";
import { CH_POINTS } from "@/lib/realtime-channels";
import {
  KIND_LABEL,
  KIND_TONE,
  UPDATE_KINDS,
  UPDATE_LIMITS,
  sortUpdates,
  type PointsUpdateDto,
  type UpdateKind,
} from "@modules/points/lib/points-updates";

/**
 * The airdrop desk: staff post what is happening, readers see it live.
 *
 * The composer is INLINE rather than in the dashboard, deliberately. This is a
 * feed someone writes while they are reading the page - "Sodex snapshot is
 * tomorrow" is a thirty-second thought, and making it a trip to an admin screen
 * is how a live feed quietly stops being live.
 */
export function UpdatesFeed() {
  const { data: session } = useSession();
  const canManage = hasPermission(session?.user as never, "points:manage");

  const [updates, setUpdates] = useState<PointsUpdateDto[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "down">("loading");
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    try {
      // Staff ask for drafts too; the route ignores the flag without the
      // permission rather than 403-ing, so a stale tab degrades to the public
      // feed instead of erroring.
      const res = await fetch(`/api/points/updates${canManage ? "?all=1" : ""}`, { cache: "no-store" });
      const j = await res.json();
      if (res.ok && Array.isArray(j.updates)) {
        setUpdates(sortUpdates(j.updates));
        setState("ready");
      } else {
        setState("down");
      }
    } catch {
      setState("down");
    }
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  // The live part. `useRealtime` subscribes to the broadcast, falls back to a
  // 60s poll only while the channel is DOWN, retries with backoff, and refetches
  // on wake - all of which this surface would otherwise have to get right
  // itself, and the site has already been bitten by getting it wrong.
  useRealtime({ channel: CH_POINTS, event: "points_update", onMessage: () => void load() });

  return (
    <section className="surface rounded-3xl p-5 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow-glass inline-flex items-center gap-1.5 text-[11px]">
            <Radio className="h-3.5 w-3.5" strokeWidth={1.7} />
            Airdrop desk
          </p>
          <h2 className="mt-3 font-display text-xl font-semibold tracking-tight text-content sm:text-2xl">
            What is <span className="text-shine">happening now</span>
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-content-muted">
            Points going live, snapshots landing, TGE dates. Posted here and updated on your screen without a
            reload.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setComposing((v) => !v)}
            className="btn-secondary inline-flex shrink-0 items-center gap-1.5 text-xs"
          >
            <Plus className={cn("h-3.5 w-3.5 transition-transform", composing && "rotate-45")} strokeWidth={1.7} />
            {composing ? "Close" : "Post an update"}
          </button>
        )}
      </header>

      {canManage && composing && <Composer onPosted={() => { setComposing(false); void load(); }} />}

      <div className="mt-6 space-y-3">
        {state === "loading" && <p className="text-sm text-content-subtle">Loading…</p>}

        {/* ⚠️ "Nothing posted yet" and "we could not reach the feed" are
            DIFFERENT statements, and collapsing them is a lie in the reader's
            favour: an outage would read as a quiet desk. */}
        {state === "ready" && updates.length === 0 && (
          <p className="rounded-xl border border-hairline bg-surface-2 px-4 py-6 text-center text-sm text-content-muted">
            Nothing posted yet. When a programme opens, a snapshot lands or a TGE is announced, it shows up here.
          </p>
        )}

        {state === "down" && (
          <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-4 text-sm leading-relaxed text-amber-200">
            The updates feed is not reachable right now, so this list may be incomplete. Everything below still
            works.
          </p>
        )}

        {updates.map((u) => (
          <UpdateCard key={u.id} update={u} canManage={canManage} onChanged={load} />
        ))}
      </div>
    </section>
  );
}

function UpdateCard({
  update: u,
  canManage,
  onChanged,
}: {
  update: PointsUpdateDto;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy || !confirm("Delete this update?")) return;
    setBusy(true);
    try {
      await fetch(`/api/points/updates/${u.id}`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={cn(
        "rounded-2xl border p-4 transition-colors sm:p-5",
        u.pinned ? "border-gold-500/30 bg-gold-500/[0.05]" : "border-hairline bg-surface-2",
        !u.published && "opacity-60"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", KIND_TONE[u.kind])}>
          {KIND_LABEL[u.kind]}
        </span>
        {u.program && (
          <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] font-medium text-content-muted">
            {u.program}
          </span>
        )}
        {u.pinned && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gold-200">
            <Pin className="h-3 w-3" strokeWidth={1.7} /> Pinned
          </span>
        )}
        {!u.published && (
          <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] font-medium text-content-subtle">
            Draft
          </span>
        )}
        {/* UTC-pinned. Vercel runs UTC and readers do not, and an unpinned
            timestamp near midnight renders a different calendar day on each
            side of hydration - React #418, documented in CLAUDE.md. */}
        <span className="ml-auto text-[10px] text-content-subtle">{formatDateTime(u.createdAt)}</span>
      </div>

      <h3 className="mt-2.5 font-display text-base font-semibold text-content">{u.title}</h3>
      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-content-muted">{u.body}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {u.url && (
          <a
            href={u.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-gold-200 transition-colors hover:text-gold-100"
          >
            Open link <ExternalLink className="h-3 w-3" strokeWidth={1.7} />
          </a>
        )}
        {canManage && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs text-content-subtle transition-colors hover:text-data-down disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" strokeWidth={1.7} />}
            Delete
          </button>
        )}
      </div>
    </article>
  );
}

function Composer({ onPosted }: { onPosted: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<UpdateKind>("live");
  const [program, setProgram] = useState("");
  const [url, setUrl] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/points/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, kind, program: program || null, url: url || null, pinned }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Surface the API's own message - "Link must be a http(s) URL", "Title
        // is too short" - rather than a generic failure that tells the author
        // nothing about which field to fix.
        setError(j?.error ?? "Could not post that.");
        return;
      }
      setTitle("");
      setBody("");
      setProgram("");
      setUrl("");
      setPinned(false);
      onPosted();
    } catch {
      setError("Could not post that.");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm text-content outline-none transition-colors placeholder:text-content-subtle focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20";

  return (
    <div className="mt-5 rounded-2xl border border-gold-500/25 bg-gold-500/[0.04] p-4 sm:p-5">
      <div className="flex flex-wrap gap-1.5">
        {UPDATE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
              kind === k ? KIND_TONE[k] : "border-hairline text-content-subtle hover:text-content-muted"
            )}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <input
        className={cn(input, "mt-3")}
        placeholder="Headline — e.g. Sodex snapshot lands tomorrow"
        value={title}
        maxLength={UPDATE_LIMITS.title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className={cn(input, "mt-3 min-h-[92px] resize-y")}
        placeholder="What changed, and what a farmer should do about it."
        value={body}
        maxLength={UPDATE_LIMITS.body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          className={input}
          placeholder="Programme (optional) — e.g. Sodex"
          value={program}
          onChange={(e) => setProgram(e.target.value)}
        />
        <input
          className={input}
          placeholder="Link (optional) — https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-xs text-content-muted">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
            className="h-4 w-4 rounded border-hairline accent-gold-400"
          />
          Pin to the top
        </label>
        <button
          type="button"
          onClick={post}
          disabled={busy || title.trim().length < 3 || body.trim().length < 3}
          className="btn-gold inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {busy ? "Posting…" : "Post update"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-data-down">{error}</p>}
    </div>
  );
}
