"use client";

import { useEffect, useState } from "react";
import { MessageSquare, ArrowUp, Link2, Check, Share2 } from "lucide-react";
import { LikeButton } from "@/components/LikeButton";
import { SaveButton } from "@modules/research/components/SaveButton";

interface FloatingArticleDockProps {
  postId: string;
  postSlug: string;
  postTitle: string;
  postExcerpt?: string;
  postCover?: string | null;
  postCategory?: string;
  likeCount: number;
  initialLiked: boolean;
  commentCount?: number;
}

export function FloatingArticleDock({
  postId,
  postSlug,
  postTitle,
  postExcerpt = "",
  postCover = null,
  postCategory = "Research",
  likeCount,
  initialLiked,
  commentCount = 0,
}: FloatingArticleDockProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show dock after scrolling down 320px
      if (window.scrollY > 320) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const copyLink = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const scrollToComments = () => {
    const el = document.getElementById("comments");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <aside aria-label="Article actions" className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
      <div className="neu-card flex items-center gap-2 rounded-full border border-zinc-200/60 dark:border-white/[0.06] px-4 py-2 shadow-neu-lg bg-[#ebf0f7]/95 dark:bg-[#141722]/95 backdrop-blur-2xl">
        {/* Like */}
        <div className="scale-90 origin-center">
          <LikeButton
            postId={postId}
            initialCount={likeCount}
            initialLiked={initialLiked}
          />
        </div>

        <div className="h-4 w-px bg-zinc-300 dark:bg-white/15" />

        {/* Save */}
        <SaveButton
          slug={postSlug}
          title={postTitle}
          excerpt={postExcerpt}
          cover={postCover}
          category={postCategory}
          label={false}
          className="!min-h-8 !border-0 !bg-transparent text-zinc-700 dark:text-zinc-300 hover:!bg-zinc-200/60 dark:hover:!bg-white/10 hover:text-black dark:hover:text-white"
        />

        <div className="h-4 w-px bg-zinc-300 dark:bg-white/15" />

        {/* Copy Link */}
        <button
          type="button"
          onClick={copyLink}
          aria-label="Copy article link"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-200/60 dark:hover:bg-white/10 hover:text-black dark:hover:text-white"
          title={copied ? "Copied!" : "Copy link"}
        >
          {copied ? <Check className="h-4 w-4 text-mint-500 dark:text-mint-400" /> : <Link2 className="h-4 w-4" />}
        </button>

        {/* Share to X */}
        <a
          href={`https://x.com/intent/tweet?text=${encodeURIComponent(postTitle)}&url=${encodeURIComponent(
            typeof window !== "undefined" ? window.location.href : ""
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on X"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-200/60 dark:hover:bg-white/10 hover:text-black dark:hover:text-white"
          title="Share on X"
        >
          <Share2 className="h-4 w-4" />
        </a>

        <div className="h-4 w-px bg-zinc-300 dark:bg-white/15" />

        {/* Comments */}
        <button
          type="button"
          onClick={scrollToComments}
          aria-label="Jump to comments"
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-200/60 dark:hover:bg-white/10 hover:text-black dark:hover:text-white"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {commentCount > 0 && <span className="mono text-[11px]">{commentCount}</span>}
        </button>

        <div className="h-4 w-px bg-zinc-300 dark:bg-white/15" />

        {/* Scroll To Top */}
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-200/60 dark:hover:bg-white/10 hover:text-black dark:hover:text-white"
          title="Back to top"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}
