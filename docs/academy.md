# XYZ Crypto Academy — operations notes

Code: `src/modules/academy/` (lib = server + pure rules, client = audio/voice/hooks,
components = UI, content = starter curriculum). Pages: `src/app/academy/*`,
`src/app/dashboard/academy`. APIs: `src/app/api/academy/*`, `src/app/api/admin/academy`.

## First deploy
Nothing to do by hand. `db push` creates the `Academy*` tables, and the first request
to any Academy page or API seeds the 14 starter topics from `content/*.json`
(`ensureSeeded`). Seeding never overwrites a topic that already exists by slug.

## Who can administer
Super Admins, or staff granted **`academy:manage`** (Access tab on /dashboard).

## Periods, winners and certificates
- Periods are UTC: day 00:00 UTC (05:30 IST), ISO weeks from Monday, calendar months.
- There is no cron. The first leaderboard request after a period ends closes it
  (`finalizeDuePeriods`, run in `after()`), or press **Close finished periods now** in
  the admin Certificates tab. Each period closes exactly once.
- Award rules (top N, minimum XP, auto vs admin approval) are in **Rewards & rules**.
  With auto off, winners appear as *pending* in the Certificates tab to approve.
- All-time certificates are never automatic: issue them as *milestone* or *event*.
- Verification page: `/academy/certificate/<CODE>`; PDF: `/api/academy/certificates/<CODE>/pdf`.

## Live quizzes
Schedule in the admin Live tab. A scheduled quiz starts by itself at its time; **Start
now** starts it 6 seconds later. Timing is a pure function of the start time, total paused
time and the per-question/reveal durations (`livePhase` in `engine.ts`), so there is no
process to keep alive. Pause freezes the clock; End awards immediately.

## Nova's voice
Scripted lines live in `client/voice-lines.ts`; each has `public/academy/voice/<key>.mp3`
(Kokoro `af_heart`, 24 kHz mono, 48 kbps). A test fails if a line has no clip. To add a
line: add it to `voice-lines.ts`, render it with the same voice, drop the mp3 in. Free text
(questions, explanations) uses the browser's speech engine with the best female voice.

## Tunables
Everything numeric (points per difficulty, seconds, speed/streak bonuses, daily XP cap,
repeat cooldown, lesson XP, live XP, levels, achievements) is in **Rewards & rules**.
Defaults: `lib/config.ts`. Changes apply to future results only; the ledger is never
recalculated.
