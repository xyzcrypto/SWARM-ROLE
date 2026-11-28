"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson, useMe } from "../client/hooks";
import { say, sfx, unlock } from "../client/audio";
import { Library } from "./Library";
import type { CatalogCategory } from "./types";
import { CountUp, Empty, Ring, SectionTitle, Skeleton } from "./ui";

const FILTERS = [
  { id: "all", label: "All tracks" },
  { id: "progress", label: "In progress" },
  { id: "new", label: "Not started" },
  { id: "done", label: "Completed" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

export function LearnIndex() {
  const [catalog, setCatalog] = useState<CatalogCategory[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const { me } = useMe();
  useEffect(() => {
    say("learn_pick", { auto: true });
  }, []);
  useEffect(() => {
    getJson<{ categories: CatalogCategory[] }>("/api/academy/catalog")
      .then((r) => setCatalog(r.categories))
      .catch(() => setCatalog([]));
  }, []);

  const done = useMemo(() => new Set(me?.progress.modules ?? []), [me]);
  const stateOf = (c: CatalogCategory): Filter => {
    const n = c.modules.filter((m) => done.has(m.id)).length;
    return n === 0 ? "new" : n === c.modules.length ? "done" : "progress";
  };
  const term = q.trim().toLowerCase();
  const shown = catalog?.filter((c) => (filter === "all" || stateOf(c) === filter) && (!term || `${c.title} ${c.tagline}`.toLowerCase().includes(term))) ?? null;
  const lessons = catalog?.reduce((n, c) => n + c.modules.length, 0) ?? 0;
  const questions = catalog?.reduce((n, c) => n + c.questionCount, 0) ?? 0;
  const pct = me?.progress.total ? me.progress.done / me.progress.total : 0;

  return (
    <div>
      <SectionTitle
        eyebrow="Learning library"
        title="Learn Web3, one level at a time"
        sub="Every topic runs Beginner, Intermediate, Advanced, Expert. Read a short lesson, pass its knowledge check, and the lesson is complete."
      />

      {!catalog ? (
        <Skeleton className="mb-6 h-28" />
      ) : (
        <div className="acad-learn-stats surface mb-6 flex flex-wrap items-center gap-5 rounded-3xl p-4 sm:gap-8 sm:p-5">
          {me && (
            <div className="relative grid place-items-center">
              <Ring value={pct} size={92} />
              <div className="absolute text-center">
                <div className="font-display text-xl font-bold text-content">
                  <CountUp value={Math.round(pct * 100)} />%
                </div>
                <div className="text-[0.5625rem] uppercase tracking-[0.14em] text-content-subtle">done</div>
              </div>
            </div>
          )}
          <div className="grid flex-1 grid-cols-3 gap-3">
            {[
              { v: catalog.length, l: "Tracks" },
              { v: lessons, l: "Lessons" },
              { v: questions, l: "Questions" },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-display text-2xl font-bold text-content sm:text-3xl">
                  <CountUp value={s.v} />
                </div>
                <div className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-content-subtle">{s.l}</div>
              </div>
            ))}
          </div>
          {me && (
            <div className="w-full text-xs text-content-muted sm:w-auto sm:text-right">
              <span className="font-semibold text-content">{me.progress.done}</span> of {me.progress.total} lessons complete
            </div>
          )}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        {me && (
          <div className="acad-nav-scroll -mx-1 flex max-w-full overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max rounded-full border border-hairline bg-ink-900/60 p-1" role="tablist" aria-label="Filter tracks">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => {
                    unlock();
                    sfx("click");
                    setFilter(f.id);
                  }}
                  className={cn(
                    "whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-[background-color,color,box-shadow] duration-300",
                    filter === f.id ? "bg-gold-300 text-ink-950 shadow-[0_4px_14px_-6px_rgba(226,167,47,0.7)]" : "text-content-muted hover:text-content"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="relative w-full sm:ml-auto sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search topics"
            aria-label="Search topics"
            className="w-full rounded-xl border border-hairline bg-ink-900/60 py-2 pl-9 pr-3 text-sm text-content placeholder:text-content-subtle focus:border-gold-400/50 focus:outline-none"
          />
        </label>
      </div>

      {shown && shown.length === 0 ? (
        <Empty>{term ? `No topic matches “${q.trim()}”.` : filter === "done" ? "No track completed yet. Finish every lesson in one to see it here." : filter === "progress" ? "Nothing in progress. Open any track to start." : "You have started every track."}</Empty>
      ) : (
        // Keyed by the filter so a switch replays the cascade.
        <div key={`${filter}:${term}`}>
          <Library categories={shown} me={me} numbers={catalog ? new Map(catalog.map((c, i) => [c.id, i + 1])) : undefined} />
        </div>
      )}
    </div>
  );
}
