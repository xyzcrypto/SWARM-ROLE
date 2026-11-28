"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Radio, ExternalLink, Pin, Plus, Trash2, Loader2 } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import dynamic from "next/dynamic";
import { CharCount, CoverPicker } from "@/components/ComposerKit";
import { MarkdownLite } from "@/components/MarkdownLite";
import { hasPermission } from "@/lib/permissions";
import { useRealtime } from "@/lib/useRealtime";
import { CH_POINTS } from "@/lib/realtime-channels";
import { LiveChip, PointsPanel } from "./PointsPanel";
import {
  KIND_LABEL,
  KIND_TONE,
  UPDATE_KINDS,
  UPDATE_LIMITS,
  sortUpdates,
  type PointsUpdateDto,
  type UpdateKind,
} from "@modules/points/lib/points-updates";
import { photoFallback, photoSrc } from "@shared/utils/img";

/**
 * The SAME body editor the dashboard uses, so a desk post is written the way a
 * research post is - bold, headings, lists, links - instead of into a bare
 * textarea with a markdown cheat-sheet beside it.
 *
 * ⚠️ `next/dynamic` with `ssr: false`, and that is load-bearing rather than
 * incidental. `PostContentEditor` pulls in Tiptap - the heaviest dependency on
 * this site - and `/points` is a PUBLIC page. Importing it normally would put
 * that weight on every visitor, almost none of whom can post. Behind a dynamic
 * import the chunk is only fetched when someone with `points:manage` actually
 * opens the composer, so a reader's first load is unchanged.
 */
const PostContentEditor = dynamic(
  () => import("@/components/PostContentEditor").then((m) => ({ default: m.PostContentEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="mt-3 flex min-h-[92px] items-center justify-center rounded-xl border border-hairline bg-surface-2">
        <Loader2 className="h-4 w-4 animate-spin text-content-subtle" strokeWidth={1.7} />
      </div>
    ),
  }
);

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

  const compose = canManage ? (
    <button
      type="button"
      onClick={() => setComposing((v) => !v)}
      className="btn-secondary inline-flex shrink-0 items-center gap-1.5 text-xs"
    >
      <Plus className={cn("h-3.5 w-3.5 transition-transform", composing && "rotate-45")} strokeWidth={1.7} />
      {composing ? "Close" : "Post an update"}
    </button>
  ) : null;

  /**
   * An empty desk does not deserve the top of the page.
   *
   * This panel sits first because when there IS news, news is the most important
   * thing here. When there is not, the full treatment - eyebrow, display
   * heading, description, and a bordered box announcing that nothing has
   * happened - was the largest element on the page and it said nothing. A reader
   * arriving at a calculator met an empty noticeboard first.
   *
   * So it collapses to one quiet line that still proves the desk is connected,
   * and expands into the real panel the moment a post exists. Staff keep the
   * composer either way, because the way it stops being empty is someone posting
   * from here.
   *
   * ⚠️ Only for `ready` + empty. An unreachable feed keeps its own visible
   * amber note below: "nothing posted" and "we could not reach the feed" are
   * different statements, and collapsing an outage into a quiet desk is a lie
   * in the reader's favour.
   */
  if (state === "ready" && updates.length === 0 && !composing) {
    return (
      <section id="points-desk" className="scroll-mt-28">
        <div className="glass flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-hairline px-4 py-2.5">
          <LiveChip state="live">Airdrop desk</LiveChip>
          <span className="text-xs text-content-muted">
            Quiet right now. Snapshots, TGE dates and new programmes land here live.
          </span>
          {compose && <span className="ml-auto">{compose}</span>}
        </div>
      </section>
    );
  }

  return (
    <PointsPanel
      id="points-desk"
      eyebrow="Airdrop desk"
      icon={Radio}
      title="What is"
      accent="happening now"
      description="Points going live, snapshots landing, TGE dates. Posted here and updated on your screen without a reload."
      actions={compose}
      meta={
        <>
          <LiveChip state={state === "down" ? "down" : state === "loading" ? "loading" : "live"}>
            {state === "down" ? "Feed unreachable" : state === "loading" ? "Loading" : "Live"}
          </LiveChip>
          {state === "ready" && updates.length > 0 && (
            <span className="text-content-subtle">
              {updates.length} update{updates.length === 1 ? "" : "s"}
            </span>
          )}
        </>
      }
    >
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
    </PointsPanel>
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

      {/* ⚠️ A plain <img>, not next/image, and deliberately: the file is served
          straight from Supabase Storage, so the browser fetches it directly at
          zero Vercel transfer. Routing it through the optimiser would spend both
          Fast Origin Transfer and image-optimisation quota (cost-check, trap 3).
          Lazy so a feed of updates does not fetch every cover up front. */}
      {u.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoSrc(u.image, 960) ?? u.image}
          data-orig={u.image}
          alt=""
          loading="lazy"
          className="mt-3 block max-h-64 w-full rounded-xl border border-hairline object-cover"
          onError={photoFallback((img) => (img.style.display = "none"))}
        />
      )}

      <h3 className="mt-2.5 font-display text-base font-semibold text-content">{u.title}</h3>
      {/* ⚠️ Rendered, not printed. This was `whitespace-pre-line` on the raw
          string, so a desk post's referral link showed as dead text a reader had
          to select and copy by hand - on a phone, most of the way to not
          bothering. `MarkdownLite` now renders links (and refuses anything that
          is not http(s)), so the same body gains a tappable link, real bold and
          real bullets without the composer changing at all. */}
      <div className="mt-1.5 text-sm leading-relaxed text-content-muted">
        <MarkdownLite text={u.body} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {u.url && (
          <a
            href={u.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-gold-200 transition-colors hover:text-gold-100"
          >
            Open link <ExternalLink className="h-3 w-3" strokeWidth={1.7} />
          </a>
        )}
        {canManage && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="inline-flex min-h-9 items-center gap-1 text-xs text-content-subtle transition-colors hover:text-data-down disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" strokeWidth={1.7} />}
            Delete
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * The desk composer, for writing a post and for editing one.
 *
 * ⚠️ `edit` makes this the SAME form in both directions rather than a second
 * one. An edit screen that is a copy of the create screen is two things to keep
 * in step, and the first capability added to one and not the other is a bug
 * nobody sees until someone uses both.
 */
export function Composer({
  onPosted,
  edit,
}: {
  onPosted: () => void;
  /** When present, the form PATCHes this post instead of creating a new one. */
  edit?: PointsUpdateDto;
}) {
  // Seeded once, from the post being edited. Never re-derived from `edit`
  // afterwards: the form owns its own fields once mounted, and re-feeding them
  // would fight the author's typing.
  const [title, setTitle] = useState(edit?.title ?? "");
  const [body, setBody] = useState(edit?.body ?? "");
  const [kind, setKind] = useState<UpdateKind>((edit?.kind as UpdateKind) ?? "live");
  const [program, setProgram] = useState(edit?.program ?? "");
  const [url, setUrl] = useState(edit?.url ?? "");
  const [pinned, setPinned] = useState(Boolean(edit?.pinned));
  const [image, setImage] = useState(edit?.image ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * ⚠️ The cap has to be enforced HERE now, and that is not a detail.
   *
   * The old body field was a `<textarea maxLength={UPDATE_LIMITS.body}>` - the
   * browser refused the 2001st character and the author never met the limit.
   * A rich-text editor has no `maxLength`, so with the swap alone an author
   * could write a long post, press Post, and have the server's zod schema
   * reject it - losing nothing, but only finding out at the end.
   *
   * So the button goes dead past the limit and says why. `CharCount` already
   * turns red once it goes negative; this is the half that stops the author
   * walking into a refusal.
   */
  const overBy = body.length - UPDATE_LIMITS.body;

  async function post() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(edit ? `/api/points/updates/${edit.id}` : "/api/points/updates", {
        method: edit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          kind,
          program: program || null,
          url: url || null,
          image: image || null,
          pinned,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Surface the API's own message - "Link must be a http(s) URL", "Title
        // is too short" - rather than a generic failure that tells the author
        // nothing about which field to fix.
        setError(j?.error ?? "Could not post that.");
        return;
      }
      // Only a CREATE clears the form. Blanking it after an edit would make a
      // successful save look like the post had been wiped.
      if (!edit) {
        setTitle("");
        setBody("");
        setProgram("");
        setUrl("");
        setPinned(false);
        setImage("");
      }
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
      {/* ⚠️ The dashboard's own body editor, not a second one.
          A markdown toolbar over a textarea worked, and it was still a SECOND
          editor - every capability the dashboard gained either had to be built
          twice or quietly did not exist here. The only way to keep two things
          the same is to make them one thing. It emits markdown, which is what
          `MarkdownLite` renders in the card below. */}
      <div className="mt-3">
        <PostContentEditor value={body} onChange={setBody} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-0.5 rounded-xl border border-hairline bg-surface-2 px-1.5 py-1">
        <CoverPicker url={image} onChange={setImage} label="Add an image" />
        <CharCount value={body} max={UPDATE_LIMITS.body} />
      </div>
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
          disabled={busy || title.trim().length < 3 || body.trim().length < 3 || overBy > 0}
          className="btn-gold inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {busy ? (edit ? "Saving…" : "Posting…") : edit ? "Save changes" : "Post update"}
        </button>
      </div>
      {overBy > 0 && (
        <p className="mt-2 text-xs text-data-down">
          {overBy.toLocaleString("en-US")} characters over the {UPDATE_LIMITS.body.toLocaleString("en-US")}
          -character limit. Trim it and the button comes back.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-data-down">{error}</p>}
    </div>
  );
}
