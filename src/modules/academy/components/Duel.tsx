"use client";

import { Crown, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { sfx, unlock } from "../client/audio";
import { Avatar, CountUp, fmt } from "./ui";

export type DuelEntry = { userId: string; name: string; image: string | null; score: number; correct: number; timeMs: number; host: boolean; rank: number };
export type DuelInfo = { id: string; name: string; score: number; correct: number; total: number; takers: number; beaten: number; board: DuelEntry[] };

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** Everyone who has played one challenge, best first. The host wears a crown tag. */
export function ChallengeBoard({ board, meId, className }: { board: DuelEntry[]; meId?: string | null; className?: string }) {
  return (
    <ol className={cn("space-y-1.5", className)}>
      {board.map((e, i) => (
        <li
          key={e.userId}
          style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}
          className={cn("acad-row-in flex items-center gap-3 rounded-2xl border px-3 py-2", e.userId === meId ? "acad-me-row border-gold-400/40" : "border-hairline")}
        >
          <span className={cn("w-6 text-center font-mono text-sm font-bold", e.rank === 1 ? "text-gold-500 dark:text-gold-300" : "text-content-subtle")}>{e.rank}</span>
          <Avatar src={e.image} alt={e.name} size={30} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-content">
              <span className="truncate">{e.name}</span>
              {e.host && <span className="shrink-0 rounded-full bg-gold-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold-700 dark:text-gold-200">Host</span>}
              {e.userId === meId && <span className="shrink-0 rounded-full bg-mint-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-mint-700 dark:text-mint-200">You</span>}
            </div>
            <div className="text-[11px] text-content-subtle">
              {e.correct} correct · {secs(e.timeMs)}
            </div>
          </div>
          <span className="font-mono text-sm font-semibold text-gold-600 dark:text-gold-200">{fmt(e.score)}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The head-to-head result after playing someone's challenge: both faces, both
 * scores counting up, and a stamp that lands on the winner's side.
 */
export function VsCard({ you, them }: { you: { name: string; image: string | null; score: number; correct: number; total: number }; them: { name: string; score: number; correct: number; total: number; image?: string | null } }) {
  const outcome = you.score > them.score ? "win" : you.score === them.score ? "tie" : "lose";
  const side = (p: typeof you, mine: boolean) => {
    const won = (mine && outcome === "win") || (!mine && outcome === "lose");
    return (
      <div className={cn("acad-vs-side relative flex min-w-0 flex-1 flex-col items-center px-2 text-center", mine ? "is-you" : "is-them", won && "is-winner")}>
        {won && <Crown className="acad-vs-crown absolute -top-5 h-7 w-7 text-gold-400" strokeWidth={1.6} />}
        <Avatar src={p.image ?? null} alt={p.name} size={64} className={cn("ring-2", won ? "ring-gold-300" : "ring-hairline")} />
        <div className="mt-2 w-full truncate text-sm font-semibold text-content">{p.name}</div>
        <div className={cn("mt-1 font-display text-3xl font-bold sm:text-4xl", won ? "text-gold-600 dark:text-gold-200" : "text-content")}>
          <CountUp value={p.score} duration={1200} />
        </div>
        <div className="text-[11px] text-content-subtle">
          {p.correct}/{p.total} correct
        </div>
      </div>
    );
  };
  return (
    <div className={cn("acad-vs surface relative overflow-hidden rounded-3xl px-3 pb-5 pt-8 sm:px-6", `is-${outcome}`)}>
      <div className="flex items-center">
        {side(you, true)}
        <div className="acad-vs-badge grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-sm font-black">VS</div>
        {side({ ...them, image: them.image ?? null }, false)}
      </div>
      <div className="mt-4 flex justify-center">
        <span className="acad-vs-stamp rounded-xl px-4 py-1.5 font-display text-lg font-black uppercase tracking-[0.18em]">{outcome === "win" ? "You win" : outcome === "tie" ? "Tie" : "They win"}</span>
      </div>
    </div>
  );
}

/**
 * Send a challenge link where friends actually are: the phone's own share
 * sheet (WhatsApp, Telegram, Instagram...) when there is one, else WhatsApp
 * on the web. The link is copied too, as a fallback.
 */
export async function shareChallenge(url: string, text: string): Promise<"shared" | "whatsapp" | "cancelled"> {
  unlock();
  sfx("whoosh");
  try {
    await navigator.clipboard?.writeText(url);
  } catch {
    /* clipboard blocked: the share itself still works */
  }
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };
  const data = { title: "XYZ Crypto Academy challenge", text, url };
  if (nav.share && (!nav.canShare || nav.canShare(data))) {
    try {
      await nav.share(data);
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener,noreferrer");
  return "whatsapp";
}

export function ChallengeIcon({ className }: { className?: string }) {
  return <Swords className={className} />;
}
