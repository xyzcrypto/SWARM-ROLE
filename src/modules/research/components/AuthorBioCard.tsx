"use client";

import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ShieldCheck, ArrowRight, UserPlus } from "lucide-react";

interface AuthorBioCardProps {
  author: {
    id?: string;
    name: string | null;
    username?: string | null;
    image?: string | null;
    membership?: string | null;
  } | null;
}

export function AuthorBioCard({ author }: AuthorBioCardProps) {
  const authorName = author?.name || "XYZ Research Desk";
  const username = author?.username;
  const isPremium = author?.membership === "Premium" || author?.membership === "Pro";

  return (
    <div className="neu-card rounded-3xl p-6 sm:p-8 shadow-neu-lg border border-zinc-200/50 dark:border-white/[0.04]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Avatar
            name={authorName}
            image={author?.image ?? null}
            size="lg"
            premium={isPremium}
          />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-display text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {authorName}
              </h4>
              <span className="neu-raised-sm inline-flex items-center gap-1 rounded-full border border-mint-500/30 bg-mint-500/10 px-2.5 py-0.5 mono text-[10px] font-semibold text-mint-700 dark:text-mint-300 shadow-neu-sm">
                <ShieldCheck className="h-3 w-3 text-mint-400" />
                Verified Analyst
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              {username ? `@${username} · ` : ""}Contributing On-Chain Research & Market Intelligence at XYZ Crypto.
            </p>
          </div>
        </div>

        {username ? (
          <Link
            href={`/u/${username}`}
            className="neu-btn inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 shadow-neu-sm hover:text-black dark:hover:text-white active:scale-95 group shrink-0"
          >
            <UserPlus className="h-3.5 w-3.5 text-gold-400" />
            <span>View Profile</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 group-active:translate-x-1" />
          </Link>
        ) : (
          <a
            href="https://t.me/X_Y_Z_Crypto"
            target="_blank"
            rel="noopener noreferrer"
            className="neu-btn inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 shadow-neu-sm hover:text-black dark:hover:text-white active:scale-95 shrink-0"
          >
            Join Research Desk
          </a>
        )}
      </div>
    </div>
  );
}
