import Link from "next/link";
import { Award, BadgeCheck, Flame, GraduationCap, MessageSquareHeart, Rocket, Swords, Target, Trophy } from "lucide-react";
import type { ProfileActivity } from "@modules/academy/lib/profile-activity";
import { LearningHeatmap } from "./LearningHeatmap";
import { Icon } from "./ui";

// Server component: a member's public learning and feedback record on
// /u/<handle>. Dates are pinned to UTC (see CLAUDE.md, hydration).
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const n = (v: number) => v.toLocaleString("en-US");

export function ProfileAcademy({ a, username }: { a: ProfileActivity; username: string }) {
  const lv = a.level;
  const empty = a.xp === 0 && a.quizzes === 0 && a.feedback.count === 0 && a.certificates.length === 0;
  return (
    <section aria-labelledby="pa-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="pa-title" className="flex items-center gap-2 font-display text-lg font-semibold text-zinc-100">
          <GraduationCap className="h-5 w-5 text-gold-300" /> Academy &amp; contributions
        </h2>
        {!empty && (
          <Link href={`/academy/s/rank/${username}?p=alltime`} className="text-xs font-semibold text-gold-200 hover:underline">
            Share rank card
          </Link>
        )}
      </div>

      {empty ? (
        <div className="mt-3 rounded-2xl border border-line bg-white/[0.02] px-5 py-8 text-center">
          <p className="text-sm text-zinc-400">No Academy activity yet.</p>
          <Link href="/academy" className="mt-2 inline-block text-xs font-semibold text-gold-200 hover:underline">
            Start learning
          </Link>
        </div>
      ) : (
        <>
          {/* Level + XP bar */}
          {lv && (
            <div className="surface mt-3 rounded-2xl p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-gold-400/40 bg-gold-400/10 font-display text-lg font-bold text-gold-200">{lv.level}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base font-semibold text-zinc-100">{lv.name}</div>
                  <div className="text-xs text-zinc-500">
                    {n(a.xp)} XP{lv.next ? ` · ${n(lv.toNext)} to level ${lv.level + 1}` : " · max level"}
                  </div>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300" style={{ width: `${Math.round(lv.progress * 100)}%` }} />
              </div>
            </div>
          )}

          {/* Numbers */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Target, k: "Quizzes", v: n(a.quizzes) },
              { icon: BadgeCheck, k: "Accuracy", v: a.accuracy == null ? "–" : `${a.accuracy}%` },
              { icon: Flame, k: "Streak", v: `${a.streak}d`, sub: a.bestStreak > a.streak ? `best ${a.bestStreak}d` : undefined },
              { icon: Award, k: "Achievements", v: n(a.achievementCount) },
            ].map((s) => (
              <div key={s.k} className="surface rounded-2xl p-4">
                <s.icon className="h-4 w-4 text-gold-300" />
                <div className="mt-2 font-display text-xl font-semibold text-zinc-100">{s.v}</div>
                <div className="text-[0.6875rem] uppercase tracking-[0.12em] text-zinc-500">
                  {s.k}
                  {s.sub ? ` · ${s.sub}` : ""}
                </div>
              </div>
            ))}
          </div>

          {a.tracks.length > 0 && (
            <div className="surface mt-3 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 text-sm font-semibold text-zinc-100">
                <span className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-gold-300" /> Track mastery
                </span>
                <span className="text-xs font-normal text-zinc-500">{a.lessonsDone} lessons complete</span>
              </div>
              <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {a.tracks.slice(0, 8).map((t) => {
                  const pct = Math.round((t.done / Math.max(1, t.total)) * 100);
                  return (
                    <li key={t.slug}>
                      <Link href={`/academy/learn/${t.slug}`} className="group block">
                        <div className="flex items-center gap-2 text-sm">
                          <Icon name={t.icon} className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-gold-300" />
                          <span className="min-w-0 flex-1 truncate text-zinc-200 group-hover:text-zinc-50">{t.title}</span>
                          <span className={pct === 100 ? "font-mono text-xs font-semibold text-mint-300" : "font-mono text-xs text-zinc-500"}>{pct === 100 ? "Mastered" : `${t.done}/${t.total}`}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                          <div className={pct === 100 ? "h-full rounded-full bg-mint-400" : "h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300"} style={{ width: `${pct}%` }} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* Certificates */}
            <div className="surface rounded-2xl p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <Trophy className="h-4 w-4 text-gold-300" /> Certificates
              </div>
              {a.certificates.length ? (
                <ul className="mt-3 space-y-2">
                  {a.certificates.map((c) => (
                    <li key={c.code}>
                      <Link href={`/academy/certificate/${c.code}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.04] active:bg-white/[0.04]">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold-400/15 text-xs font-bold text-gold-200">#{c.rank}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-zinc-200">{c.title}</span>
                          <span className="block text-[0.6875rem] text-zinc-500">{day(c.issuedAt)} · {c.code}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">None yet. Top a leaderboard or win a live quiz to earn one.</p>
              )}
            </div>

            {/* Recent quizzes */}
            <div className="surface rounded-2xl p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <Target className="h-4 w-4 text-gold-300" /> Recent quizzes
              </div>
              {a.recent.length ? (
                <ul className="mt-3 space-y-2">
                  {a.recent.map((r) => (
                    <li key={r.id}>
                      <Link href={`/academy/s/quiz/${r.id}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.04] active:bg-white/[0.04]">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-zinc-200">{r.mode}</span>
                          {r.at && <span className="block text-[0.6875rem] text-zinc-500">{day(r.at)}</span>}
                        </span>
                        <span className="font-mono text-xs text-zinc-400">
                          {r.correct}/{r.total}
                        </span>
                        <span className="w-16 text-right font-mono text-sm font-semibold text-gold-200">{n(r.score)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">No finished quizzes yet.</p>
              )}
            </div>
          </div>

          {/* Achievements + feedback */}
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="surface rounded-2xl p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <Award className="h-4 w-4 text-gold-300" /> Latest achievements
              </div>
              {a.achievements.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.achievements.map((x) => (
                    <span key={x.code} className="rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-xs font-medium text-gold-100" title={day(x.earnedAt)}>
                      {x.title}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">None yet.</p>
              )}
            </div>
            <div className="surface rounded-2xl p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <MessageSquareHeart className="h-4 w-4 text-gold-300" /> Feedback
              </div>
              <div className="mt-3 flex items-center gap-6">
                <div>
                  <div className="font-display text-xl font-semibold text-zinc-100">{n(a.feedback.count)}</div>
                  <div className="text-[0.6875rem] uppercase tracking-[0.12em] text-zinc-500">Sent</div>
                </div>
                <div>
                  <div className="flex items-center gap-1 font-display text-xl font-semibold text-mint-300">
                    <Rocket className="h-4 w-4" /> {n(a.feedback.shipped)}
                  </div>
                  <div className="text-[0.6875rem] uppercase tracking-[0.12em] text-zinc-500">Shipped</div>
                </div>
                <div className="ml-auto flex flex-wrap justify-end gap-1.5">
                  {a.feedback.badges.map((b) => (
                    <span key={b.code} title={b.title} className="grid h-9 w-9 place-items-center rounded-xl border border-gold-400/40 bg-gold-400/10 text-lg">
                      {b.emoji}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * The Overview tab's learning card: level and XP, all-time rank, streak, the
 * 26-week learning calendar, and a one-tap challenge to the member's latest
 * quiz (same questions, same clock).
 */
export function ProfileAcademyOverview({ a, username }: { a: ProfileActivity; username: string }) {
  const lv = a.level;
  if (a.xp === 0 && a.quizzes === 0) return null;
  return (
    <section aria-label="Learning" className="surface rounded-3xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-4">
        {lv && (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-gold-400/40 bg-gold-400/10 font-display text-xl font-bold text-gold-200" title={`Level ${lv.level}`}>
            {lv.level}
          </span>
        )}
        <div className="min-w-0 flex-1 basis-48">
          <div className="font-display text-lg font-semibold text-zinc-50">{lv?.name ?? "Learner"}</div>
          <div className="text-xs text-zinc-500">
            {n(a.xp)} XP{lv?.next ? ` · ${n(lv.toNext)} to level ${lv.level + 1}` : ""}
          </div>
          {lv && (
            <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300" style={{ width: `${Math.round(lv.progress * 100)}%` }} />
            </div>
          )}
        </div>
        <dl className="flex w-full justify-around gap-6 border-t border-white/[0.06] pt-3 text-center sm:w-auto sm:border-0 sm:pt-0">
          <div>
            <dt className="text-[0.6875rem] text-zinc-500">Rank</dt>
            <dd className="font-display text-xl font-semibold text-zinc-50">{a.rank ? `#${n(a.rank)}` : "–"}</dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] text-zinc-500">Streak</dt>
            <dd className="flex items-center justify-center gap-1 font-display text-xl font-semibold text-zinc-50">
              <Flame className="h-4 w-4 text-orange-400" /> {a.streak}
            </dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] text-zinc-500">Badges</dt>
            <dd className="font-display text-xl font-semibold text-zinc-50">{n(a.achievementCount)}</dd>
          </div>
        </dl>
      </div>

      <LearningHeatmap days={a.heat} className="mt-5 border-t border-white/[0.06] pt-4" />

      <div className="mt-4 flex flex-wrap gap-2">
        {a.challenge && (
          <Link href={`/academy/quiz?challenge=${a.challenge.id}`} className="btn-gold h-10 px-4 text-sm">
            <Swords className="h-4 w-4" /> Challenge @{username} ({n(a.challenge.score)} pts)
          </Link>
        )}
        <Link href={`/academy/s/rank/${username}?p=alltime`} className="btn-ghost h-10 px-4 text-sm">
          <Trophy className="h-4 w-4" /> Rank card
        </Link>
      </div>
    </section>
  );
}
