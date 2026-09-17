"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";

/**
 * Publish from the page you are already on.
 *
 * ## Why this exists
 *
 * Posting research meant leaving /research for the dashboard, finding the
 * editor, writing, publishing, and navigating back to see it. Five steps for
 * something that is often one paragraph and a link. The airdrop desk learned
 * this already: "a thirty-second thought is how a feed quietly stops being
 * live" - the same is true of a short research note.
 *
 * ## What it is NOT
 *
 * It is not a replacement for the dashboard editor. The dashboard has the rich
 * editor, cover images, tags, scheduling and the full post list, and a long
 * piece belongs there. This is the short-form door: title, excerpt, body,
 * publish. Anything it does not offer is deliberate, not missing.
 *
 * ## Permissions
 *
 * Gated on `post:publish`, the same permission `/api/research` POST requires.
 * The gate here is a COURTESY - it hides a control that would 403 - and the
 * route enforces it independently. A client-side check is never the boundary.
 */
export function QuickPublish() {
  const { data: session } = useSession();
  const router = useRouter();
  const canPublish = hasPermission(session?.user as never, "post:publish");

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    excerpt: "",
    content: "",
    category: "Research" as "Research" | "Article" | "Post",
    premium: false,
  });

  if (!canPublish) return null;

  // Mirrors the route's zod schema, so the button explains what is missing
  // instead of the server rejecting it after a round trip.
  const problems: string[] = [];
  if (form.title.trim().length < 4) problems.push("a title (4+ characters)");
  if (form.excerpt.trim().length < 8) problems.push("a summary (8+ characters)");
  if (form.content.trim().length < 20) problems.push("a body (20+ characters)");

  async function submit(published: boolean) {
    if (busy || problems.length) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, published }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Could not publish that.");
      setForm({ title: "", excerpt: "", content: "", category: "Research", premium: false });
      setOpen(false);
      // The list is server-rendered, so a refresh is what makes the new post
      // appear. `router.refresh()` re-fetches it without a full reload.
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="surface surface-hover flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-left transition-colors"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-500/15 text-gold-200">
          <Plus className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="text-sm text-content-muted">Publish something to Research…</span>
      </button>
    );
  }

  return (
    <section className="surface rounded-2xl p-4 sm:p-5">
      <header className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-content-subtle">New post</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close the composer"
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-content-subtle transition-colors hover:text-content"
        >
          <X className="h-4 w-4" strokeWidth={1.7} />
        </button>
      </header>

      <div className="mt-3 space-y-2.5">
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Title"
          maxLength={160}
          className="min-h-11 w-full rounded-xl border border-hairline bg-surface-2 px-4 py-2.5 text-sm font-semibold text-content outline-none transition-colors focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
        />
        <input
          value={form.excerpt}
          onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
          placeholder="One-line summary, shown on the card"
          maxLength={320}
          className="min-h-11 w-full rounded-xl border border-hairline bg-surface-2 px-4 py-2.5 text-sm text-content outline-none transition-colors focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
        />
        <textarea
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          placeholder="Write it. Markdown works."
          rows={6}
          className="w-full rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm leading-relaxed text-content outline-none transition-colors focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as typeof f.category }))}
          className="min-h-9 rounded-lg border border-hairline bg-surface-2 px-2.5 text-xs text-content outline-none focus:border-gold-500/50"
        >
          <option value="Research">Research</option>
          <option value="Article">Article</option>
          <option value="Post">Post</option>
        </select>

        <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-hairline px-2.5 text-xs text-content-muted">
          <input
            type="checkbox"
            checked={form.premium}
            onChange={(e) => setForm((f) => ({ ...f, premium: e.target.checked }))}
            className="accent-gold-500"
          />
          Premium
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void submit(false)}
            disabled={busy || problems.length > 0}
            className="btn-ghost inline-flex min-h-9 items-center gap-1.5 text-xs disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={() => void submit(true)}
            disabled={busy || problems.length > 0}
            className={cn("btn-primary inline-flex min-h-9 items-center gap-1.5 text-xs", busy && "opacity-70")}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.7} />}
            Publish
          </button>
        </div>
      </div>

      {/* Says what is missing rather than just disabling the button. A dead
          control with no explanation is the most common way a form wastes
          someone's time. */}
      {problems.length > 0 && (
        <p className="mt-2 text-[11px] text-content-subtle">Still needs {problems.join(", ")}.</p>
      )}
      {err && <p className="mt-2 text-[11px] text-amber-200">{err}</p>}
    </section>
  );
}
