"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PostCard, type PostCardData } from "./PostCard";

const categories = ["All", "Research", "Article", "Post"] as const;

export function ResearchGrid({ posts }: { posts: PostCardData[] }) {
  const [active, setActive] = useState<(typeof categories)[number]>("All");
  const filtered =
    active === "All" ? posts : posts.filter((p) => p.category === active);

  return (
    <div>
      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
              active === c
                ? "bg-gold-shine text-ink shadow-gold-sm"
                : "border border-white/10 bg-white/5 text-zinc-400 hover:text-gold-100"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold-500/20 bg-ink-700/40 p-16 text-center">
          <p className="font-display text-lg font-semibold text-zinc-200">
            Nothing here yet
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            New {active === "All" ? "content" : active.toLowerCase() + "s"} will
            appear here soon.
          </p>
        </div>
      ) : (
        <motion.div layout className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((p) => (
              <motion.div
                key={p.slug}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3 }}
              >
                <PostCard post={p} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
