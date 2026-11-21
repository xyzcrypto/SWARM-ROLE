"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CatalogCategory } from "./types";
import type { Me } from "../client/hooks";
import { Icon, Skeleton } from "./ui";

const LEVEL_DOT = ["bg-mint-400", "bg-sky-400", "bg-gold-400", "bg-gold-200"];

export function Library({ categories, me }: { categories: CatalogCategory[] | null; me: Me | null }) {
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
                "surface surface-hover lift group relative flex h-full min-h-[11rem] flex-col overflow-hidden rounded-3xl p-5",
                complete && "border-mint-400/30"
              )}
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold-500/0 blur-2xl transition-colors duration-500 group-hover:bg-gold-500/15" aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-gold-400/25 bg-gradient-to-br from-gold-400/15 to-transparent text-gold-200">
                  <Icon name={c.icon} className="h-5 w-5" />
                </span>
                <span className="mono text-[10px] font-semibold text-content-subtle">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold leading-snug tracking-tight text-content">{c.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-content-muted">{c.tagline}</p>
              <div className="mt-auto flex items-center gap-3 pt-4">
                <div className="flex min-w-0 flex-1 gap-1" aria-label={`${finished} of ${c.modules.length} lessons done`}>
                  {c.modules.map((m, k) => (
                    <span key={m.id} className={cn("h-1.5 min-w-0 max-w-6 flex-1 rounded-full", done.has(m.id) ? LEVEL_DOT[k] ?? "bg-gold-300" : "bg-white/10")} title={m.title} />
                  ))}
                </div>
                <span className="shrink-0 whitespace-nowrap text-[11px] text-content-subtle">
                  {c.modules.length} lessons · {c.questionCount} questions
                </span>
                {complete ? <CheckCircle2 className="ml-auto h-4 w-4 text-mint-300" /> : <ArrowUpRight className="ml-auto h-4 w-4 text-content-subtle transition-all group-hover:-translate-y-0.5 group-active:-translate-y-0.5 group-hover:translate-x-0.5 group-active:translate-x-0.5 group-hover:text-gold-300" />}
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
