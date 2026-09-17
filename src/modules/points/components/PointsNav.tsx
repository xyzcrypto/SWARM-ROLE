"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A sticky index for a long page.
 *
 * `/points` grew into five stacked panels plus one section per programme, and
 * the only way to reach the bottom was to scroll past all of it. This is the
 * cheapest fix that does not hide anything: a row of anchors that stays put,
 * with the current section marked.
 *
 * ⚠️ Plain `<a href="#id">` on purpose. The site runs Lenis, which owns page
 * scroll and undoes any programmatic `scrollTo` it did not initiate - a hand
 * -rolled smooth scroll here would be silently cancelled. Native anchor
 * navigation is handled by `HashScroll`, mounted in the layout, which already
 * knows about that.
 */
export type NavSection = { id: string; label: string };

export function PointsNav({ sections }: { sections: NavSection[] }) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  // Scroll-spy via IntersectionObserver rather than a scroll handler: no work
  // on frames where nothing crossed a boundary, and no scroll listener fighting
  // Lenis for the same events.
  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((e): e is HTMLElement => Boolean(e));
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        // The topmost section currently intersecting wins. Taking the most
        // recent entry instead would make the marker jump backwards when two
        // boundaries cross in one frame.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Top-weighted: a section counts as current once its heading is near the
      // top of the viewport, not when its last pixel leaves the bottom.
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Sections"
      className="sticky top-20 z-20 -mx-1 overflow-x-auto px-1 py-2"
    >
      <div className="glass inline-flex min-w-full gap-1 rounded-2xl border border-hairline p-1 sm:min-w-0">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={active === s.id ? "true" : undefined}
            className={cn(
              "shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
              active === s.id
                ? "bg-gold-500/15 text-gold-200 ring-1 ring-gold-500/30"
                : "text-content-muted hover:text-content active:text-content"
            )}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
