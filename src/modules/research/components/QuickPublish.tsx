"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { Loader2, Plus } from "lucide-react";
import { hasPermission } from "@/lib/permissions";

/**
 * Publish from the page you are already on - with the DASHBOARD's editor.
 *
 * ## Why it is the same component, not a lookalike
 *
 * This used to be a hand-rolled form: two inputs, a textarea and a markdown
 * toolbar. It worked, and it was still wrong, because it was a SECOND editor.
 * Every capability the dashboard gained - drag-and-drop covers with progress,
 * the WYSIWYG body, tags, the preview - either had to be built twice or quietly
 * did not exist here. "Same to same" is the requirement, and the only way to
 * actually keep two things the same is to make them one thing.
 *
 * So `/research` now mounts `PostEditor`, the exact component the dashboard
 * uses. It posts to `/api/research` itself, so there is no duplicated submit
 * path either.
 *
 * ## The bundle, handled rather than argued about
 *
 * ⚠️ `PostEditor` pulls in Tiptap, which is the heaviest dependency this site
 * has - `/dashboard` measures roughly twice every other route's bundle because
 * of it. Putting that on a PUBLIC page would move the weight onto every reader
 * who never composes anything.
 *
 * `next/dynamic` with `ssr: false` is what makes this safe: the chunk is only
 * requested when someone with `post:publish` actually opens the composer. A
 * reader's first load is unchanged, and the editor is complete when it arrives.
 * The cost-check skill's note applies exactly here - a chunk behind a dynamic
 * import counts in a route's graph but is never fetched unless referenced.
 *
 * ## Permissions
 *
 * Gated on `post:publish`, the same permission `/api/research` POST requires.
 * The gate here is a COURTESY - it hides a control that would 403 - and the
 * route enforces it independently. A client-side check is never the boundary.
 */
const PostEditor = dynamic(
  () => import("@/components/PostEditor").then((m) => ({ default: m.PostEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="surface flex min-h-[12rem] items-center justify-center rounded-2xl">
        <Loader2 className="h-5 w-5 animate-spin text-content-subtle" strokeWidth={1.7} />
      </div>
    ),
  }
);

export function QuickPublish() {
  const { data: session } = useSession();
  const router = useRouter();
  const canPublish = hasPermission(session?.user as never, "post:publish");

  const [open, setOpen] = useState(false);

  if (!canPublish) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="surface surface-hover flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 text-left transition-colors"
      >
        {/* The author's own avatar, the way every modern composer opens - it
            says "you are about to write as yourself" before a single field. */}
        {session?.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-500/15 text-gold-200">
            <Plus className="h-4 w-4" strokeWidth={2} />
          </span>
        )}
        <span className="text-sm text-content-muted">Publish something to Research…</span>
      </button>
    );
  }

  return (
    <PostEditor
      mode="create"
      onDone={() => {
        setOpen(false);
        // The list is server-rendered, so a refresh is what makes the new post
        // appear. `router.refresh()` re-fetches it without a full reload.
        router.refresh();
      }}
      onCancel={() => setOpen(false)}
    />
  );
}
