"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { safeHref } from "@/lib/links";
import { cn } from "@/lib/utils";
import { firstLink, type LinkPreview } from "../lib/link-preview";

// One answer per URL per page load, shared by every message that links it.
const memo = new Map<string, Promise<LinkPreview | null>>();
function load(url: string): Promise<LinkPreview | null> {
  let p = memo.get(url);
  if (!p) {
    p = fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.preview ?? null) as LinkPreview | null)
      .catch(() => null);
    memo.set(url, p);
  }
  return p;
}

/**
 * A card under a message that contains a link: site, title, description.
 *
 * Fetched only once the message is actually on screen (IntersectionObserver),
 * so scrolling a long history does not fire a request per link in it. Text
 * only - see `parsePreview` for why there is no image.
 */
export function LinkPreviewCard({ text, className }: { text: string; className?: string }) {
  const link = firstLink(text);
  const href = link ? safeHref(link) : null;
  const ref = useRef<HTMLAnchorElement>(null);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !href || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      // Old browser: just load it. Deferred so the effect only schedules.
      void Promise.resolve().then(() => setVisible(true));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [href, visible]);

  useEffect(() => {
    if (!visible || !href) return;
    let live = true;
    void load(href).then((p) => { if (live) setPreview(p); });
    return () => { live = false; };
  }, [visible, href]);

  if (!href) return null;
  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-hidden={preview ? undefined : true}
      tabIndex={preview ? undefined : -1}
      className={cn(
        "block max-w-[340px] overflow-hidden rounded-xl border-l-[3px] border-gold-400/60 bg-black/[0.06] transition-colors hover:bg-black/[0.1] dark:bg-white/[0.05] dark:hover:bg-white/[0.08]",
        preview ? "mt-1.5 px-3 py-2" : "h-0 border-0",
        className
      )}
    >
      {preview && (
        <>
          <span className="mono flex items-center gap-1 text-[10px] uppercase tracking-wider text-gold-600 dark:text-gold-300/80">
            {preview.siteName ?? preview.host}
            <ExternalLink className="h-2.5 w-2.5" aria-hidden />
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[13px] font-semibold leading-snug text-zinc-800 dark:text-zinc-100">{preview.title}</span>
          {preview.description && <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-zinc-600 dark:text-zinc-400">{preview.description}</span>}
        </>
      )}
    </a>
  );
}
