"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, LogIn, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_ACHIEVEMENTS, DEFAULT_ACHIEVEMENTS } from "../lib/config";
import { useMe, type Me } from "../client/hooks";
import { sfx, unlock } from "../client/audio";
import { burstConfetti, CountUp, Empty, fmt, Icon, Panel, Ring, SectionTitle, Skeleton, utcDate } from "./ui";

type Ach = Me["achievements"][number];
export type Rarity = "common" | "rare" | "epic" | "legendary";

/** Rarity follows the reward: the harder it is to earn, the more XP it pays. */
export function rarityOf(xp: number): Rarity {
  return xp >= 300 ? "legendary" : xp >= 150 ? "epic" : xp >= 100 ? "rare" : "common";
}
const RARITY_LABEL: Record<Rarity, string> = { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" };
const RARITY_ORDER: Rarity[] = ["legendary", "epic", "rare", "common"];

/** How far along a locked badge is, from numbers /api/academy/me already returns. */
export function progressOf(a: Pick<Ach, "code">, me: Me): { have: number; need: number } | null {
  const issued = me.certificates.filter((c) => c.status === "issued").length;
  switch (a.code) {
    case "first_quiz":
      return { have: me.quizzes, need: 1 };
    case "answers_100":
      return { have: me.answered, need: 100 };
    case "answers_500":
      return { have: me.answered, need: 500 };
    case "streak_7":
      return { have: Math.max(me.streak, me.bestStreak), need: 7 };
    case "streak_30":
      return { have: Math.max(me.streak, me.bestStreak), need: 30 };
    case "level_5":
      return { have: me.level.level, need: 5 };
    case "certified":
      return { have: issued, need: 1 };
  }
  const slug = Object.keys(CATEGORY_ACHIEVEMENTS).find((s) => CATEGORY_ACHIEVEMENTS[s] === a.code);
  const c = slug ? me.progress.byCategory.find((x) => x.slug === slug) : null;
  return c && c.total ? { have: c.done, need: c.total } : null;
}

const SEEN = "xyz:academy:ach-seen";
const FILTERS = [
  { id: "all", label: "All" },
  { id: "earned", label: "Unlocked" },
  { id: "locked", label: "Locked" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

function Badge({ a, me, fresh, i }: { a: Ach; me: Me | null; fresh: boolean; i: number }) {
  const [flip, setFlip] = useState(false);
  const got = !!a.earnedAt;
  const r = rarityOf(a.xp);
  const p = me && !got ? progressOf(a, me) : null;
  const pct = p ? Math.min(1, p.have / p.need) : 0;
  const rank = a.code === "top_10" && !got ? me?.standing.alltime?.rank : null;
  return (
    <button
      type="button"
      onClick={() => {
        unlock();
        sfx(got ? "select" : "click");
        setFlip((f) => !f);
      }}
      aria-pressed={flip}
      aria-label={`${a.title}, ${RARITY_LABEL[r]}, ${got ? "unlocked" : "locked"}. ${a.description}`}
      className={cn("acad-badge acad-row-in relative h-[14.5rem] w-full text-left sm:h-[15.5rem]", `is-${r}`, got ? "is-earned" : "is-locked", fresh && "is-fresh")}
      style={{ animationDelay: `${Math.min(i, 14) * 45}ms` }}
    >
      <div className={cn("acad-flip-card", flip && "is-flipped")}>
        <div className="acad-badge-face surface flex flex-col items-center rounded-3xl px-3 pb-4 pt-5 text-center">
          {fresh && <span className="acad-badge-new absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em]">New</span>}
          <span className="acad-medal">
            <span className="acad-medal-core">{got ? <Icon name={a.icon} className="h-7 w-7" /> : <Lock className="h-6 w-6" />}</span>
          </span>
          <div className="mt-3 line-clamp-2 font-display text-[14px] font-semibold leading-snug text-content sm:text-[15px]">{a.title}</div>
          <div className="acad-rarity mt-1 text-[10px] font-bold uppercase tracking-[0.18em]">{RARITY_LABEL[r]}</div>
          <div className="mt-auto w-full pt-2 text-[11px] text-content-subtle">
            {got ? (
              <span>Unlocked {utcDate(a.earnedAt!)}</span>
            ) : p ? (
              <>
                <div className="acad-badge-bar h-1.5 overflow-hidden rounded-full">
                  <div className="acad-badge-bar-fill h-full rounded-full" style={{ transform: `scaleX(${pct})` }} />
                </div>
                <div className="mt-1 font-mono">
                  {fmt(Math.min(p.have, p.need))} / {fmt(p.need)}
                </div>
              </>
            ) : rank ? (
              <span>Your best: #{fmt(rank)}</span>
            ) : (
              <span>Tap for how to unlock</span>
            )}
          </div>
        </div>
        <div className="acad-badge-face acad-badge-back surface flex flex-col items-center justify-center rounded-3xl p-4 text-center">
          <div className="acad-rarity text-[10px] font-bold uppercase tracking-[0.18em]">{got ? "Unlocked" : "How to unlock"}</div>
          <p className="mt-2 text-sm leading-relaxed text-content">{a.description}</p>
          <div className="mt-3 font-mono text-lg font-bold text-gold-600 dark:text-gold-200">+{fmt(a.xp)} XP</div>
          {got && <div className="mt-1 text-[11px] text-content-subtle">{utcDate(a.earnedAt!)}</div>}
        </div>
      </div>
    </button>
  );
}

/**
 * Every achievement as a collectible badge: rarity by reward, progress toward
 * the locked ones, a flip for the details, and a reveal with confetti for the
 * ones unlocked since this device last looked.
 */
export function AchievementsPage() {
  const { me, status } = useMe();
  const [filter, setFilter] = useState<Filter>("all");
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());

  // Badges unlocked since this device last opened the page. The first visit
  // only counts the last 7 days, so a veteran is not showered for old ones.
  useEffect(() => {
    if (!me) return;
    const earned = me.achievements.filter((a) => a.earnedAt);
    let seen: string[] | null = null;
    try {
      const v = localStorage.getItem(SEEN);
      seen = v ? (JSON.parse(v) as string[]) : null;
    } catch {
      /* treat as first visit */
    }
    const weekAgo = Date.now() - 7 * 86_400_000;
    const nu = earned.filter((a) => (seen ? !seen.includes(a.code) : new Date(a.earnedAt!).getTime() > weekAgo)).map((a) => a.code);
    try {
      localStorage.setItem(SEEN, JSON.stringify(earned.map((a) => a.code)));
    } catch {
      /* fine */
    }
    if (!nu.length) return;
    const id = setTimeout(() => {
      setFresh(new Set(nu));
      if (document.documentElement.classList.contains("motion-off")) return;
      sfx("achievement");
      setTimeout(() => burstConfetti(undefined, 110), 650);
    }, 200);
    return () => clearTimeout(id);
  }, [me]);

  const list: Ach[] = useMemo(
    () => me?.achievements ?? DEFAULT_ACHIEVEMENTS.filter((a) => a.enabled).map((a) => ({ code: a.code, title: a.title, description: a.description, icon: a.icon, xp: a.xp, earnedAt: null })),
    [me]
  );
  const earned = list.filter((a) => a.earnedAt);
  const xpEarned = earned.reduce((s, a) => s + a.xp, 0);
  const rarest = [...earned].sort((x, y) => RARITY_ORDER.indexOf(rarityOf(x.xp)) - RARITY_ORDER.indexOf(rarityOf(y.xp)) || y.xp - x.xp)[0];
  // Unlocked first (newest first), then locked by how close they are.
  const shown = useMemo(() => {
    const closeness = (a: Ach) => {
      const p = me ? progressOf(a, me) : null;
      return p ? p.have / p.need : 0;
    };
    return list
      .filter((a) => (filter === "earned" ? a.earnedAt : filter === "locked" ? !a.earnedAt : true))
      .sort((x, y) => {
        if (!!x.earnedAt !== !!y.earnedAt) return x.earnedAt ? -1 : 1;
        if (x.earnedAt && y.earnedAt) return y.earnedAt.localeCompare(x.earnedAt);
        return closeness(y) - closeness(x);
      });
  }, [list, filter, me]);

  return (
    <div>
      <SectionTitle
        eyebrow="Collection"
        title="Badges"
        sub="Every badge pays XP once. Rarer badges pay more. Tap a badge to flip it and see exactly how to unlock it."
      />

      {status === "unauthenticated" ? (
        <Panel className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold-400/15 text-gold-200">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-semibold text-content">Start your collection</div>
            <p className="mt-0.5 text-sm text-content-muted">Sign in to unlock badges as you learn, play and climb. Your progress toward each one shows here.</p>
          </div>
          <Link href="/login?callbackUrl=/academy/achievements" className="btn-gold h-11 px-5 text-sm">
            <LogIn className="h-4 w-4" /> Sign in
          </Link>
        </Panel>
      ) : !me ? (
        <Skeleton className="mb-6 h-36" />
      ) : (
        <Panel className="acad-ach-summary relative mb-6 overflow-hidden">
          <div className="flex flex-wrap items-center gap-5 sm:gap-8">
            <div className="relative grid place-items-center">
              <Ring value={list.length ? earned.length / list.length : 0} />
              <div className="absolute text-center">
                <div className="font-display text-2xl font-bold text-content">
                  <CountUp value={earned.length} />
                </div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-content-subtle">of {list.length}</div>
              </div>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">Badge XP</div>
                <div className="mt-1 font-display text-2xl font-bold text-gold-600 dark:text-gold-200">
                  <CountUp value={xpEarned} />
                </div>
              </div>
              <div>
                <div className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">Still to earn</div>
                <div className="mt-1 whitespace-nowrap font-display text-2xl font-bold text-content">
                  <CountUp value={list.reduce((s, a) => s + a.xp, 0) - xpEarned} /> <span className="text-sm font-semibold text-content-subtle">XP</span>
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">Rarest</div>
                <div className={cn("mt-1 truncate font-display text-base font-semibold", rarest ? `acad-rarity-text is-${rarityOf(rarest.xp)}` : "text-content-muted")}>
                  {rarest ? rarest.title : "None yet"}
                </div>
              </div>
            </div>
          </div>
        </Panel>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-hairline bg-ink-900/60 p-1" role="tablist" aria-label="Show badges">
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
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-[background-color,color,box-shadow] duration-300",
                filter === f.id ? "bg-gold-300 text-ink-950 shadow-[0_4px_14px_-6px_rgba(226,167,47,0.7)]" : "text-content-muted hover:text-content"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-content-subtle">
          {RARITY_ORDER.map((r) => (
            <span key={r} className={cn("acad-rarity-text inline-flex items-center gap-1.5 font-semibold", `is-${r}`)}>
              <span className="acad-rarity-dot h-2 w-2 rounded-full" /> {RARITY_LABEL[r]}
            </span>
          ))}
        </div>
      </div>

      {shown.length ? (
        // Keyed by filter so a switch replays the cascade.
        <div key={filter} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((a, i) => (
            <Badge key={a.code} a={a} me={me} fresh={fresh.has(a.code)} i={i} />
          ))}
        </div>
      ) : (
        <Empty>{filter === "earned" ? "No badges unlocked yet. Finish a quiz to earn your first." : "Every badge unlocked. Legendary."}</Empty>
      )}
    </div>
  );
}
