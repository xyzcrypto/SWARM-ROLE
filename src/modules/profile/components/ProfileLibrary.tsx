"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Bookmark, BookmarkCheck, BookmarkX, ExternalLink, Library, Loader2 } from "lucide-react";
import { hapticError, hapticToggle } from "@shared/utils/haptics";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";
import { chatAudioUrl, chatMediaUrl, mediaLabel, splitLeadingMedia } from "@modules/community/lib/chat-media";
import { VoiceNote } from "@modules/community/components/Voice";
import { SavedClient } from "@modules/news/components/SavedClient";

export type ProfileBookmark = {
  id: string;
  savedAt: string;
  message: {
    id: string;
    body: string;
    createdAt: string;
    kind: string;
    author: { name: string | null; username: string | null; image: string | null };
  };
};

/**
 * The profile's Library: community messages this member bookmarked (public -
 * the owner asked for these to be visible to everyone) and, for the member
 * themselves only, their Saved research and news.
 *
 * Saved stays PRIVATE on purpose. It was always a private list, and making it
 * public would change what a member already chose to keep to themselves. The
 * tab only appears once the session says the viewer IS this profile's owner;
 * both the server render and the hydrating render show Bookmarks only, so
 * nothing can mismatch.
 */
export function ProfileLibrary({ owner, bookmarks, when }: { owner: string; bookmarks: ProfileBookmark[]; when: Record<string, string> }) {
  const { data: session } = useSession();
  const isOwner = !!owner && (session?.user as { username?: string } | undefined)?.username?.toLowerCase() === owner.toLowerCase();
  const [tab, setTab] = useState<"bookmarks" | "saved">("bookmarks");
  const active = isOwner ? tab : "bookmarks";
  // The owner can remove a bookmark right here. Optimistic, restored in place
  // if the server refuses.
  const [items, setItems] = useState(bookmarks);
  const [removing, setRemoving] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const remove = async (b: ProfileBookmark) => {
    if (removing) return;
    setErr(null);
    setRemoving(b.id);
    hapticToggle();
    const before = items;
    setItems((list) => list.filter((x) => x.id !== b.id));
    const r = await fetch(`/api/chat/messages/${b.message.id}/bookmark`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) {
      setItems(before);
      hapticError();
      setErr("Couldn't remove that bookmark. Try again.");
    }
    setRemoving(null);
  };

  return (
    <section aria-labelledby="library-title">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="library-title" className="flex items-center gap-2 font-display text-lg font-semibold text-zinc-100">
          <Library className="h-5 w-5 text-gold-300" /> Library
        </h2>
        <div className="ml-auto flex gap-1 rounded-2xl border border-line bg-white/[0.03] p-1" role="tablist" aria-label="Library">
          <TabButton on={active === "bookmarks"} onClick={() => setTab("bookmarks")} icon={<Bookmark className="h-3.5 w-3.5" />}>
            Bookmarks <span className="mono text-[0.625rem] opacity-70">{items.length}</span>
          </TabButton>
          {isOwner && (
            <TabButton on={active === "saved"} onClick={() => setTab("saved")} icon={<BookmarkCheck className="h-3.5 w-3.5" />}>
              Saved <span className="text-[0.625rem] opacity-60">· only you</span>
            </TabButton>
          )}
        </div>
      </div>

      {err && <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[0.75rem] text-amber-200" role="alert">{err}</p>}
      {active === "bookmarks" ? (
        items.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-line bg-white/[0.02] px-5 py-10 text-center">
            <Bookmark className="mx-auto h-6 w-6 text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-400">No bookmarks yet.</p>
            <p className="mt-1 text-xs text-zinc-600">Important messages bookmarked in the Community show up here.</p>
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((b) => (
              <BookmarkCard key={b.id} b={b} when={when[b.id] ?? ""} onRemove={isOwner ? () => void remove(b) : undefined} busy={removing === b.id} />
            ))}
          </ul>
        )
      ) : (
        <div className="mt-3">
          <SavedClient />
        </div>
      )}
    </section>
  );
}

function TabButton({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[0.8125rem] font-semibold transition-colors",
        on ? "bg-gold-500/15 text-gold-100 ring-1 ring-gold-500/35" : "text-zinc-400 hover:text-zinc-200"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function BookmarkCard({ b, when, onRemove, busy }: { b: ProfileBookmark; when: string; onRemove?: () => void; busy?: boolean }) {
  const m = b.message;
  const lead = splitLeadingMedia(m.body);
  const voice = lead?.audio ?? chatAudioUrl(m.body);
  const image = lead?.image ?? chatMediaUrl(m.body);
  const text = lead ? lead.caption : m.body;
  const who = m.author.name ?? (m.author.username ? `@${m.author.username}` : "Member");
  return (
    <li className="surface surface-hover lift group relative flex flex-col overflow-hidden rounded-2xl p-4">
      <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-gold-400/50" />
      <div className="flex items-center gap-2.5">
        <Avatar name={m.author.name} image={m.author.image} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-semibold text-zinc-100">{who}</p>
          <p className="mono text-[0.625rem] text-zinc-500">{when}</p>
        </div>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            aria-label="Remove bookmark"
            title="Remove bookmark"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-gold-300 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkX className="h-4 w-4" />}
          </button>
        ) : (
          <Bookmark className="h-4 w-4 shrink-0 fill-current text-gold-300" aria-label="Bookmarked" />
        )}
      </div>
      <div className="mt-3 min-w-0 flex-1">
        {m.kind === "poll" ? (
          <p className="text-sm text-zinc-300">📊 {m.body}</p>
        ) : voice ? (
          <VoiceNote src={voice.src} duration={voice.duration} />
        ) : image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="shared media" loading="lazy" className="max-h-48 w-auto max-w-full rounded-xl object-contain" />
        ) : null}
        {text && <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">{text}</p>}
        {!text && !voice && !image && m.kind !== "poll" && <p className="text-sm text-zinc-500">{mediaLabel(m.body) ?? ""}</p>}
      </div>
      <Link
        href={`/community?m=${m.id}`}
        prefetch={false}
        className="mt-3 inline-flex items-center gap-1 self-start rounded-lg text-[0.75rem] font-semibold text-gold-300 transition-colors hover:text-gold-100"
      >
        Open in Community <ExternalLink className="h-3 w-3" />
      </Link>
    </li>
  );
}
