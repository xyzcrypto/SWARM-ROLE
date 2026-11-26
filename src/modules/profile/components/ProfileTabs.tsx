"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ProfileTab = { id: string; label: string; count?: number; content: React.ReactNode };

/**
 * The profile's sections as tabs instead of one long scroll. Each tab is a
 * link target (#academy, #journal...), so a shared URL opens on the right
 * one. The server renders the first tab; the hash is read after mount, so
 * the HTML never differs from the first client render.
 */
export function ProfileTabs({ tabs }: { tabs: ProfileTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      if (tabs.some((t) => t.id === h)) setActive(h);
    };
    const id = setTimeout(fromHash, 0);
    window.addEventListener("hashchange", fromHash);
    return () => {
      clearTimeout(id);
      window.removeEventListener("hashchange", fromHash);
    };
  }, [tabs]);

  const go = (id: string) => {
    setActive(id);
    // replaceState: switching tabs should not stack history entries.
    history.replaceState(null, "", id === tabs[0]?.id ? window.location.pathname : `#${id}`);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : -1;
    if (next < 0 || next >= tabs.length || e.key.length === 1) return;
    e.preventDefault();
    go(tabs[next].id);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div>
      <div className="sticky top-[4.25rem] z-20 -mx-1 bg-base/80 px-1 py-2 backdrop-blur-md sm:top-20">
        <div ref={listRef} role="tablist" aria-label="Profile sections" onKeyDown={onKey} className="flex gap-1 overflow-x-auto border-b border-hairline [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => {
            const on = t.id === active;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={on}
                aria-controls={`panel-${t.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => go(t.id)}
                className={cn(
                  "profile-tab relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 pb-3 pt-2 text-sm font-semibold transition-colors",
                  on ? "text-content" : "text-content-subtle hover:text-content-muted"
                )}
              >
                {t.label}
                {t.count != null && t.count > 0 && <span className={cn("rounded-full px-1.5 py-px font-mono text-[10px]", on ? "bg-gold-400/20 text-gold-700 dark:text-gold-200" : "bg-white/[0.06] text-content-subtle")}>{t.count > 99 ? "99+" : t.count}</span>}
                <span className={cn("absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-all duration-300", on ? "bg-gradient-to-r from-gold-400 to-gold-300 opacity-100" : "opacity-0")} />
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={t.id !== active} className="profile-panel pt-5">
          {t.content}
        </div>
      ))}
    </div>
  );
}
