// Spaced review of the questions a learner got wrong.
//
// No table of its own: the schedule is derived from AcademyAnswer, which
// already records every answer (a timeout is a wrong answer). A question
// enters review the moment it is answered wrong. Each later correct answer
// that lands ON OR AFTER its due time moves it one step out; one given early
// (the same question again a minute later) does not count, because spacing
// is the point. Another wrong answer starts it over. After the last step it
// is mastered and leaves the queue.
//
//   wrong        -> due now
//   1st right    -> due in 1 day
//   2nd right    -> due in 3 days
//   3rd right    -> due in 7 days
//   4th right    -> mastered
//
// Client-safe: `schedule` is pure; `reviewQueue` (DB) lives in review-db.ts.

export const REVIEW_STEPS_DAYS = [1, 3, 7];
const DAY = 86_400_000;
/** A correct answer this close before its due time still counts (same-evening review). */
export const REVIEW_SLACK_MS = 2 * 3_600_000;

export type AnswerRow = { questionId: string; correct: boolean; createdAt: Date | number };
export type ReviewItem = { questionId: string; step: number; dueAt: number };
export type ReviewSummary = {
  due: ReviewItem[]; // due now, most overdue first
  upcoming: ReviewItem[]; // scheduled later, soonest first
  mastered: number;
  nextAt: number | null; // when the next upcoming one falls due
};

export function schedule(rows: AnswerRow[], now: number): ReviewSummary {
  const byQ = new Map<string, { correct: boolean; t: number }[]>();
  for (const r of rows) {
    const t = typeof r.createdAt === "number" ? r.createdAt : r.createdAt.getTime();
    const list = byQ.get(r.questionId) ?? [];
    list.push({ correct: r.correct, t });
    byQ.set(r.questionId, list);
  }
  const due: ReviewItem[] = [];
  const upcoming: ReviewItem[] = [];
  let mastered = 0;
  for (const [questionId, list] of byQ) {
    list.sort((a, b) => a.t - b.t);
    let lastWrong = -1;
    for (let i = list.length - 1; i >= 0; i--)
      if (!list[i].correct) {
        lastWrong = i;
        break;
      }
    if (lastWrong < 0) continue; // never missed: nothing to review
    let step = 0;
    let dueAt = list[lastWrong].t;
    for (let i = lastWrong + 1; i < list.length; i++) {
      if (list[i].t < dueAt - REVIEW_SLACK_MS) continue; // too early to count
      step++;
      if (step > REVIEW_STEPS_DAYS.length) break;
      dueAt = list[i].t + REVIEW_STEPS_DAYS[step - 1] * DAY;
    }
    if (step > REVIEW_STEPS_DAYS.length) {
      mastered++;
      continue;
    }
    (dueAt <= now ? due : upcoming).push({ questionId, step, dueAt });
  }
  due.sort((a, b) => a.dueAt - b.dueAt);
  upcoming.sort((a, b) => a.dueAt - b.dueAt);
  return { due, upcoming, mastered, nextAt: upcoming[0]?.dueAt ?? null };
}

/** "in 5h", "in 2 days": for the empty-queue message. */
export function untilText(at: number, now: number) {
  const ms = Math.max(0, at - now);
  const h = Math.round(ms / 3_600_000);
  if (h < 1) return "within the hour";
  if (h < 24) return `in ${h}h`;
  const d = Math.round(h / 24);
  return `in ${d} day${d === 1 ? "" : "s"}`;
}
