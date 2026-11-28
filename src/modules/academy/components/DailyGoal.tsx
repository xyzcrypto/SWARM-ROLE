"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Snowflake, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson, type Me } from "../client/hooks";
import { sfx, unlock } from "../client/audio";
import { CountUp, Ring } from "./ui";

const GOALS = [
  { xp: 20, label: "Casual" },
  { xp: 50, label: "Regular" },
  { xp: 100, label: "Serious" },
  { xp: 150, label: "Intense" },
] as const;
const FREEZE_MAX = 2;

/** "4h 12m" until the UTC day rolls over, ticking each minute (after mount only). */
function Countdown({ to }: { to: number }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, to - Date.now()));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [to]);
  if (left == null) return null;
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return (
    <span className="font-mono tabular-nums">
      {h}h {String(m).padStart(2, "0")}m
    </span>
  );
}

/**
 * Today at a glance: the daily XP goal as a ring, the streak with the freezes
 * protecting it, and, when the streak has not been kept today, a countdown to
 * the reset with one tap into a short quiz.
 */
export function DailyGoal({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const { target, today } = me.goal;
  const done = today >= target;
  const pct = Math.min(1, today / Math.max(1, target));
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);

  const choose = async (xp: number) => {
    unlock();
    sfx("select");
    setSaving(xp);
    try {
      await postJsonPatch(xp);
      onChanged();
      setPicking(false);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className={cn("acad-goal surface relative overflow-hidden rounded-3xl p-4 sm:p-5", done && "is-done", me.streakAtRisk && "is-risk")}>
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <div className="relative grid place-items-center">
          <Ring value={pct} size={96} />
          <div className="absolute text-center">
            {done ? (
              <Target className="acad-goal-check mx-auto h-7 w-7 text-mint-500 dark:text-mint-300" />
            ) : (
              <>
                <div className="font-display text-xl font-bold text-content">
                  <CountUp value={today} />
                </div>
                <div className="text-[0.5625rem] uppercase tracking-[0.14em] text-content-subtle">of {target} XP</div>
              </>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 basis-40">
          <div className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-content-subtle">Daily goal</div>
          <div className="mt-0.5 font-display text-lg font-semibold text-content sm:text-xl">
            {done ? "Goal complete. Nicely done." : `${target - today} XP to go today`}
          </div>
          <button
            type="button"
            onClick={() => {
              unlock();
              sfx("click");
              setPicking((v) => !v);
            }}
            className="mt-1 text-xs font-semibold text-gold-600 underline-offset-2 hover:underline dark:text-gold-300"
            aria-expanded={picking}
          >
            {GOALS.find((g) => g.xp === target)?.label ?? "Custom"} · {target} XP a day · change
          </button>
        </div>

        {/* Phones: streak and freezes take their own row under the goal. */}
        <div className="flex w-full items-center justify-around gap-4 border-t border-hairline pt-3 sm:w-auto sm:justify-start sm:border-0 sm:pt-0">
          <div className="text-center">
            <div className={cn("flex items-center justify-center gap-1 font-display text-2xl font-bold", me.streak ? "text-gold-600 dark:text-gold-200" : "text-content-subtle")}>
              <Flame className={cn("h-6 w-6", me.streak && "acad-goal-flame text-orange-500")} /> {me.streak}
            </div>
            <div className="text-[0.625rem] uppercase tracking-[0.14em] text-content-subtle">day streak</div>
          </div>
          <div className="text-center" title="Each freeze covers one missed day. Earn one every 7 days, up to 2.">
            <div className="flex items-center justify-center gap-0.5">
              {Array.from({ length: FREEZE_MAX }, (_, i) => (
                <Snowflake key={i} className={cn("h-5 w-5", i < me.freezes ? "acad-goal-ice text-sky-500 dark:text-sky-300" : "text-content-subtle opacity-30")} />
              ))}
            </div>
            <div className="mt-1 text-[0.625rem] uppercase tracking-[0.14em] text-content-subtle">
              {me.freezes} freeze{me.freezes === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      </div>

      {picking && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Daily goal">
          {GOALS.map((g) => (
            <button
              key={g.xp}
              type="button"
              role="radio"
              aria-checked={g.xp === target}
              disabled={saving != null}
              onClick={() => choose(g.xp)}
              className={cn(
                "rounded-2xl border px-3 py-2.5 text-left transition-colors",
                g.xp === target ? "border-gold-400/60 bg-gold-400/10" : "border-hairline hover:border-gold-400/40"
              )}
            >
              <div className="text-sm font-semibold text-content">{g.label}</div>
              <div className="font-mono text-xs text-content-subtle">{saving === g.xp ? "Saving…" : `${g.xp} XP / day`}</div>
            </button>
          ))}
        </div>
      )}

      {me.streakAtRisk && (
        <div className="acad-goal-risk mt-4 flex flex-wrap items-center gap-3 rounded-2xl px-3.5 py-2.5">
          <Flame className="h-5 w-5 shrink-0 text-orange-500" />
          <div className="min-w-0 flex-1 basis-48 text-sm text-content">
            Your <b>{me.streak}-day streak</b> resets in <Countdown to={me.dayEndsAt} /> (5:30 AM IST). One short quiz keeps it.
          </div>
          <Link href="/academy/quiz?mode=quick&count=5" onClick={() => sfx("go")} className="btn-primary h-10 w-full justify-center px-4 text-xs sm:h-9 sm:w-auto">
            <Zap className="h-3.5 w-3.5" /> Keep my streak
          </Link>
        </div>
      )}
    </div>
  );
}

/** PATCH /api/academy/me with the new goal (postJson only POSTs). */
async function postJsonPatch(dailyGoal: number) {
  return getJson<{ dailyGoal: number }>("/api/academy/me", { method: "PATCH", body: JSON.stringify({ dailyGoal }), timeoutMs: 10_000 });
}
