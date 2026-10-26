"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { List, Sparkles, Send, Clock, BookOpen, UserCheck } from "lucide-react";
import { Avatar } from "@/components/Avatar";

interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

interface ArticleTableOfContentsProps {
  headings: HeadingItem[];
  readMinutes: number;
  author: {
    id?: string;
    name: string | null;
    username?: string | null;
    image?: string | null;
    membership?: string | null;
  } | null;
}

export function ArticleTableOfContents({
  headings,
  readMinutes,
  author,
}: ArticleTableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0% -60% 0%" }
    );

    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  const authorName = author?.name || "XYZ Research Desk";
  const isPremium = author?.membership === "Premium" || author?.membership === "Pro";

  return (
    <div className="sticky top-28 space-y-6">
      {/* ── 1. Table of Contents / Article Outline ── */}
      {headings.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 text-xs font-semibold text-zinc-300">
            <List className="h-4 w-4 text-gold-400" />
            <span className="mono uppercase tracking-wider">Article Outline</span>
          </div>

          <nav className="mt-3.5 max-h-[360px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
            {headings.map((h) => {
              const isActive = activeId === h.id;
              return (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const target = document.getElementById(h.id);
                    if (target) {
                      target.scrollIntoView({ behavior: "smooth", block: "start" });
                      window.history.pushState(null, "", `#${h.id}`);
                    }
                  }}
                  className={`group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-all ${
                    h.level === 3 ? "pl-5" : ""
                  } ${
                    isActive
                      ? "border border-gold-500/40 bg-gold-500/15 font-medium text-gold-200 shadow-sm"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full transition-transform ${
                      isActive
                        ? "bg-gold-400 scale-125"
                        : "bg-zinc-600 group-hover:bg-zinc-400"
                    }`}
                  />
                  <span className="truncate">{h.text}</span>
                </a>
              );
            })}
          </nav>
        </div>
      )}

      {/* ── 2. Author Intelligence Card ── */}
      <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-5 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 text-xs font-semibold text-zinc-300">
          <UserCheck className="h-4 w-4 text-mint-400" />
          <span className="mono uppercase tracking-wider">Research Analyst</span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Avatar
            name={authorName}
            image={author?.image ?? null}
            size="md"
            premium={isPremium}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-100">{authorName}</p>
            <p className="truncate mono text-[11px] text-zinc-400">
              {author?.username ? `@${author.username}` : "XYZ Analyst"}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-gold-400" />
            {readMinutes} min read
          </span>
          <span className="inline-flex items-center gap-1 text-mint-300">
            <BookOpen className="h-3.5 w-3.5" />
            Full Access
          </span>
        </div>

        {author?.username && (
          <Link
            href={`/u/${author.username}`}
            className="mt-4 block w-full rounded-xl border border-white/10 bg-white/5 py-2 text-center text-xs font-semibold text-zinc-200 transition-colors hover:border-gold-500/40 hover:text-white"
          >
            View Analyst Profile
          </Link>
        )}
      </div>

      {/* ── 3. Alpha Telegram Desk Callout ── */}
      <div className="rounded-2xl border border-gold-500/30 bg-gradient-to-br from-ink-900/90 to-ink-950 p-5 shadow-xl backdrop-blur-xl">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/30 bg-gold-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-gold-300">
          <Sparkles className="h-3 w-3 text-gold-400" />
          Live Alpha
        </div>
        <h4 className="mt-2.5 font-display text-sm font-bold text-zinc-100">
          Real-Time On-Chain Radar
        </h4>
        <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
          Get direct alerts on protocol releases, perp yields, and token unlocks before the crowd.
        </p>
        <a
          href="https://t.me/X_Y_Z_Crypto"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-4 flex w-full items-center justify-center gap-2 !py-2 text-xs font-semibold shadow-gold-sm"
        >
          <Send className="h-3.5 w-3.5" />
          Join Alpha Telegram
        </a>
      </div>
    </div>
  );
}
