"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, ExternalLink, Share2, Check } from "lucide-react";
import { BriefingBlock } from "./BriefingBlock";
import { timeAgo } from "@/lib/news";
import type { SharedStory } from "@/lib/news-share";

// Full-page reader for a shared story (rendered on OUR domain). Shows the story
// + an advanced AI briefing (login-gated) + a link to the original source.
export function SharedArticle({ story }: { story: SharedStory | null }) {
  const { data: session } = useSession();
  const loggedIn = Boolean(session?.user);
  const [now, setNow] = useState(0);
  const [brief, setBrief] = useState<{ loading: boolean; text: string | null; err: string | null }>({ loading: false, text: null, err: null });
  const [copied, setCopied] = useState(false);

  useEffect(() => setNow(Date.now()), []);

  useEffect(() => {
    if (!story || !loggedIn) return;
    let stop = false;
    setBrief({ loading: true, text: null, err: null });
    fetch("/api/ai/why-matters", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: story.t, summary: story.s ?? "", mode: "briefing" }),
    })
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (stop) return;
        if (!res.ok) setBrief({ loading: false, text: null, err: j.error || "Couldn't generate the briefing." });
        else setBrief({ loading: false, text: j.text, err: null });
      })
      .catch(() => !stop && setBrief({ loading: false, text: null, err: "Network error." }));
    return () => { stop = true; };
  }, [story, loggedIn]);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title: story?.t, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    } catch { /* cancelled */ }
  };

  if (!story) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-amber-300">This link is invalid or has expired.</p>
        <Link href="/news" className="mt-3 inline-block text-sm text-gold-200 hover:underline">← Go to News</Link>
      </div>
    );
  }

  return (
    <article className="space-y-5">
      <Link href="/news" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-100">
        <ArrowLeft className="h-4 w-4" /> News
      </Link>

      {story.img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={story.img} alt="" decoding="async" className="h-52 w-full rounded-2xl object-cover sm:h-72" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
      )}

      <div className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-400">
        {story.src && <span className="font-medium text-zinc-300">{story.src}</span>}
        {story.ts ? (<><span>·</span><span className="mono">{now ? timeAgo(story.ts, now) : ""}</span></>) : null}
        {story.cat && <span className="rounded-full bg-gold-500/10 px-2 py-0.5 text-[10px] font-medium text-gold-200">{story.cat}</span>}
      </div>

      <h1 className="font-display text-2xl font-bold leading-tight text-zinc-50 sm:text-4xl">{story.t}</h1>
      {story.s && <p className="text-[15px] leading-relaxed text-zinc-300">{story.s}</p>}

      {/* Advanced AI briefing - with Listen + Hinglish */}
      <BriefingBlock
        englishText={brief.text}
        loading={brief.loading}
        err={brief.err}
        title={story.t}
        summary={story.s ?? ""}
        loggedIn={loggedIn}
      />
      {!loggedIn && (
        <p className="text-[13px] text-zinc-400">
          <Link href="/login" className="text-gold-200 hover:underline">Log in</Link> to read the full AI briefing of this story.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <a href={story.u} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm">
          Read original <ExternalLink className="h-4 w-4" />
        </a>
        <button onClick={share} className="btn-ghost inline-flex items-center gap-1.5 px-4 py-2 text-sm">
          {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Share2 className="h-4 w-4" /> Share</>}
        </button>
      </div>
    </article>
  );
}
