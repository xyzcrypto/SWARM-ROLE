"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CatalogCategory } from "./types";
import type { Me } from "../client/hooks";
import { Icon, Skeleton } from "./ui";

const LEVEL_DOT = ["bg-mint-400", "bg-sky-400", "bg-gold-400", "bg-gold-200"];

export function Library({ categories, me, numbers }: { categories: CatalogCategory[] | null; me: Me | null; numbers?: Map<string, number> }) {
  if (!categories)
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    );
  const done = new Set(me?.progress.modules ?? []);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((c, i) => {
        const finished = c.modules.filter((m) => done.has(m.id)).length;
        const complete = finished === c.modules.length && c.modules.length > 0;
        return (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
           
            transition={{ duration: 0.5, delay: (i % 3) * 0.06, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link
              href={`/academy/learn/${c.slug}`}
              className={cn(
                "surface surface-hover acad-tilt group relative flex h-full min-h-[11rem] flex-col overflow-hidden rounded-3xl p-5",
                complete && "border-mint-400/30"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="acad-track-icon grid h-10 w-10 place-items-center rounded-xl border border-hairline text-content-muted transition-colors group-hover:border-gold-400/50 group-hover:text-gold-600 group-active:text-gold-600 dark:group-hover:text-gold-200">
                  <Icon name={c.icon} className="h-5 w-5" />
                </span>
                <span className="font-mono text-[11px] tabular-nums text-content-subtle/70">{String(numbers?.get(c.id) ?? i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold leading-snug tracking-tight text-content">{c.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-content-muted">{c.tagline}</p>
              <div className="mt-auto flex items-center gap-3 pt-4">
                <div className="flex min-w-0 flex-1 gap-1" aria-label={`${finished} of ${c.modules.length} lessons done`}>
                  {c.modules.map((m, k) => (
                    <span
                      key={m.id}
                      className={cn("acad-seg h-1.5 min-w-0 max-w-6 flex-1 rounded-full", done.has(m.id) ? LEVEL_DOT[k] ?? "bg-gold-300" : "bg-white/10")}
                      style={{ animationDelay: `${300 + (i % 3) * 60 + k * 70}ms` }}
                      title={m.title}
                    />
                  ))}
                </div>
                <span className="shrink-0 whitespace-nowrap text-[11px] text-content-subtle">
                  {c.modules.length} lessons · {c.questionCount} questions
                </span>
                {complete ? <CheckCircle2 className="acad-done-check ml-auto h-4 w-4 text-mint-500 dark:text-mint-300" /> : <ArrowUpRight className="ml-auto h-4 w-4 text-content-subtle transition-all group-hover:-translate-y-0.5 group-active:-translate-y-0.5 group-hover:translate-x-0.5 group-active:translate-x-0.5 group-hover:text-gold-300" />}
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
