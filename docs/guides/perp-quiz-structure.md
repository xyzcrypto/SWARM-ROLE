# Perp DEX Quiz & Score — structure guide

A build plan for a learn-and-score game about perp DEXs and airdrops. Written so
it can be built later, by anyone, without re-deriving the decisions.

**Status: not built.** This document is the plan. Nothing in `src/` implements it
yet. Build it behind a feature flag and ship it dark first.

---

## 1. What it is, and what it is not

**It is:** a short, repeatable quiz that teaches how perp DEXs and points
programmes actually work, and gives a score people can compare.

**It is not:** a prediction market, a wager, or anything that pays out. The
moment a score converts to money or a token allocation, it stops being a quiz
and becomes a financial product with a regulatory surface. Keep score and value
strictly separate. If a reward is ever attached, it should be non-financial
(a profile badge, a leaderboard rank, early access to a post).

**Why it belongs on this site:** the whole `/points` page argues that farmers
plan around numbers they have not checked. A quiz is the cheapest way to make
that argument interactive rather than rhetorical.

---

## 2. The two question sources, and why both

| Kind | Where the answer comes from | Example |
|---|---|---|
| **Static** | Hand-written, stored in a registry file | "What does FDV stand for?" |
| **Live** | Computed from `/api/points/comps` at serve time | "Which of these four venues did the most 24h volume?" |

Static questions are the backbone: they are reviewable, stable, and cannot break
when an upstream does. Live questions are what makes it worth returning, because
the answer genuinely changes week to week.

⚠️ **A live question must be generated from the same cached payload the page
already fetches.** Generating one per request from a fresh upstream call would
put a third-party API on the critical path of a game, and this project has
already learned what one refusing upstream does to a page (see
`docs/changelog.md`, entry 101). If comps are unavailable, serve static
questions only and say so.

---

## 3. Data model

Four tables. Deliberately small: a quiz that needs six tables will not get built.

```prisma
model QuizQuestion {
  id          String   @id @default(cuid())
  kind        String   // "static" | "live"
  topic       String   // "basics" | "points" | "valuation" | "risk" | "venues"
  difficulty  Int      // 1..3
  prompt      String
  // Static only. Live questions build their options at serve time.
  options     Json?    // string[]
  answerIndex Int?
  explanation String   // ALWAYS required - see §6
  sourceUrl   String?  // where a reader can verify it
  published   Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@index([published, topic])
}

model QuizRun {
  id         String   @id @default(cuid())
  userId     String?  // null = anonymous run, scored but not ranked
  startedAt  DateTime @default(now())
  finishedAt DateTime?
  score      Int      @default(0)
  total      Int      // questions served
  // Snapshot of what was asked, so a later edit to a question cannot rewrite
  // history. Stores {questionId, prompt, options, answerIndex, given, correct}.
  answers    Json

  user       User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, finishedAt])
}

model QuizScore {
  userId      String   @id
  best        Int      @default(0)
  runs        Int      @default(0)
  streakDays  Int      @default(0)
  lastRunDay  String   // "YYYY-MM-DD" in UTC - see the timezone note in §7
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

⚠️ `QuizRun.answers` snapshots the question **as asked**. Without it, editing a
question's correct answer retroactively changes whether past runs were right,
and a leaderboard built on that is not defensible.

⚠️ Migrations on this project run on production deploys only and must be
idempotent (`CREATE TABLE IF NOT EXISTS`). Read the migration section of
`CLAUDE.md` before writing one, and check the build log for
`in sync with your Prisma schema`.

---

## 4. Routes

Follow the house pattern exactly: `rateLimit → zod → auth gate → prisma →
handleError`, and set `Cache-Control` from day one.

| Route | Method | Cache | Notes |
|---|---|---|---|
| `/api/quiz/session` | POST | `private, no-store` | Starts a run, returns N questions **without** `answerIndex` |
| `/api/quiz/answer` | POST | `private, no-store` | Grades one answer server-side, returns correctness + explanation |
| `/api/quiz/leaderboard` | GET | `public, s-maxage=300, stale-while-revalidate=600` | Top N, handles only |
| `/api/quiz/admin/questions` | POST/PATCH/DELETE | `private, no-store` | `quiz:manage` permission |

### The one rule that matters

🔴 **The client never receives the correct answer before it answers.**
`/api/quiz/session` strips `answerIndex`; `/api/quiz/answer` grades on the
server against the run's stored snapshot. Anything else is a leaderboard anyone
can top by opening devtools.

Rate limits: `quiz` (per user, ~30/min) and `quizIp` (per IP). Use **two
independent keys** the way login and OTP do, so neither IP rotation nor a fixed
target bypasses it. See the convention in `CLAUDE.md`.

---

## 5. Live question generators

Each generator is a pure function from the comps payload to a question. Pure
means testable, and these must be tested, because a generator that can produce
an ambiguous question will eventually produce one in front of a user.

```ts
type LiveGenerator = (venues: CompVenue[]) => LiveQuestion | null;
```

Returning `null` is a first-class outcome: not enough data this cycle, skip it.

Four that work with data the page already has:

1. **Biggest venue** — "Which did the most 24h volume?" Four venues, one clearly
   largest.
2. **Listed or not** — "Which of these has no token yet?" Teaches the thing the
   whole page is about.
3. **Implied FDV** — "Peer X trades at $A on $B volume. Venue Y does $C. What
   does the multiple imply?" Four options, one computed correctly.
4. **Order the venues** — rank three by open interest.

### Guard every generator with these

- **Distinctness.** All four options must be different after formatting. Two
  options that both render `$1.2B` make the question unanswerable, and the
  formatter rounds, so check the *formatted* strings.
- **A real gap.** Reject the question if the top two differ by less than ~15%.
  "Which is bigger, $1.21B or $1.19B" tests nothing and feels like a trick.
- **Fresh data.** If the payload is older than its window, do not ask a "right
  now" question about it.
- **Deterministic shuffling.** Seed the option order from the run id, so a
  refresh cannot reroll the positions, and quantize any float that reaches an
  SSR'd attribute — `Math.sin`/`Math.cos` and friends differ in the last bits
  between Node and the browser (see `CLAUDE.md`).

---

## 6. Scoring

Keep it legible. A score nobody can explain is a score nobody trusts.

```
points = base(difficulty) + speedBonus
base   = 10 | 20 | 30      (difficulty 1 | 2 | 3)
speed  = max(0, 10 - secondsTaken)   capped at 10, floor 0
```

- **No negative marking.** It makes people stop guessing, and guessing then
  reading the explanation is how they learn.
- **Streak is by UTC day**, matching `lastRunDay`. Do not use the viewer's local
  day: this project has shipped React #418 hydration bugs twice from unpinned
  timezones. Render UTC through hydration and switch to local after
  `useHydrated()` if you want a local label.
- **The explanation is mandatory and always shown**, right or wrong. It is the
  entire educational payload; the score is just the reason to come back.

Anonymous runs are scored and shown, but not ranked. Ranking needs an account,
or the leaderboard is a bot.

---

## 7. UI

One route, `/points/quiz`, plus an entry card on `/points`.

- Build it from **`PointsPanel`** (`src/modules/points/components/PointsPanel.tsx`)
  so it inherits the page's header grammar and alignment for free. Do not
  hand-roll a card; that is how the eight-panel misalignment happened.
- One question per screen. A progress rail, not a timer bar — a visible
  countdown turns learning into anxiety, while the speed bonus still rewards
  knowing it.
- Answer → immediate colour + explanation → Next. Use `--data-up` / `--data-down`
  for right/wrong, never `text-mint-*`/`text-red-*`: those are dark-only and the
  light theme has already been fixed for exactly this once.
- Results screen: score, best, streak, the questions missed with explanations,
  and a share card reusing the existing `/tools/share` pattern.
- Respect the project's **narrow** `prefers-reduced-motion` policy: gate only
  heavy full-screen ambient effects, not the small transitions here.

---

## 8. Build order

Ship in this sequence. Each step is independently useful and independently
revertible.

1. **Schema + migration.** Verify in the deploy build log.
2. **Static questions only**, ~30 across the five topics, `published=false`.
3. **Session + answer routes**, with server-side grading and rate limits.
4. **The play UI**, flagged off. Turn it on for the owner only.
5. **Scoring + streaks.** Still no leaderboard.
6. **Leaderboard**, cached, handles only, `maskEmail` everywhere. Never expose
   an email — a site rule, not a preference.
7. **Live generators**, one at a time, each with its own test.
8. **Admin composer**, inline, the way the airdrop desk's composer works.

---

## 9. Definition of done

Same as everything else here: `npm run typecheck && npm run lint && npm run test
&& npm run build`, all green, before pushing. Plus, specific to this feature:

- A test proving `/api/quiz/session` response contains **no** `answerIndex`.
- A test per live generator proving it returns `null` rather than an ambiguous
  question on thin data.
- A test proving a run's stored snapshot is graded, not the live question row.
- Run the `pre-merge` skill: this adds routes and caching, which CI cannot see.

---

## 10. Honest cost note

This is on a Vercel Hobby plan where Fast Origin Transfer, ISR Writes and Fluid
Active CPU are each rationed and have each caused a real incident. A quiz is
mostly `private, no-store` writes, which do not hit ISR, but the leaderboard is a
public cached GET and needs its window sized against any client poll — and
registered in `TARGETS` in `markets-poll-alignment.test.ts` if it ever polls.
Load the `cost-check` skill before wiring it up.
