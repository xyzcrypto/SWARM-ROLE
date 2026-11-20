# XYZ Crypto Academy — operations notes

Code: `src/modules/academy/` (lib = server + pure rules, client = audio/voice/hooks,
components = UI, content = starter curriculum). Pages: `src/app/academy/*`,
`src/app/dashboard/academy`. APIs: `src/app/api/academy/*`, `src/app/api/admin/academy`.

## First deploy
Nothing to do by hand. `db push` creates the `Academy*` tables, and the first request
to any Academy page or API seeds the curriculum from `content/*.json` (`ensureSeeded`).

Curriculum ships in versioned batches (`SEED_BATCHES` in `content/index.ts`; the stored
version is `AcademyConfig.seedVersion`). A new batch is installed once on the next
request after deploy: its missing topics are created, existing ones are never
overwritten, and a topic an admin deleted from an older batch is not brought back.
Batch 1: the 14 core topics. Batch 2: Perp DEX Masterclass, On-chain Trading & Routing,
RWA, Crypto Prop Firms, Airdrop Masterclass, AI x Crypto, Quantum Computing.

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

## Migrations
Production syncs the schema with `db push` on deploy. `prisma/migrations/43_creators` and
`44_academy` record the same tables as idempotent SQL for anyone building a database by
hand or auditing the history.

## AneQue (the voice guide, said "Aneq")

Renamed from Nova. Scripted lines and curriculum recordings below; Live Talk is a
conversation: the browser records a short clip (voice-activity detection ends it),
`/api/academy/aneque/listen` transcribes it with Whisper (same Groq key as XYZ AI; the
browser's own recogniser is not used because Brave cannot reach its service), commands
like "open leaderboard" act locally, and anything else goes to `/api/academy/aneque/chat`
(the XYZ AI gateway, plans and daily limits) whose answer is spoken by the browser voice.
While a quiz question is open the prompt forbids giving it away. Without a Groq key Live
Talk says it is unavailable; everything else keeps working.

## Voice recordings
- Scripted lines: `client/voice-lines.ts`, each with `public/academy/voice/<key>.mp3`.
- Curriculum text (prompts, options, explanations, lesson summaries):
  `public/academy/voice/c/<sha1(text)[:16]>.mp3`, listed in `content/voice-manifest.json`;
  `lib/voice.ts` attaches a clip URL only when the exact text has one.
- Voice: Kokoro `af_heart`, 24 kHz mono mp3 (48 kbps lines, 32 kbps curriculum). Tests fail
  if a line or a manifest entry has no file.
- Edited or new questions simply have no clip and are read by the browser's best female
  voice. To record new text, render it with the same voice and settings, name it by the
  hash, and add the hash to the manifest.

## Tunables
Everything numeric (points per difficulty, seconds, speed/streak bonuses, daily XP cap,
repeat cooldown, lesson XP, live XP, levels, achievements) is in **Rewards & rules**.
Defaults: `lib/config.ts`. Changes apply to future results only; the ledger is never
recalculated.
