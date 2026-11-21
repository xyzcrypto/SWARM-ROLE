# XYZ Crypto — Changelog

Newest first. **Update this after every design change** with: date, files
changed, components changed, design improvements, performance improvements.

---

## 2026-11-21 (167) — Academy hero fits one screen; numbers and certificates move below it

- The hero stage now holds only the intro (greeting, headline, copy, buttons, and the
  quick tiles on phones) and the daily-challenge ticket. On desktop the copy column is
  centred against the ticket, and the whole hero fits the first screen at 1440x900 and
  1366x768.
- The stat tiles, track rail, activity ticker, promises and "Latest certificates" are
  now their own strip directly under the hero: the numbers on the left, certificates
  on the right (stacked on phones).
- Phones: the stat labels fit their tiles ("QUESTIONS" was cut off).

---

## 2026-11-21 (166) — Nothing gets stuck: quiz, AneQue's voice, navigation; Academy hero v6

- **AneQue's voice in order.** A clip that failed fired both `onerror` and the rejected
  `play()`, so the line was read twice and the queue jumped a piece (she talked over
  herself and skipped one). Every piece now ends exactly once. A clip that stalls is
  read by the browser voice after 8 s. A clip that never sends `ended` is skipped
  after its length plus 2.5 s. Browser speech gets the same guard. The next clip is
  preloaded while the current one plays.
- **Voice files are cached** (`next.config.mjs`): scripted lines for a day, hashed
  content clips for 30 days. Before, every clip was revalidated on every play, which
  left a gap between her lines on phones.
- **Quiz never sits on a dead request.** Every step (load, answer, next, finish) and
  the live arena retry a dropped connection or a 5xx (`withRetry`). 4xx answers are
  final. Coming back to the tab after more than 3 s re-reads the real state, so a
  question that timed out while the phone was locked no longer shows frozen.
- **Site-wide:** if a page change is still waiting on the server after 10 s, the
  click finishes as a normal page load. This only happens when a router request is
  actually in flight, so a click handler that cancels navigation is left alone.
  Four modals had hand-rolled scroll locks that could leave the page unscrollable
  when two overlays closed out of order; they now use the shared nested-safe lock.
  `<html data-scroll-behavior="smooth">` lets Next skip the smooth scroll on route
  changes.
- **Academy hero v6:** a lit glass stage (slow aurora light, dot grid, gold hairline)
  and a bigger two-line headline: "Master **Web3.**" with the shine, and "Prove it on
  the leaderboard." with the shimmer. New copy mentions the English and Hinglish
  voice. Stats are four glass tiles; questions and tracks show at once, with no
  loading dashes. On phones the stage runs nearly edge to edge.
- **Academy fixes:** the Weekly performance chart was always empty (each column had
  zero height, so every bar was a percentage of nothing). The "14 topics" copy now
  shows the real count (21). Lesson meta no longer wraps on 8-lesson tracks. Cards
  get a soft top light and a gold edge on hover, and section titles are larger.
- Tests: `academy-unstuck.test.ts`.

---

## 2026-11-21 (165) — Academy in Hinglish, with AneQue's voice; every lesson and answer explained aloud

- **EN / Hinglish switch** in the Academy bar (remembered per browser). Hinglish covers every
  lesson (title, summary, objectives, sections, key concepts, worked example), every quiz
  question, option and explanation, the live arena and the results review — 5,380 strings,
  written in Roman-script Hinglish, plus all 250 of AneQue's scripted lines.
- **Voice:** every Hinglish string has its own recording (Sarvam Bulbul v3, speaker
  "Simran", 48 kHz) under `public/academy/voice/h/<hash>.mp3` and `voice/hi/<line>.mp3`,
  listed in `content/voice-manifest-hi.json` (5,380 + 250 clips, ~285 MB).
- **Explained aloud:** right answers are now explained too (setting "Explain right answers
  too", on by default), each explanation has a "Hear the explanation" button, and
  "Listen to this lesson" reads the summary, every section and the example in recorded
  clips (622 new English section/example clips).
- **Live Talk** answers in natural Hinglish when the switch is on.
- Cost: static files only, served from the CDN; no new routes, no new polling.
- Gate: `HINGLISH_READY` (client) is now `true`; `academy-hinglish.test.ts` fails if any
  Hinglish string or scripted line lacks a recording.

---

## 2026-11-20 (164) — Academy hero v5: a structured, app-like phone layout

- Phones read like an app home screen: greeting + live badge, a tighter balanced headline
  ("Web3." in gold), Start Learning and Live Quiz side by side with a compact AneQue button,
  then four quick-action tiles (Daily, Quick quiz, Ranks, Certificates), then today's
  challenge card, then the numbers, tracks and promises (a single scrollable chip row).
- Done with CSS grid areas, so desktop keeps copy-left / card-right with no duplicate markup.
- The "—" placeholders: the stats show a shimmer while loading, and the pulse request retries
  once (a cold start used to leave dashes up until the next refresh).

---

## 2026-11-20 (163) — Smoothness round 2, live market prices, AneQue on Markets/News/Points, share cards, premium certificate, public profiles

### Smoothness (owner's top priority)
Measured with a throttled-phone navigation stress test (Pixel 7, 4× CPU, real link clicks)
and CPU profiles, then fixed what the profiles named:
- **Audio engine no longer built on page load.** Without a user gesture the browser refuses
  sound anyway, so `tryAutoUnlock()` now skips building the graph. The reverb (~200k
  generated samples) is built in idle time with a fast PRNG instead of `Math.random`/`Math.pow`.
- **framer-motion `layout` measurement removed** from lists that re-render often (Academy
  leaderboard rows and podium, live arena standings every 250 ms, Creators X/YouTube boards),
  and the leaderboard's shared-`layoutId` tab pill became CSS. Each of these re-measured
  the whole list with `getBoundingClientRect` on every render.
- The leaderboard's 5-second whole-board ticker is gone (`<Ago>` ticks itself).

### Requested changes
- Desktop nav: **Community moved into "More"** (rail: Home, Markets, Points, News, Research,
  Academy, Creators).
- Home hero: the "The Home Of Next Gen Web3.." line is removed; the NEW launch chip stays.
- **Who we are** realigned: equal columns centred against each other, the eyebrow no longer
  stretches, Learn/Trade/Earn link to Academy/Markets/Points, the trust card sits under them.
- Products → **Web3 Academy now opens /academy** (it went to /research); the orbital
  "Education" node too.
- Academy hero: the headline is three lines that fill the column on desktop, and the space
  under the today-ticket shows the latest certificates and live-quiz status.

### Markets: real-time prices
- The heatmap had a Binance socket removed because the CSP blocked it; it then refreshed every
  3 minutes while still labelled "Binance WebSocket Feed". New `markets/lib/live-prices.ts`:
  one shared socket to Binance's public market-data stream (`wss://data-stream.binance.vision`,
  now in `connect-src`), subscribing only to the symbols on screen, batched into React about
  once a second, closed while the tab is hidden, falling back to the polled data after
  repeated failures. A 25% sanity guard ignores a same-ticker different asset.
- Used by the heatmap, the coin table (now shows "Live prices") and the site ticker. Labels
  now say what is true ("live" only while the stream is up).

### AneQue on Markets, News and Points
- Her dock is lazy-loaded on those pages (separate chunk, no SSR). **"Explain the market" /
  "Read me the top stories" / "Explain the points programs"** speak a brief built at that
  moment from the data on screen (live prices included), with recorded intro/outro lines.
- Live Talk sends that same data with the question, and the prompt tells her to use those
  figures and never invent numbers. Page greetings by name on all three pages.

### Academy premium
- **Certificate v2**: guilloché pattern, gold-foil headings, wax seal, signature; black and
  gold on dark, **ivory paper on the light theme** (QR on a dark tile so it still scans).
- **Share cards** (1200×630, Geist fonts bundled): certificate (its link preview), quiz score
  and leaderboard rank, with share pages (`/academy/s/quiz/[id]`, `/academy/s/rank/[handle]`)
  whose previews are the cards. A share sheet (native share with the image, X, WhatsApp,
  Telegram, copy, download) on certificates, quiz results and the leaderboard.
- **Leaderboard**: "+N XP to pass <name>", period reset countdown, share-my-rank.
- **Live Talk**: one automatic retry on network blips, Whisper's silence hallucinations
  ("Thank you.") ignored, natural/neural voices preferred at their own pitch.
- Answers: a right answer pops with a ring and a sweep, a streak of 3+ shows a banner.

### Profiles and feedback
- **Public profile** shows Academy level and XP bar, quizzes, accuracy, streak, achievements,
  certificates, recent quizzes (each opens its score card) and feedback sent/shipped/badges.
- **Public / private** setting (Settings → Privacy): private shows only name and photo.
- Feedback: **attach a screenshot** (compressed in the browser, verified by magic bytes on the
  server, stored like other images); the owner's email/Telegram links it and the admin
  dashboard shows it.
- Migration `46_profile_visibility` (additive, idempotent): `User.profileVisibility`,
  `Feedback.image`.

---

## 2026-11-20 (162) — Academy + Creators in the main navigation; home quick links removed

- **Home hero:** the Markets / Points / Academy / News / Creators quick-link row (added in
  #161) is removed on desktop and mobile, at the owner's request. The slogan "The Home Of Next
  Gen Web3.." is back as the first line, with the NEW launch chip under it.
- **Desktop navbar:** Academy and Creators are on the rail (8 links: Home, Markets, Points,
  News, Research, Academy, Creators, Community; "More" keeps Saved, Premium, Feedback, Tools,
  Contact). The rail has overflowed twice before when a link was added, so it was
  re-measured on a production build at 1280-1920px, signed in and out. Signed in, the first
  attempt overflowed by up to 130px. Two changes make it fit:
  - rail padding steps up with the width (`px-2`, `2.5` from 1366, `3` from 2xl);
  - the account button shows only the avatar below 2xl (email + plan from 1536px; the
    dropdown still shows the account).
  Minimum room left over is now 36px at 1280 signed in. The logo and "XYZ AI" never wrap.
- **Mobile bottom nav:** Academy on the far left and Creators on the far right. That makes six
  links, seven cells, with Profile still exactly in the middle. Every label stays whole on a
  320px phone (46px cells).
- Tests: `nav-rail-width.test.ts` pins the 8-link rail, the measured slack, the width-saving
  classes and the 6-link bottom bar, with Academy first and Creators last.

---

## 2026-11-20 (161) — Smooth like butter: no lost taps, no endless spinners, native scrolling, one-screen quiz

The owner reported the site as slow and laggy, sometimes stuck until a refresh, and asked
for the quiz to fit on one screen. Everything below was measured locally first (Playwright,
CPU profiles while scrolling, the same quiz on five devices).

### Why it felt stuck
- **The first tap on Academy pages was swallowed.** AneQue's greeting bubble grows when she
  starts talking, and on phones it rose over the page: the tap on "Start quiz" (or anything
  under it) landed on the bubble and did nothing, so people tapped again or refreshed.
  Reproduced on an iPhone 13 profile. The bubble now lets taps through (only its own X and
  "Tap to hear" buttons are clickable) and its caption is capped at 3 lines.
- **Requests could hang forever.** Academy `getJson`/`postJson` now time out after 15 s
  (Live Talk after 35 s) with a readable "connection is slow, try again" message instead of
  a spinner that never stops. A failed quiz time-out is retried, so a question can no longer
  sit at 0 s.
- **Clicks on server-rendered pages gave no feedback.** New `NavProgress`: a thin gold bar on
  every internal link click until the page is on screen (no React state, gives up after 12 s).
  New skeleton `loading.tsx` for the Academy, lessons, `/markets/[id]`, protocol pages and
  `/news/read`.

### Why it lagged
- **Lenis smooth-scroll removed.** It drove the page scroll from JavaScript on every frame,
  so any other work made scrolling stutter (profiled: `scrollTo` ~1 s of CPU in 6 s on
  /news). Native scrolling runs on the compositor and cannot be blocked by JS. Main-thread
  idle time while scrolling /news went from 1.3 s to 3.0 s of 6 s.
- **Navbar scroll handler removed** (it is on every page). Reading `scrollY` in a scroll event
  forced a layout each time (~600 ms per 6 s of scrolling on /news); an IntersectionObserver
  sentinel gives the same "scrolled" state for free. Same for the home sticky CTA. The news
  reading bar no longer re-renders on every frame.
- **Quiz:** only the countdown re-renders 5×/s now (`QuizClock`); it used to re-render the
  whole question, options and their animations. AneQue's captions re-render per word instead
  of per frame (up to three on screen), and her voice level is read once per frame.

### Quiz on one screen (desktop + mobile)
- While a question is up the page is exactly the viewport: the Academy tabs hide, and on
  phones/tablets the bottom nav, XYZ AI button and AneQue orb step aside (an AneQue button sits
  in the quiz header instead). Timer, question, all four options and Next are always visible;
  only a very long explanation scrolls inside the card. Short screens (iPhone SE) get tighter
  type. Verified with page height = screen height on 1440×900, 1280×720, iPhone 13,
  iPhone SE and Pixel 7. Live quizzes use the same frame.

### Also
- Academy hero: AneQue's strip no longer overlaps the Talk button (status replaces the
  subtitle on one line).
- Home hero: a "New" chip with the latest launch above the headline, and quick links to
  Markets, Points, Academy, News and Creators.
- /feedback: **Top voices** (most feedback in 30 days, shipped count), from
  `GET /api/feedback/board` (public, `s-maxage=300`).
- Dashboard What's New: a note that recent entries also appear in the home popup.

### Tests
- `smooth-r6.test.ts`: bubble tap-through, request timeouts, NavProgress + skeletons, no scroll
  handlers in Navbar/StickyCta, clock isolation, per-word captions, play mode. Lenis tests in
  `route-scroll` and `news-bugs` now pin its absence.

---

## 2026-11-20 (160) — Launch popup on the home page, gamified /feedback with XP, AneQue greets members by name, Academy hero v4

### Launch popup (home page)
- `shared/components/LaunchPopup.tsx` + `shared/utils/launches.ts`. New launches (Feedback,
  AneQue Live Talk, the advanced tracks, Creator Index) plus admin What's New entries from the
  last 7 days, one card at a time with Next. Close with X; otherwise it **closes itself after
  9 s** (progress bar, paused while hovered or touched). Only cards actually shown are marked
  seen (localStorage), so the next visit leads with the next launch. Built after mount, so no
  hydration risk; bottom-left on desktop (XYZ AI owns bottom-right), above the bottom nav on
  phones. A launch retires on its own 21 days after its date.

### /feedback (new page, static shell)
- Three steps: topic cards, emoji rating, message with a live "how useful" meter, optional
  **voice dictation** (members, through AneQue's Whisper route). AneQue welcomes by name and
  reacts to each choice in her recorded voice, with sound effects, optional Focus music and
  confetti + XP count-up on send. Badges (First Feedback, Bug Hunter, Idea Machine, Community
  Voice, Shipped It), XP rules and the member's history with status (Sent / Seen / Shipped).
- XP through the Academy ledger: **+40** for the first feedback each UTC day, **+60** once for
  the first ever, **+100** when staff mark it done. All idempotent ledger keys.
- Guests can send too (optional name + email/Telegram); a honeypot field drops bots.
- `POST /api/feedback` (rate limited per IP 6/h and per member 5/h, zod, `after()` alert),
  `GET /api/feedback/mine`, `GET/PATCH /api/admin/feedback` (`feedback:manage`, 120/min).
  Every route `private, no-store`.
- **The owner is told on every send:** `notifyOwner` emails `site.email` and posts to the
  Telegram bot (both no-op if unconfigured). Staff triage on **/dashboard/feedback**
  (new "Feedback ↗" tab), with filters, stats and Seen / Done / Reopen.
- New `Feedback` model + `prisma/migrations/45_feedback` (idempotent, additive). Added to the
  nav (in "More"), footer, drawer and sitemap.

### AneQue greets by name (Academy)
- Opening any Academy page: "Hey Riya!" in her recorded voice (290-name bank, browser voice
  for other names), then time of day + streak/daily status on the first page of a session,
  or a short page line on the library, leaderboard, live and certificates pages.
- Plays straight away when the browser allows sound, otherwise a "Tap to hear AneQue" bubble
  waits for the first tap. 29 new recorded lines (greetings + the feedback room).
- The leaderboard's own "top 10" line now queues behind the greeting instead of cutting it.

### Academy hero v4
- Personal eyebrow ("Good evening, Riya" for members, tracks/questions for guests), a third
  CTA "Ask AneQue", a scrolling rail of the real tracks (from the catalog, linked), a glass
  stats strip, and four promises (free, server-scored, verifiable certificates, voice tutor).
- Today ticket: animated gold ring, soft glow, and a desktop-only pointer tilt + sheen written
  as CSS variables (never a render input; touch screens never get it).

### Tests
- `feedback-greet.test.ts` (14): quality meter, badges, name parsing, name-bank clips exist,
  greeting builder, page mapping, launch windows, popup auto-close 5-10 s.
- Nav rail test now lists `/feedback` in "More".

---

## 2026-11-20 (159) — Academy: AneQue Live Talk that works in every browser, 7 advanced tracks, certificate showcase, haptics

### AneQue (renamed from Nova, said "Aneq") and Live Talk
- **Why Live Talk failed:** the dock used the browser's Web Speech recogniser. Brave ships the
  API but cannot reach Google's speech service ("Speech service unreachable", the owner's
  screenshot), Firefox has no API, Safari needs Siri. Now the browser records a short clip
  with MediaRecorder, a small voice-activity detector ends it when the learner stops
  talking, and `POST /api/academy/aneque/listen` transcribes it with the Whisper model the
  site already uses for voice notes (handles Hinglish). Audio is never stored.
- **Conversation:** commands ("open leaderboard", "start quiz", "option B") act locally;
  anything else goes to `POST /api/academy/aneque/chat` (XYZ AI gateway, plans, daily
  limits, concurrency slot), answers are short and spoken. AneQue knows the page, lesson
  and topic; **while a quiz or live question is open the prompt forbids giving it away**
  (pinned by a test). Hands-free loop until "End talk"; a mic meter while listening.
- 13 new recorded lines (intro, listening, retry, unavailable, sign-in, limit, navigation).
- Long browser-voice speech is now chunked by sentence: Chrome silently stopped single
  utterances after ~15 s, cutting long explanations off.

### Learn: batch 2, seven advanced tracks (46 lessons, 230 questions)
Perp DEX Masterclass (8 lessons: architectures, platform deep dives, oracles/ADL, vaults,
execution, failure modes), On-chain Trading & Routing (aggregators, MEV, intents, Bungee and
other route aggregators), Real-World Assets, Crypto Prop Trading Firms, Airdrop Masterclass
(8 lessons, basic to sybil detection and taxes), AI x Crypto, Quantum Computing & Crypto
Security. Written with web-verified claims; anything unverifiable or time-sensitive left
out. Every lesson has its knowledge check; every topic its Topic Challenge.
- **Versioned seeding** so the new batch reaches production, which already has batch 1:
  `SEED_BATCHES` + `AcademyConfig.seedVersion`; deleted topics are never resurrected.
- Every new question, option, explanation and summary recorded in AneQue's voice.

### Quiz, leaderboard, certificates, haptics
- "Quiz any lesson": pick a topic, start any lesson's check from the quiz page.
- Leaderboard edge window 15s to 5s, refetch on every XP ping (min 5s apart), "Live ·
  updated Ns ago".
- Certificate showcase on the Academy home: the real certificate design as a labelled
  sample (decorative pattern, not a scannable QR), pointer tilt and sheen, how to earn
  each award, and the roadmap note.
- Haptics paired with the sound effects (Android), its own switch, using the site's feel
  settings; works even when sound is muted.

### Hero
AneQue "Talk" button opens Live Talk directly; "Dominate the leaderboard." with the brand
shine; a ticker of real recent achievements and certificates; tighter tab bar on phones
with an edge fade.

---

## 2026-11-20 (158) — Light theme for Creators + Academy, a hand-made Academy hero, Nova captions, realistic sound

### Light theme
A light-theme contrast audit (every visible text element against its real background, in
a browser) found the failures behind the owner's screenshots, then confirmed **0 below 3:1**
across /creators (all three tabs) and seven Academy pages after the fix.
- Site-wide light twins for dark fills that had none: `bg-ink-900/70` (the Creators handle
  input), `bg-ink-800/60`, `bg-ink-800/50`, `bg-ink-700(/70)`, the `hover:bg-ink-*` row hovers
  (the black band with black text on "This week on X"), `bg-black/70` overlays, and the
  alpha gold/red text variants (`text-gold-300/90` eyebrows were 1.5:1).
- Academy light styles: icon buttons, sliders, dock button, answer states, podium, your-row.

### Academy hero
Rebuilt to look like product, not decoration: the glowing sphere, particle network and
all-caps headline are gone. Real content only: today's daily challenge with a live
countdown to the 00:00 UTC rollover and your result, your streak and level, this week's
top three, live activity as plain numbers, and Nova as a voice strip. Ticket-style card
with a perforated tear line; ruled-paper texture; aligned two-column on desktop, stacked
on phones with side-by-side CTAs.

### Nova
- Captions reveal word by word in time with her voice (clip position for recordings, word
  boundaries for the browser voice).
- A live waveform that follows her real loudness, in the hero and the dock.

### Sound
- New instrument voices instead of beeps: marimba-like plucks, FM bells, electric-piano keys,
  soft thuds. Correct, wrong, coin, level-up, achievement, countdown, lock and reveal all
  redesigned.
- A shared room reverb (generated impulse) for effects and music; slight stereo spread.
- Humanised playback: a few ms of timing and ~15% velocity variation per note, swing on
  Arena and Night. Night adds electric-piano chords and faint vinyl dust; Focus uses
  chorused pads with a breathing filter.

---

## 2026-11-20 (157) — Creators: YouTube venues failed to save on a split emoji

The owner's screenshot finally carried the real code (thanks to #154): "Invalid
`prisma.ytDiscovery.upsert()` invocation: unexpected end of hex escape at column 179045".

### Cause
Video descriptions were cut with `String.slice(0, 1500)`. When the cut landed inside an
emoji, a lone surrogate was left behind; JSON keeps it as `\ud83d`, and Prisma's engine
rejects the whole JSON payload. One such description failed the save of an entire venue's
discovery, so the tab showed the error instead of any videos, and the quota spent on the
search was wasted. Reproduced locally with the identical message. A NUL character in any
text (`\u0000`) fails the same way in Postgres ("unsupported Unicode escape sequence").

### Fix
- `src/modules/creators/lib/text.ts`: `cleanText()` truncates by code point and drops lone
  surrogates and NUL. Used for YouTube titles, descriptions and channel names, and for X
  names, bios and post text (same risk in `twitterapi.ts`).
- `api/creators/youtube`: the fetched videos are kept in memory and served even if storing
  them fails, so a database hiccup can no longer turn spent quota into an error screen.
- Tests: `creators-text.test.ts`.

---

## 2026-11-20 (156) — Academy round 2: Nova reads everything, 3 music tracks, lifelines, Mistakes + Speed Run, migrations, alignment fixes

### Migrations
- `prisma/migrations/43_creators` and `44_academy`: the Creators and Academy tables had
  reached production only through `db push`. Both are idempotent (IF NOT EXISTS,
  DO-blocks for foreign keys). Verified on a fresh database: main's schema, then both files
  twice, then `prisma migrate diff` against `schema.prisma` reports an empty migration.

### Nova, about 46x the voice
- 198 scripted lines (was 42): greetings by time of day, question cues (first, halfway,
  last, "question five"), ten "correct" and seven "wrong" variants, fast-answer and streak
  calls (3/5/7/10, streak broken), time warnings, 50:50, results by score band, every level
  and achievement by name, streak days, rank moves, challenge win/lose/tie, leaderboard tabs,
  and live countdown 3-2-1-go, lock-in, reveal, halfway, last question, pause/resume, winner,
  podium.
- **Every question, option, explanation and lesson summary of the curriculum** recorded in
  her voice (~1,700 clips, named by a hash of the exact text, 32 kbps mono). Questions are
  read as they open, options on demand (R key, button, "repeat question"), and explanations
  after a wrong answer. Admin-edited text has no clip, so the browser voice reads the new
  wording instead of a stale recording. Settings: "Read each question aloud" and "Explain
  wrong answers aloud".
- Lessons: "Listen to this lesson" (summary in Nova's voice, then each section).
- Voice queue: lines play in order instead of cutting each other off; music ducks while she
  talks.

### Sound
- Three generative tracks on one look-ahead scheduler: Focus (pads), Arena (112 bpm pulse:
  kick, hats, bass, plucked arp) and Night (76 bpm lo-fi keys). Auto plays Focus while
  reading and Arena while playing.
- New effects: hover, coin, countdown, heartbeat (last 5 seconds), 50:50, streak fire,
  answer lock, live reveal roll, pop; a gentle compressor on the master bus.

### Features
- **50:50 lifeline**: two per quiz, removes two wrong options server-side (seeded, so a
  resume shows the same two), that answer keeps half its points. Off in Daily, Weekly and
  Challenge so everyone plays on equal terms. Key F.
- **Mistakes mode**: replays the questions whose latest answer was wrong, until they are
  right.
- **Speed Run**: easy and medium only, 12 seconds each, +30 XP bonus.
- All three tunable in Rewards & rules.

### Fixes
- Sections that waited for `whileInView` stayed invisible after a fast scroll or an anchor
  jump (Continue learning, achievements, modes, library, weekly chart). All Academy reveals
  now run on mount; a test keeps `whileInView` out of the Academy.
- `/api/academy/me` was fetched two or three times per page (one per component); now one
  shared request.
- **Site-wide: `sm:text-base` painted text in the page background colour.** The semantic
  `base` colour (`var(--bg)`) was a global Tailwind colour, so `text-base` was ALSO
  generated as a colour utility, and the `sm:` variant (ordered after colour classes)
  overrode the element's real colour. Found as an invisible tagline on Academy topic pages;
  the same class is on 9 elements (Markets heatmap and charts, Points hero, portfolio,
  explainer player). `base` now lives only in `backgroundColor` and `gradientColorStops`,
  so `bg-base`, `from-base` and `to-base` are unchanged and `text-base` is font-size only.
- Podium centred when only one or two people are on the board.
- Results/timer: the ring shows the time you answered in instead of a dash.

---

## 2026-11-20 (155) — XYZ Crypto Academy: lessons, server-scored quizzes, leaderboards, live multiplayer, Nova voice guide, certificates

A new section at **/academy**, built on the existing stack (Next 16, Prisma/Postgres,
next-auth, Supabase Realtime broadcast, Upstash limits). Ops notes: `docs/academy.md`.

### What members get
- **Learn:** 14 topics × 4 levels (Beginner → Expert) = 56 lessons with objectives, short
  sections (read-aloud), tap-to-reveal key concepts and a real-world example. A lesson
  completes when its knowledge check scores ≥ 60%.
- **Quiz engine:** Quick, Topic, Advanced, Daily (same 10 for everyone, once a day), Weekly
  (20, once a week), lesson checks and "Challenge friends" replays. 5/10/15/20 questions,
  easy → expert, timer, streak flame, instant explanations, keyboard (1-4, Enter) and voice
  commands, results with accuracy ring, XP breakdown, level/rank movement and answer review.
- **XP, levels, streaks, 14 achievements**, all configurable by admins.
- **Leaderboards:** Daily / Weekly / Monthly / All-time from the XP ledger (UTC periods,
  ISO weeks), gold/silver/bronze podium, rank-movement arrows, username search, "your
  position", pagination, realtime refresh.
- **Live Quiz Arena:** scheduled rooms that auto-start, waiting room, synced countdown, same
  question for everyone, answers revealed together with the vote split, round leaderboard,
  winners, XP and certificates. Host start/pause/resume/end/cancel.
- **Nova, the voice guide:** 42 pre-recorded lines in a natural female voice (Kokoro
  af_heart, generated offline, 1.3 MB total, fetched on use) plus the browser's best female
  voice for questions/explanations. Captions always, play/pause/replay, mute, volume, voice
  picker, "speaks on her own" toggle, optional mic commands (permission only on tap).
- **Sound:** synthesised SFX and an ambient music bed (Web Audio, nothing licensed), master /
  music / effects / voice switches and volumes, persisted, nothing before a user gesture,
  music ducks while a question is open.
- **Certificates:** daily/weekly/monthly champions (closed after the period ends), live
  winners, and admin-issued event/milestone awards. Unique ID, QR, public verification page,
  A4 PDF (pdf-lib), share to X, revoke/approve.
- **Admin (`/dashboard/academy`, permission `academy:manage`):** topics, lessons, question
  bank, scoring/XP/levels/award rules/achievements, live scheduling and hosting,
  certificates, XP grants, analytics. Every action audit-logged.

### Integrity
- The server picks the questions and the option order, times every answer from its own
  clock (+1.5s grace), scores it and writes XP. The browser only sends "I tapped option N".
- The open question never carries its answer (solo or live); live scores shown during a
  question exclude that question.
- XP is a ledger with a unique idempotency key per reward (`quiz:<attempt>`,
  `ach:<user>:<code>`, `live:<id>:<user>`…), written with ON CONFLICT DO NOTHING, so retries
  and double-submits pay once. One answer per question by primary key.
- Anti-farming: a question answered correctly for XP earns 0 XP again for 7 days, and quiz
  XP is capped per UTC day (2,500 by default).
- Period close and certificate issue are exactly-once (`AcademyPeriodClose` PK, unique
  `(kind, periodKey, userId)`).

### Cost
- `/academy`, `/academy/learn`, `/quiz`, `/leaderboard`, `/live`, `/certificates` are static
  shells (○). Lessons and topics are on-demand ISR (1 day, revalidated by admin edits); the
  certificate page 1h.
- Public endpoints carry `Cache-Control` from day one: catalog 300s, pulse 30s, leaderboard
  15s, live list 10s, live room 2s (collapses a full room into one origin call per phase),
  challenge 1h, PDF 1h. Personal endpoints are `private, no-store`.
- Nothing polls on a timer while realtime is up: boards refetch on a content-free
  `academy` broadcast, throttled client-side; the fallback poll (realtime down) is 120s,
  15s in a live room.
- No cron: finished periods close from the leaderboard route via `after()` (or the admin
  button).

### Content
280 questions, correct answers spread 5/5/5/5 across positions per topic, and rebalanced so
the right answer is the longest option in only ~25% of questions (was 61%). Tests pin this.

### Tests
`academy-engine.test.ts` (levels, scoring, streaks, UTC/ISO periods, seeded challenges, live
clock incl. pause, tie-break, certificate codes, config merge, answer-never-sent invariants)
and `academy-client.test.ts` (voice commands, audio settings, every line has a clip, content
validity, no em dashes). End-to-end in a real browser: lesson → check → results, quick quiz
with wrong answers, leaderboard, admin schedule → learner join → countdown → answer →
reveal → host end → winner certificate → PDF, desktop and iPhone 13, zero console errors,
no horizontal overflow.

---

## 2026-11-20 (154) — Creators: YouTube loads in the background, and the page says why when it can't

The owner reported the YouTube tab still showed "YouTube didn't respond just now" after #153.

### Diagnosis
- **The "All venues" request discovered every missing venue inline.** With an empty
  `YtDiscovery` store, one request ran 2+ searches for each of 10 venues back to back. The
  route had no `maxDuration`, so the function timed out before it could save anything.
  The browser got an HTML error page instead of JSON, which showed the generic message.
  Every retry spent quota again and stored nothing.

### Fix (`src/app/api/creators/youtube/route.ts`)
- **Discovery moved off the request path.** Stored venues are served at once. Missing or
  old venues are refreshed after the response with `after()`, at most 3 per request, one
  at a time, stopping on a quota error. Only a single-venue request with nothing stored
  fetches inline. `maxDuration = 60`.
- **Partial and pending responses are `private, no-store`.** Only a complete answer gets
  the 600s edge cache, so a half-filled board is never cached for everyone.
- **202 `pending` while the first fetch runs; 503 with the API's own `reason` otherwise.**
  With the quota guard on, nothing is scheduled, so the answer is a 503 quota error, not a
  spinner that retries for nothing.

### UI (`CreatorsClient.tsx`, `YoutubeBoard.tsx`)
- New "warming" state: a spinner while the first fetch for a venue runs, retrying every 15s
  (up to 8 times). A small note shows when some venues are still loading.
- Error text always ends with the code, e.g. `(code: quotaExceeded)` or `(code: keyInvalid)`,
  so a screenshot tells us the cause.

### Verified locally
Against a fake YouTube API: "All venues" answered in ~20ms from the store and filled the
other venues in the background over the next requests. In quota mode one venue returned
503 `quotaExceeded`, the guard was set to midnight Pacific, and later requests made no
calls. typecheck, lint (51 warnings, 0 errors), 1595 tests, build all green.

---

## 2026-11-20 (153) — Creators: YouTube that survives its quota, and the wrong-venue data bug

The owner reported that YouTube data was not loading on /creators.

### Diagnosis
- **The YouTube Data API's free quota (10,000 units/day) was used up.**
  - Every deploy on 2026-11-19 bumped the discovery cache key, and each bump re-ran the full
    search for all 10 venues (~550 units a venue after #404/#405).
  - Live stats ran every 20 min on top of that.
- **The new `YtDiscovery` store (#405) had nothing to fall back on.** It only fills after a
  successful search, so with the quota gone it stayed empty and the tab showed nothing.
- **A second, real client bug:** switching venue when the request failed kept the previous
  venue's videos on screen under the new venue's chip. That reads as "Variational shows the
  wrong data". The X board had the same pattern.

### Fixes
- **Fewer units.**
  - Discovery is now 2 core searches per venue (all-time most viewed, plus the newest of the
    last 90 days), and extra phrases are best-effort.
  - The cost is ~205 units a venue (Variational ~405, Entropy ~305), down from ~550; ~2,550
    for all ten, once a day.
  - Live stats run every 30 min (was 20).
  - The old 90-day "most viewed" search and the second all-time page are gone. Live counts
    still come from `videos.list`, so the numbers are unchanged.
- **Quota guard.**
  - On `quotaExceeded`, `CreatorSync("yt-quota")` records the reset time (midnight Pacific,
    `nextQuotaReset`). No YouTube call is made until then; stored data is served.
  - The page says when fresh numbers return: "in about 5 hours", or the UTC time when nothing
    is stored yet.
- **One discovery per venue at a time:** `CreatorSync("ytdisc:<topic>")` holds a 5-min lock,
  so parallel instances cannot pay for the same search twice.
- **Discovery is no longer in `unstable_cache`.** A stale fallback cached there would have
  outlived the quota reset by up to a day. The DB is the cache, plus a 5-min in-memory copy.
- **Visible reasons.** The API's own reason (e.g. `keyInvalid`, `accessNotConfigured`) comes
  back in the response and is shown on the page, so a key problem shows up without logs.
- **Wrong-venue fix (X and YouTube):** a failed background refresh keeps the data on screen,
  but a failed change of filter shows the error instead of the previous filter's data.

### Verified locally
- **Guard active:**
  - Variational served the last good list with `stale` and the reset time.
  - GMX (nothing stored) returned `quota` with the reset time.
  - 0 YouTube calls were attempted.
- **Guard off, YouTube failing:** exactly 1 discovery attempt, then stored data on every later
  request. The real API reason was logged.
- **UI** (Playwright, desktop and iPhone):
  - Correct messages for both cases.
  - No Variational videos shown under GMX.
  - No horizontal overflow.
- **Tests** (37 in `creators.test.ts`): a plain venue makes 2 searches (205 units), a failed
  extra phrase does not throw, and the reset time is right in both PST and PDT.

Owner note: until the next reset the tab may show the quota message. For more headroom, a
second YouTube API key from another Google Cloud project doubles the quota.

---

## 2026-11-19 (152) — Arena: sound effects, background music, and audio settings

The owner asked for sound effects and background music in the Arena, with settings to turn
each off.

- **`arena-audio.ts`** (new): everything is synthesised with Web Audio, so there are no files,
  no network and nothing for the CSP to block. It is separate from the chat sounds, which
  follow chat settings.
  - **Effects:**
    - correct (rising major arpeggio)
    - wrong (low falling buzz)
    - combo (sparkle run on every 5-streak and on completing a squad)
    - start
    - game over (cadence)
    - click (mode buttons, picker, squad picks)
    - tick (the last 10 seconds of Rush)
  - **Music:**
    - A soft lo-fi loop, Am-F-C-G: bass, a low-passed pad, a quiet arpeggio and hats.
    - A lookahead scheduler keeps it in time. It plays faster in 60s Rush.
- **Behaviour:**
  - Music starts when a round starts (Play, the first Daily pick, Start quiz), because
    browsers only allow sound after a tap.
  - It pauses when the browser tab is hidden, resumes when it comes back, and stops when you
    leave the Arena.
- **Settings:**
  - Two toggles at the top of the Arena: **Sound on/off** and **Music on/off**.
  - They are saved in this browser (`xyz:arena:audio`) and read after mount, never during
    render. Both default to on. Turning music off fades it out immediately.
- **Fix found while testing:**
  - The bug: Higher or Lower and Head to Head chose X or YouTube once, at first render,
    before the X board had loaded. So they locked onto YouTube and said "Not enough
    creators".
  - The fix: they now follow whichever board has data until the player picks one.
- **Verified in Chromium**, desktop and iPhone, by counting started oscillators:
  - Play started sound and music (12). Answering added more.
  - With both toggles off there were 0 new sounds in 2 seconds.
  - The settings survived a reload, and there was no horizontal overflow.
- **Tests:** settings parsing (defaults, partial, corrupt and wrong-type values).

---

## 2026-11-19 (151) — Creators: YouTube that keeps working and stays accurate, Arena profiles that actually join, Rush mode, share of voice

The owner reported three problems:
- YouTube data "not working", and Variational's top creators wrong;
- added X profiles never appearing in Arena games;
- wanting a more fun Arena, and more accurate, more realtime X data with more features.

### YouTube: why it broke, and the fix
- **Likely cause:** quota exhaustion. Discovery lived only in `unstable_cache`, so each deploy
  that changed its key re-ran every search (100 units a call). Two key bumps in one day, plus
  10-minute live stats, can empty the free 10,000. When that happened the tab had nothing to
  show.
- **New `YtDiscovery` table.** Discovery results are stored. A row younger than 24h is reused,
  so deploys cost no quota, and a YouTube error serves the last good row. The page says
  "last good list" (`stale`) instead of going empty.
- **Relevance is now applied at read time** (`classify` → `topicsFor`), title first.
  - Discovery stores every hit unfiltered, so a rule change needs no new searches.
  - Every video is tagged with **every** venue its title names, so a Hyperliquid video found
    by the "perp dex" search counts for Hyperliquid.
  - Each section now shows only videos about that venue; verified locally per topic.
- **Maths / physics / ML titles are excluded** from Variational and Entropy (autoencoders,
  quantum, thermodynamics, lectures…).
- **Extra search phrases:** Variational adds "Variational Omni" and "Variational airdrop";
  Entropy adds "Entropy pre-IPO perps".
- **Live stats every 20 min** (was 10) and only for videos actually shown. That is about
  ~2,900 + ~4,500 discovery units, inside the 10,000/day quota with room for a redeploy.
- **Ranking** is unchanged and now spelled out on the panel: views (with a video-length
  credit), likes, comments, plus 25 points per video.

### Arena
- **"Add any X profile" now works.** It used to fail for anyone whose posts are mostly
  replies: under the originals-only rule they had 0 points, and the games silently dropped
  0-point entries.
  - Such a profile now falls back to counting replies, marked "replies counted".
  - It appears **immediately**.
  - It is kept for Head to Head and Squad even at 0 points.
- **Head to Head picker:**
  - The plain dropdowns are now a **searchable picker**: type to filter the board, or type
    any @handle and "Look up on X and add" in place.
  - The YouTube side searches every channel across all venues (the Arena loads its own
    all-venue pool).
- **Fun:**
  - A correct answer triggers a burst, and every 5 in a row gives a bigger "On fire!"
    burst.
  - Phones get haptics (tap on a correct answer, error buzz on a miss).
  - **New 60s Rush mode** for Higher or Lower: no lives, as many right as you can, with its
    own best scores.

### X
- **"Refresh from X" on a profile:** re-reads an account whose stored read is over 30 min old
  (rate-limited and budget-capped).
- **Share of voice:** each top creator's share of all points in the window, plus "everyone
  else".

### Verified locally
- **YouTube** (server with a failing YouTube key, DB rows seeded):
  - Fresh rows are served with no API call.
  - A 2-day-old row is served with `stale: true` when the API fails.
  - The ML lecture and a referral-only vlog are excluded.
  - Every returned video is tagged with the requested venue, and descriptions are 240
    characters or less.
- **Arena** (Playwright, desktop and iPhone):
  - The reply-only profile is added and appears in Head to Head.
  - The picker finds board creators and the added profile.
  - The Rush timer runs.
  - No horizontal overflow.
- **Tests:** 35 in `creators.test.ts`, including classification across venues, the academic
  exclusion and the extra search phrases. 1,593 total.

---

## 2026-11-19 (150) — Creators: accurate Variational X board (backfill, seeds, deep scans), originals-only, YouTube coverage, hero polish

The owner reported that the X board did not show the real top Variational creators (e.g.
@onchainmonk), and asked for accurate, realtime data, accurate YouTube data, and a more
modern, aligned UI.

### Why the X board looked wrong
- The indexer only ever read "Latest": a few pages per run, from the moment it was switched
  on. Established creators whose Variational posts are older were never fetched unless
  someone looked them up.
- So the board ranked whoever had posted since launch, not the scene.

### Fixes (`x-index.ts`)
- **Backfill:**
  - Each run walks back through history one week at a time, up to 180 days, taking that
    week's 5 pages of **Top** posts (`since:/until:` windows).
  - Progress is kept in `CreatorSync("backfill-state")`, and the status line shows "history
    back to <date>".
- **Seeds:**
  - Known Variational creators from the owner's reference board get a full history scan
    in the background: muarmemuar, onchainmonk, VictorTopDefiG, givenoxbt, linenmito,
    Ryuzaki_SEI, Muallimin_biri, corgil, me_cool_off, JoestarCrypto and Absoluto92.
  - After the seeds, the highest-ranked accounts never fully scanned get scanned too. Their
    totals then come from their whole history, not from sampled posts.
- **Originals only by default:**
  - Replies are excluded from ranking, totals, top posts, activity, topics and the profile,
    so "gm @variational_io" reply-farming cannot outrank real posts.
  - A toggle ("Originals only" / "Replies counted") switches them back on; `?replies=1` on
    both APIs.
- **Budget split:**
  - Background jobs (latest, rotation, backfill, deep scans) may use 75% of
    `TWITTERAPI_DAILY_ITEMS`.
  - The remaining 25% is always free for people's look-ups.
- **Time:** both X routes declare `maxDuration = 60`, and the indexer stops starting new work
  after 40s in a run.
- **Visible failures:**
  - The last indexer or scan error (24h) shows on the board.
  - An API error during a scan no longer reads as "no such account".
- **Board cache key `creators-x-board-v5`** (shape gained `replies`, `sync.lastError` and
  `sync.backfilledTo`). The client fills defaults for any older payload.
- **Verified locally** against a fake twitterapi.io (temporary test, not committed):
  - Run 1 fetched Latest, then the `since:11-13 until:11-20` Top window (5 pages), then a
    full scan of muarmemuar.
  - Run 2 fetched Latest, the `since:11-06 until:11-13` window, then onchainmonk.
  - The state advanced, the budget was counted, and both seeds were marked scanned.

### YouTube
- A second page of all-time most viewed per venue gives top 100 coverage. That is ~4,100
  discovery units plus ~4,300 for live stats, about 8,400 of 10,000 a day.

### UI
- Hero:
  - A pill eyebrow, balanced headline wrapping, a faint dot-grid texture (no glow) and mono
    data labels.
  - Medal-coloured ranks and a 14-day posts sparkline in the live card.
  - Short stat labels, so nothing truncates at 320px.
- Overflow re-verified 24/24 (4 sizes × 6 views).

Owner action: during the first days, raise `TWITTERAPI_DAILY_ITEMS` (e.g. 20000, about $3/day)
so backfill and seed scans finish quickly, then lower it again.

---

## 2026-11-19 (149) — Creators v4: premium UI, live editorial hero, Variational-only X, composite YouTube ranking, Arena v3

The owner asked for:
- a premium, human-feeling UI and hero;
- an accurate, realtime X board limited to Variational creators;
- YouTube ranking by more than views (videos, likes, duration);
- a more useful Arena with manual profiles and more metrics;
- perfect alignment on desktop and mobile.

### Hero (new `Hero.tsx`)
- Editorial two-column layout. One plain headline ("Who is actually moving Variational right
  now.") with a single accent phrase, and a sentence that says exactly what is ranked and by
  what.
- **The look-up box sits in the hero**, since that is the action people come for.
- **A live board card**: this week's real top 5 with their points, posts this week, and the top
  YouTube channel. It replaces decoration.
- The stacked glow orbs are removed from the whole page (design-system: restraint over glow).

### X · Variational
- **Variational only.** Entropy is removed from the X venues (it stays a YouTube topic).
- Tighter maths/ML filter: VQE, neural, diffusion, arXiv/preprint, Hamiltonian and similar.
- Indexing every **15 min**. The paid rotation of older posts stays at 30 min, so the cost is
  the same as before.
- **New panels:**
  - **Rank movement:** ▲/▼ against the same board a week ago, and "New" for first-timers.
  - **Creator of the week:** with their best post.
  - **What people talk about:** posts mentioning Omni / RFQ / Points / TGE / Airdrop / OLP /
    Funding / Leverage / Arbitrum / Fees over 30 days, counted in SQL with a word-start regex.
    Verified against a direct DB count.
  - **Latest posts:** a live feed.
  - **Active this week:** distinct creators who posted in the last 7 days.
  - Activity summary (posts and views over 30 days, busiest day).
- The profile drops venue tabs. Its engagement-mix panel (likes / replies / reposts / quotes /
  bookmarks) replaces points-by-venue.

### YouTube: accuracy and a composite ranking
- **The venue name must be in the title.** Descriptions are full of referral links ("trade on
  Hyperliquid with my code"), so a description-only mention no longer counts.
  - The discovery cache key moved to v2, so old entries built under the loose rule are not
    served. That costs one extra discovery pass on deploy.
- **Video points:**
  - Formula: views ÷ 100 × (1 + depth) + likes + 2 × comments.
  - Depth = length ÷ 20 min, capped at 1. It is a watch-time credit: Shorts earn almost none,
    and deep dives earn up to double view credit.
- **Channel points:** video points plus 25 per video, which rewards output.
  - A test pins that 8 steady 20-minute videos out-rank one viral Short.
- **Creator Score (0-1000)** is reach 250 + output 150 + approval 200 + conversation 150 +
  depth 250. It has its own sort, and the channel drawer shows the breakdown.
- **Creators table:**
  - Sort by Points / Creator Score / Views / Videos / Likes / Runtime.
  - Each row shows likes and total runtime, and the list has "show more".
  - New **Rising** panel (last 30 days) and **Hidden gems** panel (best score under 50K subs).

### Arena v3
- **Add any X profile.**
  - It is looked up through the same profile route as the board (real numbers).
  - Up to 8 profiles are kept in this browser and reloaded with fresh numbers.
  - An added profile joins every game.
- **More metrics:**
  - Head to Head: 12 X stats (points, XYZ Score, views, likes, replies, reposts, posts,
    followers, engagement, views/post, points/post, active weeks), or 10 YouTube stats
    (including comments, videos, subscribers and average length). It can switch between X and
    YouTube, and the radar shows 8 axes.
  - Higher or Lower: six metrics per source.
- **New: Squad Builder.**
  - Draft 3 creators with 100 credits; cost depends on rank (top 10 = 45, 11-30 = 30,
    31-100 = 20, others 10).
  - See live totals against the board's top 3, and share the squad.
- Board ids are lowercased, so "compare" from a profile always finds the right entry.

### Fixes found while verifying (seeded local DB)
- **Board shape change vs a cache that outlives deploys.**
  - The cause: `unstable_cache` kept serving the v3 board shape after the code changed.
    Without topics, the new client would have thrown on `board.topics.every` for up to 5 min
    after the deploy.
  - The fix: the key is now `creators-x-board-v4` (with a comment saying it must be bumped
    with the shape), and the client fills defaults for any missing field.
- A sentinel "until" date (year 275760) cannot be sent to Postgres, so the movement query
  failed. The upper bound is now an optional SQL clause.
- The topic regex lost its `\m` backslash in the template literal, so it matched nothing.
  Fixed, and the counts were checked against `psql`.

### Alignment
- Measured `scrollWidth == clientWidth` on X, YouTube, Arena, Arena/Head to Head,
  Arena/Squad and the profile, at 1440 / 390 / 375 / 412 px. That is 24 of 24 checks.
- Panels sharing a row are filled with real content (best post, 30-day summary) rather than
  left with empty space.

Tests: 32 in `creators.test.ts`. They cover the title-only relevance rule (a referral link is
rejected), Creator Score bounds and monotonicity, depth credit, channel output bonus versus a
viral Short, and the Variational-only X venues.

---

## 2026-11-19 (148) — Creators: mobile alignment, live YouTube stats, auto-refresh

The owner reported, with a screenshot from the live site (YouTube key now active), that the
/creators layout was not aligned on mobile, and asked for accurate, realtime data.

### Mobile alignment
- **The bug:** the "Top creators" card ran off the right edge on phones, cutting off the
  points column.
- **Two causes:**
  - Grids with no base column count. Tailwind's `grid` without `grid-cols-1` sizes its
    implicit track to content, so a long channel name widened the whole column.
  - `truncate` spans inside flex rows with no `min-w-0`. A flex item's default min-width is
    its full text width, so it would not shrink.
- **The fix:**
  - Added `grid-cols-1` to the grids (X activity/rising, YouTube creators/mindshare, the
    profile's two-up sections).
  - Added `min-w-0` to every truncating span and to `Panel`.
  - Head to Head uses `minmax(0,1fr)` columns.
  - Panel padding is `p-4` on phones.
- **Verified** at 320, 390 and 412 px wide: `scrollWidth == clientWidth` on all three tabs,
  with a deliberately long Cyrillic channel and display name.

### Live data
- **YouTube is split into two caches:**
  - **Discovery** (`search.list`, 100 units a call) runs once a day per venue.
  - **Live stats** (`videos.list` on the found ids, 1 unit per 50) run every 10 min
    (`fetchStats` / `withStats`).
  - Views, likes and comments are now at most ~10 min old. Quota is ~3,100 + ~4,300, about
    7,400 of 10,000 a day, whatever the traffic.
  - The discovery cache key is unchanged, so production keeps its warm entries.
  - If stats fail, the discovery snapshot is served (real, older numbers), not nothing.
- **The page auto-refreshes** while the tab is visible: X board every 240s (edge 300s) and
  YouTube every 540s (edge 600s, down from 3600). It catches up at once when you return to
  the tab. Refreshes are silent; only a filter change dims the board.
- **Status line on YouTube:** "Live stats: … UTC · Video list: … UTC · Auto-refreshes".
- **X data** is still indexed every 30 min, budget-capped. Faster X indexing would cost
  billed items for mostly-empty pages.

### Cost guard
- Both routes are now in `TARGETS` in `markets-poll-alignment.test.ts` (`creatorsTargets`).
  Each poll is shorter than its edge window and over a third of it.
- The X route's header is now a literal, so the test can read it.

---

## 2026-11-19 (147) — Creators v3: Entropy, 10x features, glitch fixes, Arena v2

The owner asked for a better UI and UX, many more accurate features, no glitches,
**Entropy** on both X and YouTube, and a more interactive Arena.

### Entropy, plus a multi-venue X board
- **What Entropy is:** entropy.io (@EntropyIO), a HIP-3 venue on Hyperliquid for pre-IPO
  and equity perps. It is now a venue next to Variational.
- **Venue config:** `VENUES` in `twitterapi.ts` holds, for each venue, an X search clause
  plus a relevance test.
  - "Entropy" is also physics, password strength and Pyth's RNG product. A post counts
    only if it has @EntropyIO or entropy.io, or "entropy" next to Hyperliquid / HIP-3 /
    perps / pre-IPO / Anthropic context.
- **Per-post venues:**
  - `XTweet.venues text[]` is new, defaulting to `{variational}` for existing rows. It is
    a plain added column, so `db push` needs no data-loss flag.
  - A post can count for several venues.
- **Indexing and scans:**
  - The indexer claims a lock per venue (`index:<venue>`), and rotation has its own lock.
  - A handle scan is one search across all venues, and each post is classified after.
- **API:** the board and profile APIs take `?venue=variational|entropy|all`.
- **YouTube:** new topics Entropy, GMX and dYdX (10 venues). That is about 6,200 of the
  10,000 daily quota units.

### New features
- **X board:**
  - Venue switcher cards and a 30-day activity chart (posts, views and creators per day).
  - "Rising this week" (top 7-day point earners) and a top-posts feed.
  - An engagement column and sort.
  - A **watchlist** with stars and filter, recent scans, and CSV export.
  - "Showing top 500 of N" when there are more rows.
- **Profile:**
  - Venue tabs, "Top X%" percentile, originals vs replies, "creator since", best post and
    points per post.
  - Points-by-venue bars, and **"when their posts land best"** heat strips (UTC hour and
    weekday).
  - A Watch button.
- **YouTube:**
  - A **Trending** sort (views per day since upload, shown on every card).
  - A **venue comparison table**: videos, new in the last 30 days, views, engagement and
    top channel per venue. Tap a row to switch topic.
- **Arena v2:** four modes.
  - **Higher or Lower**:
    - Play on X or YouTube, with points / views / XYZ Score / followers.
    - Three lives, a combo XP multiplier, a best score per mode, and a share button.
  - **Daily Challenge**:
    - The same ten duels for everyone each UTC day. The pool is sorted by id and drawn
      with a seeded mulberry32.
    - One play per day, a Wordle-style result grid to copy, and your history average.
  - **Rank Quiz**: guess a creator's rank bracket over five rounds.
  - **Head to Head**: a **radar chart**, swap, and a share line.
- **Rankings:**
  - `ranking` (every handle in order) ships alongside the top 500 rows, so a profile
    always has an exact rank.
  - Rank ties now break on handle, so the order is stable.

### Glitch fixes
- **Tabs stopped switching.**
  - The cause: after a venue change, the X · YouTube · Arena tab bar moved but the content
    stayed. `AnimatePresence mode="wait"` waited on an exit that never finished, because
    the exiting board held a shared-layout element.
  - The fix: tabs and Arena modes are now enter-only, which cannot stall. The venue glow
    no longer uses `layoutId`.
- **Board, profile and YouTube no longer blank out on a filter change.** The old data
  stays dimmed, with a thin refresh bar, until the new data lands.
- **One XYZ Score everywhere.** The profile counted "active weeks" as the last 12
  calendar weeks, while the board counted distinct weeks in the last 84 days. The same
  creator could show 645 on their profile and 666 in Head to Head.
  - Both now use `activeWeeksSince`.
  - Verified locally on seeded data: all 98 profile/board pairs match on score, points,
    rank and post count.

Tests: 28 in `creators.test.ts`. New ones cover Entropy relevance against physics and Pyth
RNG, multi-venue classification, the all-venue handle query, official accounts, the YouTube
Entropy gate, trending maths and the shared active-weeks rule.

---

## 2026-11-19 (146) — Creators v2: Proof of Variational on X, the game layer, all-time YouTube

The owner asked for a next-level UI and UX on /creators, a game system, all-time and
more YouTube data, and an X side that works like proofofvar.fun: enter a username
instead of a post link. The owner chose twitterapi.io (paid, pay-as-you-go) as the
X data source and our own **XYZ Score** in place of Moni Score, which is Moni's
private data.

### X · Variational (rebuilt)
- **Link submission is gone.** Anyone can type an @handle and hit **Scan**:
  - `GET /api/creators/x/profile` reads that account's Variational posts from
    twitterapi.io: `from:<handle> (variational OR @variational_io OR "variational.io")`
    plus `user/info`, up to ~300 posts.
  - The result is stored and shown as a profile.
  - A handle is re-read from X at most once per 6h. A fresh handle is a pure DB read.
- **Indexer (`x-index.ts runIndex`).** It runs through `after()` on board reads, at most
  once per 30 min behind an atomic lock row (no cron; crons stay paused). Each run:
  - Pulls up to 8 pages of the newest Variational posts and stops at the first page that
    is already known.
  - Re-reads the 40 stalest posts under 45 days old, so views keep moving. This is the
    "older posts refresh in rotation" line.
- **Spend cap.** `TWITTERAPI_DAILY_ITEMS` defaults to 6,000 items/day, about $0.90/day
  at ~$0.15 per 1,000.
  - It is enforced atomically in `CreatorSync` before every billed call. Over the cap,
    reads keep serving stored data and say so.
  - Scans are also limited by IP with `creatorScan` (6 per 10 min), counted only when a
    scan actually calls X.
- **Relevance.** Reposts are excluded. "Variational" in the maths/ML sense
  (autoencoders, inference…) is filtered out unless the post also names the exchange.
  Variational's own accounts are shown as official and not ranked.
- **Leaderboard** (7d / 30d / all time):
  - Built with one SQL aggregate per window and cached for 5 min (`unstable_cache`
    plus `s-maxage=300`).
  - Shows the eight level cards with account counts (tap one to filter), totals, and a
    sync status line (last index, posts checked in 24h).
  - Search, and sorting by points / XYZ Score / views / posts / followers.
  - Admins can remove an account (`DELETE ?handle=`).
- **Profile modal:**
  - Rank of N, the XYZ Score ring and its four-part breakdown, the level progress bar,
    and "N points to pass @next".
  - Weekly streak, a 12-week points chart, eight stat tiles and ten badges.
  - The post list, sortable by top / views / recent.
  - A **shareable PNG card**, drawn with canvas in the browser so it costs the server
    nothing.
  - Copy link (`/creators?x=handle` deep-links straight to it) and Compare.

### Game layer (`game.ts`, pure and fully tested)
- Points = views × 0.1 + likes + replies × 2 + reposts × 3 + quotes × 4 + bookmarks × 2.
  The formula is linear, so summed counts give summed points; the SQL relies on that.
- 8 levels: Spark → Scout → Builder → Creator → Voice → Elite → Legend → Apex
  (0 / 500 / 1.5K / 3K / 6K / 10K / 15K / 25K).
- XYZ Score is 0-1000, made of four 250-point parts:
  - **Reach**: followers, log scale.
  - **Resonance**: engagement per view, with 5% as full marks. Ignored under 100 views.
  - **Consistency**: weeks active out of the last 12.
  - **Impact**: average views per post, log scale.
- Monday-based UTC week streaks, and 10 badges.
- **Arena** tab:
  - **Higher or Lower**: guess which creator has more points. The streak counts, and the
    best score is kept in localStorage as a per-viewer convenience.
  - **Head to Head**: any two creators across six stats.

### YouTube (more data, all time)
- Each topic now makes 3 searches: all-time most viewed, plus the most viewed and the
  newest of the last 90 days. That is ~310 units per topic refresh, about 4,400/day for
  all topics, of the free 10,000.
- Windows 7d / 30d / 90d / 1y / **All time**. Format filter long-form / Shorts
  (≤3 min). Sort by score / views / likes / comments / engagement / newest.
- Summary tiles, **Mindshare** (share of views by venue, tap to switch topic),
  **upload cadence** (26 weeks), engagement rate and duration on every card, channel
  levels, and a **channel drawer** with that channel's videos and averages.

### Shell
- An animated hero with live counters, a sticky tab bar with a spring indicator, and
  short tab labels on phones.
- Deep links `?x=` and `?tab=` are read after mount, so the static shell and the first
  client render always match.

### Plumbing
- New env vars: `TWITTERAPI_IO_KEY` and `TWITTERAPI_DAILY_ITEMS`. Without the key, the X
  tab says it isn't switched on and shows only stored data.
- New models: `XAccount`, `XTweet` and `CreatorSync`.
  - `CreatorPost` (v1) is **retired but kept** in the schema. The production `db push`
    runs without `--accept-data-loss`, so dropping a table that has rows would fail the
    deploy.
- `src/modules/creators/lib/x.ts` (the syndication embed reader) was removed.
- Tests: `creators.test.ts` now has 22. They cover twitterapi.io parsing (and drop
  half-readable posts), the maths-vs-exchange filter, handle validation, the
  key-in-header and cursor contract, points linearity, contiguous levels, XYZ Score
  bounds and parts, streak edge cases, and badge thresholds.
- `touch-parity` twins were added for the two new hover transforms.
- Route table: `/api/creators/x/profile` is new (`ƒ`). Nothing else changed mode and
  nothing polls.

---

## 2026-11-19 (145) — Creator Leaderboard (`/creators`)

The owner asked for a search and leaderboard, in the spirit of proofofvar.fun, that ranks
the best Variational and other perp DEX content: YouTube across perp DEXs, and on X only
Variational, with creators ranked by points.

### YouTube · Perp DEX tab
- Topics: Variational, Hyperliquid, Lighter, Aster, edgeX, Paradex, generic "perp DEX", and
  All. Window 7d / 30d / 90d, sort by score / views / newest, and search over title, channel
  and description.
- Data: YouTube Data API v3 (`src/modules/creators/lib/youtube.ts`). For each topic it makes
  two `search.list` calls (most viewed and newest, last 90 days). Real counts then come from
  `videos.list` and `channels.list`; search results carry no statistics, so none of their
  numbers are used.
- **Relevance gate** (`scoring.ts` `TOPICS[].must`): a video counts only if its title or
  description is actually about the venue. Search is fuzzy: "lighter" returns cigarette
  lighters and "variational" returns ML lectures.
- Points: video score = views ÷ 100 + likes + 2 × comments; creator points = the sum
  over the selected window. The formula is printed on the page. Hidden counts score 0.
- **Needs `YOUTUBE_API_KEY` in Vercel** (new, optional, in `env.ts` and `.env.example`).
  Without it the tab says "not switched on yet" and never shows invented numbers.
- Cost: `unstable_cache` keeps each topic for 12h, and only that layer spends quota.
  ~205 units per topic refresh, under 3,000/day for all topics, against the free
  10,000. Visitor traffic cannot move that. The edge caches for `s-maxage=3600`. A
  failed refresh backs off for 15 min per instance, so a quota error cannot cause a
  retry storm. The route is not polled.

### X · Variational tab
- The free X API cannot read or search posts, so posts enter by **member submission**
  (`POST /api/creators/x`). The flow:
  - Log in.
  - `creatorSubmit` rate limit: 10 per 10 min, keyed per IP and per member.
  - Parse the link (x.com / twitter.com only).
  - Read X's public embed data (`cdn.syndication.twimg.com`, as used by react-tweet).
  - The post must itself mention Variational, tag a Variational account, or link
    variational.io.
- Points = likes + 2 × replies; creator points = the sum of their posts. The embed data
  has no views, so views are not scored, and the page says so.
- New model `CreatorPost` (applied by the production `db push`). Counts refresh lazily:
  each GET refreshes at most 5 posts older than 6h, via `after()`, after the response is
  sent. A post deleted on X drops off the board (`status: "gone"`).
- Admins can hide a post (`DELETE`, `admin` rate limit). A hidden post cannot be
  re-submitted.
- `GET` is identical for everyone: `public, s-maxage=300, stale-while-revalidate=3600`.
- Caveat: the embed endpoint is unofficial. If X closes it, new submissions fail with a
  clear message and the board keeps its last stored counts.

### Wiring
- `/creators` is a static shell (`○`), like `/points`. Both APIs are `ƒ`.
- Nav: "Creators" is in the "More" menu. The rail stays at six links, and the
  `nav-rail-width.test.ts` pin was updated. Icon in `AppMenu`, entry in `sitemap.ts`.
- Tests: `creators.test.ts` (17). Covers the relevance gate, scoring, windows, creator
  aggregation, the YouTube client against a recorded-shape stub (the key goes in a header
  and never in the URL, and irrelevant channels are never looked up), quota errors, X link
  parsing (rejects lookalike hosts), embed normalisation and the Variational check.
- Gotcha found while building: `text-base` is a **colour** token here (`base:
  var(--bg)`), so `sm:text-base` turns text near-black instead of setting a font size. Use
  `sm:text-[15px]`. `PointsHero.tsx:911` has the same class and was left untouched.

---

## 2026-11-18 (144) — Markets data you can trust, News that keeps up, a smoother site

The owner asked for faster, accurate Markets data with the bugs fixed for good, a News
page that does not leave gaps and has more to it, and a site that does not lag.

### Markets: data
- **Last known good values (`last-good.ts`, new).** CoinGecko and DefiLlama refuse
  Vercel's shared IPs now and then. One refusal used to blank a source for a whole cache
  window: five of the seven Perp DEX rows showed "-" in production.
  - Each upstream source is now remembered while it is good, in memory and in Upstash
    when configured.
  - A failed call serves the remembered value, but only while it is younger than a cap
    (30 min for prices, 1-12 h for slower figures). Past that the page shows "-" rather
    than old numbers presented as live.
  - Applied to: global (CoinGecko, Fear & Greed), coins (markets, trending), perp
    (Hyperliquid, CoinGecko derivatives, TXFlow, DefiLlama), DeFi (TVL, chains,
    stablecoins), sectors, and the shared `llama.ts` loaders.
- **CoinGecko derivatives no longer depend on a second CoinGecko call.** BTC→USD falls
  back to Hyperliquid's BTC mark. A partial three-page result never replaces a complete
  remembered one (`cgCoversFeatured`).
- **TXFlow open interest.** TXFlow's own API returns empty OI fields, so the row showed
  "-". It now comes from DefiLlama's free open-interest overview ($28.4M when checked;
  Lighter's figure there matches CoinGecko's within 0.5%). DefiLlama's derivatives
  *volume* endpoints now answer 402 (paid); that is noted in the code.
- **Accuracy:**
  - A failed stablecoin read used to put a hard-coded $165B into a `live: true` payload.
    It now shows the last real figure, or "-".
  - The DeFi TVL card's change is labelled "30d"; it read as a 24h drop.
- **Speed:**
  - `/api/markets/coins` went from 929 KB to 242 KB (before compression). The 7d
    sparkline is thinned from 168 to 42 points at six significant digits; a 24-point
    `spark24h` tail keeps the heatmap and watchlist charts identical.
  - `/markets` paints the last live snapshot (under 15 min old, from this browser)
    immediately after mount, then replaces it with the live fetch.
- **Ticker poll restored to 150s.** #389 set it to 5s against a 180s cache: 35 of every
  36 polls returned identical bytes. A new test fails on any poll under a third of its
  route's `s-maxage`.
- **A test that tested nothing, fixed.** The detail-page poll parser matched the 1s
  "updated Ns ago" clock instead of the 150s/120s data poll, so its checks always passed.

### News
- **Newsletter:** after a successful subscribe the card confirms, then folds away. It
  stays hidden on later visits, and the footer capture stops asking too.
- **No gap on scroll (desktop):**
  - The Latest / Top / Saved bar sticks under the navbar.
  - The sidebar is sticky. When it is taller than the screen it pins by its bottom
    (`useStickySidebar`), so every card stays reachable and the column never leaves an
    empty space beside the feed.
- **New, all from data already on the page (no new requests):**
  - Headline mood meter, with a one-tap Bullish / Bearish filter.
  - Live 24h change on token chips, from the shared ticker.
  - Unread only, and Mark all read.
  - A compact density view.
  - Keyboard reading: j/k, o, s, 1/2/3, ? for the list of shortcuts.
  - A back-to-top button with a reading-progress ring.
- **Motion:** the tab pills slide between options, list rows rise in from paint (CSS,
  first screenful staggered), rows highlight on hover, and the bookmark pops.
- **Hydration bug fixed (#418 on every return visit).** The breaking hero read
  localStorage in a lazy `useState` initialiser, so the browser picked a different story
  than the server sent. It now reads in a `useLayoutEffect`: after hydration, before
  paint.

### Site smoothness
- **Smooth scroll:** the Lenis wheel glide is shorter (1.15s → 0.75s, same curve), so
  the page follows the wheel instead of trailing it.
- **No new hydration errors:** `/`, `/markets`, `/news`, `/research`, `/community`,
  `/points` and `/tools` were checked on a first load and on a reload.

### Cost
- The route table is identical to `main`, and no cache window changed.
- New Upstash use is throttled to one write per key per instance per 5 minutes, with
  reads only on an upstream failure.

---

## 2026-11-18 (143) — Markets: chart survives a Binance block, Fear & Greed reads right

Two Markets bugs found while capturing the product ad.

- **Market cap / volume chart no longer depends on Binance alone.**
  - Binance answers HTTP 451 from restricted regions, and the chart then showed
    "Live history unavailable".
  - `/api/markets/chart` now tries Binance first and falls back to CoinGecko's keyless
    `coins/bitcoin/market_chart`.
  - New `src/modules/markets/lib/chart-candles.ts` converts that history into the same
    kline shape, thinned to each timeframe's point limit.
  - CoinGecko's keyless API caps history at 365 days (`days=max` errors), so **ALL**
    falls back to the last year rather than to nothing.
  - The chart notes name the source actually used.
- **Cost:** no window changed.
  - The route stays at `revalidate = 60` and `s-maxage=60`.
  - The fallback fetch hint is 120s, which is at least 60, so trap 1b does not apply.
  - Payloads are 17–223 KB, well under the 2 MB data-cache limit.
- **Fear & Greed colours (`MarketsClient.tsx`):**
  - The label used to be mint whatever the value, so "Extreme Fear" showed as a green,
    bullish label. It now follows `fngLabel().tone`: red for fear, amber for neutral,
    mint for greed, in both themes.
  - The compact gauge's gradient was inverted. It now runs from red at 0 to green at 100,
    matching the full gauge.
  - "Extreme Fear" and "Extreme Greed" ran into the compact arc's end caps. Long labels
    now render at 7.5px with normal tracking.
- **Tests:** `chart-candles.test.ts` has 5 cases (shape, window, thinning, volume
  carry, bad input).

## 2026-10-27 (142) — TxFlow on Points: Season 0 + Season 1 calculator

The owner asked for a TxFlow calculator like Variational's, with Season 0 and Season 1
combined, a 1B supply and 25% as the default allocation.

- **Registry (`dex-registry.ts`).** The total is 47,345,544 points:
  - **Season 0:** 10,769,544 points, already distributed (@TxFlow_L1, 27 Oct 2026).
  - **Season 1 maximum (36,576,000):**
    - Season 1 started 12 Oct 2026, with drops every Tuesday from 20 Oct to the end of
      Q1 2027: 24 drops.
    - Each drop is 1.25M trader points plus up to 152K referral points.
    - On top, a 488K Growth Reserve each month for 6 months.
  - **Scenario inputs:**
    - Supply is 1B (a placeholder, since there is no token yet).
    - Allocation defaults to 25%, with 10/15/20/30% options.
    - FDV runs from $250M to $3B and opens at $1B.
  - **Badges:** `confirmed: false`, so the calculator says "Scenario data". The notes
    say the referral pool is a cap and the season can end early, so the real total can
    only be lower.
- **Featured Programs:**
  - A live TxFlow card (47.35M Points · 25% Allocation) takes the Lighter "Coming
    Soon" placeholder's slot, so the row stays six cards wide.
  - Hyperliquid remains the one locked card.
- **Real logo:** `public/txflow-logo.png`, from DefiLlama's icon set (the same mark as
  @TxFlow_L1's avatar), snapped to its two flat brand colours. The Markets Perp DEX
  board's TXFlow row now uses it too.
- **Automatic:**
  - The "Ongoing perp DEX airdrops" list now shows 5 farming.
  - `/points/txflow` redirects to the calculator.
- **Tests:** `points-programs.test.ts` pins:
  - the 24 Tuesdays and the 36,576,000 / 47,345,544 totals;
  - the 1B supply, 25% default and options;
  - $5.28 per point at $1B and 25%;
  - the card matching the calculator, and the logo.
- **Checked in the browser:** 5,000 points shows $13,201 at $500M, $26,402 at $1B and
  $79,205 at $3B.

## 2026-10-27 (141) — Perp DEX board: the owner's 7 venues, real data from sources that answer

**Why the board showed only Hyperliquid at +0.0%.**
- Production's `api.llama.fi/overview/derivatives` call fails. It is the same refusal
  `perp-sources.ts` documented for `/api/points/comps`.
- `/api/markets/perp` then fell back to a single Hyperliquid row with `change1d: 0`.

**Now** (`src/modules/markets/lib/perp-venues.ts`):
- **Venues:** Hyperliquid, Lighter, Variational, TXFlow, RiseX, Arcus and SoDEX, ranked
  by live 24h volume.
- **Columns:** 24h volume and open interest.
  - Volume comes from Hyperliquid's own API for Hyperliquid, else DefiLlama, else
    CoinGecko's derivatives list (converted from BTC with a live BTC price).
  - Open interest comes from Hyperliquid's own API for Hyperliquid, else CoinGecko,
    else DefiLlama.
  - A 24h % column appears only when DefiLlama answers.
- **Logos:** each venue's real logo from CoinGecko or DefiLlama.
- **TXFlow:** listed on DefiLlama only, so it gets one small per-protocol summary
  call. If that is refused too, it shows a dash, never an estimate.
- **Perp DEX tab:** falls back to CoinGecko's derivatives list, filtered to known perp
  DEXs and never CEXs, instead of one Hyperliquid row.
- **Allowlist:** Arcus, TXFlow and "Variational Omni" are added to `PERP_DEX_NAMES`.
- **Cost:** the CoinGecko calls are cached at the route's own 200s window. The route
  stays ISR (≈3m in the route table).

**Trending Now:**
- **Chart:** coins outside the top-250 list now show CoinGecko's own 7-day sparkline
  image instead of "-".
- **Volume:** CoinGecko sends `total_volume` as a formatted string ("$1,234,567"),
  which used to parse as 0. It is now parsed correctly.

**Follow-up after the owner's review (same PR):**
- **TXFlow had no data.**
  - DefiLlama reads TXFlow from Dune, and CoinGecko does not list it.
  - It now comes from TXFlow's own public Info API (`api.txflow.com/info`,
    Hyperliquid-compatible): `perpMeta` lists the perps, and `webData2` gives
    `dayNtlVlm` and OI keyed by `instrumentId`.
  - If any listed perp has no data, the figure is dropped rather than reported
    short.
- **Trending Now showed BTC twice.**
  - CoinGecko's trending list can hold Bitcoin and an unrelated token whose ticker is
    also "BTC".
  - `dedupeTrending` drops repeated ids. It labels a token that borrows another
    coin's ticker by its full name instead.
- **Top Yields had no chart.**
  - Each pool now carries its real 30-day APY history from DefiLlama's per-pool
    `yields.llama.fi/chart/<pool>`. That host is reachable from production.
  - About 100 KB each, cached at the route's 320s window. The cache key is bumped to
    `yield-pools v2` because rows now carry `pool`.

**Tests:** pinned by `perp-venues.test.ts`, covering:
- the seven venues;
- no CEX leaking in;
- null rather than invented values;
- the source precedence;
- the BTC→USD conversion;
- dropping the source when there is no BTC price.

---

## 2026-10-26 (140) — Markets redesign (Deepak's work, markets only) + live data only

Deepak's Markets redesign from PR #389, taken **without** its News, Research, Points and
Portfolio changes (those come later, per the owner). Built fresh on `main`: only
`src/modules/markets`, `src/app/markets` and `src/app/api/markets`, plus the `neu-*`
tokens/classes in `globals.css` and `tailwind.config.ts` they need. `dex-registry.ts`
keeps `main`'s version (with Arcus).

### Live data only
The page shipped built around sample data: hard-coded KPI values, changes and
sparklines; a sine-wave chart whenever an upstream failed; fixed "+8.42%" volume change;
sample sector, gainer, loser, trending, yield and watchlist rows; a fixed "Solana
ecosystem heating up" headline. Every one of those now comes from a live feed or shows
"-" or a loading skeleton:
- **Chart (`/api/markets/chart`):**
  - Market cap is CoinGecko's total, drawn along the BTC/USDT curve and labelled as such.
  - Volume bars are BTC/USDT spot volume.
  - BTC dominance shows its live value only.
  - DeFi TVL and stablecoins use DefiLlama's daily series.
  - An upstream failure returns an empty series, never a synthesized one.
- **Sectors:** CoinGecko categories only; no drawn sparklines and no sample sectors.
- **INR:** waits for a live rate (USD is shown until then); no 95.0 / 86.85 seed rate.
- **Trending Now:**
  - Matched to the markets list by CoinGecko id, not by symbol. Symbol matching let
    another "BTC" token borrow Bitcoin's price and logo.
  - Uses the canonical logo.
  - A missing price or volume shows "-" (it used to invent 27.8 / $920M).
- **AI Market Intelligence:** a sentence built from live numbers, labelled "From live
  market feeds", not "Live AI synthesis".
- **Removed:** the unused `OnChainSnapshotCard` and `MarketGlobeGraphic`, which held
  sample data.

### Perpetual DEX Leaderboard
- **Ranking:** venues are ranked by live DefiLlama 24h volume. dYdX and Jupiter are
  removed.
- **Pinned venues:** Arcus, TXFlow and RiseX are always on the board.
  - A pinned venue uses DefiLlama's live numbers when listed there.
  - Otherwise it shows "Not listed" with a dash, not an invented volume.
- **Columns:**
  - The OI and funding columns showed the same hard-coded numbers for every venue, so
    they are gone.
  - Each row now has a bar for its share of the leader's volume.

### Performance and UX (from the earlier pass on #389)
- **Polling:** follows the CDN windows (180s/300s, chart 90s, INR 150s; hidden tabs
  skip).
- **Dead Binance sockets removed:** the CSP blocked them, so they only ever reconnected
  every 4-5s.
- **Hero image:** a 126 KB WebP replacing a 2 MB PNG.
- **Watchlist:**
  - One shared store, so a star anywhere saves and shows everywhere.
  - "My Watchlist" opens the tab.
- **Haptics and alignment:** haptics on star, watchlist, currency and tabs; row 3 cards
  are equal height.

---

## 2026-10-26 (139) — /news eyebrow matches the homepage

"Live Web3 Intelligence" on `/news` now uses the homepage's "The Home Of Next Gen Web3"
pill: the same `.eyebrow-glass`, its gold shine sweep (`btn-shine`, 4.2s loop) and the
MagicStar mark. The live-status dot is kept at the end. Checked in Chromium: the sweep is
running on desktop, mobile and light theme. Pinned by `news-redesign.test.ts`.

---

## 2026-10-26 (138) — /news redesign (PR, awaiting owner review)

Owner request: a premium Web3 intelligence layout for `/news`, gold-led and built on real
data only. **Not merged; for review.**

- **Hero.**
  - Left: "Live Web3 intelligence" eyebrow, the `<h1>` "Web3 News", the brief's
    subtitle, Explore News (gold) and Open XYZ AI.
  - Facts row, all real: `NEWS_SOURCES.length` sources, the 2-minute feed cache, AI
    summaries.
  - Right: a featured-story panel (high-impact stories first) with category, source,
    time, bookmark, share and previous/next.
  - Server-rendered and visible without JavaScript. It replaces `PageHeader`, whose
    `<h1>` shipped at opacity 0 (audit SEO6).
- **Toolbar.**
  - Search across headlines, tokens and sources.
  - Top (the server ranking) / Latest sort.
  - Saved, Alerts and Live controls.
  - Ten topic chips plus "More topics" for the rest of the taxonomy.
- **Feed.**
  - A Top stories grid: 16:9 images, equal card heights, gold category label,
    breaking badge.
  - Featured research (from `/api/research`) and an XYZ AI band.
  - A Latest news list that keeps every existing action: AI Summary, Why this matters,
    tokens, sentiment and impact, source filter, share, bookmark.
- **Sidebar.**
  - Trending topics, counted from the loaded stories.
  - High-impact stories.
  - Newsletter (`/api/subscribe`; success shown only on a 2xx).
  - Community links from `site.ts`.
  - No market widget and no events list: /news has no events source.
- **Bugs fixed on the way.**
  - An empty server batch (feeds unreachable at render time) counted as "already
    loaded", so the page showed nothing until the 90s poll.
  - Story cards were also shipped at opacity 0 behind `whileInView`; they now use the
    CSS `hero-rise` entrance.
- **Revision 2 (owner feedback: simpler, smaller hero, aligned like the reference).**
  - The sidebar runs from the top.
  - The hero is one compact strip: title on the left, top story as an image overlay on
    the right.
  - Search and topic chips sit in one bar.
  - Four equal cards in a row.
  - The Latest list has Latest / Top / Saved tabs and sits beside Featured research.
  - List rows keep one footer line: source and time, then the actions.
  - Sentiment and impact pills folded into the row header.
  - On mobile, the hero, top story and search fit the first screen.
- **Revision 3 (owner feedback: polish, usefulness, haptics).**
  - **Featured research removed.** Latest news now spans the main column under one
    aligned header: equal-width Latest / Top / Saved tabs, a time window (Any, 24h,
    1h) and Alerts.
  - **New features, all real.**
    - "New" badges on stories published since this device's last visit, plus a
      "N new since your last visit" count.
    - Read state: opened stories are dimmed and marked Read.
    - The time window is applied in `inFeed`, so the list, the reader and the
      sidebar agree.
    - A Reset filters action and an "all caught up" state.
    - `/` focuses search.
  - **Trending topics, rebuilt.**
    - Ranked rows with a share-of-feed bar and a bullish/bearish mix bar.
    - A "Rising" tag when most of a topic's stories landed in the last 6 hours.
    - Feed / 6h toggle, and clear filter.
    - Members can star a topic to follow it in For You, saved through
      `/api/news/interests`.
  - **High impact, rebuilt.**
    - Ranked 1 to 5 by the feed's impact field, then recency.
    - All / High toggle, impact chip, and a "Live" marker for high-impact stories
      under 2 hours old.
    - Sentiment dot, unread count, and inline bookmark and share.
  - **Haptics.** Every press already gets the site-wide tap. State changes get the
    distinct toggle pattern (bookmark, topic follow); newsletter subscribe gets the
    sent and error patterns.
  - **Mobile.**
    - Tabs span the full width; the time window and Alerts sit on the second row.
    - Source and time move under the headline, so each row's actions stay on one line.
    - Rows reserve their real height (128px instead of `.cv-auto`'s 340px), so the
      list no longer jumps.
- **Revision 4 (owner, from the live preview).**
  - **The sidebar is no longer sticky.** It is taller than the screen, so a sticky
    column could never show its bottom; High impact was cut off.
  - **Trending and High impact switch** in the sidebar, so each shows in full. Each
    has "See all", which opens a sheet: bottom sheet on phones, centred panel on
    desktop, with Esc, backdrop close and scroll lock.
  - **Stories with no feed image** now get a branded banner instead of an empty box:
    a gold-family wash chosen per category, a faint grid, the publisher's logo (or
    initials) and the source name.
- **Unchanged.** Polling, save rollback, For You, the reader and swipe, infinite scroll.
  `/news` is still ISR at 2m and the route table is identical (158 routes).
- **Tests.** New `news-redesign.test.ts` (12 checks: real-data rules, topic chips are
  real categories, no JS-gated cards, the empty-batch fix). 1509/1509 pass.

---

## 2026-10-07 (137) — Security: Next 16.3.8, dashboard member emails gated; full audit filed

From the 2026-10-07 audit (`docs/AUDIT-2026-10-07.md`, linked from `HANDOFF.md §8`).

- **`next` 16.3.0 → 16.3.8.** This clears the critical advisories, including RCE in
  `next/og` `ImageResponse`, which the 5 share-card routes use, and in Image Optimization
  with AVIF.
  - `npm audit --omit=dev` now shows 0 critical.
  - The lockfile only moves `next`, `@next/*`, `sharp` (0.35.5) and `@swc/helpers`.
  - Dependabot #333 (16.3.4) and #332 (sharp) are superseded.
- **`/dashboard` no longer ships member emails to every staff member.**
  - Before: anyone with any single capability (say `whatsnew:manage`) received up to 150
    members' full emails and last-login times in the page payload, with only the tab
    hidden.
  - Now: recent members load only with `users:manage`, and Premium members only with
    `premium:manage`.
  - Pinned by `dashboard-member-pii.test.ts`.
- **Audit filed:** security 7, bugs 7, speed 6.5, SEO 5.5 out of 10, with P0/P1/P2 lists
  and a status column.

---

## 2026-10-06 (136) — Handoff: pending work in one place

Docs only. `docs/HANDOFF.md §8` now opens with **"📌 Start here — pending as of
2026-10-06"**. It groups the work into owner-only dashboard tasks, two owner decisions
(RiseX card 10% vs calculator 25%, Arcus TGE line), and code work for the next session. It
also records that PR #284 was closed unmerged, so its parked backfill no longer applies. It
holds no secrets: variable names only.

---

## 2026-10-05 (135) — Arcus Featured card (9.75M, 25%); Variational 11.2M points

Owner request. Data and layout only; the route table is unchanged. **1494 tests.**

- **Arcus card in Featured Programs**, next to Variational. It is live, not locked,
  with the "Official" badge (Arcus runs an official points programme), Farming Now,
  **9.75M Points** (the Season 1 maximum: 39 x 250,000), **25% Allocation**,
  Perps / RWA / Spot, and Calculate.
- **Arcus calculator default is now 25%** (was 10%), so the card and calculator
  agree. It is still a scenario: Arcus has published no token or airdrop size.
- **Variational: 11.2M points** on the card and as the calculator's total pool
  (was 9.4M).
- **Grid for six cards:** one column on phones, two from `sm`, 3 + 3 from `lg`,
  and one row of six from `xl`. Checked at 390, 1024 and 1440 px with no
  horizontal scroll.
- **Tests:** the Arcus and Variational card labels are pinned to the registry
  numbers the calculator uses, and Hyperliquid and Lighter stay locked.
- Files: `FeaturedProgramsBar.tsx`, `dex-registry.ts`, `points-programs.test.ts`.

---

## 2026-10-05 (134) — Arcus points calculator; Variational 32%; shared links and the data badge

Owner request. Route table unchanged apart from one more prebuilt `/points/[venue]`
link page (`/points/arcus`). **1492 tests.** Real-browser checks: **12/12** plus
badges on three programmes.

- **Arcus, Season 1** is a new `DEX_REGISTRY` entry, so it gets the calculator, the
  programme list and a `/points/arcus` link.
  - **Official:** 250,000 points every Wednesday 3 PM ET, from 1 Oct 2026 until no
    later than 30 Jun 2027.
  - **Derived and pinned by a test:** 39 drops (7 Oct 2026 to 30 Jun 2027), so at
    most **9,750,000** Season 1 points.
  - **Everything else is a scenario:**
    - Arcus has no token, supply, airdrop size or FDV.
    - Its terms say points are a participation metric only.
    - It is marked unconfirmed, and its notes say so.
    - Season 0 points are unpublished; the notes say how to add an estimate.
    - It is not the unrelated "Arcus Network" token.
  - Presets: FDV $250M / $500M / **$1B** / $2B / $3B; airdrop 5 / **10** / 15 / 25 /
    30%.
  - The supply is a placeholder: `projectValue` cancels it, so value per point is
    exactly FDV x % / total points. That is $5.13 at $500M and 10%, $92.31 at $3B
    and 30%.
- **Variational allocation: 32%** on the Featured Programs card *and* in the
  calculator. They had disagreed before (card 12%, calculator 30%); a test now pins
  them together.
- **Fix: shared programme links opened the wrong calculator.**
  - `/points/<id>` redirects to `/points#programme-<id>`, but the redesign stopped
    rendering those sections.
  - So every shared link (Variational, Sodex, ...) left the reader on Sodex's
    numbers.
  - The page now reads the hash, selects that programme and scrolls to the
    calculator. It runs after saved state is restored, so the link wins.
- **Fix: the calculator ignored each programme's own presets.**
  - It showed generic chips (10/20/30/50/100%, $1B/$3B/$10B) to every programme,
    so Sodex's pool scenarios, RiseX's 20/25/30% and Arcus's ladder were missing
    from it.
  - It now uses a programme's own presets when it defines them, up to five; short
    labels keep five on one row on a phone.
- **Fix: "Confirmed Data" was hard-coded on every programme**, including
  unconfirmed ones. The badge now follows the registry's `confirmed` flag:
  "Confirmed data" (Sodex) or "Scenario data" (Arcus, Variational, RiseX).
- **Still open:** RiseX's Featured card says 10% while its calculator uses 25%. Left
  as is; not part of this request.
- Tests: `points-programs.test.ts` (+12). They cover:
  - the 39-drop maths and value per point;
  - the presets, the Variational card/calculator match, and the shared-link hash;
  - preset chips and the honest badge.

## 2026-10-03 (133) — "What is XYZ Crypto?" explainer film below the hero

Owner request: a one-minute film for new visitors, in a desktop and a phone cut,
on the homepage. No new routes; `/` is still ISR 15m; route table identical.
**1479 tests.** Real-browser checks: **27/27** (desktop, phone, phone light theme).

- **Section** `ExplainerVideo` (server) + `ExplainerPlayer` (client). It sits
  directly after the hero and its ticker.
- **Fits on one screen** (owner follow-up). The frame is sized by the screen's
  HEIGHT, `min(cap, (100svh - navbar - heading) x aspect)`, so the heading and
  the whole frame show together on one screen. Measured on 7 screens, from
  360x740 to 1920x1080: all fit, with equal left and right margins. On a phone
  the duration chip shortens to "1:05 · CC" so the bar stays on one line.
- **The film, 1:05.**
  - It reuses the AneQue story: 3 AM, the chaos, discovery, the tour, 50K+
    across YouTube / X / Telegram, then dawn.
  - Markets is marked **Preview** (the redesign is not built); Portfolio and
    Derivatives are marked **Coming soon**.
  - Desktop is 16:9 (1920x1080, 9.7 MB); phone is 9:16 (1080x1920, 8.6 MB).
    Both are H.264 with faststart.
  - Captions are a WebVTT track, on by default, instead of burned-in subtitles.
- **Costs nothing until play.**
  - Before the click the section is a **22 KB / 15 KB** WebP poster and a button.
  - The `<video>` element does not exist yet, so nothing is requested; verified
    in the browser, with 0 media requests before the click.
  - The cut (desktop or phone) is chosen in the click handler from the same
    768px breakpoint the CSS uses, so there is no hydration mismatch.
  - `/media/explainer/*` is served with `public, max-age=31536000, immutable`.
    The file names carry the version (`-v1-`), so a new cut is a new URL.
  - The service worker does not intercept `.mp4` / `.vtt`, so range requests
    and seeking work natively (206 verified).
- **Trap found: `text-base` sets a colour on this site.** The theme has a colour
  token named `base`, so `text-base` emits both a 16px font size and
  `color: var(--bg)`, the page background. On its own it makes text invisible.
  It painted the player's label background-black at `sm` and up; fixed with
  `sm:text-[16px]`. 51 other uses exist; the sampled ones pair it with a
  `text-zinc-*` that wins, so nothing visible today. Worth a sweep.
- Tests: `explainer-video.test.ts` (10). They cover:
  - no `<video>` before the click, and the breakpoint match;
  - file budgets and the cache header;
  - the service worker leaving media alone;
  - captions, placement, and the theme-safe label colours.

## 2026-10-02 (132) — AI: thinking models were eating the answer's budget

Owner report: XYZ AI "not working well" in the assistant, News and Points
Intelligence. No new routes, no schema change. **1470 tests.**

- **Root cause.** On 2026-08-20 both providers moved to models that think before
  they answer (Gemini `gemini-3.6-flash`, Groq `openai/gpt-oss-120b`). Their
  thinking is spent from the same output budget as the answer, and every
  `maxTokens` here was sized for the answer alone. So:
  - short tasks could come back **empty**: "why this matters" (160), the coin
    and protocol briefs (260), moderation (8);
  - long ones stopped early (`finishReason: length`). That is the "briefing is
    slow and cut off" that four earlier fixes treated as a timeout, ceiling or
    continuation problem.
- **Fix, in the providers, so every AI feature gets it** (`providers/reasoning.ts`):
  - **Gemini:** thinking is capped (512, or 0 for answers of 64 tokens or fewer),
    and the output ceiling is the answer budget **plus 2048 headroom**.
  - **Groq:** reasoning models get `reasoning_effort: "low"` and the same
    headroom. This is never sent to Llama, which rejects it.
  - Unused headroom costs nothing; billing is per token generated.
- **An empty answer is now a failure.** The gateway used to hand a blank 200 to
  the reader as success. It now fails over to the next provider, and that
  includes a stream that ends with no text, caught before any byte is sent.
- **Retired model ids recover on their own.** On a 404, Gemini tries
  `gemini-flash-latest`, then `gemini-2.5-flash`, and remembers which one
  worked. If the API rejects the thinking field, it retries without it.
  `GEMINI_MODEL` and `GROQ_MODEL` (optional) swap models without a deploy.
- **The assistant no longer quotes placeholder market numbers.** When the
  markets feed is down, `/api/markets/global` answers with built-in fallback
  figures and `live: false`. The assistant passed those through as today's
  market. It now uses market stats and coin prices only when `live` is true.
- **`/api/ai/health` can see the problem.** It used to probe with "reply OK in
  10 tokens", which a thinking model cannot answer. It now uses a realistic
  prompt and reports `finishReason`, `servedModel` and latency.
- Tests: `reasoning-budget.test.ts` (15).

## 2026-09-28 (131) — Remove bookmarks, site-wide haptics, light-theme visibility, alignment

Owner request. No new routes, no schema change (migration `42_chat_bookmarks`
from #130 was sent to the owner to run by hand). Verified in a real browser:
**19/19** new checks, and every earlier probe still passes, so **310** browser
checks in total. Layout audit is clean at every width, theme and text size.
**1456 tests.**

- **Remove a bookmark from your profile.** In the Library's Bookmarks tab the
  owner sees a remove button on each card (`aria-label="Remove bookmark"`).
  It is optimistic and puts the card back, with an error haptic and message,
  if the `DELETE` fails. Visitors see the plain bookmark icon, with no button.
- **Haptics across the whole site.** One capture-phase `pointerdown` listener
  on `document` (`GlobalPressFeedback`, mounted in the root layout) gives every
  button, link, tab, switch, slider, checkbox and select the selection tick and
  sound. Plain text never buzzes, disabled controls never buzz, and the reader's
  Haptics / Sounds settings apply as before. The chat's own handlers go through
  the same `pressFeedback()`, which marks the event, so a press is felt
  **once**, never twice.
- **Light theme: everything readable.** Measured with a contrast scanner on 17
  pages, then fixed:
  - Legal-page links: 3.37:1 → the readable green used for "up" figures.
  - The Points disclaimer's amber text (`/80`, `/90` variants were missed).
  - The cream "AIRDROP / PORTFOLIO" eyebrow word (1.1:1 on white).
  - The dark "Coming soon" veil over My Airdrops is now a light veil in light
    theme (`.soon-veil`).
  - The grey slab behind empty states is now a normal surface.
  - The "Coming soon" pill had dark text on its dark pill.
- **Homepage orbit badges** faded down to 25% opacity (both themes): they
  reused `floatY`, which animates opacity. New `floatNode` keyframes move them
  without fading.
- **Fix from #130:** "Background effects: off" hid the orbit links (they carry
  `.motion-decor`). The rule now excludes `.orbit-node`.
- **Alignment.** Layout audit of 12 pages × 9 widths (320 → 1920), both
  themes, at text sizes 90 / 100 / 110 / 125%:
  - At **125%** the page overflowed at 320–360px and the desktop header's
    Sign-up button was cut off at 1280px. The layout is rem-based and the
    breakpoints are px, so the biggest size is now capped only where it cannot
    fit: 110% below 380px, 118.75% from 1280–1439px. Everywhere else the
    reader gets exactly 125%.
  - The homepage Communities grid had no explicit column, so its single track
    sized to the long handle text and overflowed at 320px. It is now
    `grid-cols-1` with the handle truncated.
- Tests: `visibility-haptics.test.ts` (13).

## 2026-09-28 (130) — Bookmarks, profile Library, voice for all, Customize website

Owner request. Verified in a real browser on mobile and desktop: **42/42** for
this work. Every earlier probe still passes: 36 + 28 + 12 + 51 + 21 + **77** +
24, so **291** browser checks in total. **1443 tests.**

- **Bookmark community messages.**
  - A bookmark button sits in each message's action bar, and a small gold
    marker shows on bookmarked messages. The toggle is optimistic, with a
    haptic and a sound.
  - Bookmarks show on the member's **public profile**, as the owner asked.
    Only messages that are still visible are listed, so a hidden message drops
    off every profile at once.
  - Migration `42_chat_bookmarks` is idempotent. The new routes:
    - `POST /DELETE /api/chat/messages/[id]/bookmark`: two rate-limit keys, and
      only a visible message can be bookmarked.
    - `GET /api/chat/bookmarks`: private and no-store.
  - Every read tolerates the table not existing yet, so previews show an empty
    list instead of an error.
- **Profile Library.** A new section with two tabs:
  - **Bookmarks**, public, with each card linking to `/community?m=<id>`.
  - **Saved**, your research and news. It stays **private** and only appears
    for the profile's owner, as it always was.
- **Voice notes for every member** in the room. Photos stay staff-only.
- **Customize website**, from the navbar, the mobile menu, the chat side menu
  and Settings (the tab is now "Customize"):
  - Theme; text size (90 / 100 / 110 / 125%).
  - Animations: Auto / Full / Lite / Off. Off also switches framer-motion off
    via `MotionConfig` (context only) and turns off smooth scroll.
  - Background effects and glass blur, each on or off, plus a one-tap
    **Performance mode**.
  - Haptics, sounds and chat style; Reset to default.
  - Everything is a class on `<html>`, applied **before paint** by the
    existing no-flash script and live by `applySitePrefs`. A test runs the real
    script and checks it agrees with the live apply.
- **Every screen size.** An audit of 12 pages at 9 widths (320–1920px) found no
  horizontal overflow, with every entrance animation settled. Large text also
  keeps pages overflow-free.
- **Found and fixed:**
  - The on/off switch knob sat outside its track. It was absolutely positioned
    with no `left`, measured at 46px in a 48px track. This affected the new
    panel and the existing "Soften" switch.
  - The earlier "Haptics & sound" test was updated for the tab's new name.

Route table: `+ƒ /api/chat/bookmarks`, `+ƒ /api/chat/messages/[id]/bookmark`.
No page changed.

## 2026-09-28 (129) — Voice: no more edit corruption, speed + transcript + translate, better quality

Owner request, with a screenshot. Everything was verified in a real browser on
mobile and desktop: **36/36**. Every earlier probe still passes: feel 28,
fixes 12, DM 51, room 21 + **77**, voice/link 24.

**Bugs**
- **Editing a voice message corrupted it.** The screenshot showed the URL as a
  raw link with the typed text under it.
  - Cause: the room offered Edit on media, and **neither server checked**. The
    edit box loaded the URL, text was typed below it, and the body stopped
    being "a lone media URL".
  - Fix: both `PATCH` routes (room and DM) now refuse to edit
    photos, GIFs and voice notes, and the room no longer offers Edit on them.
  - Rows already saved that way now render as the voice note (or photo) with
    the text as a caption (`splitLeadingMedia`).
- **A reply to a GIF showed the giphy URL.** The quote now says "GIF"
  (`mediaLabel`).
- **Tapping a control inside a message also triggered the message's
  gesture.** A probe caught two taps on the speed chip hearting the message.
  - Double-tap, long-press, the room's desktop double-click and its tap-to-open
    actions now all ignore presses that start on a control (`fromControl`).
  - Tapping a link no longer *also* opens the action bar.

**Voice**
- **Quality:** recording is now 64 kbps Opus (was 32), mono, with automatic
  gain control. A 60s note is about 480 KB, still under the 2 MB cap.
- **Speed:** a 1x → 1.5x → 2x chip. The last speed you used carries over to the
  next note.
- **Text / Translate:** transcribed with Groq Whisper, via a new route,
  `/api/media/voice/transcribe`.
  - It only accepts our own `voice/` Storage URLs, so it can't be pointed
    anywhere else.
  - Signed-in only, with two AI rate-limit keys.
  - The transcript text is cached for a day, but a **failure is never
    cached**.
  - Translate then uses the existing English ⇄ Hinglish translator. Each
    transcript is fetched once and reused.
  - If Whisper isn't on the Groq account, the button says "not available". It
    can't be verified here without the key.

**Chat features**
- @mentions of you are highlighted in the room.
- Copy link to a message. `/community?m=<id>` opens the room scrolled to that
  message.
- ↑ in an empty composer edits your last message; Esc cancels a reply.
- The full date shows on hover of a timestamp.

**Profile and settings**
- Every control on the profile page and in Settings now gives the same
  haptic/click feedback. The profile page uses a `display: contents` client
  leaf, so its route class is unchanged.
- Settings has a new "Haptics & sound" tab.

Gate: **1426 tests**, lint 0 errors, build clean. Route table: `+ƒ
/api/media/voice/transcribe` only.

## 2026-09-28 (128) — Chat + DMs: haptics everywhere, sounds, colours, text size, spacing

Owner request: more haptics, more sound, a stronger UX, a better look and more
ways to customise. All of it is per member and per device, and **the defaults
look exactly as before**. Every accent defaults to "Classic": gold bubbles in
DMs, mint rows in the room.

- **Haptics on every control** (`chat-feedback.ts`).
  - One capture-phase `pointerdown` listener per chat surface ticks on any
    button, link, tab, menu item or slider. That includes portalled menus and
    sheets, because React events bubble through portals.
  - Specific actions keep their own pattern: a **double tick when a message
    sends**, a toggle for reactions, and a double pulse for errors.
  - Levels are Off / Standard / Strong. Strong doubles the vibration, not the
    pauses.
  - An explicit choice now **overrides reduced-motion**. Android enables
    reduced-motion under battery saver, which silently switched haptics off,
    and that is a large part of why they were barely felt. With no choice,
    reduced-motion is still respected.
- **Sounds** (`sfx.ts`): synthesised with Web Audio, so there is nothing to
  download and nothing for the CSP to block.
  - Sounds for send, receive, reaction, error, and voice record start/stop.
  - "Everything" also adds a soft click on every control.
  - Levels are Off / Messages / Everything, plus a volume slider.
  - The room's speaker toggle now drives the same setting, and the old
    `xyz:chatSound` choice is migrated.
  - DMs now make a sound when a message arrives.
- **Customise** (Chat appearance → "Style & feel"):
  - Accent colour: Classic, Gold, Mint, Sky, Violet, Rose or Mono. It applies
    to your DM bubbles and your room rows.
  - Text size: Small / Default / Large.
  - Spacing: Comfortable / Compact.
  - Haptics and Sounds, each with a Test button.
  - The live preview reflects accent, text size and spacing.
  - Stored in `xyz.chat.feel` and read through `useSyncExternalStore` with a
    fixed server snapshot, so it can't cause a hydration mismatch.
- **Layout**: room messages are capped at a reading width on wide desktops,
  where a line used to run about 1000px.

Verified in a real browser, recording every `navigator.vibrate` call and every
synthesised note: **28/28** on mobile and desktop. That covers the tick on
press, the sent pattern and sound, Strong scaling, the accent, text size and
spacing applied, persistence after reload, the accent shared with the room,
and reduced-motion respected by default and overridden by choice.

All earlier probes still pass: fixes 12, DM 51, room 21 + 77, voice/link 24.
**1415 tests**, build clean, route table identical.

## 2026-09-28 (127) — Three chat bugs: quote jump, voice playback, dictation doubling

Each bug was **reproduced in a real browser on the old code**, then shown fixed
on the new code, on mobile and desktop. That is 10/10 checks, plus 2 for desktop
dictation. Every earlier probe still passes: DM 51, room 21 + 77, voice/link 23.

- **The room's reply quote jumped to the wrong message.**
  - Measured: it landed **1963px** away, off screen. Now **0px**, centred.
  - Cause: `scrollToMessage` centred with `el.offsetTop`. That value is
    relative to the nearest *positioned* ancestor, and #365's swipe-to-reply
    wrapper (`relative`) became that ancestor, making every row's offsetTop ≈ 0.
  - Fix: `centredScrollTop()` measures with bounding rects, relative to the
    list whatever sits in between. DM `jumpTo` uses it too.
- **Voice messages rendered but never played.**
  - Measured: CSP violation `media-src … /voice/…webm`, the file was never
    requested, and the player showed media error 4.
  - Cause: the CSP had `media-src 'self' blob:`, so an `<audio>` element could
    not load from Supabase Storage.
  - Fix: `media-src 'self' blob: https://*.supabase.co`, the same host
    `connect-src` already allowed. Measured afterwards: 1.72s of real WebM/Opus
    audio played.
  - The player now says "This voice message can't play here." on any failure
    (for example, an older iPhone and WebM) instead of doing nothing.
- **Dictation doubled words and dropped others.**
  - Measured with Android Chrome's real event shapes: "bitcoin is bitcoin is
    pumping". Now "bitcoin is pumping today bro".
  - Cause: the hook counted result **positions**. Android Chrome repeats the
    phrase so far as a new result (so words doubled) and restarts its list at
    index 0 (so a cursor past 0 dropped the next phrase).
  - Fix: `speech-merge.ts` decides what is new by **text**. It is unit-tested
    against scripted desktop and Android sessions, 9 cases.
  - Android now uses one utterance per session. Its continuous mode is the
    engine's least accurate. Desktop keeps continuous mode.

## 2026-09-28 (126) — Build warning "Parsing CSS source code failed" fixed at the source

Every build from #363 onwards printed:
`Warning: Parsing CSS source code failed … Unknown at rule: @media(hover` at a
`globals.css` line that does not exist in the source file. It was a warning:
builds still passed and deploys went out. It is now gone.

**Cause.** Tailwind's `content` glob (`./src/**/*.{js,ts,…}`) included **test
files**. Tailwind reads every file as plain text and compiles anything
class-shaped. In `dm-premium-ux.test.ts`, the regex
`/\[@media\(hover:none\)\]:h-11/` looked like the class
`[@media\(hover:none\)\]:h-11`, and Tailwind compiled it into the invalid
`@media\(hover:none\)\undefined { … }`. The real component class,
`[@media(hover:none)]:h-11`, was always fine.

**Fix.** One change to `tailwind.config.ts`: it excludes `**/__tests__/**` and
`*.test.*` from `content`. No CSS, component or design change.

**Proof.** I diffed every generated selector before and after: 2339 → 2332.
- The 7 removed are the broken `@media` rule plus 6 classes that appeared
  **only** in test files: `-translate-y-0.5`, `group-active:translate-x-0`,
  `max-h-32`, `scale-105`, `shadow-black` and `translate-x-full`. A search shows
  no page uses any of them unprefixed.
- The prefixed forms pages do use (`hover:scale-105`, `-translate-x-full`) are
  still generated.
- 0 selectors added.
- The route table is identical, and the build has no warnings.

`tailwind-content-scope.test.ts` pins the exclusion.

## 2026-09-27 (125) — Chat + DMs: voice messages, link previews, "typing…"

Verified in a real browser with Chrome's fake microphone: a real recording is
captured, uploaded, sent and rendered as a player. That covers mobile and
desktop, 23/23 checks. New unit tests: `chat-features-v3.test.ts`, 17.

- **Voice messages.** In the "+" tray. They're available to everyone in DMs,
  and to staff in the room, which is the same rule as photos.
  - The recorder bar has a live level meter and a timer, and stops by itself
    at 60s. Discard throws the recording away and releases the mic.
  - The player has a waveform, supports seeking (click, or the arrow keys),
    and only one note plays at a time. It uses `preload="none"`, so nothing
    downloads until someone presses play.
  - `POST /api/media/voice`:
    - rate-limited on two keys;
    - rejects an oversized body before reading it;
    - checks the file's **bytes**, not its declared type (WebM, Ogg or M4A;
      an AVIF image fails the brand check).
  - **Stored in Supabase Storage only, never inline.** A base64 note in a
    message row would ride every thread response (cost-check trap 4). Without
    Storage the feature says so and stores nothing.
  - The length rides in the URL fragment (`#d=12.3`), because Chrome writes
    WebM without a duration.
  - Inbox, push notification and quote all read "🎤 Voice message"
    (`mediaLabel`).
- **Link previews.** A card under any message with a link: site, title and
  description.
  - **Text only.** A third-party image would make every reader's browser fetch
    it, leaking the room's IPs, the same reason `chatMediaUrl` exists.
  - `GET /api/link-preview` is signed-in only and has its own `linkPreview`
    bucket (30/min, per user and per IP). Successes are cached at the edge for
    24h, and the reduced value is cached with `unstable_cache`.
  - Cards only fetch once a message is on screen, with one fetch per URL per
    page.
  - **SSRF-safe fetch** (`core/net/safe-fetch.ts`):
    - http(s) on the default ports only;
    - every resolved address is checked **at connect time** through the
      socket's own `lookup`, so DNS rebinding can't swap in 127.0.0.1;
    - redirects are followed by hand and re-checked at every hop;
    - 4s timeout, 256 KB cap, HTML only.
- **"typing…" in DMs.** Shown in the thread header and as a bubble.
  - Sent browser-to-browser on a per-conversation topic (`dmChannel`), with no
    server round trip and nothing on the wire but a user id.
  - One ping per 2.5s burst; clears itself after 4s, or when their message
    arrives.
  - Absent when realtime isn't configured.

Route table: `+ƒ /api/link-preview`, `+ƒ /api/media/voice`. No page changed.
0 data-cache failures.

## 2026-09-27 (124) — Chat + DMs: full-screen, modern, and the two DM bugs fixed

Owner request, in three parts, all verified in a real browser against the real
`ChatClient` / `MessagesClient` (DM 51/51, new room checks 21/21, and the original
room probe 77/77), on a 390px phone and a 1440px desktop, with the screenshots reviewed.

**DM bugs the owner reported**
- **A reply lost its quote until refresh** ("tag karne pe direct tag nahi ho raha").
  `POST /api/dm/[id]` returned the message without `replyTo`, and the client
  swaps its optimistic row for that response. It now returns `replyTo` and
  `forwarded`.
- **Tapping a quote did nothing** ("click karne pe redirect nahi hota"). The quote
  was a plain `<div>`. It is now a button that scrolls the list, not the page,
  to the original message and flashes it. The pinned banner and the "Replying
  to" bar use the same path.
- **The Block / Report menu was hidden behind the messages.** The header and the
  message list were both `z-[1]`, and the list comes later in the document. The
  header is now `z-20`. A probe hit-tests every menu item.
- **Block asks first**, the blocked state is a clear card with Unblock, and
  Escape closes the menu.

**DMs: new**
- **Reactions.** Six emoji, one per person per message, like WhatsApp and
  iMessage.
  - Double-tap a bubble for ❤️, or pick from the top of the actions menu.
  - New route `POST /api/dm/[id]/message/[messageId]/react`: allowlisted emoji,
    block-gated, authorised from the message's own conversation, and
    rate-limited per user and per IP.
  - Migration `41_dm_reactions` adds two nullable columns and is idempotent.
  - The thread GET reads reactions in a **separate query that may fail**.
    Preview deploys share the production database but never push the schema,
    and selecting the columns in the main query would have taken every DM
    thread down on the preview.
- **Gestures:** swipe right to reply, long-press for actions.
- **Search in the conversation** with "3 of 7" and up/down navigation.
- **Drafts** are kept per conversation on the device, and the inbox shows
  "Draft:".
- **Inbox:** All / Unread / Pinned tabs, an unread count, and a new-message
  button.
- **Thread:** sticky day labels, a "Seen" line under the last message they read,
  and redesigned bubbles and header.

**Community room**
- The "XYZ Lounge" title, the "LIVE" label and the page eyebrow are gone.
  - The header now reads: menu, who is online, then search, appearance, alerts
    and sound. All five controls share one 40px style.
  - The connection state is still there. It is the dot on the online pill,
    with the full detail in its tooltip, and "Stale" still prints in amber.
- **Search** over the loaded messages.
- Swipe to reply, double-tap for ❤️, and message highlighting.

**Composer, both surfaces**
- Poll, GIF and Photo moved behind **one "+" button**. Three buttons had left
  the text box so narrow that its placeholder wrapped and the empty box grew to
  two lines. That was the owner's third screenshot.
- An empty composer is now **one line by rule**, in `useAutoGrow` and in the
  room, whatever the placeholder does.
- The room's `0/500` counter only appears in the last 100 characters.
- Pill text box and a round send button.

**Immersive screens**
- `/messages`, and `/community` for members, drop the site header entirely.
  - Phones get the full screen edge to edge; desktop gets a large framed app.
  - Navigation lives in a new side drawer, `AppMenu`, which carries the
    complete `navLinks` list plus search, theme, XYZ AI and account links.
  - The floating XYZ AI button is hidden there, because it would sit on the
    composer. It opens from the drawer.
  - The signed-out `/community` preview keeps the normal site chrome.
- The member view keeps its screen-reader-only `h1`. I removed it by accident
  and the SEO test caught it.

**Found along the way**
- `bg-ink-900/98` generates **no CSS**, because Tailwind's opacity scale moves
  in steps of 5. So the GIF picker, and at first the new menus, had no
  background at all. A screenshot caught it; now fixed.
- `chat-dm-v2.test.ts` rejects any off-scale opacity in the chat files.
- Pre-existing `/12` modifiers elsewhere (dashboard, primitives, footer and
  others, 21 uses) are **not** fixed here. Fixing them would add tints that
  have never rendered on those pages, which is a design change for the owner
  to decide.
- The swipe gesture first read its distance from React state, so a fast swipe
  did nothing. A probe caught it; it now uses a ref.
- The inbox rows' menu buttons now have their own accessible names. They all
  used to share the thread header's name, "Conversation options".

## 2026-09-27 (123) — PR 3: typing no longer freezes chat and DMs; less layout work site-wide

Every fix was measured before and after in a real browser (production build;
the real `ChatClient` / `MessagesClient` with 150 messages from fixtures).
"4× throttle" is Chrome's CPU throttling, roughly a mid-range phone.

| | Before | After |
|---|---|---|
| DM, main-thread work per keystroke | 100ms (≈400ms at 4×) | **13ms** (≈56ms) |
| Community room, per keystroke | 58ms (230ms at 4×) | **22ms** (~8ms of it typing, the rest the page's ambient animation) |
| Homepage, layouts forced by 150 DOM inserts | 188 | **47** |

- **Date formatting built a new `Intl.DateTimeFormat` on every call.**
  `clockTime`/`dayLabel` (`shared/utils/chat-time.ts`) and
  `formatDate`/`formatDateWithDay`/`formatDateTime` (`shared/utils/utils.ts`)
  called `toLocale*String`, which constructs a formatter each time. At about
  4 per message per render, that was **58ms of a 100ms DM keystroke**. They
  now reuse formatters built once.
  - The reader's timezone is applied by shifting the instant by its own
    `getTimezoneOffset()`, not by caching a local-zone formatter. A cached one
    would freeze the zone it was built in; `dm-receipts.test.ts` caught exactly
    that in the first version.
  - An invalid date still reads "Invalid Date". `Intl#format` throws where
    `toLocale*String` did not.
  - `chat-time-format.test.ts` compares every output against the old
    implementation over 3,000 random dates. It passes in UTC, IST, Los Angeles,
    Chatham (+12:45) and Lord Howe (half-hour DST).
- **Typing re-rendered the whole conversation.** The draft lived in the
  component that renders every message, so each key re-rendered all rows.
  It now lives in `RoomComposer` (room) and `DmComposer` (DM). Behaviour is
  unchanged: the draft is cleared optimistically and given back on failure
  unless you've started typing again, and media sends never touch it. The
  senders now return whether they succeeded. Browser probes: room 77/77,
  DM 29/29.
- **`PauseOffscreenAnimations` forced a layout on every DOM change.** It
  re-ran `querySelectorAll` plus an `offsetHeight` read on each mutation
  anywhere in the body, and never released removed sections. Now:
  - mutations are coalesced into at most one scan per 250ms;
  - elements already watched are skipped;
  - detached elements are unobserved.
  Verified that a section added after load is still paused, and un-pauses when
  scrolled to.
- **`/profile` and `/saved` got a `loading.tsx`.** Both are force-dynamic and
  had no loading boundary, so a tap showed nothing until the server answered.
  `perf-pr3.test.ts` now requires one on the path of every force-dynamic page.

**Measured and deliberately not changed:**
- The page idles at about 13–15% main thread (headless, software raster),
  nearly all of it the always-on brand animations.
- Individually, the navbar robot's SVG blink/antenna (the only thing forcing a
  **layout every frame**, ~1.5 points), the navbar AI pulse (~1 point) and the
  launcher glow (~1 point) are each small, and all three are recorded **owner
  decisions**. Left alone.
- Lenis smooth scroll: no measurable difference on or off. Left alone.
- `.surface` backdrop blur: removing it changed nothing. Left alone.

## 2026-09-27 (122) — DMs: the composer and appearance control are the room's

PR 2, follow-up. `MessagesClient.tsx` only.

- **Composer textarea now uses the room's exact classes.** The visible fix is
  `text-base sm:text-sm` in place of `text-[14px]`. **iOS zooms the page into
  any input under 16px**, so on an iPhone every tap on the DM composer zoomed
  the thread. The mint focus ring (`ring-2`), `leading-relaxed` and
  `aria-invalid` on error also match the room now.
- **Send button** is the room's `motion.button` with the same press
  (`whileTap` 0.9) and `!rounded-2xl`. The old DM button was plain
  `rounded-2xl`, which `btn-primary` overrode.
- **"Chat appearance" button** is the room's 36px bordered square, not a
  32px round ghost. The background, including your own photo, was already the
  same code (`useChatAppearance` / `ChatWallpaper` / `ChatAppearanceSheet`),
  and the choice is shared between the room and DMs.
- `dm-premium-ux.test.ts` compares the DM classes against **ChatClient's
  source**, not a copied string, so any change to the room's composer fails
  the test until DMs follow. Browser probe: 29/29 checks (16px composer on
  mobile, mint ring, 36px control, 16px radius, no page errors).

## 2026-09-27 (121) — DMs: the composer grows, phones can type a line break

PR 2. DMs only.

- **The composer never grew** - the same `rows={1}` bug the room had. The
  auto-grow is now one shared hook, `useAutoGrow`, carrying all three lessons
  from the room (release height before measuring, placeholder is an input,
  re-measure on width).
- **Enter always sent, even on phones** - which have no Shift key, so a mobile
  user could not type a line break at all. Touch: Enter is a newline. Same for
  the edit box.
- **The message-actions trigger was 28px** on touch - the only way in to Reply.
  44px now, via a media query rather than a hook.
- **"Latest ↓"** appears whenever you scroll away, not only when a message
  arrives.
- **Chat appearance in DMs** - the room's own components and stored choice, so
  a background or photo picked in one place shows in both.

typecheck · 1314 tests · lint 0 errors · build green · 21/21 browser checks on
the real `MessagesClient` (mobile + desktop).

---

## 2026-09-27 (120) — Chat appearance: your own photo, richer designs, and a real browser test

Same PR as (119), still Community Chat only.

### Your own photo as the chat background

⚠️ In this room other people's messages have **no bubble** - their text sits
directly on the background. A bright personal photo would make them unreadable,
so the scrim over a photo is **computed, not guessed**: on upload the photo's
brightest and darkest regions are measured (64x64 grid, ~one text line per cell
at `object-cover` scale), and `minScrimAlpha` finds the least dim that keeps body
text at WCAG AA (4.5:1) over the worst region for the current theme. The dim
slider cannot go below that floor. A property test checks it over 10,000 random
colours. Floors are proportionate: a white photo needs 62% in dark mode, a
forest photo 0%.

The photo **never leaves the device** - WebP in IndexedDB. Uploading would mean
opening the storage bucket to every member and a public URL per personal photo.
GIFs are flattened to one frame; undecodable, oversized and non-image files are
refused with a plain message rather than stored raw.

### Richer designs

Eleven presets in two families - **Colour** (washes) and **Pattern** (grid,
dots, diagonal, crosshatch, isometric) - still CSS-only and under the 0.2 alpha
readability cap.

### Chat appearance sheet

Replaces the popover: a live preview drawn by the **same** `ChatWallpaper`
component as the room, the photo's actual text contrast shown ("7.2:1 · AAA"),
dim slider, blur toggle, remove with a second tap. Bottom sheet on phones.

### What the browser caught

The real `ChatClient` was driven in a browser for the first time (fixture
harness in a throwaway copy with no `.git`) - **77 checks**, mobile and desktop.
It found three real problems:

- **The report route exported a constant**, which webpack's route validation
  rejects. Moved to `chat-report.ts`; `route-exports.test.ts` now fails the build
  for any route exporting a non-Next name.
- **The empty composer was 76px on phones** - measured once against the server's
  longer placeholder and never again. Now re-measures on placeholder and width.
- **The wallpaper followed the theme a render late** via a MutationObserver. The
  theme is now chosen by CSS (`.chat-wp` / `.chat-wp-scrim`), so it flips in the
  same frame as the page.

### Verification

typecheck · **1308 tests** · lint 0 errors (44 = baseline) · build green · 77/77
browser checks.

---

## 2026-09-27 (119) — Community Chat: a composer that grows, reporting, backgrounds

Scoped to Community Chat. No other page, API, table or product area is touched.

### ⚠️ The composer never grew

The textarea was `rows={1}` with `resize-none` and `min-h-[44px]`, and **nothing
anywhere adjusted its height**. `max-h-28` was present, but a box that never
grows never reaches its maximum - so a long message scrolled inside a single
44px line. That is the entire "long-message experience is uncomfortable" report.

It grows now, capped at 148px (~6 lines) and scrolling internally past that, so
it can never push the message list off a small screen.

The load-bearing detail: the height is released (`auto`) **before** reading
`scrollHeight`. The scrollHeight of an element with a fixed height IS that
height, so measuring without resetting reads back what you already set and the
box never grows a second time.

### Reporting

New `ChatReport` table (additive, idempotent migration `40_chat_reports`), a
`POST /api/chat/messages/<id>/report` route, and an accessible dialog.

⚠️ **The reporter is told nothing about moderation.** Not whether the message
was already reported, not by how many people, not what happened next, not who
reviews it. A duplicate returns the **same success** as a first report - saying
"you already reported this" would confirm prior state, and gains the reporter
nothing. De-duplication is a unique index, not a read-then-write.

⚠️ **Reporting hides nothing.** A self-service hide would let any member silence
any other. Hiding stays with `post:manage` in the existing moderate route,
untouched.

Gates: authenticated · rate-limited on **two** keys (per user and per IP) ·
cuid-shape checked · the message must be **visible** (which is also what stops
the route enumerating hidden ids) · not your own.

### Backgrounds

Seven presets, all pure CSS gradients - no asset, no fetch, no canvas, no
animation. They sit behind a scrolling list, so anything that repaints is the
wrong answer. Persisted in `localStorage`, the same way the theme already is: a
wallpaper is a per-device display preference, and a `User` column for it would
mean a schema change, an endpoint and a round trip before the room can paint.

⚠️ A test caps every preset at alpha 0.2 and **caught `midnight` at 0.65** -
four times heavier than the rest, enough to darken the room and drag the message
text with it.

### Touch targets

Message actions were `p-1.5` around a 14px icon: a ~26px target, next to Delete
on some rows. 44px on touch.

### Verification, and its honest limit

typecheck · **1280 tests** (21 new) · lint (0 errors, 44 warnings = baseline) ·
production build green.

⚠️ **The chat could not be exercised in a browser here.** `/community` needs
Postgres and a session - signed out it renders a different component entirely -
and this environment has neither `DATABASE_URL` nor `NEXTAUTH_SECRET`. A probe
against it loads an empty shell, so every assertion in one passes while
measuring nothing. The new tests are therefore source-level, and the
browser-only behaviour is listed as manual steps in the PR.

---

## 2026-09-22 (118) — 90 invisible hovers in light mode, and a disclosure that popped

### ⚠️ The light theme's hover language did nothing

Measured across the app: **90 hover states** paint
`rgba(255, 255, 255, 0.02-0.10)`. On a `#eef1f6` page that is white on white -
**no visible change at all**, on every card, row, menu item and icon button.

The base classes (`bg-white/5` and friends) already had light overrides. The
hover VARIANTS were deliberately skipped, on the reasoning that *"a hover tint
should stay a tint"*. That reasoning is right and the conclusion was wrong: a
tint has to be darker than the page to be a tint. They stay tints, flipped to
the direction the theme needs, with the alpha ladder preserved so relative
weights still read (a `/10` press is heavier than a `/5` hover).

The **press** variants had the same blind spot, which meant a tap on a phone in
light mode had no feedback whatsoever.

Left alone on purpose: `/20` and `/70`, which sit **on imagery**, where white is
correct in both themes.

Measured after: light resolves to `rgba(16, 18, 27, 0.086)`; dark is untouched.

### The Live Comparables Terminal appeared rather than opening

It was `{showAdvanced && (...)}` - the panel existed in one frame and not the
next, which reads as the page glitching rather than as something opening. A
disclosure is the one place a reader has explicitly asked "show me more", so it
is worth animating properly.

`grid-rows: 0fr -> 1fr` animates a height nobody has to measure, and it is
already the pattern the updates band's expanding rows use - so this is the
site's existing motion language rather than a new one. The icon rotates and
lifts, the chevron flips, and the whole thing now carries `aria-expanded` and
`aria-controls`, which it did not before.

Measured: collapsed height 0px, transition 500ms, opens to 991px, `aria-expanded`
flips.

### Verification

typecheck · **1259 tests** · lint (0 errors) · build green · **16/16 browser
checks**, run twice - once per theme.

⚠️ `touch-parity.test.ts` caught one of my own additions: a `group-hover:scale-110`
with no press twin, which is dead on a phone. Fixed before it shipped.

---

## 2026-09-22 (117) — The calculator answers the way the Tools one did

### Three money figures for one calculation

The result box showed a **"$6.00 – $17.00"** range on top, then **"Gross Value
$10.64"** and **"Liquid at TGE $2.66"** side by side. Three different amounts
for a single calculation, none labelled well enough to say which was *the*
answer - and the range was a fallback spread (0.6x to 1.6x of gross) with no
relationship to the inputs at all.

The Tools calculator this page replaced showed exactly three things - **Your
share · Estimated tokens · Estimated value** - and it was legible. That model is
restored. Recovered from `2d5afad^`, where it was deleted.

The TGE figure is **not** deleted; it was useful, it just should not have been
competing for the headline. It is now one explained sentence: *"About $2.66 of
that is sellable at TGE — the rest unlocks later."*

### ⚠️ Total Token Supply was missing, and it is load-bearing

The input existed in the Tools version and was dropped in the move. Every figure
in the box depends on it - token price is `FDV / supply` - so with the supply
**hidden**, changing FDV moved the answer for a reason the reader could not see,
and the "implied price" line appeared from nowhere. It was in the form state the
whole time; only the field was missing.

Restored, with 100M / 1B / 10B presets in the same pattern the FDV and
allocation rows already use, and the implied price shown beside it so the two
fields visibly tie together.

### Exact dollars

`usdCompact` rounds `$10.64` to `$11`. A small holding producing a small,
*specific* number is the point of this tool, so the headline prints to the cent.

⚠️ `en-US` is pinned. The recovered code used `toLocaleString(undefined, …)`,
and `en-IN` groups digits differently from 10,000 up - an unpinned locale here
is the React #418 hydration mismatch this project has already shipped once.

### Verified against the screenshot, not against the labels

Same inputs as the Tools calculator - 940 points, 9,400,000 pool, 30%
allocation, 1,000,000,000 supply, $1.5B FDV - read back off the headline
element itself:

    $45,000.00  ·  Your share 0.0100%  ·  Estimated tokens 30,000

Identical. ⚠️ A first pass "passed" while its evidence string showed `$1.50` -
the regex had matched the implied price, the first `$x.xx` on the page. The
assertion was sound and the detail was misleading, which is the shape of a check
that would have hidden a wrong answer later.

### Verification

typecheck · **1254 tests** · lint (0 errors) · build green · 12/12 browser checks.

---

## 2026-09-22 (116) — Points onto the rail, and a photo that fits whatever shape it is

### Points takes Premium's place on the desktop rail

⚠️ A **swap**, not an addition, and given this file's history that distinction
is the whole safety argument. The rail has overflowed its breakpoint twice, both
times because a link was added and nobody re-measured - the second time was
Points arriving as a ninth link. It stays at six, and "Points" is a character
shorter than "Premium", so the measured width goes down rather than up.

Premium moves into "More" and stays in `navLinks`, so the footer and the mobile
drawer - which both render the complete list - are unchanged. Measured: the rail
is one row of six.

### A cover image could not be uploaded by the people allowed to post

⚠️ `/api/upload` required `role === "ADMIN"`. Posting a desk update requires the
`points:manage` **permission**. Those are different things, so an editor trusted
to publish a post could not upload its cover: the upload 401'd, the composer
showed the error, and the post saved without a photo.

A permission whose own description is "Post perp DEX & airdrop updates" has to
cover the image that goes with the post. Now ADMIN **or** `points:manage`.

This is a deliberate widening of an auth gate and everything else is untouched -
same rate limit, same image-type allow-list, same 5 MB ceiling, same bucket. It
grants uploading to a role already trusted to publish on a public page.

### The banner cropped every photo it was given

A fixed **110px** band with `object-fit: cover` centre-crops everything to 3:1.
A portrait shot lost its top and bottom, a screenshot lost most of itself, and
nothing in the composer let an author choose the crop.

Two changes make any photo land well with no decision from the author:

1. **A 16:9 frame** instead of a fixed height - it scales with the card, and
   16:9 is the ratio most article and social images are already cut to.
2. **`object-contain` over a blurred copy of the same image.** The whole photo
   is visible, and the bars a non-16:9 image leaves are filled by a scaled,
   blurred version of itself rather than an empty rectangle. A wide image fills
   the frame edge to edge and the backdrop never shows. Same `src`, so the
   backdrop costs no second request.

Measured with a 400x1000 portrait: rendered whole in a 269x151 frame (1.78),
blurred fill present, and the card did not grow.

### Verification

typecheck · **1250 tests** · lint (0 errors) · build green · 9/9 browser checks.

⚠️ Two probe faults were corrected during that run, both the same shape: it
measured HIDDEN elements. Counting every `<a>` in `<header>` included the mobile
drawer's copy of `navLinks`, and measuring after opening the "More" menu counted
its four items - each reported "5 rows" on a rail that had not wrapped.

---

## 2026-09-21 (115) — A post with nowhere to appear, and a statistic nobody measured

### The `+` composer worked; nothing rendered what it wrote

⚠️ The composer POSTs to `/api/points/updates` and the row saved every time.
The hero card only ever fetched `/api/points/radar` - the **press** lane. The
**desk** lane had no renderer at all, because the redesign dropped
`UpdatesFeed`, which was the only thing that displayed it. So a post was
written, stored and broadcast, and had nowhere on the page to land.

The card reads both lanes now, merged: a pinned desk post outranks everything,
then newest first, desk winning a tie because it is the reviewed lane. Desk rows
carry a **Desk** badge - the desk's own word and an outlet's report are
different claims and a reader acts on them differently. `useRealtime` on
`CH_POINTS` means a new post appears without a reload.

**Edit and delete sit on the row**, not in a separate admin screen: the moment
you notice a typo is while looking at the post. The edit form is the SAME
`Composer` with an `edit` prop, not a second one - an edit screen that is a copy
of the create screen is two things to keep in step.

⚠️ And PATCH's schema had **no `image` field**. Zod strips unknown keys rather
than refusing them, so removing a cover appeared to work and silently did
nothing. Added, through the same `safeUrl` gate the POST uses.

### "$12.4M+ Points Analyzed" was invented

⚠️ Seeded at `12_400_000` - and the GET **wrote that seed into Redis** on first
read, so a made-up number became the stored truth. It sat beside two genuine
statistics (tracked protocols, active users), which is what made all three read
as measured.

Starts at zero now, the read no longer seeds, and the key is versioned
(`points:analyzed:v2`) because the old one is already holding the seed in
production and zeroing a constant would not have cleaned it up.

It also **moves as you calculate**: the POST already returned the new total and
nobody read it, while the hero fetched once on mount and never again - so a
reader could watch their own calculation change nothing.

And it no longer prints a `$`. It counts POINTS. "$12.4M+" under a label reading
"Points Analyzed" is a wrong number even when the digits are right.

### The programme picker could not be used on a phone

`absolute right-0` at every width, on a 176px panel whose trigger sits near the
card's left edge - so the list hung off the left of the viewport with the names
cut in half ("dex", "seX", "riational"). `left-0` on mobile, `right-0` from
`sm`. Measured: the panel now sits at `left=42 right=217` inside a 393px
viewport.

### The hero medallion is gone

Removed on request, one release after it was added.

### Verification

typecheck · **1245 tests** · lint (0 errors) · build green · 15/15 browser checks.

---

## 2026-09-21 (114) — A 3D mark on the points hero, and the gap it fills

### The gap was one row, not the whole block

At 393px the hero's eyebrow row held a single short badge and roughly **240px of
empty gradient** to its right - the largest piece of dead space on the page, and
what made the block read as loose rather than composed.

`LogoMedallion` goes THERE, on that row. An absolutely-positioned mark in the
corner would have filled the same space, but it sat under the headline's second
line at some widths, and a decoration that collides with the title is worse than
the gap it replaced. On the row it is laid out: nothing overlaps, nothing
reflows. The probe asserts **0px² overlap with the `h1`** at both widths.

The stack rhythm also went from `space-y-6` plus a `pt-5` rail to a single
20px step. Measured: gaps are now `20, 20, 20` on mobile and desktop alike.

### The mark itself

Three concentric rings around a floating, glowing logo - the homepage
medallion's motif, not its machinery. `Hero.tsx` has pointer tilt springs,
orbiting badges, a lite-tier blur swap and an entrance tuned to be the
homepage's LCP; lifting that out to share would mean re-tuning the element most
likely to regress that page, in order to decorate another one. This is built
from keyframes that already exist, so it adds no CSS and no dependency.

⚠️ **Measured, and it caught a real flaw.** All three rings ran `spin-slow`, and
two of them at an identical 28s `normal` - so the outer and inner turned in
perfect lockstep and the medallion read as one rigid object, which is exactly
what its own comment said not to do. Three distinct speeds now: **28s / 40s
reverse / 17s**. The comment and the code agree.

Not gated on `prefers-reduced-motion`, per the project policy: only heavy
full-screen ambient loops are, and gating bounded elements like this is what
made the site read as static.

### Verification

typecheck · **1235 tests** · lint (0 errors) · build green · **15/15 hero checks**
across mobile and desktop.

---

## 2026-09-21 (113) — "0 tracked" was a silent clamp; a deleted post was still everywhere

### The band said "0 tracked" against a perfectly healthy feed

⚠️ `/api/points/radar` called `getNewsPage({ pageSize: 200 })`. **`getNewsPage`
clamps** - `Math.min(30, Math.max(6, opts.pageSize || 15))` - so 200 silently
became **30**, with no error and nothing to indicate anything had been dropped.
Worse, `getNewsPage` RANKS before paging, by general news impact, so those 30
are the day's biggest crypto stories. Filtering them for perp DEX and airdrop
news is a narrow filter over a sample selected for something else entirely, and
on a day led by ETF and macro headlines it legitimately matches **nothing**.

`findNewsByUrl` in the same file was written for the identical clamp and carries
a warning about it. The radar walked into it anyway.

Now reads `getClassifiedPool()` - the whole classified set, the same
`unstable_cache` entry `/news` already pays for, so it costs nothing extra.

The route also returns `diag: { pool, matched }`, and the card shows it. "Nothing
matched out of 0 stories" is an outage; "out of 340" is a quiet hour. The last
two bugs on this page were both "a number is wrong and nothing says why", and
both were only solved once production could state its own case.

The client also stopped rendering `live: false` as "ready": an upstream outage
was reaching the reader as a quiet window, because the route said which it was
and the client discarded it.

### A deleted research post was still on six surfaces

The report was "delete a post and it still shows premium". It did - and worse.

⚠️ `src/app/research/page.tsx` ran `findMany({ where: { published: true } })`
with **no trash filter**, beside a `count` that had one. The list rendered
trashed posts while the total excluded them, so a deleted premium article kept
its locked card on the index. Five more reads had the same hole: **search**, the
**sitemap** (an active instruction to keep indexing a deleted page), **Related
research**, the homepage **preview**, and the **assistant's grounding corpus**.

**`post-soft-delete.test.ts` existed to prevent exactly this, and reported
green.** It scanned a fixed **420-character window** after each call - and in
`research/page.tsx` the correctly-guarded `count` sat inside the unguarded
`findMany`'s window, so its `NOT_TRASHED` was read as the findMany's own. The
window now matches real parentheses, and each site answers for itself. Tightening
it is what surfaced the other five.

### The briefing streams on the news side too

`/news` was still on the one-shot path. Same change as the points band: streamed,
quality model, `digestItemId` still guarding every write so paging to the next
story mid-stream cannot append deltas to the wrong article.

### Layout

The hero stat row was four bare numbers on a 2x2 grid, floating over the
gradient with nothing holding them together - at 393px the eye read four
unrelated items rather than one summary. They are cards on a divided rail now,
mono where they are numbers, landing in sequence.

### Verification

typecheck · **1235 tests** · lint (0 errors) · build green · 11/11 browser checks.

---

## 2026-09-21 (112) — The band was stuck on invented data; the briefing streams

### "Stuck, and not perp DEX" was three pieces of hard-coded content

Nothing errored. The fetch worked. The card was showing made-up data.

⚠️ **A fabricated placeholder story.** When the feed was empty the card rendered
a fixed item titled *"Crypto ETF flows: Ether loses $141M as Solana gains $61M"* —
general crypto news on a card that promises perp DEX and airdrops — carrying
`category: "Airdrops"` and `venues: ["Hyperliquid"]` so it would pass for one,
and a **fixed `publishedAt`**, so it always read the same date. Fed through the
real filter that story is correctly rejected; it could only ever appear by being
hard-coded. Gone, replaced by honest loading / empty / unreachable states.

⚠️ **A hard-coded timestamp.** `fetchedAt ? … : "Sep 19, 9:20 AM"` — a card that
had never successfully fetched anything still claimed to have checked at a
specific time. That is the most misleading thing a live feed can do.

⚠️ **No poll.** It fetched on mount and on wake, nothing else. A tab left open —
which is exactly what someone watching a live feed does — never updated while it
stayed focused. Now 90s against the route's 120s window, shorter and never equal
(cost-check, trap 1), skipped entirely while the tab is hidden. The carousel also
advances on its own, which is what makes the card *look* live between polls.

Also: the dots were hard-coded `[0,1,2,3,4]`, so two stories drew five dots and
three of them did nothing. One dot per story now.

### The briefing streams — "fast" and "complete" were never two problems

Four previous rounds moved along the same trade-off. One-shot generation forces
it: a token ceiling high enough to finish is a wait long enough to feel broken,
and one low enough to be quick is an answer that stops mid-section. Raising it,
lowering it, changing the model tier and adding a continuation pass were all
moves along that curve.

**Streaming removes the curve.** First words in about a second, a generous
ceiling because the wait no longer scales with it, and no large idle response for
the platform to cut at `maxDuration` — bytes flow the whole time.

- `streamBriefing()` in `ai.ts`, routed on the **`briefing`** task so it takes the
  quality model for everyone. A briefing answered by the fast model writes two
  sentences and stops; that bug was fixed once and a new code path must not
  reintroduce it.
- `stream: true` on `/api/ai/why-matters` — **opt-in**, so every existing caller
  keeps the JSON contract and its `meta` (including `truncated`).
- Plain text, not SSE, matching `/api/ai/assistant`, so there is one streaming
  shape on this site rather than two.
- A mid-stream failure **says so** rather than closing quietly — closing quietly
  is indistinguishable from a briefing that finished early, which is the exact
  ambiguity that made the one-shot version so hard to diagnose.
- The panel shows a caret while text is arriving, so "still writing" and
  "finished" are visibly different states.

### A test that was guarding dead code

⚠️ `markets-poll-alignment.test.ts` read `RADAR_POLL_MS` from **`LiveWire.tsx`**,
which #352 stopped rendering. The constant is still exported there, so the check
kept passing — while the poll that actually runs was unguarded. It now reads
`PointsHero.tsx`. This is the "a check passes while verifying nothing" failure
this repo already documents, arriving through a file move rather than a shim.

### Verification

typecheck · **1231 tests** · lint (0 errors) · build green · 11/11 browser checks.

⚠️ Honest limit: Playwright's `route.fulfill` delivers a body in one piece, so
the probe verifies the stream is **consumed and complete**, not that words appear
progressively on screen. The reader path is covered by unit test instead.

---

## 2026-09-20 (111) — Six additions on top of the Points redesign

Built on Deepak's `/points` redesign (#352), on the preview branch.

### What the redesign had dropped

⚠️ Worth recording, because it was not obvious from the diff: the redesign
stopped rendering **`LiveWire`**, **`UpdatesFeed`**, **`ProgramPanel`** and
**`ProgramSection`**. Only `Composer` survived, imported into the new hero. Three
of the six items below are those surfaces coming back rather than new work.

### 1. The AI briefing has a foreground of its own

It rendered as a strip inside the news card capped at `max-h-36` with its own
scrollbar - about six lines. The model is asked for what changed, what it means
for farmers, dates to watch and what is still unknown; four sections do not fit
in six lines, so a complete answer met a scroll region nested inside a card
inside the hero.

`AirdropBriefModal` takes the foreground instead, in the page's own type ramp,
and lists the stories it was built from underneath - "which headlines produced
this" being the first question anyone asks of an AI summary.

⚠️ **It renders through `createPortal`, and that is not optional.** The hero sets
`overflow-hidden`, and a `position: fixed` child of an `overflow-hidden` ancestor
is still clipped by it in every engine - in place, the dialog would be cropped to
the hero's rounded corner. The probe asserts the escape (`x=0 y=0 w=1440`), not
merely that a dialog exists.

It also **opens before the fetch resolves**. The briefing runs on the quality
model and takes several seconds; opening on arrival left a button that appeared
to do nothing, which is how the previous version got reported as broken when it
was only slow. A one-line trace bar reopens a finished briefing without paying
for it twice.

### 2. Header controls are icons

Three labelled pills plus the freshness line did not fit the card header at
393px - "N tracked · checked …" was truncating to nothing to make room for
chrome. `aria-label` and `title` on each, so only the printed word is gone.

### 3. Ongoing perp DEX airdrops, restored

The tracked list and the link to the running channel list came back as
`OngoingAirdropsSection`. **Not `ProgramPanel` re-mounted**: its cards are
anchors to `#programme-<id>`, and those sections are not rendered either, so
re-mounting it would restore a grid of links that scroll nowhere. The cards keep
its visual language and are wired to the interaction this layout has - selecting
a programme loads it into the calculator.

### 4. The portfolio card says what it is

⚠️ `MyAirdropsCard` was showing **hard-coded** figures - "Sodex · 2.4M points ·
$2,100 · +162% ROI" - under a heading reading "My Airdrops", identical for every
visitor including one who has never farmed anything. Nothing fetched them and no
wallet was connected. Presented sharp and unlabelled, that is a reader being
shown a portfolio they do not have.

Blurred behind a **Coming soon** overlay: the shape of the feature stays legible,
the figures stop being readable, `aria-hidden` and `select-none` keep them out of
screen readers and copy-paste.

### 5. Cards end level

`items-stretch` plus `h-full` on all three links in the chain. A grid item
stretches by default, but `Reveal` inserts a `motion.div` between the column and
the card, and that wrapper sized to its content - so Farming Economics stopped
roughly 80px short of the calculator beside it. Measured at **0px** difference
now. Same for FDV Simulator ↔ Scenario Analysis and the lower pair.

### 6. Motion, and a stagger that was doing nothing

⚠️ **`Reveal`'s `delay` is an index, multiplied by 0.07s.** The redesign passed
`0.05` / `0.1` / `0.15` as if they were seconds, which computed to **3.5ms, 7ms
and 10.5ms** - no stagger at all, on a page whose cards arrive in pairs. Integers
now.

New keyframes: `rise-in` (travel *and* scale, so a card grows into place rather
than sliding), `pop-in`, `sweep-x` (one pass, not a loop), `glow-breathe`.
Strength is bought with **movement and timing, not light** - the design system's
standing warning is that this palette drifts from restrained to cheap through
stacked glow orbs, and none of these adds a light source.

Colour: the redesign's raw `gray-*` / `#0f1012` / `emerald-*` values became
semantic tokens, so the card themes light/dark instead of being pinned dark.

### Four silent-CSS failures found, and a test that ends the family

This class of bug has now shipped here four times - `text-content0`,
`bg-base/95`, `animate-in`, and now shades past the end of a ramp. All of them
**parse**; Tailwind emits no rule and nothing reports a problem.

`design-tokens-exist.test.ts` fails the build on any `gold-*`/`mint-*`/`ink-*`
shade that is not defined, on `shadow-card`/`shadow-card-hover`/`shadow-btn`
(named by the handbook, defined nowhere), and on `tailwindcss-animate` classes.
It strips comments first - this codebase documents past failures *by name*, and a
raw scan reports its own warnings.

It immediately found two **pre-existing** bugs unrelated to this work:

- **`text-gold-950`** in `MessagesClient.tsx` - the gold ramp stops at 800, so a
  reader's own chat bubble had no text colour in light mode.
- **`shadow-card`** on `PointsNav` - undefined, so the nav had no shadow.

Both fixed. A fifth was caught in-flight: a find-and-replace turned
`emerald-950` into `mint-950`, and mint stops at 800.

### Verification

typecheck · **1219 tests** · lint (0 errors) · build green · **36/36 browser
checks** on desktop and mobile.

---

## 2026-09-18 (110) — One editor, and pictures on the press lane

### Both composers now mount the dashboard's editor, not a lookalike

The inline composers on `/research` and `/points` were a markdown toolbar over a
textarea. That worked, and it was still a **second editor**: every capability the
dashboard gained - drag-and-drop covers with progress, the WYSIWYG body, tags,
the preview - either had to be built twice or quietly did not exist here. "Same
to same" is the requirement, and the only way to keep two things the same is to
make them one thing.

- `/research` mounts `PostEditor` whole. It already posts to `/api/research`, so
  there is no duplicated submit path either.
- `/points` mounts `PostContentEditor` (the body only), because a desk post also
  carries a kind, a programme and a pin that a research post does not. The shared
  `CoverPicker` and `CharCount` stay.

**The cost objection was real and is handled rather than waived.** Tiptap is the
single heaviest thing this site ships, and these are PUBLIC pages. Both imports
go through `next/dynamic` with `ssr: false`, so the chunk is requested only when
someone who can publish opens the composer.

**Measured, not assumed:** the Tiptap chunk is **382 KiB**, and the built HTML for
`/points` and `/research` references it **zero** times against `/dashboard`'s one.
A reader's first load is unchanged. `composer-kit.test.ts` now asserts the import
SHAPE (dynamic, `ssr: false`, never static) rather than the editor's absence - a
static import would otherwise pass every other check and silently undo this.

⚠️ **A cap disappeared with the textarea, and that is the part worth
remembering.** The body was a `<textarea maxLength={UPDATE_LIMITS.body}>`; the
browser refused the 2001st character and the author never met the limit. A
rich-text editor has no `maxLength`, so the swap alone would have let someone
write a long post and learn only at the end, when zod refused the POST. The
composer now compares `body.length` to the shared limit and **disables Post**,
saying by how much it is over. `points-updates.test.ts` pins both halves.

### The press lane could never show a picture

`RadarItem` had no `image` field, and `LiveWire` had `image: null` hard-coded to
match - an agreement between two files that made a missing feature look
intentional. The desk lane had covers; the press lane next to it was bare text.

`/api/points/radar` now carries the story's own image (http(s) only - the value
goes straight to an `<img src>`, and a renderer should not be the first place a
scheme is checked). Plain `<img>`, lazy, never `next/image`: these are publisher
CDN URLs fetched browser-to-origin at zero Vercel transfer (cost-check, trap 3).

Two things the browser probe caught that reading the source would not have:

- **The picture was only in the expanded panel.** An image a reader must open a
  row to discover does not do the job an image does. It is now in the collapsed
  row too - a thumbnail that hides itself when the row opens and the full-width
  image takes over.
- **The panel `<img>` was in the DOM whether or not the row was open** - a second
  node per row in a zero-height container, which a browser is entitled to fetch.
  The count gave it away: 18 image nodes across 17 rows. Now gated on `open`, and
  the probe asserts nodes ≤ rows.
- **A row with a picture stood 10px taller than one without** (100 vs 90), so the
  list stepped unevenly down the page depending on which feeds shipped an
  enclosure. A `min-h` matched to the thumbnail flattens it to 94-100.

### Verification

typecheck · **1214 tests** · lint (0 errors) · build green · 36/36 browser checks
on desktop and mobile.

---

## 2026-09-18 (109) — Links that are links, somewhere to read what you saved

### `MarkdownLite` had no anchors at all

⚠️ Neither `[text](url)` nor a bare URL rendered as a link. A desk post
containing a referral link showed it as **dead text** a reader had to select and
copy by hand, which on a phone is most of the way to not bothering.

Nothing was unsafe - the renderer already refused raw HTML - it simply had no
anchor. It has one now, and it only ever emits http(s): a `javascript:` href is
script execution dressed as a link, and this text comes from AI output and from
posts an admin types. Trailing punctuation stays with the sentence, so
"see https://x.io." does not link the full stop.

Both the desk card and the band's expanded row now RENDER the body through it
instead of printing it, so the same post gains a tappable link, real bold and
real bullets with no change to the composer.

### The save button had no destination

Saving worked. There was nowhere to read from. **A bookmark you cannot find
later is a button that files things into a drawer with no handle**, and the
reader only discovers that after relying on it.

`/saved` lists research and news together - they already share the `SavedStory`
store, keyed `(userId, url)`, which was the point of reusing it. An internal url
opens in-app, an external one opens through the site's own reader, and
`isInternal` decides by comparing against the **current origin** so a preview
deployment does not treat its own links as foreign.

Registered in `navLinks` (it lands in "More", not the six-link rail, which is
already eight pixels from overflowing), because a page absent from that list is a
page that cannot be reached from anywhere.

### `/points/Variational`

A short, shareable address. It **redirects** rather than rendering its own page:
the programme already has a section on `/points` with its live comparables, cost
panel and outcome grid, and a second page would be a second thing to keep
correct while showing less.

Case- and punctuation-insensitive, because a URL typed by a human respects
neither. An unknown venue lands on `/points` rather than a 404 - these links are
shared, they outlive the registry entry they were made from, and an error page is
a worse answer than the page they were trying to reach. Eight prerendered
redirects, so a share click costs no function invocation.

### The briefing was being asked the wrong question

⚠️ The points band fed **a list of eight headlines** into
`buildNewsBriefingPrompt` - a prompt written for ONE story, asking for "What
happened", "Key players", "Background", and a TL;DR that "captures the whole
story". Handed unrelated items as an "excerpt", a model either picks one and
ignores the rest or writes something short and hedged.

That is what "briefing not working" has been on this surface. And the payload was
sliced at **1200 characters**, cutting the list off mid-item, so it was briefed
on half a sentence.

New `roundup` mode with a prompt shaped like its input: what changed, what it
means for farmers, dates to watch, what is still unknown - and an explicit
instruction not to invent a connection between unrelated stories. The cap is
3800 characters, and the band shows the same truncation notice and model name the
news briefing does.

### Verification

typecheck / 1211 tests / lint / build green. Routes 146 → 153: `/saved` plus
eight prerendered venue redirects. Static 28 and ISR 12 unchanged.

---

## 2026-09-18 (108) — Half the band was live and half was as old as the page

### The press lane had no live path at all

The desk lane broadcasts on write, so it was genuinely realtime. The press lane
fetched on mount and on wake and that was all - so a band called **"Latest
updates"** was half live and half as old as the page, with nothing saying which.

`RADAR_POLL_MS` is 90s against the route's 120s window: the same margin
`/api/news` has run since #236, and deliberately not equal, because equal lets
jitter decide whether every poll regenerates the route. Registered in `TARGETS`,
and the route header now says it is polled rather than arguing it should not be.

Hidden tabs are skipped - a backgrounded tab polling is pure cost for something
nobody is looking at.

### "Everything important" now means everything

The radar returned 12 items and the list showed 12. A reader asking for the rest
got a truncation nobody mentioned. The route returns 30 and a **Show all N**
control reveals them, with the count stated so nothing is hidden behind a
euphemism.

### New items are announced, not spliced in

⚠️ A live feed that reflows under someone mid-sentence is worse than a stale one:
they lose their place and learn not to trust the list. An arrival raises a
**"N new updates"** pill; the reader decides when the list moves, and each new row
is marked until they do.

**That pill was wrong twice before it was right, and both versions looked
correct:**

1. Seeding the "already seen" set on first render recorded an **empty** set - the
   effect runs before either fetch resolves - so the entire first feed counted as
   arrivals.
2. Seeding on the first non-empty list was no better: the two lanes resolve
   **separately**. The desk lane landed first with one post, that became the
   baseline, and all seventeen press items then read as new.

Both produced the same measured symptom: a freshly opened page announcing
**"18 new updates"** before the reader had seen anything at all. "The reader has
seen the initial feed" means both lanes have settled, so that is what the
condition says now.

⚠️ The browser check only caught this after being tightened from "a pill
appeared" to "the pill says exactly 1". The loose version passed while the
feature was visibly wrong.

### One more silent-CSS trap, caught before it shipped

The stagger was first written as `animate-in fade-in slide-in-from-bottom-1`.
Those belong to **`tailwindcss-animate`, which this repo does not install**
(`plugins: []`), so they parse, emit **nothing**, and fail silently - the same
family as `bg-base/95` (no rule emitted) and `text-content0` (class does not
exist). It uses `animate-fade-up`, this project's own keyframe, and
`points-light-theme.test.ts` now fails on any utility from that missing plugin.

Verified in the browser: `animation-name: fade-up`.

### Verification

typecheck / 1211 tests / lint / build green, plus a browser probe at 1440px and
393px - 24 checks covering the fold, Show all, the real keyframe, and the pill
announcing exactly what arrived.

---

## 2026-09-18 (107) — Why three fixes to the briefing all looked like nothing

### The question nobody could answer

The briefing has now been "fixed" three times. Each fix was a real bug - a flat
15s timeout, a missing `maxDuration`, the wrong model tier - and each time it
came back short.

⚠️ **The reason is that nothing on the path could say why the answer stopped.** A
truncated answer and a genuinely brief one are identical in the text. Only the
provider's stop reason separates them - and **both providers were discarding
it**: Groq returns `choices[0].finish_reason`, Gemini returns
`candidates[0].finishReason`, and neither reached the caller. Every diagnosis
was therefore a guess, including all three of mine.

Both are now carried through `CompleteResult.finishReason`, normalised to
`stop` / `length` / `other`. Gemini spells truncation `MAX_TOKENS`; reading only
Groq's spelling would have left the primary provider silent.

### The mechanism that made the fixes look ineffective

⚠️ **The response cache stores a briefing for 24 hours, and `setCached` accepted
anything non-empty.** One half-finished briefing was then served to every
identical request for a day - *across deploys*. The fix would ship, and the
reader would be handed the same cached fragment that predated it.

A cut-off answer is not a cheaper answer; it is a wrong one, and caching a wrong
one is how a bug outlives its fix. `runComplete` now refuses to cache anything
that stopped on `length`.

### A briefing that hits the ceiling gets finished

Rather than serving half of one, the route asks the model to carry on from where
it stopped - **exactly once**. Two would be a loop with a bill attached, and if
one more pass is not enough the honest thing is to say it was cut short.

Only for `briefing`: a "why this matters" is two sentences by design, and
stopping at its ceiling means something else is wrong.

### And the reader can see it

The answer travels with `meta` - model, provider, output tokens, whether it was
cached, whether it was continued. The block says **"This briefing ran out of room
before it finished"** when even the continuation ran out, and names the model
underneath.

A fragment presented as a finished briefing leaves a reader to conclude the
feature is broken. That is precisely what happened, three times over.

### Verification

typecheck / 1210 tests / lint / build green. `ai-briefing-truncation.test.ts`
pins all of it: both spellings of the stop reason, the conditional cache write,
exactly one continuation, and the truncation notice.

---

## 2026-09-18 (106) — The briefing was asking the wrong model, and delete meant gone

### The briefing was routed as bulk work

It arrived late and stopped after the TL;DR. Entry 103 fixed the timeout, which
was real, but not the whole story.

⚠️ **`/api/ai/why-matters` passed `task: "digest"` for a briefing.** `routeTier`
sends everything except the assistant to the **fast** model, with the comment
"bulk deterministic tasks are cheap + high-volume". A digest is two or three
sentences. A **briefing is a nine-section, 650-900 word explainer** - neither
cheap nor bulk. The fast model wrote a couple of sentences and stopped, which is
precisely what was reported.

`briefing` is now its own `AiTask` and routes to the **quality** model for
everyone, regardless of plan. A briefing that stops after the TL;DR is not a
cheaper briefing; it is a feature that does not work, generated and paid for
anyway.

⚠️ It also joins `USER_TASKS`, so it counts against the daily cap. Leaving it out
would have been the expensive kind of omission: the longest generation a member
can trigger, on the quality model, uncounted.

The points band's briefing now carries **`RobotIcon`** - the same mark the
assistant and the news briefing use. One face for XYZ AI everywhere it speaks.

### Delete meant gone

⚠️ `DELETE /api/research/[id]` called `prisma.post.delete`. A published article
was gone from Postgres with no way back short of a database backup - and a
backup is not a feature, it is a thing you find out you do not have on the day
you need it. **One misclick, one article.**

Now:

- `Post.deletedAt` (migration `39_post_soft_delete`, `ADD COLUMN IF NOT EXISTS`,
  nullable, no backfill, partial index on the live rows).
- **DELETE sets `deletedAt`.** `?purge=1` still destroys a row, but refuses
  anything not already in the trash - so permanent deletion takes two deliberate
  actions, and the second is taken while looking at the trash.
- `GET /api/research/trash` and `POST /api/research/[id]/restore`. Without a
  restore path, `deletedAt` is just a slower way of losing something.
- Restore returns a post to the `published` state it had. A draft that was
  deleted comes back a draft: restoring undoes a deletion, it does not make a
  publishing decision for the owner.
- Restore busts **both** `/research` and the article path, or the post is back in
  the database and still missing from the site.

⚠️ **The dangerous half of a soft delete is the READ side.** Sixteen places query
`Post`; miss one and a deleted article is still reachable by URL, still in a
count, still in a sitemap - and nothing errors. So there is one predicate,
`NOT_TRASHED`, spread at every site, and `post-soft-delete.test.ts` walks every
source file and fails on a `prisma.post` read without it. Verified to fail when a
single filter is removed.

That check found a real one the first time it ran: the **PATCH** lookup was
unguarded, so a trashed post could still be edited.

### Save a read

A `SaveButton` on the article page. ⚠️ Reuses the news `SavedStory` store rather
than adding a table: it is keyed `(userId, url)` and already holds title,
summary, source, image and category. A second store would mean a second
migration, a second API and - the part that matters - **a second place a reader
has to look for the thing they saved**. One saved list, with the source naming
the lane.

### Verification

typecheck / 1196 tests / lint / build green. Two new routes, both `ƒ` and
`private, no-store` - an admin-only list of non-public titles must never reach a
shared cache.

---

## 2026-09-18 (105) — One composer toolkit, two surfaces

### What the inline composers were missing

`/research` and `/points` both gained inline composers, and both shipped as bare
textareas: no cover image, no formatting, no preview. The dashboard had all of
it, which is exactly the trip the inline composer existed to avoid.

`ComposerKit` now carries the shared pieces - `MarkdownToolbar` (bold, italic,
heading, bullets, quote, link, code), `CoverPicker` (upload, thumbnail, remove)
and `CharCount` - and both surfaces use it. Two toolbars would be one toolbar and
a divergence waiting to happen.

Research also gains a **Write / Preview** toggle rendering through `MarkdownLite`,
the same renderer the article page uses, plus tags and an avatar-led opener.

### Markdown, not a rich-text editor — deliberately

⚠️ The dashboard's Tiptap is **the single heaviest thing this site ships**:
`/dashboard` measures roughly twice every other route's bundle, and that is
Tiptap loading for every tab. Putting it on two **public** pages to save typing
two asterisks would move that weight onto readers who never compose anything.

So the buttons write markdown into a plain `<textarea>`. Both destinations
already render markdown, and the output is a string a human can read and fix.

⚠️ **Colour and font controls are absent on purpose**, not missing.
`MarkdownLite` emits the design system's own type and colour tokens by design -
which is what keeps a post looking like the site rather than like whoever typed
it. A colour picker would be a control that silently does nothing.

### A points update can carry an image

New nullable `PointsUpdate.image` (migration `38_points_update_image`,
`ADD COLUMN IF NOT EXISTS`, no backfill). Rendered in the desk card and in the
expanded row of the band.

⚠️ Two cost decisions, both against the obvious choice:

- **A plain `<img>`, never `next/image`.** The file is served straight from
  Supabase Storage, so the browser fetches it directly at **zero Vercel
  transfer**; routing it through the optimiser would spend both Fast Origin
  Transfer and optimisation quota. The lint rule's "best practice" is the
  expensive option here (trap 3). Lazy-loaded, so a feed does not fetch every
  cover up front.
- **A URL, never inline base64.** A `data:` image in the DB is serialised into
  every response that reads the table, which blew FOT on this project once
  already (trap 4).

The image passes through `safeUrl` like every other link - http(s) only - rather
than being trusted because an upload wrote it, since the column can also be
written by a future path that does not.

### Verification

typecheck / 1186 tests / lint / build green. A new browser probe drives the
research composer at 1440px and 393px: 7/7 toolbar controls, cover picker, tags,
**bold wrapping a live selection** (`hello **world**`), and the preview rendering
it as `<strong>`. The points probe still passes 100/100.

---

## 2026-09-18 (104) — Read it here, and a bar that actually gets out of the way

### The briefing works

Confirmed from production: entry 103's timeout fix landed. The band now renders a
full TL;DR → What happened → Key numbers → Jargon buster, in the style the news
reader uses.

### Latest updates reads like news now

- **A headline expands IN PLACE.** Tapping one used to leave - straight out to
  the outlet. On a page whose whole argument is "check the number before you
  act", throwing the reader off-site at the first tap is the opposite of the job.
- **The story opens on THIS site.** A press row links to `/news/read?u=…`, which
  renders it here with its own briefing, instead of `coingape.com`. The outlet is
  still named and still one tap further. A **desk** link stays external, because
  the desk chose that URL - usually a tweet - and there is nothing to render
  on-site for it.
- **The briefing can be closed.** A briefing is long; once read it is in the way,
  and scrolling past it forever is not a substitute for a close button.
- **The "Post" button is gone.** It only jumped to the composer further down the
  same page: a control that looked like an action and was actually a scroll.

Expanding is a `<button>` and reading is an `<a>`, never one element doing both -
a link that sometimes navigates and sometimes does not is the control readers
learn to distrust first.

### The nav gap

⚠️ Fading the bar out left its box exactly where it was. A `sticky` element stays
in **normal flow**, so hiding it produced a ~56px hole between the band and the
first panel - the bar had not got out of the way, it had become invisible
furniture. That is what "gap dikhta hai" was.

It animates its row height to zero alongside the fade now. Measured: **62px →
0px**. The hide threshold also moves 140px → 260px, so it takes a deliberate
scroll rather than a nudge.

### Publish from /research

`QuickPublish` - title, summary, body, category, premium, draft or publish -
inline on the page, for anyone with `post:publish`. Posting a short note meant
leaving for the dashboard, finding the editor, and navigating back: five steps
for something that is often one paragraph and a link.

It is **not** a replacement for the dashboard editor, which keeps the rich
editor, covers, tags and scheduling. This is the short-form door, and what it
omits is deliberate. The client-side permission check hides a control that would
403; `/api/research` enforces the same permission independently, because a
client gate is never the boundary.

### Verification

typecheck / 1177 tests / lint / build green. Browser probe at 1440px and 393px,
**100 behaviours**, both themes AA.

⚠️ Two probe assertions were themselves wrong and were fixed, not the code: the
nav-opacity check selected `nav > div`, which after the height-collapse wrapper
was added pointed at a deliberately transparent box; and the nav-nudge check
started from an already-hidden bar.

---

## 2026-09-18 (103) — The Refresh buttons never refreshed, and the AI briefing never had time

### Every Refresh button on this site was decoration

They all fetched with `cache: "no-store"`, which looks exactly right and is not.
`no-store` tells the **browser** not to use its own HTTP cache. It says nothing
to the Vercel edge, which kept serving the same body for the rest of its
`s-maxage` window - 320s for comparables, 120s for the press feed.

So pressing Refresh re-rendered identical numbers behind a spinner. Worse than
no button: a reader who presses it concludes the data really has not changed.

`src/lib/refetch.ts` mints a distinct URL - a distinct edge key - but only for a
**button press**, and at most once per 10s per route. Polls and wake refetches
keep the shared cached URL, because those happen without anyone asking and are
exactly the paths that must stay cheap.

### The news briefing never worked, and took a minute not to

`COMPLETE_TIMEOUT_MS` was a flat **15 seconds for every completion**.
`/api/ai/why-matters` asks for **2000 tokens** in `briefing` mode. No model emits
two thousand tokens in fifteen seconds, so it timed out every time - and a
timeout classifies as a transient "retry", so the gateway then burned
`MAX_RETRIES` more attempts against the same provider with backoff, then the next
provider, before raising `AiCapacityError`.

Three things, all of them wrong:

1. **The budget is now proportional to the requested length** (~45ms/token),
   with the 15s as a floor.
2. **A timeout on a long generation is no longer retried** against the same
   provider. It had not failed transiently - it was still working, and asking
   the identical question again takes at least as long. Short requests keep the
   retry, where a blip is plausible.
3. ⚠️ **No AI route declared `maxDuration`.** Vercel kills a function at its
   duration limit, so the platform was killing the request mid-generation and
   the caller got an opaque 504 rather than the graceful 502 the route is
   written to return. All five AI routes declare 60s now, and the gateway's own
   cap sits at 55s **below** it, so when something fails it is our message that
   reaches the reader.

`maxTokens` for a briefing drops 2000 → 1400: the prompt asks for 650-900 words
(~900-1250 tokens), so 2000 was never the length of the answer, only the size of
the window it could take.

### Points

- **"Live wire" → "Latest updates".** A wire service is a newsroom term; nobody
  outside one reads it as "the latest updates", which is all it is.
- **A "From X" lens**, offered only when there is something to filter to. X is
  still not a source - no free API - but desk posts linking a tweet are badged
  and can now be isolated.
- **An AI briefing on the band**, built from the headlines the reader can
  actually see. A briefing summarising something other than what is on screen
  invites trusting it over the sources, and the sources have names attached. On
  demand only.
- **The nav stops flickering.** It hid after **8px** of downward scroll, less
  than one wheel notch. Now 140px of accumulated downward intent to hide, 24px up
  to reveal, accumulator resets on direction change, and it stays put in the
  first 240px. Deliberately asymmetric: hiding wrongly steals a control, showing
  wrongly costs 44px for a moment.
- **The tracked programmes are comparable at last.** Variational, Sodex, RiseX
  and Pacifica appear in **no** market feed - too new - and the engine needs the
  target's own volume to form a ratio, so the venues this page exists for were
  the ones it could never price. There is no honest way to invent that number, so
  it is asked for, and labelled as the reader's figure wherever it appears.
- **The share card's "Try the calculator" pointed at `/tools`**, which has not
  held the points calculator since it moved. It deep-links to
  `/points#programme-<id>`, resolved against the registry by name so a new
  programme works with no second edit.

### Verification

typecheck / 1177 tests / lint / build green. Browser probe at 1440px and 393px,
**92 behaviours**, both themes AA. New: `ai-timeout-budget.test.ts` pins the
budget against the routes' declared `maxDuration`.

---

## 2026-09-18 (102) — Two normalisers were one normaliser and a bug

### The wrong numbers had a name: `futures`

A reader's screenshot showed the comparables panel live and confidently wrong:
**"12 venues · 2 with a listed token · 10 unlisted"**, target *Hyperliquid
(Futures)*, **"Implied FDV from 2 peers"**.

Two things in one picture. First, the **fallback was working** - "(Futures)" is
CoinGecko's derivatives naming and only 24h/OI windows were offered, which is
exactly what entry 101's fallback provides. Second, the route carried **its own
copy** of the name normaliser, and that copy did not strip `futures`.

So `"Hyperliquid (Futures)"` reduced to `hyperliquidfutures`, matched nothing in
a token list keyed on `hyperliquid`, came back `fdv: null`, and **the largest
perp DEX in existence was served as an unlisted venue** - which the explorer
then auto-selected as its target, deriving a valuation for it from the two peers
that happened to survive.

One normaliser now, imported by both, and it strips anything parenthesised
because a registry's qualifier is never part of a project's name.

### The gap in three screenshots had one cause

`PointsPanel`'s header was one row with `flex-wrap`. ⚠️ **`flex-wrap` does not
solve this**: it moves a child to the next line only when it cannot fit *at its
minimum*, and a heading's minimum is one word. So the actions kept the
right-hand side and the title took whatever remained - measured at 393px, "What
the desk is reading" wrapped **one word per line** with half the card empty.

`flex-col` below `sm`, `sm:flex-row` above. `ProgramSection` had the identical
squeeze (its header is a `<button>`, so it cannot nest in the panel) and its
titles measured **42-46% of the card**; same fix. Pinned by a probe assertion
that no panel title may fall under 80% of its card's inner width.

### "Live anchor" on a number that was not live

The outcome panel drew a green **Live anchor** chip directly above "Ladder
centred on the **published scenario** $290.00M". A published scenario is a
hand-entered registry figure. Labelling it live is the exact dishonesty this
page argues against, so the chip is now driven by whether the anchor actually
came from comparables.

### The wire

The desk's posts sat at the top and the press feed at the bottom, a full screen
apart, both full-height panels, both answering "what changed today". They are
one band now, **above the nav**: one promoted item as a banner, the rest folded
behind a count.

Both lanes stay labelled - "Posted by the XYZ desk" versus "Reported by
&lt;outlet&gt;" - because those are different claims and a farmer acts
differently on each. A pinned desk post outranks everything.

⚠️ **X still is not a source.** No free API exists. It appears the honest way:
when the desk posts a link to a tweet, the row is badged `X`.

### Also

- **Share cards had `domain: ""` hard-coded**, which is why no card has ever
  carried a venue logo. Derived from the registry's own `links.website` now, so
  a programme added tomorrow gets its logo with no second place to edit.
- **The hero warning** occupied roughly a quarter of the first phone screen. It
  is a `<details>` one-liner - native, no JS, no hydration risk, still the first
  thing under the headline.
- **Peers are selectable.** A comparable set is a judgement, not a fact: tap a
  peer to drop it from the median. Excluded peers stay visible so the control is
  not a one-way door. Measured: 4 peers → 3.
- A `text-amber-200/90` in the new disclosure measured **1.05:1 in light** - the
  light override targets `.text-amber-200`, and the opacity modifier makes a
  *different class name* the override never matches.

### Verification

typecheck / 1170 tests / lint / build green. Browser probe at 1440px and 393px,
**90 behaviours**, both themes AA.

---

## 2026-09-17 (101) — Aggregate, because one refusing upstream was blanking the page

### The diagnosis, at last

Three releases of "Data unavailable", two wrong theories. The stage diagnostics
added for exactly this printed it from production:

```
venues from upstream: 0 · past the volume filter: 0 ·
priced tokens: 249 · matched: 0 · llama Error
```

**CoinGecko was fine - 249 tokens priced. DefiLlama was refusing.** `llama.ts`
throws `new Error("<url> <status>")` on a non-OK response, so `err.name` is the
generic "Error" and the reporting threw the status away, which is why every
earlier report said only "llama Error". It reports `err.message` now, so the
next one carries the code.

**One upstream being able to blank a page is the actual defect**, and no amount
of retrying a refusing host fixes it. `/api/points/comps` now falls back to
CoinGecko's derivatives exchange list - the host production proved reachable in
the very same request - converting BTC-denominated volumes with a spot price
fetched alongside, and dropping the whole source if that price is missing rather
than emitting numbers five orders of magnitude wrong.

⚠️ **The fallback may only ADD venues it can name.** Its list mixes centralised
exchanges in with perp DEXs, so it filters through an explicit allowlist and
fails **closed**: an unrecognised venue is dropped. Quietly pricing a points
programme against Binance's volume would be the "wrong number presented as
right" failure this codebase keeps meeting. Tested against eight CEX names.

⚠️ The fallback's fetches are **cached, not `no-store`**. A single `no-store`
anywhere in a segment makes the whole route dynamic, and it did:
`/api/points/comps` dropped from prerendered back to per-request until this was
caught in the route-table diff. That response is ~100 rows, far under the 2 MB
data-cache ceiling, so it caches fine.

### A second lane for the desk: trusted sources

`/api/points/radar` plus `AirdropRadar`, at the bottom of the page. Airdrop,
points and perp DEX stories, each credited and linked.

⚠️ **No new upstream.** It is a FILTER over `getNewsPage`, the site's existing
RSS pipeline - already fetched, parsed, deduped and cached for /news, and its
taxonomy already ships "Airdrops", "Perp DEX" and "Token Launches" categories.
A second fetch of the same twenty feeds would have doubled a cost the site
already pays, and a second parser would have been a second thing to keep correct.

⚠️ **X/Twitter is deliberately not a source.** There is no free API for it, and
claiming to read X while actually reading an outlet that quotes X would be a
false claim about sourcing. A specific tweet belongs in the desk's own posts,
with its link.

Collapsible, and the choice is remembered. Venue chips filter it.

### The nav: opaque, and it gets out of the way

Two bugs, both visible in the reported screenshot:

1. **It was see-through.** `.glass` over dense cards let their text read through
   the labels, so mid-scroll it rendered as superimposed strings
   ("RiseFarmingVariational") and looked like a rendering fault.
2. **It was always there**, sitting on the first card and costing ~44px of a
   phone viewport permanently. It now hides on scroll down and returns on scroll
   up.

⚠️ **And the fix reintroduced the first bug.** `bg-base/95` reads perfectly and
emits **nothing at all**: these semantic tokens are declared as plain
`var(--bg)`, not in the `rgb(... / <alpha-value>)` form an opacity modifier
requires, so Tailwind produces no background rule. Measured at **alpha 0**. Same
family as the `text-content0` incident - a class that parses, means nothing, and
fails silently. Now `bg-base`, and `points-light-theme.test.ts` fails on any
opacity modifier applied to a var-based token.

### Every outcome: bear / base / bull

Three scenarios computed from the **live peer spread** - cheapest peer, median,
dearest - each showing value and ROI, each clickable to adopt. Requires three
peers: a "range" from two is one peer either side of nothing, and dressing that
as a band would be inventing precision.

### Mobile

Measured at 393px: five controls came out **32px tall**, under the 36px floor a
thumb needs - the segmented metric buttons, both selects and the radar chips.
All raised. The dense outcome grid is exempt and verified to scroll inside its
own box rather than the page.

### Also

- `docs/guides/perp-quiz-structure.md` - a full build plan for the quiz/score
  game: schema, routes, the "client never receives the answer" rule, live
  question generators with their ambiguity guards, scoring, build order.
  **Not built.** The document is the deliverable.

**Route table:** 143 → 144 routes, static 27 → 28, ISR 11 → 12, dynamic
unchanged at 115. The one addition is `/api/points/radar` at 2m, matching
`NEWS_REVALIDATE` because the shared cache imposes it (trap 1b).

### Files

`src/modules/points/lib/{perp-sources,airdrop-radar}.ts` (new) ·
`src/app/api/points/radar/route.ts` (new) ·
`src/modules/points/components/AirdropRadar.tsx` (new) ·
`src/app/api/points/comps/route.ts` · `PointsNav/SensitivityGrid/CompsEngine/CostPanel/PointsClient.tsx` ·
`src/modules/tools/components/CalcField.tsx` ·
`src/lib/__tests__/points-sources.test.ts` (new) · `points-light-theme.test.ts` ·
`docs/guides/perp-quiz-structure.md` (new)

---

## 2026-09-17 (100) — One header grammar, a desk that stays quiet, and a tape that is always live

### The alignment complaint, measured

"Aligned karo" is not a taste note, and it turned out to be measurable. At
1440px the page drew **eight panels, of which five carried an eyebrow and three
did not**, and the panel titles started at **two different x positions: 125px
and 177px**.

The 52px came from the programme sections leading their header row with a 40px
logo, which pushed the programme name right of every other title on the page.
Six panels lining up and three not is exactly what reads as unaligned, and no
amount of colour or spacing polish survives a ragged left edge.

- **`PointsPanel`** now owns the eyebrow, title, description, action slot, meta
  row and padding. Six panels had each grown their own; a panel supplies content
  and does not get to invent spacing.
- The programme logo moved to the right, beside the number it belongs to.
- `LiveChip` replaces three hand-drawn status lights (three dot sizes, two
  greens). A reader reads a status light as one thing or as noise.
- The page uses the **system container** (1200 → 1320) instead of a one-off
  `max-w-5xl`, so its cards stop sitting narrower than the rest of the site.
- The accent is a **separate `accent` prop**, not markup passed inside `title`.
  `background-clip: text` does not paint through to nested children, so a caller
  wrapping a whole title renders its other words invisible. The component's shape
  makes that unrepresentable rather than something to remember.

Measured after: **one eyebrow x, one title x, one padding value**, at 1440px and
393px. Pinned by `points-layout.test.ts`.

### The airdrop desk earns the top of the page

It sits first because when there IS news, news is the most important thing here.
When there is not, the full treatment (eyebrow, display heading, description, and
a bordered box announcing that nothing had happened) was the **largest element on
the page and said nothing** - a reader arriving at a calculator met an empty
noticeboard first.

It now collapses to one quiet line that still proves the desk is connected, and
expands into the real panel the moment a post exists. Measured: **56px empty,
396px with one post**. Staff keep the composer either way, since posting from
there is how it stops being empty.

⚠️ Only for the `ready`-and-empty state. An unreachable feed keeps its own
visible note: "nothing posted" and "we could not reach the feed" are different
statements, and collapsing an outage into a quiet desk is a lie in the reader's
favour.

### Live comparables: actually live, and never blank

- **It refreshes itself**, every 300s, hidden tabs skipped. "Live" previously
  meant "live as of page load", which for a page people leave open beside a
  terminal is not live.
- **The live tape**: the top venues by 24h volume, rendered **independently of
  whether any peer can be matched to a token**. Everything else in that panel
  needs a peer with both volume and an FDV; when none matched, all of it
  collapsed and the panel went blank while holding forty venues of live volume
  data. Live that disappears whenever the derived number cannot be computed is
  not live, it is a calculator with a status light.
- When valuations are missing but volumes are not, it **says which half is
  missing** rather than leaving a column of dashes to be read as zero.

### Every outcome: the verdict in words

The grid showed the whole space but never stated the one thing a reader arrives
for. It now leads with it: *"At 10% of supply you break even at $722.26M FDV. The
live market implies $73.50M, which is 9.83x short of it."* Columns are
`table-fixed`, so they stop changing width per value.

### Cost and caching

⚠️ Two findings from `markets-poll-alignment.test.ts`, both correct, both caught
before merge:

1. The 300s poll needed a `TARGETS` entry. The route header had asked for exactly
   this in advance ("NOT POLLED ... if a poll is ever added, add it there, that
   test is the only thing standing between a poll and an ISR-write bill"), and
   that header now says the opposite and names the poll.
2. Entry 99's `derivatives()` fallback fetched `api.llama.fi/overview/derivatives`
   **directly**. That body is one of the four moved behind `unstable_cache` for
   being over Next's ~2 MB data-cache ceiling, so an uncached fetch re-parses
   megabytes on a request path (Fluid Active CPU, trap 2). It was also a guess:
   the empty panel was never caused by an empty protocol list. **Removed.**

Also: `Cache-Control` is now a **literal** rather than `s-maxage=${revalidate}`.
A template literal is invisible to the alignment test's regex, so the one number
that actually governs the CDN (trap 0) was the one number nothing verified.

**Route table:** no change against `main`. ⚠️ **This entry originally claimed
`/api/points/comps` went ƒ (dynamic) → ○ (prerendered, ≈5m), with totals moving
static 26 → 27 and dynamic 116 → 115. That was wrong**, and the way it was wrong
is worth keeping: the comparison was produced with `git stash` → build →
`git stash pop` → build, and **`git stash` reverts to HEAD, which on a feature
branch is the branch's own previous commit, not `main`.** So the two sides were
entry 99 and entry 100, both mid-branch.

Re-measured properly (`git checkout origin/main` → build → checkout back), the
route is **`○ ≈5m` on both sides**. The ƒ → ○ transition was real but internal:
entry 99 had introduced the dynamic render with its `cache: "no-store"` fallback
fetch, and entry 100 removed it. Relative to `main`, nothing moved.

The lesson is the one this project keeps relearning: a baseline you did not
explicitly check out is not a baseline.

### Files

`src/modules/points/components/PointsPanel.tsx` (new) ·
`{UpdatesFeed,CompsEngine,SensitivityGrid,ProgramSection,ProgramPanel,CostPanel,PointsClient}.tsx` ·
`src/app/points/page.tsx` · `src/app/api/points/comps/route.ts` ·
`src/lib/__tests__/points-layout.test.ts` (new) ·
`src/lib/__tests__/{markets-poll-alignment,points-comps-window}.test.ts`

---

## 2026-09-17 (99) — The comparables bug was never in the route, and the grid is a control now

### "Data unavailable": found, and it was two panels away from where I looked

Entry 98 fixed a real gating bug in `/api/points/comps` and the panel still
showed nothing. The cause was never in the route at all:

`buildComparables` returns an empty set when the **target's own** metric is 0 —
correctly, since a ratio against zero is meaningless. The explorer exists to
value an **unlisted** venue, so it auto-selects the first venue with no FDV:
the newest one on the page. The default window was 30-day volume. **A venue new
enough to be unlisted has no 30 days of history.** So the panel selected the one
venue guaranteed to score zero on the window it then measured, every single
time, with live data in hand.

Entry 98's `windows` fallback could not catch it, because it answers a different
question: *did **any** venue populate this window*, not *did **this** one*.

`pickMetricFor(target, preferred)` asks the per-target question and widens to
the widest window that venue can actually answer on — and the panel **says so**
("Sodex has no 30d volume history yet — it is too new"), because a number
quietly computed on a different window than the one highlighted is how a correct
figure becomes untrustworthy.

Measured end to end against a fixture shaped like the failure (new venue, 24h
volume only): before, an empty set; after, "Implied FDV from 4 peers on 24h
volume" plus the peer table.

### A fallback that behaved differently from the path it replaced

`derivatives()`'s direct retry returned **raw** upstream rows while the cached
path returned reduced ones. Raw spells open interest `openInterestAtEnd` (so it
read 0) and does not guarantee `name` is a string, so the alias lookup could
throw — turning a partial outage into a 500, which the client renders as "Data
unavailable", indistinguishable from the upstream being down. Both paths now go
through `reduceOverview`.

### Every outcome: from a table you read to a control you steer

- **Every cell is a button.** Clicking one adopts that FDV and allocation.
- **The ladder is visibly live.** It has always re-centred on the peer median
  when the route refreshes; now the panel says what it is anchored to and when
  that arrived, marks the rung nearest the live level separately from the gold
  outline on *your* assumption — the distance between the two marks being the
  most informative thing on the table — and offers "Follow live again" after a
  click breaks the link.
- **The break-even contour is drawn**, as a mint edge at the leftmost profitable
  rung in each row plus the row's break-even FDV in its header
  (`breakEvenLadder`). The boundary is a line on the table, not something you
  locate cell by cell.

### Less scrolling: a nav, and sections that collapse

- **`PointsNav`** — a sticky scroll-spy index (`IntersectionObserver`, top
  -weighted). Plain `<a href="#id">` on purpose: Lenis owns page scroll and
  cancels any programmatic `scrollTo` it did not initiate.
- **Programme sections collapse**, one open at a time. The header is a button
  carrying the headline value and TGE figure, so a **closed** row is still
  comparable against an open one — collapsing must not cost the comparison.
  Measured: 5320px → 4346px desktop, 8180px → 6389px mobile.

### Verification

Full gate green (typecheck / 1138 tests / lint / build). A browser probe at
1440px and 393px checks all 46 behaviours above — comparables resolving, the
widened-window disclosure, nav scroll, one-open accordion, collapsed-row value,
cell adoption changing the outlined cell, relink — plus a WCAG AA sweep in both
themes.

⚠️ **The contrast audit itself had a bug worth recording.** It stopped at the
first non-transparent background *value*, but this page is built from 6%-alpha
brand tints, so it measured text against full-strength amber rather than
amber-at-6%-over-near-black and reported ~18 failures at 1.7:1 on a page that
was fine. It composites the alpha stack now, and self-tests by injecting one
illegible run and requiring it to be caught (1.39:1) — an audit that reports
zero is only meaningful if it can report something.

### Files

`src/modules/points/lib/points.ts` (`pickMetricFor`, `breakEvenLadder`) ·
`src/modules/points/components/{SensitivityGrid,PointsClient,CompsEngine,ProgramSection}.tsx` ·
`src/modules/points/components/PointsNav.tsx` (new) ·
`src/app/api/points/comps/route.ts` · `src/lib/__tests__/points-comps-window.test.ts`

---

## 2026-09-17 (98) — Three programmes, three calculations, and comparables that actually load

### "Data unavailable" — an unverified field was gating the whole route

`/api/points/comps` filtered AND sorted its entire venue list on `total30d`, a
field added to `OverviewRow` from an API this environment cannot reach to
verify. When the upstream does not return it, every row reads 0, **every venue
is filtered out**, `live` is false, and the page says "Data unavailable" on a
response that contained forty perfectly good venues.

`total24h` is the field `/api/markets/perp` has used in production for months,
so it is the one known to exist. It filters and sorts now; the longer windows
are **enrichment**: present, they unlock the 7d/30d metrics; absent, the engine
works on 24h.

The rule this encodes: **an unverified field may add capability, never gate it.**

Two more layers of the same failure, fixed with it:

- The client's default metric was hard-coded `volume30d`, so a response without
  30d produced an empty comparable set on a page full of venues. It now falls
  back to the widest window actually present.
- The route reports which `windows` it populated, and the metric selector offers
  only those — a selector that renders an empty table reads as broken when the
  truth is "nobody publishes that".

Verified by rendering against the exact payload shape that failed (venues with
`total7d`/`total30d` absent): comparables compute, `Data unavailable` gone.

### One section per programme, each a complete calculation

Sodex, RiseX and Variational each get their own section with their own inputs,
their own scenario quick-picks and their own result — rather than one calculator
you switch between.

Switching was worse than it looked: a single shared set of inputs meant moving
from Sodex to RiseX silently reinterpreted your Sodex points against RiseX's
pool, and the two could never be seen at once, which is the comparison anyone
farming both actually wants.

**The scenario quick-picks are back.** `fdvScenariosUsd` and
`allocationScenarios` were in the registry all along and had been rendered by
the `/tools` calculator; the move to `/points` dropped them. They sit under the
field each one sets, exactly as before. Rendered per programme from the
registry: Sodex 1 FDV + 3 allocation pills, RiseX 4 + 3, Variational 5 + 0.

Clicking a scenario breaks the live FDV anchor, deliberately — while linked the
value is derived every render, so setting it without clearing the link would be
reverted on the next render and the pill would look broken.

The comparables engine above is now a **market explorer** rather than a
position: pick any venue, see what its peers imply. Each section carries its own
anchor separately, so the two never fight over one target. The overview strip
became a map — its cards scroll to a section instead of swapping its contents.

### A contrast failure the first audit could not have caught

The grid's losing cells scored **4.27:1** in the light theme. `--data-down` is
documented at 4.54:1 — against **pure white**; these cells sit on `.surface`
under a tint of their own hue.

Lowering the tint did not fix it. Re-measured at 0.28 alpha: still 4.27, because
the foreground was what was short, not the ground. A scoped `.grid-net-down`
with red-700 in light clears it, and the markets tables keep the shared token.

⚠️ The earlier audit passed because that fixture happened to have **no losing
cells** — the whole grid was green, where the foreground has far more headroom.
Measuring the right page with the wrong data is not measuring.

**After: 0 AA failures in light and dark**, 1440px and 393px, no overflow.

**Files:** `src/app/api/points/comps/route.ts`, `PointsClient.tsx` (per-programme
state), `ProgramSection.tsx` (new), `ValuePanel.tsx` (scenario pills, bare mode),
`CompsEngine.tsx`, `ProgramPanel.tsx`, `CostPanel.tsx`, `SensitivityGrid.tsx`,
`globals.css`. 11 new tests.

---

## 2026-09-17 (97) — The airdrop desk: post an update, everyone sees it

`/points` now opens with a live feed of what is happening - a programme going
live, a snapshot landing, a TGE date - posted by staff and updated on open
pages without a reload.

### Its own model, not the What's New feed

`WhatsNewEntry` is about **this site** shipping things. `PointsUpdate` is about
**the outside world**: someone else's programme opening or closing. Mixing them
would make both unreadable, and the audiences are different people.

Kinds are a closed vocabulary - `live · soon · snapshot · tge · ended · alert ·
update` - because the feed's job is answering "can I still farm this, and do I
need to do something today?" fast, and free text cannot be sorted, filtered or
coloured. Every kind is a distinct ACTION for the reader; two kinds that would
produce the same action should be one kind.

### The composer is inline, on the page

Not in the dashboard. "Sodex snapshot is tomorrow" is a thirty-second thought,
and making it a trip to an admin screen is how a live feed quietly stops being
live. Staff with `points:manage` get a composer at the top of the desk; nobody
else sees it exists.

### Live through the shared primitive, not a hand-rolled channel

Writes broadcast on a new `CH_POINTS` topic and open pages refetch. It goes
through `useRealtime`, which already carries the retry with backoff, the armed
fallback poll and the wake refetch that seven other surfaces needed - and that
this one would otherwise have got wrong on its own, the same way they did.

`CH_POINTS` rather than `CH_NOTIFY` because that one is a signed-in bell and
this feed is public: anonymous readers have to get the ping too.

Edits and deletes broadcast as well, not just creates. Fixing a wrong date or
unpinning something is exactly the kind of change a reader with the page open
needs to see, and a deleted update that stays on screen is worse than one that
was never posted.

### Things that had to be got right

- **A link cannot carry script.** `safeUrl` accepts only `http(s)` and rejects
  what it cannot parse rather than sanitising into something plausible. Applied
  **on the way in**, not at render: a bad URL filtered only at render time is
  one careless consumer away from being rendered.
- **Drafts are never edge-cached.** A response containing unpublished rows is
  `private, no-store`. The whole point of a draft is that nobody has seen it.
- **A draft does not broadcast.** It would make every open page refetch and
  find nothing new.
- **"Nothing posted yet" and "we could not reach the feed" are different
  statements.** Collapsing them is a lie in the reader's favour - an outage
  would read as a quiet desk. Caught while testing against a local environment
  with no database.
- **The table not existing is survivable.** `db push` runs on production
  deploys only, so the code ships before the table does; an empty feed is the
  truth in that window and a 503 is not.
- **The edge window (30s) sits under the fallback poll (60s)**, so a poll
  during a channel outage can never land on a fresh cache entry and spin the
  origin.

### Cost

`/api/points/updates` and `/api/points/updates/[id]` are both **dynamic**, and
deliberately: every write broadcasts, so a cached feed would be handing readers
a stale list seconds after the entire point of the feature is that it is not
stale. Neither is polled on an interval, so neither belongs in `TARGETS` - the
route comments say so, in case that changes.

One additive migration (`37_points_updates`), `CREATE TABLE IF NOT EXISTS` plus
one index matching the feed's exact ORDER BY. Drops nothing, safe to re-run.

⚠️ **The table appears on the next production deploy.** Until then the feed
renders empty rather than erroring. Check the build log for `in sync with your
Prisma schema` per the CLAUDE.md gotcha.

**Files:** `prisma/schema.prisma` + `prisma/migrations/37_points_updates/`,
`src/modules/points/lib/points-updates.ts`,
`src/modules/points/components/UpdatesFeed.tsx`,
`src/app/api/points/updates/{route.ts,[id]/route.ts}`,
`src/core/realtime/realtime-channels.ts`, `permissions.ts`. 23 new tests.

---

## 2026-09-17 (96) — /points in the light theme, a grid that says something, and a name on the card

### The light theme was not dim, it was invisible

Measured on `/points` with the light theme active: **21 distinct text runs below
WCAG AA**, and not marginally.

| what | contrast | needed |
|---|---|---|
| assumption banner | **1.1:1** | 4.5 |
| locked-venue box | **1.01:1** | 4.5 |
| every cell of the sensitivity grid | **1.01:1** | 4.5 |

One cause for all of it: dark-theme foregrounds - `text-mint-100`,
`text-amber-200`, `text-sky-200`, `text-rose-200` - painted on translucent
tints of their own hue. Over near-black they read fine. Over near-white the
tint stays pale and the text stays pale with it, so the grid was not
low-contrast, it was **gone**.

The design system says this in as many words - use `data-up` / `data-down`
"for up/down numbers rather than `text-mint-*`/`text-red-*` so new UI is
readable in both themes" - and the grid did the opposite. It now uses the
semantic tokens, and the cell tints are `color-mix` over `var(--data-up)` /
`var(--data-down)` instead of a hard-coded `rgba(34, 214, 146, a)` pinned to
the dark palette. The four callout foregrounds gained light overrides in
globals.css, following the pattern already there for `text-mint-200`. The whole
points UI moved off the zinc ramp onto `text-content` / `-muted` / `-subtle`,
`border-hairline` and `bg-surface-2`.

**After: 0 AA failures in light AND 0 in dark, at 1440px and 393px**, with no
overflow and nothing invisible in either.

### The grid showed dollars, which told you nothing

Net dollars across a geometric FDV ladder is dominated by the top-right corner,
and when the farm is profitable at every cell - the common case - the result is
a uniformly green table where no cell means anything relative to any other. A
grid nobody can read is worse than no grid, because it looks like information.

It now shows **return on cost**, which is scale-free, with the pivot everyone
already understands: **1.0x is break-even**. The colour scale is built around
that boundary rather than around the largest number present, log-scaled on each
side so 2x-to-4x looks like 4x-to-8x. There is a legend, the cells carry the
dollar figures in a title and a small secondary label, and with no cost entered
it falls back to gross dollars rather than dividing by zero.

### A name that reaches the share card

"Name this calculation" sits at the top of the value panel, because that is
what the share card leads with. Empty means "use the programme's name", so the
placeholder shows it rather than pre-filling - a value someone has to clear
before typing their own is a worse default than an empty box.

⚠️ It is **truncated to 40 characters**, because the share API's zod schema
caps `platform` there and rejects anything longer. Without that, a long name
failed with "Couldn't create the share link" and nothing pointing at the name
as the cause. The input carries the same `maxLength`, so the counter never lies.

### What you are farming, with the facts that decide it

The selected programme now shows **markets, max leverage and fees** - all three
already in the registry and simply never rendered, and all three the first thing
anyone asks before committing capital somewhere.

Added below the cards: **Ongoing perp DEX airdrops**, linking to the running
list in the Telegram channel. The three tracked programmes are the ones with
full scenario numbers; the live list of everything else worth farming changes
far too often to hard-code, so linking it is honest where copying it would be
stale within a week. The URL lives in `site.ts` beside the other channel links,
not inline in a component.

**Files:** `SensitivityGrid.tsx` (rewritten), `ProgramPanel.tsx`,
`ValuePanel.tsx`, `CompsEngine.tsx`, `CostPanel.tsx`, `PointsClient.tsx`,
`src/modules/points/lib/{points,programs}.ts`, `src/app/globals.css`,
`src/shared/utils/site.ts`. 11 new tests.

---

## 2026-09-17 (95) — Nav: six links and a More menu, Research on the bottom bar

### Desktop

Points, Tools and Contact move out of the rail into a **More** dropdown beside
it. The rail keeps the six destinations people actually navigate between: Home,
Markets, News, Research, Community, Premium.

`railLinks` and `moreLinks` are **derived** from `navLinks`, never written out
by hand, and that is deliberate. Two hand-maintained arrays drift, and the
failure mode is a page that quietly cannot be reached from anywhere - which is
exactly what happened to Sodex and RiseX in (93). A partition makes that
impossible: a new link joins `navLinks` and lands in More rather than nowhere.
Pinned by a test that the two lists reconstruct `navLinks` exactly.

The footer and the mobile drawer still render the **complete** list, so nothing
moved out of reach - only out of the rail.

**⚠️ The breakpoint did NOT move back to `lg`.** The shorter rail needs 684px
(down from 1071), and simulating the `lg` layout at 1024 the nav's children
summed to **990px against 998px available - it fits by eight pixels**, measured
while signed out, and a signed-in header is wider still. Eight pixels is what
"it fits" looked like both previous times this overflowed. It stays at xl.

### Mobile

The bottom bar swaps **Tools for Research**. It is four links, not five, and
that is load-bearing: four plus the raised Profile button is five cells, so
Profile sits dead centre. Measured after the change on a 393px viewport -
Profile's centre at 196px against a viewport centre of 197px, one pixel of
rounding. A fifth link makes it cell 3 of 6, visibly left of centre, so this
list only ever changes by swapping.

Tools is a set of one-off calculators you reach for knowing you need one;
Research is the thing people come back to. Tools stays in the drawer.

**Files:** `src/shared/utils/site.ts` (the partition),
`src/shared/components/Navbar.tsx` (More dropdown, same outside-click/Escape
contract as the account menu), `src/shared/components/BottomNav.tsx`,
`src/lib/__tests__/nav-rail-width.test.ts`.

---

## 2026-09-17 (94) — The programmes are back, and the page stops guessing quietly

Follow-on to (93). Two problems, one of them mine.

### (93) silently dropped two of the three tracked programmes

`/points` was built on the live comparables feed, and DefiLlama has **no row
for Sodex or RiseX** — they are too small to track, which is the normal state
of a programme worth farming early. So when the calculator moved off `/tools`,
two of the three programmes this site actually maintains became unreachable.
Nothing failed. They were just gone, and nothing reported it.

The curated registry is now the **spine** of the page and live market data
decorates it, rather than the other way round. `buildPrograms()` joins the two
by normalised name; a programme with no market row is a complete, usable
programme, not a broken card.

**Adding a programme is still adding one object** to `DEX_REGISTRY` — no
schema, no migration.

### Programme state is data now, not prose

`PointsProgramMeta` carries `phase` (live / upcoming / ended / distributed),
`confirmed`, `earnRate` and optional dates. Two things fall out of it:

- The page can sort on "can I still farm this?", which is the first question
  anyone has. Live first, then ties broken on whether the numbers are trustworthy.
- Each card says **"Numbers confirmed by the protocol"** or **"Numbers are
  community assumptions"**. Almost no airdrop site distinguishes those, and the
  difference is the difference between a plan and a daydream. Sodex is the only
  confirmed one here, which is why it sorts first.

### The FDV anchor now has two sources, and says which

While linked, the FDV follows the best anchor available: **live peer
comparables** when the programme's venue is tracked, otherwise the
**programme's own scenario ladder**. The field names which — "from
comparables" vs "from programme" — because those deserve very different
amounts of trust and a bare "linked" badge has no referent.

`scenarioFdv()` opens on the **middle** of a registry ladder rather than the
first or last entry: authors write them low to high, so opening on either end
is editorialising.

### Two things caught in the browser, both wrong in the same direction

1. **The venue picker was a dead control.** The selected programme overrode
   `targetSlug` entirely, so changing the select did nothing for any programme
   with a market row — and a dead control is the first thing a reader reaches
   for. It is now a read-only statement ("follows the programme above") when
   the programme drives it, and a real picker only when it does not.
2. **Selecting Sodex showed Variational's numbers.** The fallback picked the
   largest unlisted venue when a programme had no market row, so choosing Sodex
   produced Variational's peers, Variational's implied FDV, and no indication
   that any of it was unrelated to Sodex. Measured by driving the real page:
   Variational anchored at `$2.92B` from comparables, and Sodex — after the fix
   — at `$290M` from its own scenario, with an explicit note that it has no
   market row and an **opt-in** proxy picker. The page will not choose a proxy
   on a reader's behalf.

That second one is the same failure as the CoinGecko-id question in (93):
a number that is confidently wrong beats no number, right up until someone
trades on it.

**Files:** `src/modules/points/lib/programs.ts` (new, 16 tests),
`src/modules/points/components/ProgramPanel.tsx` (new),
`src/modules/markets/lib/dex-registry.ts` (`PointsProgramMeta` + blocks for
Variational / Sodex / RiseX), `PointsClient.tsx`, `CompsEngine.tsx`,
`ValuePanel.tsx`. No new routes, no schema change.

---

## 2026-09-17 (93) — Points moves out of Tools, and stops asking you to guess

Points/airdrop value was one tab among eight in `/tools`. It is now `/points`,
in the nav, and it does something none of those calculators did.

### The input that decided the answer was a guess

Every points calculator on the internet — including the one this replaces —
asks you to type an FDV and then does arithmetic on it. The arithmetic is
trivial and the FDV is the whole answer, so what they really do is format
your own guess back at you.

`/api/points/comps` derives it instead. It joins DefiLlama's derivatives
overview (volume, open interest) with CoinGecko valuations, so an unlisted
venue's FDV comes from peers that already have a token:

```
implied FDV = peer FDV x (your venue's volume / the peer's volume)
```

Deliberately the plain napkin ratio, not a regression. A model nobody can
check in their head is worse than arithmetic they can argue with.

**It reports a range, never a number.** Median rather than mean, because one
peer at a euphoric multiple moves a mean enough to change the conclusion and
that happens constantly in this sector. The spread is drawn, because the width
of the disagreement is usually the finding.

A thing worth knowing that fell out of the test data: **anchoring on the
market leader is the most conservative estimate, not the most generous one.**
Hyperliquid is the largest venue and trades at the lowest multiple of its own
volume, so it lands at the bottom of every comparable set.

### Picking a listed venue grades the method

Choose a venue that already has a token and the page says how far the estimate
is from the real price. That is the only honest way to present a method like
this: show what it gets wrong where the answer is known, before asking anyone
to trust it where it is not.

### Cost basis, which nobody models

Farmers track points obsessively and their cost basis not at all. A program
paying 0.02% of volume farmed with 0.04% taker fees is a guaranteed loss, and
that is invisible from the points total.

So fees are asked for as **volume x rate** rather than a round "spent" figure,
capital parked carries an opportunity cost, and the output is a **break-even
FDV** — inverted exactly rather than searched, because value is linear in FDV.
Plus cost per point and value per point, which are what make two farms
comparable at all.

### The whole outcome space, not one number

A single estimate is an anchor and people plan around anchors. The sensitivity
grid shows net-of-cost across FDV x allocation, with the live assumption
outlined. Reading it makes the point immediately: value moves 4x across the FDV
axis and 3x across allocation, and FDV is the one nobody controls.

### Three things the browser caught that the source did not

1. **The grid outlined the wrong cell.** It was passed `form.fdv` (stored)
   while every other panel used the derived linked value, so the highlight sat
   one column away from the assumption in force. Two sources of truth, in the
   file whose own comment warns against exactly that.
2. **The heat map was a blank table.** Linear intensity over a geometric FDV
   ladder meant the corner cells differed by 125x — measured intensities ran
   0.004 to 0.42, so every cell but the last two painted as plain background.
   Now a square-root scale: 0.04 to 0.45, readable across the whole grid.
3. **The ninth nav link overflowed the rail**, exactly as the code comment
   predicted. At 1024px the rail needed **1071px against 998px available**,
   hanging 60px past the viewport, and the previous fix had already spent the
   padding headroom. The rail now appears from `xl` (1280) instead of `lg`;
   1024-1279 uses the mobile menu, which already carries every link. This is
   the second time this has moved for the same reason, so it now has a test
   that fails on a tenth link rather than a comment nobody reads.

### Cost

**+2 routes, both static, 0 new dynamic** (145/26/113 → 147/28/113 against
`main`). No page moved from cached to per-request, which is the expensive
regression class on this project.

`/points` is a static shell with no `revalidate` — the same reasoning that
removed the window from `/markets` and `/tools`. `/api/points/comps` is pinned
to `OVERVIEW_TTL` because it reads the shared `llamaOverview` cache and Next
takes the minimum across a segment (trap 1b). It has to carry a **literal**,
since Next rejects `export const revalidate = OVERVIEW_TTL` as an invalid
segment config, so a test fails if the two numbers ever drift apart. **It is
not polled** — one fetch on mount plus a refresh button — which is why it is
absent from `TARGETS`; the route comment says so, in case that changes.

### An FDV is never guessed at

Peers are matched by **name**, never by a hand-written CoinGecko id. An id is
unverifiable by reading it — `aster` and `aster-2` look equally plausible — and
a wrong one silently attaches another project's multi-billion valuation to a
venue. A name mismatch produces no FDV, which is visible and honest. Unmatched
venues carry `null`, not `0`, so they cannot drag the median down while looking
like a datapoint.

**Files:** `src/modules/points/` (new: `lib/points.ts` + five components),
`src/app/points/page.tsx`, `src/app/api/points/comps/route.ts`,
`src/modules/markets/lib/llama.ts` (7d/30d/OI added to `OverviewRow`),
`src/shared/utils/site.ts`, `src/shared/components/Navbar.tsx`,
`src/modules/tools/components/ToolsClient.tsx` (points tab replaced by a
permanent signpost to `/points`). 50 new tests. The share-card flow is
unchanged and existing shared links still render — the payload shape is a wire
format, and the code says so.

---

## 2026-09-17 (92) — Per-device session revocation, and one OTP file instead of two

Auth hardening **authored by @deepakpss** (PR #330). Landed from this branch
rather than merged from his, because this repo only merges the owner's PRs —
his three commits are cherry-picked with authorship intact. Reviewed over two
rounds; the review history is on #330.

### Logging out no longer means logging out everywhere

A stateless JWT cannot be revoked server-side, and the first attempt at this
solved it by bumping `User.passwordChangedAt` on `signOut` — which meant
logging out on your phone silently signed out your laptop, and broke the
invariant `auth.ts` states in its own words a few lines above.

Now each login mints a `sid` stored in the `Session` table and carried in the
token. `signOut` deletes that one row; other devices are untouched. A password
change still purges every row, because that is the one action that *should*
revoke everywhere.

### The failure mode that made the first version unshippable

```ts
const sid = randomUUID();
(token as any).sid = sid;                                    // before
await prisma.session?.create({ … }).catch(() => null);
```

The `sid` was stamped **before** the row was confirmed written, and the
`.catch` swallowed the failure. The refresh branch then ran — on the sign-in
call too, because `isSuperAdmin === undefined` on a fresh token — found no row,
and returned `{}`.

So a single transient DB write failure turned a correct password into *nothing
happened*: bounced to the login page, no error anywhere. That is the exact
symptom CLAUDE.md records as this site's worst outage, arriving through a new
door.

Fixed by stamping only what was actually written:

```ts
const row = await prisma.session?.create({ … }).catch(() => null);
if (row) (token as any).sid = sid;                           // after
```

No `sid` falls back to `passwordChangedAt`-only revocation — weaker, but signed
in. Verified by driving the real `jwt` callback with a `prisma.session` mock
that can be made to throw:

| scenario | before | after |
|---|---|---|
| `session.create` throws at login | `signIn()` returned `{}` | signed in, no orphan sid |
| legacy token, backfill write throws | signed out next refresh | stays signed in |
| expired session row | accepted — `expires` was never read | rejected |
| phone logout vs laptop | laptop alive | laptop alive |

### Also in this pass

- **`expires` is read and enforced** (`expires: { gt: new Date() }`), and expired
  rows are swept next to each create — the 30-day expiry means something now and
  the table stops growing forever.
- **Rate limits recalibrated** for CGNAT: `login` 5/min per account (tighter),
  `password` back to 10/min/IP, `otpEmail` 3/10min, `loginIp` 20/min. An earlier
  revision had these 120× tighter, which would have locked out two people per
  hour behind a shared Jio/Airtel IP.
- **`sanitizeDbError`** — Prisma connection errors embed the full `DATABASE_URL`
  *including the password*, and those go straight to Vercel logs. Now redacted.
- **`traceId` on 500s**, so a member can quote something in a support message.
- **OTP issuance is atomic** (`$transaction` for delete+create), scoped to the
  indexed `(email, purpose)`; bulk expiry moved to its own
  `purgeExpiredVerificationCodes()` with `@@index([expiresAt])` behind it.

### One OTP file instead of two

`src/modules/auth/lib/otp.ts` sat beside the live `src/core/email/otp.ts` as an
unreferenced copy — pre-existing on `main`, not from this work. **It was not
harmless, and this PR is the proof:** the first revision's OTP `$transaction`
fix was written against the dead copy, so it changed nothing at all while
looking entirely correct in the diff.

The two had also **diverged**: the live file carries the atomic
attempt-claiming fix (so N parallel guesses cannot all read the same stale
`attempts` count) and the dead one never got it.

Deleted, with a test in `otp.test.ts` asserting it stays deleted, that
`src/lib/otp.ts` still re-exports the live module, and that the atomic claim is
still there — verified to fail when the duplicate is put back.

### Verified before landing

Checked out at `d4b3c7e`: typecheck clean, lint 0 errors, 1003 tests. Trial-merged
onto `main` — no conflicts, no file touched by both sides — and re-ran the gate on
the merged result: **1010 tests, build green**. Prisma is 5.22, so the
`findUnique` + `expires` filter is supported at runtime; the `Session` table has
existed since `0_init`.

---

## 2026-09-15 (91) — What a mouse can do, a finger can do

Follow-on to (90). That pass made every phone agree about *animation*; this one
makes them agree about *interaction*. Measured the same way — production build,
real browser, desktop and phone contexts across eight routes — rather than by
reading class names.

### A tap left the page stuck looking hovered

globals.css hand-scoped `.surface-hover` and `.lift` inside `@media (hover:
hover)`, and that was the whole of it. The built stylesheet contained **2**
scoped hover rules against **121 unscoped ones**, all Tailwind utilities. So on
a phone, tapping a card applied `:hover` and *left it applied* until you tapped
something else — one card sitting lifted and lit while you read, which reads as
a rendering glitch rather than a hover state.

`future: { hoverOnlyWhenSupported: true }` in `tailwind.config.ts` wraps every
`hover:` utility in `@media (hover: hover) and (pointer: fine)`.

**Scoped hover rules: 2 → 114.**

The nine still outside are light-mode text-colour overrides
(`html:not(.dark) .hover\:text-gold-200`). Colour only, no layout shift —
deliberately left, on the same rule used throughout this pass: a colour hover is
decoration a finger does not miss, something that **moves or appears** is the
page saying "this is the one you picked" and has to reach touch too.

### The flag alone would have made things worse

Turning it on removes hover feedback from touch entirely. So it is only safe
once two things are true, and both were done first:

**1. Every meaningful hover has a press twin.** The previous pass covered
`scale-110` and nothing else — a browser audit still found **14 live hover-only
effects**: the nav underline, the hero CTA lift, the social-icon hop, the
research card shine sweep, the ecosystem logo scale, the orbital tooltip. All
dead on a phone. Added 24 `active:` / `group-active:` twins across 10 files.
`.group:hover .i3d-spin` is hand-written CSS, so the Tailwind flag never reached
it — scoped and given a `:active` twin by hand.

**Hover-only effects on touch: 14 → 4**, and those four are glow-only
(`hover:shadow-[...]`) on elements that already carry `.lift:active` /
`.surface-hover:active`.

**2. No `hover:` may be the only way to reach something.** All ten hover
utilities that gate visibility or reachability were audited. Nine already had a
touch path — `ChatClient` has an explicit `touchUi` / `actionsOpen` branch, the
messages header is already `opacity-100` below `sm`, `AvatarUploader`'s overlay
is a shortcut for a visible "Change photo" button sitting next to it.

One was a real gap: **the per-conversation options button in `/messages`**. Pin
and remove live behind it, and it was `opacity-0` revealed only by
`group-hover:`, with no long-press, swipe or touch branch anywhere in the file.
On a phone the control was invisible — **the feature did not exist on touch.**
Now `opacity-100` by default, hover-revealed from `sm` up, matching the idiom
already used in that same file.

The orbital ecosystem node's description was in its `aria-label` (so a screen
reader had it) and in a hover-only tooltip (so a mouse had it). Touch had
neither; it now has `group-active:`.

### Tap targets: seven flagged, zero real

The audit flagged seven interactive targets under 24×24. **None needed
changing**, and this is worth recording so the next audit does not "fix" them:

- Five carry `tap-target-y` / `tap-target-all`, which add an invisible `::after`
  hit surface (`inset: -9px 0` / `-8px`). A 16px link is a 34px target.
  `getBoundingClientRect()` on the element does not see it.
- Two are inline links inside a sentence — the `/tools` assumption banner and
  the signup Terms/Privacy line. WCAG 2.2 SC 2.5.8 has an explicit **inline
  exception** for these, and padding them would overlap the hit areas of the
  text lines above and below — which is exactly what `tap-target-y`'s own
  comment ("safe next to horizontal neighbours") warns about.

### Verified, not assumed

- Desktop hover still works: the hero CTA measures `none` → `matrix(1,0,0,1,0,-2)`
  on a real mouse hover after the change.
- Device matrix re-run: animation counts unchanged from (90), no horizontal
  overflow, no `opacity: 0` content, no new console errors.
- `touch-parity.test.ts` gained three assertions and each was verified to
  **fail** when its fix is reverted.

**Files:** `tailwind.config.ts`, `src/app/globals.css`,
`src/modules/messages/components/MessagesClient.tsx`,
`src/components/OrbitalEcosystem.tsx`, plus `active:` twins in `Navbar`,
`Footer`, `HeroCta`, `Ecosystem`, `ProofStrip`, `Social`, `ResearchGrid`,
`ChatClient`, `AvatarUploader`, `contact/page`, `u/[username]`.

---

## 2026-09-15 (90) — Every phone gets the same site

### "Sare specs ke device me same animation show hona chahiye"

The motion tier decided `html.lite-motion` from `navigator.deviceMemory`. That
is the one input that gives different answers for identical hardware depending
on which browser is open:

- **Chrome** quantises it to a power of two capped at 8, so a 4 GB phone and a
  6 GB phone both report `4` and there is no way to tell them apart. 8 GB+
  phones report `8` and escaped the tier entirely.
- **iOS Safari and Firefox** do not implement it at all, so every iPhone fell
  through to the FULL tier — the expensive one.

Measured on the homepage, 393x851, production build, 4x CPU throttle, median of
five 2.5s samples:

| device | tier | on-screen anims | fps |
|---|---|---|---|
| Android reporting 4 GB | lite | 17 | **55.5** |
| iPhone (no `deviceMemory`) | FULL | 55 | **31.4** |
| Android reporting 8 GB | FULL | 55 | **30.6** |

So the phones the heuristic could not identify were the ones being handed the
janky page, and two phones of the same class disagreed purely on which browser
was open. That is the whole report, and it cut both ways — some readers saw a
static site, others a stuttering one.

A phone is a phone whatever it reports. The tier now keys on `(pointer: coarse)`
plus a short screen edge (`Math.min(screen.width, screen.height) < 600`), which
every browser answers the same way. `screen` rather than `innerWidth` because a
430x932 phone in landscape has an `innerWidth` of 932 — it would have crossed
into the full tier mid-session on rotation. Tablets (iPad's shorter side is 820)
and desktops are excluded by construction; `saveData` and `<= 2` cores still
demote a genuinely weak machine of any shape.

**Every phone now lands on the same tier.** Measured across eight device
profiles, homepage on-screen animation counts went from
`iPhone 55 / Android-4GB 17 / Android-8GB 55` to **27 on all of them**.

### The capability tier was overruling the identity policy

`.i3d-bob` / `-scan` / `-pulse` / `-tick` / `-float` / `-twinkle` were in the
lite suppression set. They should not have been: CLAUDE.md names the Icons3D
system as core brand identity and exempts it from `prefers-reduced-motion` for
exactly that reason — and this block switched it off anyway, on every phone,
through the other axis. Two motion policies contradicted each other and the
capability one won silently.

It is also the visible half: those animations live on the product and feature
cards, so the report was *"mobile me product wala layout ka animation nahi
hai"* — which was true, and was this rule rather than a broken card.

Restoring them is **not free — 13.6 fps at 4x CPU** (55.5 → 41.9). Bought
deliberately, and the row that justifies it is the third one in the table
above: a large share of phones were sitting at 30.6 fps with no tier at all, so
41.9 is an improvement for them and a regression only against a tier half of
all phones never received. If real hardware says 41.9 is not holding, suppress
more of the ambient wash before reaching for `.i3d-*` again.

### What the audit did NOT find

Eight device profiles x seven routes, production build, checked for horizontal
overflow, content rendered at `opacity: 0` (the blank-page class), broken
images, and console/page errors. **No layout overflow on any device, no
invisible content, no hydration failures.** The React #441 seen on `/community`
locally is `NO_SECRET` from a missing `NEXTAUTH_SECRET` in the audit
environment, not a site bug — confirmed in the server log before reporting it.

**Files:** `src/app/layout.tsx` (tier script + the comment recording why
`deviceMemory` is not an input), `src/app/globals.css` (lite block + measured
numbers), `src/lib/__tests__/motion-detection.test.ts` and
`src/shared/utils/__tests__/motion-tier.test.ts` (both already owned this
ground; updated in place rather than adding a third file that would duplicate
the facts). Both tests were verified to fail when the old behaviour is put back.

---

## 2026-09-08 (89) — Community: the jump that moved the page, and a strip that ate code

### "Tag pe page upar chala jata hai"

Tapping a reply quote, or the pinned banner, called:

```ts
el.scrollIntoView({ behavior: "smooth", block: "center" })
```

`scrollIntoView` walks the **whole ancestor chain** and scrolls every scrollable
box it finds on the way up, and `block: "center"` always scrolls rather than
doing the minimum. The room is meant to be a fixed frame - `main` is
`h-[100svh] overflow-hidden` and only the message list scrolls - but
"overflow-hidden ancestors" is not the same as "nothing above can move".

It now scrolls the list directly, which cannot move anything outside it, with
the arithmetic that centres the message the way `center` intended.

### Picking a mention closed the keyboard

`insertMention` replaced the token and stopped, so focus stayed on the
suggestion button: the caret was lost, and on a phone the keyboard closed the
moment you picked someone. Focus returns to the composer with the caret at the
end, inside a frame so the value is committed first.

### ⚠️ The test helper was eating 5KB of the file it checked

Found while writing the test for the above: an assertion for `ref={composerRef}`
failed against a file that plainly contained it.

Every one of these source-scanning tests strips comments before asserting, so a
test cannot pass on its own prose. The stripper opened a block comment at any
`/*` — including the one inside `accept="image/*"`, whose nearest `*/` is **5179
characters later**. So `strip()` silently deleted the entire photo-upload and
composer region of `ChatClient` before any assertion ran.

The same hole existed in `MessageClient` (read by three DM test suites),
`markets/page.tsx`, `PostEditor` and four other files.

**Nothing was actually passing vacuously** — the full suite still passes with the
stripper fixed, so no `not.toMatch` had been sitting inside a hole. That is luck
rather than design, and it is the second time this session a source-scanning
test has been caught checking less than it claims. `/*` now only opens a comment
when preceded by whitespace or `{`, which is where a real one lives and where
`image/*` never is. Fixed in all 23 files that carried the pattern.

**Files:** `modules/community/components/ChatClient.tsx`,
`__tests__/chat-jump.test.ts`, and the `strip()` in 23 test files.

---

## 2026-09-08 (88) — Markets: distance from the high, and a category filter

Two additions the owner asked for. The interesting part of both is what they
cost, because `cost-check` is explicit that a new external fetch is a cost
decision and this project has already had a real Vercel overage.

### "How far below its all-time high" — free

`/coins/markets` returns `ath` and `ath_change_percentage` on **every row**, and
both were already in the response being parsed. They were dropped at the
`.map()`. So a sortable **From ATH** column costs **zero new requests** — the
coin detail route has been reading the same two fields all along.

Sortable on purpose: "which of these is furthest from its high" is the question
the column exists to answer, and it is useless without ordering. Added to the
search route too, so a searched coin's row carries the same columns as a listed
one.

**Not painted red.** Every coin is at or below its high, so an all-red column
carries no signal — the rule is red for negative *movement*, and this is a
*distance*. A coin sitting **at** its high is the one thing worth colouring, so
that is the only value that gets mint.

### Category filter — one request, only if you use it

CoinGecko does not carry per-coin categories in `/coins/markets`, so this needs
a request. Three options, and the cost is the whole reason for the new route:

1. **A hand-written coin→category map.** No requests, but wrong the moment a new
   coin enters the top 250 — and "with accuracy" was the ask.
2. **Fetch every category up front.** Accurate, but eight requests per
   revalidation for readers who never touch the filter, which is most of them.
3. **Fetch one category, only when a chip is pressed.** ✅

`/api/markets/category` returns **ids only** — the client filters the 250 rows
it already has, so the table never renders from a second source that could
disagree with the first. Its window is 200s, matching `/api/markets/coins`: a
shorter one would add regenerations without making the filtered table any
fresher than the rows it filters.

Measured in a browser: **0 category requests** until a chip is pressed, then
**exactly 1**; pressing Meme leaves only Dogecoin, and All restores every row.

The id is allow-listed rather than sanitised, because it is interpolated into an
upstream URL and the set the UI can ask for is closed. `MARKET_CATEGORIES` lives
in the shared markets lib rather than the route, since a client importing a
route module would drag `NextResponse` into the browser bundle — the class of
mistake `env.ts` gained `server-only` to make impossible.

An empty result says "No top-250 coin is in this category right now" rather than
showing a blank table that looks broken.

⚠️ **Route table 137 → 138** — one new dynamic route, `/api/markets/category`.
That is the only change; nothing moved between static and dynamic.

**Files:** `api/markets/category/route.ts` (new), `api/markets/coins/route.ts`,
`api/markets/search/route.ts`, `modules/markets/lib/markets.ts`,
`modules/markets/components/MarketsClient.tsx`,
`__tests__/markets-design.test.ts`.

---

## 2026-09-06 (87) — Markets, design pass 1

No screenshots came back, so this was done by rendering `/markets` with
realistic stubbed data at 1280x1000 and 390x844, in both themes, and looking at
it. Everything below is a **measurable inconsistency**, not a matter of taste —
which is the only kind of design finding that belongs in a test.

### The colour rule was not being followed

`gold = brand/identity · mint = action + positive data · red = negative data`
(design-system skill).

- **A falling sparkline was drawn in gold.** `stroke={up ? mint : gold}` — so a
  coin down 12% over 7 days drew its line in the wordmark's colour, directly
  beside that same row's red percentages. Now `#ef4444`, the value
  `CoinDetailClient` already uses for the same thing.
- **`StatCardMini` painted neutral totals mint or gold** across eight call
  sites: TVL mint, Stablecoin Mcap gold, Perp Volume gold, Open Interest mint.
  None of those is brand identity or positive data — they are numbers. The
  `accent` prop is removed rather than defaulted, so it cannot come back by
  accident. Restraint over glow.

### The KPI strip read as two unrelated rows

Five `Tile`s, and directly beneath them three `StatCardMini`s showing the same
class of thing — and they disagreed on every axis at once:

| | `Tile` | `StatCardMini` |
|---|---|---|
| padding | `p-4` | `p-5` |
| value | `text-xl` | `text-2xl` |
| row gap | `gap-3` | `gap-4` |
| value colour | `zinc-50` | mint / gold / zinc-50 |

Now identical. The column counts still differ (5 vs 3) because the content
genuinely does — but the cards themselves speak one language, which is what
made the strip look unfinished.

### The strip did not fit a phone

`grid-cols-1` on mobile gave every tile a full 358px row for a label and a short
value like `$2.31T`. Five tiles ≈ **600px of scrolling**, and the coin table was
pushed entirely off the first screen of a 390x844 phone. Two-up brings that to
~330px and puts "Top Coins by Market Cap" back on screen. `sm:grid-cols-2`
already proved two fit; there was never a reason the same pair did not fit 40px
narrower.

### Two claims about freshness, stacked

A static `eyebrow="Live Data"` pill sat 20px above the status line
`MarketsClient` renders. Same claim, two styles — and the static one is the one
that can be wrong: it says "Live Data" while every feed is a cached snapshot,
which is exactly the class of lie #316 was about. Dropped; the one that knows
the difference stays and says "Cached snapshot" or "Live · 2 feeds stale".
`PageHeader.eyebrow` becomes optional so that is a choice rather than a type
error; every other page still passes one.

### The coins table showed no prices on a phone

The worst thing on the page, and it was one class.

The table already dropped Market Cap, Volume and the sparkline at small widths -
someone did the right thing - and then `min-w-[720px]` forced it to 720px
regardless. On a 390px phone that renders the first 390px of the table: **rank
and coin name**. The price, the one number this page exists for, sat off-screen
to the right with nothing indicating it was there.

The min-width now starts at `md`, where the columns it was sized for start, and
`1h` / `7d` join the columns that wait for a wider screen. A phone now shows
rank, coin, **price** and **24h** with no horizontal scroll and fifteen coins on
one screen.

`ChangeCell` gained a `className` so a cell can be hidden with its header -
hiding one without the other shifts every column after it.

### Deliberately not changed

The tab bar wraps to three rows on a phone (~115px). The news page's
horizontal-scroll chip strip would save ~70px, but it would hide three of the
seven tabs behind a scroll on the page whose whole job is switching between
them. Showing all seven is worth the height.

**Files:** `modules/markets/components/MarketsClient.tsx`,
`app/markets/page.tsx`, `shared/components/PageHeader.tsx`,
`__tests__/markets-design.test.ts`.

---

## 2026-09-06 (86) — The same interactions on every device

Follow-up to (85), which fixed the wrong half. The capability tier was demoting
desktops — that was real — but the owner's actual report was narrower and
different: **specific interactions do nothing on their machine, and nothing on
mobile.** Two separate causes, neither related to the tier.

The Motion control added in (85) is removed — the owner doesn't want it, and the
detection fix underneath it is what mattered. `localStorage.motion` remains as
the devtools-level override.

### The hero medallion's 3D tilt was dead under reduced motion

`Hero.onMove` opened with:

```ts
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
```

So the medallion simply did not respond to the mouse on any machine with the OS
setting on — "hero page ka teesre wale me mouse pointer se kuch nahi hota", with
nothing on the page to explain why it behaves differently from someone else's
desktop.

The gate was also inconsistent with this project's own policy: brand motion is
deliberately exempt from `prefers-reduced-motion` (see globals.css and the
design-system skill) precisely because gating it made the site read as static.
And a pointer-following tilt is direct manipulation, not an autoplaying loop —
it moves only while the reader's hand moves. Touch needs nothing here, because
`mousemove` never fires there.

Measured, homepage, pointer moved to the medallion's top-right corner:

| `prefers-reduced-motion` | before | after |
|---|---|---|
| `no-preference` | tilts | tilts |
| `reduce` | **no tilt** | tilts |

### Hover-only feedback meant phones got nothing

The card language — gold border, lit background, icon scaling to 110%, the
arrow nudging — was written entirely in `:hover` and `group-hover:`. Neither
fires on a touch screen, so on a phone those cards were completely inert while
the identical cards on a laptop moved. That is the "mobile me product wala
layout ka animation nahi hai" half.

- `.surface-hover` gained an `:active` twin, so a press produces the same gold
  border and background.
- Every `group-hover:scale-110` gained `group-active:scale-110` — five files:
  Products, About, OrbitalEcosystem, ProfileStats and the profile page — and the
  product-card arrow nudges on press too.
- The `:hover` rules on `.surface-hover` and `.lift` are now scoped to
  `@media (hover: hover)`. Without that, mobile browsers leave `:hover` applied
  **after** a tap, so one card sits lit and lifted until you tap elsewhere —
  which reads as a rendering bug rather than a hover state. `:active` stays
  outside the media query, or the fix would undo itself.

Verified in the shipped CSS and in a browser: a press on a card changes its
border from `rgba(255,255,255,0.11)` to `rgba(226,167,47,0.35)`. The icon-scale
rule is present as `.group:active .group-active\:scale-110{…}` — the interactive
check for that one could not run, because the first element carrying the class
lives inside the continuously-orbiting ecosystem pill and Playwright refuses to
act on a moving target.

**Files:** `components/Hero.tsx`, `components/Products.tsx`,
`components/About.tsx`, `components/OrbitalEcosystem.tsx`,
`modules/profile/components/ProfileStats.tsx`, `app/u/[username]/page.tsx`,
`app/globals.css`, `-MotionToggle.tsx`, `shared/components/Navbar.tsx`,
`__tests__/touch-parity.test.ts`.

---

## 2026-09-06 (85) — The site was static on ordinary desktops

Reported as "mere desktop aur kuch aur desktop me animation static hai, baaki
devices me theek chalta hai". It was not a rendering failure, a stale chunk or
reduced motion — the site was **deliberately** turning the animations off, on
the wrong machines.

### The measurement

The capability tier demoted a session to `html.lite-motion` when
`navigator.deviceMemory <= 4`. Chrome reports that value **quantised to a power
of two and capped at 8** — so a 6 GB desktop reports `4`. Measured on the
homepage with a production build, counting running animations:

| device | `deviceMemory` | tier | running animations |
|---|---|---|---|
| desktop, ≥8 GB | 8 | full | 163 |
| **desktop, 6 GB, 8 cores** | **4** | **lite** | **56** |
| desktop, 4 GB, 4 cores | 4 | lite | 56 |
| Firefox / Safari (no API) | — | full | 163 |
| mid-range Android, 4 GB | 4 | lite | 38 |

So an ordinary desktop with eight fast cores lost 107 animations for having
6 GB of RAM, and the *same machine on Firefox or Safari* kept all of them,
because those browsers do not expose `deviceMemory` at all. Same site, same
person, a different answer per browser — and nothing on screen saying why.

### The fix, in two halves

**The memory clause is now paired with `(pointer: coarse)`.** The measurement
the tier exists for (18→30 fps) was taken on a *phone*; on a desktop, RAM says
nothing about whether CSS animations hold 60 fps. After:

```
desktop, 6GB, 8 cores  -> full, 163   (was lite, 56)
desktop, 4GB, 4 cores  -> full, 163   (was lite, 56)
mid-range Android      -> lite,  38   (unchanged - the case it was built for)
```

Nothing else moved. A genuinely weak machine of any shape is still caught by
the `hardwareConcurrency <= 2` clause, and `saveData` is still honoured.

**And a Motion control in the navbar**, because a heuristic will misjudge some
other device eventually and that should not need a redeploy to put right.
`localStorage.motion` has been an override since the tier shipped and had **no
user interface at all** — only devtools could set it. Now it is a switch, next
to the theme toggle, on both breakpoints.

"On" overrides *both* gates: the capability tier, and the OS
`prefers-reduced-motion` preference via `html.motion-full`, which the
reduced-motion blocks in `globals.css` and `useReducedMotionSafe()` both now
defer to. That last part matters because framer-driven entrances are gated on
the hook and appear in neither `getAnimations()` nor `animation-play-state`, so
CSS alone cannot reach them.

Verified in a browser, both directions:

```
phone (auto-demoted)      lite, 38  -> [toggle] -> full, 100 -> [reload] -> full, 100
OS reduced-motion on     full, 163  -> [off] -> 56 -> [on] -> full, 163
```

Calm scrolling is the one reduced-motion rule "on" does **not** override — a
genuine vestibular accommodation, and nobody calls a page static because it
scrolls calmly.

**Files:** `app/layout.tsx`, `app/globals.css`,
`shared/hooks/useClientFlag.ts`, `shared/components/MotionToggle.tsx` (new),
`shared/components/Navbar.tsx`, `__tests__/motion-detection.test.ts`.

---

## 2026-09-06 (84) — Who hid this, and whose row is this

The last two open bugs from the ten-item pass.

### A moderator could not tell the AI's decisions from their colleagues'

The chat's AI auto-moderation sets `status: "hidden"` — the exact same write a
human moderator makes. `ChatMessage` had no other field, so in the moderation
queue a false positive from the toxicity classifier was **indistinguishable**
from a deliberate staff hide.

That is worse than an inconvenience, because of what it did to recovery. The
only bulk action was **"Restore all hidden"**, and it had to be: with nothing to
filter on, fixing one bad classification meant un-hiding every moderated message
in the room. A moderation tool whose repair mechanism undoes moderation.

`hiddenBy` is now `"ai"` for the filter and the moderator's user id otherwise,
cleared on restore. It is deliberately **not** a foreign key to `User` — "ai" is
not a user, and a moderator whose account is later deleted should not
cascade-null the record of who hid something. It is an audit trail, not a
relation. Nullable with no backfill: messages hidden before this shipped
genuinely have no known author, and the queue says "Unknown" rather than
guessing.

On top of that, `restore_ai` — un-hide only what the filter hid. That is the
action you actually want after a misfire. `restore_all` stays for when you do
mean all of it, and its confirmation now says out loud that it includes
deliberate staff hides. Each hidden row carries an **AI filter** / **By staff**
badge.

### Two writers, one presence row

`ChatPresence.userId` is the primary key, so a member is one row however many
tabs they have open — deliberately, so three tabs count once. Two routes write
it: `/api/chat/presence` (room `"community"`) and `/api/presence` (room
`"site"`), and `chatOwnsPresence(pathname)` stops the site heartbeat running on
`/community` precisely so they don't collide.

But that guard only sees **its own tab's** pathname. With `/community` open in
one tab and any other page in a second, both writers reach the same row, and the
site one stamped `room: "site"` over `room: "community"` — so the chat's count,
which filters on room, dropped that member until their next 25s beat put them
back. The existing code comment describes this failure and believed the guard
prevented it.

The site heartbeat now refreshes `seenAt` and leaves `room` alone. It loses
nothing: the site count is room-agnostic (`count({ where: { seenAt } })`, no room
filter — there is a test pinning that, because if it ever *did* filter by room
this fix would break that tile instead). And a stale `"community"` cannot outlive
the visit, because the chat's leave beacon deletes the row on exit.

No schema change for this half — the compound-key alternative would have meant a
primary-key migration on a live table for a bug a one-line change fixes.

**Verification:** unit tests, typecheck and build. Both surfaces are
admin/auth-gated, so neither was exercised in a browser here. ⚠️ **This ships a
migration** — check the deployment's build log for `in sync with your Prisma
schema` before trusting the moderation queue.

**Files:** `prisma/schema.prisma`, `prisma/migrations/36_chat_hidden_by/`,
`api/chat/messages/route.ts`, `api/chat/messages/moderate/route.ts`,
`api/presence/route.ts`, `dashboard/components/DashboardClient.tsx`,
`__tests__/chat-hidden-by.test.ts`.

---

## 2026-09-06 (83) — Voice-to-message: one dropped prop

Dictating a DM ended with hunting for the Send button, and the reason turned out
to be a single omission rather than a missing feature.

`useSpeechInput` has supported auto-submit all along. Its own doc comment on
`onEnd` reads *"Exists so a caller can auto-submit"*, and the XYZ AI panel does
exactly that — because that panel calls the hook **directly**. Every other
composer on the site goes through `MicButton`, and `MicButton` called the hook
as `useSpeechInput(onText, { continuous })`, dropping `onEnd` on the floor. So
the capability existed, was documented, was used in one place, and was
unreachable from every other.

`MicButton` now forwards it, and the DM composer opts in.

### The ref is not optional

`onEnd` fires from a recognizer callback that can run in the **same task** as
the last `onresult`, before React has committed. Reading `draft` there sends the
composer's contents from before the transcript landed — an empty string on a
single-utterance dictation. So the mic handler writes `draftRef` synchronously,
and an effect keeps it in step with every other path into the composer (typing,
emoji, a cleared draft). Same reasoning and same shape as the AI panel, which
documents it in its own words.

### Why turning this on is safe

`onEnd` fires only when a session ends **normally**. `cancel()` marks the
session discarded *before* calling `abort()` — because `abort()` fires `onend`
synchronously in some engines — and every error path marks it too. So "the mic
failed" and "the user gave up" cannot be mistaken for "the user finished
speaking" and post a message they never meant to send. Tapping the mic again
mid-sentence still just stops and leaves the text to edit, since `toggle()`
calls `stop()`, which finalises.

### What deliberately does not auto-send

The command palette, news search and research search. A misheard query running
itself is a different bug from the one being fixed, so auto-send is opt-in and
they pass no `onEnd`. There's a test pinning that.

Community chat is also unchanged: its `doSend` infers "this is media" from
whether it was given an argument, so wiring auto-send there needs a signature
change that does not belong in this PR.

**Verification:** unit tests, typecheck and build. Headless Chromium exposes no
`SpeechRecognition`, so `MicButton` renders nothing there by design — dictation
cannot be exercised in this environment at all, and `/messages` is behind a
server session besides.

**Files:** `shared/components/MicButton.tsx`,
`messages/components/MessagesClient.tsx`, `__tests__/voice-autosend.test.ts`.

---

## 2026-09-06 (82) — The AI was told to write tables nothing could render

### "Structured nahi hai"

The XYZ AI system prompt asks the model, in its own words, for "tight markdown
(bold key terms, bullet lists, **tables when comparing**)". `shared/utils/markdown.tsx`
renders headings, lists, blockquotes, links, bold, italic, inline code and
colour spans — and has never had any notion of a table. A `|`-row fell through
to the paragraph branch, where `inline()` leaves pipes alone.

So asking the assistant to compare two coins — the single most obvious thing to
ask it — produced a wall of `|` and `|---|---|` in the chat panel. Measured in
the real widget at a 420px viewport, before and after:

| | before | after |
|---|---|---|
| `<table>` elements | **0** | 1 |
| literal `\|---` on screen | **yes** | no |
| page scrolls sideways | no | no |

`globals.css` has carried `.prose-xyz table / th / td` styling, in both themes,
the whole time. The CSS was written for tables the renderer could not produce;
this finishes that, rather than deleting the instruction from the prompt.

The table gets its own `overflow-x-auto` container — the AI panel is narrow and
the four-column comparison above is genuinely wider than it, so without one this
would trade a formatting bug for the horizontal-overflow bug CLAUDE.md says is
never acceptable. Short rows are padded out to the header width, so a model that
drops a cell does not shift every later column left. A line containing a pipe
but no separator row stays a paragraph.

Research posts get tables too, since they share this renderer.

### Keyboard search selected rows you could not see

The command palette's footer advertises "↑↓ navigate". A full result set is one
action plus up to five coins, six research posts and five news items, in a panel
that scrolls — and nothing ever scrolled the highlighted row into view. Holding
ArrowDown moved the highlight past the fold, and Enter then opened a result the
reader had never seen. `block: "nearest"`, so a row already visible does not
jolt the list.

**Files:** `shared/utils/markdown.tsx`, `shared/components/CommandPalette.tsx`,
`__tests__/{markdown-render,command-search}.test.ts`.

---

## 2026-09-06 (81) — DM: you could not read a thread while it was active

### The thread threw you back to the bottom every few seconds

`useEffect(() => { scrollToEnd(); }, [messages.length])` — unconditional. Every
new message jumped the thread to the newest one, including a message from the
other side and one the 5s poll happened to pick up. So scrolling up to find
something in a live conversation and being yanked back down is what the thread
did on its own, roughly every five seconds.

Community chat has had a `stickToBottom` guard since it was built. DM never got
one — there was no `scrollTop` read anywhere in the file.

Now it follows the conversation only when the reader is already following it
(80px of slack), always jumps for **your own** message because sending is an
explicit "take me there", and shows a **"New messages ↓"** pill otherwise —
because not yanking the reader is only half the fix, and without the pill a
message arriving while they read history would be completely silent.

Two details worth keeping:

- It is **state, not a ref.** The "did this arrive while I was reading history"
  decision is made during render, and a ref may not be read or written there.
  The first version of this fix did exactly that and the lint rule caught it.
- **Switching threads resets it.** Otherwise scrolling up in one conversation
  and opening another showed the new one part-way up, with a "New messages"
  pill for what were simply its contents.

### People search could show results for a query you had moved past

The same race #316 fixed in the markets search, in a second place: the cleanup
cancelled the **timer** but never the **request**, and nothing guarded the
response — so of two searches in flight, the slower one won. Type `ali`, pause,
type `alice`, and the results for `ali` could land last and stay on screen under
the newer query. The stale `.finally` was the other half, flipping `searching`
off while a newer request was still running, so the empty state could flash
"no one found" mid-typing.

**Verification:** unit tests, typecheck and build only. `/messages` redirects to
login without a server session, so — like the community pass — none of this was
exercised in a browser here.

**Files:** `messages/components/MessagesClient.tsx`, `__tests__/dm-stick.test.ts`.

---

## 2026-09-06 (80) — Community: the room disagreeing with the server

Three bugs, one shape: the room quietly holding a different view of itself than
the server has.

### One arriving message counted as two

`appendMessage` — the realtime path, so **every** live message — bumped the
unread badge, wrote the `firstUnreadRef` divider anchor and played the blip from
**inside its `setMessages` updater**. An updater must be pure; React is free to
invoke it more than once for a single update, and two invocations counted one
message twice. The poll's `tick` had the identical shape.

Both now do the arrival bookkeeping outside the updater, which stays pure. The
poll re-runs `reconcilePoll` (pure and cheap) against the mirror ref to work out
what arrived, while the merge itself still uses the updater's own `prev` — or a
message that landed over realtime since the ref was last synced would be
dropped. `appendMessage` also writes the mirror ref synchronously, so two
messages in one tick cannot both be treated as new.

The second one was found by a test written for the first, failing on a call site
I had not looked at.

### "Load older" that could never finish

`hasMore` stayed true whenever the **server** said so and the page was
non-empty — even when every row in it was already on screen. A fully de-duped
page means the next request uses the same cursor and returns the same rows, so
the button stayed put and every press re-fetched the identical page. Now: no new
rows means the cursor cannot advance, so there is no reachable history.

### A bulk restore nobody could see

`restore_all` broadcast nothing, on the reasoning that clients pick the messages
up on their next poll. Half true, and the wrong half: a live client's poll is
throttled to a 60s safety reconcile, so an admin clicking "Restore all hidden"
watched nothing happen for up to a minute — and the poll only fetches the
**latest** page, so a restored message older than that window never came back at
all without a reload.

One `messages_restored` event for the whole batch, carrying a count and no
messages: the batch is every hidden message ever, and N broadcasts to every
connected client is not a thing to do on a bulk action. Clients force a
reconcile, bypassing the throttle.

**Verification:** unit tests, typecheck and build only. `/community` renders
`ChatClient` for signed-in members and `CommunityPreview` for everyone else, and
this environment has no session — so unlike the markets and news passes, none of
this was exercised in a browser. The PR's observable section says what to click.

**Files:** `community/components/ChatClient.tsx`, `community/lib/chat.ts`,
`api/chat/messages/moderate/route.ts`, `__tests__/chat-bugs.test.ts`.

---

## 2026-09-06 (79) — News: the things it said it had done

Markets was showing wrong numbers. News had the opposite failure: it reported
success for work that had not happened.

### A bookmark the server refused still filled in

`toggleSave` fired its request from **inside a `setSaved` updater** — a state
updater must be pure, and the POST, the DELETE and the `localStorage.setItem`
were all in there — and then discarded the answer: `.catch(() => {})`, with no
`res.ok` check at all. So a save the server **refused** looked exactly like one
it accepted. The icon filled in, stayed filled until the next reload, and the
story was simply gone.

Refusal is not exotic. `/api/news/saved` shares the `like` rate-limit bucket, so
bookmarking a few stories quickly returns a 429 **with a message**, which the
client threw away. Measured against a stubbed 429:

```
before → bookmark stays filled, no message
after  → bookmark reverts, banner reads "Too many requests. Please slow down."
```

The rollback undoes only the story it touched, so two toggles in flight cannot
clobber each other. `saveInterests` had the same shape and the same fix — the
Customize sheet used to close on a save the server never took.

### Two taps that promised to scroll and did not

Lenis owns the scroll position and rewrites it on its own rAF tick, so a native
scroll it did not initiate is undone a frame later. Both news call sites were
plain `window.scrollTo({ behavior: "smooth" })`: the **"N new stories"** pill
(which prepends stories *above* you and then failed to move, so the pill
vanished and the feed looked unchanged) and the **token/source chips**.

`scrollPageToSmooth` is the eased counterpart to the existing
`scrollPageToTop` — and it must *not* run both halves, unlike the instant one,
because two eased scrolls race for the same property. Measured: `scrollY 1400 →
0` on a token-chip tap.

### Swiping past the last story went nowhere

`onNext` called `loadMore()` and then returned the **same** story id, so at
every page boundary the swipe (and the enabled chevron beside it) landed on the
story you were already reading. You had to swipe again once the page had quietly
arrived. The comment claimed "swipe traverses ALL news".

```
at the true end: 3 / 3  Page 1 story 2   next: busy + spinner
page arrives:    3 / 6                   next: enabled
tap:             4 / 6  Page 2 story 0
```

`loadMore` now returns what it appended (computed from the ref, not assigned
from inside an updater), and the reader lands on the first story that passes the
feed's own filter — on "For You" a freshly loaded story may not be in this feed
at all, and navigating to one that is off-screen closes the reader.

⚠️ The first version of this fix greyed the chevron out during *every*
background prefetch, reintroducing the same dead tap. Caught in the browser, not
by reading. It is busy only while the reader itself is waiting.

### Also

- **Six `onError` handlers wrote styles React does not know about**, one of them
  hiding `e.currentTarget.parentElement`. Now `SafeImg` / `BreakingImage` — and
  the breaking hero falls through to its gradient instead of leaving a black
  rectangle.
- **Returning to a tab cost two `/api/news` requests, not one**: `visibilitychange`
  and `focus` both fire and both refreshed. Collapsed with `wakeIsDue`'s 3s
  floor, and no more — news genuinely wants an eager refresh on return.
- **An uncaught error in the navbar**, found while browser-testing the above:
  `NavActivity`'s loaders were changed to throw, but `Promise.all` orphans every
  rejection after the first, and `void loadDm()` in a realtime handler has no
  catch at all. Reproduced with `/api/notifications` and `/api/dm/unread` both
  500 — which is what happens together when the database is unreachable.
- `CommunityPreview` moved to the community module it renders in, and one unused
  icon import dropped.

**Files:** `news/components/NewsClient.tsx`,
`notifications/components/NavActivity.tsx`, `shared/hooks/useScrollLock.ts`,
`shared/components/SmoothScroll.tsx`, `community/components/CommunityPreview.tsx`
(moved), `__tests__/news-bugs.test.ts`.

---

## 2026-09-06 (78) — Markets: invented candles, a blind effect, and nine wake-up calls

Second markets pass, after #316. Same theme — the page must not present
something it made up, or cannot show, as if it were the market.

### The perp chart drew data it had invented

`PerpChart` seeded its state with **44 generated candles**: a sine wave walked
out from a price hardcoded at the call site (`base: 64000` for BTC, `3400` for
ETH — both years stale). That shape rendered on first paint and for as long as
`/api/chart` was unreachable. It is a candlestick chart — bodies, wicks, a
trend — and nothing about it looks generated. The only tells were an amber dot
and a price reading `$-`.

There is no honest fallback for a price chart, so there is no longer one: a flat
baseline reading "Loading chart…" or "Chart unavailable". The snapshot is also
keyed by `coin:days`, so tapping 1M no longer shows 1D candles under the new
label while the request is in flight.

### The detail pages could not see their own data

Both `CoinDetailClient` and `ProtocolDetailClient` ran their poll in an effect
that depended on the id only — so the closure pinned the coin at `null` forever
and `else if (!coin)` meant "always", not "if we have nothing". Now a ref, which
the effect can actually read. The `eslint-disable` that hid it is gone.

They also had **no way out of an error**: the next attempt was 150s (coin) /
120s (protocol) away, while the routes cache their own failures for ~30s. A
"Try again" button and automatic retry now cover that. Measured against a
failing route: **2 attempts in the first 6 seconds** where the old loop made
one every 150.

And "finished with no data, no error" fell through to a skeleton that animated
forever. Three states are now three states.

### Nine polling loops, each refetching on every glance at the tab

`/markets` runs six hub feeds, two perp charts, the shared ticker and a news
panel. Every one refetched on **every** return to the tab, however recently it
had fetched — while every route behind them caches for 150–300s server-side. A
three-second app switch on a phone fired requests that could not contain
anything new.

Measured on a production build, three short tab switches:

| | before | after |
|---|---|---|
| markets fetches | **24** (8 per switch) | **0** |
| navbar activity (deliberately eager) | 5 | 5 |

The fix is a `wakeMinAgeMs` option on `useLiveData` — the shared poll primitive
that already existed for exactly this, written after an audit that names
markets, but that only `NavActivity` had ever been moved onto. Markets is now on
it too, which also gets it retry-with-backoff and `online`/`focus` wake. A
failing surface drops to the bare 3s floor rather than skipping the gate, so an
outage cannot rebuild the burst. Surfaces where returning should feel instant —
DM threads, notification badges — pass nothing and are unchanged.

### Also

- `EcosystemPills` deleted: zero imports anywhere, still compiled, still pulled
  framer-motion and five lucide icons, still listed in two docs as if it were on
  the page.
- `TrendingNews` was the one poller that swallowed its failure outright
  (`.catch(() => {})`).

**Files:** `shared/hooks/useLiveData.ts`, `markets/components/{PerpChart,
MarketsClient,CoinDetailClient,ProtocolDetailClient}.tsx`,
`markets/lib/useTickerPoll.ts`, `-EcosystemPills.tsx` (×2),
`__tests__/{useLiveData,markets-honest-states}.test.ts`, docs.

---

## 2026-09-05 (77) — "Home" landed at the bottom of the homepage

Reported twice, and the first fix (#296) did not touch it — because it is a
different bug in a different place. Worth writing down, because the two look
identical from the outside.

### What was happening

Clicking "Home" or the logo from another page dropped the reader at the **bottom**
of the homepage. Measured on a production build at 1280x900:

| from | before | after |
|---|---|---|
| `/research` -> `/` | **8171px** (page is 9146px) | 9px |
| `/news` -> `/` | **8246px** | 9px |
| `/markets` -> `/` | 0px | 0px |

Not a jump — a ~1s animation gliding *downward*: `0 -> 9 -> 3750 -> 7712 -> 8171`.
That shape is what gave it away.

### Why

Hooking `scrollIntoView` and `documentElement.scrollTop` before app code ran caught
the App Router calling `scrollIntoView()` once per top-level element of the incoming
page, from inside its own `dontForceLayout` handler:

```
documentElement.scrollTop = 0
scrollIntoView <div.fixed inset-x-0 bottom-0>   the mobile bottom bar
scrollIntoView <footer>
scrollIntoView <main>
scrollIntoView <header.fixed inset-x-0 top-0>
```

The two `fixed` elements are no-ops — they are always in the viewport — so what the
router *effectively* did was scroll to the **footer**. Natively the `<main>` call a
moment later corrects that, which is why this is not a router bug on its own. But
Lenis drives the scroll here: it latched the footer position as its target and eased
toward it over its 1.15s duration, **arriving last**. Last writer wins, and the last
writer was a smooth-scroll engine holding a stale target.

That is also why it looked intermittent — whether the router's element walk ends on
a `fixed` element depends on where the reader was on the page they left, so the same
click behaved differently from different pages. `/markets` worked; `/research` and
`/news` did not.

### The fix

`RouteTopScroll` — a root-layout client component that, on a pathname change, runs
`scrollPageToTop()` inside two nested `requestAnimationFrame`s so it lands *after*
both the router's walk and Lenis's next tick.

`scrollPageToTop` (in `useScrollLock.ts`, beside the existing lock controls) moves
**both** halves: `window.scrollTo(0, 0)` and a new `toTop` control on the registered
Lenis instance (`lenis.scrollTo(0, { immediate: true, force: true })`). Moving only
one is what the bug was made of. Nothing is monkey-patched and no scroll is
cancelled — this simply runs last and sets the position both must agree on.

Deliberately not handled: **back/forward** (a reader returning to a list expects to
come back where they were — this also keeps the component out of the way of real
scroll restoration later), **hash links** (`HashScroll` owns those), and
**query-only changes** (a filter change is not a new page).

No `useSearchParams()`, which would have been the obvious way to cover that last
case: called from the root layout it opts every page under it out of static
rendering unless each is wrapped in its own Suspense boundary. Route table verified
byte-identical after: 25 static, 112 dynamic.

### How this relates to #296

`SameRouteTopScroll` (#296) handles clicking a link to the page you are **already
on** — no navigation, no pathname change, so the router never runs and this new
component never fires. They cover different halves and neither covers the other's.
A test pins that distinction so a later cleanup does not "consolidate" them.

**Live observable:** from `/research`, click "Home" in the header. You should land in
the hero. Falsified if you land in the footer, or if browser Back from an article no
longer returns you to where you were in the list.

---

## 2026-09-04 (76) — Deleting the WebGL orbital, and one obsolete header

Follow-up to (75), which reported both of these and changed neither. Owner said
remove.

### The three.js cosmos is gone

`useWebglGate()` hard-returned `false`, so `OrbitalLazy`'s WebGL branch had been
unreachable for months and the `WebglBoundary` around it was catching errors from
a component that could never mount. `three` + `@react-three/fiber` +
`@react-three/drei` still built the largest chunk in the bundle for it.

Measured, `main` vs this branch, same machine:

| | main | after |
|---|---|---|
| `.next/static/chunks` | 3820 KB | **3112 KB** (−708 KB, −19%) |
| `node_modules` | 1184 MB | **1063 MB** (−121 MB, −10%) |
| `WebGLRenderer` in any emitted chunk | yes | **no** |

Visitors gain nothing, and that is the honest framing: `dynamic()` did its job, so
the chunk was never fetched by anyone. **Dead weight that is genuinely invisible
in production is the kind that survives longest** — this one outlived the decision
to disable it by months precisely because no user-facing number ever moved.

Deleted: `OrbitalScene`, `EcosystemCore`, `Glow`, `HeroLighting`, `Moon`,
`Saturn`, `SpaceParticles`, `StarField`, `textures`, `constants`, `useWebglGate`
(and their `src/components/orbital/*` shims), plus `OrbitalScene3D.tsx` — an
older R3F attempt that nothing imported at all.

**Kept and moved:** `rng.ts` (mulberry32). It was written for the WebGL star
fields but the CSS orbital uses it for its particle field, so it moved to
`src/shared/utils/rng.ts` rather than dying with its old neighbours. That is the
one thing a bulk delete here could quietly have broken.

`OrbitalLazy` keeps its `dynamic({ ssr: false })` + placeholder — that part was
always doing real work — and now just renders the CSS orbital. If the cinematic
scene returns, it returns as its own verified piece of work with a gate shown to
work on real hardware, not as a branch kept warm in case someone gets to it.

Verified after: homepage and orbital section render (9 nodes, coin, rings,
starfield, shooting stars), no console or page errors, no stuck placeholder,
route table byte-identical, 721 tests green.

### `interest-cohort=()` removed from `Permissions-Policy`

It was the opt-out for FLoC, which Google withdrew in 2023 and replaced with the
Topics API. No shipping browser has recognised the token since, so every page
load logged `Unrecognized feature: 'interest-cohort'` and opted out of nothing.
Topics has its own token (`browsing-topics`) and is not enabled here, so there is
nothing to replace it with. Verified on the built server:

```
Permissions-Policy: camera=(), microphone=(self), geolocation=()
```

`microphone=(self)` is untouched — `()` there blocks the mic for every origin
including this one, which is the bug that made dictation impossible in #259.

**Live observable:** the homepage console no longer logs
`Unrecognized feature: 'interest-cohort'`, and DevTools → Network → JS shows no
~856 KB chunk. Falsified if the orbital section renders as a stuck grey pulsing
circle (the lazy placeholder never resolving).

---

## 2026-09-04 (75) — The 512px logo master was the site's heaviest request

PR 4 of the four-part visual pass, and it did not end up being the PR the brief
imagined. Measuring first changed what it was.

### What the brief asked for, and what is actually there

The brief asked for texture and geometry optimization, pixel-ratio control and
frame-rate-aware rendering for the 3D model. All four are WebGL concepts, and
**the WebGL scene has been switched off since before this session**:
`useWebglGate()` hard-returns `false`, with a comment saying the three.js cosmos
rendered inconsistently on some desktops and could not be verified in CI.

So there is no live 3D scene to optimise. What a reader calls "the 3D model" is
the CSS-3D hero medallion. Two more of the brief's assumed defects also failed
to reproduce, and both are worth recording as *not* problems:

- **Zoom clipping.** Measured at 1280 / 1440 / 1920 across 1x-2.5x browser zoom
  and four phone widths: the medallion scales cleanly (512 → 429 → 384 → 272px),
  and not one of the seven orbiting badges is ever clipped by an ancestor or
  pushed off screen. A first pass *did* report a "collapse to 94px" - that was
  an artefact of emulating zoom with `body { zoom }` instead of a smaller CSS
  viewport at a higher DPR, and it is not real.
- **Horizontal overflow.** `scrollWidth === clientWidth` on `/`, `/markets`,
  `/research`, `/news`, `/tools` and `/community` at 320px. Everything that
  extends past the viewport (marquee tracks, filter rails, decorative layers) is
  clipped by an ancestor, as intended.

### The real finding: 338 KB per page load, to paint a 16x16 tab icon

`/logo.png` is a 512x512 RGBA master, ~338 KB. Behind `next/image` that is
exactly right - Next emits 4-18 KB per rendered size and the master is the
quality source it optimises from. In a raw `href` it is a disaster. It was in
**two** raw references at once, and neither was obvious:

| where | cost |
|---|---|
| `metadata.icons.icon` (the favicon) | 338 KB on **every page load, every browser** |
| `sw.js` `PRECACHE` | 338 KB at `install`, for every first-time visitor |
| `PwaSetup` install prompt (`<img width={40}>`) | full decode of a 512px PNG for a 40px box |

The favicon one hid well: a favicon request has no JS initiator, so it appears in
a network panel as type `other` with no stack - which reads like a service-worker
fetch. Chasing it as an SW problem is how the first attempt at this fixed the
wrong thing; the raw file was still being downloaded afterwards, which is what
made the culprit obvious.

Now: `/icon-32.png` (2.0 KB) and `/icon-192.png` (19.8 KB) for the favicon,
`/logo-offline.webp` (13.9 KB, 168px for an 84px box) precached and shown by
`/offline.html`, `/logo-app-192.png` for the install prompt and for push
notification `icon`/`badge`. The master is untouched - shrinking it would make
every `next/image` output worse.

**Measured on the homepage: 2677 KB → 2321 KB for a first visit (−356 KB).**
`sw.js` CACHE bumped v9 → v10 so devices already holding the old 338 KB entry
reclaim it; `activate` only deletes caches whose name is not the current one.

### The medallion is the second bottleneck, and CSS could not reach it

With PR 74's ambient gate doing its job, the medallion became the most expensive
thing left. Ablated at 390x844 / 6x CPU on the lite tier:

| | fps |
|---|---|
| lite baseline | 30.9 |
| without the 7 badge pulses | 35.0 |
| without the glow's `blur-3xl` | 35.5 |
| without the medallion entirely | 41.7 |

The badge pulses are framer-motion `animate` loops, and framer drives those from
its own rAF - they appear in **neither** `document.getAnimations()` nor
`animation-play-state`, so `PauseOffscreenAnimations` and the `html.lite-motion`
CSS block are both blind to them. That blind spot is the point: a purely-CSS tier
would have silently missed 4 fps. Hence `useLiteMotion()`, backed by
`useSyncExternalStore` with a server snapshot, gating the **animation and never
the markup** - server and hydration both read `false`, so a conditional element
or gesture prop would flip after hydration, which is the React #418 trap in a new
coat.

The glow's `blur-3xl` is a 64px Gaussian over a disc that is simultaneously
pulsing and being tilted by the parallax spring, so it re-rasterises rather than
recompositing. On the lite tier it becomes an equivalent radial gradient. Not
pixel-identical, but at 20% opacity behind a gold coin it is a difference nobody
can see and 4.6 fps everybody can feel. Screenshots of both tiers side by side
are indistinguishable apart from the badges' orbit phase.

**Lite tier: 30.9 → 33.9 fps.** Full tier unchanged.

### Reported, not changed: the dead three.js chunk

`three` + `@react-three/fiber` + `@react-three/drei` build an **856 KB chunk -
the largest in the bundle** - for a scene that cannot render. Verified in a real
browser: it is **never fetched**, on mobile or desktop, before or after a full
page scroll. So it costs users zero bytes; the cost is build time, deploy size
and `npm install`. Left in place deliberately - the gate's comment says the code
is kept for a future verified pass, and that is an owner call, not a cleanup to
make silently.

### Files

`src/app/layout.tsx` (favicon sizes) · `public/sw.js` (precache + notification
icons, CACHE v10) · `public/offline.html` · `src/modules/notifications/components/PwaSetup.tsx`
· `src/components/Hero.tsx` + `src/shared/hooks/useClientFlag.ts` (`useLiteMotion`)
· `src/app/globals.css` (`.hero-glow`) · new `public/icon-32.png`,
`public/icon-192.png`, `public/logo-offline.webp` · new
`src/shared/utils/__tests__/logo-asset-weight.test.ts` (7 tests) ·
`seo-indexing.test.ts` (its favicon test asserted the literal `/logo.png`; it now
asserts the squareness it was actually about).

**Live observable:** DevTools → Network → filter `logo` on a hard reload of the
homepage. `/logo.png` must not appear as a document-level request at all; only
`/_next/image?url=%2Flogo.png&…` entries at 4-18 KB should. Falsified if a
~338 KB `/logo.png` still loads, or if the tab icon goes blank.

---

## 2026-09-04 (74) — Animation polish: a motion tier, and one entrance language

PR 3 of the four-part visual pass. Two halves: the homepage was dropping frames on
a mid-range phone, and the site's entrance animations did not agree with each other.

### The homepage was animation-bound, and it was the count, not one effect

Measured at 390×844 with 6× CPU throttling (roughly a mid-range Android):

| | on-screen animations | fps |
|---|---|---|
| homepage | 54 | **16–21** |
| `/markets` | 13 | 60 |
| `/community` | 1 | 60 |

Then a ceiling test on the same page: with **every** animation disabled it ran at
**44 fps**, while removing `backdrop-filter`, removing `filter` and removing
`box-shadow` each changed nothing at all. So animation was the entire bottleneck.

Bisecting it mattered, because the obvious next step — find the one heavy effect —
would have failed. No group was worth more than ~3 fps on its own (Icons3D +3.4,
the assistant launcher +2.3, the orbit/shooter/spinner set +1.3, the shine sweeps
−0.7, i.e. noise); the ambient wash as a whole was worth +4.3 and the small brand
loops as a whole +17.1. It is the *number of simultaneously running animations*
that costs, so the fix has to be broad or it does nothing.

Worth recording that `PauseOffscreenAnimations` was **not** the problem, because it
looked like a suspect: 46 running animations were off screen, but 44 of them sat
inside the one-viewport `rootMargin` that component keeps deliberately alive. It is
working as designed.

### A motion tier, keyed on capability — not on `prefers-reduced-motion`

`html.lite-motion`, set in the same pre-paint script as the theme (a class on
`<html>` is not a render input, so it cannot produce the React #418 mismatch this
project has been bitten by). It drops the always-running ambient wash and the small
idle loops: mesh, aurora, particles, animated stars, nebula haze, Saturn/Moon,
the Icons3D idle set, the assistant launcher's glow, and everything inside
`.mini-viz`. It keeps what a reader would actually name as the brand — the ticker
marquee, `text-shine`/`text-shimmer`, the shooting stars, the medallion's orbiting
rings, spinners, shimmers, and every one-shot entrance. The robot's blink and
antenna stay too: a recorded owner decision, and worth about a frame per second.

**Result: 54 → 17 on-screen animations, 16–17 → 32 fps on the same throttled phone.**
Full tier is untouched — same 54 animations, same pixels.

`prefers-reduced-motion` is deliberately *not* the lever, and the tests pin that.
This project exempts brand motion from that preference on purpose, after repeated
"the site looks static" reports traced to the preference being on in a test
environment. Capability is a separate axis: a fast phone with reduced motion on
still gets the full identity; a weak phone with it off still gets a usable one.

Criteria (conservative on purpose): `saveData`, or `deviceMemory <= 4`, or
`hardwareConcurrency <= 2`. `deviceMemory` is Chromium-only and undefined on iOS,
which is the right outcome rather than a gap — iPhones are not the devices dropping
frames here, and cores alone would demote them wrongly (an iPhone reports 4–6).
`localStorage.motion = 'lite' | 'full'` forces either tier for testing on a real
device.

### One entrance language

`Reveal` is used ~40 times across 19 files, so its presets *are* the site's motion
language — and they disagreed on all three axes at once: six travel distances
(16/24/40/56/64px), five springs plus two tweens, three stagger steps. `pop` sat at
a damping ratio of **0.61**, a visible bounce, directly beside `up` at 0.89.

Now: one spring at a 0.92 damping ratio (single hairline settle, no bounce), one
tween, one 0.07s stagger, and a three-step distance ladder — 12px / 20px / 28px.
Shorter on purpose: 56px of travel on a 390px phone is a sixth of the screen, which
reads as sliding rather than settling. The `blur` preset's radius drops 14px → 8px;
`filter` is one of the few properties here the compositor cannot animate for free.

### One easing, everywhere

Tailwind's default for a bare `transition-*` is `cubic-bezier(0.4, 0, 0.2, 1)`,
which accelerates *into* the change. Every hand-written easing in this codebase had
already converged on the decelerating `cubic-bezier(0.22, 1, 0.36, 1)` (12 uses in
`globals.css`, 6 in framer variants), so `transitionTimingFunction.DEFAULT` now
points at it. Measured after: 78 interactive elements on the brand curve, 8 left on
the old one. Durations untouched — this is a curve change only. The two remaining
hard-coded transitions (`body` theme cross-fade, `.surface-hover`) moved onto
`--dur-slow` / `--dur-med`, same lengths, so the scale has no exceptions left.

### Files

`src/app/layout.tsx` (pre-paint tier script) · `src/app/globals.css` (`.lite-motion`
block, two transitions tokenised) · `src/shared/components/Reveal.tsx` ·
`tailwind.config.ts` (DEFAULT easing) · `src/components/OrbitalEcosystem.tsx`
(`motion-decor` markers) · `src/shared/utils/__tests__/motion-tier.test.ts` (new,
11 tests pinning both halves of the contract).

**Live observable:** on the homepage, `localStorage.setItem('motion','lite')` +
reload drops on-screen animations from 54 to 17 and roughly doubles the frame rate
on a throttled phone, with the ticker, shine, shooting stars and medallion rings
still running. Falsified if the full tier's animation count changes at all, or if
`document.documentElement.classList` lacks `lite-motion` on a `deviceMemory <= 4`
device.

---

## 2026-08-30 (73) — ISR writes exceeded reads on five routes; windows re-derived

Owner's Vercel ISR analytics showed **writes above reads**, which is backwards — you
write a cache entry once and serve it many times:

| route | reads | writes | ratio |
|---|---|---|---|
| `/news` | 166 | **560** | 3.4× |
| `/research` | 177 | 414 | 2.3× |
| `/` | 185 | 385 | 2.1× |
| `/markets` | 175 | 304 | 1.7× |
| `/tools` | 95 | 88 | 0.9× |

By contrast `/login` (50/0) and `/premium` (25/0) are fully static and write nothing —
that is the shape the fixed routes now aim at.

### Three distinct causes, not one

**1. Two pages were pure static shells carrying a `revalidate`.** `/markets` and
`/tools` are not `async`, await nothing and read no database — every number on
`/markets` comes from `MarketsClient` polling the cached `/api/markets/*` routes. So
each regeneration produced **byte-identical HTML**. `/markets` did that every 5
minutes and `/tools` hourly, for 392 writes of nothing between them. Both windows
removed; the pages are now prerendered per deploy.

**2. `/api/news` expired exactly on its own poll boundary.** `NewsClient` polls every
**90s**; the route had `revalidate = 90` *and* `s-maxage=90`. Equal is the documented
defect — the window expires as the next poll arrives and jitter decides whether it
regenerates. `NEWS_REVALIDATE` 90 → **120s**, restoring the margin the markets routes
already have.

**3. Timers duplicated on-demand revalidation.** `/` and `/research` both rebuild on a
timer *and* via `revalidatePath` — the two research write routes and all three
whatsnew routes call it. So publishes were already instant, and the timer only
refreshed a member count and an "Xh ago" label 288 times a day. `/` 300 → **900s**,
`/research` 300 → **1800s**, `/research/[slug]` 300 → **3600s**.

### Measured, and one honest limit

Route table before → after, from the build output (the only place the *effective*
window is visible):

```
/           5m  → 15m        /markets   5m → (none, static)
/research   5m  → 30m        /tools     1h → (none, static)
/news      ≈2m  →  2m
```

`/news` is the honest one. Its page declares `revalidate = 300`, but `getNewsPage`
uses `NEWS_REVALIDATE` (120s) for both its fetch hint and its `unstable_cache`, and
**Next takes the minimum across a route segment** — so the page reports 2m, not 5m.
The real gain there is 90s → 120s plus the poll-boundary fix, not the 3.3× the export
implies. Trap 1b, on a page rather than an API route. Raising the page export alone
does nothing; `NEWS_REVALIDATE` is the lever.

The structural alternative — dropping the server-rendered first batch so `/news`
becomes fully static like `/markets` — is **not** done here: it would remove the feed
from the initial HTML and change first paint, which is a product call, not a caching
one.

### The durable part

`/api/news` is now in `markets-poll-alignment.test.ts`'s `TARGETS`. It was missing
because its poll lives in a **component** — a third shape after the markets client
and the ticker hook, which is exactly why the same defect reached a third route.
`NEWS_POLL_MS` is now a named export so the test can read it. **Mutation-checked:**
reverting `/api/news` to 90 fails the suite with `news: revalidate 90s vs poll 90s`,
and restoring it passes.

Route totals unchanged at **25 static / 112 dynamic**; ISR windows 12 → 10 by design.
0 data-cache rejections. 703 tests pass. No route de-opted to dynamic.

---

## 2026-08-21 (72) — 3D coin logo, scoped to the installed app only

New 3D gold coin logo for the **installed app's identity only** — Android/iOS home
screen icon and the splash Android draws while the app opens. **The website is
unchanged**: navbar, footer, hero, orbital core, login, loaders, offline page,
favicon, share cards and JSON-LD all stay on the original `/logo.png`.

### Files

- **Added** `public/logo-app.png` (512, transparent, coin 94%) → manifest `purpose: "any"`
- **Added** `public/logo-app-192.png` (192) → the recommended 192 slot
- **Added** `public/logo-app-maskable.png` (512, opaque, coin 70%) → `purpose: "maskable"`
- **Added** `public/logo-app-apple.png` (180, opaque, coin 86%) → `apple-touch-icon`
- **Changed** `src/app/manifest.ts` — `icons`; **Changed** `src/app/layout.tsx` — `icons.apple`
- **Added** `docs/brand/` — master artwork + the rollout runbook

### Four files, not one

Each slot crops differently and one file gets damaged in at least one of them.
Maskable icons are cropped to a circle/squircle with only the centre **80%**
guaranteed, so a full-bleed coin loses its gold rim — hence the 70% opaque
variant. iOS renders transparency as **black** and applies its own mask, hence
the opaque apple icon. The splash wants transparency so Android can centre it on
`background_color`.

### Two bugs found on the way

- The first attempt shipped the **512px Telegram-emoji export**, which has the
  coin's dark face punched out of the alpha channel (centre alpha min **0**, mean
  152). Every dark surface showed through it; the homepage mesh made it read as a
  green hole on mobile and desktop. The 1254px master measures min **252**.
  Rebuilt from the master.
- The old manifest declared a `192x192` **and** a `512x512` entry that both
  pointed at the same **640×640** file. The new entries state real dimensions.

All four icons are cropped to the coin's true bounding box and re-centred — the
master was off-centre (24px top margin vs 47px bottom) and sat high in a square
frame.

### Archived for later

`docs/brand/logo-3d-master.png` (1024, centred, transparent) plus
`docs/brand/README.md`, which carries the three traps a site-wide rollout hits:
the emoji-export alpha hole, the `rounded-full`/`ring`/`object-cover` frames that
fight the coin's own gold rim, and the `sw.js` `CACHE` bump required to evict the
precached `/logo.png` (without it, returning visitors and installed PWAs keep the
old logo forever).

---

## 2026-08-18 (71) — "XYZ AI is busy": the one message that could not be acted on

Reported from a screenshot of the assistant panel. **This does not fix the outage** — the
cause is on the provider side and only the owner can see it. It fixes the reason the outage
was impossible to diagnose.

### What that sentence actually meant

`gateway.ts` throws two different capacity errors, and `aiErrorMessage` only distinguished
one of them:

```ts
if (err instanceof AiCapacityError) {
  return err.reason === "no_provider"
    ? "XYZ AI isn't configured right now. …"
    : "XYZ AI is busy at the moment. …";   // ← every other failure, collapsed
}
```

So the panel was reporting `reason === "all_failed"` — **a provider IS configured and every
one of them failed.** Not "busy". The gateway throws
`new AiCapacityError("all_failed", { cause: lastErr })`, so the provider's real error was
sitting on `.cause` the whole time, and this function never read it.

An expired key, an exhausted free quota and a network outage therefore rendered the same
sentence — the one that advises waiting, when waiting was never going to help. The
function's own docstring says its job is to make the cause "diagnosable from a screenshot";
on the most common failure path it did the exact opposite.

- **`aiErrorMessage` now classifies `err.cause`** through the same rules it already applied
  to plain errors. Quota → *"has hit its usage limit"*. Bad key → *"isn't configured
  correctly"*. **"Busy" survives as the fallback**, which is honest when the failure really
  is transient or the error shape is unrecognised.

### And nothing was writing the error down

`gateway.ts` had **no logging at all**. `recordAiUsage` buckets the failure into a coarse
`errorKind`, but the provider's actual message ("Rate limit reached for model …", "API key
expired") went nowhere. With **Sentry still dark** (§8), an AI outage could only ever be
described as "not working" — which is how it was reported.

- **`logAllFailed()`** now writes one line at both `all_failed` sites: task, provider chain,
  `errorKind`, and the real message.
- ⚠️ **Redacted, and not optionally.** Gemini's REST API takes the key as a query parameter
  (`?key=…`), so a fetch/URL error can carry a **live API key** in its message. Logging it
  verbatim would publish a secret into the Vercel log drain. Anything key-shaped is masked
  first, and a test asserts a real-looking key never reaches the log.

### The owner can answer "why" right now, with no deploy

Every failed call already records its kind. This has been true the whole time:

```sql
SELECT "errorKind", provider, count(*) AS n, max("createdAt") AS latest
FROM "AiUsage"
WHERE status = 'error' AND "createdAt" > now() - interval '3 days'
GROUP BY 1, 2 ORDER BY n DESC;
```

`rate_limit` → the provider's free quota is spent; add credit, or add the second provider
(`GEMINI_API_KEY` promotes Gemini to primary with Groq as automatic fallback).
`auth` → the key is expired, revoked, or was never picked up by the running deployment
(env vars are captured at build time — a key added after the last build needs a redeploy).
`server`/`timeout` → genuinely upstream, and "busy" was the right message after all.

### What the owner's query then showed, and the third gap it exposed

```
error    | unknown    | none  | n=10
fallback | -          | groq  | n=4
ok       | -          | cache | n=1
error    | rate_limit | none  | n=1
```

Two things follow immediately. **Groq works** — four calls succeeded on it as a *fallback*,
which also means the primary provider ahead of it in the chain is the one failing. And
**ten failures carry `errorKind = "unknown"`**, the one label that cannot be acted on.

`unknown` is not a mystery, it is a hole in the classifier: every branch covers 401, 403,
429 or 5xx, so **the rest of 4xx had no bucket at all**. A 400, a 404, or a model the
provider has stopped serving ("decommissioned", "does not exist") fell straight through —
a permanent, code-side failure filed under the label that says nothing.

- **`errorKindOf` gains `bad_request`** for exactly that range. ⚠️ This does **not** claim
  those ten rows were 4xx — nobody knows yet, and guessing is what this session has been
  correcting all day. It removes the blind spot so the next ones are legible.
- `errorKind`'s docstring says *"never store raw messages"*, so the real text still goes to
  the log, not the column.

**Files:** `src/modules/ai/lib/ai.ts` · `src/lib/ai/gateway.ts` · `src/lib/ai/usage.ts` ·
`ai-error-message.test.ts` (new, 10 cases). The first two fixes proved by reverting them:
four tests fail. **No UI change** — only the words inside an error bubble, and only when one
is shown.

**Unrelated but noticed on the same screenshot, and more urgent than this:** Supabase shows
*"Organization exceeded its quota in the previous billing cycle · Projects will be restricted
from 31 Aug, 2026."* The **current** cycle is well inside every limit (egress 2.36/5 GB,
database 44/500 MB, storage 4 MB/1 GB, MAU 0/50k), so nothing is failing now — but the
database is what the whole site runs on, and the restriction date is fixed. Tracked in §8.

---

## 2026-08-17 (70) — Points shares on X had no banner: robots.txt was blocking the image

Reported from a screenshot of an X compose box — a competitor's link showed a full preview
card, ours showed nothing.

**Everything about the metadata was already right.** The share page declared
`twitter:card = summary_large_image`, a title, a description and an absolute image URL; the
image was a real 1200×630 `ImageResponse` with the platform's logo and the actual numbers;
the X intent posted the share *page*, not the raw PNG. Reading the code, there was nothing
to fix.

**The image lived at `/api/tools/share/points-value/<id>`, and `robots.ts` disallows
`/api/`.** X's card crawler obeys robots.txt **for the image, not just the page** — so it
fetched the page, read a perfectly valid `twitter:image`, and then refused to fetch what it
pointed at. Every points share went out bare, for every listed perp DEX.

The asymmetry is what made it look like a tools-only bug: the homepage and research cards
render from `/opengraph-image` and `/research/[slug]/opengraph-image`, outside `/api/`, so
those previews always worked.

- **The route moved** to `/tools/share/points-value/[id]/card`. Moving it rather than adding
  an `Allow:` to robots.txt is deliberate: a more-specific `Allow` overriding a broader
  `Disallow` depends on each crawler's precedence rules, and this has to work on all of them.
  Nothing else changes — same renderer, same cache headers, same page.
- **Explicit `width`/`height` on the metadata image.** `summary_large_image` is a request,
  not a guarantee: without dimensions a crawler must fetch and measure the PNG before
  committing to the large layout, and any hiccup there drops the post to a small card.
- Route table: `/api/tools/share/points-value/[id]` out, `/tools/share/points-value/[id]/card`
  in. Same count, same render mode, no cost change.

**`og-image-crawlable.test.ts`** now reads the disallow list out of `robots.ts` itself and
fails if any metadata image under `src/app` starts with a blocked prefix — so this cannot
recur on a different page either. Proved by restoring the old path: two of its three tests
fail. Comments are stripped before matching, for the reason that is becoming a habit here:
these files name the old path in prose to explain why they no longer use it.

**Related, parked rather than fixed (§8 item 6):** the Journal's three share cards are also
under `/api/`, and `journal-share-overview.test.ts` justifies their public access with
"link-preview bots must fetch it without cookies" — which robots.txt prevents. Unlike the
points card, nothing declares them as a page's `og:image`; they are linked as direct
open/download actions, which browsers do regardless. Whether they need the same move depends
on whether those PNG links are meant to be pasted into social posts.

**Files:** `src/app/tools/share/points-value/[id]/page.tsx` ·
`.../[id]/card/route.tsx` (moved from `src/app/api/tools/share/points-value/[id]/route.tsx`) ·
`og-image-crawlable.test.ts` (new). **No UI change** — the visible share page renders the
same image from the new path.

**Observable (owner, after deploy):** paste a points share link into
[cards-dev.twitter.com/validator](https://cards-dev.twitter.com/validator) or just compose a
post with it — the banner appears. *Falsifier:* still no image, or a small card instead of
the wide one.

---

## 2026-08-17 (69) — The two warnings every production build was printing

From a Vercel build log. **The build was succeeding** — these were warnings, and both
had been printed on every deploy for a long time. Neither was caused by a recent change.

### 1. Edge Runtime deprecated — one line, in one file

```
⚠ The Edge Runtime is deprecated. You can use the "nodejs" runtime instead.
⚠ Using edge runtime on a page currently disables static generation for that page
```

Both came from `export const runtime = "edge"` in `src/app/opengraph-image.tsx`, and the
second is the one that cost something: it held the route at **`ƒ` (Dynamic)**.

The comment defending the line said *"unlike the research card this needs no database, so
it can be generated at the edge rather than waking a Node function."* Needing no database
is true, and it is exactly why the page should be **static** — built once, then served
from the CDN. Edge was buying a cheaper way to do work that did not need doing.

Removed. **`ƒ /opengraph-image` → `○ /opengraph-image`**, and it is the *only* line that
changed in the route table. The image markup is untouched, so the share card is identical.

### 2. 🔴 Four upstreams over the data cache's 2 MB limit

```
Failed to set Next.js data cache for https://api.llama.fi/protocols … (11396797 bytes)
Failed to set Next.js data cache for https://yields.llama.fi/pools  … (14271767 bytes)
… plus overview/dexs and overview/fees
```

This is **trap 2 in the `cost-check` skill**, which already named `/api/markets/defi` and
llama.fi — the known state, not a new regression.

The routes carried `next: { revalidate }` on those fetches, so the code read as though the
responses were cached. **They never were.** The cost is not the download alone: 11–14 MB was
re-fetched and re-`JSON.parse`d on every regeneration to keep about a kilobyte, which on
this plan is Fluid Active CPU — and two routes wanting the same URL each paid separately
(`overview/dexs` read by both `/api/markets/dex` and `sitemap.ts`; `derivatives` by both
`/api/markets/perp` and `sitemap.ts`).

**Fix: cache the reduced value, not the body.** `unstable_cache` stores a function's return
value, and these return kilobytes, so the data cache accepts them — the thing the hints were
only pretending to do. `src/modules/markets/lib/llama.ts` now owns all four upstreams, one
shared entry each, with the inner fetches explicitly `cache: "no-store"` so Next stops
trying to store a body it will always reject.

**Build output: 4 failures → 0. Both warnings: gone.**

### ⚠️ The route table caught a regression the unit test could not

Setting the shared TTL to the *shortest* consumer window (200s, `/api/markets/perp`) looked
obviously right — nobody gets staler data. The build output disagreed immediately:

```
/api/markets/dex   ≈5m  →  ≈3m
```

**An `unstable_cache` TTL counts toward the segment minimum, exactly like a `fetch` hint
does** (trap 1b). `/api/markets/dex` exports 320s against a **300s client poll**, so a 200s
effective window would have put every poll on an expired window and regenerated the route
each time — trap 1, the expensive one — while the route file still read `revalidate = 320`.

So the rule is the **opposite** of the intuitive one: a shared TTL must be **>= the largest**
window among its consumers, because the longest-window consumer is the one you break.
`OVERVIEW_TTL` is 320. `/api/markets/perp` may now serve derivatives figures up to 320s old
instead of 200s; its own route window is untouched, and two minutes on a 24h volume
aggregate is immaterial next to regenerating on every poll.

`markets-poll-alignment.test.ts` gained two tests so this cannot recur silently: shared TTLs
must be >= every consumer's window, and none of the five oversized URLs may be fetched
outside `llama.ts`. Both were proved by staging the exact violations. Comments are stripped
before matching, the same way the `token.iat` assertion does it — these files name the URLs
in prose to explain why they no longer fetch them, and an assertion that trips on its own
explanation just gets deleted.

**Left alone deliberately:** `v2/historicalChainTvl`, `v2/chains`, `stablecoins` and
`summary/*` are under 2 MB and cache correctly — the build log never named them.

**Files:** `src/app/opengraph-image.tsx` · `src/modules/markets/lib/llama.ts` (new) ·
`api/markets/{dex,perp,yields,defi}/route.ts` · `src/app/sitemap.ts` ·
`markets-poll-alignment.test.ts` · `.claude/skills/cost-check/SKILL.md`.

**No UI change is possible from this diff** — every file is server-side data fetching or an
OG image's runtime declaration.

---

## 2026-08-11 (68) — nanoid 3.3.16 → 3.3.18 (GHSA-2v37-7h3g-55p8), lockfile only

Dependabot HIGH: *"nanoid: custom generators can loop indefinitely when size is zero"*.
Audited before touching anything. **The alert's version range was misleading and following
it literally would have broken the build.**

### The audit

| Question | Answer |
|---|---|
| Installed | `nanoid@3.3.16` (+ a separate copy vendored inside `next/dist/compiled/nanoid`) |
| Direct or transitive | **Transitive.** Absent from all four dependency fields |
| Brought in by | **`postcss`** — `next@16.3.0 → postcss@8.5.23` and `postcss@8.5.25`, both `^3.3.16` |
| Does our code call nanoid | **No.** Zero references in `src/`, `scripts/`, `prisma/`. IDs come from Prisma `cuid()` and `crypto.randomInt` |
| `customAlphabet` / `customRandom` | **Not called anywhere in the tree.** The only match is nanoid's own definition |
| Vulnerable path reachable | **No** — three independent reasons below |
| Lockfile pinning an old version | Yes, `3.3.16` |

**The alert says "below 5.1.6". For the 3.x line the affected range is `< 3.3.18`** — the
advisory carries several ranges and `< 5.1.6` is the 5.x one. That difference decides the fix:
nanoid 4+ is **ESM-only** and postcss 8 does `require("nanoid/non-secure")`, so forcing 5.1.6
through `overrides` would likely have broken the build. `^3.3.16` already admits 3.3.18, so
this is a patch bump and nothing else.

**Why it was never exploitable here**, from reading the installed source rather than the
advisory text. The bug is in `index.cjs`'s `customRandom`: a character is appended *before*
`if (id.length === size)` is tested, so `size === 0` can never satisfy the only exit and the
`while (true)` spins forever. Three things independently prevent reaching it:

1. **postcss imports `nanoid/non-secure`** — a wholly separate implementation with a bounded
   `while (i-- > 0)` and no `while (true)`. The vulnerable function is not in that file.
2. postcss calls **`nanoid(6)`** — a hardcoded literal, never 0, never user input.
3. Our code never touches nanoid.

⚠️ **Next's vendored copy does contain the vulnerable `customRandom`, and npm cannot patch
it** — only a Next release can. Next only ever calls `nanoid()` (bounded `for` loop), so it is
not reachable there either, but it is worth knowing the alert going quiet does not mean that
copy changed.

### The fix, and why the diff is three lines

`npm update nanoid` reaches 3.3.18 but also writes ~128 **other-platform optional binaries**
into the lockfile (`lightningcss-win32-*`, `darwin-*`, `fsevents`). This session already had a
110-line lockfile diff hide a stray dependency, so the `node_modules/nanoid` entry was edited
directly — version, `resolved`, `integrity`, nothing else. `engines` is identical between the
two versions. `npm ci` then validated the integrity against the registry.
(`npm audit fix --package-lock-only` was tried and does **nothing** — 0 changes, vuln intact.)

`npm audit`: **0 vulnerabilities**.

### The UI is untouched, measured rather than asserted

The site's UI is approved and production-ready, so this was proved twice over:

- **`nanoid/non-secure` is byte-identical between 3.3.16 and 3.3.18** — the file postcss
  imports does not change at all, so postcss cannot behave differently. The patch is a single
  `if (size <= 0) return ''` guard in `index.cjs`, which postcss never loads.
- **Built production CSS is byte-identical**: same chunk filenames, same md5, from a full
  rebuild on each version (`85ce9a2e…`, `d5cd08ae…`).
- Route table identical to `main`: 135 routes, 12 ISR, no mode or window change.

`typecheck` + `lint` + `test` (682) + `build` all green. **Files: `package-lock.json` only.**

---

## 2026-08-11 (67) — 🔴 Anyone who ever changed their password could no longer log in

Reported as "login issue with the right password, only on some devices". It was not
devices. **Every member who had ever reset or changed their password was permanently
locked out of their own account, on every device, with the correct password and no error
shown anywhere.**

**What the video showed, frame by frame:** the button goes *Signing in…* → returns to
*Sign in* with **no error message** → the page redirects to the homepage → the navbar
still reads **"Log in"**. Nothing failed loudly because nothing failed: `authorize()`
accepted the password, and the `jwt` callback then threw the brand-new token away.

### The line

```js
const tokenPwdAt = typeof (token as any).pwdAt === "number" ? (token as any).pwdAt : 0;
if (dbPwdAt > tokenPwdAt) return {};   // empty token == signed out
```

`pwdAt` is stamped **on the token**, four lines below that check. So a token minted one
millisecond ago by a successful password check **does not have one yet**. Defaulting the
absent value to `0` made the newest possible token look like it was minted at the epoch —
older than any password change — so the revocation check fired on the one token that could
not possibly be stale.

`passwordChangedAt` is written **only** by the reset and change-password routes, never at
signup. That is precisely why it looked device-specific: members who had never touched
their password had `null` → `dbPwdAt = 0` → `0 > 0` false → fine. Everyone else, locked out.

**The reasoning that shipped it is preserved in the old comment**, and it is worth reading:
it argued, correctly, that *deploying* the feature would not sign the userbase out, because
existing users have `passwordChangedAt = null`. Right about deployment. It just never asked
what a brand-new token looks like on the way **in**.

### The fix

An absent `pwdAt` means "we do not know when this token was minted" — not "the epoch".
Unknown is not evidence of staleness, so it is stamped rather than revoked:

```js
const tokenPwdAt = typeof rawPwdAt === "number" ? rawPwdAt : null;
if (tokenPwdAt !== null && dbPwdAt > tokenPwdAt) return {};
```

**Revocation is not weakened.** The tokens it exists to kill — a session someone else is
holding from before the change — carry a real, older `pwdAt`, and still die. Only a token
with no `pwdAt` at all gets a pass, and it is stamped on that same pass, so the next
password change revokes it. A token cannot be edited to drop the field: NextAuth encrypts
and signs it.

### And the silence, which is the other half

`signIn()` returning no error only means `authorize()` accepted the password. It says
nothing about whether a session exists — the jwt callback runs afterwards. `LoginForm` now
confirms the session is real before navigating, and says so honestly if it is not, instead
of pushing the member to a homepage that shows "Log in". **This bug was invisible for its
whole life because that check was missing.**

### Tests

- `login-revocation.test.ts` — behavioural, driving the **real** jwt callback the way
  NextAuth drives it. Three sign-in cases (never changed / changed an hour ago / changed
  just now) plus the session callback, and two cases proving revocation still revokes.
- `password-change-revokes-sessions.test.ts` gains an assertion that an absent `pwdAt` may
  never be coerced to `0`. That file already existed to stop this mechanism being
  "simplified" into something inert; it now also stops it being turned into a lockout.
- Proved by restoring the `: 0` default: **4 tests fail**, including the pre-existing one.

**Files:** `src/core/auth/auth.ts` · `src/modules/auth/components/LoginForm.tsx` · tests:
`login-revocation.test.ts`, `password-change-revokes-sessions.test.ts`.

**⚠️ Owner:** no data was lost and nothing needs migrating — affected members can log in
normally the moment this deploys. If anyone reset their password while locked out, that
reset was fine; it just could not help them.

---

## 2026-08-10 (66) — The avatar fix was wrong; two screenshots said so

**Correcting entry (64).** It shipped a real bug fix, but it was not the cause of "my photo
doesn't show" — the photo was still missing after it deployed. Two screenshots settled it,
and the reasoning in (64) is worth reading as an example of a correct process reaching the
wrong conclusion: every link in the read path really was verified, so I concluded the
failure had to be in the one link left unverified. It was in a link I never thought to
list.

### What the screenshots showed, on one screen each

| Rendered fine | Broken |
|---|---|
| Profile banner — CSS `background-image` | Profile hero avatar |
| Chat photos — plain `<img>`, **same Supabase host** | DM header avatar |
| Navbar `/logo.png` — `next/image` over a **static** file | Chat header + bottom-nav avatars |

So Supabase Storage **is** public and its URLs **do** load — (64)'s premise was wrong. The
failure tracked one thing: **`next/image` fetching a source it has to go and get.** The
logo works because Next reads it off disk; an avatar is a remote URL or an `/api/media`
route, and that upstream fetch is what fails. Confirmed locally that `remotePatterns`
accepts the host (`"url" parameter is valid`), so it is the fetch, not the config.

The give-away was there from the start and I read past it: the avatar circles showed the
member's **name as text**, not their initials. That is a broken `<img>` rendering its
`alt` — never the initials fallback, which would have meant `image` was null.

- **`Avatar` now renders a plain `<img>`.** The optimizer earns nothing here: these are
  32–96px images already served with a long CDN cache, and each one spends a billable
  Image Optimization transformation. The mechanism that demonstrably works on this site —
  a plain `<img>` from the same host — is what it uses now. `width`/`height` are real
  attributes so a list of avatars cannot shift layout as it loads.
- Large hero images (`research/[slug]` covers) keep `next/image`, where it does earn it.

### Also fixed, straight off the first screenshot

Replying to a **photo** quoted the raw storage URL as text — two lines of
`https://<ref>.supabase.co/storage/v1/object/…/covers/…webp` where the message above it
shows a picture. `inboxPreview()` already existed for exactly this and was already used by
the inbox; the three surfaces added in (64) and #280 just never called it. Now the quote
above the bubble, the reply bar over the composer, and the forward sheet all do.

**Files:** `src/modules/profile/components/Avatar.tsx` ·
`src/modules/messages/components/MessagesClient.tsx` · tests: `avatar-img.test.ts`,
`dm-quote-preview.test.ts`.

**What (64) still got right, and keep:** the upload-verification check is correct on its
own terms — a private bucket really would store an unreadable URL — it just was not this
bucket. `/api/presence` and `/api/news/social` no longer shipping base64 blobs stands too.

**Observable:** open any profile on a phone. The avatar shows a photo, not the member's
name in text. In devtools: `document.querySelector('img[alt]').currentSrc` is non-empty and
does **not** start with `/_next/image`.

---

## 2026-08-10 (65) — XYZ Sentinel's 403 can finally be diagnosed

`/api/watchdog` has been dark since 2026-07-29 with its cause recorded as **"not yet
pinned"** and two candidates that nobody could choose between. This does not fix the 403 —
it makes it **readable**, which is what has actually been missing for two weeks.

**The blocker was a design note, and §8 already named it:** `authorized()` opened with
`if (!env.CRON_SECRET) return false` and then answered a flat `403 Forbidden` either way.
So two unrelated situations were indistinguishable from outside:

1. the secret **is** configured and the caller sent the wrong one, or
2. the secret is **absent from this deployment's runtime** (Vercel captures env vars at
   build time — a variable added after the last production build is genuinely missing,
   while the dashboard shows it present; the same trap as the Sentry DSN).

(2) is not a security condition at all — the endpoint is switched off and *nobody* can
reach it with any credential. But with no oracle to check against, every diagnosis was a
guess, and one guess was written into §8 **as a fact and later had to be retracted**.

- **`checkCronAuth()`** (`src/core/auth/cron-auth.ts`) returns a reason, and both cron
  routes (`/api/watchdog`, `/api/push/dispatch` — they carried the same six lines) use it:
  - **`503`, naming `CRON_SECRET` and the redeploy** → candidate 2. Redeploy, no code change.
  - **`403 Forbidden`**, bare → candidate 1. The secret is present; the token was wrong.
    This one stays opaque, because it is the only case where a distinguishable answer
    would teach an attacker anything.
- **The usual objection does not apply here.** Blurring the two normally avoids confirming
  an endpoint's config — but when the secret is unset the route is unreachable regardless,
  so "it is unset" gives an attacker nothing. It gives the owner the answer in **one
  unauthenticated request, with no secret involved**.
- **Constant-time comparison** while in here: `===` on a secret is a timing side channel.
  Now sha256 + `timingSafeEqual`, the same shape `otp.ts` already uses (hashing first
  because `timingSafeEqual` throws on length-mismatched buffers, which leaks length).
- **Tested against the real route handler**, not just the pure helper — status code and
  body are what an owner actually sees. Proved by restoring the collapsed behaviour: the
  unset case reports `forbidden` again and the assertion fails.

**Owner, one request, no secret needed:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://xyzcrypto.io/api/watchdog
```
**503** → the variable is missing from the running deployment; redeploy.
**403** → it is present and the token used in the earlier probe was simply wrong.

Note this is only half the darkness: `.github/workflows/watchdog.yml` still has its
`schedule:` commented out, and it reads `CRON_SECRET`/`PROD_URL` from **GitHub Actions**
secrets, not Vercel — it exits 0 with a skip message when either is missing, so a green
workflow run is not evidence it ran. Both doors have to be opened. See §8.

**Files:** `src/core/auth/cron-auth.ts` (new) · `src/app/api/watchdog/route.ts` ·
`src/app/api/push/dispatch/route.ts` · tests: `cron-auth.test.ts`, `watchdog-auth.test.ts`.

---

## 2026-08-10 (64) — A profile photo that saves and never appears, and a DM menu clipped off a phone

Two reported items. Both had a root cause that reports success at every layer.

### (1) 🔴 "I add a profile photo, it saves, and it never shows"

**The read path is not the problem, and that was worth establishing before changing anything.**
Each link was run rather than reasoned about:

| Link | Result |
|---|---|
| `uploadImage()` → inline `data:` URL | ✅ |
| `publicImageUrl()` → `/api/media/avatar/<id>/<token>` | ✅ |
| the `/api/media` handler itself | ✅ 200, byte-identical to what went in |
| `next/image` optimizing a local `/api/...` path with those headers | ✅ 200 (measured against a real dev server) |
| `sw.js` | ✅ never touches `/api/` or `/_next/image` |
| JWT `token.picture` refresh after upload | ✅ `trigger === "update"` already forces a DB re-read |

That leaves exactly one unguarded assumption, and it produces this symptom exactly:

- **A private Supabase bucket accepts the upload.** The POST is authenticated with the
  service-role key, which can write whether or not the bucket is public. It answers 200, we build
  `…/object/public/<bucket>/<path>`, and that URL goes in the database. Then the browser — which
  has no credentials — fetches it and gets a **400**. The photo renders as nothing, everywhere,
  for everyone, permanently. Nothing logs. Re-uploading reproduces it forever.
- Making the bucket public is a **dashboard** step (`HANDOFF.md` §"Supabase Storage", step 2:
  "create a **public** bucket"). No code has ever checked that it was done.
- **Fix: verify before trusting.** After a successful upload, one *unauthenticated*
  `Range: bytes=0-0` GET against the URL we are about to return. Not readable → fall back to the
  inline `data:` URL, which the table above proves renders end to end, and **log which bucket
  setting is wrong** instead of failing silently. One extra request per upload; uploads are rare
  and already doing far more work than this.
- A `Range` GET rather than `HEAD` so a backend that 405s on HEAD doesn't condemn a good upload —
  and the check is deliberately conservative rather than optimistic, because a false negative
  still leaves the member with a working photo.
- `storage-public-check.test.ts` pins it, and was proved by deleting the check: the
  private-bucket case then returns the unreadable URL, exactly as before.

**Also fixed, same family:** `/api/presence` and `/api/news/social` were handing back the **raw**
`image` column, so an inline `data:` avatar (hundreds of KB) was re-serialized into every poll —
on `news/social`, into a *publicly cached* response. Both now go through `publicImageUrl`. Every
other read path already did; these two were the last holdouts.

### (2) 🔴 DM message menu clipped off the screen on a phone

The menu was `absolute bottom-full` on the message row — the right design (it must not cover the
message you are about to delete), and clipped by the message list's `overflow-y-auto`. So on a
phone, opening it on any message in the **upper part of the thread** cut the menu off at the top
of the list. **Reply is the first item**, so it was the first thing to vanish: the feature read as
broken on mobile while working fine in a tall desktop window.

- **Portalled to `<body>`, positioned `fixed` from the trigger's viewport rect.** `fixed` alone
  would not have been enough — the panel's `backdrop-filter` re-establishes the containing block
  (the same reason `ImageLightbox` portals).
- **`placeMenu()`** (`@shared/utils/menu-placement.ts`) does the arithmetic: prefers opening
  upward, flips down when there isn't room, falls to the roomier side when neither fits, and
  always returns a `maxHeight` that fits — so the result is never "off the top", only ever
  "scrollable". Kept pure so it is tested at real phone sizes instead of eyeballed.
- **The trigger is now full-strength on touch.** `opacity-40` is a hover affordance and there is
  no hover on a phone; a 40%-opacity dot does not read as a button, and it is the only way in to
  Reply. Desktop hover behaviour is unchanged (`sm:` only).
- Menu rows are `min-h-10`, so Reply and Forward are not one mis-tap apart.
- `menu-placement.test.ts` sweeps an iPhone 13 viewport top to bottom and asserts the menu is
  fully on screen at every position. Proved by reverting to always-up: the top-of-thread case
  then places the menu at **-6px** and the placement assertion fails.

**Files:** `src/core/storage/storage.ts` · `src/shared/utils/menu-placement.ts` (new) ·
`src/modules/messages/components/MessagesClient.tsx` · `src/app/api/presence/route.ts` ·
`src/app/api/news/social/route.ts` · tests: `storage-public-check.test.ts`,
`menu-placement.test.ts`.

**⚠️ Owner, one thing code cannot do:** rows that already hold a broken
`…/object/public/…` URL stay broken — the fix only changes what *new* uploads store. Either make
the bucket public in the Supabase dashboard, or have affected members re-upload once. To see
whether any exist: `SELECT username, image FROM "User" WHERE image LIKE 'https://%supabase%';`

---

## 2026-08-10 (63) — iOS: a missing prefix, and fields that zoomed the page

Item (2) of the report. **⚠️ Stated up front: a real Safari engine could not be installed here -
the WebKit download is blocked - so this is what an audit and an iPhone device profile can
establish, not a claim that Safari was verified end to end.**

Three known iOS breakers were checked and found **clean**: no `new Date("YYYY-MM-DD HH:mm")`
(Invalid Date in Safari), no regex lookbehind (Safari 16.4+ only), no bare `100vh`. The codebase
was already careful about those. Two real issues were found:

- **`backdrop-filter` without the `-webkit-` prefix.** iOS Safari before 18 ignores the
  unprefixed property entirely, so the panel renders **flat instead of frosted**. Sixteen of the
  seventeen rules in `globals.css` already pair both - **the one that didn't was `.ai-surface`,
  which I wrote.** Fixed, and a test now fails on any unprefixed rule without a prefixed twin.
- **🔴 Focusing a form field zoomed the whole page.** Safari zooms the viewport when a focused
  control's font-size is under 16px, **and does not zoom back out** - the layout stays jerked
  until you pinch it back. The community and DM composers already dodge this by hand
  (`text-base sm:text-sm`); the Journal's number and date inputs, which are the ones people tap
  most, do not.
  - Fixed with `font-size: max(16px, 1em)` under `@media (pointer: coarse)`.
  - **`max()`, not a flat `16px`**: a flat value would have *shrunk* controls that are
    deliberately larger. It only ever lifts.
  - **Coarse pointers only**, so desktop keeps its designed sizes. Measured: **iPhone 13 profile
    reads 16px, desktop still 14px.**
  - Checkboxes, radios and ranges excluded - no text, and iOS does not zoom for them.
- ⚠️ Also recorded: a `pkill` and a heredoc in the same command killed the heredoc (exit 144), so
  a test file silently never got written. The suite count staying flat is what caught it - a
  reminder that "the command ran" is not "the file exists".
- Files: `src/app/globals.css`, `src/shared/utils/__tests__/ios-safari.test.ts` (new, 4 cases).
- Checks: 643 tests, lint at the 36-warning baseline, build exit 0.
- The bigger iOS win was (61)'s `position: fixed` fix, which affected every device.

---

## 2026-08-10 (62) — DM replies and forwarding

Community chat had replies; DMs had neither. Both added, mirroring the chat pattern where it
fits and diverging where DMs are genuinely different.

- **⚠️ The reply target must be in the SAME conversation, and that is the whole security story.**
  Community chat is one global room, so quoting any message is fine there. DMs are private and
  there are many threads - a target accepted on its id alone would let someone quote a message
  out of a conversation they are not in, and the quoted preview would then render that private
  text to the other participant. The lookup is scoped by `conversationId` **and** `status`, and
  an unmatched id is **dropped rather than rejected**, so a stale reply target sends as a normal
  message instead of failing the send.
- **⚠️ "Forwarded" is a flag, not a link.** A reference to the original would point into a
  conversation the recipient has no right to read, and resolving it for a preview would leak that
  thread. So `forwarded Boolean` and a bare label - the same choice WhatsApp makes, for the same
  reason. There is deliberately no `forwardedFrom` relation, and a test asserts its absence.
- **Forwarding goes through the destination's own endpoint**, which re-runs its block and privacy
  gate. Forwarding must not become a way around a block, so that check belongs on the
  destination, not on the sender's side.
- A deleted parent still resolves, with its body stripped the same way the message itself is, so
  the quote reads "message deleted" rather than vanishing and leaving a reply that appears to
  answer nothing.
- Migration `34_dm_reply_forward`, idempotent, matching the house style: `ADD COLUMN IF NOT
  EXISTS`, the FK guarded by a `pg_constraint` check, `ON DELETE SET NULL` so a reply survives
  its parent.
- **⚠️ Two mistakes worth recording.** A `str.replace()` anchored on `const typingNames` matched
  nothing - that identifier is in `ChatClient`, not `MessagesClient` - and passed silently,
  leaving `doForward` undefined until typecheck caught it. And the picker was first inserted into
  a ternary branch that accepts a single element, breaking the JSX; it needed a fragment.
- Files: `prisma/schema.prisma`, `prisma/migrations/34_dm_reply_forward/migration.sql` (new),
  `src/app/api/dm/[id]/route.ts`, `src/modules/messages/components/MessagesClient.tsx`,
  `src/shared/utils/__tests__/dm-reply-scope.test.ts` (new, 5 cases).
- Checks: 639 tests, lint at the 36-warning baseline, build exit 0, route table unchanged.
- **Not verified against a database** - this sandbox has none, so the migration and the queries
  are reviewed and typechecked but not run. Read the deploy build log for
  `in sync with your Prisma schema` before trusting the schema half.

---

## 2026-08-10 (61) — The chat translator stops presenting a non-answer as a translation

Reported as "the translator doesn't work properly both ways". **The direction was not the
problem**: the prompt already handles English→Hinglish and Hinglish→English with an explicit
rule, and both community chat and DMs already call it. So this fixes what actually breaks.

- **An echo is not a translation.** When the model ignores the rule and returns the input
  unchanged, the chat used to show a "translation" identical to the original - which reads as
  the button doing nothing. `translationOrNull()` compares against the input **ignoring case,
  punctuation and spacing**, so a cosmetic-only difference ("Gm everyone!" for "gm everyone")
  counts as an echo too, and reports "couldn't translate" instead.
- **Wrappers are stripped.** Models add `Output:`, a language label, wrapping quotes or a
  trailing `(Hinglish)` despite being told not to. Those were being shown as part of the message.
  - ⚠️ Quote-stripping only fires when the quotes wrap the **whole** string, so a message that
    merely *contains* a quote - `He said "gm" to everyone` - survives untouched. That is the case
    a naive `replace(/"/g, "")` would have quietly mangled.
- Pure and unit-tested (9 cases) rather than verified by calling a model, which this environment
  cannot do.
- **⚠️ Honest limit:** I could not reproduce the original failure - translating needs AI keys
  this sandbox does not have. These are the two failure modes the code can actually produce; if
  the real problem is something else, the on-screen message is now at least truthful about
  having failed, which the old behaviour was not.
- Files: `src/shared/utils/translation.ts` (new),
  `src/shared/utils/__tests__/translation.test.ts` (new, 9 cases),
  `src/app/api/chat/translate/route.ts`.
- Checks: 634 tests, lint at the 36-warning baseline, build exit 0.

---

## 2026-08-10 (60) — `position: fixed` was broken site-wide, and dictation delivered every word twice

Two reported bugs, both root-caused by measurement rather than reading.

### 🔴 The navbar, bottom nav and AI launcher scrolled away with the page — everywhere

`.route-enter` used `animation-fill-mode: both`. `both` keeps the animation applied **after it
finishes**, so `transform` stays resolved as a matrix - identity, but not the keyword `none` -
forever. **Any** non-`none` transform makes an element a containing block for every
`position: fixed` descendant, and `app/template.tsx` wraps **every route** in that div.

So nothing on the site was truly fixed. Measured on an iPhone 13 viewport: at `scrollY 1455` the
header's top was **-1455** - it had scrolled off with the content.

`backwards` instead of `both` still applies the `from` frame before the animation starts (which
is what prevents a flash of un-animated content) but lets the property revert when it ends.
**Re-measured after the change: header top `0` at `scrollY 1434`, on both iPhone and iPad, and
the ancestor walk now reports no containing block at all.**

- ⚠️ Worth noting where this came from: `template.tsx` previously caused this project's worst bug
  with framer-motion and was rewritten as a CSS animation. The rewrite was correct about
  hydration and wrong about fill-mode - a different failure in the same file.

### "Home" left you halfway down the page

A same-route navigation does not reset scroll in Next, so tapping **Home** while already on `/`
did nothing. Measured: `scrollY 1468` before the tap, still deep down the page after. Nav links
now scroll to the top when they point at the current route - **verified: 2000 → 0**. Honours
reduced motion, since this is a navigation jump rather than brand animation.

### 🔴 Dictation doubled every phrase

With `continuous: true` the `results` list is **cumulative** - every event carries the whole
session - and `resultIndex` is only a hint about where the change began. Chrome fires events
whose `resultIndex` still covers an already-final result, so looping from it and emitting every
final delivered the same words again.

A `deliveredRef` cursor now records how many results have actually been handed over, and the loop
starts there. Reset on both start and teardown - left un-reset, a second dictation would begin
past the whole first one and deliver **nothing**, the opposite failure.

- Files: `src/app/globals.css`, `src/shared/components/Navbar.tsx`,
  `src/shared/hooks/useSpeechInput.ts`, `src/shared/utils/__tests__/speech-dedupe.test.ts` (new).
- Checks: 625 tests, lint at the 36-warning baseline, build exit 0, route table unchanged.
- Still open from the same report: iPhone-specific behaviour (needs a description of what
  "checking" means), DM reply/forward, and the chat translator's reverse direction.

---

## 2026-08-10 (59) — "Live online 2" next to a list of 1 was two different populations, unlabelled

Reported from the live dashboard: the tile said **2**, the panel listed **1**, and nothing
explained why.

- **Both numbers were correct.** Realtime counts *everyone* on the site - anonymous visitors get
  a `guest-<random>` presence key - while the list comes from the database, which only has rows
  for signed-in members because `POST /api/presence` requires a session. So 2 = one member plus
  one signed-out visitor.
- Correct data presented so that it reads as a bug is still a defect, and it was mine from (57).
  The panel now shows **"1 signed in · 1 guest"**, and the tile caption says
  **"including signed-out guests"** rather than the ambiguous "Visitors on the site right now".
- **⚠️ A second bug surfaced while fixing the first.** The panel's "showing X of Y" used the
  **realtime** total as Y while X counted only members - so a truncated list would have read
  "showing 12 of 240" where 240 included guests. The hook now carries `signedIn` (database)
  separately from `count` (display), and the cap message compares against `signedIn`.
- **The guest figure is only claimed under two conditions**, both necessary:
  - **realtime is the source** - off realtime, `count` *is* the database figure, so the gap is
    zero and there are no guests to report; and
  - **the list is not truncated** - with a cap in play the gap is part hidden members and part
    guests, and there is no honest way to split it, so it is not labelled.
- Files: `src/modules/dashboard/components/DashboardClient.tsx`,
  `src/shared/utils/__tests__/presence-privacy.test.ts` (4 new cases).
- Checks: 621 tests, lint at the 36-warning baseline, build exit 0, route table unchanged.
- Housekeeping: Dependabot #269 and #270 were commented and closed as superseded by #276.

---

## 2026-08-09 (58) — Remove a stray `playwright` dependency I shipped by accident, and take the Next security bump

Prompted by two Dependabot security PRs. Investigating them turned up something worse than
what they were reporting.

- **🐛 `playwright` was in `dependencies` — and I put it there.** While trying to render the AI
  panel during (41) I ran `npm i playwright` from the repo root instead of the scratchpad. It
  wrote itself into `package.json` and `package-lock.json`, and I committed it in #260 without
  noticing or mentioning it. It is **imported nowhere**, and it was in `dependencies` rather
  than `devDependencies`, so every production install pulled a browser-automation package and
  its `playwright-core` payload for nothing. Removed.
  - The lesson is specific: #260's diff included **110 lockfile lines** and I reviewed the
    source changes without reading them. A lockfile diff in a PR about microphones was the
    signal, and I walked past it.
- **`next` 16.2.12 → 16.3.0**, which carries the fix for **CVE-2025-13465** (vendored lodash).
  `sharp` came along transitively to 0.35.3.
- **`postcss` needed nothing.** Dependabot asked for 8.5.23; the lockfile was already on
  **8.5.25**. Worth recording so the same PR is not "fixed" again later.
- **⚠️ Route table checked line by line, since a minor framework bump can silently change render
  modes.** Totals unchanged at **135 · 25 static · 110 dynamic**. The single diff is cosmetic:
  Next 16.3 labels the route `/research/[slug]/opengraph-image` where 16.2 wrote
  `/research/-/opengraph-image`. Same route, clearer output.
- Dependabot itself is **staying on**. There is no `dependabot.yml` (deliberately removed in
  #201 because the *version*-update PRs were unwanted), so what remains is security-advisory PRs
  only - which is exactly the part worth keeping. Turning it off would not remove a
  vulnerability, only the notice.
- Files: `package.json`, `package-lock.json`.
- Checks: typecheck, 617 tests, lint at the 36-warning baseline, build exit 0.

---

## 2026-08-09 (57) — The dashboard shows WHO is online, not just how many

- `GET /api/presence` already answered "how busy"; it now also returns the visitors themselves,
  and the dashboard renders them as chips that **link straight to each member's public profile**.
  That is the question an admin actually follows up on.
- **⚠️ The cap can never make the site look quieter than it is.** The list is capped at 50, but
  the `online` figure still comes from a **separate COUNT** over the same window, so a truncated
  list reads "showing 12 of 240" rather than silently "12". A capped list reported as the total
  would be exactly the kind of confident-but-wrong number the presence route was written to stop.
- **No email is selected**, per the site-wide rule - name, handle, avatar, plan and role are
  enough to act on. Pinned by a test that reads the actual `select`.
- **⚠️ The poll no longer short-circuits while realtime is healthy.** It used to return early,
  which would have meant the list never loaded on a working deployment. Realtime presence gives a
  count and opaque keys - it cannot give a name, avatar or handle, so the list has to come from
  the database either way. Realtime still wins for the *count* when connected; the fetch owns
  only the list.
- Cost: **no new poller and no new channel** - the existing 20s admin poll carries the extra
  payload, still paused on a hidden tab, still `private, no-store`, still admin-gated. Route
  table unchanged at 135/25/110.
- A member who never chose a handle has no profile URL, so their chip renders **unlinked** rather
  than pointing at `/u/null`.
- Files: `src/app/api/presence/route.ts`, `src/modules/dashboard/components/DashboardClient.tsx`,
  `src/shared/utils/__tests__/presence-privacy.test.ts` (new, 4 cases).
- Checks: 617 tests, lint at the 36-warning baseline, build exit 0.

---

## 2026-08-09 (56) — Auth pages: noindex where it removes, robots.txt where it saves crawl

The last audit item, and the interesting part is that "noindex every auth page" would have been
wrong twice.

- **`/login` and `/forgot-password` now send `noindex, follow`**, and **`/login` was REMOVED from
  the robots.txt disallow** to make that work. A page already in the index can never be removed
  by a disallow: Google must fetch the page to learn it should drop it, and a disallow forbids
  exactly that. Allow the crawl, let the directive do the work - the same reasoning `/news/read`
  needed.
- **`/signup` was deliberately left alone.** It is a real landing page, it is in the sitemap on
  purpose, and it should rank for branded signup queries. A blanket "noindex all auth pages"
  sweep would have quietly cost that, which is why the test asserts signup stays indexable rather
  than only asserting the others do not.
- **`/dashboard`, `/settings`, `/messages`, `/journal`, `/api/` stay in robots.txt disallow** and
  get no `noindex`. They are auth-gated with nothing to de-index, so blocking them saves the
  crawl budget of a redirect - which is what disallow is actually for. Using the two mechanisms
  for their different jobs, rather than applying both everywhere, is the whole point.
- Files: `src/app/login/page.tsx`, `src/app/forgot-password/page.tsx`, `src/app/robots.ts`,
  `src/shared/utils/__tests__/seo-indexing.test.ts` (4 new cases).
- Checks: 613 tests, lint at the 36-warning baseline, build exit 0, route table unchanged at
  135/25/110.
- **This closes every code-side item on the SEO checklist.** What is left needs the owner:
  the `NEXT_PUBLIC_GSC_VERIFICATION` / `NEXT_PUBLIC_GA_ID` env vars (with a redeploy, since
  `NEXT_PUBLIC_*` is inlined at build time) and Core Web Vitals field data.

---

## 2026-08-09 (55) — Coin and protocol pages finally link into the research library

- **The gap:** coin pages are the largest indexable surface on the site and contained **zero
  links to research** - every one was a dead end for both a reader and a crawler. Research posts
  already had related-post links; the market side had nothing.
- `RelatedResearch` renders a small strip of the three most relevant published posts on
  `/markets/[id]` and `/markets/protocol/[type]/[slug]`, plus an "All research" link.
- **⚠️ Rendered on the server, deliberately.** The entire point is a crawlable `<a>` in the HTML;
  a client-rendered list would be invisible to the thing this is for.
- **Relevance reuses `rankPosts` from the AI grounding helpers** rather than inventing a second
  ranking rule - it is already a pure keyword-overlap ranker (title weighted over excerpt over
  body) and already tested. The coin id doubles as the query with hyphens turned to spaces.
  Two new cases confirm it puts the on-topic post first, **and** that it preserves order when
  nothing matches, so a page still gets links rather than an empty section.
- The post list is fetched once per request via React `cache()` and the corpus is single-digit,
  so two strips on one page cost one round trip. Failure degrades to rendering nothing.
- Route table **unchanged** at 135/25/110 - both pages keep their existing ISR mode.
- Files: `src/modules/research/components/RelatedResearch.tsx` (new),
  `src/app/markets/[id]/page.tsx`, `src/app/markets/protocol/[type]/[slug]/page.tsx`,
  `src/lib/__tests__/related-rank.test.ts` (new, 2 cases).
- Checks: 609 tests, lint at the 36-warning baseline, build exit 0.
- **Not verified rendering:** this sandbox has no database, so `allPublished()` returns empty and
  the strip renders `null` here. Compilation, routing and the ranking are verified; the rendered
  output needs the deployed site.

---

## 2026-08-09 (54) — About and Disclaimer pages

- **`/about`** — what the site is, who it is for, **how it makes money**, where the market data
  comes from, and what it deliberately is not. It carries the same honest not-yet-incorporated
  note the Terms page already uses; a trust page that states its limits is worth more than one
  that claims none.
- **`/disclaimer`** — eight sections covering no-financial-advice, that **market data can be
  wrong**, that **the AI assistant can be wrong**, that the Journal is a record rather than a
  signal, third-party protocol risk, no custody (including that nobody here will ever ask for a
  seed phrase), availability, and jurisdiction.
- **⚠️ Both are linked from the footer, not just added to the sitemap.** A page that only exists
  in the sitemap has no internal links pointing at it - a weak signal to a crawler and a dead end
  for a real visitor. Pinned by a test that checks the footer, not only the sitemap.
- Written against the existing trust-page structure (`prose-xyz`, the gold note block, the same
  metadata shape) rather than a new pattern, and cross-linked to Terms, Privacy, Contact,
  Research, Journal, Tools and Premium.
- Route table **135 · 25 static · 110 dynamic** (was 133/23/110): both new pages are **`○`
  static**, the cheapest render mode, and the dynamic count is unchanged.
- Files: `src/app/about/page.tsx` (new), `src/app/disclaimer/page.tsx` (new),
  `src/app/sitemap.ts`, `src/shared/components/Footer.tsx`, `sitemap-routes.test.ts`.
- Checks: 607 tests, lint at the 36-warning baseline, build exit 0.

---

## 2026-08-09 (53) — The SearchAction pointed at a URL that ignored the search, and profiles got Person schema

- **🐛 The sitelinks SearchAction was advertising a lie.** `websiteJsonLd()` has told Google for
  a while that searching happens at `/research?q={search_term_string}` - and `/research` **never
  read `q` at all**. Following that URL showed the unfiltered list. (My own audit called
  SearchAction "missing"; it was present and broken, which is worse. Corrected here.)
  - `ResearchGrid` now seeds its query from `?q=`, so the advertised URL does what it claims and
    a search is shareable.
  - **⚠️ Read on the client, not from server `searchParams`.** Reading `searchParams` on the
    server would have turned this ISR page **dynamic** - the most expensive regression class on
    this project. `useSearchParams()` needs a Suspense boundary or the whole page opts out of
    static rendering anyway, so one was added. **Verified in the build output: `/research` is
    still `○` with its 5m window, and the route totals are unchanged at 133/23/110.**
- **Person + BreadcrumbList on `/u/[username]`.** Only fields the profile already shows
  publicly - **never an email**, per the site-wide rule.
  - `sameAs` carries only absolute URLs. A bare handle or a bare `example.com` would make the
    whole node invalid rather than merely incomplete, so those are dropped; `@handle` for
    X/GitHub is normalised into a real profile URL.
  - `username` is nullable in the schema even though the record was found *by* username, so it
    is **narrowed rather than asserted** - no handle means no node, which beats emitting one
    with a broken `url`. Typecheck caught this; it was not written that way first time.
- Files: `src/shared/utils/seo-schema.ts`, `src/app/u/[username]/page.tsx`,
  `src/modules/research/components/ResearchGrid.tsx`, `src/app/research/page.tsx`,
  `src/lib/__tests__/person-schema.test.ts` (new, 6 cases).
- Checks: 606 tests, lint at the 36-warning baseline, build exit 0, **route table unchanged**.

---

## 2026-08-09 (52) — The sitemap was silently serving no coin pages at all

**🐛 My own bug from (50).** The sitemap fetched the coin and protocol lists from **this
site's own API routes** (`${SITE_URL}/api/markets/...`). That was wrong twice over:

- A serverless function calling itself back through the CDN is fragile - an extra round trip
  that can fail or stall for reasons that have nothing to do with the data.
- The failure was **silent by design**. The "graceful degradation" I was pleased with meant
  production served a sitemap of eleven static URLs and **no coin pages whatsoever**, with
  nothing anywhere saying so. Exactly the failure shape this session has hit repeatedly.

**Fixed:** coins now come straight from CoinGecko with a 1h cache window, and a curated
**fallback list of 20 majors** guarantees the sitemap can never be coin-less again.

- **⚠️ The fallback is coins only, on purpose.** A CoinGecko id is something I can verify by
  eye and does not change; a guessed llama.fi protocol slug would publish a **404 to Google**,
  which is worse than publishing nothing. So the protocol section still degrades to empty.
- **Verified by running the built sitemap with the upstream completely blocked** - the worst
  case: **31 URLs including 20 coins**, where the old code produced 11 and no coins. In
  production, with CoinGecko reachable, it serves 100 coins plus protocols.
- Pinned by three new cases: never fetches its own origin, always emits coin URLs, and has no
  protocol fallback.
- Files: `src/app/sitemap.ts`, `src/shared/utils/__tests__/sitemap-routes.test.ts`.
- Checks: 600 tests, lint at the 36-warning baseline, build exit 0, route table untouched.

---

## 2026-08-07 (51) — SEO step 3: /community gets an h1, and /news/read deliberately does not get a canonical

Closes the two small items left from the audit.

- **`/community` had no `h1` at all** - and the branch that matters is the **anonymous** one,
  since that is what a crawler and a first-time visitor see. It now carries a compact visible
  `h1`, kept to one line because the room is `h-[100svh]` and the message list takes the rest.
- The **logged-in** branch gets an `sr-only` `h1` instead. A member already in the room does not
  need vertical space spent on a title, but the page still needs exactly one `h1` for assistive
  tech. The two branches never render together, so there is still one per page.
- **⚠️ `/news/read` did NOT get a canonical, on purpose.** The audit listed "no canonical" as a
  gap; once the page went `noindex` in step 1 that stopped being a gap and became the correct
  state. `noindex` and `rel=canonical` send contradictory signals - one says do not index, the
  other says index that other URL instead - and Google advises against combining them.
  **Ticking the audit item off mechanically would have made the page worse.** The absence is now
  pinned by a test with that reasoning attached, so it does not get "fixed" later.
- Files: `src/app/community/page.tsx`, `src/shared/utils/__tests__/seo-indexing.test.ts`.
- Checks: 597 tests, lint at the 36-warning baseline, build exit 0, route table untouched.
- **The audit's code-side findings are now all closed.** What is left is not code: which queries
  actually earn impressions, and which pages get impressions but no clicks. That needs Search
  Console data, which only the owner can pull.

---

## 2026-08-07 (50) — SEO step 2: the sitemap now advertises coin and protocol pages

- **Every coin and protocol page was missing from the sitemap.** Both already carry
  `generateMetadata` **and** a canonical - they were built to be indexed and were simply never
  advertised. This is the largest indexable surface on the site, so listing it is the biggest
  single win the audit found.
- **The lists come from this site's own cached market routes**, not from CoinGecko/llama.fi
  directly. Those responses are already cached (`s-maxage=200`), so the sitemap reuses work
  rather than adding a second upstream call on every fetch.
- **⚠️ Coins are capped at 100, not the 250 the API returns.** Every listed page is an ISR entry
  a crawler can cause to regenerate, and search demand for the 200th coin by market cap does not
  justify the write. The cap is a deliberate bound, not an accident of the upstream page size.
  Protocols are capped at 40 per type.
- **⚠️ The sharp edge is the `type` segment.** The protocol page validates `type` against a fixed
  set (`derivatives` | `dexs` | `fees`); publishing anything else would advertise 404s to Google
  at scale. `sitemap-routes.test.ts` reads **both** files and compares the published list against
  the set the page actually accepts, so the two cannot drift apart.
- Fetches are best-effort with a 2.5s abort and a null fallback: a slow or down upstream degrades
  to *fewer URLs*, never to a hanging or broken sitemap - the statically-known pages still have
  to be served. Ids and slugs are `encodeURIComponent`'d so an odd upstream value cannot break
  the XML.
- Also added `/tools`, `/terms` and `/privacy`, which are real public pages with their own
  metadata (and `/tools` has breadcrumb JSON-LD) that the sitemap never mentioned.
- Files: `src/app/sitemap.ts`, `src/shared/utils/__tests__/sitemap-routes.test.ts` (new, 5 cases).
- Checks: 594 tests, lint at the 36-warning baseline, build exit 0, **route table unchanged**
  (133/23/110), no new cost patterns - the one added fetch targets an already-cached own route.

---

## 2026-08-07 (49) — SEO: the default social card was the wrong shape, and /news/read was an unbounded index

First step of the SEO work. **The audit's headline finding was how much already worked** —
metadata on all 12 public pages, canonical on 4 of 5 dynamic routes, Organization / WebSite /
FAQ / Article / Breadcrumb JSON-LD, a dynamic sitemap, `metadataBase`, a GSC hook, and an h1 on
every public page but `/community`. This fixes the two real gaps, not the whole surface.

- **🔴 The default social card was a 640×640 square in a `summary_large_image` slot.**
  `layout.tsx` pinned `/logo.png` (655 KB, 1:1) as the OG and Twitter image, while declaring a
  card format that promises **1.91:1** — so X, LinkedIn and WhatsApp centre-cropped it on
  **every share of every page** except research posts, which already had their own 1200×630
  generator. New `app/opengraph-image.tsx` renders a branded 1200×630 card on the edge runtime
  (no DB needed, unlike the research one), and the explicit `images` were removed from the root
  metadata — an explicit entry there overrides the file convention, which is exactly how the
  square one got in. **`icons` keeps `/logo.png`**: favicons should be square.
- **🔴 `/news/read` was an unbounded indexable URL space.** It renders whatever `?u=` points at,
  so every distinct query string was a separate crawlable address whose content is mostly
  someone else's article — wasted crawl budget, thin/duplicate content, and a scraping-shaped
  signal. It now sends `noindex, follow` while keeping its OpenGraph card, so a shared link
  still previews correctly.
- **⚠️ The trap I walked into and backed out of.** I first *also* added `/news/read` to the
  robots.txt `disallow`. That combination is self-defeating: a crawler has to be allowed to
  **fetch** the page to see the `noindex` at all, and Google can still index a disallowed URL it
  finds linked elsewhere. Disallow saves crawl budget; `noindex` removes from the index; doing
  both means only the first happens. The disallow was removed and the reasoning pinned in a test
  so it does not get "helpfully" re-added.
  - `/settings`, `/messages` and `/journal` **were** added to disallow — those are auth-gated
    with nothing to de-index, so saving the redirect crawl is exactly what disallow is for.
- Route table: **133 routes · 23 static · 110 dynamic** (was 132/23/109) — the one new route is
  `/opengraph-image`. It is `ƒ` but ships `s-maxage=86400, stale-while-revalidate=604800`, and
  its only consumers are link-preview bots, so origin transfer stays negligible.
- Files: `src/app/opengraph-image.tsx` (new), `src/app/layout.tsx`, `src/app/news/read/page.tsx`,
  `src/app/robots.ts`, `src/shared/utils/__tests__/seo-indexing.test.ts` (new, 6 cases).
- Checks: 577 tests, lint at the 36-warning baseline, build exit 0.
- Still to come: sitemap is missing every coin and protocol page (both already have
  `generateMetadata` **and** canonical, so they were built to be indexed and are simply never
  advertised) plus `/tools`, `/terms`, `/privacy`. That is the next step.
## 2026-08-08 (48) — The 08-06 audit is in the repo, with its findings marked resolved

Docs only. Two things that existed nowhere durable are now committed.

- **✅ (47)'s observable ran and passed on production.** On `www.xyzcrypto.io`: three real
  media URLs → **200**, a forged version token → **404**. Both directions, against live
  rows. The forged 404 alone would not have been proof — it is consistent with "the check
  is too aggressive and everything 404s" — so the three 200s are the half that rules out
  the drift failure.
- **`AUDIT-2026-08-06-delta.md` is committed and listed in `SUMMARY.md`.** It had existed
  only as a downloaded file. Five PRs (#256, #263, #264, and #255/#257 incidentally) were
  written against its findings, and none of that was traceable to a document in the repo.
- **⚠️ It carries a status banner, because a snapshot committed as a live task list is the
  drift it was written to catch.** Four of its eight findings closed within two days: 1
  (`/api/media`) by #264, 2 (vacuous test) by #256, 3 (duplicate `markdown.tsx`) by
  #255/#257, 4 (inverted `jsonld` shim) by #263. Findings 5, 6 and 7 remain open and are
  labelled as such, with why each is safe to leave.
- **The banner also records the corrections the body does not make.** Finding 1's magnitude
  was over-stated by ~200× — sized on the 5 MB upload cap when the real avatar is ~24 KB,
  so budget exhaustion is ~450k requests, not ~2k. And repository configuration was never
  examined at all, which outranks everything in the document: `main` is unprotected on a
  **public** repo with two `write` collaborators.
- **Why this was worth a PR of its own.** The audit's single most useful finding was that
  the two prior audits it had been told to defer to **had never existed** — delivered in a
  chat session, never committed, and days later nobody could say what they covered. Leaving
  this one in a downloads folder would have reproduced that exactly.
- **Still open, recorded so the next session inherits it rather than re-deriving it:**
  findings 5/6/7 · three high npm advisories (CI is green only because of `|| true`) ·
  branch protection · the Sentry DSN · CodeQL (free now the repo is public) · the two
  competing admin definitions.

---

## 2026-08-08 (47) — `/api/media` stops minting a new cache key for every forged URL

- **✅ (46)'s observable ran and passed on production.** `document.querySelectorAll('script[type="application/ld+json"]').length`
  → **3** on the homepage. The jsonld shim inversion did not break the re-export chain;
  Organization, WebSite and FAQPage all still render.
- **The bug, measured on production before the fix.** `api/media/[kind]/[id]/[v]` accepted
  the `v` segment and never checked it — it was documented as *"deliberately unused: it
  exists only to make the URL change when the image does"*. That is what it is for, but
  ignoring it made every forged value a distinct URL, and a distinct URL is a guaranteed
  CDN miss:

  ```
  GET /api/media/avatar/<real id>/forged<random>
  → 200 · redirected:false · x-vercel-cache: MISS · 23,776 bytes
  ```

  Anonymous, unthrottled, one invocation and one DB read per request, no upper bound. Real
  user ids need no guessing — `publicImageUrl` renders them into public HTML beside every
  chat message. Three accounts currently store avatars as `data:` URLs, so the expensive
  branch had live targets.
- **⚠️ The 08-06 audit over-stated this by ~200×, and the correction is the useful part.**
  It sized the finding on the 5 MB upload cap and said ~2,000 requests would consume the
  10 GB monthly Fast Origin Transfer budget. The real avatar is ~24 KB, so it is nearer
  **450,000 requests** — a deliberate script running for an hour, not an accident. The
  mechanism was reported correctly; the magnitude was not. Fixed anyway: unbounded is
  unbounded, and nobody will be watching this for months.
- **Three defences, in cost order.** `isCuid(id)` rejects a bogus id before any query; an
  IP-keyed `media` bucket (120/min — generous, since real traffic is CDN-served and only
  reaches the origin on a genuine miss) bounds the rest; and `v` is now compared against
  the token the URL was built with, so the cache-key space collapses from unbounded to one
  key per image.
- **The token check cannot come before the DB read, and that is inherent.** The expected
  token is derived from the stored value, so the row has to be in hand to know what to
  compare against. `isCuid` and the limiter are what stand in front of the query; the token
  check stands in front of the body and the cache entry. Written into the route so the next
  reader does not "fix" the ordering.
- **`mediaToken()` is now exported and used by both sides** rather than the route
  re-deriving the arithmetic. Two copies would drift, and the drift would surface as every
  avatar 404ing at once — a link built by one formula judged by the other.
- **The token is deliberately NOT enforced on the 307 branch.** A non-`data:` value has no
  token to derive, so a request reaching it carries one computed from the old `data:` value;
  checking it would 404 exactly the stale links that branch exists to rescue. It is also
  the cheap path — a redirect, no body.
- **Pinned by `media-cache-key.test.ts`, proved against four perturbations:** dropping the
  `v` check, moving `isCuid` after the query, removing the limiter, and reverting the token
  sampling to tail-only (the old stale-avatar bug). Each fails the assertion that covers it.
- Route table unchanged at **131/22/109/12**. 583 tests green.
- **Not fixed here, noticed while checking:** those three avatars are stored as base64 in
  the `User` table because Supabase Storage is unconfigured or failing at upload. Any query
  selecting `image` for those rows drags a multi-hundred-KB blob out of Postgres. Worth a
  look, separately.

---

## 2026-08-08 (46) — The last inverted shim, and a test for the `</script>` escaping

Closes the duplicate-module trap from the 08-06 audit. **Two of its three items were
already gone** — worth recording, because the brief for this change asked to delete a
file that had since become load-bearing.

- **The `markdown.tsx` duplicate no longer exists, and acting on the old description
  would have broken the site.** The audit found `src/lib/markdown.tsx` (94 lines, real)
  and `src/shared/utils/markdown.tsx` (94 lines, real, unreferenced) and said to delete
  the unreferenced one. #255/#257 have since **inverted them**: `src/lib` is now the
  2-line shim and `src/shared/utils` holds the real 123-line renderer that all three
  consumers reach through it. "Delete the unreferenced copy" would now delete the
  sanitizer. Verified before touching anything; nothing was deleted.
- **`jsonld` was the one real remaining item, and is now inverted to match the
  convention.** `src/shared/utils/jsonld.tsx` holds the `<JsonLd>` component; `src/lib/jsonld.tsx`
  is a 2-line shim. All seven consumers import `@/lib/jsonld` and are untouched. The
  internal re-export was repointed `@/lib/seo-schema` → `@shared/utils/seo-schema`, so the
  real module no longer reaches back through a shim.
- **The `</script>` breakout escaping had no test, on a component that writes
  attacker-influenceable data into `dangerouslySetInnerHTML`.** An HTML parser ends a
  `<script>` at the first literal `</script>` *anywhere*, including inside a JSON string,
  and `JSON.stringify` does not escape `<` — so `.replace(/</g, "\\u003c")` is the only
  thing standing between a post title and script execution. Three tests added, and
  **proved**: removing the escaping fails two of them. Moving untested XSS-prevention code
  is how the test never gets written.
- **`createElement`, not JSX, deliberately.** `vitest.config.ts` discovers only
  `src/**/*.test.ts`, so renaming the file to `.tsx` would have made the whole suite
  vanish from the run — the same vacuous shape as #256. Checked: no `.test.tsx` exists
  anywhere, so nothing is currently being skipped.
- **Full sweep, independent of #258's:** 217 legacy↔new pairs. **Zero two-real-copy
  duplicates, zero inverted shims** after this change (one before). The convention now
  holds everywhere without exception.
- 574 tests green; typecheck, lint and build clean. No route, cache or runtime behaviour
  change — the only runtime edit moves a component between two files that resolve to the
  same import path.

---

## 2026-08-07 (45) — The AI panel resizes from any edge or corner

- **Eight handles** — four edges, four corners — on the panel, with a faint grip in the
  **bottom-left** corner (the bottom-right one is pinned against the screen edge, so there is
  nothing to pull toward there). Size persists per browser and the reset control now clears
  size *and* position together.
- **⚠️ The anchoring is what makes this non-obvious.** The panel's CSS anchor is its
  bottom-right corner and dragging moves it by an offset from that anchor. So pulling the
  **left** or **top** edge only changes the size, but pulling the **right** or **bottom** edge
  has to change the size **and** the drag offset together — otherwise the panel slides across
  the screen instead of growing. The offset is nudged by the growth *actually applied after
  clamping*, not by the raw pointer delta, or it drifts away from the cursor once the size
  hits a limit.
- Clamped to a usable minimum (320×340) and to the viewport (96% × 92%), re-clamped when the
  window resizes, so a size saved on a desktop cannot leave the panel wider than a phone. The
  **minimum wins over the maximum** on a tiny screen — an unusably narrow panel is worse than
  a slightly overflowing one. `clampPanelSize()` is pure and takes the viewport as arguments,
  so all six rules are unit-tested without a DOM.
- **Verified by driving the real geometry in a browser**, not by reasoning: left +200 → 400→600,
  top +150 → 560→710, right +300 → 600→900, bottom past the limit → clamped at 736 (92% of
  800), shrink past the minimum → 320×340.
- Resize handles carry `data-resize`, which the drag guard now excludes — otherwise a resize
  would start a drag at the same time and the two would fight.
- **⚠️ The restore is a lazy `useState` initializer, not an effect.** Reading localStorage
  during render is normally a hydration hazard, but this hook only runs inside `XyzAiWidget`,
  which is mounted via `next/dynamic` with `ssr: false` — it never renders on the server, so
  there is no server HTML to disagree with. Doing it in an effect tripped
  `set-state-in-effect` and pushed lint to 37; this fixed the cause rather than suppressing it,
  and lint is back at the 36-warning baseline.
- Files: `src/shared/hooks/useResizablePanel.ts` (new),
  `src/shared/utils/__tests__/panel-resize.test.ts` (new, 6 cases),
  `src/shared/hooks/useDraggablePanel.ts`, `src/modules/ai/components/XyzAiWidget.tsx`,
  `src/app/globals.css`, `drag-guard.test.ts` (assertion widened to a selector list, so adding
  a control type can't fail it for the wrong reason).
- Checks: 571 tests, lint at the 36-warning baseline, build exit 0, route table untouched.

---

## 2026-08-07 (44) — The panel wouldn't move for the same reason the launcher didn't, and "Listen" was cut off by a browser limit

- **🐛 Dragging the AI panel did nothing — same class of bug as (43), one layer up.** The
  offset was applied as an inline `transform`, but the panel is a `motion.div` whose entrance
  spring animates `y` and `scale`. **framer-motion rewrites `transform` on that element every
  frame**, so the inline value was overwritten before it ever painted. Fixed by handing the
  offset to framer-motion's own `x`/`y` instead, so there is exactly one writer of `transform`.
  The launcher was moved onto `x`/`y` too, for the same reason rather than waiting for it to
  bite. `transition: { duration: 0 }` while the pointer is down, or the panel springs along
  behind the cursor.
- **🐛 News "Listen" failed on many devices because the utterance was too long.** Chrome
  (desktop and Android) silently stops speaking after roughly **15 seconds**, and several
  Android engines reject a very long string outright. Both fail with no error — the button
  just flips back, which is indistinguishable from "nothing happened". A briefing is easily
  long enough to hit it.
  - `chunkForSpeech()` splits on sentence boundaries into ~180-char utterances, spoken as a
    queue that advances on `onend`. Each utterance restarts the browser's timer, so the limit
    never applies. A sentence longer than the limit on its own breaks at the last space, never
    mid-word. 6 unit tests, including "every word survives the split".
  - The queue lives in a **ref, not state**: a live utterance's `onend` must read the current
    queue, and a stale closure would stop playback after the first chunk.
  - Genuine failures now surface a line instead of flipping the button back silently.
    `interrupted`/`canceled` stay quiet - that is what a deliberate stop looks like.
  - The AI panel's read-aloud had the identical defect and got the identical fix.
- Files: `src/modules/ai/lib/tts.ts`, `src/lib/ai/__tests__/tts-chunk.test.ts` (new, 6 cases),
  `src/modules/news/components/BriefingBlock.tsx`, `src/modules/ai/components/XyzAiWidget.tsx`.
- Checks: 564 tests, lint at the 36-warning baseline, build exit 0, route table identical.
- **Still not verified live:** voice input, dragging and Listen all need a real browser and a
  session. The `microphone=(self)` header fix remains on this branch, not on production.

---

## 2026-08-07 (43) — The launcher vanished because a hand-written CSS rule stole its `position`

**🐛 Two bugs, both introduced by (41)/(42) on this branch, both in three lines of CSS.**

- **`.ai-fab { position: relative }` removed the launcher from the page.** Tailwind flattens
  its layers at build time, so in the emitted stylesheet plain **source order** decides — and
  anything appended to `globals.css` lands after `.fixed{position:fixed}` and wins. The button
  dropped out of the viewport corner into normal document flow at the end of `<body>`, about
  2000px down, invisible. It was only ever there to give the pseudo-elements a positioned
  ancestor, which `fixed` already provides.
- **`.ai-fab:active { transform: scale(0.94) }` killed the drag.** The drag offset is applied
  as an inline `translate`; a `transform` from `:active` replaces it outright, so the launcher
  snapped back to the corner the moment it was pressed — which is every moment of a drag.
- **⚠️ Measured, not reasoned.** The compiled stylesheet was loaded into a real browser and
  the computed style read both ways: **with** the rule, `position: relative` at `y=1980`,
  out of view; **without** it, `position: fixed` at the bottom-right corner, in view. The
  first attempt at that harness linked the stylesheet by an absolute filesystem path, so it
  404'd and *every* style was missing — which briefly looked like the fix had failed. Worth
  recording: a harness that silently loads nothing produces the same symptom as the bug.
- **Pinned by `ai-fab-position.test.ts`**, which parses `globals.css` and fails if any
  hand-written `.ai-fab` rule sets `position` or `transform`.
- Also: `@property --ai-spin` / `@keyframes ai-spin` had been deleted along with the removed
  panel aura in (42) while `.ai-fab::before` still referenced them, leaving the orbital ring
  static. Restored.
- Files: `src/app/globals.css`, `src/shared/utils/__tests__/ai-fab-position.test.ts` (new).
- Checks: 558 tests, lint at the 36-warning baseline, build exit 0, route table untouched.
- **Still not verified live:** voice. `microphone=(self)` is on this branch and not on
  production, so any test against the live site still meets the old blocking header.

---

## 2026-08-07 (42) — The drag handle was swallowing the panel's own buttons

- **🐛 Clear chat and Close stopped working, and I broke them in (41).** Rewriting
  `useDraggablePanel` dropped a guard the first version had — *"a press that starts on a
  control belongs to that control, not the drag"* — and the header calls
  `setPointerCapture` on pointerdown. Pointer capture redirects the following **click** to the
  capturing element, so every button inside the header went dead. Both halves are fixed:
  the `closest("button,a,input,…")` guard is back, **and** capture now happens only once
  movement passes the 6px threshold, so a press that never moves can never steal a click.
  Pinned by `drag-guard.test.ts`.
  - ⚠️ That test reads the hook's source and asserts the guard's *shape*, because this project's
    vitest runs without a DOM. **It proves the guard is present, not that a click lands.** Said
    plainly here so nobody later mistakes it for an interaction test.
- **Dictation kept cutting off mid-sentence.** Chrome ends a non-continuous session at the
  first short pause, which reads as "it didn't hear me". Composers (XYZ AI, DMs, community
  chat) now dictate continuously until stopped; search boxes stay single-shot, which is right
  for a short query.
- **A conic aura on the panel was built, rendered, and removed.** The panel is
  `overflow: hidden` — the message list scrolls inside it — so a rim drawn on `::after` is
  clipped to a stub in one corner. The render showed it; it was deleted rather than shipped
  looking broken. The launcher is not clipped, so it keeps its counter-rotating orbital ring.
  Panel depth stays with the radial glows and lit top edge, which survive the clip.
- Files: `src/shared/hooks/useDraggablePanel.ts`, `src/app/globals.css`,
  `src/modules/ai/components/XyzAiWidget.tsx`, `MessagesClient.tsx`, `ChatClient.tsx`,
  `src/shared/utils/__tests__/drag-guard.test.ts` (new, 3 cases).
- Checks: 556 tests, lint at the 36-warning baseline, build exit 0, route table untouched.
- **Still unverified live:** voice itself. The `microphone=(self)` fix from (41) is on this
  branch and **not yet on production**, so any voice test against the live site is still
  hitting the old blocking header.

---

## 2026-08-07 (41) — Voice could never have worked: the site's own header blocked the mic

**(40) fixed the wrong layer.** The three code-level causes it found were all real, but none of
them was why voice failed.

- **`next.config.mjs` sent `Permissions-Policy: microphone=()` on every route.** An empty
  allowlist blocks the microphone for **every** origin — including this site. The browser
  refused dictation before a single line of our code ran, so no amount of hook fixing could
  have helped. Now `microphone=(self)`; camera and geolocation stay fully blocked.
- **⚠️ And (40)'s error message actively pointed the wrong way**: *"Allow mic access for this
  site in your browser settings."* The visitor's settings were fine — the site was refusing
  itself. Reworded to *"Microphone unavailable. Check that this site is allowed to use your
  mic."*, which is true for both causes.
- **Pinned by `permissions-policy.test.ts`**, which reads the real `next.config.mjs`. Nothing
  inside the app can observe this header, so the config file is the only place it can be
  caught — and the test reads that file directly, not a re-export, since a shim would match
  nothing and pass while verifying nothing.

**Dragging did nothing where it was wanted.** (40) gated it to `min-width: 768px`, so on a
phone — where a floating button most gets in the way — it was simply inert. And it moved only
the *panel*; the **launcher** was never draggable, which is the thing that actually floats.
- Both now drag, on every screen size. `useDraggablePanel` takes a storage key so the two
  positions persist independently.
- A **6px movement threshold** separates a tap from a drag, and `wasDragged()` lets the
  launcher swallow the click that ends a drag — without it, moving the button would open the
  panel every time.
- `touch-action: none` on the handles, so dragging on a phone doesn't scroll the page instead.
- framer-motion's `whileHover`/`whileTap` scale was dropped from the launcher: it writes its
  own `transform` and would have fought the drag offset every frame.

**Panel look.** Flat `ink-950` with a hairline ring became a warm gold radial at the head, a
cool mint one at the foot, a gradient top-edge hairline that reads as lit-from-above, and a
layered elevation shadow. The launcher gained a breathing halo. Both themes were **rendered and
looked at**, not assumed — the first light-mode render came back with unreadable text, which
turned out to be the *preview harness* hardcoding a dark-theme text colour rather than an app
bug; the harness was corrected and re-rendered before drawing any conclusion.
- Scoped to `.ai-surface` / `.ai-fab`. Nothing else on the site changes.
- Files: `next.config.mjs`, `src/shared/hooks/useSpeechInput.ts`,
  `src/shared/hooks/useDraggablePanel.ts`, `src/modules/ai/components/XyzAiWidget.tsx`,
  `src/app/globals.css`, `src/shared/utils/__tests__/permissions-policy.test.ts` (new),
  `speech-error.test.ts`.
- Checks: 553 tests, lint at the 36-warning baseline, build exit 0, route table untouched.
- **⌘K left alone at the owner's call** — `CommandPalette` keeps sole ownership of the chord.

---

## 2026-08-07 (40) — Voice input fixed and rolled out to six surfaces; AI panel visible in light mode and draggable

**(37) shipped voice input that didn't work in practice.** Reading the code back found three
causes, all of which look identical to a person: nothing happens.

- **`interimResults` was off.** Nothing appeared until the whole utterance was finalised —
  seconds of a lit-up button doing nothing visible. Live partials are the feedback that
  proves it is listening; they now stream into a line above the composer.
- **Every failure was swallowed.** A blocked mic, a missing mic, or Chrome's `network` error
  (its recognizer is a Google service, so it fails on restricted networks while the page
  itself loads fine) all just dropped out of the listening state silently. `speechErrorMessage()`
  now names each cause, and the panel shows it. **This is the fix that matters** — the other
  two are why it felt broken, this is why nobody could tell why.
- **Stopping discarded the result.** The toggle called `abort()`, which throws away the
  utterance. Pressing the button to finish dictating deleted what you had just said. `stop()`
  finalises; `cancel()` is now the only path that discards.
- **Rolled out to six surfaces** via a shared `<MicButton>`: XYZ AI, DM composer, community
  chat, ⌘K palette, news search, research search. The hook moved to `@/shared/hooks` since it
  is no longer AI-specific. Renders nothing where `SpeechRecognition` is absent (Firefox), so
  a dead button never ships.
- **⚠️ `MicButton` mirrors transcript/error to its parent in effects, not during render.** The
  first draft called `onInterim(...)` in the render body — the cascading-render shape the lint
  rule rejects, and the same mistake (37) already made once.

**Light theme: the assistant had no colour.** Its mint/gold surfaces are 6–25% alpha tints
designed against near-black; on white they wash out to nothing. Text was already handled
(`text-mint-200` etc. have light overrides) — the **tints** were not, except inside
`#ecosystem-orbital`. Fixed with a `.ai-surface`-scoped block. **Deliberately not global:** the
same tint classes are used site-wide against dark backgrounds, and lifting them everywhere
would be an unrequested restyle of every page.

**The panel is draggable** (`useDraggablePanel`), desktop only — on mobile it is near
full-width with nowhere useful to go. Offsets are stored **relative to the bottom-right anchor,
not as absolute coordinates**, so a saved position survives a resize or a different monitor,
and a restored position is clamped back into view on mount — otherwise a panel dragged to the
edge of a wide window would be unreachable on a laptop. A reset control appears once moved, so
it can always be recovered. Pointer Events cover mouse, touch and pen in one path.

- Files: `src/shared/hooks/useSpeechInput.ts` (moved + rewritten),
  `src/shared/hooks/useDraggablePanel.ts` (new), `src/shared/components/MicButton.tsx` (new),
  `src/shared/utils/__tests__/speech-error.test.ts` (new, 5 cases), `XyzAiWidget.tsx`,
  `MessagesClient.tsx`, `ChatClient.tsx`, `CommandPalette.tsx`, `NewsClient.tsx`,
  `ResearchGrid.tsx`, `globals.css`.
- Checks: route table identical (132/23/109/12), no cost patterns, 550 tests, lint at the
  36-warning baseline, build exit 0. Bundle +4 kB gzip per route (`/` 121 → 125) — the mic now
  ships on six surfaces rather than one.
- **Not verified live.** Voice, the light-mode palette and dragging all need a browser; I have
  no access to one. The three voice causes were found by reading, not by reproducing.
## 2026-08-07 (39) — A test that had been verifying nothing since #203

`realtime-channels.test.ts` guards one property: the channel-name module stays free of
imports, so a `"use client"` component can name a channel without dragging the server-only
env module into the browser bundle. That regression really happened (#189) and this test
is what stops it recurring.

It stopped working the moment #203 landed, and nobody noticed for a month.

- **The mechanism.** The test read `src/lib/realtime-channels.ts`. #203 turned that path
  into a one-line re-export shim — `export * from "@core/realtime/realtime-channels"` — and
  a shim contains **no `import` statements**, because it re-exports. So the test's
  `importLines` came out as `[]`, and both assertions ("has no imports at all", "imports
  nothing server-side") passed against an empty array. The file they exist to guard was
  never opened.
- **Proved, not assumed.** Adding `import { env } from "@/lib/env"` to the *real* module
  and running the **old** test: **3 passed**. The same perturbation against the new test:
  **2 failed**. That is the whole bug in two runs.
- **The fix is one path plus a guard.** It now reads
  `src/core/realtime/realtime-channels.ts`, and a new first assertion rejects a stale path
  three ways: content under 200 chars, a body that looks like `export * from`, or a missing
  `export const CH_SITE =`. Same role as
  `expect(creates.length).toBeGreaterThanOrEqual(6)` in `journal-activity-revocation.test.ts`
  — every other assertion in the suite is "this pattern does not appear", which an empty
  file satisfies for free.
- **Perturbations, all four behaving:** server-side import in the real module → 2 fail;
  path pointed back at the shim → the guard fires; path pointed at a nonexistent file →
  ENOENT, loud; restored → 4 pass.
- **The runtime import still goes through the shim on purpose.** The channel-name
  assertions are about values, so routing them through `../realtime-channels` also proves
  the shim forwards correctly — app code still imports from that path.
- **Swept the rest.** Every other source-reading test was re-checked against real paths:
  `markets-poll-alignment`, `password-change-revokes-sessions` (7 literal paths between
  them, all real code) and the two that glob `src/app/api/**/route.ts` — routes were never
  moved by #203, the glob matches 99 files, and both already carry anti-vacuous guards
  (`> 50` handlers, `>= 6` create sites). **`realtime-channels` was the only vacuous one.**
- Test-only: no route, cache, or runtime behaviour changes.

---

## 2026-08-07 (38) — `src/lib/ai/*` server modules now fail the build if a client imports them

Audit of the `src/lib/*` / `src/components/*` shim convention, prompted by the `markdown.tsx`
duplicate found in (36).

- **The `markdown.tsx` problem was a one-off, not a pattern.** 247 files checked: **212 are
  proper one-line shims, 35 hold real content, and exactly one other has a twin** —
  `src/lib/jsonld.tsx`. That one is the *inverse* case and harmless: `src/shared/utils/jsonld.tsx`
  is a shim pointing back at it, so there is one implementation and no dead copy. The
  direction is backwards from the convention; nothing is at risk. **No second dead-twin
  exists.** Recorded so nobody re-runs this hunt.
- **What the audit did find is worse and more useful: the coupling in `src/lib/ai/*` is
  transitive and invisible.** `gateway.ts` imports no prisma and no env — grep it and it reads
  client-safe. But `./usage` imports prisma, `./registry` imports server-only `env`, and
  `./cache` → `./kv` reaches storage. Three of its six imports drag the server in. That is
  exactly why `aiPlanFor` could not be imported by the widget in (37) despite `gateway.ts`
  looking clean, and it would have caught the next person the same way.
- **Fix: `import "server-only"` on the five genuinely server-only files** — `usage.ts`,
  `registry.ts`, `kv.ts`, `providers/gemini.ts`, `providers/groq.ts`. A client component that
  reaches any of them, however indirectly, is now a **build error naming the file**, instead of
  a runtime surprise or a silently bloated bundle. Same guard `env.ts` got in #189, same reason.
- **⚠️ The guard was proved to fire, not just assumed to.** Adding it left the build green,
  which on its own only shows nothing broke. So the violation was staged deliberately — the
  widget re-pointed at `@/lib/ai/gateway` — and the build **failed with exit 1** and a named
  `server-only` error. Then reverted. A guard that has never been seen to reject anything is
  not known to work.
- Still-open (not a defect, just incomplete migration): 34 files live only in `src/lib` /
  `src/components` with no twin — the whole `src/lib/ai/*` subtree and the marketing components
  (`Hero`, `Icons3D`, `Orbital*`, …). They are single copies, so nothing can drift; moving them
  under `modules/` is cosmetic and was left alone.
- Files: `src/lib/ai/usage.ts`, `registry.ts`, `kv.ts`, `providers/gemini.ts`, `providers/groq.ts`
  (one line each). Build exit 0, typecheck clean, 545 tests green.

---

## 2026-08-07 (37) — XYZ AI: page-aware suggestions, voice input, and an honest plan label

- **✅ (35)'s observable ran and passed on production.** `{status: 200, remaining: '2994',
  limit: '3000', plan: 'Admin'}` — all three `X-Ai-*` headers present, and no quota pill
  rendered, which is correct at 2994 remaining. Recorded here because a check that is
  defined but never run is worth nothing.
- **🐛 That same check exposed a real bug.** The console reported `plan: 'Admin'` while the
  panel's chip read **PLAN Premium**. `aiPlanFor()` returns `"Admin"` for a super admin or
  `role === "ADMIN"`, but the widget was reading `session.membership` — so an admin on the
  3000/day Admin allowance was told they were on Premium (300/day). Fixed by using the
  same function on both sides.
  - `aiPlanFor` had to move to `@shared/utils/ai-plan` first: `@/lib/ai/gateway` reaches
    prisma through the usage recorder, so a client component cannot import it. **Third time
    this session** that a pure helper needed extracting from a server module before the UI
    could use it (after `quotaLevel` and the markdown renderer).
- **Page-aware suggestions.** `pageSuggestions(pathname)` adds an "About this page" row above
  the general set: coin questions on `/markets/<id>`, article questions on `/research/<slug>`,
  plus journal/news/markets-index cases. Pure and derived from the path alone — no fetch, no
  new data dependency. `/markets/protocol/<type>/<slug>` is explicitly excluded from the coin
  branch, which would otherwise have produced "Explain Protocol's move".
- **Voice input** via the browser's own `SpeechRecognition` (webkit-prefixed on Safari,
  absent on Firefox). Zero cost, no dependency. Dictation lands in the composer rather than
  sending, so a misheard word can be fixed before it costs a request. The control is hidden
  entirely where the API is missing.
  - **⚠️ Support is read through `useClientFlag`**, not during render. Reading `window` in
    render is the hydration-mismatch class that caused this project's worst bug; the lint
    rule caught the first two attempts (ref-write-during-render, then setState-in-effect)
    before this landed on the sanctioned `useSyncExternalStore` path.
- **⌘K was left alone.** `CommandPalette` already owns ⌘K *and* `/`. Giving the assistant the
  same chord would have made two surfaces fight over it. Deferred pending a decision on
  putting an "Ask XYZ AI" entry inside the existing palette instead.
- Files: `src/shared/utils/ai-plan.ts` (new), `src/shared/utils/ai-page-context.ts` (new),
  `src/modules/ai/lib/useSpeechInput.ts` (new),
  `src/shared/utils/__tests__/ai-page-context.test.ts` (new, 9 cases),
  `src/lib/ai/gateway.ts`, `src/modules/ai/components/XyzAiWidget.tsx`.
- Checks: route table identical (132/23/109/12), no cost patterns, 545 tests green,
  lint back to the 36-warning baseline, build exit 0. Voice input and the contextual row are
  **not** verified live — both need a browser with a session.

---

## 2026-08-07 (36) — XYZ AI answers now show their sources, and can be copied, re-asked or read aloud

Follow-up to (35). Three additions plus one shared-renderer fix.

- **Sources under every answer.** New pure helper `extractSources()` reads
  `[Title](/research/slug)` citations back out of the answer and renders them as a chip
  row. **No prompt change and no extra tokens:** `buildAssistantSystemPrompt` already
  instructs the model to cite in exactly that shape, and `buildCorpus` already hands it
  the slug for every article. This only surfaces what was already being emitted — it just
  had to be spotted mid-paragraph before.
- **Copy · Regenerate · Read aloud** under each finished answer. Regenerate re-asks the
  last question with the disliked answer dropped. Read-aloud reuses the existing
  `pickVoice`/`stripMarkdown` helpers rather than duplicating the TTS handling.
- **⚠️ The regenerate trap.** `send()` gained an optional `base` history argument.
  `setMessages` is async, so calling it and then `send()` in the same tick would have had
  `send` rebuild the request from the *stale, pre-truncation* array — re-asking with the
  bad answer still in the history. Passing the truncated history explicitly is what makes
  it correct.
- **Internal links stopped opening new tabs.** `markdown.tsx` put
  `target="_blank" rel="noopener noreferrer"` on *every* link, so following a citation
  inside the AI panel spawned a tab. Now root-relative (`/…`) and in-page (`#…`) links
  navigate in place; external links keep the new tab and the rel guard. Pinned by four
  cases in `markdown-render.test.ts`.
- **🗂️ `src/lib/markdown.tsx` was not a shim.** It was a 113-line near-duplicate of
  `src/shared/utils/markdown.tsx`, differing only in one import path — and every consumer
  imported the `lib` copy, so the `shared` one was dead code. Left alone, the fix above
  would have landed in the unused file. It is now a real one-line re-export like
  `links.ts`, with the implementation in `shared/utils`. **Worth checking for elsewhere:
  the convention is not self-enforcing.**
- Streaming answers hold back their sources and tools until the stream ends, so nothing
  flickers mid-answer.
- Files: `src/shared/utils/ai-sources.ts` (new), `src/shared/utils/__tests__/ai-sources.test.ts`
  (new, 6 cases), `src/shared/utils/markdown.tsx`, `src/lib/markdown.tsx`,
  `src/lib/__tests__/markdown-render.test.ts`, `src/modules/ai/components/XyzAiWidget.tsx`.
- Not verified live: rendering and the TTS path need a browser with a session; only the
  pure helpers are unit-tested (536 tests green).

---

## 2026-08-07 (35) — XYZ AI: the daily budget is finally visible, and it warns before it blocks

The daily AI cap has been enforced server-side since `16_ai_limits` (`checkDailyLimit()`,
per-plan defaults, per-member admin override). It had **never been shown in the UI** — so a
member's only way to learn the limit existed was to hit it mid-task and get a red error line.

- **Progressive disclosure, not a permanent counter.** New pure helper
  `quotaLevel(remaining)` in `src/shared/utils/ai-quota.ts`: `hidden` above 10 left,
  `quiet` at ≤10, `warn` at ≤3, `blocked` at 0. A counter that is always on teaches members
  to ration a free tier, which works against the point of having one; a cap with no warning
  is worse. This shows the number only once it changes what you'd do.
  - Thresholds are **absolute, not a percentage**, so Free (25/day) and Premium (300/day)
    behave the same near the end. A 40% rule would have shown Premium members a counter at
    120 remaining, which is noise.
- **No new route, no extra request.** `/api/ai/assistant` now returns `X-Ai-Remaining` /
  `X-Ai-Limit` / `X-Ai-Plan` on both the streamed 200 and the 429. The widget learns the
  budget from the request it was already making, so the quota costs nothing to display and
  adds no polled endpoint.
- **The 0 state got a real design.** `LimitCard` replaces the composer rather than letting
  the send button fail: states the cap, states that it resets at midnight UTC, and offers
  `/premium` to Free members only. The reset time is always shown so the upgrade never reads
  as the only way out.
- **Shell redesign** (`XyzAiWidget.tsx`): gold brand avatar with a mint live dot,
  name-personalised greeting + plan chip, six iconed suggestions (two with subtitles, four
  compact) replacing three plain pills, and a clear-chat control.
- **⚠️ Two traps recorded.** (1) The pure helper lives in `@shared/utils/ai-quota`, **not**
  `@/lib/ai/limits` — the latter imports prisma and server-only `env`, so a `"use client"`
  file importing it is a build error. `limits.ts` re-exports it for server callers.
  (2) `readQuota` checks both headers are non-null *before* coercing: `Number(null)` is `0`,
  so reading them loosely would turn one missing header into a false "no budget left" and
  lock a member out of a working assistant.
- Suggestion subtitles describe what the assistant will do; they never assert data the
  client hasn't fetched (no "8 trades logged" without a trades fetch).
- Files: `src/shared/utils/ai-quota.ts` (new), `src/shared/utils/__tests__/ai-quota.test.ts`
  (new, 6 cases), `src/lib/ai/limits.ts`, `src/app/api/ai/assistant/route.ts`,
  `src/modules/ai/components/XyzAiWidget.tsx`.
- Not yet done: XP/streak in the greeting (not in the session — would need a fetch), and
  answer-level sources/copy/regenerate/read-aloud (planned as a follow-up).

---

## 2026-08-05 (34) — Changing a password now revokes sessions issued before it
Closes the one genuine vulnerability out of ten claims in an external auth report — which
ranked it **8th, as LOW**. (Both of that report's CRITICALs needed no work: `devCode` was
already double-gated on `NODE_ENV !== "production"` **and** `!emailEnabled`, and the
"no server-side password check" claim was simply false — both routes use `passwordSchema`,
which enforces 8 chars plus lower + upper + digit.)
- **The hole:** `api/auth/password/reset` rotated `passwordHash` and cleared the lockout,
  and touched nothing that would kill an already-issued JWT. `session: { strategy: "jwt" }`
  sets no `maxAge`, so next-auth's default **30 days** applied. Anyone else holding your
  session kept full access for up to a month after you reset your password — the one action
  a user takes specifically to lock that person out.
- **The fix:** `User.passwordChangedAt`, written by **both** password-write paths
  (forgot-password and the signed-in change), compared in the jwt callback against a
  `pwdAt` timestamp the token carries. Older token → the callback returns `{}`, the session
  callback returns an empty session, `getServerSession()` resolves to **null**, and every
  gate fails closed.
- **⚠️ The trap, recorded because it would have shipped silently.** `token.iat` is the
  obvious thing to compare against and **does not work**: next-auth re-encodes the token on
  every session read and `encode()` calls `.setIssuedAt()` with no argument
  (`next-auth/jwt/index.js:44`), so `iat` is refreshed to "now" constantly. A check against
  it compiles, reads correctly, and never fires. The plan for this change originally said to
  use `iat`; reading the library source before implementing is what caught it. The test now
  asserts the comparison uses `pwdAt` and not `iat`.
- **Deploying this signs nobody out.** `passwordChangedAt` is nullable and absent reads as
  0 on both sides, so the comparison is false for every existing user until they actually
  change a password.
- **Changing your own password signs you out too**, deliberately. Exempting the current
  session would mean trusting a request carrying the token to say which token it is — and
  the premise is that a token may be in the wrong hands.
- **Self-review caught two defects before merge**, both recorded because they are the
  interesting part. (a) The first draft put `passwordChangedAt` in **both** jwt-callback
  selects, including the P2022 fallback whose entire job is to work when the newest column
  is missing — so on a not-yet-migrated DB both selects would have thrown and the refresh
  would have stopped entirely. (b) The test's anti-`iat` assertion did not work: a
  perturbation swapping the comparison to `token.iat` **passed**, because `pwdAt` still
  appeared in a nearby comment. It now pins the derivation itself and strips comments
  before checking that `iat` is not load-bearing.
- **Known bounded window: up to 60 seconds, on every path.** The check lives inside the
  jwt callback's DB refresh, and that refresh is itself gated by `MEMBERSHIP_TTL_MS`
  (60s) — so a token that synced 5 seconds ago keeps working for another 55, server-side
  reads included. This is the same window that already bounds role, membership and
  permission revocation, and it is deliberate: the alternative is a DB read on literally
  every authenticated request. Against the 30 days it replaces, a minute is the point.
  (An earlier draft of this entry claimed server-side revocation was *immediate* and only
  the client lagged. That was wrong — recorded rather than quietly deleted, because
  "immediate" is exactly the kind of claim someone later builds a decision on.)
- Pinned by `password-change-revokes-sessions.test.ts`, proved against four perturbations:
  dropping the write from either path, putting the column *back* into the P2022 fallback
  select, making the session callback trust a revoked token, and swapping `pwdAt` for
  `iat`. The
  fail-closed assertion is **behavioural** — it calls the session callback directly, since
  that callback is pure.
- Route table unchanged at 131/22/109/12.

---

## 2026-08-05 (34) — Profile is centred in the bottom bar, and a full engineering review

### Bottom bar

Research came out of the mobile bottom nav. Four links plus the raised Profile
button is **five** cells, so Profile sits in the exact middle; with five links
it was cell 3 of 6 - visibly left of centre. Measured at 320/390/430: the
Profile cell centre and the bar centre are the same pixel (`offBy=0`).

Research was the one to drop because it is still reachable from the navbar's own
rail. `grid-cols-5` must stay equal to `ITEMS.length + 1` - that pairing is what
centres the cell, and adding a fifth link would silently push it off again.

### Engineering review

`docs/REPORT-2026-08-05-engineering-review.md` - a full review covering the
security architecture layer by layer, open bugs, process, teamwork and an
industry-readiness scorecard. Every figure in it was measured at `bae69a7` or
read from a live API; the section on what could **not** be verified is explicit
rather than omitted.

The three findings worth repeating here:

- **`main` has no branch protection** and two collaborators hold `write`.
  Verified via the API (`"protected": false`). The merge-ownership rule in
  `CLAUDE.md` is therefore a social control, not a technical one - and PR #252,
  an auth **and** schema change, was authored and merged by the same person the
  day this was written.
- **Sentry still has no DSN in any runtime**, so none of the above would page
  anyone.
- **CodeQL was removed because the repo was private. It is public again** -
  `"visibility": "public"` - so free static analysis is available and currently
  unused.

**Files:** `src/shared/components/BottomNav.tsx`,
`docs/REPORT-2026-08-05-engineering-review.md`, `docs/SUMMARY.md`,
`docs/changelog.md`.

---

## 2026-08-05 (33) — The navbar now fits the device it is on

Owner: *"iPad, iPhone and sabhi device me website ka nav bar and baki size fit
karo."*

### The desktop rail was showing 256px before it fit

The full nav rail appeared at `md` (768px) but needs **1089px**. On an iPad in
portrait that pushed the page **257px** wider than the screen - a real
horizontal scroll on every page.

Two moves, both measured:
- The rail switches at **`lg` (1024px)**, not `md`. Phones and iPad portrait get
  the hamburger + bottom bar, which is what they should have had.
- Per-link padding is `xl:` rather than `lg:`. At exactly 1024 - **iPad
  landscape** - the rail still needed 1089px and overflowed by 65px. Eight links
  x 8px buys that back.

That left **1px** at 1024 from decorative full-bleed layers (`.aurora` bleeds
-10% each side). `body { overflow-x: clip }` handles it - **`clip`, not
`hidden`**, because `hidden` makes the body a scroll container and would
silently kill every `position: sticky` on the site (markets table header, news
filter pills). Verified after the change that a sticky element still sticks.

### Result

Real symptom tested - not "is `scrollWidth` bigger", but **can the reader drag
the page sideways** - across 13 device sizes x 4 pages:

```
iPhone SE 320 · SE/8 375 · 12-14 390 · 15 393 · Pro Max 430 · Android 360
iPad portrait 768 · 810 · Air 820 · iPad landscape 1024 · iPad Pro 1112
laptop 1280 · desktop 1920
```

**No page scrolls sideways on any of them.** Before: iPad portrait +257px,
iPad landscape +65px.

### The Google-signup-opens-in-desktop-mode report: not reproduced

Owner also reported that after signing up with Google on a phone the site opens
in desktop mode until a manual refresh. **This is not fixed, because it was not
reproduced or explained.** What was ruled out:

- The usual cause is a missing viewport meta. It is **present and correct** on
  `/`, `/signup` and `/login` - `width=device-width, initial-scale=1`, from the
  single `viewport` export in `app/layout.tsx`.
- No layout anywhere is decided in JavaScript: no `userAgent` sniffing, no
  `innerWidth` branching. The mobile/desktop split is pure CSS, so a hydration
  timing gap cannot produce it.

There is no phone, no Google OAuth client and no way to run that flow here, so
anything further would be a guess dressed as a fix. The one thing worth checking
on the owner's side is whether the URL **after** the Google round-trip is the
same host as the one before it (apex vs `www`) - "Request desktop site" is a
per-host Chrome setting, and `next-auth` returns to `NEXTAUTH_URL`, not to
wherever the visitor started.

**Files:** `src/shared/components/Navbar.tsx`,
`src/shared/components/BottomNav.tsx`, `src/app/globals.css`,
`docs/changelog.md`.

---

## 2026-08-05 (32) — Sign out was unreachable on a phone, and the desktop hero was jammed against the header

Two things from the owner, with screenshots.

### 1. The mobile menu hid Sign out behind the bottom nav

The drawer was capped at `100dvh - 6rem`, which reserves room for the **header**
and nothing for the **fixed bottom nav**. So on a logged-in account the last
rows - the check-in line and **Sign out** - sat underneath that bar and could
not be tapped at all. The floating XYZ AI launcher (`fixed`, `z-[60]`, above
the menu) covered the check-in row on top of that.

Reproduced before fixing, then re-run after, by injecting the logged-in-only
rows into the drawer so the overflow path actually runs - the logged-out menu
is short and never overflows, so it proves nothing:

```
                     Sign out      bottom-nav top
before   412x915     844 - 894          855      under the bar
         360x740     669 - 719          687      under the bar
after    412x915     772 - 822          855      reachable
         360x740     597 - 647          687      reachable
```

The drawer now subtracts the bar (`3.5rem` + safe-area inset, per `BottomNav`)
from its own height and adds the same back as padding, so the last row scrolls
clear. The navbar sets `data-nav-open` on `<html>` while the drawer is open and
CSS hides `.ai-fab` - a DOM flag rather than shared state, because the launcher
is a sibling widget mounted by the layout with no component relationship to the
navbar.

### 2. The desktop hero was top-heavy

Measured at 1280x640: **20px** between the navbar and the eyebrow, but **54px**
of unused space below the stats strip, with internal gaps of 8-12px. The column
read as jammed under the header with dead space beneath it.

```
                    before   after
navbar -> eyebrow     20       32
eyebrow -> headline   10       14
headline -> lede       8       11
lede -> card          12       15
trust -> stats        12       16
space below stats     54       27
```

Two related corrections while measuring:
- **1440x780 had only 18px** of navbar clearance - tighter than the short-laptop
  path - because the grid's 76vh minimum is smaller than the content there, so
  there is no centring slack. The `lg` padding floor went 5rem -> 5.75rem.
- **The short-laptop rule's ceiling moved 700px -> 740px.** At 700 a 1440x720
  window fitted the strip by exactly **5px** - technically "visible" and far too
  fragile to ship, since browser zoom or a taller chrome erases it. At 740 that
  window gets ~107px of margin instead.

Every desktop height from 630 to 950 now clears the navbar and shows the strip.
Phone and tablet are unchanged.

**Files:** `src/shared/components/Navbar.tsx`, `src/app/globals.css`,
`docs/changelog.md`.

---

## 2026-08-04 (31) — The hero fits a short laptop, not just a wide one

Owner sent a desktop screenshot with the medallion clipped by the bottom of the
window: *"Jo hamara XYZCrypto wala circle hai usko thora uper karo taki adjust
ho jaye hero page desktop me."*

### The cause was a units mistake, not a spacing one

Every size in the hero was expressed as a **width** breakpoint, but on a laptop
the binding constraint is **height**. `lg:` is true at 1280px whether the window
is 630px tall or 1000px tall, so a very common laptop got desktop padding and a
desktop-sized medallion in a third less vertical space. Measured on 1280x630:

```
medallion   199 -> 711    81px past the fold, visibly clipped
stats strip 683 -> 767    137px below the fold
section height 937 in a 630px viewport
```

### Fix

Padding, medallion size and the 76vh minimum move into `globals.css` and become
viewport-height aware - `clamp()` on the padding, `min(<old cap>, 68vh)` on the
medallion, and the minimum dropped below 900px tall.

`min()` is the point: on any window tall enough it picks the **original** value,
so nothing changes on the screens that never had the problem.

```
                medallion       section height
              before  after     before  after
1280x630      512✂     428       937     834
1366x660      512✂     449       937     835
1440x780      512      512       937     846
1536x830      576      564       952     869
1920x950      576      576      1036     971
412  phone    272      272      unchanged
768  tablet   384      384      unchanged
```

✂ = clipped by the fold. Only genuinely short windows shrink.

### Two mistakes worth recording

**The first attempt changed nothing at all.** The Tailwind utilities were left
on the elements (`lg:max-w-md`, `sm:pt-32`, `lg:min-h-[76vh]`) and this CSS was
added alongside. Tailwind's utility layer is emitted *after* `globals.css` and
both are single-class selectors, so the utility won every time - the measurement
came back byte-identical, which is the only reason it was caught. Fixed by
giving each property exactly one owner rather than by raising specificity, which
would have worked and left a trap.

**The first tuning over-corrected.** At `54vh` the clipping stopped, but a
1920x950 monitor went from 576px to 513px - changing a screen that was never
broken. Re-derived to `68vh` from the measurements so large screens are
untouched.

### Second pass: the stats strip too

The owner came back with the same window and a sharper ask - the 50K+ strip
should be on screen without scrolling. That is the part the first pass had
explicitly left, so the copy column's rhythm now tightens below **700px tall**:
smaller headline, tighter block margins, slightly smaller lede.

The 700px ceiling is measured, not guessed. The strip was already fully visible
at 1440x780 beforehand, so tightening there would have shrunk the headline on a
common laptop to solve a problem it did not have.

```
              eyebrow top   medallion   stats bottom / viewport
1280x630          88          428          586 / 630   visible
1366x660          88          449          586 / 660   visible
1280x700          88          476          586 / 700   visible
1440x720          80          490          703 / 720   visible
1440x780          86          512          708 / 780   visible
1920x950         146          576          785 / 950   visible
412  phone        96          272          unchanged
768  tablet      128          384          unchanged
```

**A third mistake, caught in a screenshot rather than a number.** The first
tightening dropped the section's padding floor to 3.25rem. The navbar is fixed
and ~68px tall, so the eyebrow pill slid straight underneath it - every
numeric check still passed, because none of them looked at the navbar. The
floor is now 5.5rem, and the check script asserts `eyebrow.top > navbar.bottom`
at every viewport so it cannot regress silently.

### Pre-existing, not from this change

At **768px** wide the page overflows horizontally by 257px. Verified against
unmodified `main`: byte-identical (`scrollWidth 1025 / viewport 768`). It is the
**navbar** - its `md:` desktop layout activates at 768 and does not fit - and
has nothing to do with the hero. Left alone rather than widening this change.

**Files:** `src/components/Hero.tsx`, `src/components/HeroCta.tsx`,
`src/app/globals.css`, `docs/changelog.md`.

---

## 2026-08-04 (30) — DMs can finally reach a phone: the opt-in was missing, not the push

Owner: *"DM me message karne pe kisi ko notification mobile me nahi milta hai,
jaise chat me hota hai waise hi DM me bhi chaiye ... taki notification se bhi
chat kar sake."*

### The sending half was never broken

Traced the whole path before changing anything, and `POST /api/dm/[id]` already
does all of it: it looks up the **recipient's** push subscriptions, sends a
private payload (`💬 <sender>` + snippet, or `📷 Photo` for an image), tags it
`dm-<conversationId>` so repeat pings collapse, prunes dead endpoints, and
deep-links to `/messages?c=<id>` - which `MessagesClient` honours via
`search.get("c")`. The service worker's `push` handler is generic and renders it
fine. It even lacks the lounge's 5-minute anti-spam window, so it pushes on
*every* message.

### What was actually missing

**Nothing on the DM surface ever asked for permission.** Web Push is per-device
and opt-in, and the only two places to turn it on were the **News page** and the
**community lounge**. A member who lives in their inbox was never subscribed, so
`findMany({ where: { userId: recipientId } })` returned zero rows and the push
was a silent no-op. That is exactly why chat pinged and DMs did not: the lounge
had the switch, `/messages` did not.

Fix: the same `NewsAlertsToggle` the lounge uses now sits in the Messages
header, worded for DMs. One permission grant covers both - it is one browser
subscription, not a per-feature one.

### "Notification se bhi chat kar sake"

The tap target needed work too. `notificationclick` only focused a window whose
URL already *contained* the target, and otherwise called `openWindow`. A phone
sitting on any other page therefore matched nothing, and on an installed PWA
that could surface a second copy of the app rather than the conversation. It now
falls back to `client.navigate(url)` on an open window before opening a new one,
so tapping a DM alert lands **in that thread**, ready to reply.

### Stated plainly

This machine has no VAPID keys, no database and no phone, so the end-to-end
delivery was **not** exercised here. The diagnosis is code-level: the dispatcher
was already correct and complete, and the opt-in surface was absent. The owner's
own evidence supports it - lounge pings arrive, so VAPID is live in production.

**Files:** `src/modules/messages/components/MessagesClient.tsx`, `public/sw.js`,
`docs/changelog.md`.

---

## 2026-08-04 (29) — Members' check-ins are visible on a phone, not just on a desktop

Owner, with a screenshot of the dashboard Members tab on a phone: the members'
daily check-in should be visible there too, *"desktop me sahi h but mobile me
bhi kardo."*

The Check-ins column was `hidden ... lg:table-cell`, so it only ever appeared at
1024px and up. On a phone the data was not merely cramped - it was not rendered
at all.

### Why the column was not simply un-hidden

That table already scrolls sideways on a phone (`min-w-[340px]`, and the owner's
screenshot shows the email column clipped at the left edge). A fifth column
would have pushed Membership and Action further off-screen to surface one more
field - trading one hidden thing for two.

Instead the same `CheckinCell` rides along **inside the Member cell**, under the
name and handle, and only below `lg`:

```
              < lg                 >= lg
inline cell   block                none
Check-ins col none                 table-cell
```

Never both, never neither - verified at 412px and 1280px against the real
compiled stylesheet.

### Verifying an admin-only page without an admin session

The dashboard needs a database and an ADMIN session, neither of which exists on
this machine, so it cannot be opened locally. Rather than ship the change
unseen, the row markup was rendered in a standalone page **linked against the
build's own compiled CSS** (`.next/static/chunks/*.css`), which makes the
responsive classes real rather than assumed. That checks the visibility logic
and the layout; it does not exercise the live data path, and the fonts differ.

**Files:** `src/modules/dashboard/components/DashboardClient.tsx`,
`docs/changelog.md`.

---

## 2026-08-04 (28) — The hero lede no longer strands its last words on their own line

Owner sent a phone screenshot with the headline and lede circled: *"text ko
align karo taki poora text sahi se dikhe naki 2 line niche."*

Measured the line boxes rather than eyeballing it, and the complaint was exact.
At a 412px viewport the paragraph wrapped to:

```
line widths   371  369  361   89     <- column is 372px
```

Three lines running the full column edge to edge, then **"and builders." alone
at 89px**, floating in the middle of an otherwise solid block. That orphan is
what the circle was around.

### Fix

One class: `text-balance` on the lede. The browser distributes the text evenly
across its lines instead of filling greedily and dumping the remainder:

```
                  before                after
360px      266 311 313 300       266 311 313 300   (was already fine)
390px      336 335 280 239       266 311 313 300
412px      371 369 361  89       266 311 313 300
430px      371 369 361  89       266 311 313 300
```

Desktop benefits too - the paragraph drops from four ragged lines to three even
ones (443 / 498 / 486).

Deliberately `text-balance` and not `text-pretty`: `pretty` only pulls the final
orphan up and leaves the rest greedy, which fixes the symptom on one line.
`balance` evens every line, which is what "poora text sahi se dikhe" asked for.
Unsupported browsers just fall back to normal wrapping, so there is nothing to
gate.

The headline was circled too but needed nothing: it carries an explicit `<br>`,
so its two lines are already fixed by hand.

**Files:** `src/components/Hero.tsx`, `docs/changelog.md`.

---

## 2026-08-04 (27) — The homepage was not slow to arrive, it was slow to become visible

Owner: *"website openning is slow and lagging somehow ... check properly and
then fix."* Measured first, on a clean production build, at three CPU profiles.

### What the measurement found

The page was painting its background at ~700ms and then showing **nothing
readable for seconds**. Cause: framer-motion's `initial={{ opacity: 0 }}` is
serialised into the SSR HTML as `style="opacity:0"`, so the element is invisible
until the bundle downloads, parses, hydrates and runs its first frame.
**73 elements shipped at opacity 0**, including the entire hero. LCP - the hero's
lede paragraph - landed at 4420ms on a 4x-throttled phone and **7756ms on a 6x**.

This is the rule `CLAUDE.md` already states - *never make content depend on JS to
become visible* - and the hero was the one place still breaking it.

Two smaller findings, both measured:
- **The RSC prefetch storm.** Every nav route was prefetched 4-5x per load,
  because the navbar, the mobile menu, the footer and the bottom nav each render
  the same links. **37 prefetch requests** on one homepage view.
- **Eager below-fold images.** `BrandLogo` rendered a plain `<img>` with no
  `loading` attribute, so the preload scanner fetched the two ecosystem logos
  (122KB) at ~110ms - ahead of the hero, from far below the fold.

### What changed

Hero entrance animations are now **CSS keyframes** (`.hero-rise`, `.hero-word`,
`.hero-pop`, `.hero-fade` in `globals.css`). Same motion, same curves, but they
start at first paint instead of after hydration. `prefetch={false}` on the nav
chrome (hover still prefetches, so navigation feels the same). `loading="lazy"`
on `BrandLogo`.

### Results (clean builds, CSS-applied gate on every run)

```
                    desktop 1440   mobile 412    budget 390
                       (CPU 1x)      (CPU 4x)      (CPU 6x)
LCP      before          2820          4420          7756
         after           1364           804          1804
requests before            97            84            51
         after             64            58            55
RSC prefetch before        37            30             8
             after         11            11            11
```

### What is NOT fixed, stated plainly

**Total Blocking Time barely moved**: 1180 → 1093ms at 4x, 3265 → 3107ms at 6x.
The page now *appears* fast and is still *busy* afterwards. That cost is React
hydrating a 2595-node tree from a 411KB JS bundle, and none of the three fixes
here touch it. Making the page genuinely smooth on a budget phone means
deferring below-fold client components, which is a real refactor and its own
piece of work.

### One process note worth keeping

The first version of these numbers was **wrong and looked spectacular** - LCP
344ms. Repeated builds had left `.next` mixed, so the served HTML referenced a
stylesheet hash that no longer existed; the page rendered unstyled, which is
very fast. The measurement harness now asserts the stylesheet applied (>500 CSS
rules and a real border colour on `.hero-cta`) before reporting anything, and
every number above comes from `rm -rf .next` + full rebuild. A perf result that
looks too good is usually measuring a broken page.

**Files:** `src/app/globals.css`, `src/components/Hero.tsx`,
`src/components/HeroCta.tsx`, `src/shared/components/BrandLogo.tsx`,
`src/shared/components/Navbar.tsx`, `src/shared/components/Footer.tsx`,
`src/shared/components/BottomNav.tsx`, `docs/changelog.md`.

---

## 2026-08-04 (26) — The hero's live band is gone

Owner: *"no need live one in hero section"*. The scrolling band of research
titles is removed from the hero card. The card itself stays.

### What the card keeps

The two facts the band actually proved are still there, as one quiet sub-line:
**how many reports exist** and **how recent the newest one is** (`5 reports ·
newest 2h ago`). Both are still real rows, still server-rendered, still
refreshed by the `revalidatePath("/")` the research write routes already call.
So publishing a post still updates the card immediately - that behaviour did
not depend on the band.

What went: the `NEW`/`LATEST` badge, the blinking live dot, the marquee, and
the panel they sat in.

### Dead code went with it, deliberately

Removing a feature and leaving its support behind is how a codebase collects
things nobody can explain later. So these went too, in the same commit:

- `.hero-feed`, `.hero-feed::before`, `.hero-feed-track`, `.hero-feed-mask`,
  `.hero-badge-new`, `.hero-cta-blink` and the `hero-feed`/`hero-bloom`/
  `hero-blink` keyframes (`globals.css`)
- `research-freshness.ts`, its `src/lib` shim and its 7 tests - the freshness
  gate existed only to decide whether the band's badge could honestly say
  `NEW`, and nothing else consumed it. Test count moves 522 → 515.

Both files keep a one-line note saying the band was here and where it went, so
the next reader is not left wondering why the CSS block is named after a card
that has no band.

### One cost trim that came free

`page.tsx` fetched **twelve** research rows to fill the band. With the band
gone it reads exactly one - `findFirst` with `select: { createdAt: true }` -
because eleven rows nobody renders are just payload. The count query is
unchanged.

### Verification

```
                360      412      1440
card     x/w    20/320   20/372   92/580
headline x/w    20/320   20/372   92/630
scrollWidth     360      412      1440    (no horizontal overflow)
band present    false    false    false
```

Checked in **both themes**. Route table unchanged at **131 / 22 static / 109
dynamic / 12 ISR**, `/` still `○` on a 5m window.

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 515/515 tests ✅ ·
build ✅

The populated sub-line (`5 reports · newest 2h ago`) was verified by
temporarily stubbing the two values, screenshotting both themes, and reverting
the stub - this machine has no database, so the live render exercises the
`.catch()` fallback path (`0 reports`) instead.

**Files:** `src/components/HeroCta.tsx`, `src/app/page.tsx`,
`src/app/globals.css`, deleted `src/shared/utils/research-freshness.ts` +
`src/lib/research-freshness.ts` + `src/lib/__tests__/research-freshness.test.ts`,
`docs/changelog.md`.

---

## 2026-08-04 (25) — Write down who is allowed to merge

Docs only, no code. `CLAUDE.md`'s "Branch / deploy model" now states the owner's
standing rule: **only PRs authored by `xyzcrypto` get merged; a team member's PR
is never merged, and an ambiguous ask gets a warning first rather than a merge.**

It was said in a session and lived only there, which means the next session (or
the same one after a context reset, or a different account) would not have known
it. A rule that only exists in a chat is not a rule the repo has. The wording is
deliberately specific about the failure mode it prevents: "merge the open PRs"
reads as *all* of them, and a green trivial PR from someone else is exactly the
one that gets merged on autopilot. Check `user.login`, every time.

**Files:** `CLAUDE.md`, `docs/changelog.md`.

---

## 2026-08-04 (24) — The hero CTA is a research card, and the feed is our own posts

Owner's brief, over several rounds: the hero's mint pill "AI feel" wala lagta
tha; replace it with the card layout from their reference, show our own research
posts live with a scrolling feed, and make the trust line small.

### What changed (only these three blocks)

The two stacked buttons and the separate trust sentence are gone. In their place:
a research card, one secondary row, and a quiet trust line. Everything above
(eyebrow, headline, lede) and below (live stats) is untouched.

The card carries a `NEW LIVE` flag and a marquee of **our own published research
titles, newest first** - titles only. The newest one is emphasised and holds
still for 2.8s before the band starts moving, because a headline already
mid-slide on arrival announces nothing.

### Why the feed is server-rendered and not polled

Both research write routes already call `revalidatePath("/")`. Publishing a post
therefore regenerates the homepage **at once**, so rendering the titles on the
server beats a poller on every axis: the update is immediate rather than up to
one interval late, and it adds no route, no request and no timer.

Route table after: **131 / 22 static / 109 dynamic / 12 ISR** - identical to the
baseline in the `cost-check` skill. `/` is still `○` on a 5m window.

### The layout bug this design kept hitting, and the fix

The hero's text column is a **grid item**, so it carries the default
`min-width: auto`. Any in-flow descendant with a wide max-content size grows the
column and drags the site's own headline with it. Measured while building:

```
                                   column width @412px
baseline                           372
live-price row on the card line    420   (+48)
5-post marquee, in flow            3036  (+2664)
sub-line with nowrap, @360px       364   (+44)
```

`overflow: hidden` on the wrapper did **not** stop the marquee - only taking the
track out of flow does, because an out-of-flow box contributes nothing to
intrinsic sizing. So `.hero-feed-track` is `position: absolute`, and that is
load-bearing rather than styling: no number of published posts can widen the
hero. Separately, `min-width: 0` does not zero a *block* child's min-content
contribution - `overflow: hidden` does, which is what the sub-line needed.

Two of those three were found by bisecting element-by-element after guessing
twice and watching the bug move rather than go away.

### Guests keep their signup path

The old hero gave logged-out visitors "Get early access". The reference design
only had "View products", and silently dropping the signup CTA would have been
an unflagged conversion change - so the secondary row switches: guests get
signup, members get products.

### Verified in a real browser

```
                360      412      1440
headline x/w    20/320   20/372   92/630
card     x/w    20/320   20/372   92/580
scrollWidth     360      412      1440    (no horizontal overflow)
feed titles     real rows from the DB, newest first
```

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 515/515 tests ✅ ·
build ✅


### Follow-up (same day): 3D icons, a pinned "NEW", and the light theme

Owner reviewed the preview and asked for five things. All five landed:

1. **Every icon is now from the project's own `Icons3D` set** - the research
   magnifier, the products stack, the crown on the guest CTA, and the shield /
   lock / people on the trust line. That means the same gradient-body + gloss +
   drop-shadow depth and the same always-on `i3d-*` signature motion as the rest
   of the site, rather than a second, slightly-different 3D language invented
   here.
2. **The band is split in two.** The newest post is **pinned and static** behind
   a `NEW` badge so it reads as "this one just went live"; everything already
   published scrolls beneath it. Previously the newest title scrolled away with
   the rest.
3. The guest row's icon was the **same green shield** as "Free to join" two
   lines below it. Now a crown - membership, not another safety claim.
4. **Light theme.** The card, the band, the icon's glow pool and the row hover
   each get their own light recipe rather than a lighter opacity of the dark
   one; a mint tint that reads as a premium panel on near-black goes sickly on
   white. Verified at 412 and 1440 in both themes.






### Follow-up 6: colour discipline

Owner asked for a best-in-class colour combination. The problem was not which
colours - it was **how many**. A single card was carrying four hue families:
mint, gold, amber and violet, with the loudest of them (a three-colour trust
line) on the block that is supposed to be the quietest.

Fixes, all subtraction rather than addition:

- **The research icon dropped from three families to two.** Its star was amber
  against an emerald card and a gold lens; at 48px a third family reads as
  confetti, not as a system. The star is gold now: emerald is the data, gold is
  the instrument, and that is the whole story.
- **The trust line stopped shouting.** 22px saturated icons became 18px at 68%
  opacity, returning to full colour only on hover. The 3D character survives;
  the colour parade under an already-green card does not.
- **The secondary row's icon shrank** (36 -> 32) so the card keeps the only loud
  voice in the stack.
- **Greens deepened out of neon.** On a near-black ground, restraint in
  saturation is what reads as expensive: the card wash went from a bright mint
  tint to a deep emerald one, and the action button from `#48e5aa -> #0bbb7c` to
  `#3ddda0 -> #059669`.
- **The band went nearly neutral.** It was green-on-green, which muddied the
  titles sitting on it. Now near-black ink with the green kept to a hairline and
  a faint bloom - the text is what should be read, not the panel.

Boldness is spent in exactly one place now: the round action button. Everything
around it is quiet. Both themes re-checked.

### Follow-up 5: the band is back, gated and with a proper surface

Owner asked for option A after all: the live band, with accurate data, and new
posts showing up straight away.

**The freshness gate ships this time.** `research-freshness` (7 unit tests) is
what stops the card claiming a 29-day-old report is `NEW`:

| newest post | badge | live dot |
|---|---|---|
| 3h old | `NEW` (lit mint pill) | blinking |
| 29d old | `LATEST` (quiet outline) | off |

Both states were checked against a real render by ageing the local rows, not
by reading the code.

**"Realtime" here is stronger than polling, not a compromise.** Both research
write routes already call `revalidatePath("/")`, so publishing regenerates the
homepage immediately - a poller would surface the same post up to one interval
*later*, and would cost a route, a request per visitor and a timer. Route table
after: **131 / 22 / 109 / 12**, `/` still `○` on 5m.

**The band's surface got a body.** It was one flat translucent rectangle, which
read as a hole punched in the card rather than a panel inside it. Now: a
top-lit gradient, a 1px highlight along the top edge (light falls from above
everywhere else on this site), and a slow mint bloom drifting behind the text so
the strip looks alive between scroll cycles. The `NEW` pill got its own gradient
and inner highlight so it reads as lit rather than as a flat swatch. Light theme
has its own recipe for all of it.

### Follow-up 4: the newest post's age is back

Owner asked whether the count is real, whether it updates, and whether the last
post's time could show too. Answers, verified against the code rather than
recalled:

- **Real.** `prisma.post.count({ published: true, category: "Research" })` -
  their live count genuinely is 5.
- **Updates twice over.** Publishing calls `revalidatePath("/")` from both
  research write routes, so the homepage regenerates immediately; otherwise the
  300s ISR window catches it.
- **Time added back:** the card now reads `5 reports · newest 29d ago`. One
  extra `findFirst` (one row, `createdAt` only), running in the same
  `Promise.all` as the count, so no added round trip.

Still server-computed and passed down as a finished string. A relative time
derived during a client render disagrees between the server and the browser's
first paint, which is the #418 class this site has already been bitten by.

Flagged once for the record: with nothing published for a month, this line
states that on the homepage. That was the owner's call after the freshness gate
was built and shown; it is honest, just not flattering.

### Follow-up 3: the research band came back out

Owner asked what "newest 29d ago" meant, and whether the band should go. The
honest answer to the first question exposed a defect in the second: the card was
badging a **29-day-old** report as `NEW`, with a blinking live dot. A visitor who
clicks that finds nothing new, which costs more trust than the badge buys.

A freshness gate was built first (`NEW` only inside 7 days, `LATEST` after; the
age label hidden past 14 days) and verified against the owner's real case by
ageing the local posts to 29 days: badge fell back to `LATEST`, the dot stopped,
`newest 29d ago` disappeared. Owner then chose to drop the band entirely, which
is the simpler call while publishing is infrequent.

So the band, the marquee, the freshness module and its 11 tests all came out
rather than being left dormant - dead code with passing tests is worse than no
code, and this is all recoverable from **dfa6249**. The card is now the icon, a
title, `N reports`, and the arrow.

The 12-row title query went with it; the homepage now only counts.

### Follow-up 2: a real research emblem, and one right edge on desktop

**The icon was still a search glyph.** A lone magnifier says "search", not
"research". `ResearchLabIcon` is new in `Icons3D`: an emerald report card with
three ticking bars, a gold magnifier held over its corner, and an amber star for
the thing the lens found. Two palettes on purpose - emerald is the data, gold is
the instrument - and three independent `i3d-*` motions (tick, scan, twinkle) so
it reads as working rather than decorated. It stays inside the project's own 3D
language: same gradient body, gloss and drop shadow as every other icon in the
set.

**Desktop had three right edges in one column.** Measured at 1440 before:

```
lede    576
card    580
stats   512   (max-w-lg)
```

Three widths stacked vertically read as ragged no matter how good each block is.
The lede and the stats strip now both take the CTA stack's 580px, so everything
below the headline shares one left edge and one right edge. The headline itself
stays wider (630) - it is `whitespace-nowrap` on lg and is meant to be the one
element that breaks the grid.

Verified after: eyebrow / lede / card / row / stats all report x=92 at 1440,
x=32 at 1280, x=260 at 1920.

### The CSS rule this cost two wrong fixes to learn

`overflow: hidden` zeroes the automatic minimum of a **flex item**. It does
**not** do the same for a plain **block**: min-content stays at the full width
of the nowrap text, and the hero's own column (a grid item, `min-width: auto`)
grows to fit it.

```
                                    column @360px
baseline                            320
pinned title, as a block            367
  + overflow-hidden on the row      369   (no effect)
  + badge inlined into the title    367   (no effect)
  + grid-cols-[minmax(0,1fr)]       320   (fixed)
```

Two fixes that "looked right" moved nothing, because they applied a flex rule to
a block. A `minmax(0, 1fr)` grid track is what actually bounds it.

Route table re-checked after the change: **131 / 22 / 109 / 12**, `/` still `○`
on 5m.

**Files:** `src/components/HeroCta.tsx` (new), `src/components/Hero.tsx`,
`src/app/page.tsx`, `src/app/globals.css`.

---

## 2026-08-04 — Retire the cross-region framing everywhere it was still stated as current
Docs and comments only. #210 co-located functions with Supabase in `bom1`, so the
~250ms-per-query penalty that shaped a lot of earlier performance advice is gone. This
sweeps the repo for places still asserting it as present-tense fact.
- **Swept every file** for `iad1` / `us-east` / `cross-region` / `250ms` / "US region".
  Two hits in `tailwind.config.ts` (a `250ms` duration token) and `src/lib/ai/gateway.ts`
  (a backoff interval) are unrelated false positives; one in
  `docs/AUDIT-2026-08-02-responsive.md` is the word "region" in a layout sense.
- **Two live source comments fixed.** `tools/share/points-value/[id]/page.tsx` justified
  its `cache()` with "~250ms of pure round trip paid twice … from a US Vercel region",
  and `PointsValueCalculator.tsx` described the share-row write as going "to Supabase in
  Mumbai from a US region". **Both kept their code** — halving a query count and painting
  a placeholder are right on their own merits — but the reasoning now says so instead of
  leaning on a penalty that no longer exists.
- **The important distinction, since it is easy to over-correct:** Supabase is *still* in
  Mumbai. What changed is that functions are there too. Comments reading "round trip to
  Mumbai" (in `challenges/[id]`, `posts/[id]/like`, `chat/messages`, `chat/presence`) are
  **still accurate** and were deliberately left alone — they describe work that was
  removed, and a removed query stays removed regardless of distance.
- **`docs/PERFORMANCE.md` banner-ed.** Dated 2026-06-27, **not linked from
  `docs/SUMMARY.md`**, and at least one claim is now false — it says `/research/[slug]`
  is ISR at `revalidate=60`; it is **300**. Rather than rewrite a dated snapshot, it now
  opens with a verify-before-acting banner pointing at the maintained sources.
- **`docs/AUDIT-2026-08-01-latency.md`**: one remaining unqualified "Mumbai→`iad1`" inside
  finding #5's body now carries an inline marker, so a reader landing mid-document does
  not take it as current. The doc's top banner and per-finding re-assessment were already
  in place from #237.
- **`docs/changelog.md` deliberately untouched.** It records what was true on each date;
  rewriting history is the worse error. This entry is the correction.

---

## 2026-08-04 (23) — The profile header now has one left edge

Owner sent a phone screenshot: "profile ka overall jo buttons hai like,
following, followers and baki sabko acche se align karo". The complaint was
alignment, and measuring it showed the complaint was literally true.

### What was actually wrong

The header was four stacked rows that each started at a different x, because
some of them lived inside the name column (indented past the avatar) and the
rest lived in the card. Measured at 412px wide:

```
badges      x = 149     <- inside the name column
bio         x = 37
buttons     x = 37
counts      x = 149     <- inside the name column
```

Two left edges, alternating. On top of that:

- **Followers / Following were two separate bordered pills.** Side by side they
  are wide enough to wrap the name column on a phone, which is what turned them
  into two tall stacked rows eating most of the header.
- **The three action buttons were three different heights** - Edit sized itself
  `text-[13px] py-1.5` (30px), Message `text-sm py-1.5` (32px), share `h-9`
  (36px). Three buttons in a row, none of them the same height.
- **Follow wrapped onto its own line.** The counts strip (219px) + gap + Follow
  came to 381px against 375px of usable card, so it broke and hung off the
  right edge looking like a mistake.

### What it is now

Identity (avatar, name, handle) with the actions pinned top-right on desktop and
dropping to their own full-width bar on a phone. Then badges, bio, chips and the
counts - every one of them on the card's own left edge, 37px, no exceptions.

Followers / Following became one segmented control rather than two pills, so the
pair reads as a single object and fits one line at 360px. Follow goes full-width
under it on a phone (it does not fit beside it, and a full-width primary action
looks deliberate where a wrapped one does not) and returns to the end of the
strip's line from `sm` up. The three action buttons are all `h-9` now.

The counts moving to the bottom of the card is not only about alignment: it puts
them directly above the Posts / Comments / Likes cards, so all the numbers on
the page sit together.

### Measured, not eyeballed

```
                    before            after
badges x            149               37     (= bio, buttons, counts)
counts x            149               37
button heights      30 / 32 / 36      36 / 36 / 36
Follow at 412px     wrapped, ragged   full-width, aligned
```

Checked at 360 / 412 / 1440.

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 515/515 tests ✅ ·
build ✅

**Files:** `src/app/u/[username]/page.tsx`,
`src/modules/profile/components/ProfileFollow.tsx`,
`src/modules/profile/components/EditProfileButton.tsx`,
`src/modules/profile/components/MessageButton.tsx`,
`src/modules/community/components/CopyLinkButton.tsx`.

---

## 2026-08-04 — Correct stale docs and skill facts; restore a followable bundle method
Docs, comments and one dev script. No behaviour change. Every claim was re-verified
against current `main` (`59dddbf`) after #203 moved 521 files, not against the tree the
original report was written on.
- **`cost-check` pointed at a file that does not exist.** Its bundle method said to read
  `.next/app-build-manifest.json`; **Turbopack never emits it**, so the instruction was
  unfollowable and bundle size went unchecked while the skill read as though a method
  existed. Added `scripts/bundle-report.mjs`, reading the per-route RSC manifests
  Turbopack *does* emit, plus a recorded baseline and how to read it.
- **`cost-check` route baseline was stale:** 124/22/102/12 (measured at `2f34b83`) →
  **131/22/109/12**, the seven new dynamic routes being the DM-safety work in #227–#231.
  Its ISR table also still said `/api/ticker` 1m; it is **180s** since #207.
- **`cost-check` repeated the false `env.ts` claim** ("has no `import "server-only"`").
  #189 fixed that. Corrected in the same pass — this is the second copy of that claim,
  and correcting one while leaving the other is how the drift started.
- **`CLAUDE.md` carried the same stale `env.ts` claim.** Corrected. The *other* half of
  that sentence was re-verified **still true** and deliberately kept: the zod result is
  only logged and `process.env` is re-read directly, so `.url()`/`.min(16)` gate nothing.
- **`CLAUDE.md` "Current state" was a dated narrative** predating ~48 merged PRs, whose
  "three open OWNER actions" list said a resolved item was still open. Reduced to a
  standing summary plus pointers, and it now flags the two things a returning reader
  trips over: the `src/lib` re-export shims left by #203, and the Mumbai move.
- **`docs/HANDOFF.md §7` stopped at 2026-07-24/25.** Added both missing sessions.
- **`docs/component-registry.md` listed 6 API routes against 131 built ones** and called
  the ticker 10s (it is 180s). Replaced the route/page/lib enumerations with a pointer
  table at authoritative sources; kept the component tables, which describe reuse intent
  that no build output can produce.
- **`docs/AUDIT-2026-08-01-latency.md` was premised on a constraint that #210 removed.**
  Functions now run in Mumbai with the database, so the ~250ms-per-query gap the audit
  ranked everything around is gone. Rather than rewriting it, added a superseded-in-part
  banner with a per-finding re-assessment: two already fixed (#3, #4), one obsoleted
  (#11), one reclassified (#1), one being fixed (#9), five surviving on non-latency
  grounds. The lesson recorded alongside it: findings that *remove work* survived the
  change, findings that only *reorder work around a penalty* did not.
- **Not changed:** `src/core/auth/auth.ts` — the false "routes always re-check DB anyway"
  comment was already corrected on `main` at line 320. Verified, left alone.
## 2026-08-04 — Cover /api/ticker in the poll/window alignment test
Test only. No behaviour change - `/api/ticker` keeps the 180s/180s/300 that #207 set.
- **Why:** #207 fixed the ticker's 60s-window-against-a-150s-poll by hand, after an
  audit found it. Nothing in the suite would have caught it, and nothing would catch
  it coming back: this test only ever globbed `src/app/api/markets/*`. The ticker's
  poll lives in its own hook rather than at a `usePolledJson` call site, so the glob
  could not see it by construction.
- **What changed:** the file now drives off an explicit `TARGETS` list - six markets
  routes plus the ticker - and reads each route's poll from the file it actually
  lives in (`modules/markets/lib/useTickerPoll.ts` for the ticker). Adding a polled
  route means adding it there.
- **Deliberately reads the real modules, not the `src/lib` / `src/components` shims**
  left by #203. A shim is a single `export * from` line; pointing the test at one
  would make every regex match nothing and the suite would pass while checking
  nothing. The empty-parse guard now also rejects a target whose poll failed to parse.
- **Falsification proved, not assumed:** with the ticker temporarily reverted to its
  pre-#207 values, 2 of 6 assertions fail and both name the ticker and cite
  `useTickerPoll.ts`. Restored to 180/180/300 afterwards, byte-identical to `main`.
- ✅ **VERIFIED ON PRODUCTION 2026-08-04.** The `pre-merge` rule is that a defined
  check which is never run is worth nothing, so here is the run. Owner fetched
  `/api/ticker` every ~10s from the live site and logged `x-vercel-cache` + `age`:

  ```
  age  51 … 147 … 157 … 167 … 177   HIT     ← 13 consecutive HITs above 60
  age 188                            STALE   ← expires here
  age   9                            HIT     ← regenerated
  ```

  **Both falsifiers came back negative.** `age` did not reset at ~60-70 (which would
  mean the edge was still on the pre-#207 window), and the entry did not go `STALE`
  before `age` reached 150 (which would mean every poll still regenerated). Expiry
  brackets between 177 `HIT` and 188 `STALE` at a ~10.5s sampling interval — i.e.
  **180s, the `s-maxage`**, confirming trap 0 once more: the edge tracks the header,
  not `export const revalidate`.
  - The `STALE` → `age 9` step is correct `stale-while-revalidate=300` behaviour, not
    a glitch: the stale body was served immediately and refreshed in the background.
  - **Effect:** the 150s poll now lands on a fresh cache instead of forcing a
    regeneration. Under continuous traffic that is roughly **1440 → 480
    regenerations/day** for this route — ~960 fewer ISR Writes/day, plus the
    CoinGecko fetch, `JSON.parse` and origin→edge transfer each one carried.
  - **Scale honestly:** real but modest against a 200k/month quota. The `/news`
    pipeline (29 RSS data-cache entries on a 90s window) remains the dominant term.

---

## 2026-08-03 (22) — Reports have somewhere to be read

The report button shipped in (20) wrote to a table nobody could see. Dashboard
-> Moderation now has a third view beside Comments and Chat messages.

Each row carries what a decision actually needs: the reason, who was reported
(with a link to their profile - an admin reading a report almost always wants
to look at the account next), who reported them, the note, and the DM that was
cited. Open / Reviewed filter; marking reviewed is reversible, because it is a
triage state and reopening should not require a database console.

### The privacy call, stated rather than assumed

When a report cites a DM, that message's text is shown to staff. A private
message becomes readable. That IS the point of citing it - a report nobody can
evaluate is a report nobody can act on, and the reporter chose to hand it over -
but it is a real disclosure and it should be a decision, not a side effect.

The line is drawn at exactly that one message: the rest of the conversation is
never fetched, and emails are masked the same way the members table masks them.
Widening this should be a deliberate conversation, not a quiet `include`.

A message the sender has since deleted still appears, labelled as deleted. That
is precisely why DM deletes are soft.

### Gate

`post:manage` - the same permission Comments and Chat messages already use.
Reports are about member behaviour, so they belong to whoever handles
moderation rather than needing a permission of their own. Verified: a non-staff
member gets **401**.

### Verified in a real browser

```
non-staff GET /api/reports    401
open reports                  1  harassment / @safeone / sa***@x.io / message attached
UI                            reason, note, reported message, Mark reviewed all present
after Mark reviewed           open: 0   reviewed: 1
```

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 515/515 tests ✅ ·
build ✅

**Files:** `src/app/api/reports/route.ts` (new),
`src/modules/dashboard/components/DashboardClient.tsx`.

## 2026-08-03 (21) — The service worker was caching 404s, and one of them was the stylesheet

Owner sent a phone screenshot of a research post rendered as raw HTML: serif
text, blue underlined links, no layout at all. The page was there; the CSS was
not.

### The cause

`public/sw.js` handled static assets cache-first:

```js
caches.match(req).then(hit => hit || fetch(req).then(res => {
  cache.put(req, res.clone());   // no status check
  return res;
}));
```

Two independent defects, both of which only bite on a phone:

**It cached failures.** No status check, so a **404 was written to the cache**.
A hashed asset really can 404 for the seconds a deploy takes to propagate
across edges. After that, `caches.match` returned the cached 404, cache-first,
for that exact URL - **forever**. If the 404 was the stylesheet, that device
rendered raw HTML on every visit until its site data was cleared. Today's
deploy carried three migrations and was the biggest in a while, which is the
window this needed.

**A network blip killed the request outright.** With no `.catch()`, a rejected
fetch rejects `respondWith`, and the browser gets a hard network error - where
with no service worker at all it would have fallen back to its own HTTP cache.
Intercepting made a flaky connection strictly *worse*, for exactly the files a
page cannot render without.

### The fix

- Only `res.ok` **and** `res.type === "basic"` responses are stored.
- A failed fetch falls back to the cache, and to a plain network error only if
  there is nothing - never a dead request.
- **`CACHE` bumped v7 -> v8.** This is the part that actually un-breaks a phone
  that is already showing the bug: `activate` deletes every cache that is not
  the current name, so bumping is the only way to evict an entry that was
  poisoned before the fix shipped. It is *not* a return of the
  bump-on-every-deploy ritual - navigations are still never cached, and that
  rule stays retired.

### Verified in a real mobile browser

```
service worker controlling: true
cache buckets: xyz-pwa-v8
404 asset  -> status: 404 | stored in cache: false    correct
real css   -> /_next/static/chunks/….css | stored: true    correct
rendered styles: font GeistMono…, body rgb(8,8,10)
```

**One correction to my own test:** the first run reported the real stylesheet as
*not* cached, which would have been a regression. It was the harness - `cache.put`
is fire-and-forget inside the worker and the assertion raced the write. With a
beat before checking, it stores correctly.

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 515/515 tests ✅ ·
build ✅

**Files:** `public/sw.js`.

## 2026-08-03 (20) — DM safety: block, report, and who can message you

Second half of the DM request. Kept apart from the message menu on purpose:
this is a policy about people, not a control on a bubble.

### One gate, called by both write paths

`dm-gate.ts` answers "may these two message each other?" for both starting a
conversation and sending into one. Three decisions in it are easy to get subtly
wrong apart, so they are in one file with the reasoning attached:

**Blocks bite in both directions even though the row is one-way.** If either
side has blocked the other, neither can send. Enforcing it only against the
blocked party leaves the blocker still receiving, which is the thing they asked
to stop.

**Privacy gates NEW conversations only.** Someone who sets "nobody" has not
asked to have their open threads cut off mid-sentence; they have asked not to be
approached by strangers. Blocking is the tool for ending a conversation.

**"Only people I follow" means the people the RECIPIENT follows** - the inbox
they opted into. Using their follower list instead would let anyone who follows
them through, which is the opposite of a filter. There is a test that asserts
the query is built that way round, because the two are one word apart.

**The refusal message is identical** for "they blocked you" and "their settings
don't allow it". Telling someone they were specifically blocked hands a
harasser a confirmation signal, and the recipient gains nothing from the
distinction.

### Report, because block alone is half a safety story

Block protects the person who pressed it and tells the owner nothing. A report
lands in a queue with a reason (spam / harassment / scam / other) and, if it
came from a thread, the id of the message that prompted it - referenced, not
copied, since DM deletes are soft and the evidence is still there.

Blocking does **not** delete history. A block stops what happens next; quietly
erasing a conversation someone may need to report would be the wrong instinct.

### In the UI

The thread header gets the safety menu (Block / Unblock, and Report with a
reason). A blocked thread replaces the composer with a plain sentence rather
than a disabled box - a greyed-out field you can still click into invites
someone to type a message that will never send.

Settings gets "Who can message me", with the caveat spelled out next to it.

### Verified end to end, two sessions

```
block                    200
blocker sends            403        both directions
blocked sends            403
thread flags (blocker)   blocked:true  blockedByMe:true
thread flags (blocked)   blocked:true  blockedByMe:false
report                   200
unblock -> send          200 -> 201
privacy=nobody, new      403
privacy=nobody, existing 201        thread survives
```

**A false alarm from my own harness:** the first run showed block and report
returning 400. That was the test data, not the code - the seeded users had
hand-written ids and the routes validate `isCuid`. Re-run with cuid ids, all
green. Recorded because "400 on block" would have looked like a real defect.

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · **515/515 tests** ✅
(+10, all on the gate) · build ✅

**Files:** `prisma/schema.prisma`, `prisma/migrations/33_dm_safety/`,
`src/modules/messages/lib/dm-gate.ts` (+ shim),
`src/app/api/dm/block/route.ts`, `src/app/api/dm/report/route.ts`,
`src/app/api/dm/route.ts`, `src/app/api/dm/[id]/route.ts`,
`src/app/api/profile/route.ts`, `src/modules/profile/lib/profile.ts`,
`src/app/settings/page.tsx`, `src/modules/settings/components/SettingsClient.tsx`,
`src/modules/messages/components/MessagesClient.tsx`,
`src/lib/__tests__/dm-gate.test.ts`.

## 2026-08-03 (19) — DM message actions: edit, delete, pin, translate, copy

First half of the owner's DM request. Block, report and the DM privacy setting
are the second half and are deliberately a separate change - they are a safety
model, not a message menu, and mixing them would make both harder to review.

### What the messages can do now

Every message gets an action menu. **Translate needed no new endpoint**: the
community chat's `/api/chat/translate` already takes a bare `{ text }`, so a
second one would only have been a second prompt to keep in step.

Permissions, each verified against the real endpoints with two sessions:

| action | who | result |
|---|---|---|
| edit | author only, inside 15 min | own 200, other's **403** |
| delete | author only | own 200, other's **403** |
| pin | **either participant** | 200 |

The edit window is the same 15 minutes the community chat uses. Two different
edit windows in one product is a rule nobody can remember.

**Pin is not restricted to the author on purpose.** A pin marks what matters to
*the conversation* - an address, a deadline - and half the time that is the
other person's message. One pin per conversation, so pinning replaces the last.

### Deletes are soft, and leave a tombstone

`status` mirrors `ChatMessage`. Two reasons the row stays: removing it makes the
thread jump under the reader's cursor and quietly rewrites a conversation they
had already read, and a reported message needs to still be there after its
sender removes it.

The API sends `body: ""` for a deleted message. Shipping the text and hiding it
in CSS would mean "deleted" only held for people who do not open devtools.

### Two UI defects I built and then fixed

Worth recording because the first version passed every functional test:

- **The menu opened on top of the message it belonged to.** Anchored to the
  trigger, it covered the text - so you could not see what you were about to
  delete. It is now anchored to the message row and sits entirely above it.
- **It used `.glass`,** which is translucent, so the message behind it showed
  through the menu. Solid surface now.

Both were only visible in a screenshot; the DOM assertions were perfectly happy.

### Verified

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 505/505 tests ✅ ·
build ✅ · permission matrix above ✅ · mobile screenshot ✅

**Files:** `prisma/schema.prisma`, `prisma/migrations/32_dm_message_actions/`,
`src/app/api/dm/[id]/message/[messageId]/route.ts` (new),
`src/app/api/dm/[id]/route.ts`,
`src/modules/messages/components/MessagesClient.tsx`.

## 2026-08-03 (18) — The members table now shows a face and a check-in record

Two follow-ups from the owner, on the table shipped an hour earlier.

### Avatars, so "who has set a photo?" is answerable

A column of masked email addresses cannot tell you that at all. Each row now
leads with the member's avatar, falling back to initials - so an account with
no photo is obvious by the absence of one, which was the actual question.

Inline `data:` avatars go out through `publicImageUrl()` as a `/api/media/...`
URL rather than as base64 in the payload. Fifty rows of raw blob is exactly the
Fast Origin Transfer trap this project already has a helper for.

### Check-in history, which had nowhere to be seen

The streak shipped in (17) existed only on the member's own button - the owner
had no way to see who was actually turning up. There is now a **Check-ins**
column: the current run as a "Day N" badge, and the all-time total beside it.

**Both numbers, deliberately.** "Day 6 - 14 days" answers two different
questions: the run says whether they are here now, the total says whether they
ever were. Someone at "Day 1 - 60 days" is a returning regular who lapsed, and
that reads nothing like "Day 1 - 1 day"; one number alone cannot tell those
apart. A member who has never checked in reads "never" rather than a zero.

Also added to the CSV export, along with the username, since that is how the
question gets answered for everyone at once instead of a screen at a time.

### Cost

Two queries for the whole page, not one per row: a `groupBy` for the totals
(never loads the rows) and one bounded read of the day keys. Both sit on the
existing `[userId, action, day]` unique index. The streak window matches the
one the member's own button uses, so the dashboard and the member can never
disagree - a dashboard saying "Day 40" while the member sees "Day 41" is worse
than no number.

### Verified

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 505/505 tests ✅ ·
build ✅

In a real browser, against a seeded history (owner on a 5-day run, the other
member lapsed after 8 days):

```
@owner  🔥 Day 5 · 5 days     avatar: photo
@two       no run · 8 days    avatar: initials
```

CSV: `Name,Username,Email,…,Check-in Streak,Check-in Days` with `5,5` and `0,8`.

**Files:** `src/core/db/member-checkins.ts` (+ shim), `src/app/dashboard/page.tsx`,
`src/app/api/users/route.ts`, `src/modules/dashboard/components/DashboardClient.tsx`.

## 2026-08-03 (17) — Tap a shared photo, click through to a member, and see the streak

Three owner asks, none of which needed a new table.

### 1. Shared photos open full-screen

In a message list a photo is capped at 288px tall and 300px wide, so a chart or
a screenshot is unreadable until it can be opened - and tapping it did nothing,
in both the community chat and DMs.

`ImageLightbox` already existed for the profile avatar and banner, portal and
scroll-lock and Escape handling included, so this is that component wrapped
around the two message images rather than a second implementation. Verified in
a real browser on both surfaces: tap the thumbnail, a full-viewport overlay
appears.

### 2. The dashboard members table links to the profile

The row showed a masked email and a name, which told an admin *who* someone is
and gave them no way to go and *look*. It now shows the handle as a link to
`/u/<username>`, opening in a new tab so the list, its search and its scroll
position survive.

`username` added to three selects that had all been assembled without it
(`/api/users`, the dashboard page query, and the client's `UserRow`). Accounts
that never picked a handle read "no handle" rather than rendering a dead link.

### 3. Daily check-in shows the streak, live

`XpEvent` already stores one row per user per action per UTC day, with `day` as
a plain `YYYY-MM-DD` string. So a streak is "how many consecutive day keys lead
back from today" - derived, not stored. **No column, no table, no migration.**

Storing day keys as strings also makes the whole calculation timezone-free:
everyone's streak rolls over at the same instant, which is the only rule that
does not quietly reward or punish people for where they live, and it keeps this
away from the hydration class of bug that timezone-dependent rendering caused
elsewhere.

Two decisions worth naming:

- **A run counts from yesterday when today is unclaimed.** At 9am, before
  checking in, someone on a 30-day run has a 30-day run - not a zero. Showing 0
  there is both wrong and the moment they decide the feature is broken. The
  badge turns amber in that state, because that is the one moment the number is
  actionable.
- **No badge at all below one day.** "Day 0" beside a check-in button reads as
  a bug rather than a fact.

**Live** in the way that matters: the award endpoint returns the new streak, so
the number moves on the same click, and it broadcasts `xp_checkin` on the
member's own channel so a second device stops showing yesterday's number. No
poll - a streak changes at most once a day and only by their own hand.

### Verified

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · **505/505 tests** ✅
(+14) · build ✅

In a real browser: DM photo → full-screen overlay ✅ · community photo →
full-screen overlay ✅ · dashboard Members tab → `/u/two`, `/u/owner` ✅ ·
check-in streak 0 → 1 on claim, returned in the response ✅

**One correction to my own work along the way:** the first version of the
check-in hook dropped the cancellation guard the original had, so a response
arriving after unmount would set state, and it raised the lint warning count
36 → 37. Both fixed by splitting the fetch from the state write.

**Files:** `src/modules/community/components/ChatClient.tsx`,
`src/modules/messages/components/MessagesClient.tsx`,
`src/modules/dashboard/components/DashboardClient.tsx`,
`src/app/api/users/route.ts`, `src/app/dashboard/page.tsx`,
`src/shared/utils/xp-streak.ts` (+ shim), `src/app/api/xp/route.ts`,
`src/app/api/xp/award/route.ts`,
`src/modules/profile/components/DailyCheckIn.tsx`,
`src/lib/__tests__/xp-streak.test.ts`.

## 2026-08-03 (16) — DM read receipts and last seen, both live, both on plumbing that already existed

Owner asked for WhatsApp-style receipts and last seen in DMs, realtime, and a
better-looking thread. Typing was explicitly skipped.

### Read receipts needed no schema change at all

`Conversation` already carried `readAAt` / `readBAt` - "when this side last
opened the thread" - written on every thread GET for the unread badge. That is
the entire receipt calculation: a message I sent is read if the other side's
`readAt` is at or after it. No per-message column, no per-message write.

- The thread GET now returns `otherReadAt`, and the inbox returns `lastMine` +
  `otherReadAt` so a row can show a tick without being opened.
- **Live:** opening a thread broadcasts `dm_read` on the sender's existing
  `user:<id>` channel, carrying the conversation id and the timestamp. The
  ticks turn with no refetch. Verified end to end with two real sessions: user
  1 sees `Sent`, user 2 opens the thread, user 1's tick becomes `Read` **without
  a refresh**.
- The broadcast fires only when the read actually advanced past something of
  theirs. Every silent refetch also runs this GET, and broadcasting on all of
  them is a loop - my refetch pings you, your refetch pings me.
- It carries no message content. That channel is public (anon key,
  `private: false`), which the `dm_message` ping already documents; a
  conversation id and a date is strictly less than that ping already discloses,
  and it saves the sender a 200-message thread refetch to learn one date.

Three states, deliberately: sending, sent, read. **No "delivered".** WhatsApp
has one because its server knows when a device received the message; there is
no such signal here, and deriving it from "are they online right now" would be
a guess dressed as a fact.

Ticks are **mint, not blue**. Read is the positive outcome and mint is this
palette's positive; a new colour is the one thing the design system asks not to
add.

### Last seen: one column, zero new requests

`ChatPresence` looked like the natural home and is the wrong one - the pagehide
beacon **deletes** that row, which is exactly the moment a last-seen time
becomes worth having. So `User.lastSeenAt` (migration `31_last_seen`), stamped
inside the presence endpoints the site already calls: the heartbeat and the
leave beacon. No new endpoint, no new interval, no new request.

Wording is relative only - "last seen 3 h ago", never a clock time or a date.
Two reasons: a rendered timestamp needs a timezone, and this project has
already lost days to that (#418); and exact times are surveillance where a
bucket is information. Past a week it collapses to "a while ago".

Reads degrade to null on a database that has not had the migration pushed, so
the header falls back to the handle rather than 503-ing the thread.

### The thread itself

Day separators (Today / Yesterday / date), clock times instead of "3 min ago"
on every bubble, and consecutive messages from one side grouped tighter. The
time helpers moved out of `ChatClient` into `chat-time.ts` so DMs reuse the
hydration-safe versions rather than growing a second copy - they format in UTC
through hydration and switch to the reader's timezone after, which is the rule
that keeps #418 away.

Also: a photo DM showed its raw storage URL in the inbox preview. It says
"📷 Photo" now.

**One bug found in my own work while verifying:** the message list had
`space-y-2` on the scroll container, which overrode the per-message spacing, so
the grouping silently did nothing. Caught by looking at the screenshot rather
than the diff.

### Verified

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · **491/491 tests** ✅
(+15) · build ✅ · two-session receipt test ✅ · last-seen-after-leave ✅ ·
mobile + desktop screenshots ✅ · no page errors

**Owner note:** last seen is visible to anyone you have a DM thread with. That
is the normal messenger bargain, but it is a new disclosure - say if you want it
behind a setting.

**Files:** `prisma/schema.prisma`, `prisma/migrations/31_last_seen/`,
`src/shared/utils/last-seen.ts`, `src/shared/utils/chat-time.ts`,
`src/core/db/touch-last-seen.ts` (+ `src/lib` shims),
`src/app/api/presence/route.ts`, `src/app/api/chat/presence/route.ts`,
`src/app/api/dm/route.ts`, `src/app/api/dm/[id]/route.ts`,
`src/modules/messages/lib/dm.ts`,
`src/modules/messages/components/MessagesClient.tsx`,
`src/modules/community/components/ChatClient.tsx`, tests in `src/lib/__tests__/`.

## 2026-08-03 (15) — Ten seconds after opening the room, the poll dropped you into four-day-old history

The owner filmed it: open `/community`, today's messages are there, and then
the view jumps by itself to 30 July. Refresh brings the current ones back, and
it happens again.

Not staleness, and not scrolling. The message list genuinely ends with an old
message, and the room auto-scrolls to its end.

### The cause

`reconcilePoll()` treated **every id it had not seen before as a new arrival**,
and the caller appends arrivals to the end of the list. That assumption is only
safe if the poll never returns anything older than what is on screen - and it
does, because the two sources are different sizes:

| source | messages |
|---|---|
| `/community` server render | newest **30** |
| `/api/chat/messages` (the poll) | newest **50** |

So the very first poll, ten seconds after opening the room, hands back ~20
messages that are unknown *and older than everything displayed*. They were
appended underneath the newest message, and the room stuck to the bottom.

Reproduced in a real browser against a seeded room (40 messages from 30 July,
3 from today), sampling the rendered list every 10s:

```
t=  0s  msgs=30  last=new-3    <- today, correct
t= 10s  msgs=43  last=old-13   <- 30 July, from the first poll
```

They also incremented the unread badge and rang the new-message sound, so the
room announced four-day-old messages as if they had just been posted.

### The fix

Arrivals are split by **time**, not by novelty. Anything at or before the newest
message already held is history: it gets sorted into position rather than
appended, and is not reported as `incoming`. Only genuinely newer messages
count as arrivals. Pending optimistic sends stay at the end and are excluded
from the high-water mark, so a local send cannot mask a real new message.

After, same harness, same seed:

```
t=  0s  msgs=30  last=new-3
t= 10s  msgs=43  last=new-3   <- history backfilled ABOVE, newest still last
...
t=120s  msgs=43  last=new-3
```

And the other direction still works - inserting a message from another user
mid-session put it at the bottom within one poll (`last=live-1`), so this did
not fix the jump by breaking live delivery.

**Files:** `src/modules/community/lib/chat-view.ts`,
`src/lib/__tests__/chat-view.test.ts` (5 new tests, including the exact
30-vs-50 window case and the pending-send edge).

## 2026-08-03 (14) — The chat's own poll was the last surface swallowing its errors

Owner: *"chat me new wala dekhne ke liye refresh karna padta hai, page direct
old data me show hota hai"*, plus a Task Manager screenshot: Chrome at 51.8%
CPU, 30.5% GPU, 3.2 GB.

### Why the chat went stale and only a reload fixed it

The room has a 10s message poll behind the realtime channel. It ended in:

```js
if (!res.ok || !data?.messages) return;   // silent
...
} catch { /* transient */ }               // silent
```

The owner's production console showed `GET /api/chat/messages 503`. So the poll
fired, got a 503, threw it away, and the pill kept reading **"Synced"**. The
server render (a different path, on request) still worked - which is exactly
why reloading was the only thing that ever helped. #223 did this same sweep
across the live surfaces and missed this one.

Two changes:

- **The failure is now visible.** `pollError` drives an amber **"Stale"** on the
  status pill with the HTTP status in the tooltip. "Synced" was actively
  misleading: it is the honest word for a working fallback, and the wrong word
  for a fallback that is failing.
- **A healthy socket is no longer taken on trust.** `liveRef` used to skip the
  poll entirely, so a channel that was SUBSCRIBED but silently delivering
  nothing left the room permanently behind with "Live" showing. It now
  reconciles once a minute regardless. Cost: one request per minute per open
  room.

The underlying 503 is server-side and still an owner action (see §8) - this
makes it diagnosable and self-healing instead of silent.

### CPU: what was actually true, and what was not

Measured on the homepage, production build, 10s idle, tab visible:

| | before | after |
|---|---|---|
| elements with `will-change` (compositor layers) | 247 | **67** |
| running CSS animations | 182 | **158** |
| main-thread task time | 1.76s | ~1.68s |

**`.starfield span { will-change: opacity, transform }`** promoted *every* star
to its own compositor layer. The homepage mounts the field twice, so that was
~244 layers for 1-3px dots, of which only ~64 ever animate. A layer per static
dot is pure GPU memory and compositing work - which is what the owner's 30.5%
GPU and 3.2 GB reading is made of. `will-change` now applies only to stars that
actually move, and `light` (the second mount) halves its animated share;
density is untouched, so nothing looks different.

**The honest part:** this is a GPU/memory fix, not a main-thread CPU fix, and
the main-thread number barely moved. Attribution measurements are recorded
here rather than hidden because they refuted the obvious hypothesis: disabling
**every** CSS animation on the page changed task time from 1.431s to 1.472s -
i.e. not at all, within a run-to-run variance of about ±0.3s (one row of that
sweep came out *higher* than baseline, which is impossible and is the
give-away). CSS animations are **not** the main-thread cost. The starfield is
the biggest single contributor to style recalculation specifically (0.306s ->
0.183s when disabled), which is what the change above targets.

This machine's headless Chromium renders in software, so it cannot reproduce
what 247 GPU layers cost on the owner's hardware. The mechanism is certain; the
size of the win on their machine is not measured here. Worth re-checking on the
real device after deploy.

**Files:** `src/modules/community/components/ChatClient.tsx`,
`src/app/globals.css`, `src/components/Starfield.tsx`.

## 2026-08-03 (13) — Every page was served invisible, and reduced motion made React throw it away

The blank/stuck page, found and reproduced. Two independent faults in
`src/app/template.tsx`, which wraps **every route**:

```tsx
const reduced = useReducedMotion();
if (reduced) return <>{children}</>;
return <motion.div initial={{ opacity: 0, y: 8 }} ...>{children}</motion.div>;
```

**1. The whole site was server-rendered at `opacity: 0`.** Content became
visible only once JavaScript hydrated. Any failure on that path - a stale
chunk, a throw, a phone that gave up on the bundle - left a fully-populated DOM
that nobody could see. Measured: `/`, `/terms`, `/research`, `/markets`,
`/news` each shipped exactly one `opacity:0;transform:translateY(8px)` wrapper
around everything.

**2. The branch broke hydration on every page.** framer-motion's
`useReducedMotion()` returns `null` while server rendering but reads
`matchMedia` synchronously during the FIRST client render. For a visitor with
reduced motion on, the server sent the wrapper and the client rendered without
it - the document shifted one level, React threw `Minified React error #418`
(`throwOnHydrationMismatch`) and discarded the server HTML for the whole page.
Reduced motion is on by default under Android battery saver and iOS Low Power,
which is why this read as a mobile problem. It is also the `#418` in the
owner's production console.

Reproduced before touching anything: a Playwright sweep of 16 routes signed-out
and signed-in threw #418 on **32 of 32**. Isolating one variable at a time
showed reduced motion alone was the trigger (locale and timezone were clean at
that point).

### The fix

`template.tsx` is now CSS with no branch at all: one `.route-enter` class,
keyframed in `globals.css`, opted out under `@media (prefers-reduced-motion:
reduce)`. Identical markup on both sides, so there is nothing to mismatch, and
the page becomes visible whether or not JavaScript ever arrives. Verified with
JavaScript **disabled**: wrapper opacity 1, body text visible, both with and
without reduced motion.

### Then the sweep found a second bug the first was hiding

With 30/32 clean, `/settings` and `/community` still threw - and isolating
again showed the trigger was **timezone**, not motion. Vercel runs UTC and the
reader's browser does not, so dates near midnight formatted to a different
calendar day on each side. Captured literally, from an IST browser:

| surface | server HTML | IST browser |
|---|---|---|
| `/settings` | `Aug 2, 2026` | `Aug 3, 2026` |
| `/community` | `6:06 AM` | `11:36 AM` |

`formatDate`/`formatDateWithDay`/`formatDateTime` pinned the *locale* but never
the *timezone*. They now pin `timeZone: "UTC"`, which is also the better answer
on its own terms - a post should not look published on different days to
different readers. (`DashboardClient` already did this; it was the outlier that
was right.)

The chat's clock times and Today/Yesterday separators genuinely mean *the
reader's* day, so pinning UTC would have been wrong. Those format in UTC for
the server render and the hydrating render, then switch to local from the next
render on, via the existing `useHydrated()`. The two only ever disagree within
the timezone offset of midnight.

### Swept the whole class, not just the two sites that fired

- Every remaining `useReducedMotion()` (8 call sites) now uses a new
  `useReducedMotionSafe()` - `useSyncExternalStore` with a server snapshot, so
  hydration sees what the server saw. This was not paranoia: `ActionLink`'s
  `whileTap={reduced ? undefined : ...}` was a real mismatch, because
  framer-motion emits a `tabindex` attribute when a gesture prop is present.
- `Starfield`'s star positions came from `Math.sin`, which ECMAScript does not
  require to be correctly rounded. Node and V8-in-Chromium genuinely differed -
  server `left:5.721816934965318%` vs browser `5.721816935692914%` - so all 110
  stars reported an attribute mismatch on the homepage. Seeds moved to
  `starfield-seed.ts` and quantized; the live set's closest approach to a
  rounding boundary is 2.61e-4 against a 7.28e-8 divergence, ~3600x of headroom,
  asserted by test. Silent in production, but it buried real errors in dev.
- Three server-rendered number formatters had no locale pinned
  (`DashboardClient`, `LiveStats`, `ProfileStats`). Latent rather than observed
   - `en-IN` groups digits differently only from 10,000 up and the local seed
  data is smaller - so pinned to `en-US` to match the convention already used
  everywhere else in those same files.

### Verified

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 471/471 tests ✅ (+9:
starfield seed stability, date-formatter timezone independence, including a
control that fails without the fix so the assertions cannot be vacuous) ·
build ✅ · content visible with JS disabled ✅

Hydration sweep, production build, every combination of reduced-motion /
`en-IN` / `Asia/Kolkata`, signed-out and signed-in: **32/32 pages clean**, and
30/30 on the per-variable matrix across `/community`, `/settings`, `/messages`,
`/u/owner`, `/dashboard`, `/journal`. Before: 32/32 failing.

**Files:** `src/app/template.tsx`, `src/app/globals.css`,
`src/shared/utils/utils.ts`, `src/shared/hooks/useClientFlag.ts`,
`src/shared/utils/starfield-seed.ts` (+ `src/lib` shim), `src/components/Starfield.tsx`,
`src/modules/community/components/ChatClient.tsx`,
`src/modules/profile/components/ProfileStats.tsx`,
`src/shared/components/{ActionLink,AnimatedEmoji,AnimatedIcon,BrandLoader,LiveStats}.tsx`,
`src/modules/{profile/components/ProfileFollow,news/components/NewsClient,ai/components/XyzAiWidget,dashboard/components/DashboardClient}.tsx`,
tests in `src/lib/__tests__/`.

## 2026-08-03 (12) — Two components asking for the same realtime channel, and the second one losing

The owner sent a production console. It contained the answer, and it was **not**
what I had been telling them.

```
Uncaught (in promise) Error: cannot add `presence` callbacks for
  realtime:site-visitors after `subscribe()`.
Uncaught (in promise) Error: cannot add `presence` callbacks for
  realtime:community after `subscribe()`.        (twice)
```

### What I had wrong

I had said the problem was the Supabase credentials and that nothing in the code
could help. **These errors disprove that**: a channel is only ever created when
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are present, so
they are set. This is our bug, not a key.

### The mechanism, from the library source

`getRealtimeClient()` returns ONE Supabase client per tab, on purpose. And
supabase-js reuses channels by topic:

```js
channel(topic) {
  const exists = this.getChannels().find(c => c.topic === realtimeTopic);
  return exists ?? new RealtimeChannel(...);   // the SAME object
}
```

Once that channel has been subscribed, adding a listener throws
(`RealtimeChannel.js:418`).

`site-visitors` was created from **five** places - RealtimeSession, the
dashboard's live-online tile, `useLivePresence`, `useUserOnline` (twice) - and
`community` from **two**: ChatClient and NavActivity. Whichever mounted first
subscribed; every later one received that already-subscribed channel, threw, and
**its listeners were never registered**.

**That is why the online count did not update, and why it "worked after a
refresh"**: a reload changes the mount order, so sometimes the component that
needed presence won the race. It is also why every fix aimed at the fallback
path helped without ever solving it.

### The fix

`joinSharedChannel()` owns each topic. It attaches exactly one presence listener
and one **wildcard** broadcast listener *before* the single `subscribe()`, then
fans out to consumers from its own sets. Consumers register and release freely
afterwards, because they never touch the channel. A late presence key rebuilds
the channel - safe precisely because the handlers live in the registry.

**Every raw `client.channel()` call site is gone** - ChatClient, RealtimeSession,
NavActivity, WhatsNewFeed, DashboardClient (×2), `useRealtime`,
`useLivePresence`, `useUserOnline` (×2). `useRealtime` mattered most: it serves
`user:<id>`, `notifications` and `post:<id>`, all topics other components also
join.

Presence keys are now a rule rather than an accident: **only the consumer that
represents the tab passes one** (RealtimeSession for `site-visitors`, ChatClient
for `community`). The dashboard tile and the online-set hooks are observers and
pass none - previously each tried to impose its own key on the one shared
channel.

### Verified

Seven unit tests against a fake client that reproduces the library's own throw:
one channel per topic however many consumers join; a late consumer does not
touch the channel and does not throw; presence reaches every consumer including
a late one (replayed); broadcasts route only to the consumers that asked;
refcounted teardown; a released consumer stops receiving; typing sends through
the handle.

Chat re-verified end to end with two sessions: a message arrives without a
refresh, the online count reads 2, and the wake path still fires. Steady-state
request rate measured identical to `main`: **25 requests / 12.5 per minute per
signed-in tab**.

**Honest scope:** I could not reproduce the console error locally. It only
throws once a channel has actually JOINED, which needs a reachable Supabase
project - with a stub URL it does not fire on this branch **or on `main`**, so
that comparison proves nothing either way. The evidence the bug is real is the
owner's production console plus the library source; the evidence the fix
addresses it is structural (no component can reach a shared channel any more)
plus the unit tests. **The place to confirm it is that same production console.**

### Also in the console, not addressed here

- `GET /api/notifications 503`, `GET /api/chat/messages 503`, repeatedly. The
  server really is failing - which corroborates (9)'s pool finding, and those
  now log `POOL EXHAUSTED (P2024)` when that is the cause.
- `Minified React error #418` - a hydration mismatch, and a plausible cause of
  the blank/stuck page. Separate work.
- `Cannot redefine property: ethereum` - a wallet extension, not ours.

**Files:** `src/shared/utils/sharedChannel.ts` + `src/lib/sharedChannel.ts`
(new) · `ChatClient.tsx` · `RealtimeSession.tsx` · `NavActivity.tsx` ·
`WhatsNewFeed.tsx` · `DashboardClient.tsx` · `useRealtime.ts` ·
`useLivePresence.ts` · `useUserOnline.ts` ·
`src/lib/__tests__/sharedChannel.test.ts` (new).

**Gates:** typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 462/462
tests ✅ · build ✅ · all nine pages 200.

---

## 2026-08-03 (11) — Every live surface swallowed its own failures, so nothing could retry

Reported, after several rounds of per-surface fixes: data still does not sync
sometimes, the page gets stuck, the community chat sometimes fetches nothing,
and the online count only works after a refresh. *"Fix properly taki baar baar
na karna pade."*

The reason it kept coming back is that each round fixed one loop. This is the
thing all of them shared.

### The audit

Across every live surface - DM inbox, DM thread, navbar badges, ticker, journal
feed, markets, news - **not one retried a failed request, and not one listened
for the network coming back**:

| surface | retry | visibility | `online` event |
|---|---|---|---|
| MessagesClient | ✗ | partial | ✗ |
| NavActivity | ✗ | ✓ | ✗ |
| JournalActivityFeed | ✗ | ✗ | ✗ |
| useTickerPoll | ✗ | ✓ | ✗ |

So one failed request - a dropped connection, a 503 from a busy database, a
phone switching from wifi to mobile data - left that surface stale until the
next tick, and if that tick failed too, **until the user reloaded the page**.
Nothing was broken permanently; nothing recovered on its own either. That is
exactly what "kabhi kabhi" and "refresh ke baad kaam karta hai" describe.

### The blocker underneath it

Even where a retry existed, it could never fire: **every loader caught its own
error and resolved successfully.** `loadInbox`, the DM thread `load`,
`loadNotes`, `loadDm`, `loadChat` all ended in a bare catch, so a failed request
was indistinguishable from a successful one to anything wrapping it. All five
now let the failure propagate; they still keep the last known state, the error
just travels far enough for something to act on it.

### The fix

- **`useRealtime`'s poll now retries** a rejected load with backoff (1s → 30s),
  never overlaps requests, and drops the backoff on wake. One change, and every
  consumer gets it: comments, likes, Journal, Journal activity, profile follow
  counts, both DM loops, the dashboard.
- **`useLiveData`** (new) is the same contract for surfaces that have no
  realtime channel at all, and NavActivity - the badges on every page - is the
  first onto it. It gains retry and an `online` listener for the first time.

**Verified end to end in a real browser.** Endpoints forced to 503 from first
load, then healed with no reload and no interaction:

```
while failing : 21 retry attempts in 9s, with backoff
after healing : recovered in 7.0s, no reload, no interaction
```

Previously that surface would have waited out a 30-60s interval and, if that
also failed, stayed wrong indefinitely.

### It costs nothing extra

Measured on `main` and on this branch, 120s of healthy steady state on the
homepage while signed in - **identical on both: 25 requests, 12.5/min per tab**
(`chat/last-activity` 12, `dm/unread` 6, `chart` 4, `notifications` 2,
`presence` 1). The retry only spends requests when something is already broken.

Worth recording that the comparison is what settled it: the raw figure looked
like a doubling against my own arithmetic, and building `main` to compare showed
the rate was unchanged and the arithmetic was wrong.

**Files:** `src/shared/hooks/useLiveData.ts` + `src/lib/useLiveData.ts` (new) ·
`src/shared/hooks/useRealtime.ts` ·
`src/modules/notifications/components/NavActivity.tsx` ·
`src/modules/messages/components/MessagesClient.tsx` ·
`src/lib/__tests__/useLiveData.test.ts` (new).

**Gates:** typecheck ✅ · lint 0 errors / 36 warnings (one fewer) · 455/455
tests ✅ · build ✅.

---

## 2026-08-03 (10) — The homepage kept animating 190 things nobody could see

Reported: opening the homepage pushes CPU high, and it stays high.

**Measured first, at 1280x800:** the homepage runs **281 CSS animations at
once**, on a page **11.5 viewports tall**, and **190 of them are off screen**.
Style recalculation was the largest single slice of an idle frame. Nothing here
is one expensive effect - it is that the starfield, the mesh drift, the pulse
dots, the Icons3D set and the shine sweeps all keep running to the bottom of the
document no matter where the reader actually is.

**The fix pauses a block's animations only while it is more than a full viewport
away** (`PauseOffscreenAnimations.tsx` + one CSS rule). An IntersectionObserver
toggles `animation-play-state: paused`; `rootMargin: 100%` means anything is
already running well before it can be seen.

**Nothing visual changes**, and that was checked rather than assumed: at 0 / 25 /
50 / 75 / 100% scroll, on both 1280x800 and 390x844, the number of animations
that are **visible AND frozen is 0** at every position. The motion here is
deliberate brand identity (see the reduced-motion policy above), so a fix that
dimmed it would not have been acceptable.

**Result - a true A/B on the same build**, defeating the new rule with a
stylesheet override so both sides are otherwise identical, four runs each:

| | CPU (idle, 4 runs) | animations running |
|---|---|---|
| before | **24.9%** (25.9, 23.9, 26.3, 23.6) | 281 |
| after | **20.1%** (20.1, 19.5, 20.5, 20.3) | 182 |

The ranges do not overlap, against a measured noise floor of ±0.8 points (five
runs of an identical page: 20.2, 20.2, 19.3, 18.7, 20.3). **~19% less CPU on an
idle homepage**, and the frame cost is far steadier afterwards.

**Two things this is NOT, stated because both were tested and both surprised
me:**
- It is not "animations are expensive, remove them". Turning **every** CSS
  animation off measured **~27%** - *higher* than leaving them on. Removing an
  animation de-promotes its compositor layer, and the repaint costs more than
  the transform did. The win comes specifically from not animating the
  off-screen 190, not from animating less in general.
- `content-visibility: auto` would do this and more, and was deliberately **not**
  used: it changes layout geometry, and this project already had to neutralise
  `.sect-cv` because that broke anchor-jump scrolling. Pausing an animation
  changes no geometry at all.

Applies to every page, not just the homepage - it is mounted in the root layout.

**Files:** `src/shared/components/PauseOffscreenAnimations.tsx` +
`src/components/PauseOffscreenAnimations.tsx` (new) · `src/app/globals.css` ·
`src/app/layout.tsx`.

**Gates:** typecheck ✅ · lint 0 errors / 37 warnings (unchanged) · 451/451
tests ✅ · build ✅. Smoke-tested `/`, `/community`, `/news`, `/markets`,
`/research`, `/tools`, `/u/<handle>` - all 200.

---

## 2026-08-03 (9) — The dashboard's "Live online" was a confident zero

Asked: is the dashboard's online number realtime? **No - and it was worse than
not-realtime.**

**🔴 It read Supabase Realtime presence and nothing else** —
`DashboardClient.tsx`. `.subscribe()` with no status callback, no retry, and
`count` initialised to `0`. So whenever the channel could not connect - which is
its current state, see (8) - the dashboard showed a confident **0** while the
site was in use, with nothing on screen to say its only source was gone. An
admin reads that as "nobody is here". A wrong number is worse than no number.

Now: presence when it works, a **server-backed count** when it does not, the
channel retried with 1s → 30s backoff, refresh on tab focus, and **`-`
("Unavailable")** when neither source can answer - never a fabricated zero. The
label says which source produced the figure.

**The server-backed half** is a new `/api/presence`: `POST` is a heartbeat,
`GET` is an admin-only count of rows seen inside the window. Two rules keep it
cheap and correct:
- it **only runs while the realtime channel is down**, so a healthy deployment
  makes zero extra requests;
- it **does not run on `/community`**, where `ChatClient` already owns the same
  row at a faster beat. The row is keyed by user, so two writers would flip its
  `room` back and forth and the chat's own count would start losing people. One
  writer per user, enforced by `chatOwnsPresence()` so both sides read the same
  rule rather than two copies of a string.

**Verified end to end** with realtime off (the reported state), two browsers:
admin alone on `/dashboard` → **1**; a second member opens `/markets` → **2**,
**with no refresh**. `GET /api/presence` returns `{"online":2}` with
`private, no-store`; a non-admin gets **401**. The chat room's own roster is
unchanged: join seen in 11.2s, leave in 15.1s.

**🐛 A missing presence table looked exactly like an empty room** —
`api/chat/presence/route.ts`, `ChatClient.tsx`.
Both queries swallow their error so a not-yet-migrated DB cannot break the room.
The side effect: if `ChatPresence` does not exist (and `CLAUDE.md` records that
production has drifted behind `schema.prisma`), the caller gets a confident
**"1 online" - just themselves - forever, and refreshing changes nothing**,
because the failure is indistinguishable from nobody being there. The route now
returns *why*, naming P2021/P2022 as an un-applied schema, and the room's status
tooltip carries it. Same principle as (8): a check that cannot say "I am broken"
is a check that lies.

**Files:** `src/app/api/presence/route.ts` (new) ·
`src/shared/utils/presence.ts` + `src/lib/presence.ts` (new) ·
`src/modules/dashboard/components/DashboardClient.tsx` ·
`src/modules/community/components/RealtimeSession.tsx` ·
`src/app/api/chat/presence/route.ts` ·
`src/modules/community/components/ChatClient.tsx`.

**Gates:** typecheck ✅ · lint 0 errors / 37 warnings (unchanged) · 440/440
tests ✅ · build ✅. Route table: **+1 route** (`ƒ /api/presence`), nothing
changed mode or window.

**Note on the underlying cause:** none of this makes realtime *connect*. That is
still the invalid `SUPABASE_SERVICE_ROLE_KEY` from (8). This makes every
presence number on the site tell the truth while it is down.

---

## 2026-08-03 (9) — Three causes behind "kabhi kabhi": an unbounded pool, a cached HTML shell, and a failure with no name

Reported: profile breaking, DMs sometimes not opening, community chat not
working, the site occasionally blank. **"Sometimes" is the whole signal** - each
of these works most of the time, which rules out a plain bug and points at
contention and caching.

### 🔴 The connection pool was never bounded

`prisma/schema.prisma` says, in its own header:

```
Recommended: `?pgbouncer=true&connection_limit=1`
```

and `.env.example` ships `…?pgbouncer=true` **without it**. A recommendation
that lives only in a comment is not applied, and this one was not.

Unbounded, Prisma sizes its pool at `num_cpus * 2 + 1` **per client**, and on
serverless that is per warm function instance. Several instances, each holding
its own handful of pooler connections, is how a Supabase free-tier pooler runs
out. What that looks like from outside is not an outage - it is
`P2024 Timed out fetching a new connection from the connection pool` on *some*
requests. The profile breaks sometimes. The DM sometimes does not open. The chat
is sometimes empty. Never together, never reproducible.

`withPoolDefaults()` now sets the pool parameters on the datasource URL in code,
so the setting cannot be lost to a copy-paste, and an explicit value in the env
var still wins. **Measured after: 30 concurrent DB-backed requests hold exactly
5 connections, steady, with no errors.**

**`connection_limit=5`, deliberately not the 1 that Prisma's serverless guidance
suggests.** This app fans out per page - `/u/[username]` alone issues six
queries in one `Promise.all` - and a limit of 1 serializes every one of them.
That is not theoretical: testing `connection_limit=1` with 40 concurrent queries
produced **P2024**, the exact failure this is meant to prevent. `pool_timeout`
also goes 10s → 20s, so brief contention queues instead of failing.

**Honest scope:** whether the limit itself changes anything in production is
**unconfirmed** - the old default derives from the runtime's CPU count, which is
not observable from here, and on a small Vercel function it may already land
near 5. What is definitely new is the longer timeout, the value being explicit
rather than runtime-dependent, and the diagnostic below.

### 🔴 Pool exhaustion had no name

`handleError` maps P2002, P2025, P2021 and P2022 - and **had no branch for
P2024**. So the signature failure of a serverless app against a pooler fell
through to the generic `Something went wrong` 500 with a random trace id. That
is why "kabhi kabhi" could never be pinned to a cause: the one error that
explains it was indistinguishable from every other error. It now logs
`POOL EXHAUSTED (P2024)` with what to do about it, and answers 503 "The service
is busy" rather than a generic 500.

### 🔴 The blank page: a cached HTML shell outliving its chunks

`public/sw.js` cached navigations network-first, with the cached copy as a
fallback. **The fallback is the bug.** An HTML shell names the exact hashed
chunks of the deploy that produced it, and those filenames are gone after the
next deploy. A cached shell served on a flaky connection then asks for chunks
that 404, the 404 comes back as HTML, the browser refuses to execute it on a
MIME mismatch, and hydration silently never finishes - blank or frozen, with no
error the user can see. Intermittent by construction: it needs a cached shell
**and** a deploy since **and** a network hiccup.

The previous mitigation was "bump `CACHE` on any deploy that could strand users
on old JS" (`CLAUDE.md`) plus a one-shot reload in `PwaSetup`. Both real, both
patches on a ritual - and the ritual did not survive contact with reality: the
version was last bumped in **#140**, and **six deploys shipped over it in a
single day**, which is when the blank-page reports started. Mine were four of
those six.

**Navigations are no longer cached at all.** The class of bug is removed rather
than delegated to everyone remembering. `CACHE` also goes v6 → v7 so existing
poisoned caches are dropped on activate. Cost: a previously-visited page no
longer renders offline (`/offline.html` still does) - the right trade for a live
market/chat app. `CLAUDE.md`'s gotcha is updated; the per-deploy bump is no
longer needed.

### ⚡ And the heartbeat added earlier today is now much quieter

`/api/presence` (from (7)) writes to the database from every open page of every
signed-in user. Given the pool finding, that is pressure pointed at the thing
already under pressure. Beat 45s → **120s**, its window 60s → 180s, plus the
circuit breaker from (8). It feeds one admin dashboard tile; a number that is at
most two minutes stale is entirely adequate for that.

**Files:** `src/shared/utils/db-url.ts` + `src/lib/db-url.ts` (new) ·
`src/core/db/prisma.ts` · `src/shared/utils/api.ts` ·
`src/shared/utils/presence.ts` · `public/sw.js` · `CLAUDE.md` ·
`src/lib/__tests__/db-url.test.ts` (new).

**Gates:** typecheck ✅ · lint 0 errors / 37 warnings (unchanged) · 451/451
tests ✅ · build ✅. Smoke-tested: `/`, `/community`, `/news`, `/markets`,
`/research`, `/u/<handle>`, `/api/follow`, `/api/ticker` all 200 with the
rewritten datasource URL.

---

## 2026-08-03 (8) — The storage diagnostic was diagnosing the wrong thing

The owner ran `/api/media/health` on production. It said the bucket probably did
not exist. **It was wrong, and the answer was sitting in its own output:**

```
testUploadStatus: 400
supabaseResponse: {"statusCode":"403","error":"Unauthorized",
                   "message":"Invalid Compact JWS","code":"AccessDenied"}
diagnosis: 'the bucket "post-covers" likely doesn't exist…'
```

`storageEnabled: true`, both env vars set, and Supabase answering **`Invalid
Compact JWS`** - which means the service-role key is not a well-formed JWT at
all. The bucket was never involved. The diagnosis branched on the **HTTP status**
(400), and Supabase's Storage API wraps auth failures in a 400 with the real
status inside the body. So a check whose whole job is to name the cause was
confidently naming the wrong one, and would have sent the reader off to create a
bucket that changes nothing.

**Fixed two ways:**

- It **reads the body now**, not the status: `Invalid Compact JWS` / `invalid
  JWT` → the key; `Bucket not found` → the bucket; inner 401/403 → wrong or
  rotated key. The exact Supabase message is quoted back in the diagnosis.
- New `describeKey()` checks the key's **shape locally, before any request** -
  because this particular failure is knowable without one. It reports length,
  segment count, whether it parses as a JWT, whether the value arrived with a
  stray newline or wrapping quotes (the two classic Vercel copy-paste failures),
  whether it is one of Supabase's new `sb_secret_…` keys rather than the legacy
  JWT, whether it has expired, and its `role` claim - which is what separates
  "pasted the anon key" from "pasted the right one". **It never returns the key**,
  and a test asserts that.

Ten unit tests cover the shapes, including the one that was actually live.

**This is the root cause of a chain that has come up repeatedly:** storage
uploads fail → `uploadImage()` falls back to inline `data:` storage → (before
(7)) the photo was then stripped everywhere. Server-side realtime
(`broadcastEvent`) authenticates with the same key, so it is dark for the same
reason.

**Owner action:** Supabase → Settings → API Keys → copy the **service_role** key
(starts with `eyJ`, three dot-separated parts), paste into Vercel with no quotes
and no trailing newline, redeploy, then re-run `/api/media/health` - it should
report `Storage works ✅`.

**Files:** `src/app/api/media/health/route.ts` ·
`src/shared/utils/jwt-shape.ts` + `src/lib/jwt-shape.ts` (new) ·
`src/lib/__tests__/jwt-shape.test.ts` (new).

**Gates:** typecheck ✅ · lint 0 errors / 37 warnings (unchanged) · 440/440
tests ✅ · build ✅.

---

## 2026-08-03 (7) — The profile photo that was never served, and two dialogs anchored to the wrong box

Four reports, and three of them turned out to be one root cause each that no
amount of CSS tuning would have reached.

### 🔴 An uploaded profile photo was thrown away on the way out

Reported as *"profile photo settings me add hone ke baad bhi profile me show
nahi hota, bahut sare device me"*. It was in the database the whole time.

`uploadImage()` falls back to storing the image as an inline `data:` URL in the
`User` row whenever Supabase Storage is unconfigured or fails - that is the
zero-setup upload path and it works. But **every read path then replaced that
value with `null`** via `stripInlineImage()`, to keep a 700KB blob out of hot
JSON payloads and ISR-cached HTML (a real Fast Origin Transfer incident). So the
photo saved, and then vanished: profile, chat, comments, follow lists, DMs,
research bylines, the online list, the navbar. For **everyone**, uploader
included.

The banner had a patch - an owner-only re-fetch of `/api/profile` - which meant
the owner saw their own banner, nobody else did, and the owner pulled the whole
base64 blob down on every visit to their own page. The avatar had no patch at
all. The navbar's comment even said "the real image still renders from the DB on
the profile + in comments", which was simply not true.

**The fix serves it instead of hiding it.** New `GET /api/media/<kind>/<id>/<v>`
decodes the stored data URL and returns real image bytes with
`public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400`;
`publicImageUrl()` replaces `stripInlineImage()` at every read path and rewrites
an inline image to that URL. This is **better** for egress than either previous
behaviour: the bytes leave the origin once and the CDN holds them, instead of
being re-serialized into every response and every cache fill - or not being
served at all. The owner-only banner re-fetch is gone with it.

Two details worth keeping:
- The version is a **path segment, not `?v=`**. `next/image` refuses to optimize
  a local URL carrying a query string under the default config - it answers
  `400 "url" parameter is not allowed`. Measured with `?v=`: every avatar
  rendered as a **0x0 broken image**, banners fine. Moving the token into the
  path fixed it without touching the image security config.
- The token samples the value (length + head/middle/tail windows) rather than
  hashing it, because these paths run per row on hot endpoints and hashing
  hundreds of KB there is billable CPU. The first version sampled length + tail
  only, and a unit test caught it: an edit near the *start* of the image left
  the token unchanged, which would have pinned a stale avatar. The cache window
  is long but finite for the same reason - not `immutable`.

**Verified end to end** against a real Postgres, with the avatar and banner
stored as `data:` URLs, for three viewers - logged out, the owner, and another
member: image decodes (non-zero natural size) for all three, banner renders for
all three, and **no base64 appears in the HTML for any of them**. Route checks:
`200 image/png` with the cache header above, `404` for an unknown kind, `404`
with a short cache for a user who has no image.

### 🔴 The follow dialog was boxed inside the profile card

Reported as *"follow wala background aligned nahi hai, desktop aur mobile
dono"*, and it was not a padding problem.

`position: fixed` only means "the viewport" while no ancestor establishes a
containing block - and `filter`, `transform`, `backdrop-filter` and friends all
do. The profile hero card is wrapped in `<Reveal variant="blur">`, which animates
`filter: blur(...)` and settles on **`blur(0px)`**: visually nothing, and not
`none`. **Measured at 1280x800:** the dialog's `fixed inset-0` overlay resolved
to **832x328 at (224,112)** instead of 1280x800 at (0,0). It was a dialog
anchored to the profile card, which is exactly what it looked like.

Portalled to `document.body`, the way `ImageLightbox` already does for the
backdrop-filter version of this. The overlay also now reserves the bottom nav so
the panel centres in the space it may actually use, instead of shrinking itself
by 9rem while still centring in the full viewport.
**Measured after:** gaps above/below **344/344** at 1280x800, **484/484** at
1920x1080, **370/362** at 390x844 (the 8px is the bottom nav clearance, which is
the point).

### 🔴 The news reader was anchored to a wrapper too, and never locked the feed

Same class of bug, milder: **measured at 1280x800, the reader's overlay resolved
to 1280x780 starting at y=20** rather than filling the viewport. It also had no
scroll lock that worked - the hand-rolled `body { overflow: hidden }` in it is
ignored by Lenis, which drives the scroll position itself - and its scroll body
had neither `overscroll-contain` nor `data-lenis-prevent`, so the wheel fell
through to `/news` whenever the briefing was short or you reached its end.

Portalled, given the real `useScrollLock`, and both scroll attributes added.
**Measured after:** overlay is the full viewport, twelve wheel gestures over the
open reader leave the page at **71 → 71**, the reader's own body scrolls 341px,
and Escape releases it.

### 🔴 The Publish editor handed the wheel to the page

Lenis's general rule only gives the wheel back to a box that is *currently*
taller than its frame. So an empty editor, a nearly-empty one, or one at the top
or bottom of its text handed the wheel straight to the page - which is the
"cursor box me hai, poora page hilta hai" report, and why it looked
device-dependent. `data-lenis-prevent` makes it unconditional: while the pointer
is in the box, the box owns the wheel. That is a deliberate trade (reaching the
end of your text no longer carries on down the page) and it is what was asked
for.
**Measured at 1280x800, 1920x1080 and 390x844**, including twelve gestures past
the end of the text: page `242 → 242`, `0 → 0`, `346 → 346`.

### Also

- `useScrollLock` now compensates for the scrollbar it removes, so the page
  behind a dialog does not shift by its width on open.
- The lock replaced two more hand-rolled `body { overflow: hidden }` blocks that
  never worked with Lenis: `ImageLightbox` and the dashboard access dialog. The
  news "Customize your feed" sheet got one for the first time.

**Files:** `src/app/api/media/[kind]/[id]/[v]/route.ts` (new) ·
`src/shared/utils/media.ts` + `src/lib/media.ts` (new) ·
`src/shared/utils/utils.ts` · `src/core/auth/auth.ts` ·
`src/app/u/[username]/page.tsx` · `src/app/research/[slug]/page.tsx` ·
`src/app/api/profile/route.ts` · `src/app/api/follow/list/route.ts` ·
`src/app/api/posts/[id]/comments/route.ts` · `src/app/api/dm/search/route.ts` ·
`src/app/api/chat/presence/route.ts` · `src/modules/community/lib/chat.ts` ·
`src/modules/messages/lib/dm.ts` ·
`src/modules/profile/components/ProfileBannerImage.tsx` ·
`src/modules/profile/components/FollowListModal.tsx` ·
`src/modules/news/components/NewsClient.tsx` ·
`src/modules/community/components/PostContentEditor.tsx` ·
`src/modules/community/components/ImageLightbox.tsx` ·
`src/modules/dashboard/components/DashboardClient.tsx` ·
`src/shared/hooks/useScrollLock.ts` ·
`src/lib/__tests__/public-image.test.ts` (new).

**Gates:** typecheck ✅ · lint 0 errors / 37 warnings (unchanged) · 430/430
tests ✅ · build ✅.

---

## 2026-08-03 (6) — Live surfaces that quietly died and never came back

Reported: the community room's online count still is not live, it "does not
connect perfectly", and *"baar baar refresh karna padta hai"*.

Four separate faults, and the first one is not a chat bug at all.

**🔴 `useRealtime` never checked whether the subscription worked** —
`src/shared/hooks/useRealtime.ts`.
It chose the realtime path purely because the env vars existed, and called
`.subscribe()` **with no status callback**. So a `CHANNEL_ERROR` - wrong anon
key, project paused, connection cap, CSP, or just a phone that slept and dropped
the socket - left the surface with **no channel, no retry and no poll**. It went
silent permanently, and reloading the page was the only cure. That is exactly
the report, and it was not limited to chat: this hook is what makes **comments,
likes, the Journal, the Journal activity feed, profile follow counts, DMs and
the dashboard** live. All seven had it.

Fixed the way the chat already did it locally (that file had the same bug and
was fixed there in isolation):
- **The poll is always armed** and early-returns on every tick while the channel
  is healthy, so a working deployment issues *zero* extra requests and this costs
  nothing on the Supabase/Vercel bills. Callers that named no interval get a slow
  60s safety net rather than nothing.
- **A failed channel is retried** with 1s → 30s backoff, and a `connecting` guard
  stops the backoff timer and a wake event from racing into two live
  subscriptions.
- **Waking refetches immediately** (visibility, focus, `online`), throttled to
  one round trip per 4s. On *re*-connect it reconciles once, because broadcast
  has no replay - but deliberately **not** on the first subscribe, which would
  add a duplicate request to every page load.

**🔴 The room did nothing when you came back to it** — `ChatClient.tsx`.
Both loops skip while the tab is hidden, and the leave beacon has just removed
you from the presence table - so returning left you **invisible to everyone else
and the room stale**, with nothing scheduled to fix either sooner than the next
interval (10s for messages, 25s for the roster), plus a dead socket on top if the
device had slept. There was a `visibilitychange` handler, but it only handled the
*hidden* direction. Now becoming visible re-registers presence, catches up on
messages and rebuilds the channel immediately, throttled to 3s. The message
catch-up is forced rather than skipped when the socket claims to be live: a
socket that survived a frozen tab can come back apparently healthy having
silently dropped everything in between.

**Measured**, two real sessions with realtime *off* (the reported state):
on hide, exactly 1 request (the leave beacon); on wake, `POST /api/chat/presence`
+ `GET /api/chat/messages` **within 1.5s**, and the sender's next message still
arrived with no refresh.

**🔴 A channel error blanked the roster** — `ChatClient.tsx`.
The error branch did `setOnline(0)` and cleared the member list, and the server
heartbeat only refilled it on its next tick. So a blip showed **"0 online" in a
full room** for up to 25 seconds - and that gap is precisely when someone looks
at it. It now keeps the last known list and asks the server for the truth
immediately instead.

**🔴 The presence heartbeat was spending the composer's rate limit** —
`src/core/ratelimit/ratelimit.ts`, `api/chat/presence/route.ts`.
It used the `chat` bucket, which is the **10/min budget for sending**. An
unattended beat every 25s (more on every wake, and it only runs at all when
realtime is down) quietly ate three or four of those - so typing normally in a
room with a dead socket could answer **"Too many requests"**, which reads as the
chat being broken. Presence now has its own `chatPresence` bucket (30/min per
user; it is a cheap upsert of the caller's own row). Pinned by a new test so the
buckets cannot silently merge again.

**⚡ Roster latency 25s → 15s.** That interval *is* how fast a join shows up when
realtime is down, and 25s is slow enough to read as "the online count is not
live". It costs nothing on a healthy deployment - the beat returns before the
fetch while the channel is up - so this only spends requests on the broken path.
**Measured** end to end with realtime off: a join appears in **10.9s** and a
departure in **15.1s** (both were up to 25s, and 90s before the leave beacon
existed). With realtime working, both are instant via presence sync.

**Files:** `src/shared/hooks/useRealtime.ts` ·
`src/modules/community/components/ChatClient.tsx` ·
`src/core/ratelimit/ratelimit.ts` · `src/app/api/chat/presence/route.ts` ·
`src/lib/__tests__/api-rate-limits.test.ts`.

**Gates:** typecheck ✅ · lint 0 errors / 37 warnings (unchanged) · 419/419
tests ✅ · build ✅.

**Still owner-side:** none of this makes realtime *connect* if it is not
configured - it makes the site work properly when it does not. The decisive
check is still whether an image upload in the room returns 501: `realtimeEnabled`
and `storageEnabled` are the same credential pair (`docs/HANDOFF.md §8`).

---

## 2026-08-03 (5) — The Following count that never moved, and a page that scrolled under every modal

Reported: *"unfollow ke baad bhi numbers show hote hai"* — unfollow someone and
the **Following** number on the profile stayed exactly where it was.

**🔴 The count had no way of ever changing** — `src/app/api/follow/route.ts`,
`ProfileFollow.tsx`. Two independent halves of the same gap:

- `GET /api/follow` returned `followers` and the viewer's `following` boolean.
  It **never returned a following-count**. So there was nothing for the client
  to read.
- `ProfileFollow`'s `sync()` set `followers` and the boolean, and **never
  touched `followingCount`**. So even if the API had returned it, nothing would
  have set it.

The number was frozen at whatever the server rendered on page load, and only a
hard refresh moved it. Both ends are fixed: the API returns `followingCount`,
`sync()` applies it, and `POST` now broadcasts on **two** realtime channels —
the target's (carrying the new `followers`) and the actor's own (carrying their
new `followingCount`), so your own profile open on a second device updates the
number that actually moved. Previously only the target was told.

On top of that the tap is now **optimistic**: `RowFollow` fires the delta before
the request leaves, with a revert if it fails, so the number moves with the
finger rather than a round trip later. It is applied only on your **own**
profile — following someone from a stranger's follower list changes how many
people *you* follow, not their count, and applying it blindly made someone
else's number jump. The value also animates on change, because an unfollow used
to swap a digit silently: no feedback that the tap had landed, which reads as
"nothing happened" from the outside just like a stale number does.

**Verified end to end** against a real Postgres, on a 390px phone and a 1440px
desktop viewport: `1 Following` → instant `0` on tap → `0` still after the
server settles, on both.

**⚡ Data fetching** — `GET /api/follow` ran its queries **serially** (follower
count, then the viewer's follow row). All three are independent, so they now run
in one `Promise.all`. And the list itself is **prefetched** on the hover /
touch-down that precedes the tap, cached for 30s and invalidated on any
follow/unfollow — measured: 2 list requests fire on hover and the dialog opens
with rows already painted, **no spinner frame at all** (it used to fetch on
mount, so every open showed "Loading…" for a full round trip).

**🐛 Every modal on the site let the page scroll underneath it** —
`src/shared/hooks/useScrollLock.ts` (new), `SmoothScroll.tsx`,
`CommandPalette.tsx`, `FollowListModal.tsx`.
`document.body.style.overflow = "hidden"` was the lock, and it does not work
here: **Lenis runs its own rAF loop and drives the scroll position with
`window.scrollTo`, which does not consult `overflow` at all.** Measured with the
follow list open, one wheel gesture: the profile behind it moved **171px** at
390px wide and **20px** at 1440px. `useScrollLock` stops Lenis as well (the
instance registers itself with the helper rather than being threaded through the
tree), nests so two stacked dialogs release correctly, and is a no-op beyond the
overflow half when smooth scroll is off (reduced motion, touch). Applied to the
follow modal and to the command palette, which had the identical bug.
**Verified**: page held at 0 with the dialog open in both viewports, and scrolls
again after Escape — in dark *and* light theme, so the lock is not left stuck on.

**🎨 The counts are chips now, not bare text.** They were small text with 4px of
padding: a **20px** tap target, well under the 44px minimum, and easy to miss on
a phone. They now match the location / social / Premium chips directly beside
them on the same card — gold for Followers, mint for Following, both on the
existing tinted-ring pattern — measured at **102x36**. Theme-checked: the number
resolves to `#f3d488` on dark and `#9a6310` on light, both via the existing
`html:not(.dark)` overrides rather than new colour values.

**Files:** `src/app/api/follow/route.ts` ·
`src/modules/profile/components/ProfileFollow.tsx` ·
`src/modules/profile/components/FollowListModal.tsx` ·
`src/shared/hooks/useScrollLock.ts` (new) · `src/lib/useScrollLock.ts` (new
shim) · `src/shared/components/SmoothScroll.tsx` ·
`src/shared/components/CommandPalette.tsx`.

**Gates:** typecheck ✅ · lint 0 errors / 37 warnings (unchanged) · 418/418
tests ✅ · build ✅.

---

## 2026-08-03 (4) — Ghost users in the online count, and an alarmist status label

A screenshot of the live room showed **"RECONNECTING" and "2 online" side by
side**. Both halves of that are worth reading carefully: the count was working
(the server-backed presence added in (6) was doing its job while the websocket
was down) — but it was **stale**, and the label was **overstating the problem**.

**🔴 Someone who left stayed "online" for up to 90 seconds** —
`src/app/api/chat/presence/route.ts`, `ChatClient.tsx`.
The heartbeat ran every 45s against a 60s… no: a **90s** window, and there was
**no leave signal at all**. So the only way to stop being listed was for the
window to expire. Close the tab and you were still in the room for a minute and
a half. The count was never fake — it was stale, which looks identical from the
outside. My own design, from (6).

- A **leave beacon** now fires on `pagehide` and on the tab being hidden, and on
  SPA unmount. `navigator.sendBeacon`, not `fetch`: the page is being torn down
  and an ordinary request gets cancelled, whereas a beacon is queued by the
  browser and still carries cookies so the session resolves. `pagehide` rather
  than `beforeunload` because that is the one that actually fires on mobile
  Safari.
- The server handles `{ leave: true }` **before** the rate limiter — it is a
  delete of the caller's own single row, it is the thing that prevents ghosts,
  and a throttled goodbye is worse than none.
- Window 90s → **60s**, heartbeat 45s → **25s**. With clean exits handled by the
  beacon, the window only has to cover what cannot say goodbye (a crash, a
  killed tab, a dead network), and two missed beats absorb a blip without
  leaving someone listed who has gone.
- Rows are pruned opportunistically on ~2% of reads (same trick `/api/track`
  uses), so the table stays bounded without a cron this plan does not have.

**Verified end to end against a real Postgres:** user1 → `online=1`; user2 joins
→ `online=2`; **user2 leaves → `online=1` on the very next beat**, and their row
is gone from the table.

**🟠 "Reconnecting…" was scaring people about a room that works** —
`ChatClient.tsx`.
In alarming amber, next to a live member count. When the websocket is down the
room is *not* broken: messages arrive on the 10s poll, presence comes from the
heartbeat. The screenshot showed exactly that contradiction. It now reads
**"Synced"** in a calm neutral — an honest description of the fallback rather
than a warning about it. The tooltip still carries the full detail and the
underlying Supabase error for anyone debugging.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings (unchanged) ·
418/418 tests ✅ · build ✅ · leave/rejoin behaviour measured against a real DB.

---

## 2026-08-03 (3) — The stuck news story: previous diagnosis was wrong

**Correction first.** The (1) entry blamed a **future-dated** timestamp and gave
`rankNews()` a guard for it. A screenshot of the live story disproves that: it
renders **"just now"**, and `timeAgo()` renders a future date as *"recently"*
(`ms > now + 60_000`). So the date is not in the future — it is **≈ now, on every
load, days apart**. The `rankNews` guard stays (a future date *is* a real failure
mode and it is now handled), but it was not this bug.

**What it actually is** — `src/modules/news/lib/news.ts`.
The date is read as
`pubDate ?? published ?? updated ?? dc:date`. In Atom, **`<updated>` is
*last-modified*, not published**, and plenty of CMSs bump it every time the entry
is regenerated. So a moving last-modified was being preferred over a stable
`<dc:date>`, the story's timestamp rolled forward on every fetch, and it read as
"just now" for ever — permanently the newest thing in the feed, permanently rank
1, permanently in the breaking hero. Reordered to
`pubDate ?? published ?? dc:date ?? updated`, with `updated` as the last resort
it should always have been. **3 new tests** pin the precedence.

**And a fix that works whatever the upstream does** —
`src/modules/news/components/NewsClient.tsx`.
Correcting the timestamp is necessary but not sufficient: a feed can keep
claiming a story is new in several ways (a republish, a rolling "latest"
endpoint, a CMS quirk we have not seen yet) and we cannot police any of them.
So the breaking hero now remembers which stories it has already shown on this
device and rotates past them. If everything high-impact has had its turn it falls
back to showing them anyway — a stale hero beats an empty one.

Kept in `localStorage`, not server-side, deliberately: it is presentation state,
and this project is over its Supabase egress quota, so it must not cost a
request. Capped at 120 ids so it cannot grow without bound.

Two React details worth keeping: the seen-list is read in a **lazy initialiser**
(guarded for SSR, where `localStorage` does not exist) rather than an effect, and
the write-back goes to a **ref plus localStorage without `setState`** — feeding it
back into state would re-run the memo, drop the story being displayed out of the
unseen set, and swap the hero out from under the reader mid-view. The filter is
meant to apply on the *next* visit, not this one. Warnings stayed at 37.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings (unchanged) ·
**418/418 tests** ✅ (415 + 3) · build ✅.

---

## 2026-08-03 (2) — Dialogs made opaque; hero button stops depending on the chain

**Dialogs were rendering body text on top of photographs** —
`src/app/globals.css` (new `.panel-solid`), `NewsClient.tsx`,
`BriefingBlock.tsx`, `FollowListModal.tsx`.

`.glass` and `.surface` are translucent by design: a white wash plus a backdrop
blur, with **no opaque colour of their own**. That reads beautifully for a card
sitting ON a page and badly for a dialog sitting OVER one — the news reader
showed the feed and its article thumbnails straight through the briefing text,
and the followers list showed the profile's avatar, bio and stat tiles through
the names. Blur softens that; it cannot fix it, because the contrast underneath
is arbitrary.

New `.panel-solid` supplies only the solid base, composed *with* the existing
material so border, shadow and blur are unchanged. **Two ordering traps, both
easy to reintroduce:**
- It must be declared **after** `.glass`/`.surface`. Their `background:`
  shorthand resets `background-color` to transparent, so a rule declared earlier
  is silently wiped by the very class it is meant to sit under. (First attempt
  did exactly that.)
- It cannot be combined with a Tailwind `bg-*` on the same element — that also
  sets `background-color` and wins. `BriefingBlock`'s 6% gold tint is therefore
  **pre-blended** to `#181411` (that same `#e2a72f` at 6% over `#0b0b0f`), so it
  looks identical over a dark background and is simply opaque now.

Also fixed while there: the followers modal was `max-h-[75vh]`. On a phone `vh`
measures the viewport as though the browser chrome were hidden, and the bottom
nav covers the lower part of the screen, so the last row and the end of the
scroll sat behind it. Now `min(75svh, 100svh - 9rem - safe-area)`. The news
reader moved `90vh` → `90svh` for the same reason — its action bar sat under the
address bar.

**Hero "View products" no longer depends on the Link → router → listener chain** —
`HashScroll.tsx` (exports `scrollToHash`), `Hero.tsx`.
Reported dead on mobile **three separate times**. Each fix was measured correct
here — the anchor lands at exactly `scroll-padding-top` on 320/360/390/1280 — and
still failed on the owner's phone. That pattern says the failure is somewhere
between the tap and the scroll, not in the landing maths, and continuing to
re-measure the landing was not going to find it.

So it stops depending on that chain: the button now calls `scrollToHash()`
directly from its own `onClick`. `href` stays for semantics, SEO and
middle-click; `preventDefault()` fires **only when the target actually exists**,
so removing `#products` some day degrades to normal browser behaviour rather
than a silently swallowed click. `HashScroll`'s document listener stays as the
general case for every other in-page anchor. Verified end to end through the new
path at 320/390/1280 — all land at 88px with the heading visible.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings · 415/415 tests ✅ ·
build ✅ · `.panel-solid` resolves to `rgb(11,11,15)` and the briefing to
`rgb(24,20,17)` in the built CSS (both opaque, checked in a real browser).

---

## 2026-08-03 — News feed unpinned; two self-inflicted egress regressions walked back

**Supabase is over its free egress quota: 6.56 GB used of 5 GB, with the org
restricted from 31 Aug 2026 if it stays over.** That reframes anything that adds
requests, including two things shipped hours earlier in (6).

**🔴 A single story could pin itself to the top of the news feed for ever** —
`src/modules/news/lib/news.ts`.
`rankNews()` scored freshness as `Math.max(0, (now - publishedAt) / 3_600_000)`.
That clamp means a story dated in the **future** gets an age of 0 — the maximum
possible score for its impact tier — and keeps getting it on every re-rank, for
as long as the date stays ahead of now. One feed item with a broken timestamp
camps at rank 1 indefinitely. That is the "yeh story hatti hi nahi, kai dino se
top pe hai" report.

`timeAgo()` **twenty lines below already guards this exact case**
(`ms > now + 60_000` → "recently"). The guard existed; the function that decides
*ordering* simply did not have it. Same shape as every other bug found in this
codebase this week: the correct handling sitting next to the place that skips it.

Clamping to `now` would not fix it either — the story would score as brand new on
every pass, for ever. A broken date is now given a **real, finite age** (48h) so
normal decay applies: still visible, since it is probably a genuine story with a
bad timestamp, but unable to camp. 6h of tolerance first, because publisher clock
skew is normal and is not a broken feed. **3 new tests**, including one pinning
the tolerance so a slightly-skewed story still ranks as fresh.

**🟠 Two egress regressions from (6), walked back** — both mine, both shipped
before the quota was known:
- `ChatClient.tsx` — the presence heartbeat checked `liveRef` **after** the fetch
  had already gone out, so every open room paid a round trip every 45s purely to
  throw the answer away. It now skips the **request**, not just the result:
  realtime presence is exact when the channel is up, so the heartbeat only needs
  to run when it is not.
- `NavActivity.tsx` — the fast unread poll shipped at 20s. Every one of those is
  a database query, and database responses are Supabase egress. Now **30s**,
  halving the added cost while still being far better than waiting a full minute
  for a DM badge. The focus/visibility listener is what actually makes it feel
  instant, and that costs one request per return rather than a permanently
  faster loop.

**Where the 6.56 GB actually goes is NOT yet established.** Supabase egress is
database results + Storage downloads + realtime frames, and the split is only
visible in the owner's dashboard (Reports → Usage). Two candidates are known from
reading the code and are recorded rather than acted on blind:
- `POST_CARD_SELECT` (`src/modules/community/lib/post-select.ts`) selects
  `content: true` — the **full article body** — for every card in every list,
  solely to compute a reading time that is then thrown away. It is stripped
  before reaching the browser, but it crosses the Supabase→function boundary on
  every ISR regeneration of `/`, `/research` and every article's related-posts
  block. `readMinutes` is already precomputed at all three call sites, so the
  body is pure waste; removing it needs a stored word count (a column) to keep
  the label accurate.
- Supabase Storage already uploads with `cache-control: 31536000`
  (`storage.ts:114`), so image egress is first-view only. **That lever is already
  pulled** — do not "fix" it again.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings · **415/415 tests** ✅
(412 + 3 new) · build ✅.

---

## 2026-08-02 (6) — Chat online count no longer depends on realtime; DM badge unstranded

Owner reported the chat still showing "Reconnecting…" with 0 online after the
(3) fix, plus DM notifications not arriving. The (3) fix was correct — it made
the room *survive* a dead channel (retry + always-armed polling) — but it never
addressed **why the channel dies**, and presence still had realtime as its only
source. So messages flowed and the count stayed 0.

**The thing that makes this confusing: there are FOUR Supabase env vars, in two
independent pairs, and either pair can be missing on its own.**

| Half | Vars | Powers |
|---|---|---|
| Client | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | subscribing, **presence = the online count** |
| Server | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | `broadcastEvent()` = **DM ping, chat fan-out, bell** |

`realtimeEnabled = storageEnabled` — the **same pair as image uploads**. So:
**if uploads return 501 in production, server-side realtime is dead too**, and
that one check identifies it in ten seconds.

**Server-backed presence** — `prisma/schema.prisma` (new `ChatPresence`),
`src/app/api/chat/presence/route.ts` (new), `ChatClient.tsx`.
The online count is now a plain DB query, not a WebSocket feature. Each open room
heartbeats every 45s; one upserted row per user per room, so it grows with
distinct members rather than traffic, and stale rows fall out of a 90s window on
read. Realtime presence still wins when the channel is healthy (it is instant and
authoritative on join/leave) — this only fills the gap. Verified end-to-end
against a real Postgres: anonymous → 401; one member → `online=1`; a second
joins → `online=2` with both names resolved.

**`broadcastEvent()` no longer fails silently** — `src/core/realtime/realtime.ts`.
It opened with `if (!realtimeEnabled) return`, so unset server credentials turned
off every live push on the site — DM badge, chat delivery, notification bell —
with **nothing anywhere saying so**. The symptom is "notifications don't arrive",
which reads as a client bug and sends you looking in the wrong place entirely.
Now logs once, loudly, naming the vars and the uploads-501 correlation.

**The chat status pill now says why** — `ChatClient.tsx`. `subscribe()`'s second
argument (the underlying error) was being discarded. "Reconnecting…" looks
identical whether the anon key is wrong, the project is paused, the connection cap
is hit, or the network blinked. The reason is now captured, logged, and attached
as a `title` tooltip — same label, same colours, same layout.

**DM badge no longer stranded on a 60s poll** —
`src/modules/notifications/components/NavActivity.tsx`. When the server half of
realtime is unconfigured, `broadcastEvent()` is a no-op and this poll is the
*only* thing that ever moves the badge; 60s is fine as a backstop to realtime but
poor as the sole path. The two cheap unread counts (`/api/dm/unread`,
`/api/chat/last-activity` — small indexed queries) now also refresh every 20s and
on tab focus. The full notification list stays on 60s.

⚠️ **This adds a table.** `ChatPresence` is purely additive and cannot break
existing queries, but production must run the migration — see the standing owner
action. Route count goes 125 → **126** (`/api/chat/presence`, dynamic); that is
the only route-table change and it is intentional.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings · 412/412 tests ✅ ·
build ✅ · presence endpoint verified end-to-end against real Postgres.

---

## 2026-08-02 (5) — Cross-device responsive & scrolling audit (design frozen)

Full report: `docs/AUDIT-2026-08-02-responsive.md`. Measured across **9 viewports ×
18 pages** on a production build, plus a dedicated editor pass reached by standing up a
local Postgres with the real schema and minting a genuine next-auth session — the
dashboard renders its error state without one, so the Publish editor is otherwise
untestable.

**The site was in much better shape than the brief implied.** Zero horizontal overflow,
zero nested scroll traps, zero z-index conflicts, zero JS errors, at every size.
`/community` and `/messages` already used `h-[100svh]`; the navbar sheet already used
`max-h-[calc(100dvh-6rem)]`. Two real defects were found.

**🔴 Mouse wheel scrolled nothing on desktop** — `src/shared/components/SmoothScroll.tsx`.
Lenis intercepts wheel events globally. Its escape hatch, `data-lenis-prevent`, was
styled in `globals.css` but applied to **zero elements**, so every inner scroll container
lost the wheel to the page. Measured with the Publish editor full of text: at 1280×800
and 1920×1080 the wheel left `scrollTop` at 0 and scrolled the page instead; phones were
fine only because Lenis already opts out on coarse pointers, which is why this never
surfaced in mobile testing. It affected the rich-text editor, the news briefing, every
textarea, the chat list and the mobile nav sheet. Fixed with Lenis's `prevent(node)`
predicate detecting scrollability directly, rather than annotating containers by hand
where a new one would silently miss out. All six viewports now scroll and stay contained.

**🟠 Publish editor was a fixed 416px on every device** —
`src/modules/community/components/PostContentEditor.tsx`. On a 320×568 phone that is 73%
of the screen for one field, with its bottom 133px below the fold. `h-[26rem]` →
`h-[min(26rem,62svh)]`: `min()` keeps the approved desktop size **exactly** (26rem wins
above ~671px tall, so 430/768/1280/1920 measured pixel-identical at 416px) and only
shrinks on short screens (320×568 → 352px). `svh` not `vh`, so mobile browser chrome
cannot push the box under the address bar.

**🟡 Tap targets** — 19 unique elements under 28px, smallest the chart range pills at
23×18. Grown with a transparent pseudo-element (`.tap-target-y` / `.tap-target-all`) so
the box, padding and font size are untouched and **nothing moves**; verified by
hit-testing rather than by measuring the box. Axis chosen per case: controls 2px apart
get vertical-only, because both expanding toward each other would overlap and the later
one silently steals the tap. Inline links inside sentences deliberately left alone —
WCAG 2.5.8 exempts them and expanding them would steal taps from neighbouring text.

**Dismissed after investigation, recorded so they are not re-raised:** the homepage
`CLIPPED` flags are `.vscroll-mask` (a `mask-image` fade — the clipping *is* the effect)
and `.starfield`; the `/profile` HTTP 500 at every viewport was `NEXTAUTH_SECRET` unset
in the harness (307 once set); the touch-swipe `scrollTop 0` is synthetic `TouchEvent`s
not driving Chromium's compositor, not a bug.

Design untouched: no change to tokens, colours, spacing, typography, component structure
or animation. The only rendered-geometry change anywhere is the editor height on
viewports under ~671px tall.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings · 412/412 tests ✅ · build ✅ ·
route table **identical to main** (125 / 22 static / 103 dynamic, zero rows differ).

---

## 2026-08-02 (4) — Functions moved to Mumbai; the serial round trips removed

Owner asked why everything feels slow to open, and whether the answer is "do the
processing in the backend". **It is not a processing problem.** Nothing here is
CPU-bound — it is waiting.

```
functions:  iad1  (Washington DC)      ← Vercel default, never configured
database:   Supabase, Mumbai            ← confirmed by the owner
```

`vercel.json` was `{}`, so the function region had never been set and defaulted
to `iad1`. Every DB round trip therefore crosses the Atlantic and the Indian
Ocean: **~250 ms each, fixed, no matter how the query is written.** A handler
doing four serial queries spends a second doing nothing but waiting. Most users
(and the owner) are in India, so their request pays that geography twice — phone
→ Virginia, Virginia → Mumbai, and back.

**`vercel.json` → `{ "regions": ["bom1"] }`.** One line, and by far the largest
single lever available: ~250 ms → ~5 ms per round trip, and India-based visitors
now reach the function in ~30 ms instead of ~250 ms. (`vercel.json` is strict
JSON and cannot carry comments, which is why the reasoning lives here.)

**The region is now set in TWO places, and `vercel.json` is the one that wins.**
While verifying this, the owner also changed it in the Vercel dashboard
(Project → Settings → Functions → Function Region → Asia Pacific / `bom1`) and
redeployed. Both now say `bom1`, so there is no conflict today — but per Vercel's
docs, *"if a deployment defines the `regions` configuration property in
`vercel.json`, the Vercel Function Region setting is ignored"*. So the dashboard
control is now **inert**: changing it there will appear to work and do nothing.
Treat `vercel.json` as the source of truth (version-controlled and reviewable),
and if you ever need a different region, change it there — not in the dashboard.

⚠️ **Read the right number when verifying.** There are two regions and only one
of them is this:
- **Build region** — the build log's first line, *"Running build in Washington,
  D.C., USA (East) - iad1"*. Not configurable on Hobby, and it says `iad1`
  regardless of any of this. It caused a false negative during verification.
- **Function region** — Deployment Details → "Function Region". This is the one
  that governs the DB round trip.

Checking from outside the dashboard, on the deployment itself:
```js
const r = await fetch('/api/ticker', { cache: 'no-store' });
r.headers.get('x-vercel-id');   // contains the region the function actually ran in
```

**Serial round trips removed** — each of these had independent queries awaited
one after another, so the fix is a reorder with no behaviour change:
- `api/chat/messages` GET — history and the pinned banner are independent, now
  `Promise.all`. **This is chat-open time.** The `/community` *page* already did
  exactly this, with the comment "run in parallel (independent queries)"; the API
  route serving the same two pieces of data did not. Saves 1 round trip.
- `api/journal/challenges/[id]` GET — three independent reads (all trades, my
  trades, day notes) collapsed into one `Promise.all`. Saves 2.
- `api/posts/[id]/like` POST — the post lookup and the existing-like lookup do
  not depend on each other. Saves 1. The write gate is unchanged: a like is still
  only created after the published check passes.

**Not done, deliberately:** `/u/[username]` (audit finding #11). The audit rates
it its **lowest-confidence** item — relation-keyed counts may plan worse than
id-keyed ones, and it wants `EXPLAIN ANALYZE` against real cardinality first.
Shipping it blind on the strength of "it looks parallelisable" is how the last
few silent regressions in this repo happened.

**Message send was already optimistic** and needed nothing: `doSend()` renders
the message immediately with a temp id and reconciles against the server copy
(and against the realtime echo). What made it *feel* slow was the round trip
underneath it, which the region move addresses.

**The most dangerous comment in the codebase, corrected** (`src/core/auth/auth.ts`).
It read "(routes always re-check DB anyway)" as the justification for
`MEMBERSHIP_TTL_MS`. That is **false** — `requirePermission()`, `getSessionUser()`
and `getAdminSession()` all read JWT claims only, nothing re-verifies against the
database. So the token *is* the authorization decision and that refresh is the
only thing that makes revoking a role or membership take effect. A latency audit
read that sentence, concluded the TTL was redundant, and recommended raising it
to 30 minutes — which would have let a just-demoted admin keep admin for half an
hour. It was withdrawn only because someone went and checked. The comment now
says so, at length, next to the constant.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings · 412/412 tests ✅ ·
build ✅ · route table **identical to main** (125 / 22 static / 103 dynamic, zero
rows differ).

---

## 2026-08-02 (3) — Live features that stopped being live: chat and news

Two owner reports, both traced to the same shape of bug: a fallback that was
written, and then gated off so it could never run.

**1. Community chat: "online" stuck at 0, header stuck on "Reconnecting…"** —
`src/modules/community/components/ChatClient.tsx`.
The live-updates effect did `if (realtime configured) { …channel…; return }`, so
**the 10s polling fallback below it was never armed on a configured deployment**.
And the `subscribe()` callback only ever recorded `SUBSCRIBED` — `CHANNEL_ERROR`,
`TIMED_OUT` and `CLOSED` were read and dropped, with no retry. supabase-js does
not resurrect a channel whose join errored, so between them a single failed or
dropped subscription left the room with:
- no live channel,
- no retry,
- and no fallback.

Messages stopped arriving, presence sat at 0, and the header showed
"Reconnecting…" indefinitely while **nothing was reconnecting** — the label was
the only part of it doing any work.
- The poll is now always armed and early-returns while the channel is healthy
  (via a `liveRef`), so a working room still issues **zero** extra requests and a
  broken one recovers within 10s.
- A non-`SUBSCRIBED` status now tears the channel down and rebuilds it with
  exponential backoff (1s → 30s cap).
- Restructured so the retry re-runs `connect()` only. An earlier revision of this
  fix had retry re-run the whole `start()`, which would have armed a **second**
  poll interval on every retry — caught before it shipped.

**2. News: every tab except one was frozen** — `src/modules/news/components/NewsClient.tsx`.
The refresh loop opened with `if (category !== "All" || query) return`. So on
Bitcoin, DeFi, Tech, For You, or any search, **nothing refreshed at all** — the
feed was frozen from load until you navigated away and back. That is the "news
stuck ho jata hai" report, and it was every tab but the default one. `fetchPage`
already sends the active category and query, so the gate was never load-bearing.
- Refresh now runs on every tab and every search.
- Added a refresh on `visibilitychange` / `focus`, so returning to the tab updates
  immediately instead of waiting out the remainder of a 90s tick — one request per
  return, rather than a faster background poll for everybody.
- New stories are inserted **directly** when the reader is at the top of the feed
  (`scrollY < 200`) instead of waiting behind the "N new stories" pill. The pill
  exists to stop the feed jumping under someone reading partway down; at the top
  there is nothing to jump.

**3. News: the same story from three outlets** — `src/modules/news/lib/news.ts`.
`eventKey()` did `.slice(0, 6)` **before** `.sort()` — the first six long words in
*title order*, then sorted. So the key was position-sensitive in exactly the case
it existed to handle: two outlets reporting one event with the headline
rearranged produced different keys, and both were shown. Demonstrated:

```
"Bitcoin surges past 100000 as spot ETF inflows hit record levels"
   -> "100000 bitcoin inflows past spot surges"
"Spot ETF inflows hit record levels as Bitcoin surges past 100000"
   -> "bitcoin inflows levels record spot surges"     ← different key, same story
```

The `w.length > 3` filter made it worse by doing the opposite of what it looks
like: it drops **ETF, SEC, BTC, Fed, DOJ** — the tokens that identify a story —
while keeping *with, from, says, after, amid, this*, the words every headline
shares. `eventKey("Ruling with news from the SEC")` was literally
`"from news ruling with"`.
- Replaced the length filter with a stopword list, and `length >= 3` so
  three-letter identifiers survive.
- Removed the truncation; the key is now the full sorted significant-word set.
- Added a similarity pass on top: anything that clears the exact key is compared
  by Jaccard overlap (≥ 0.6) against already-kept stories within a 36h window, so
  "approves"/"approved" wordings still collapse without a recurring weekly
  headline swallowing months of separate pieces.
- **5 new tests** pin all of this, and were checked against the old
  implementation first to confirm they fail on it — the previous two tests passed
  with the bug in place.

**4. Last 3 duplicate files shimmed** — `src/modules/auth/lib/{auth,email}.ts`,
`src/shared/utils/jsonld.tsx`. The earlier de-duplication only scanned
`src/components`; a repo-wide scan found three more byte-identical non-shim pairs,
all with **0 importers** on the copy that looks canonical. Same silent-no-op
hazard as before, and `auth.ts` in particular is where the next round of latency
work has to land.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings · **412/412 tests** ✅
(407 + 5 new) · build ✅ · route table **identical to main** (125 / 22 static /
103 dynamic, zero rows differ).

---

## 2026-08-02 (later) — Anchor jump fixed without JS · share card made fast

Follow-up to the entry below, after the owner reported "View products" **still**
dead on their phone and the share card slow.

**The earlier fix was correct but incomplete.** `HashScroll` corrects the anchor
landing, and it does — measured at 320/360/390px, logged-in, against a production
build. But it is JavaScript, so it can only help *after* React hydrates. A
navigation link must not depend on that. Anything that stops hydration (a stale
bundle, an old browser, a slow phone that has not finished) leaves the reader with
the original broken behaviour and no fallback.

**Root cause removed at the source** — `src/app/globals.css`.
`.sect-cv` no longer sets `content-visibility: auto` / `contain-intrinsic-size: auto
720px`. That guess is what made anchor jumps land in the wrong place: sections
report 720px until they render once, so the browser computes the target from
placeholder heights and everything grows underneath the scroll.

**Measured, JS disabled, native anchor only** (load `/#products` directly):

| viewport | old rule restored on the wire | rule removed |
|---|---|---|
| 320px | **800px** off | **88px** — on target |
| 360px | **679px** off | **88px** — on target |
| 390px | on target | on target |
| 1280px | on target | on target |

390px landing correctly either way is exactly why this looked fine in earlier
headless runs and broke on a real handset — it is viewport-band dependent.
`HashScroll` stays as belt-and-braces (it also covers late-loading images).

**What it costs:** off-screen homepage sections are painted again — a scroll
micro-optimization on one page, traded for a core navigation path that works on
every browser, with or without JS. `.cv-auto` (news feed cards) keeps
`content-visibility`; no anchors point into it. Reversible in one line if the
homepage ever measures badly.

**Share card speed** — three separate costs, all real:
- `src/app/tools/share/points-value/[id]/page.tsx` — `getCard()` is now wrapped in
  React `cache()`. Next calls `generateMetadata()` and the page component
  separately and **both** fetched the card, so the identical query ran twice per
  request. Against Supabase in Mumbai from a US region that is ~250ms of round
  trip paid twice, on a page whose whole job is to render one row.
- `src/app/api/tools/share/points-value/[id]/route.tsx` — the OG PNG had
  `s-maxage` only, so the browser re-requested (and the origin re-rendered with
  satori) on every view. Now `max-age=1y, immutable`: the id's content can never
  change. ⚠️ The generic fallback deliberately does **not** inherit it — it is
  served for a missing id *and* a transient DB failure, and caching "no card" for
  a year would make a two-second blip a permanently broken link. It gets its own
  `s-maxage=60`.
- `src/modules/tools/components/PointsValueCalculator.tsx` — the pre-opened tab
  now paints a branded "Building your share card..." screen immediately instead of
  sitting on white `about:blank` for the whole create-then-load chain. Built with
  DOM property assignments, not `document.write` + inline `<style>`, so a strict
  `style-src` cannot silently drop it.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings · 407/407 tests ✅ ·
build ✅ · route table **identical to main** (125 / 22 static / 103 dynamic, zero
rows differ) · `/`, `/tools`, `/markets`, `/news`, `/research` all 200 with zero
horizontal overflow and no page errors · share placeholder confirmed painting
while the create call is in flight.

**Observable — run, and the answer recorded (pre-merge Step 4).** The owner
confirmed both fixes working on the PR's Vercel preview deployment, on the real
handset that had been failing, *before* the merge. That is the check that had
been missing: #207 shipped on measurements that all passed here and still left
the button dead on their phone, because every local run happened to be at 390px -
the one width that lands correctly either way. Verifying on the preview URL on the
affected device is what closed it.

**Node version pinned** — `package.json` `engines.node` `">=22.0.0"` → `"22.x"`.
The open-ended range had no upper bound, so the day Vercel offers a newer major
the build would move to it with nothing in the repo changing, while CI stayed on
`.nvmrc` = 22. CI green, production on a different runtime: the same silent-drift
shape as the `db push || echo` swallow and the Tailwind content globs. Note the
Vercel build warning ("the Node.js Version defined in your project settings won't
apply") **does not go away** and is not meant to - it fires whenever `engines.node`
exists at all, and package.json winning is the intended arrangement, since that is
what keeps Vercel and `.nvmrc`/CI on one number.

---

## 2026-08-02 — Hero "View products" · points share · ticker ISR · 32 dead duplicate files

Three reported bugs, all reproduced and measured in a real browser against a
**production** build before and after. (Dev mode is not usable for this: the CSP
blocks `unsafe-eval`, which React needs in development, and the HMR socket does
not survive the proxy - three consecutive edits produced byte-identical results
because nothing was reloading. Verify UI behaviour against `next build && next
start`, not `next dev`.)

**1. Hero "View products" did nothing on mobile** — `src/shared/components/HashScroll.tsx` (new),
`src/components/HashScroll.tsx` (shim), `src/app/layout.tsx`.
Homepage sections carry `.sect-cv` (`content-visibility: auto; contain-intrinsic-size:
auto 720px`). Until a section has rendered once the browser sizes it from that 720px
guess. Measured cold, at 390px wide: `#about` reports 832px but is really 3853px;
`#products` reports its top at y=3487 but really sits at y=8242. So the anchor jump
scrolled to 3487, every section it passed rendered and grew on the way, and the target
ended up thousands of pixels lower. You land in About and it reads as a dead button.
Desktop mostly escaped because there the 720px guess is close to the truth (`#about` is
687px wide-screen); phones stack single-column, so the guess is off by 4-5x.
- Fix: intercept same-document hash clicks, scroll, then keep correcting until the target
  holds still for 350ms (budget 3s, abandoned instantly on any real scroll input). Not
  `hashchange` - the App Router navigates with `pushState`, which never fires it.
- **Measured, production build, native vs fixed:** 320px `#products` landed **888px** off
  and below the fold natively → **88px** (exactly `scroll-padding-top`, heading visible)
  with the fix. 390px and 1280px already landed correctly and still do.
- `content-visibility` is kept - it is a real mobile scroll win. The bug is the anchor
  jump, not the optimization.

**2. Points share opened a blank tab** — `src/modules/tools/components/PointsValueCalculator.tsx`.
`window.open("", "_blank", "noopener,noreferrer")` **always returns `null`** - per spec
`noopener` withholds the handle, that is its entire purpose. So `win` was never non-null,
the pre-opened tab was orphaned on `about:blank` (and on mobile it takes focus, hence
"blank page, go back, then the card appears"), and the code fell through to navigating the
*original* tab behind it. Verified in-browser: with `noopener` → `null`; without →
a live handle that navigates. Dropped `noopener`; the destination is our own same-origin
route, so the opener reference it was severing carried no cross-origin risk.

**3. `/api/ticker` regenerated on every single poll** — `src/app/api/ticker/route.ts`,
`src/modules/markets/lib/useTickerPoll.ts`.
`revalidate` and `s-maxage` were both 60s against a 150s client poll, so the cache had
already expired ~90s before each poll arrived - the short window bought zero extra
freshness and guaranteed a maximum-rate ISR write on the site's highest-traffic page.
Raised to 180s (`swr` 120 → 300) so most polls are served from cache. Directly targets the
750K/200K ISR Writes overage. Both files now carry a note that the two numbers are paired.
This was finding #3 of the 2026-08-01 latency audit, previously unfixed.

**4. 32 duplicate component files that silently swallowed edits** — `src/components/{ui,journal,orbital,tools}/*`.
The module refactor converted 97 files under `src/components` into re-export shims but left
32 as **byte-identical full copies** of their `src/modules` / `src/shared` twin. The live
import path resolved to the `src/components` copy, so editing the module copy - the one that
looks canonical - changed nothing. Found the hard way: fix #2 above was written into the
module copy and had no effect. All 32 converted to shims matching the existing convention,
so there is one source of truth per component. Affects the whole `/tools`, `/journal` and
orbital trees - i.e. exactly where the next round of work is headed.

Verification: typecheck ✅ · lint ✅ 0 errors (warnings 41 → 37) · 407/407 tests ✅ ·
build ✅ · route table 22 static / 103 dynamic, no `○ → ƒ` regression · `/tools` renders all
9 calculator tabs with zero console errors after the shim conversion.

---

## 2026-08-01 — Latency & resource-utilization audit (docs only, no source change)
Adds `docs/AUDIT-2026-08-01-latency.md`, a full pass over `319f722` for server latency,
caching and client weight, framed by the `iad1` (functions) → Mumbai (Supabase) region gap
that puts ~250ms on every DB round trip.
- **Route table re-measured and unchanged:** 124 routes · 22 static · 102 dynamic · 12 ISR,
  identical to the `2f34b83` baseline across 18 merged commits. No `○ → ƒ` regression.
- **Four previously-reported issues re-checked:** markets poll/window misalignment ✅ fixed at
  both layers; `env.ts` in the client bundle ✅ fixed; `/api/chat/last-activity` rendering
  dynamic ✅ true but correct (its `s-maxage=15` absorbs the poll); llama.fi 2MB payloads
  ⚠️ still unconfirmed - egress to llama.fi is policy-blocked from the agent environment.
- **New: `/api/ticker` has the same misalignment #190/#192 fixed for markets** - `revalidate`
  and `s-maxage` both 60s against a 150s poll, so every poll regenerates. It survived because
  `markets-poll-alignment.test.ts` globs `src/app/api/markets/*` only. Homepage-only, but that
  is the highest-traffic page.
- **New: `getServerSession()` discards its rotated cookie on the App Router path**
  (`next-auth/next/index.js:116-119,143` - the RSC branch passes a stub `res` whose
  `setCookie()` is a no-op), so `MEMBERSHIP_TTL_MS` never advances and every authenticated
  server request re-reads the user from the DB. 54 files are affected.
- **⚠️ The obvious fix for that is an authorization regression, and is documented as such.**
  `requirePermission()` (`src/lib/api.ts:97-101`) reads JWT claims only - nothing re-verifies
  against the DB - so that per-request refresh is the only thing making permission revocation
  timely. Raising the TTL would let a demoted admin keep admin for the length of the window.
  The comment at `src/lib/auth.ts:318` claiming "routes always re-check DB anyway" is **false**
  and is what made the bad fix look safe.
- **Bundle measurement restored.** `.next/app-build-manifest.json` does not exist under Next 16
  + Turbopack, so the method named in the `cost-check` skill cannot run. The per-route RSC
  manifest works instead; baseline recorded per route (`/dashboard` 232 kB gz, `/` 113 kB gz,
  shared floor 69 kB gz). three.js is on disk but never requested - `useWebglGate()` returns a
  literal `false` - so it costs zero transfer.
- **Confirmed clean, stated so the absence is informative:** no N+1 anywhere, all twelve polling
  components have visibility guards, realtime uses the shared singleton, no unconditional
  `getServerSession` on an anonymous path, and no dynamic page that could become static.
- Every `path:line` citation in the document was machine-checked against the tree; the route
  table was reproduced from a clean rebuild; `npm run test` green (52 files, 407 tests).

---

## 2026-07-31 — Make the live-verification step mandatory in the `pre-merge` skill
Process change, prompted by #190 shipping a fix that did not work.
- **The problem:** of everything merged this session, exactly one code change was checked against the
  live site - and that check proved it did not work. #190 had green CI, every pre-merge step passed, a
  verified build-log check, and a claimed "10x fewer regenerations". It changed `export const
  revalidate` when `s-maxage` governed the CDN, so the problem was still live after merge. It was caught
  only because the owner asked how to test it; the answer took four minutes.
- **Step 4 rewritten** from a vague "run Lighthouse on the preview" into a required contract: every PR
  body states (1) what changes on the live site, (2) the exact command or click path to see it, and
  (3) what result would mean it did **not** work. If there is no observable, the body must say so
  explicitly - writing that sentence is the point, because it catches a change that quietly does nothing.
- **Step 4 now appears in every row of the scaling table.** It was previously optional for all but the
  heaviest PRs and was skipped accordingly. For a docs-only PR, satisfying it is one sentence.
- **The constraint is written down** rather than worked around: Claude cannot reach xyzcrypto.io (egress
  policy, 403 on CONNECT), so every live check must be run by the owner. The division of labour is
  therefore fixed - Claude writes the exact one-liner, the owner runs it, Claude interprets. The failure
  mode is not that this is slow; it is Claude not writing the one-liner unless asked.
- **Added a table of useful observables by change type** (caching → `x-vercel-cache` + `age`; rate
  limiting → loop past the bucket and expect 429; `server-only` → browser console; schema → build log
  then exercise the feature; anything with a bare `catch {}` → the swallowed path).
- **Standing rules gain:** green CI is not permission to merge and neither is a passing internal check;
  no PR merges without a stated observable; the metric is not how many PRs merged but whether each one
  demonstrably improved the site.
- **Files:** `.claude/skills/pre-merge/SKILL.md` (incl. frontmatter, so the rule is visible before the
  skill loads) · `docs/changelog.md`.

## 2026-07-31 — Align markets `s-maxage` with polling; `revalidate` was the wrong layer
Follow-up to #190, which fixed the ISR window and left the CDN misaligned. **Corrects a claim #190
made.**
- **Measured on production**, `/api/markets/global` with `revalidate = 200` and `s-maxage=150`:
  `age` climbed `0 → 142 → 162 (STALE) → 19`. It went stale at **162s**, tracking the **150s header**,
  not the 200s export. **`s-maxage` governs the Vercel edge; `export const revalidate` does not.**
- **So #190 fixed a layer that does not drive edge regeneration.** The client polls every 180s and the
  edge went stale at 150s, so every poll still triggered a regeneration - the exact misalignment
  audit #6 described. Raised the six success-path `s-maxage` values to match: 200s for the 180s-poll
  routes, 320s for the 300s-poll routes. The short fallback values (45/30/60/120) stay deliberately
  brief so a degraded response does not stick.
- **Correcting #190:** it claimed `/api/markets/global` went "from a 20s window to ≈3m, ~10× the
  intended rate". That is wrong. The edge was on 150s throughout; the 20s was Next's internal ISR
  window. What the inner-hint fix actually bought is that the origin function stops re-fetching and
  re-parsing upstream APIs on every run - real Fluid CPU and bandwidth, not a 10× regeneration rate.
  The `cost-check` skill's trap 1b carried the same wrong figure and is corrected too.
- **How the wrong layer got verified as fixed:** #190 checked the build output's Revalidate column,
  which faithfully reports `revalidate` - the value that had just been changed. It cannot show the
  response header. The only way to know is to watch `age` and `x-vercel-cache` on the live site, which
  is now written into the skill as the check.
- **Two new assertions in `markets-poll-alignment.test.ts`:** `s-maxage` >= poll interval, and
  `s-maxage` == `revalidate` on any route setting both. The existing assertions passed the entire time
  the edge was misaligned - the second-worst thing after no test is one that measures the wrong layer.
  Regression-validated: reverting `global` to 150 fails both with readable messages.
- **`cost-check` skill gains trap 0**, ahead of everything else: `s-maxage` governs the edge, with the
  production measurement and the browser one-liner to re-check it.
- **✅ VERIFIED LIVE on production after deploy** (the check this PR's own rule now requires):
  `age` reached **182 while still HIT**, then went STALE at **202** and reset. Before the fix it was
  already STALE by 162. The edge now outlasts the 180s client poll, which was the objective.
  **Sized honestly:** with a 180s poll against a 200s window, the poll at t=180 hits a fresh entry and
  the one at t=360 regenerates - roughly one regeneration per two polls instead of one per poll, so
  about half the ISR writes from `/markets` traffic. Real, correct, and modest; not a multiplier.
- **Files:** 6 markets route handlers · `src/lib/__tests__/markets-poll-alignment.test.ts` ·
  `.claude/skills/cost-check/SKILL.md` · `docs/changelog.md`.

---

## 2026-07-31 — Keep `env.ts` out of the browser bundle (`import "server-only"`)
Closes deep-audit #3. `src/lib/env.ts` had no `server-only` guard, and three `"use client"` components
imported `userChannel` from `@/lib/realtime`, which imports it - so the whole env module shipped to the
browser.
- **Three problems at once, all closed:** (1) every visitor to `/journal` and any profile page got two
  `console.error` lines reading like a production outage - the bundler inlines `NODE_ENV=production` and
  eliminates the guard, so the "missing required env var" loop ran client-side where `process.env` is
  `{}`; (2) the server env's *shape* shipped in public JS, including `SUPABASE_SERVICE_ROLE_KEY` as a
  schema key; (3) `broadcastEvent`, which sends the service-role key as an `apikey` header, sat in a
  public chunk. No values ever leaked - Next does not define non-`NEXT_PUBLIC_` vars for the client
  build - but it was one config change away from being a real exfiltration path.
- **Fix:** the four pure channel-name constants moved to a new `src/lib/realtime-channels.ts` with **zero
  imports**; the three client components import from there; `realtime.ts` re-exports them so the ~20
  server call sites are untouched; `env.ts` now carries `import "server-only"`.
- **Verified by dependency graph, not by grep:** traced all 121 `"use client"` files transitively -
  3 reached `env.ts` before, **0 after**.
- **The guard is enforced by the build, and that was proven** by deliberately re-adding a client→env
  import and confirming `next build` exits 1 with `'server-only' cannot be imported from a Client
  Component module`.
- **A real regression this introduced, and its fix:** `server-only` is a Next *build-time alias*, not an
  npm package, so vitest could not resolve it and **8 test files stopped loading** with "Cannot find
  package 'server-only'". Fixed with a test-only alias to a no-op stub (`test/stubs/server-only.ts`)
  rather than adding a production dependency - vitest runs in Node, which *is* the server, so there is
  nothing for the guard to reject there. The four pre-existing `server-only` modules never surfaced this
  because no test imports them.
- **`src/lib/__tests__/realtime-channels.test.ts`** pins that the new module stays import-free and that
  the wire-format channel names don't drift (a rename silently stops delivery rather than erroring). Its
  first version searched the whole file for `@/lib/env` and failed on its own explanatory comment - now
  it matches import statements only.
- **Files:** `src/lib/realtime-channels.ts` (new) · `src/lib/env.ts` · `src/lib/realtime.ts` · 3 client
  components · `vitest.config.ts` · `test/stubs/server-only.ts` (new) ·
  `src/lib/__tests__/realtime-channels.test.ts` (new) · `docs/changelog.md`.

---

## 2026-07-31 — Make Journal Activity publishing revocable (schema change)
Closes deep-audit #10. Publishing a trade or challenge to the public Journal Activity feed was a
**one-way door**: setting it back to private, or deleting it outright, left the public row up forever.
- **Why it couldn't just be deleted:** `JournalActivity` had no link to its source - only `userId`,
  `type`, `title`, `win`. The title is pre-rendered text like `"Closed BTC long with a win"`, which
  collides with every other BTC long, so matching on it would have deleted the wrong rows. The audit
  estimated ~30 min; it actually needed a schema change, which is why it was deferred until now.
- **Schema (additive, nullable):** `sourceType` (`"trade" | "challenge"`) + `sourceId`, plus an index
  on the pair. **Deliberately not a relation/FK** - activity should survive as an orphan if a source is
  hard-deleted by some path we haven't hooked, rather than cascading unpredictably.
- **All 6 create sites** now record a source; **4 revocation points** added: trade PATCH→private, trade
  DELETE, challenge PATCH→private, challenge DELETE.
- **Challenge revocation is deliberately NOT scoped by user.** Participants' "Joined <title>" and
  milestone rows are owned by *other* users but embed the challenge title, so the owner making it
  private must revoke those too. Trade revocation *is* owner-scoped. The two `where` builders differ
  for exactly this reason and both are unit-tested.
- **Challenge DELETE only revokes when `deleteMany` reports count > 0**, so a caller cannot wipe the
  activity rows of a challenge they don't own.
- **A design mistake worth recording:** the first version used one helper returning
  `{ sourceType, sourceId, userId }` for both writes and deletes. Spreading it into `create` collided
  with the `userId` already set there and silently overwrote it (TS2783). Split into separate
  `*ActivitySource` (write) and `*ActivityWhere` (delete) builders, with a test asserting the write
  fragment has no `userId`.
- **`journal-activity-revocation.test.ts`** covers the scoping rules and, structurally, that **every**
  `journalActivity.create` call site passes a source builder - because a new activity type that forgets
  one fails nothing, it just becomes permanently unrevocable. Regression-validated by removing a source
  from one call site and confirming the test names that file.
- **Legacy rows (`sourceId IS NULL`) still cannot be revoked** - recorded as an owner decision in
  `HANDOFF.md §8` with a read-only count query and three options. Not actioned because it destroys data.
- **Files:** `prisma/schema.prisma` · `src/lib/journal-activity.ts` · 6 journal route handlers ·
  `src/lib/__tests__/journal-activity-revocation.test.ts` (new) · `docs/HANDOFF.md` · `docs/changelog.md`.

---

## 2026-07-30 — Rate-limit the 7 mutating API handlers that had no limiter, and pin it with a test
Closes deep-audit #9, which listed four gaps. A per-handler sweep found **seven**.
- **The four from the audit:** `dm` POST (upserts a `Conversation` per call, zero limiters in the file),
  `push/unsubscribe` POST, and the **DELETE** halves of `news/saved` and `news/social` - both files
  throttled POST and left DELETE wide open.
- **Three the audit missed**, found by checking per *handler* rather than per *file*:
  `journal/trades/[id]` DELETE, `journal/challenges/[id]` DELETE, and
  `journal/challenges/[id]/milestones/[milestoneId]` DELETE. Each sits in a file whose PATCH is
  correctly limited, so a file-level grep reports all three as covered.
- **Buckets mirror the sibling handler in the same file** rather than inventing new ones: `dm` for the
  DM start path (matching `dm/[id]`), `profile` for push unsubscribe (matching `push/subscribe`), `like`
  and `comment` for the two news DELETEs, `journal` for the three journal DELETEs.
- **New `src/lib/__tests__/api-rate-limits.test.ts` pins the invariant per handler.** It parses each
  `route.ts`, splits it at every `export async function`, and asserts every POST/PATCH/PUT/DELETE body
  calls `rateLimit()` and short-circuits on `!success`. 66 handlers currently checked, 0 gaps.
  Regression-validated: deleting one limiter fails the test naming the exact `file:handler`.
- **Two deliberate exceptions documented in the test**, not silently allowed: `posts/[id]/view` and
  `track` drop excess pings with `return ok(...)` rather than a 429, because a 429 on a fire-and-forget
  beacon is browser console noise. The test asserts the limiter result is *acted on*, not that a
  specific status is returned - the first version asserted 429 and was wrong.
- **The test also guards itself:** it asserts it found >50 handlers, so a broken glob fails loudly
  instead of passing vacuously. That mirrors the file-vs-handler false negative that hid three of these.
- This matters now specifically because **Upstash is verified live** (2026-07-29) - these limiters
  genuinely enforce rather than no-op.
- **Files:** 7 route handlers · `src/lib/__tests__/api-rate-limits.test.ts` (new) · `docs/changelog.md`.

---

## 2026-07-30 — Remove the CodeQL job: code scanning is unavailable on a private repo
CI config only. The repository was made private, and **code scanning requires GitHub Advanced
Security on private repos** - so the CodeQL job could never file its results and failed on every PR.
- **What it looked like:** `CodeQL analysis` red on every PR, reading like a security finding. It was
  not one. The scan itself **succeeded** every time - all 419 TypeScript files, 4 JavaScript files and
  4 GitHub Actions files analysed, SARIF exported, **zero findings**. The job then failed at the upload
  step with `Code scanning is not enabled for this repository`.
- **A wrong turn worth recording.** The first diagnosis blamed a missing `actions: read` permission and
  claimed the trigger was "a change on GitHub's side, since `security.yml` hasn't changed since
  2026-07-11". The permission was added and CodeQL **still failed** - it only silenced a secondary
  telemetry warning. The owner supplied the actual cause: they had made the repo private. Corrected
  here rather than quietly dropped, because a plausible-but-wrong root cause is the exact failure mode
  the rest of this changelog keeps documenting.
- **Why removed rather than `continue-on-error`:** the job cannot upload results either way, so it
  would burn ~4 minutes of Actions time per PR for nothing. Public repos get unlimited minutes; private
  repos are metered, so this became a real cost the moment the repo went private. A permanently red
  security check is also corrosive - it blocks merges *and* teaches everyone to ignore a failing
  security check.
- **Not lost:** `npm audit` still runs on every push/PR and weekly, so dependency advisories are still
  reported. And CodeQL had found nothing - this removes a scanner that could not file its report, not
  coverage of a known problem.
- **Restore path** is documented inline in `security.yml`: make the repo public again (code scanning is
  free there) or enable GitHub Advanced Security, then re-add the job - the full block is kept in a
  comment, including the `actions: read` permission it needs on private repos.
- **Do not make the repo public to get this check back.** `prisma/seed.ts` still hardcodes a real
  personal Gmail and the default password `changeme123`; the full git history would be exposed; and the
  handbook now documents which monitoring subsystems are dark, which limiters exist with their exact
  thresholds, and the Supabase project ref. That is an attacker briefing. The check is not worth it.
- **Files:** `.github/workflows/security.yml` · `docs/changelog.md`.

---

## 2026-07-30 — Make schema-push failures fail the build instead of hiding
Follow-up to the P1001 incident. That fixed the misconfiguration; this fixes the reason it stayed
invisible for weeks. The first non-docs change in this run.
- **`vercel-build` no longer swallows failures.** It was
  `prisma db push --skip-generate || echo 'db push skipped (no DB at build)'` - the `||` absorbed
  *every* failure, so a deploy succeeded, CI went green and the site worked while no migration had
  applied. Now `prisma generate && node scripts/db-push.mjs && next build`.
- **New `scripts/db-push.mjs` draws the distinction the `||` could not:** nothing to push to → skip
  quietly (exit 0); something to push to and it failed → **fail the build**, loudly.
- **Only a real Vercel production build pushes.** The gate is strict equality on
  `VERCEL_ENV === "production"`, so local builds, CI and **preview deployments** all skip. This closes
  a live exposure: preview deploys share the production `DATABASE_URL`, and with P1001 fixed every
  branch push would otherwise have rewritten the production schema before review. An abandoned PR's
  orphan column would then make future pushes fail on data-loss refusal - silently, under the old
  script. (The owner also unticked Preview on `DIRECT_URL`; this enforces the same thing in code, so
  it survives the checkbox being re-ticked.)
- **A production build missing `DATABASE_URL`/`DIRECT_URL` now fails** rather than skipping - on
  production that is a broken config, not a reason to continue.
- **3 attempts with 2s/4s backoff** so a transient blip doesn't block a deploy; a genuine
  misconfiguration fails all three in ~10s and then fails the build.
- **This cannot take the site down.** Vercel keeps the previous deployment serving and only swaps the
  production alias after a build succeeds. Worst case is "this deploy doesn't ship until the DB is
  reachable", which beats shipping code whose schema was never applied.
- **Verified by executing every path**, not by inspection: local/CI/preview skip (exit 0); production
  with missing `DATABASE_URL` or `DIRECT_URL` fails (exit 1); production with an unreachable DB
  reproduces `P1001`, retries twice and fails (exit 1, ~10s); `npm run vercel-build` end-to-end still
  generates, skips and builds clean.
- **Files:** `scripts/db-push.mjs` (new) · `package.json` (`vercel-build`) · `docs/changelog.md`.

---

## 2026-07-29 — FIXED: migrations had never applied (P1001 on every deploy)
Docs only. Records the root cause of the schema-drift item open since 2026-07-19, the owner's fix,
and a CLAUDE.md gotcha that had been steering readers away from finding it.
- **Symptom:** every production build logged `Error: P1001: Can't reach database server at
  db.<ref>.supabase.co:5432`, so `prisma db push` failed on every deploy. Not drift that happened
  once - **no migration applied on any Vercel deploy** for the whole period.
- **✅ Fixed same day.** Owner repointed `DIRECT_URL` at the Supabase **session pooler**
  (`aws-0-<region>.pooler.supabase.com:5432`) and redeployed; build logs clear, `P1001` gone.
  Recorded as owner-verified - the `in sync with your Prisma schema` line was not itself pasted back,
  so a later auditor should re-confirm from a build log rather than treat it as independently proven.
- **The invisibility was NOT fixed, only the misconfiguration.** Any future `db push` failure - bad
  credential, paused project, schema conflict - will be equally silent with green CI. Flagged in §8 as
  a decision to make (loud greppable marker + assertion, versus making it fatal and breaking DB-less
  builds); not actioned.
- **Cause:** `DIRECT_URL` points at the *direct* Supabase host. Supabase deprecated IPv4 for it, so
  it resolves IPv6-only, and Vercel's build/function runtimes are IPv4-only. It must point at the
  **session pooler** (`aws-0-<region>.pooler.supabase.com:5432`) instead, which supports the DDL
  migrations need *and* is IPv4-reachable - exactly what `.env.example:11` specifies. Port 5432 on the
  pooler host and port 5432 on the direct host look interchangeable and are not.
- **Why it hid for ten days:** `vercel-build` is
  `prisma generate && (prisma db push --skip-generate || echo 'db push skipped …') && next build`.
  The `||` swallows the non-zero exit, `next build` proceeds, the deploy succeeds and **CI goes
  green**. Runtime traffic is unaffected because `schema.prisma` uses `DIRECT_URL` only as
  `directUrl`; requests go through `DATABASE_URL`, which is correctly pooled. So the app works
  perfectly while every migration silently fails - the house bug class in its purest form.
- **CLAUDE.md gotcha rewritten.** It said migrations "auto-apply on every Vercel deploy … don't assume
  a migration is 'pending' just because it's recent". That nudged the reader toward assuming success,
  which is why this went unseen for weeks. It does **not** now say the opposite either - flipping it to
  "assume unapplied" would be stale the moment the fix landed. It states the durable rule: migrations do
  apply, the script hides failure in **both** directions, so open the build log and look for
  `in sync with your Prisma schema`. Assume nothing.
- **Correction to the previous entry (below): `CRON_SECRET` IS set in Vercel.** That entry claimed it was
  unset, inferred from the 403 and written up as fact. The owner confirmed it is present, Prod+Preview.
  The 403 is now recorded as an unexplained symptom with two candidates - a mismatched value, or a
  deployment predating the variable (Vercel bakes env vars at build time). The HANDOFF env-table row and
  the §8 entry are corrected accordingly.
- **Also recorded from the same env audit:** `RESEND_API_KEY`/`EMAIL_FROM`, all three VAPID vars,
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (so `storageEnabled` is true - uploads really do go to
  Storage, no inline `data:` fallback), `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXTAUTH_SECRET`/`URL`,
  `DIRECT_URL` and `ADMIN_EMAILS` are all present and Production-scoped. `SUPABASE_STORAGE_BUCKET` is
  absent but defaults to `post-covers` (`env.ts:80`), so that is a non-issue. `TELEGRAM_*` absent -
  Sentinel email alerting still works via Resend. Sentry DSNs remain absent.
- **Files:** `CLAUDE.md` (migration gotcha, Stack caveat) · `docs/HANDOFF.md` (§8 root-cause entry,
  Sentinel correction, `CRON_SECRET` env-table row) · `docs/changelog.md`. No `src/` changes.

---

## 2026-07-29 — Verified: Upstash rate limiting IS live in production; XYZ Sentinel is not
Docs only, no code changed. Closes a standing unknown and opens a new one found while closing it.
- **Upstash is configured and limiters genuinely enforce.** Verified by behavioural probe against
  production, read-only: 16 sequential `GET /api/search/posts` with distinct query strings and
  `cache: "no-store"`. That route uses the `subscribe` bucket, 10/min/IP - requests 1-10 returned rows,
  **11-16 returned zero**, tripping exactly on the configured boundary, with `x-vercel-cache: MISS`
  confirming the function was actually invoked. The off-by-one is explained by request 1 being `STALE`,
  which fires a background revalidation that consumes a token.
- **Method note recorded in HANDOFF §8, because the first probe was wrong.** Reusing the *same* query
  string proves nothing: `/api/search/posts` sets `s-maxage=60, stale-while-revalidate=180`, so repeat
  identical requests are answered by the edge and never reach `rateLimit()`. A constant result series
  looks identical to "limiting is off". Vary the query, pass `cache: "no-store"`, read `x-vercel-cache`.
  Also: that route and `/api/posts/[id]/view` **silently drop** excess requests (`return ok(...)`) rather
  than returning 429, so the signal is in the payload, not the status code.
- **The OTP attempt-cap race is confirmed LOW, not escalated.** `otp.ts:82` still checks a stale
  `attempts` read before the atomic increment, but its escalation was conditional on Upstash being
  absent. With `signup`/`password` (IP) and `otpEmail` (3 per 10 min per target email) genuinely
  enforcing, a 6-digit code is not brute-forceable in parallel. Worth fixing as hardening
  (`updateMany` guarded on `attempts < MAX_ATTEMPTS`), not as an exposure.
- **New finding: XYZ Sentinel does not run at all.** ⚠️ **The cause stated in this bullet was WRONG —
  see the 2026-07-29 root-cause entry above. `CRON_SECRET` IS set in Vercel (Prod+Preview).** The 403 is
  real; the diagnosis below was an inference written up as fact. Left in place as a record, not as
  guidance. — `GET /api/watchdog` returns
  `403 {"error":"Forbidden"}` - `authorized()` short-circuits on `if (!env.CRON_SECRET) return false`
  before comparing anything, so `CRON_SECRET` is not set in Vercel. `/api/push/dispatch` shares the
  identical gate and is equally unreachable. Compounding it, `watchdog.yml` has `schedule:` commented
  out from the Hobby-plan pass, so nothing invokes it automatically either. A monitor that never runs
  raises no alarm - same class as the Sentry DSN gap. Added as an owner action in §8.
- **Corrected a wrong claim in the HANDOFF env table.** The `CRON_SECRET` row said that without it the
  "Endpoint stays open (still gated by other checks)". It does the **opposite** - it fails closed, 403 to
  everyone, and the feature silently never runs. A reader would have inferred the risk was exposure when
  the real consequence is silent non-execution.
- **Files:** `docs/HANDOFF.md` (§8 + two env-table rows) · `CLAUDE.md` (Stack caveat) ·
  `docs/changelog.md`. No `src/` changes.

---

## 2026-07-29 — Project skills added; design-system docs consolidated; CLAUDE.md caveats
Three procedures the project depends on existed only as docs someone had to remember to name in a
prompt. `PRE-MERGE-CHECKS.md` said so in its own "How to use it" section. They are now skills that
load on trigger.
- **New `.claude/skills/`** (committed, so any session from any account picks them up):
  `pre-merge` (the six-step check procedure, scaling table, standing rules), `cost-check` (**the single
  home for every caching and cost number** - route baseline, ISR windows, the ~2MB data-cache trap, the
  `<img>` vs `next/image` trade-off, the bundle-size blind spot), `design-system` (the color rule, the
  narrow `prefers-reduced-motion` policy, the gradient-text gotcha). Frontmatter descriptions name
  **triggers**, not contents - that string is all that is visible until a skill fires.
- **Rule they follow:** a skill carries what changes a decision; `docs/` carries reference tables. One
  fact, one home.
- **`docs/DESIGN-SYSTEM.md` + `docs/design-system.md` merged into the lowercase file**, and the uppercase
  one removed with `git rm`. They were two *different* documents, not duplicates - lowercase was the brand
  spec (palette, spacing, buttons, surfaces), uppercase was the theming layer (light/dark, semantic CSS-var
  tokens, ThemeToggle). Lowercase was kept because it is the one `SUMMARY.md`, `project-state.md` and
  `frontend-state.md` all link to; the uppercase file was not in the GitBook TOC at all. **This also fixes a
  real portability bug:** two paths differing only by case cannot coexist in a checkout on Windows or macOS,
  which would have broken the owner's working tree on the next pull.
- **Two stale claims corrected during the merge** rather than carried forward: both files said motion
  universally respects `prefers-reduced-motion` (the revised policy deliberately exempts the ticker marquee,
  `text-shine`/`text-shimmer`, shooting stars and `.i3d-*`), and one listed react-three-fiber as the "next
  increment" (R3F 9 / drei 10 are installed but the WebGL orbital is gated off; the CSS orbital is live).
- **`docs/PRE-MERGE-CHECKS.md` reduced to a pointer.** Not deleted - it keeps the GitBook TOC entry under
  Operations & Security working and gives a human reader the trail. Keeping a second full copy is how the
  two would drift, which is the exact failure the check exists to catch.
- **`CLAUDE.md` reconciled with reality:** the Stack line no longer implies Upstash and Sentry are live
  (Upstash config in production is unverified and limiters no-op when unset; Sentry has no DSN in any
  runtime), and "ALL env access goes through `env.ts`" is reworded as the intended convention rather than
  an enforced guarantee - the zod result is only logged, `process.env` is re-read directly, and the module
  lacks `import "server-only"`. Both point at `HANDOFF.md §8`. Added a Skills section.
- **Reported, not changed:** `component-registry.md` is substantially stale - its API list stops at six
  routes and its Pages list at five, against a repo that now builds 124 routes with community, messages,
  journal, markets, news, tools, settings, `u/[username]` and premium. Worth its own refresh pass.
- The two older changelog entries referencing `DESIGN-SYSTEM.md` are left as-is: a changelog records what
  was true on its date, and rewriting it is the worse error. This entry is the forwarding address.
- **Files:** `.claude/skills/{pre-merge,cost-check,design-system}/SKILL.md` (new) ·
  `docs/design-system.md` (merged) · `docs/DESIGN-SYSTEM.md` (deleted) · `docs/PRE-MERGE-CHECKS.md`
  (→ pointer) · `CLAUDE.md` · `docs/changelog.md`. No `src/` changes.

---

## 2026-07-25 — Diagnosis: Sentry has never been configured in production (no DSN anywhere)
Ran the verification the previous entry asked for, against the live site, and it failed at the very first
link - so the docs are corrected to say so rather than implying the monitoring work is finished.
- **Findings** (production console): `window.__SENTRY__` is `undefined`; `performance.getEntriesByType(
  "resource")` shows zero requests to any Sentry/ingest host; scanning all 36 served `_next/static/*.js`
  chunks finds no `ingest.*.sentry.io` string. In Vercel, **neither `NEXT_PUBLIC_SENTRY_DSN` nor
  `SENTRY_DSN` exists** in Environment Variables.
- **Nothing has ever reported, from any runtime.** Not just the browser SDK - the server and edge SDKs read
  `SENTRY_DSN`, which is absent too. Corrects an earlier note claiming the DSN was set in production, and
  narrows an earlier claim that server/edge Sentry "was never affected" (true of the Turbopack bug
  specifically, but everything was silent for want of a DSN).
- **The #168 and #171 code fixes remain correct and necessary** - client init moved to
  `src/instrumentation-client.ts` for Turbopack, and the Sentry ingest host allowed in `connect-src`. They are
  prerequisites that simply cannot be exercised until a DSN exists; the docs say explicitly not to revert them
  as ineffective.
- **Recorded the build-time trap**: `NEXT_PUBLIC_*` values are inlined when Vercel builds, and
  `instrumentation-client.ts` guards on `if (dsn)`, so a build without the variable bakes in an empty string
  and `Sentry.init()` never runs. Setting the variable is not enough - a **redeploy** is mandatory.
- Wrote the finish-up steps (create/locate the Sentry project, add both vars scoped to Production, redeploy,
  verify) and a note on when this becomes essential rather than nice-to-have, into `HANDOFF §8`, with a
  summary in `CLAUDE.md`'s owner actions.
- **Files**: `docs/HANDOFF.md`, `CLAUDE.md`, `docs/changelog.md`.

---

## 2026-07-25 — Docs: bring HANDOFF §7 current (2026-07-19 → 2026-07-25)
`HANDOFF.md`'s §7 narrative had stalled at 2026-07-19 while ~20 PRs merged, so a cold-start session reading
it would have missed the framework upgrade entirely. Header bumped (PR #154 → #177) and three sections added.
- **2026-07-23 — Next 14 → 16 + React 19 (#158)**: why it was smaller than feared (next-auth v4 now peers
  `next ^15||^16` + `react ^19`, so no Auth.js v5 rewrite), the codemod/segment-config/tsconfig changes, the
  `next lint` → ESLint 9 flat config move that later surfaced the react-hooks warnings, and the fact that the
  R3F/drei major bump is compile-only while `useWebglGate()` stays `false`.
- **2026-07-23/24 — work from other sessions (#159-#167, #169, #170)**: the Tiptap editor rebuild, premium
  visual identity, mobile nav/footer fixes, and notably the **security audit fixes (#170)** covering a DM
  realtime leak, a profile XSS and a push IDOR. Recorded so §7 isn't misleading about what moved in that
  window, with pointers to the changelog rather than second-hand detail.
- **2026-07-24/25 — Sentry, CSP, pre-merge checks, react-hooks**: the two independent faults that kept
  client-side Sentry dark (the Turbopack init regression, and a `connect-src` that had *never* allowed a
  Sentry host), the LiveKit CSP cleanup, the new pre-merge checklist, and the 73 → 41 react-hooks passes
  including which three were genuine bugs.
- **New §8 item**: confirm Sentry actually receives a client event. Every link is verified independently but
  no event has ever been *observed* arriving, since the agent sandbox has no outbound network - so this is
  explicitly flagged as unverified rather than quietly assumed working, with the exact console check to run.
- Also updated the §7 heading, which was still dated "2026-07-16, end of session".
- **`CLAUDE.md` synced to match** (it was dated 2026-07-23 and predated the Sentry/CSP/react-hooks work):
  "Current state" bumped, new bullets for the restored Sentry client monitoring (both faults) and the
  2026-07-25 housekeeping, the open-owner-actions count corrected 2 → 3 with the unverified Sentry delivery
  added, the stale "react-hooks warnings" leftover removed now that they're settled, and a standing
  instruction to run `docs/PRE-MERGE-CHECKS.md` before merging anything touching routes/caching/data/realtime
  (with the current 124/22/102/12 baseline inline).
- **Files**: `docs/HANDOFF.md`, `CLAUDE.md`, `docs/changelog.md`.

---

## 2026-07-25 — Docs: record the decision to keep the fetch-on-mount effects as-is
Doc-only. After three cleanup passes took the react-hooks v6 warnings from 73 to 41, the largest remaining
group (`set-state-in-effect` on fetch-on-mount) was assessed and **deliberately kept**. Wrote the reasoning
down next to the rule config in `eslint.config.mjs` so it reads as a decision rather than an unfinished TODO.
- The shape is `useEffect(() => { load(); }, [load])` where `load()` opens with `setLoading(true)`. In this
  codebase that is usually not the cascading render the rule assumes: these components already declare
  `useState(true)` for `loading`, so on mount the call sets the value it already has and React bails out; on
  later runs (tab switched, query changed) it is a correct transition back to loading. Unlike the two groups
  that were fixed, no wrong data is ever painted - the intermediate state is simply "not loading yet".
- The rule's real objection is architectural (no request dedup, no shared cache, waterfalls). Both ways to
  satisfy it were rejected for now, with reasons recorded: moving the fetching into Server Components would
  convert client fetches of cached `/api` routes into per-request server work, pushing Function Invocations
  and Fast Origin Transfer **up** against the free-tier work in `HANDOFF §7`; and adopting SWR/TanStack Query
  across ~20 call sites is a repo-wide commitment that should be scoped on its own merits (its dedup/cache
  could genuinely reduce invocations - a good argument, just not a lint-cleanup one).
- Recorded the accepted consequence: `set-state-in-effect` stays on `warn`, so a newly-introduced instance
  will not be blocked by CI.
- Refreshed the stale `HANDOFF §8` entry, which still described 72 warnings and treated the whole thing as
  outstanding work.
- **Files**: `eslint.config.mjs`, `docs/HANDOFF.md`, `docs/changelog.md`.

---

## 2026-07-25 — react-hooks v6 batch 3: reset-on-prop-change adjusted during render
Third pass (47 -> 41; `set-state-in-effect` 39 -> 33). This batch takes the "reset some state when a prop
changes" sub-pattern, which was written as `useEffect(() => setX(initial), [prop])`. That commits one frame
of the *previous* item's state and then schedules a second render to correct it. Replaced with React's
documented "adjusting state when a prop changes" pattern - a previous-value guard evaluated during render:
React re-runs the component immediately, without committing the stale value, and it isn't an effect so there
is no cascading render.
- **`CommandPalette`**: highlight reset to row 0 when the result set or query changes.
- **`NewsClient`** (story reader): reading-progress reset per story - the progress bar can no longer paint the
  previous story's value. The `scrollTop = 0` half is a genuine DOM side effect and deliberately stays in an
  effect.
- **`NewsClient`** (headline carousel): index reset when the feed length changes, so the ticker can't
  momentarily index past the end of a shorter list.
- **`NewsSocial`**: like/comment counts cleared when the story URL changes, so one story's counts can't flash
  under another's headline.
- **`BriefingBlock`**: translation/speech state reset per story; the `speechSynthesis.cancel()` side effect
  stays in an effect.
- **`useUserOnline`**: presence resets to offline when the observed user changes, so the previous user's
  online dot is never shown against the new one.
- **Verified**: typecheck + lint (0 errors) + 362 tests + build green. A bad guard on a render-phase setState
  causes an infinite render loop, so this was specifically exercised in headless Chromium: the command
  palette was driven through repeated query changes (hammering the reset path) and `/news` was left running
  long enough for the carousel interval to tick - **zero "Too many re-renders"/"Maximum update depth" and
  zero uncaught errors**, with the palette still open and functional afterwards.
- **Remaining**: 33 `set-state-in-effect` - now mostly fetch-on-mount (`load()` whose first statement is
  `setLoading(true)`) and user-writable stored preferences, both of which need structural changes rather than
  a pattern swap.
- **Files**: `src/components/CommandPalette.tsx`, `src/components/NewsClient.tsx`,
  `src/components/NewsSocial.tsx`, `src/components/BriefingBlock.tsx`, `src/lib/useUserOnline.ts`,
  `docs/changelog.md`.

---

## 2026-07-25 — react-hooks v6 batch 2: mount-time browser reads via useSyncExternalStore
Second pass on the react-hooks v6 warnings (52 -> 47; `set-state-in-effect` 44 -> 39). This batch takes the
"read a browser-only value on mount" sub-pattern - `useState(false)` plus
`useEffect(() => setX(read()), [])`, which renders once with the wrong value and immediately schedules a
second render. Added `src/lib/useClientFlag.ts` (`useHydrated`, `useClientFlag`, `useMediaQuery`), thin
`useSyncExternalStore` wrappers that express the same intent directly: React reads the server snapshot while
SSR-ing and hydrating, then swaps to the real value with no cascading render.
- **`ImageLightbox`**: portal-ready flag -> `useHydrated()`.
- **`NewsAlertsToggle`**: push-capability check -> `useClientFlag()`; the effect that follows now just reads
  the derived `supported` instead of recomputing it.
- **`journal/JournalClient`**: realtime-available flag -> `useClientFlag()`.
- **`ChatClient`**: `touchUi` -> `useMediaQuery("(hover: none)")`. This is also a **behaviour improvement** -
  it was a one-shot read, so attaching a mouse or rotating a tablet never updated it; now it tracks.
- **`OrbitalEcosystem`** (the live homepage centerpiece, not the gated-off WebGL scene): the particle field
  was generated with `Math.random()` inside an effect specifically to dodge a hydration mismatch. Now derived
  in a `useMemo` from a seeded PRNG (`mulberry32`, reused from the orbital scene) plus
  `useMediaQuery("(max-width: 768px)")` for the phone count. Being deterministic, there is no mismatch to
  dodge, and the field can't reshuffle on an unrelated re-render. Still only painted once `active` is true.
- **Verified**: typecheck + lint (0 errors) + 362 tests + build green; homepage driven in headless Chromium -
  renders and hydrates with zero uncaught/hydration errors, and a screenshot confirms the orbital centerpiece
  (rings, nodes, particles, logo glow) is visually unchanged.
- **Remaining**: 39 `set-state-in-effect`, which are the fetch-on-mount and reset-on-prop-change patterns
  (chat/dashboard/news/messages) plus user-writable stored preferences - those need a store or key-remount,
  not a drop-in hook. Tracked in `eslint.config.mjs` and `docs/HANDOFF.md §8`.
- **Files**: `src/lib/useClientFlag.ts` (new), `src/components/ImageLightbox.tsx`,
  `src/components/NewsAlertsToggle.tsx`, `src/components/journal/JournalClient.tsx`,
  `src/components/ChatClient.tsx`, `src/components/OrbitalEcosystem.tsx`, `docs/changelog.md`.

---

## 2026-07-25 — react-hooks v6: clear purity + static-components, promote both back to error
First pass at the react-hooks v6 warnings the Next 16 upgrade surfaced (73 -> 52). Two rule categories are
now completely clean and re-enforced as errors in `eslint.config.mjs`; the rest stay on warn with the
remaining counts documented inline.
- **`react-hooks/purity` (11 -> 0)**:
  - `orbital/StarField.tsx` + `orbital/SpaceParticles.tsx` seeded their star/dust fields with `Math.random()`
    inside a `useMemo`. That is an impure render-phase call - if the memo ever re-ran (StrictMode
    double-render, remount) the whole field would silently jump to a new layout. Added
    `orbital/rng.ts` (mulberry32) and seeded both, which makes the memos genuinely pure and the fields stable
    run to run, with the same statistical spread. This is a real fix, not a suppression.
  - `app/community/page.tsx` + `app/dashboard/page.tsx` call `Date.now()` in **Server Components**, which
    render once per request - the rule's re-render instability concern is client-only, so these got a scoped
    `eslint-disable-next-line` with that reasoning rather than contorted code.
- **`react-hooks/static-components` (4 -> 0) + one `immutability`**: `CommandPalette` declared its `Section`
  component *inside* the render and gave rows their global index by mutating a shared `let idx` counter
  across three call sites. A component created during render is a new type every render, so React unmounted
  and remounted the entire results list instead of updating it. Hoisted `Section` to module scope and
  replaced the counter with cumulative `offset` props, which mirror how `rows` is assembled
  (`cmds, coins, posts, news`) - identical indices, no mutation.
- **`react-hooks/refs` (5 -> 1)**: the latest-callback refs in `useRealtime.ts`, `DashboardClient`'s
  `useMembersChannel`, and `ChatClient`'s `stickRef`/`meRef` were written during render, which isn't safe
  under concurrent rendering. Moved each into a post-commit `useEffect` (the pattern `ChatClient`'s
  `messagesRef` already used); all are read only from async realtime/scroll handlers.
- Removed a stale `eslint-disable react-hooks/exhaustive-deps` in `AwardXpOnView.tsx` that no longer
  suppressed anything.
- **Verified**: typecheck + lint (0 errors, with purity/static-components now *errors*) + 362 tests + build
  green; homepage + command palette driven in headless Chromium - the palette opens, renders its section and
  row, and highlights correctly, with zero uncaught errors.
- **Deliberately not changed**: the two `@next/next/no-img-element` warnings in `PostEditor`. Routing those
  Supabase-hosted images through `next/image` would consume Fast Origin Transfer and image-optimisation
  quota - see `docs/PRE-MERGE-CHECKS.md` Step 2, where this is called out as a case where the lint rule's
  "best practice" is the more expensive choice here.
- **Files**: `src/components/orbital/rng.ts` (new), `src/components/orbital/StarField.tsx`,
  `src/components/orbital/SpaceParticles.tsx`, `src/app/community/page.tsx`, `src/app/dashboard/page.tsx`,
  `src/components/CommandPalette.tsx`, `src/lib/useRealtime.ts`, `src/components/DashboardClient.tsx`,
  `src/components/ChatClient.tsx`, `src/components/AwardXpOnView.tsx`, `eslint.config.mjs`,
  `docs/changelog.md`.

---

## 2026-07-25 — CSP: drop dead LiveKit sources left over from Voice Rooms
Voice Rooms (LiveKit) were removed entirely in the 2026-07-19 cost pass, but the CSP kept allowing their
origins and capabilities. Removed the leftovers after verifying each is genuinely unused:
- **`connect-src`**: dropped `https://*.livekit.cloud wss://*.livekit.cloud`. No `livekit` reference remains
  anywhere in `src/`, `package.json`, or `.env.example`.
- **`media-src`**: dropped `mediastream:`. Nothing uses `getUserMedia`, `MediaStream`, or `srcObject`, and
  there is no `<audio>`/`<video>` element in the codebase - the news briefing's read-aloud uses
  `window.speechSynthesis` and the chat blip uses the Web Audio API (`AudioContext`), neither of which is
  governed by `media-src`.
- **`worker-src`**: dropped `blob:` (LiveKit spun up audio workers from blob URLs); **kept `'self'`**, which
  the PWA service worker registration (`/sw.js` via `PwaSetup`/`NewsAlertsToggle`) genuinely needs. No
  `new Worker(...)` exists in the source.
- Comments rewritten so the remaining sources document their real justification rather than a removed feature.
- **Verified**: typecheck + lint (0 errors) + 362 tests + build green; route table identical to `main`
  (124 routes, 22 static, 102 dynamic, 12 ISR); the served `Content-Security-Policy` header confirmed free of
  `livekit`/`mediastream` while retaining `worker-src 'self'` and the `*.sentry.io` source added in #171; and
  a headless-Chromium pass over `/`, `/tools`, `/news`, `/markets` recorded **zero CSP violations** with the
  service worker still registering.
- **Files**: `next.config.mjs`, `docs/changelog.md`.

---

## 2026-07-25 — Docs: pre-merge cost & performance checks
Added `docs/PRE-MERGE-CHECKS.md`, a checklist for verifying a PR branch does not regress cost or performance
*before* it merges to `main` and auto-deploys. It exists because CI (`typecheck -> lint -> test -> build`)
proves nothing broke but cannot detect a page that stopped being cached, a new polling loop, or a grown
bundle - those surface as a Vercel usage overage days later, not as a red check.
- Six steps, scaled to PR type: route-table comparison between `main` and the branch (static/dynamic flips and
  revalidate-window changes being the most expensive regression class here), a diff scan for cost-relevant
  patterns (caching directives, polling loops, Supabase channels outside the shared singleton, cron schedules,
  large external fetches, N+1 Prisma), bundle size (currently a known blind spot since Next 16 dropped the
  `Size`/`First Load JS` columns), Lighthouse on the Vercel preview, reading the diff, and watching usage for
  ~3 days post-merge.
- Records the current baseline (Next 16.2.11: 124 routes, 22 static, 102 dynamic, 12 ISR) and the known ISR
  windows, so future comparisons have a fixed reference point.
- Listed in `docs/SUMMARY.md` under Operations & Security so it appears in the GitBook handbook.
- **Files**: `docs/PRE-MERGE-CHECKS.md` (new), `docs/SUMMARY.md`, `docs/changelog.md`.

---

## 2026-07-24 — Security audit fixes + bold/italic overlap bug
Full end-to-end security audit (7 parallel read-only agents covering auth, every API route, the rich-text/XSS
surface, realtime chat/DM access control, and secrets/env/deps) plus a bug hunt across research, markets,
journal, chat/DM, profile and auth. This entry covers the fixes shipped from that pass; the remainder is a
prioritized backlog (see below) - not silently dropped.

**Security fixes:**
- **DM plaintext leaked over a public Realtime channel (High)**: `POST /api/dm/[id]` broadcast the *full
  message body* to `user:<recipientId>` on Supabase Realtime's public (`private: false`) broadcast channel.
  Since the recipient's user id is discoverable from their public profile page, anyone holding the public
  anon key could open devtools, subscribe to `user:<their-id>`, and read every DM sent to them in real time -
  no valid session required, completely bypassing the correctly-implemented participant check in
  `loadMine()`. Fixed by broadcasting a bare `{ conversationId }` ping instead of the message - the client
  already refetches the thread through the authed `GET /api/dm/[id]` on every ping, so no payload content was
  ever actually needed on the wire (matches the existing `CH_NOTIFY` ping pattern).
- **Profile "Website" field accepted `javascript:`/`data:` URIs (High)**: `z.string().url()` alone doesn't
  reject dangerous schemes (`new URL("javascript:...")` doesn't throw) - the value rendered straight into
  `<a href>` on the public `/u/[username]` page with no `safeHref` check, unlike every other link in the app.
  Any registered user (not just staff) could plant a stored-XSS-class link. Fixed with a new `isHttpUrl()`
  schema check (only `http:`/`https:` allowed) plus a defensive `safeHref()` guard at render time for any
  data written before the fix.
- **IDOR on push-notification endpoints (Low)**: `POST /api/push/unsubscribe` deleted a subscription by
  `endpoint` alone (no owner check) - any logged-in user who obtained another subscriber's opaque endpoint
  could delete their push subscription. `GET /api/push/subscribe` returned a subscriber's saved notification
  preferences for any `endpoint` passed as a query param. Both now additionally scope to `userId: me.id`.
- **`/api/dm/search` was the one DM/chat path that skipped `stripInlineImage()`**, re-exposing raw base64
  `data:` avatars on every debounced search keystroke - the exact Fast Origin Transfer class the July 19
  `stripInlineImage()` fix covers everywhere else. Now consistent.

**Bug fix:**
- **Overlapping bold+italic corrupted content, both in the editor and on the live page**: bolding a phrase
  then italicizing part of it (two Tiptap toolbar clicks) serializes as `**hello *world***`. The shared
  bold-matching regex in `richtext.ts` and `markdown.tsx` used a `[^*]+` content class that can't match
  across the nested italic's `*`, so it locked onto the wrong `**` pair, dropped the bold wrapper, and leaked
  literal `*`/`***` characters as visible text - reproducible by reopening any such post for edit, and live
  on the public page. Fixed by adding a negative lookahead (`\*\*[\s\S]+?\*\*(?!\*)`) so the bold match
  prefers a closing `**` that isn't immediately followed by another star, correctly resolving `***` tails as
  "close italic, then bold" - verified against the overlap case, the standard `***triple***` shorthand, and
  that two independent bold spans on one line still don't merge.
- **Files**: `src/app/api/dm/[id]/route.ts`, `src/app/api/dm/search/route.ts`, `src/app/api/push/{subscribe,
  unsubscribe}/route.ts`, `src/lib/profile.ts`, `src/app/u/[username]/page.tsx`, `src/lib/richtext.ts`,
  `src/lib/markdown.tsx`, plus regression tests in `richtext.test.ts`, `markdown-render.test.ts`,
  `profile.test.ts`.

**Backlog (found, understood, deliberately not rushed into this pass - detail in the audit report):**
community chat's public broadcast channel accepts client-authored `.send()` on any event (a visitor can craft
a fake `new_message` broadcast that renders live in every open tab - needs a broadcast-payload-trust redesign
in `ChatClient.tsx`, not a one-line fix); nested/Tab-indented lists mangle into run-on text on save
(`richtext.ts`'s `htmlToMarkdown` doesn't walk into nested `<ul>`); the opt-in journal share card
(`/api/journal/share/overview/[userId]`) assumes the userId in its URL is effectively secret, which no longer
holds now that profile pages expose it - a product decision on whether to move to an opaque share token, not
a code bug; risk-rule day-boundary uses UTC instead of local day; `CommentSection` collapses a user's "load
older" pagination on any new comment activity; `compoundGrowth()` can render `NaN` for out-of-range inputs;
OAuth login ignores `?callbackUrl=`; a handful of smaller UX gaps (OTP resend has no in-flight guard, the
client password hint undersells the real server rule, one free-tier limit is enforced on create but not on
join). Full detail, file:line, and severity for every item (fixed and backlog) is in the audit report
delivered alongside this change.

---

## 2026-07-24 — Fix published posts showing literal `{c:...}` markdown syntax
Reported as: looks correct while writing/publishing in the admin editor, but broken once viewed on the live
post page - the exact symptom of a bug that's specific to the *public renderer*, not the editor.

- **Root cause**: `lib/markdown.tsx`'s `inline()` only recursively parsed nested formatting for color spans
  (`{c:color}...{/c}`) - bold, italic, and link-label content were sliced out as *raw strings* instead of
  being re-parsed. That was invisible with the old textarea editor (nobody hand-types nested markdown), but
  Tiptap lets you genuinely apply Bold *and* a color to the same selection - which can serialize as
  `**{c:mint}text{/c}**` (bold wrapping color). On the public page, the outer `**...**` matched first,and its
  inner content - the color tag - got dropped in as inert literal text instead of being parsed, instead of
  rendering as bold, colored text.
- **Fix**: made the bold, italic, and link-label branches recursive, matching the color span's already-correct
  pattern (nesting in the *other* direction - color wrapping bold - already worked and had a test for it).
  Added regression tests for color-inside-bold, color-inside-italic, and formatted text inside a link label.

**Files**: `src/lib/markdown.tsx`, `src/lib/__tests__/markdown-render.test.ts`.

---

## 2026-07-24 — Profile photo lightbox + root-caused the Markets Overview mobile layout bug
- **Profile photo/banner lightbox**: tapping the avatar or banner on `/u/[username]` now opens the full,
  uncropped image full-screen (matching X's "tap a profile photo" pattern) - new `ImageLightbox` component,
  portal-rendered to `document.body` since the hero card's `.glass` (`backdrop-filter`) would otherwise clip
  an un-portaled `position: fixed` overlay to the card instead of the viewport. Only wired up when a real
  photo exists (not the initials/gradient fallback).
- **Root-caused the Markets Overview mobile layout bug** (previously reported as a stray line, then as "the
  page doesn't fit") - finally reproduced by testing with realistic long coin/token names instead of short
  placeholders, which is exactly why it never showed up in this sandbox's earlier fallback data. Two stacked
  bugs: (1) `MoverList`/`RankList`'s coin-name span was `flex-1 truncate` *without* `min-w-0` - a classic
  flexbox gotcha where a flex child's default `min-width: auto` blocks it from ever shrinking below its own
  content size, so `truncate` silently never engages. (2) Worse, every `<section className="grid ...">` in
  `MarketsClient.tsx` relied on the *implicit* single-column grid track below its first breakpoint instead of
  an explicit `grid-cols-1` - an implicit "auto" track sizes to content, not 100% width, so once (1) let a row
  demand extra width, the grid track (and everything in it) grew past the viewport. The page's own
  `overflow-x: hidden` safety net then silently clipped the overflow instead of failing loudly - which is
  what looked like a stray line in the first screenshot. Fixed both: added `min-w-0` to the three truncating
  name spans, and an explicit `grid-cols-1` to every grid in the file.

**Files**: `src/components/ImageLightbox.tsx`, `src/components/ProfileBannerImage.tsx`,
`src/app/u/[username]/page.tsx`, `src/components/MarketsClient.tsx`.

---

## 2026-07-24 — Premium visual identity (profile, avatar badge fix, feed/comments)
Premium members previously had almost no visual difference from Free - just a plain "★ Premium" badge.
Added a quiet, consistent gold treatment (X Premium/Discord Nitro style - restrained, not flashy) reusing
existing design tokens rather than inventing new effects.

- **Fixed a real Avatar bug**: the crown badge added in an earlier round was a *child* of the same
  `overflow-hidden` circular wrapper as the photo, so any part of it outside the circle's own bounds got
  clipped - exactly the "icon overlaps badly" the owner's screenshot showed. `Avatar` is now two layers: an
  outer positioning wrapper (badge lives here, never clipped) and an inner `overflow-hidden` circle (photo/
  initials + ring). Badge size is now a fixed per-size token (not a percentage), consistently proportioned
  at every `size` from `sm` to `xl`.
- **New `PremiumBadge`** (`src/components/PremiumBadge.tsx`): a crown + "Premium" pill using the site's
  existing `bg-gold-shine` gradient and `animate-shine` sweep (the same sheen already used site-wide, not a
  new effect) instead of a plain flat badge.
- **Profile hero polish**: a quiet gold vignette wash on the banner, gold-gradient username text, relaxed
  bio line-height, and `ProfileStats`' three cards get a subtle gold ring + stronger hover glow - all gated
  behind the profile owner's `Premium` membership.
- **Propagated to where premium members actually show up elsewhere**: the navbar's own account avatar,
  the mobile bottom-nav Profile avatar, a post's author byline (name + avatar) on `/research/[slug]`, and
  comment authors in `CommentSection` all now carry the gold ring/badge/gradient-name treatment when that
  person is Premium - added `membership` to the relevant Prisma selects (post author, comment author) since
  none of those queries previously read it.

**Files**: `src/components/Avatar.tsx`, `src/components/PremiumBadge.tsx`, `src/components/ProfileStats.tsx`,
`src/components/Navbar.tsx`, `src/components/BottomNav.tsx`, `src/components/CommentSection.tsx`,
`src/app/u/[username]/page.tsx`, `src/app/research/[slug]/page.tsx`, `src/app/api/posts/[id]/comments/route.ts`.

---

## 2026-07-24 — Rebuild the post editor on Tiptap (real rich-text engine)
Third round on the admin Content editor - the hand-rolled `contentEditable` + `document.execCommand` approach
kept resurfacing typing/cursor/toolbar bugs because that combination is exactly the layer real editors
(Notion, Medium, Obsidian) avoid building on directly. Replaced it with [Tiptap](https://tiptap.dev)
(ProseMirror) instead of patching the same fragile foundation again.

- **New `src/components/PostContentEditor.tsx`**: a `useEditor`/`EditorContent` Tiptap instance
  (`@tiptap/react` + `@tiptap/starter-kit`, configured down to just the marks/nodes our grammar supports -
  headings capped at H1-3, no strike/underline/code-block/ordered-list/horizontal-rule) with a toolbar that
  shows live active-state highlighting (`editor.isActive(...)`) and a new curated color Mark
  (`src/lib/tiptap-color-mark.ts`) matching the site's 4 design-token colors. `@tiptap/extension-placeholder`
  replaces the previous hand-rolled empty-state overlay.
- **Storage format is completely unchanged**: `richtext.ts`'s existing `markdownToHtml`/`htmlToMarkdown`
  still do the conversion at the boundary (Tiptap's HTML in, plain markdown string out for `/api/research`) -
  published posts, the live `Markdown` renderer, and every other consumer are untouched.
- **Root-caused a real selection bug during testing** (not just the reported symptom): toolbar buttons are
  plain `<button>` elements, and a click's default behavior shifts native DOM focus/selection away from the
  editor - this desynced Tiptap's own tracked selection from the browser's, so formatting a selection via the
  toolbar and then continuing to type could wipe the just-formatted text. Fixed with `onMouseDown`
  `preventDefault` on every toolbar button (the standard, documented fix for building a ProseMirror/Tiptap
  toolbar), verified via a throwaway Playwright harness driving the actual component (typing, bold, headings,
  colors, undo/redo, emoji - all confirmed correct end-to-end before removing the harness).

**Files**: `src/components/PostContentEditor.tsx`, `src/lib/tiptap-color-mark.ts`,
`src/components/PostEditor.tsx`, `src/app/globals.css`, `package.json`.

---

## 2026-07-24 — Fix broken Content editor, Premium not syncing, premium profile styling
Follow-up from the same day's WYSIWYG editor rewrite: it shipped with a real regression, plus two
membership-related requests.

- **Content editor: couldn't type at all**: the previous change made `markdownToHtml("")` return an empty
  string so the CSS `:empty` placeholder trick would fire - but that left a brand-new post's contentEditable
  box with literally zero child nodes, and several browsers can't reliably place a cursor or accept typing in
  a genuinely empty contentEditable. Now seeds with a minimal `<p><br></p>` block whenever there's no content,
  so the box is never truly childless; the placeholder is a plain absolutely-positioned overlay (an `isEmpty`
  React state kept in sync from `syncFromDom`) instead of relying on `:empty`, since the box no longer ever
  matches it.
- **Granting Premium didn't show up for an already-logged-in user**: `auth.ts`'s `jwt()` callback only
  re-reads `role`/`membership` from the DB when those fields are missing or on an explicit `update()` call -
  once set on first login, they were frozen in the JWT until the user logged out and back in, so an admin
  granting Premium had no visible effect for someone already signed in. Added a 60-second TTL
  (`token.syncedAt`) so the token self-heals on the next request after that window, without paying a DB read
  on literally every request.
- **Premium profile styling**: Premium members now get a distinct look on their profile - `Avatar` has a new
  opt-in `premium` prop (gold gradient ring + a small round crown badge over the avatar), applied only from
  the `/u/[username]` hero so every other Avatar call site site-wide is untouched, plus a gold ring/glow on
  the hero card itself for Premium.

**Files**: `src/components/PostEditor.tsx`, `src/lib/auth.ts`, `src/components/Avatar.tsx`,
`src/app/u/[username]/page.tsx`.

---

## 2026-07-24 — Notification dropdown overflow, profile banner, tab-page footers, real WYSIWYG editor
Four more owner-reported items from real device screenshots.

- **Notification bell dropdown overflowed off the left edge on mobile**: `NavActivity.tsx`'s panel was
  `absolute right-0` relative to the bell's own small wrapper, which sits mid-row in the navbar (the mobile
  search+menu icons come after it, not the true screen edge) - a 320px-wide panel anchored there routinely
  extended past the left edge. Below `sm`, the panel is now `fixed inset-x-3 top-[4.75rem]` (viewport-relative,
  same top offset already used elsewhere for content clearing the navbar), so it always fits the actual
  screen regardless of device width; `sm:` and up keeps the original bell-anchored `absolute` positioning.
- **Profile banner not showing despite being uploaded**: confirmed the banner *was* stored correctly (as an
  inline `data:` URL - Supabase Storage not configured) and previewed fine in `/settings`, but `stripInlineImage()`
  (added earlier for Fast Origin Transfer protection - public `/u/[username]` is ISR-cached and public, so a
  raw base64 blob there gets re-shipped to every visitor on every cache fill) was stripping it to `null` on
  the profile page for everyone, including the owner. Added `GET /api/profile` (self-only, `private, no-store`,
  returns the caller's own unstripped `image`/`bannerImage`) and a small client component
  (`ProfileBannerImage.tsx`) that renders the server's stripped banner by default, then rehydrates with the
  real image via that endpoint only when the viewer is the profile's own owner - public/anonymous visitors
  still get the FOT-safe stripped HTML, the owner sees their real banner.
- **Sitewide Footer was showing on bottom-nav tab pages**: entering Profile (or Tools/News/Journal/Research/
  Markets) showed the full marketing Footer (logo, socials, Explore/Account links) underneath the page content,
  overlapping oddly with the fixed bottom nav bar - `/community` and `/messages` already never render it for
  the same reason. Removed `<Footer />` from every bottom-nav-reachable page and sub-route (`/tools` + its
  share-card view, `/news` + `/news/read`, `/research` + `/research/[slug]`, `/markets` + `/markets/[id]` +
  `/markets/protocol/[type]/[slug]`, `/u/[username]`) - left untouched on Home, Premium, Contact, Terms and
  Privacy, which aren't reachable from the bottom nav and are meant to end in the full footer.
- **Admin post editor: real WYSIWYG formatting + fixed page-scroll-while-writing**: the "Content" box's
  toolbar (Bold/H1/Color/etc.) was inserting literal markdown syntax characters (`**`, `#`, `{c:red}...{/c}`)
  as plain visible text instead of actually formatting the selection. Replaced the plain `<textarea>` with a
  real `contentEditable` box driven by `document.execCommand` (bold/italic/headings/list/quote natively; code
  and the curated color spans via `insertHTML`, since there's no native command for either) - selecting text
  and clicking a button now shows the formatted result directly, the same way any rich text editor works.
  Storage is unchanged: a new self-contained `src/lib/richtext.ts` converts the box's HTML to/from the exact
  same plain markdown string `/api/research` already expects, so published posts, the live `Markdown` renderer
  and every other consumer are untouched. Toolbar buttons use `onMouseDown` `preventDefault` so the box never
  loses focus/selection when a button is clicked (the actual cause of formatting ever needing to "insert" at
  a stale cursor position in the first place), and the box now has `overscroll-contain` so scrolling that hits
  its top/bottom edge stops there instead of chaining up and moving the whole page.

**Files**: `src/components/NavActivity.tsx`, `src/app/api/profile/route.ts`, `src/components/ProfileBannerImage.tsx`,
`src/app/u/[username]/page.tsx`, `src/app/tools/page.tsx`, `src/app/tools/share/points-value/[id]/page.tsx`,
`src/app/news/page.tsx`, `src/app/news/read/page.tsx`, `src/app/research/page.tsx`, `src/app/research/[slug]/page.tsx`,
`src/app/markets/page.tsx`, `src/app/markets/[id]/page.tsx`, `src/app/markets/protocol/[type]/[slug]/page.tsx`,
`src/components/PostEditor.tsx`, `src/lib/richtext.ts`, `src/lib/__tests__/richtext.test.ts`.

---

## 2026-07-23 — Bottom nav swap, DM scroll/floating-bot fix, real author photo + admin Premium toggle
Four more owner-reported items from real device screenshots.

- **Bottom nav: Chat → Markets, Profile raised and enlarged**: Chat was dropped from the mobile bottom nav
  (`BottomNav.tsx`) since it's already one tap away via the navbar's chat-bubble icon at the top of every
  page - Markets takes that slot back. Profile is back in the *between* position (2 links, Profile, 3 links)
  instead of being just another uniform cell, now rendered as a raised 56px circle (`-mt-5`, ring + shadow)
  clearly bigger than the other tabs' icons, with a gold ring when active.
- **DM thread scrolling was scrolling the whole page**: `/messages` used a `min-h-screen` main with the chat
  panel sized via `h-[calc(100vh-11rem)]` - close, but not the same fixed/clipped frame `/community` uses, so
  the outer page could still grow taller than the viewport (mobile `100vh` quirks + the bottom-nav spacer)
  and scroll independently of the thread's own internal scroll. Rebuilt `/messages`' frame to match
  `/community` exactly (`h-[100svh] overflow-hidden flex flex-col`, `MessagesClient` now fills via `flex-1`
  instead of a fixed vh calc) and added `/messages` to `BOTTOM_HIDDEN_PREFIXES` (same reason `/community` is
  hidden there - the composer needs the full bottom edge, no room for the bottom nav too).
- **Floating XYZ AI bot now also hides when a DM thread is open on mobile** (`XyzAiWidget.tsx`): extended the
  existing `/community`-only hide condition to also cover `/messages` once a specific conversation is open
  (`?c=` present) - the inbox list alone doesn't have a composer to conflict with, so it only hides once a
  thread is actually open, matching what was asked ("jab dm me click kare").
- **Post byline now shows the real author photo**: `research/[slug]/page.tsx`'s byline always rendered a
  plain first-letter circle, regardless of whether the author had a real profile photo - `post.author.image`
  was fetched from the DB (and already safely stripped of inline `data:` URLs) but never actually used.
  Swapped it for the shared `Avatar` component (same one used everywhere else on the site), so any author's
  real uploaded photo now shows correctly - including the super admin's, matching what's on their own
  `/profile`.
- **Admins had no way to self-grant Premium**: the Dashboard's Members panel special-cased `role === "ADMIN"`
  rows to always show a static "Admin" badge and a plain "-" instead of a membership status + toggle -
  meaning an admin's own account could never be marked Premium from the UI (even though the underlying
  `/api/users/:id/membership` route already supports it for any user) and always displayed "Free" everywhere
  that reads `membership` (e.g. the navbar badge). Now every row - admin or not - shows its real Premium/Free
  status alongside the Admin badge, and gets the same Make Premium/Downgrade toggle.

**Files**: `src/components/BottomNav.tsx`, `src/app/messages/page.tsx`, `src/components/MessagesClient.tsx`,
`src/lib/bottom-nav.ts`, `src/lib/__tests__/bottom-nav.test.ts`, `src/components/XyzAiWidget.tsx`,
`src/app/research/[slug]/page.tsx`, `src/components/DashboardClient.tsx`.

---

## 2026-07-23 — Publish-section rich text: real H1 effect, color text, emoji picker, stable writing box
Owner asked for the Research post editor (`PostEditor.tsx`) to feel like a real publishing platform's writing
experience - direct formatting, color, emoji, and a writing box that never makes the whole page jump.

- **`# ` now has a real, distinct effect on the published page**: `lib/markdown.tsx` was silently downgrading
  a single `#` heading to an `<h2>` (identical styling to `##`), so it had no visible effect of its own -
  fixed to render an actual `<h1>`, and added the missing `.prose-xyz h1 { text-3xl }` CSS rule (there wasn't
  one - Tailwind's preflight strips default heading sizes, so even a correct `<h1>` would have rendered
  tiny). Added an H1 toolbar button (only H2/H3 existed before).
- **Color text**: added a small curated color-span syntax (`{c:gold}text{/c}`, four colors matching the
  site's existing design tokens - Gold/Mint/Red/Blue) to the same renderer, with 4 swatch buttons in the
  toolbar. Deliberately not free-form CSS/inline styles - kept to on-brand tokens. Works nested inside bold
  text and vice versa.
- **Emoji picker**: reused the existing `EmojiPicker` component (already built for community chat) as a new
  toolbar button - inserts at the cursor, no new emoji set to maintain.
- **Fixed the "writing makes the whole page jump" bug**: the toolbar's insert-and-refocus logic called
  `textarea.focus()` with no `preventScroll` option, which lets the browser auto-scroll the (already-visible)
  textarea into view on every single toolbar click - the classic cause of an unexpected page jump. Now uses
  `focus({ preventScroll: true })` and explicitly restores the textarea's own scroll position. Also converted
  the content box from a manually-`resize-y`-able, `rows`-based textarea to a fixed `h-[26rem]` box with its
  own internal `overflow-y-auto` (`resize-none`) - it can only ever scroll itself now, never destabilize the
  surrounding page layout.
- **Tests**: added `src/lib/__tests__/markdown-render.test.ts` covering the H1 fix (regression-proofs H2/H3
  are unaffected) and the color-span parsing (plain, nested-bold, and an unrecognized color falling through
  to plain text without crashing).

**Files**: `src/lib/markdown.tsx`, `src/app/globals.css`, `src/components/PostEditor.tsx`,
`src/lib/__tests__/markdown-render.test.ts` (new).

---

## 2026-07-23 — Mobile nav/menu fixes: unreachable Sign out, Journal in bottom nav, floating bot on Community, footer structure
Owner-reported bugs from real device screenshots, fixed one-for-one.

- **Mobile nav menu could cut off Sign out/Dashboard on shorter devices**: `Navbar.tsx`'s mobile "open" menu
  panel had no `max-height`/`overflow-y-auto` - on a signed-in account (Profile/Messages/Journal/Settings/
  Dashboard/Sign out, all stacked), the panel's total height could exceed the viewport, and since the
  panel sits inside a `position: fixed` header, the overflowing bottom portion was simply clipped off-screen
  with no way to scroll to it. Added a capped `max-h-[calc(100dvh-6rem)]` + `overflow-y-auto` so the full
  menu (including Sign out) is always reachable regardless of device height.
- **Journal added to the mobile bottom nav** (`BottomNav.tsx`), and all 6 tabs (Tools/News/Journal/Research/
  Chat/Profile) now render as a uniform `grid-cols-6` - no more special centered treatment for one cell,
  for a cleaner, evenly-aligned row.
- **Floating XYZ AI bot hidden on mobile `/community`** (`XyzAiWidget.tsx`): it overlapped the chat composer
  there with no room for both. Hidden via `max-md:hidden` on mobile only when on `/community`; desktop keeps
  it, and every other page is unaffected.
- **Footer's bottom bar restructured for mobile** (`Footer.tsx`): copyright / Terms+Privacy / the "Built for
  the Next Generation of Web3 · v2.0" tagline used to all cram into one `flex` row on mobile, wrapping
  awkwardly. Terms+Privacy now stay grouped together, with the tagline on its own line below on mobile -
  unchanged on `sm:` and up.
- **Investigated, not code-fixable**: a mobile browser's "Request desktop site" toggle forces its own wide
  layout viewport (~980-1024px) that overrides the page's `width=device-width` meta - a site cannot detect
  or opt out of that browser-level override, so there's no code path to special-case it. Confirmed the
  site's own viewport meta (`src/app/layout.tsx`) is already correct (`device-width`, `initialScale: 1`, no
  zoom lockout).

**Files**: `src/components/Navbar.tsx`, `src/components/BottomNav.tsx`, `src/components/XyzAiWidget.tsx`,
`src/components/Footer.tsx`.

---

## 2026-07-23 — Add RiseX to the Points/Airdrop Value Calculator
Added **RiseX** as a preset platform on `/tools`'s Points/Airdrop Value Calculator, same pattern as
Variational/Sodex - one new `DEX_REGISTRY` entry (`src/lib/dex-registry.ts`), zero component changes needed.

- **Scenario data** (owner-supplied): 12M total points, 1B total token supply, 20%/25%/30%
  supply-allocation quick-select buttons (via the existing `allocationScenarios` mechanism, same one Sodex
  uses for its pool-distribution buttons), and four FDV quick-select scenarios ($500M/$1B/$1.5B/$3B).
- **Real logo, not a favicon guess**: RiseX doesn't have a confirmed official domain to resolve via the
  existing keyless favicon-by-domain mechanism (every other platform uses that - no image ever committed),
  so the owner-supplied brand mark was committed instead (`public/risex-logo.png`). Added a `logo` override
  field to `DexPlatform`/`platformLogo()` - checked before the domain-favicon fallback - so this stays a
  one-off exception rather than a new default pattern.
- **Descriptive fields** (fees, chain, points rules, supported markets, leverage): written as honest
  "not confirmed - see official docs" placeholders rather than invented specifics, since no verified public
  info was available - matches this file's existing caution culture for assumption-based scenario data.
- **Known limitation**: the "Share result" OG card's platform logo comes from the same `domain` field used
  for favicon lookup; since RiseX has no domain on file, its share card renders without a platform logo
  (text-only), same graceful behavior any domain-less platform already gets. The in-app calculator (preset
  button, main UI) shows the real logo correctly either way.

**Files**: `src/lib/dex-registry.ts`, `public/risex-logo.png` (new).

---

## 2026-07-23 — Framework upgrade: Next 14 → 16 + React 18 → 19 (clears all 14 Next.js CVEs)
Closed the long-standing `HANDOFF.md §8` upgrade item. Turned out far smaller than the "owner-decision, huge
blast radius" framing, because the auth library didn't need replacing.
- **Dependencies**: `next` 14.2.35 → 16.2.11; `react`/`react-dom` 18 → 19; `next-auth` 4.24.7 → **4.24.15
  (stayed on v4** - it now lists `next ^15||^16` + `react ^19` as peers, so no Auth.js v5 rewrite, and
  `getServerSession(authOptions)` is unchanged); `@sentry/nextjs` → 10.67; `@react-three/fiber` 8 → 9 and
  `@react-three/drei` 9 → 10 (React 19 forces these); `eslint` 8 → 9 + `eslint-config-next` → 16;
  `@types/react(-dom)` → 19.
- **Async request APIs**: ran the official `next-async-request-api` codemod - `params`/`searchParams` are now
  awaited across 31 route handlers, server pages, and `generateMetadata` functions. No `cookies()`/`headers()`
  call sites existed, so that part was free. Typecheck stayed clean.
- **Segment config**: Next 16 rejects a non-literal segment config export, so `/api/news`'s
  `export const revalidate = NEWS_REVALIDATE` became a literal `90` (with a keep-in-sync comment).
- **Config**: removed `experimental.instrumentationHook` (instrumentation.ts is default in 16); Next auto-set
  `tsconfig` `jsx: "react-jsx"` (automatic runtime) and added the dev-types include.
- **Lint**: Next 16 removed the `next lint` subcommand. Migrated to ESLint 9 flat config (`eslint.config.mjs`
  consuming eslint-config-next 16's native `core-web-vitals`), script → `eslint src`, deleted `.eslintrc.json`.
  eslint-config-next 16 bundles react-hooks v6, whose new React-Compiler-era rules flag 72 pre-existing
  patterns; downgraded those five rules to **warn** so the framework bump isn't blocked by an unrelated
  cross-component effect refactor (tracked as a §8 follow-up).
- **R3F/drei bump is compile-only**: `useWebglGate()` is hardcoded `false` (the three.js orbital scene was
  disabled earlier), so the WebGL scene never renders in production - the CSS `OrbitalEcosystem` is the live
  centerpiece. R3F 9 / drei 10 only need to typecheck/build, which they do.
- **Verified**: typecheck + lint + 339 tests + `next build` (Turbopack) all green; a headless-Chromium run of
  the running app confirmed the homepage renders and hydrates under React 19 with zero uncaught/hydration
  errors (hero, CSS orbital centerpiece, nav, stats all present).
- **Result**: all 14 Next.js **framework** advisories cleared from `npm audit`. Remaining audit entries are
  non-framework and CI's audit step is non-blocking (`--audit-level=high || true`): `sharp`/libvips (2 new
  2026 highs, image-optimizer native lib, Vercel-managed at runtime) and `postcss` (moderate, build-time).
- **Files**: `package.json`, `package-lock.json`, `next.config.mjs`, `tsconfig.json`, `eslint.config.mjs`
  (new), `.eslintrc.json` (removed), `src/app/api/news/route.ts`, 31 codemod'd route/page files, `CLAUDE.md`,
  `docs/HANDOFF.md`, `docs/changelog.md`.

---

## 2026-07-20 — Security: GitHub OAuth linking now requires a primary && verified email
Closed the OAuth account-linking follow-up flagged in `HANDOFF.md §8`. The GitHub provider keeps
`allowDangerousEmailAccountLinking: true` (so an existing email+password user can later sign in with GitHub),
but that flag links an OAuth login into any existing account sharing the same email - which is only safe if
the email is proven to belong to the GitHub user.
- **Root cause**: the custom `profile()` override returned `profile.email` (GitHub's *public* profile email;
  and when that's unset, the default userinfo backfill picks the primary-but-not-necessarily-verified
  address) with no verified check. Combined with the linking flag, that was a latent account-takeover vector -
  a GitHub user could potentially link into a victim's account via an unverified address.
- **Fix**: `profile()` is now `async(profile, tokens)` and fetches `GET /user/emails` (granted by the
  `user:email` scope the provider already requests), selecting only a `primary && verified` address via a new
  pure helper `pickPrimaryVerifiedEmail()` in `src/lib/utils.ts`. `profile.email` is no longer trusted for
  linking. When there's no primary+verified address (private-email setting, missing scope, or a failed/timed-
  out lookup), it falls back to the existing non-deliverable `gh-<id>@users.noreply.xyzcrypto.io` placeholder,
  so linking can never attach to an unverified address (login still works; email features simply no-op).
- The fetch is wrapped in try/catch and gated on `res.ok`, so a GitHub API hiccup degrades to the placeholder
  rather than throwing out of `authorize`.
- **Tests**: added `pickPrimaryVerifiedEmail` cases to `src/lib/__tests__/utils.test.ts` (requires both flags;
  rejects primary-but-unverified and verified-but-not-primary; null on empty/non-array/malformed). Full
  pipeline green: typecheck + lint + 339 tests + build. (The live OAuth handshake itself isn't exercisable
  without real GitHub credentials; the security-critical selection logic is covered by the unit test.)
- **Files**: `src/lib/auth.ts`, `src/lib/utils.ts`, `src/lib/__tests__/utils.test.ts`, `docs/HANDOFF.md`,
  `docs/changelog.md`.

---

## 2026-07-20 — Docs: correct the Next.js CVE picture + GitHub OAuth email-verification follow-up
Doc-only pass following an audit of how this app actually uses Next against the flagged advisories.
- **`docs/HANDOFF.md §8`**: rewrote the Next.js CVE item. `npm audit` now flags **14** Next.js advisories
  (not the 8 first counted on 07-17 - the set grew as more were disclosed), all covering the pinned
  `next@14.2.35` and cleared only by `next@16.2.10` (two majors). Assessed per-advisory against this app's
  surface: the genuine residual is **RSC / Server-Component DoS-class only, with no data exposure** (the loud
  high CVEs - WebSocket SSRF, Pages-Router+i18n middleware bypass, rewrites smuggling, CSP-nonce /
  `beforeInteractive` XSS, image-cache DoS - don't apply, because the app doesn't use those features or Vercel
  manages them). Documented that **the real driver to upgrade is that Next 14 receives no security backports**,
  and the caveat that the "not affected" verdicts flip if the app ever adds middleware, CSP nonces, i18n,
  rewrites, or a custom server/WebSocket-upgrade path.
- **`docs/HANDOFF.md §8`**: added a follow-up item to harden the GitHub OAuth `profile()` callback -
  `src/lib/auth.ts` uses `allowDangerousEmailAccountLinking: true` but the custom `profile()` override takes
  `profile.email` (GitHub's public email) with no explicit verified check and never calls `/user/emails`, so
  it should assert the address is the account's `primary && verified` email before linking. Pre-existing since
  PR #105; verified via git history that the 07-17 hardening pass did not touch OAuth linking.
- **`CLAUDE.md`**: synced the "Current state" security bullet's "8 Next.js-tree CVEs" line to match (14
  advisories, RSC DoS-class residual, no backports for Next 14).
- No source code changed; no runtime behavior affected.
- **Files**: `docs/HANDOFF.md`, `CLAUDE.md`, `docs/changelog.md`.

---

## 2026-07-19 — Handoff docs refresh (bring HANDOFF.md + CLAUDE.md current to PR #154)
Doc-only pass: `HANDOFF.md`'s header and §7 narrative had stalled at PR #145 (2026-07-16) even though nine
more PRs (#146-#154) had merged. Reconciled both against the actual code + the (already-current) changelog so
a cold-start session no longer misses recently-shipped work.
- **`docs/HANDOFF.md`**: bumped the "Last updated" line (#145 → #154). Added three missing §7 sections — the
  2026-07-17 security hardening pass (timing-oracle, atomic lockout, `x-vercel-forwarded-for` IP source,
  `otpEmail` limiter, flagged Next.js CVEs) + ISR-Writes realignment + desktop perf trims; the 2026-07-17/18
  Sodex calculator add/fix; and the 2026-07-19 free-tier overage fixes (Fluid Active CPU via the `loginIp`
  pre-bcrypt gate, `/api/markets/search` ISR window, `stripInlineImage()` FOT fix, signup schema-drift
  loud-fail, hardcoded-email removal). Added three owner action items to §8: prod DB migration re-run,
  one-time inline-`data:`-avatar DB check, and the Next.js CVE upgrade.
- **`CLAUDE.md`**: "Current state" dated 2026-07-16 → 2026-07-19, replaced the stale "this session" bullet
  with security-hardening + overage-fix + open-owner-action bullets, and documented the two-independent-keys
  rate-limit convention (`login`+`loginIp`, `otpEmail`, un-spoofable IP source) in Conventions.
- **Files**: `docs/HANDOFF.md`, `CLAUDE.md`, `docs/changelog.md`.

---

## 2026-07-19 — Feature downgrades for Hobby-plan cost: voice rooms removed, crons paused, manual AI briefing, shared realtime client, anon community preview
Owner-requested follow-up to the 2026-07-18 audit: trade specific features for lower ongoing cost while the
site stays on the free plan, deferring the removed pieces to when a paid plan is in place.

- **Mobile bottom nav**: replaced the Markets tab with Tools (`src/components/BottomNav.tsx`) - Tools is the
  free-to-use, no-login calculator hub and gets more mobile traffic relative to its cost than Markets' live
  price polling.
- **Voice Rooms removed entirely** (was LiveKit-powered, gated behind `voiceEnabled`): deleted
  `VoiceRoom.tsx`, `api/voice/token/route.ts`, `docs/VOICE.md`, the `livekit-client`/`livekit-server-sdk`
  dependencies, and every `LIVEKIT_*` env var (schema, `.env.example`, `src/lib/env.ts`'s `voiceEnabled`).
  Updated the `/terms` and `/privacy` copy that mentioned it. Can be reinstated from git history if revisited
  on a paid plan.
- **Push-dispatch + watchdog GitHub Actions crons paused**: commented out the `schedule:` trigger in both
  `.github/workflows/push-dispatch.yml` (was */10 min) and `watchdog.yml` (was */30 min), keeping
  `workflow_dispatch:` so either can still be run manually. Zero scheduled Function Invocations from these
  until re-enabled on a paid plan.
- **News AI briefing is now manual**: `NewsClient`'s story reader and `SharedArticle` (the shared-link page)
  used to auto-fire `/api/ai/why-matters` the moment a story opened. `BriefingBlock.tsx` gained an
  `onGenerate` prop and shows a "Generate briefing" button instead; the fetch only happens on click. Added a
  ref-based guard in both callers so a click that resolves after the reader has moved to a different
  story/unmounted can't set stale state (the old auto-fire had a `useEffect` cleanup for this that a manual
  click handler doesn't get for free).
- **Poll intervals widened** across the ticker and news/markets pollers: `useTickerPoll` 60s → 150s,
  `LiveNewsVisual` 60s → 150s, `NewsClient`'s realtime feed poll 45s → 90s, `MarketsClient`'s `TrendingNews`
  120s → 180s, and its four `usePolledJson` calls (global/defi/perp/coins) 120-150s → 180s.
- **One shared Supabase Realtime client for the whole tab**: every realtime/presence hook
  (`useRealtime`, `useLivePresence`, `useUserOnline`, plus `RealtimeSession`, `WhatsNewFeed`, `ChatClient`,
  `NavActivity`, `DashboardClient`) previously called `createClient()` itself, each opening its own physical
  WebSocket connection to the same Supabase project - a single page could open 2-4 redundant connections
  (site presence + navbar notifications + chat + comments, etc.) for no benefit, since Supabase multiplexes
  any number of channel subscriptions over one client. Added `src/lib/realtimeClient.ts` (a lazily-created
  singleton) and migrated all nine call sites to it. Concurrent-connection count against Supabase's Realtime
  quota drops from up to N per page to 1 per browser tab.
- **`/community` gives anonymous visitors a read-only preview** instead of the full live room: added
  `getCommunityPreview()` (`src/lib/chat.ts`, `unstable_cache`-backed, 15s shared TTL, no per-user data) and
  a new `CommunityPreview.tsx` component (last 20 messages + pinned banner + "Log in to join" CTA, no
  WebSocket connection, no composer). `community/page.tsx` now branches on `getServerSession()`: anonymous
  visitors skip the full-history Prisma query and the realtime channel entirely; logged-in members get the
  exact same full `ChatClient` experience as before, unchanged.

**Files**: `src/components/BottomNav.tsx`, `.github/workflows/push-dispatch.yml`, `.github/workflows/watchdog.yml`,
`src/components/BriefingBlock.tsx`, `src/components/NewsClient.tsx`, `src/components/SharedArticle.tsx`,
`src/lib/useTickerPoll.ts`, `src/components/LiveNewsVisual.tsx`, `src/components/MarketsClient.tsx`,
`src/lib/realtimeClient.ts` (new), `src/lib/useRealtime.ts`, `src/lib/useLivePresence.ts`,
`src/lib/useUserOnline.ts`, `src/components/RealtimeSession.tsx`, `src/components/WhatsNewFeed.tsx`,
`src/components/ChatClient.tsx`, `src/components/NavActivity.tsx`, `src/components/DashboardClient.tsx`,
`src/lib/chat.ts`, `src/components/CommunityPreview.tsx` (new), `src/app/community/page.tsx`,
`src/lib/env.ts`, `.env.example`, `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, `package.json`,
`CLAUDE.md`, `docs/HANDOFF.md` - removed: `src/components/VoiceRoom.tsx`, `src/app/api/voice/token/route.ts`,
`docs/VOICE.md`.

---

## 2026-07-18 — Hobby-plan performance audit: dedupe fetches, cut a doubled cron invocation, streaming/parallelism on Journal
Full-repo pass (routes, API handlers, cron/background tasks, `fetch()` sites, `useEffect` cleanup, bundle
size) specifically for Vercel Hobby-plan cost drivers, on top of the prior CPU/ISR-Writes/Fast-Origin-Transfer
rounds. Most of the codebase checked out clean (force-dynamic pages are all genuinely session-gated, bundle
sizes are all reasonable, the AI response cache is well-wired) - this round's changes are the handful of
confirmed, real findings.

- **`MarketTicker` + `LiveMarketVisual` polled `/api/ticker` independently** - two separate 60s intervals
  fetching the exact same endpoint whenever both render on a page (navbar marquee + homepage Products card),
  doubling that request volume for no benefit. Added `src/lib/useTickerPoll.ts`, a module-level
  `useSyncExternalStore` store shared by both components: one fetch, one interval, regardless of how many
  consumers are mounted: starts on first subscriber, stops when the last one unmounts, pauses while the tab
  is hidden. Rendered markup in both components is unchanged.
- **`/api/push/dispatch` self-fetched its own app's `/api/news` route** over HTTP instead of calling the
  underlying pipeline directly - a self-fetch anti-pattern that doubled Vercel Function Invocations on every
  cron tick (up to ~144/day from the GitHub Actions poller) for zero benefit, since `getNewsPage()` already
  sits behind the same cache `/api/news` itself reads from. Now calls `getNewsPage()` directly.
- **`vercel.json`** carried a redundant daily native cron (`/api/push/dispatch` at 08:00) duplicating a time
  slot already covered by the GitHub Actions 10-minute poller (`.github/workflows/push-dispatch.yml`).
  Removed.
- **`/journal`** (force-dynamic, largest route by First Load JS) ran two independent Prisma queries
  (`trade.findMany` with a `take: 1000` + nested `fills` include, then `riskProfile.findUnique`) sequentially
  instead of concurrently, and had no `loading.tsx` - every visit blocked the whole page (including the
  navbar) with zero streaming boundary. Parallelized the two queries with `Promise.all`, and added
  `src/app/journal/loading.tsx` matching the skeleton pattern already used by `/dashboard`.
- Two small missing-cleanup fixes found during the sweep: `PwaSetup.tsx`'s `appinstalled` listener was never
  removed on unmount (inline anonymous function, so even a naive removal wouldn't have matched);
  `CommandPalette.tsx`'s focus `setTimeout` had no cleanup. Both low severity in practice (both components
  mount once and persist), fixed as found.

**Deliberately not changed** (found, evaluated, and left alone to respect "no UI changes" / "keep existing
functionality"): `NewsClient`'s AI briefing auto-firing on every story view (shipped, user-visible UX, not a
bug); coin-brief/protocol-brief AI prompts embedding live numbers that defeat their own cache in practice
(low volume, click-gated); the duplicate CoinGecko fetch between `markets/[id]`'s `generateMetadata` and the
`coin/[id]` API route (fixable, but risks an SEO metadata regression for marginal gain); three independent
`/api/news` pollers across `LiveNewsVisual`/`MarketsClient`/`NewsClient` (different pages, not simultaneous,
lower severity than the ticker case); `/community`'s force-dynamic render (already a known, twice-deferred
structural lever, unchanged again this round).

- **Files**: `src/lib/useTickerPoll.ts` (new), `src/components/MarketTicker.tsx`,
  `src/components/LiveMarketVisual.tsx`, `src/app/api/push/dispatch/route.ts`, `vercel.json`,
  `src/app/journal/page.tsx`, `src/app/journal/loading.tsx` (new), `src/components/PwaSetup.tsx`,
  `src/components/CommandPalette.tsx`.

---

## 2026-07-19 — Fix Vercel free-tier overages: Fluid Active CPU (exceeded), ISR Writes, Fast Origin Transfer
Owner's Vercel dashboard showed "Exceeded free resources": Fluid Active CPU 6h23m/4h (already over), ISR
Writes 161K/200K (80.5%), Fast Origin Transfer 9.07/10GB (90.7%). Three parallel investigations found
concrete root causes for each - one a direct regression from a security fix shipped earlier this session.

**Fluid Active CPU (the urgent one)** - the 2026-07-17 login timing-attack fix added a dummy
`bcrypt.compare()` on every failed/nonexistent-account login attempt to stop timing-based user enumeration.
Benchmarked on this machine: `bcryptjs` (the pure-JS package this repo uses, not native `bcrypt`) costs
~317-352ms of genuine synchronous CPU per call at cost factor 12 - 2-4x higher than the ~80-150ms the
original fix assumed, since pure-JS bcrypt can't offload to a native threadpool. Fluid Compute bills
specifically for synchronous CPU time. The login rate limiter was keyed only by target email, not caller
IP, so a bot rotating through fake emails from one IP was barely throttled - each attempt still forced a
full bcrypt op.
- **Fix**: added a genuine per-IP rate limit (`loginIp`, 20/min/IP) checked *before* any bcrypt work runs in
  the credentials login path, alongside (not replacing) the existing per-email limiter and the timing-safety
  fix itself. `src/lib/ratelimit.ts` gained `clientIpFromHeaders()` since NextAuth's `authorize(credentials,
  req)` passes a plain `Record<string, any>` headers object, not a `Headers` instance with `.get()`.
- **Files**: `src/lib/auth.ts`, `src/lib/ratelimit.ts`.

**ISR Writes** - confirmed the 2026-07-17 fix is genuinely working (daily write rate roughly halved,
traced via this changelog's own historical percentage snapshots), the 161K figure is just a blend of the
old faster pre-fix rate (most of this billing cycle) plus ~2 days of the new slower rate. Found one
genuinely missed route from that audit: `/api/markets/search` - still `revalidate = 60`, keyed by an
arbitrary user-typed search string (high cardinality, same risk class already fixed for per-coin routes).
Predates the 07-17 audit, simply missed.
- **Fix**: lengthened `/api/markets/search`'s `revalidate` 60s → 300s, with matching `Cache-Control` headers.
- **Files**: `src/app/api/markets/search/route.ts`.

**Fast Origin Transfer** - every previously-fixed contributor confirmed still working, nothing to re-touch.
`/community`'s force-dynamic render remains a known, twice-already-deferred structural lever (unchanged).
Found a new, previously-uncaught contributor: `uploadImage()` (`src/lib/storage.ts`) falls back to storing
an uploaded avatar/banner as a raw base64 `data:` URL (up to 700KB) directly in the DB whenever Supabase
Storage is unconfigured or fails. That field was being selected raw and uncompressed in several hot,
high-fan-out paths never scoped for this: every community chat message's author, every DM conversation
partner, public post comments, follow lists, and public profile/article pages. A single active user with a
large inline avatar could plausibly be a multi-hundred-MB/month contributor on its own - invisible in
payload-shape review since it's "just a string field." This is distinct from the navbar's existing
JWT-stripping fix, which only covers the 4KB session-cookie concern for the current user's own navbar, not
any of these DB-read paths serving *other* users' images to *other* viewers.
- **Fix**: added `stripInlineImage()` (`src/lib/utils.ts`) - converts a `data:` URL image to `null` (client
  already falls back to initials gracefully) - and applied it at all six read paths: `src/lib/chat.ts`
  (`toChatPayload`), `src/lib/dm.ts` (`otherOf`), `src/app/api/posts/[id]/comments/route.ts` (GET + POST),
  `src/app/api/follow/list/route.ts`, `src/app/u/[username]/page.tsx` (`getProfile`), and
  `src/app/research/[slug]/page.tsx` (`getPost`).
- Flagged for the owner, not fixed in code: whether any real users have hit this fallback needs a one-time
  read-only production DB check (`SELECT username, length(image) FROM "User" WHERE image LIKE 'data:%' ...`)
  to quantify actual impact and decide if existing data needs backfilling - the code fix above is safe
  defense-in-depth regardless of the answer.
- **Files**: `src/lib/utils.ts`, `src/lib/chat.ts`, `src/lib/dm.ts`,
  `src/app/api/posts/[id]/comments/route.ts`, `src/app/api/follow/list/route.ts`,
  `src/app/u/[username]/page.tsx`, `src/app/research/[slug]/page.tsx`.

## 2026-07-19 — Remove hardcoded personal email + regenerate .env.example
Two items from the corrected hardening checklist, both real and cheap:
- **`.env.example:46`** (`ADMIN_EMAIL`) and **`src/lib/env.ts`** (`VAPID_SUBJECT`'s fallback) both had the
  owner's real personal Gmail hardcoded - publicly documenting exactly which account auto-promotes to
  ADMIN if that inbox were ever compromised. `.env.example` now uses a generic placeholder.
  `VAPID_SUBJECT` can't just be blanked though - `web-push`'s `setVapidDetails()` throws at runtime on an
  empty/invalid subject once the VAPID keys are configured, so it now falls back to the site's existing
  public support address (`site.email`, already used elsewhere e.g. the Terms/Privacy Grievance Officer
  contact) instead of a real personal one.
- **`.env.example` was 17 env vars behind `src/lib/env.ts`** (`GEMINI_API_KEY`, `AI_PROVIDER_ORDER`, the
  three `AI_DAILY_LIMIT_*`, `CMC_API_KEY`, `GIPHY_API_KEY`, the three VAPID vars, `CRON_SECRET`,
  `TELEGRAM_BOT_TOKEN`/`CHAT_ID`, the three `LIVEKIT_*` vars, and `SENTRY_DSN`) - anyone bootstrapping from
  it silently got voice, push, Sentinel, GIFs, CMC enrichment, and the AI fallback switched off with no
  hint they exist. All 17 added, grouped into new sections matching the file's existing style.
- **Files**: `.env.example`, `src/lib/env.ts`.

## 2026-07-19 — Fix: signup silently failing on DB schema drift, made loud instead
Owner reported no new signups showing in the dashboard for a while, and separately hit a real "Database not
migrated: a required column is missing" error on `/forgot-password` - confirming the production DB has
genuinely drifted behind `prisma/schema.prisma` (the `db push` step in the `vercel-build` script is
best-effort/non-fatal, so a failed run there can silently persist across deploys with zero visibility).
Password reset already surfaces this correctly via `handleError`'s existing P2021/P2022 → "Database not
migrated" mapping - but the signup-completion path had no such handling.
- **Root cause found**: `src/lib/auth.ts`'s NextAuth `authorize()` signup-completion branch calls
  `prisma.user.findUnique({ where: { email } })` with no explicit `select` (unlike the login path, which
  was already hardened with one) - so it fetches every column in the schema. A missing column there throws,
  NextAuth turns any thrown `authorize()` error into the same generic result the client already shows for a
  genuinely wrong code ("Incorrect or expired code. Please try again.") - and since `verifyCode()` deletes
  the one-time code the moment it validates, the user is then stuck in an unrecoverable retry loop with no
  new row ever created, and no error anywhere pointing at the real cause.
- **Fix**: both DB touches in that branch (`findUnique` and the `create()` fallback) now explicitly catch
  P2021/P2022, report to Sentry (`Sentry.captureException`, tagged `area: signup-completion`) and console,
  then return `null` - same safe behavior as before, but now loud instead of silent. This won't fix already-
  drifted production data (that needs the actual migration re-run, which only the owner can trigger via a
  fresh deploy or `prisma db push` with real credentials), but the next time this happens it surfaces
  immediately instead of silently starving signups for an unknown stretch of time.
- **Update (2026-07-19): live signups verified working** - a real account was created successfully, so the
  `User`-table columns the signup path touches are back in sync (via a deploy re-running the `vercel-build`
  `db push`, or the drift having only ever affected other columns). The remaining open question is whether
  *other* tables are still drifted - see `docs/HANDOFF.md §8`.
- **Files**: `src/lib/auth.ts`.

## 2026-07-18 — Fix: Sodex calculator's total-supply/pool-size conflation + add 50%/30% pool buttons
Owner caught a real bug via screenshot: the previous Sodex entry set `totalSupply` to 150,000,000 (the
SoPoints airdrop pool size), not SOSO's real total supply of 1,000,000,000 - so the "Total token supply"
field showed the wrong number, and typing a smaller test value into it (e.g. 45) blew up the implied price
to an absurd $966,666 instead of the real $0.29. Corrected the data model: `totalSupply` is now the real 1B,
`fdvScenariosUsd` is the real FDV ($0.29 × 1B = $290M), and the 150M-token pool is expressed correctly as
15% of total supply via `allocationPctOfSupply`.
- Also added the two scenarios the owner asked for as one-click options, not just editable-by-hand: a new
  optional `allocationScenarios` field on `PointValueScenario` (`src/lib/dex-registry.ts`) renders a row of
  quick-select buttons - "100% pool - 150M SOSO" (15%), "50% pool - 75M SOSO" (7.5%), "30% pool - 45M SOSO"
  (4.5%) - mirroring the existing FDV-scenario button pattern exactly.
- Purely additive to `PointsValueCalculator.tsx`: the new button row only renders when a platform provides
  `allocationScenarios`, so Variational (and every other existing platform) is pixel- and behavior-identical
  to before - only Sodex gains the new row.
- Verified by hand against the owner's numbers: $1.611111 / $0.805556 / $0.483333 per SoPoint across the
  100%/50%/30% scenarios, all reproduced exactly.
- **Files**: `src/lib/dex-registry.ts`, `src/components/tools/PointsValueCalculator.tsx`.

## 2026-07-17 — Add Sodex to the Points/Airdrop Value Calculator
Added Sodex (SOSO token, SoPoints program) as a preset platform in the existing Points/Airdrop Value
Calculator on `/tools` - same generic calculator + registry-driven pattern already used for Variational,
Hyperliquid, GMX, dYdX, Vertex, and Aevo, so no component or share-flow code changed at all, just one new
`DEX_REGISTRY` entry. Real logo comes for free via the existing favicon-by-domain mechanism (`sodex.com`),
same as every other platform - no image asset committed.
- Scenario numbers (150,000,000 SOSO SoPoints pool, 27,000,000 total SoPoints, $0.29 real current SOSO
  price) reproduce the given real figures exactly through the calculator's existing formula: $1.611111 per
  SoPoint at full pool distribution, $43,500,000 total pool value - verified by hand before shipping.
- Sharing works identically to every other platform (Post to X / copy link / copy image / download), since
  the share card route reads the platform name + domain generically from the saved snapshot.
- **Files**: `src/lib/dex-registry.ts`.

## 2026-07-17 — Fix: ISR Writes approaching Vercel free-tier quota
Owner got a Vercel email: the free team had used 75% of the 200,000/month **ISR Writes** quota (a
different metric from the Fast Origin Transfer work earlier this session) - exceeding it auto-pauses the
whole site. Audited every `revalidate` window and every `revalidatePath()` call site. Root cause: several
high-traffic routes had a `revalidate` window matched almost exactly by a client-side poll interval of the
same length, so the ISR cache was being regenerated as often as the code could possibly trigger it -
`/api/ticker` (10s window, 10s poll, homepage-mounted) was the single largest contributor, with a
theoretical ceiling alone (~259k/month) already above the entire monthly quota. `/api/news` compounds this
further since it caches per-RSS-source-URL - a short window multiplies across every source. No
`revalidatePath()`/`revalidateTag()` call site was a meaningful contributor (all are either admin-gated and
rare, or self-service and rate-limited to 10/min/user).
- **`/api/ticker`**: `revalidate` 10s → 60s; **`MarketTicker.tsx`** poll 10s → 60s; **`LiveMarketVisual.tsx`**
  poll 30s → 60s (matches).
- **`news-fetch.ts`** (`NEWS_REVALIDATE`, shared by `/api/news` + `/news`): 20s → 90s; **`news/page.tsx`**:
  30s → 90s; **`NewsClient.tsx`** poll 20s → 45s.
- **`/api/markets/coins`**: 45s → 120s; **`/api/markets/perp`** + **`/api/markets/global`**: 60s → 150s;
  **`MarketsClient.tsx`** pollers realigned to match each route's new window (also fixed `defi`'s poll,
  which was already polling faster than its own 120s cache).
- **`/markets/[id]`** page: 120s → 300s; **`/api/markets/coin/[id]`**: 60s → 150s; **`CoinDetailClient.tsx`**
  poll 30s → 150s - these are dynamic per-coin-id routes, so the write cost multiplies by how many distinct
  coins get traffic, not just window length.
- All `Cache-Control: s-maxage/stale-while-revalidate` response headers updated to match the new windows.
- **Files**: `src/app/api/ticker/route.ts`, `src/app/api/news/route.ts`, `src/app/api/markets/coins/route.ts`,
  `src/app/api/markets/perp/route.ts`, `src/app/api/markets/global/route.ts`,
  `src/app/api/markets/coin/[id]/route.ts`, `src/app/markets/[id]/page.tsx`, `src/app/news/page.tsx`,
  `src/lib/news-fetch.ts`, `src/components/MarketTicker.tsx`, `src/components/LiveMarketVisual.tsx`,
  `src/components/MarketsClient.tsx`, `src/components/NewsClient.tsx`, `src/components/CoinDetailClient.tsx`.

## 2026-07-17 — Security hardening pass + further desktop performance trims
Owner asked for a full security check with real fixes (not just a report) plus another desktop performance
pass, following the earlier duplicate-starfield fix (PR #146 below). All findings came from three parallel
codebase audits; each fix below was verified with `tsc --noEmit` + `next lint` + `vitest` (335 tests) +
`next build`, all green.

**Security:**
- **`src/lib/auth.ts`**: login timing-oracle fix - "no such account," "account locked," and "wrong
  password" all now cost the same by running a dummy `bcrypt.compare()` against a fixed never-matching
  hash on the two fast-fail paths, closing a user-enumeration vector based on response latency. Also fixed
  the login-lockout counter: it was a read-then-write (`fails = count + 1`), so N concurrent failed
  attempts could all read the same starting count and only ever advance it by 1 - a parallelization bypass
  of the 5-attempt lockout. Now a single atomic Prisma `{ increment: 1 }`, which Postgres row-locks. Added
  a `rateLimit()` call on the signup OTP-verify path in `authorize()`, on top of `otp.ts`'s own attempt
  counter.
- **`src/lib/ratelimit.ts`**: `clientIp()` now prefers `x-vercel-forwarded-for` (set by Vercel's edge
  network, not client-controllable) over the spoofable `x-forwarded-for`, closing a bypass where every
  IP-keyed limiter (signup/comment/like/subscribe/password) could be defeated by rotating a client-set
  header. Added a new `otpEmail` limiter (3 per 10 min, keyed by the target email, independent of the
  IP-keyed limiters) to stop email-bombing a single address via IP rotation - wired into
  `api/auth/signup/start` and `api/auth/password/start`. Upstash-not-configured-in-production now also
  fires a `Sentry.captureMessage` (was `console.warn`-only, easy to miss in log volume) since it silently
  disables all rate limiting.
- Flagged, not auto-fixed (needs explicit owner go-ahead): `npm audit` shows 8 real CVEs in the Next.js
  dependency tree, all requiring `next` 14.2.35 → 16.2.10 (2 major versions) to resolve - too large a
  blast-radius change to apply in this pass.

**Performance (desktop):**
- **`Navbar.tsx`**: `<NavActivity />` (bell + chat icon, 60s poll + a Supabase realtime subscription) was
  mounted **twice** - once inside the `hidden md:flex` desktop wrapper, once inside the `flex md:hidden`
  mobile wrapper. Tailwind's `hidden`/`md:hidden` only toggle CSS `display`, not React mount state, so both
  copies were live and polling/subscribed at every viewport size. Now a single shared instance.
- **`PageBackground.tsx`**: was `absolute inset-0`, so its blurred mesh/grid/glow layers stretched to the
  full scrollable height of long product pages. Now bounded to `h-screen` - it's only ever visible behind
  the top of the page anyway.
- **`globals.css`**: trimmed the desktop base blur radii for `.mesh` (96px → 70px) and `.aurora` (62px →
  45px) - these full-screen Gaussian blurs are a recurring compositing cost; mobile already had its own
  trim, desktop never did.
- **`PostCard.tsx` / `ResearchGrid.tsx`**: added a `priority` prop, wired to the first card in the grid, so
  the above-the-fold research-hub image isn't lazy-loaded.
- **Files**: `src/lib/auth.ts`, `src/lib/ratelimit.ts`, `src/app/api/auth/signup/start/route.ts`,
  `src/app/api/auth/password/start/route.ts`, `src/components/Navbar.tsx`,
  `src/components/PageBackground.tsx`, `src/app/globals.css`, `src/components/PostCard.tsx`,
  `src/components/ResearchGrid.tsx`.

## 2026-07-17 — Fix: desktop lag / jank on the homepage
Owner reported the site had gotten laggy and the design wasn't rendering cleanly, specifically on desktop.
Measured directly (Playwright, 1920x1080): the homepage had **257+ simultaneously "running" CSS
animations** on load, growing past 270+ once scrolled. Root cause traced to `Starfield` (stars + shooting
meteors + nebula haze) being mounted **twice** on the homepage - once directly in `Hero.tsx`, once again
via `OrbitalBackdrop.tsx` for the orbital section right below it - and both mounts rendering their full,
non-reduced desktop star/shooter set (the existing mobile media query only trims the "extra" tier; desktop
was never trimmed at all). The two sections sit close enough that scrolling between them puts both
starfields active at once, doubling an already-heavy continuous-animation cost for no real visual benefit
(they read as one continuous backdrop, not two distinct scenes) - a cost that scales with viewport size, so
it's naturally worse on desktop's larger canvas than on mobile.
- **`Starfield.tsx`**: added a `light` prop that renders half the shooting-star set (6 instead of 12).
- **`OrbitalBackdrop.tsx`**: now passes `light`, so only the Hero's Starfield mount (the one seen first,
  worth keeping at full richness) renders the full 12-shooter set; the orbital section's redundant
  continuation mount is lighter. Total shooting-star elements on the homepage: 24 → 18.
- Confirmed via direct computed-style sampling (not just a screenshot) and a full desktop screenshot pass -
  no visual regression, still reads as one continuous starfield across both sections.
- **Files**: `src/components/Starfield.tsx`, `src/components/OrbitalBackdrop.tsx`.

## 2026-07-16 — REVIEW (not merged): further Fast Origin Transfer reduction
Owner wants Fast Origin Transfer usage (8.58GB/10GB) reduced enough to comfortably last another 4-5 months
on the free plan. Fresh audit for more of the same class of bug already fixed on `/research/[slug]` and
`/api/news/social`. Kept as an unmerged PR for review per the owner's request, rather than auto-merged like
the earlier rounds.
- **`/api/chat/messages` (GET)** - the single largest remaining driver found: polled every 10s by every open
  `/community` tab as the realtime fallback, with no `Cache-Control` at all, running 2-3 Prisma queries per
  call and returning a heavy payload (50 messages with nested user/replyTo/reactions/poll objects). For an
  anonymous requester (no poll votes to stamp) the response for a given cursor is identical across all
  visitors, so it's now cached publicly for a few seconds (`public, s-maxage=8, stale-while-revalidate=20`),
  matching the `api/news/social` recipe. Logged-in responses stay `private, no-store` since `myVote` is
  genuinely per-viewer.
- **Lengthened ISR windows** on pages whose content only actually changes via an explicit edit (which
  already calls `revalidatePath`) - the time-based window is just a safety net, so a shorter one buys nothing
  but more origin re-renders: `research/[slug]` 60s → 300s, `research` (hub) 120s → 300s, `u/[username]`
  60s → 300s.
- **Investigated but not touched**: `/community`'s own force-dynamic render (unconditional `getServerSession`
  even for anonymous visitors) - still the biggest *structural* win, but unlocking it means moving
  poll-vote/`me` personalization out of the 1744-line `ChatClient.tsx` into a client-side fetch, a bigger
  refactor than this pass's scope; `news/read` is dynamic only because it's driven by `searchParams` (share
  links), low traffic, would need a route-param refactor to fix. Both flagged as future candidates.
- **Files**: `src/app/api/chat/messages/route.ts`, `src/app/research/[slug]/page.tsx`,
  `src/app/research/page.tsx`, `src/app/u/[username]/page.tsx`.

## 2026-07-16 — PREVIEW (not merged, revised): hero-only display typeface + word-stagger reveal
Owner asked for "best in class" text/typography, then narrowed scope after seeing the first pass: keep the
new serif ONLY on the hero's "Everything you need to win in Web3" line, revert every other heading back to
the original font, and make the entrance animation more obviously "next level." Still a separate, unmerged
preview branch/PR so it can be reviewed and accepted/rejected independently of anything else.
- **Fraunces, scoped to the hero headline only**: loaded via its own `--font-fraunces` CSS variable (not
  the shared `font-display` Tailwind class), applied directly to `Hero.tsx`'s `<h1>` via inline
  `fontFamily`. `SectionHeading` and every other heading site-wide are back to the original Geist Sans -
  confirmed via computed style (`h1` → Fraunces, `h2` → Geist Sans).
- **Word-by-word stagger reveal** (replaces the earlier whole-block "focus-pull," which read as too subtle
  to notice): each chunk of the headline ("Everything" / "you" / "need" / "to" / "win in Web3.") is its own
  `motion.span` that blurs-in and rises into place on its own staggered beat (~100ms apart), so the line
  reads as a deliberate cascade landing into place rather than one fade. Confirmed via direct style
  sampling across the transition - words visibly sharpen in sequence, not all at once. `Reveal.tsx` and
  `SectionHeading` are reverted to their original, unmodified state (the animation lives entirely in
  `Hero.tsx` now, scoped to the one headline it's for).
- **Files**: `src/app/layout.tsx`, `tailwind.config.ts`, `src/components/Reveal.tsx`,
  `src/components/ui/primitives.tsx`, `src/components/Hero.tsx`.

## 2026-07-16 — Fix: ticker + text-shine + rest of the brand's ambient animations still static on reduced-motion
Follow-up to the earlier Icons3D/shooting-star fix - owner reported the Live Market ticker and other
animations were still going static on the same preview, and asked to "fix everyone." The previous fix only
carved out the two specifically-reported elements; the ticker marquee, the text-shine gradient sweep, and
the remaining ambient loops (mesh, aurora, particles, Saturn/Moon bob, button sweeps) were still silenced
by the same `prefers-reduced-motion: reduce` media query.
- **`globals.css`**: removed the entire animation-disable list from the reduced-motion media query. Every
  brand/ambient animation now always plays regardless of the OS-level reduced-motion preference - these are
  a deliberate, always-alive part of the site's look, not incidental decoration. `scroll-behavior: auto`
  (calms scroll-jump, a real vestibular trigger, and is unrelated to decorative animation) is the one
  reduced-motion accommodation kept.
- **Files**: `src/app/globals.css`.

## 2026-07-16 — Fix: icon animations + shooting stars going fully static on reduced-motion
Owner reported the About/Products icon animations and the hero's shooting-star meteors were still static
on desktop even after the earlier stale-chunk fix. Reproduced directly with Playwright's reduced-motion
emulation: confirmed both go completely inert (`animation: none`, frozen transforms) specifically when
`prefers-reduced-motion: reduce` is active, while working correctly with it off - this exactly matches the
report if the test browser/OS has that accessibility setting on (a common default in some environments,
not always something a user consciously enabled).
- **`globals.css`**: the reduced-motion media query previously silenced the entire Icons3D system
  (`.i3d-spin/-bob/-scan/-pulse/-tick/-sweep/-float/-beat/-twinkle/-flick` - every animated icon across
  About/Products/Markets/News/Premium) and every span inside `.starfield` (which includes the shooting
  stars, not just the ambient twinkle). These are a deliberate, signature part of the brand's look, not
  incidental decoration, so they're removed from the disable list and now always animate regardless of the
  OS-level reduced-motion preference. The ambient starfield twinkle/drift and other heavy full-screen loops
  (mesh, aurora, particles, Saturn/Moon bob, marquee, text-shine) still correctly respect reduced motion -
  only the two reported elements were carved out.
- **Files**: `src/app/globals.css`.

## 2026-07-16 — Further reduce Fast Origin Transfer: /api/news/social edge caching
Follow-up audit for more of the same class of bug already fixed on `/research/[slug]` (unconditional
session lookup on public content forcing every anonymous read to hit the origin).
- **`/api/news/social` (GET)** - polled once per story card on `/news` (high anonymous traffic), had no
  `Cache-Control` at all. For a signed-out visitor `liked`/`mine` are always `false` regardless of who's
  asking, so that response is identical for every anonymous visitor and is now cached publicly at the edge
  (`public, s-maxage=15, stale-while-revalidate=60`) - cutting repeat function invocations for the same
  story to once per cache window instead of once per anonymous pageview. Logged-in responses stay
  `private, no-store` since `liked`/`mine` are genuinely per-viewer there.
- **Audited but intentionally left alone**: `/community` has the same `force-dynamic` + unconditional
  `getServerSession()` pattern, but unlocking ISR for it would mean moving the viewer's poll-vote/`me`
  personalization out of the 1744-line `ChatClient` and into a client-side fetch (the same shape as the
  `LikeButton` self-correction pattern) - a much larger, riskier change to a live real-time chat surface
  for comparatively low anonymous traffic. Flagged as a future candidate, not done here.
- **Files**: `src/app/api/news/social/route.ts`.

## 2026-07-16 — Fix: page can "freeze" (dead animations, stale ticker) after a deploy + third ticker upstream
Owner reported desktop homepage icon animations had stopped and the Live Market ticker had gone static
again. Reproduced the underlying failure class directly: a stale cached page referencing a JS chunk hash
that no longer exists on the current deployment gets a 404 (served as HTML), the browser correctly refuses
to execute HTML as a script (MIME mismatch), and hydration silently never finishes - every client
component past that point (framer-motion icon animations, the ticker's data-fetching effect) stays inert,
which reads exactly like "everything just froze/went static," while pure-CSS animations (marquee, orbital
rings) keep running since they don't need JS. The service worker's own cache is the most likely place a
stale page like that survives across a deploy.
- **`public/sw.js`**: bumped the cache version (`xyz-pwa-v5` → `v6`) to purge any already-stale cached
  navigation entries for current visitors.
- **`PwaSetup.tsx`**: the service worker now proactively re-checks for a newer version whenever the tab
  regains focus (`registration.update()`), instead of only on next navigation. Added a safety net that
  detects a stale-chunk failure (a `<script>` load 404 via the capture-phase `error` listener - resource
  load failures don't bubble - or a thrown `ChunkLoadError`/dynamic `import()` failure) and forces one
  guarded hard reload to recover onto the current deployment, instead of leaving the page silently dead.
- **`api/ticker`**: added CryptoCompare as a third upstream (`CoinGecko → Binance → CryptoCompare → last-
  known-good → seed fallback`). Binance.com itself geo-blocks the US and several other jurisdictions
  (HTTP 451), which is a real risk given Vercel's default serverless region - a differently-hosted third
  opinion means CoinGecko and Binance would both have to fail for unrelated reasons at once for the ticker
  to go stale again.
- **Files**: `public/sw.js`, `src/components/PwaSetup.tsx`, `src/app/api/ticker/route.ts`.

## 2026-07-16 — Add real Terms of Service + Privacy Policy pages
Owner asked for real Terms/Privacy pages on the site (not just a reference doc) "so koi legal problem na
ho sake" - the site already collects real personal data (accounts, chat, DMs, trading journal entries,
IP-based rate limiting) with no published policy anywhere, flagged earlier as the top legal gap.
- **New `/terms` and `/privacy` pages**, written specifically for this product (not generic boilerplate):
  covers what the Service is and isn't (not a broker/exchange/custodian, no financial advice), the Trading
  Journal's public/private visibility model (private by default, opt-in Public/Anonymous per trade, dollar
  amounts never public), an honest third-party processor list matching the real integrations in
  `src/lib/env.ts` (Supabase, Vercel, Upstash, Resend, Sentry, Groq/Gemini, LiveKit, OAuth providers), and
  an IT Rules 2021 Grievance Officer contact (using the existing public support email, with a note that a
  named officer will be published once the company is formally incorporated - owner had no name to give
  yet). Both pages carry a visible "not yet incorporated / not a substitute for a lawyer" disclaimer.
- **`Footer.tsx`**: added a Terms/Privacy link row next to the copyright line, visible sitewide.
- **`SignupForm.tsx`**: the post-signup consent line now links to the real `/terms` and `/privacy` pages
  instead of only mentioning product-update emails - this is the actual consent-capture moment.
- Reuses the existing `.prose-xyz` typography class so the legal pages read consistently with research
  articles rather than introducing new styling.
- **Files**: `src/app/terms/page.tsx` (new), `src/app/privacy/page.tsx` (new), `src/components/Footer.tsx`,
  `src/components/SignupForm.tsx`.

## 2026-07-16 — Reduce Vercel Fast Origin Transfer: /research/[slug] ISR + journal-activity caching
Owner reported Fast Origin Transfer at 8.35GB/10GB. Two concrete causes found and fixed:
- **`/research/[slug]` converted from `force-dynamic` to ISR** (`revalidate = 60`) - the single biggest
  lever identified months ago but never actually shipped until now. Root cause: the page unconditionally
  called `getServerSession()` for every post (even free ones), which alone forced every anonymous article
  read to be a full uncached origin invocation. Now `getServerSession()` is only called when
  `post.premium` is true (checking the flag itself is a plain DB read, not a Dynamic API call) - free
  posts are ISR-eligible and served from the CDN on repeat reads; premium posts stay fully dynamic and
  are therefore never written to a shared cache at all (no stale-cache-leaks-premium-content risk).
  Premium up/downgrade freshness is unaffected - already-deployed `RealtimeSession.tsx` refreshes the
  session instantly on a `membership_changed`/`access_changed` broadcast, so dropping the extra
  per-request DB re-check (previously the 4th query on every load) doesn't lose the "instant" guarantee.
  View counting moved to a client-side beacon (`TrackPostView` → `POST /api/posts/[id]/view`) so it stays
  accurate per-real-view instead of only firing once per cache window. `CommentSection`'s admin-only
  controls now read `isAdmin` from its own session instead of a server-baked prop (verified safe: comment
  deletion already independently re-authorizes server-side). `LikeButton` self-corrects its liked state
  once on mount for logged-in users, since a cached free-post page can no longer bake in a per-visitor
  `initialLiked`.
- **`/api/journal/share/activity/[userId]` now sends `Cache-Control`** (`s-maxage=30,
  stale-while-revalidate=60`, matching the other `share/*` routes' recipe) - this endpoint is polled every
  60s by `JournalActivityFeed` on the *public* `/u/[username]` profile page (any visitor, not just the
  profile owner) whenever Supabase realtime isn't configured, and previously had zero caching at all -
  same bug class as the earlier NavActivity fix, smaller blast radius.
- **Files**: `src/app/research/[slug]/page.tsx`, `src/components/TrackPostView.tsx` (new),
  `src/app/api/posts/[id]/view/route.ts` (new), `src/components/CommentSection.tsx`,
  `src/components/LikeButton.tsx`, `src/app/api/posts/[id]/like/route.ts`, `src/lib/ratelimit.ts`,
  `src/app/api/journal/share/activity/[userId]/route.ts`.

## 2026-07-15 — Fix: ticker second upstream (Binance) when CoinGecko is unreachable
Follow-up to the same-day ticker fix - owner reported the homepage ticker was still showing static
prices after that fix shipped. Root-caused with an actual browser test (Playwright against a real
production build): the client fetch loop, state updates, and CSS scroll animation are all working
correctly - the previous fix's in-memory "last good" cache only helps for *intermittent* CoinGecko
failures, but does nothing if CoinGecko has never succeeded even once (a well-documented real-world
issue: CoinGecko's free/keyless API aggressively rate-limits shared cloud IPs like Vercel's, which can
mean a *sustained*, not intermittent, failure). Added Binance's public ticker API (`api.binance.com`,
also free/keyless, much more generous per-IP limits) as a second upstream `/api/ticker` tries when
CoinGecko itself is unreachable, before falling back to last-known-good or hardcoded seed data.
- **Files**: `src/app/api/ticker/route.ts`.
- **Separately identified (not a code bug, needs a production DB migration - see owner follow-up)**:
  the Points Value "Share result" button's popup-timing bug is confirmed fixed (verified via a real
  browser click in a production build - the tab opens correctly and an error now surfaces on failure),
  but the underlying `POST /api/tools/share/create` call can still 503 if the `SharedCard` table
  (migration 28) - or `ChallengeDayNote`/`JournalActivity`, migrations 29/30 - haven't been applied to
  the real production database yet.

## 2026-07-15 — Fix: points-value share popup blocked, ticker "frozen" fallback, desktop blank-page cache bust
Three targeted bug fixes, no redesign - each isolated to the specific broken/fragile path:
- **Points Value "Share result" wasn't opening**: `PointsValueCalculator.tsx`'s `share()` called
  `window.open()` *after* an `await fetch()` - most browsers (Safari especially) only allow
  `window.open()` to bypass the popup blocker when it's invoked synchronously within the original click's
  call stack, so the tab was being silently blocked with zero error surfaced. Fixed by opening a blank tab
  immediately on click (still inside the user gesture) and navigating it once the share id comes back;
  falls back to same-tab navigation if the popup was blocked outright, and now surfaces a real error
  message if the create request itself fails (previously a silent `catch`).
- **Homepage "Live Market" ticker looking static**: root cause traced to CoinGecko's free/keyless API
  rate-limiting - when the upstream call fails, `/api/ticker` was falling back to the same hardcoded seed
  prices every time, which reads as a frozen/dead ticker during any sustained outage (the scroll animation
  and 10s poll loop themselves were already correct, not the issue). Added an in-memory "last successful
  fetch" cache in `src/app/api/ticker/route.ts` so a failed refresh serves the last real prices instead of
  the same static numbers.
- **Desktop blank page (recurrence)**: the historical cause (WebGL orbital crashing on some desktop GPUs)
  was already hard-disabled (`useWebglGate.ts` returns `false`) and wrapped in error boundaries in a prior
  fix, with no code regression found in the relevant files since. Bumped the PWA service worker cache
  (`public/sw.js`, `xyz-pwa-v4` → `v5`) to force any returning visitor still on a stale pre-fix cached
  bundle to pick up the current code - the same remediation used the first time this symptom appeared.
- **Files**: `src/components/tools/PointsValueCalculator.tsx`, `src/app/api/ticker/route.ts`, `public/sw.js`.

## 2026-07-15 — Public Journal Activity on profiles + trade visibility control
Fifth and final phase of the "Journal → best in class" build, and the owner's explicitly "most important"
ask: whatever a member does in their trading Journal now shows up on their public profile.
- **New profile section**: `/u/[username]` gains a dedicated "Journal Activity" section (between Stats and
  the existing comments-only Recent activity block) - a live feed of trade/challenge events, updating in
  realtime via the same `userChannel(userId)` broadcast pattern Phase 3 introduced for live Trades sync.
  New `JournalActivity` model (migration 30), written by the trade/challenge mutation routes as
  fire-and-forget, aggregate-only inserts.
- **Privacy, by construction**: a row is only ever written when the source trade/challenge's own
  `visibility` isn't `"private"` - private trades and challenges never produce a public row, and flipping
  visibility on an existing trade doesn't retroactively backfill history (prevents a toggle-spam vector).
  Dollar amounts are never included anywhere - `trade_closed` carries only a win/loss sign, stricter than
  even the existing opt-in share cards.
- **Fixed a gap that would've made this invisible**: `TradeForm` had no visibility control at all (every
  trade defaulted to private with zero UI path to change it, unlike Challenges which already had one) -
  added a Private/Public/Anonymous picker to both the create form and the expanded trade row (so
  already-logged trades can be opted in later too), reusing the existing PATCH endpoint's `visibility`
  field.
- **Files**: `prisma/schema.prisma`, `prisma/migrations/30_journal_activity/`, `src/lib/journal-activity.ts`
  (+tests), `src/app/api/journal/trades/route.ts`, `src/app/api/journal/trades/[id]/route.ts`,
  `src/app/api/journal/challenges/{route.ts,[id]/route.ts,[id]/join/route.ts,[id]/milestones/[milestoneId]/route.ts}`,
  `src/app/api/journal/share/activity/[userId]/route.ts`, `src/components/JournalActivityFeed.tsx`,
  `src/components/journal/{TradeForm,JournalClient}.tsx`, `src/app/u/[username]/page.tsx`.

## 2026-07-15 — Journal Challenges day-tracker + Create→auto-expand + Risk discipline trend + position calc
Fourth phase of the "Journal → best in class" build (Analytics realtime was the third).
- **Create Challenge → full interface immediately**: creating a challenge no longer collapses back to a
  flat list - it auto-expands that challenge's card and smooth-scrolls to it, showing the leaderboard,
  milestones, and new day tracker right away. Reuses the existing accordion/detail-fetch mechanism, no
  new route.
- **Day-by-day tracker**: each challenge now shows every day from its start through today, with that
  day's P&L (derived from the participant's own linked trades via `periodBreakdown`, never stored
  redundantly) plus an optional note + one-tap mood ("disciplined"/"neutral"/"off-plan"). New
  `ChallengeDayNote` model (migration 29), any participant can log their own day - not creator-only, like
  milestones. New `PUT /api/journal/challenges/[id]/days` upserts one day at a time.
- **Risk section - discipline trend**: a new 30-day adherence-score line chart (`adherenceTrend()` in
  `risk.ts`) re-runs the existing breach-scan logic as-of each past day - entirely derived from already-
  fetched trades, zero new schema.
- **Risk section - suggested position size**: a small inline calculator (`suggestedPositionSize()`) gives
  the exact size that risks a chosen % of account equity given an entry and stop price, prefilled from
  the saved risk profile.
- **Files**: `prisma/schema.prisma`, `prisma/migrations/29_challenge_day_notes/`, `src/lib/challenge.ts`,
  `src/lib/risk.ts`, `src/lib/__tests__/{challenge,risk}.test.ts`,
  `src/app/api/journal/challenges/[id]/route.ts`, `src/app/api/journal/challenges/[id]/days/route.ts`,
  `src/components/journal/ChallengesPanel.tsx`, `src/components/journal/RiskPanel.tsx`,
  `src/components/journal/AdherenceTrendChart.tsx`.

## 2026-07-15 — Journal Analytics realtime + live blurred premium preview + weekly-drawdown fix
Third phase of the "Journal → best in class" build (Trades tab was the second phase).
- **Realtime**: trade create/edit/delete routes now broadcast a `journal_trade` event on the user's
  own realtime channel (`userChannel(userId)`, existing pattern from `ProfileFollow.tsx`/DM). `JournalClient`
  subscribes via `useRealtime` and refetches trades on any push (falls back to a 45s poll when Supabase
  realtime isn't configured), so Trades/Analytics/Risk all update live across tabs/devices without a
  reload. A small "Live" pill next to the Journal heading shows when realtime is active.
- **Deep-analytics live preview**: free-tier users now see their own real deep-analytics section (drawdown
  curve, activity heatmap, P&L breakdown, breakdown tables, mistake patterns) rendered blurred behind the
  premium gate, instead of a blank teaser card - a live, always-current "demo" of what premium unlocks
  (their own data, never another user's - same privacy boundary as before).
- **Fix**: `maxWeeklyDrawdownPct` was a configurable risk-profile field that was silently never checked.
  Added `weeklyPnl()` (`risk.ts`) and a `weekly-drawdown` breach check in `scanBreaches()`, with unit tests.
- **Files**: `src/lib/risk.ts`, `src/lib/__tests__/risk.test.ts`, `src/app/api/journal/trades/route.ts`,
  `src/app/api/journal/trades/[id]/route.ts`, `src/components/journal/JournalClient.tsx`,
  `src/components/journal/AnalyticsPanel.tsx`.

## 2026-07-15 — Journal Trades tab: $ sizing, weekly/monthly auto P&L, Open/Closed split
Second phase of the "Journal → best in class" build (first was the points-value share polish).
- **$ position sizing**: "Log a trade" and "Add fill" now take a dollar amount instead of raw asset
  units - converts to units via the entry price before saving (`size` is still what's stored, matching
  every downstream P&L formula), with a live "≈ X units" hint. The fills detail table now shows both a
  Size ($) and Size (units) column so nothing's lost.
- **Automatic weekly/monthly P&L**: two new stat tiles reuse `periodBreakdown()` (already built for
  Analytics) to show this week's and this month's realized P&L directly on the Trades tab, without
  switching tabs. Exported `periodKey()` from `journal-analytics.ts` so the client can find the *current*
  period's bucket specifically (not just the most recent one with activity).
- **Open positions / Closed trades split**: the flat trade list is now two clearly separated sections
  with distinct icons, instead of one undifferentiated list.
- **Day shown on every trade**: `formatDateWithDay()` (new `utils.ts` helper) shows "Mon, Jul 14" next to
  each trade row and each fill, sourced from the entry fill's actual execution date.

## 2026-07-14 — Points-value share: short links, download, image-inclusive native share
- **Short links**: new `SharedCard` model (migration 28, generic - room for more card kinds later) +
  `POST /api/tools/share/create` persists a calculator result behind a `cuid`, so the share link is now
  `/tools/share/points-value/<id>` instead of a long query string. Converted the existing query-string
  routes to `[id]`-based lookups (PNG route reads from the DB row; both degrade to a generic branded
  card/404 if the id is missing or expired - never crash).
- **Download**: new "Download" button fetches the PNG as a blob and triggers a browser download.
- **Image-inclusive share**: X's web share intent has no image-upload parameter - the OG-tag preview was
  already the closest available fit and stays as-is for "Post to X". Added a "Share" button using the
  native Web Share API with an actual image `File` attached (`navigator.share({ files: [...] })`) where
  supported (mobile Safari/Chrome) - this is the one path where the real image, not just a link preview,
  ends up in the shared post. Falls back silently where unsupported.
- First of a multi-phase "Journal → best in class" build (Trades/Analytics/Risk/Challenges overhaul +
  public profile Journal Activity section) - this share-card polish ships first as its own small PR.

## 2026-07-14 — Fix navbar's sitewide full-chat-fetch (Vercel Fast Origin Transfer)
- **Root cause found and fixed** (owner asked whether pausing Chat/DM would help reduce usage;
  investigated instead of guessing - the real waste was elsewhere and disabling messaging/GIFs would
  have helped ~0%, since GIF bytes are hotlinked from Giphy/Tenor and never touch Vercel, and live
  chat/DM delivery already runs over the Supabase realtime WebSocket, bypassing Vercel entirely).
- **`NavActivity.tsx`'s `loadChat()`** was fetching the full `/api/chat/messages` response (up to 50
  complete messages with author/reactions/polls) purely to read the last message's `createdAt` and
  flip a boolean "new activity" dot - on every 60s poll tick, on mount, and on every generic realtime
  ping, **sitewide, on every page, for every logged-in user** (`Navbar`/`NavActivity` render globally).
  The dedicated chat realtime channel already set the dot directly with zero fetch on live updates -
  only the poll/mount/ping paths were wasteful.
- **Fix**: new `GET /api/chat/last-activity` returns a single cached timestamp (`findFirst` selecting
  only `createdAt`) instead of the full message list; `loadChat()` now targets it. Same dot behavior,
  same instant-on-live-broadcast update, ~15-30KB down to a few bytes per poll tick, sitewide.
- No changes to Chat, DMs, or GIF sending - none of those were the actual cost driver.

## 2026-07-14 — Fix stuck desktop ticker + upgrade points-value share (real logos, X post, copy image)
- **"Live Market" ticker looked stuck on desktop**: `MarketTicker.tsx`'s scrolling track had
  `hover:[animation-play-state:paused]` - simply resting the mouse anywhere over the full-width strip
  froze the scroll indefinitely with no visual indication it was intentional. Touch devices don't sustain
  hover the same way, so mobile never showed it. Removed - the ticker now scrolls continuously, matching
  every other marquee/vscroll feed on the site (none of them pause on hover).
- **Points-value share card now has real logo images** (not text wordmarks): embeds our `/logo.png` and
  the platform's favicon-derived logo as actual `<img>` elements inside the `ImageResponse`, richer
  layout (hero value, share%/FDV/tokens chips).
- **New share landing page** `/tools/share/points-value` (`generateMetadata` sets `openGraph.images` to
  the card route, mirrors `news/read/page.tsx`'s pattern) - this is the URL that gets posted/copied, so
  the link itself shows the branded card image when pasted anywhere, not a bare link.
- **New `PointsShareActions`**: "Post to X" (reuses `ShareRow.tsx`'s intent-link pattern), "Copy link",
  and "Copy image" (new - `navigator.clipboard.write` with a `ClipboardItem`, feature-detected with a
  graceful fallback for browsers without image-clipboard support).

## 2026-07-14 — Points-value/journal share cards + Variational logo + scroll-jank fixes
- **Variational's real logo**: added `links.website` to its DEX registry entry + a new `platformLogo()`
  helper (`src/lib/dex-registry.ts`) that derives the domain and reuses the existing keyless
  `favicon()` service already used for news-source icons - no logo file downloaded or committed, works
  for any future registry entry with a `website` link. Shown next to each platform preset button in the
  Points Value calculator.
- **Two new share cards** (same `next/og` + `Cache-Control` recipe as the existing research/challenge
  cards, cached from day one): `GET /api/tools/share/points-value` (renders the calculator's current
  result from query params, no DB read) and `GET /api/journal/share/overview/[userId]` (renders a
  member's aggregate win rate/P&L/trade count only - never raw trade data, same privacy model as the
  challenge card). "Share card" / "Share my stats" buttons wired into the Points Value calculator and
  the Journal Analytics tab.
- **Scroll-jank fixes** (desktop + mobile): the sticky navbar's `backdrop-blur-xl` (24px) had no desktop
  reduction (only mobile got one) - a fixed element blurring everything behind it repaints every scroll
  frame site-wide, so trimmed to `backdrop-blur-lg`. Two scroll handlers were calling `setState`
  directly on every native scroll event with no throttling - the news reader's progress bar
  (`NewsClient.tsx`) and the community chat message list's stick-to-bottom check (`ChatClient.tsx`) -
  both now rAF-throttled, mirroring the pattern already used correctly in `ReadingProgress.tsx`.
- All additive/isolated changes; no existing behavior altered beyond the blur radius and throttling.

## 2026-07-14 — Cache news classification (Vercel Fluid Active CPU)
- **Root cause found and fixed**: Vercel's usage dashboard showed **Fluid Active CPU at 5h18m / 4h - already
  over the free-tier cap** (more urgent than the earlier Fast Origin Transfer warning). Traced it to
  `src/lib/news-fetch.ts`'s `getNewsPage()`: every distinct `category`/`q`/`page` combination requested from
  `/api/news`, `/news`, and `/news/read` was a cache miss that reran full classification (categorize +
  sentiment + impact + relatedTokens - roughly 49 regex tests per article) over every article from every RSS
  source, from scratch. With ~20 category tabs x search x pagination as separate cache keys, most requests
  never reused prior classification work - a very plausible explanation for both the CPU overage and the
  elevated ISR Writes (115K/200K, 57%).
- **Fix**: wrapped the fetch+classify step in `unstable_cache` (`next/cache`), decoupled from
  category/q/page - classification now runs at most once per `NEWS_REVALIDATE` (20s) window regardless of
  how many different views hit it; filtering/pagination (cheap array ops) still happens fresh per request.
  All three call sites (`getNewsPage`'s callers) share the same cached result.
- No behavior or visual change - same data, same freshness window, dramatically less redundant CPU work.

## 2026-07-14 — Cache share-card images (Vercel Fast Origin Transfer)
- **`research/[slug]/opengraph-image.tsx`** and **`api/journal/share/challenge/[id]/route.tsx`** had zero
  `Cache-Control` on the generated PNG - link-preview bots (WhatsApp/Telegram/Twitter/Discord) re-fetch
  these on every share, regenerating the image from scratch each time. Added `s-maxage=3600` (research
  cards - rarely change) and `s-maxage=300` (challenge cards - progress numbers move, shorter window),
  both with a generous `stale-while-revalidate`. Cuts origin-transfer usage from repeated bot fetches with
  no user-visible change.
- Audited every other public API route for caching (markets/ticker/news/research/whatsnew) - all already
  had solid `Cache-Control` headers from earlier work; this closes the one real gap found.

## 2026-07-14 — Mobile performance boost (round 2)
- **Bespoke 3D icon animations (`Icons3D.tsx`) now respect `prefers-reduced-motion`** - the `i3d-spin`/
  `i3d-bob`/`i3d-scan`/`i3d-pulse`/`i3d-tick`/`i3d-sweep`/`i3d-float`/`i3d-beat`/`i3d-twinkle`/`i3d-flick`
  keyframes were never added to the reduced-motion kill list in `globals.css`, so every icon across
  About/Products/Markets/News/Premium kept animating for users who'd opted into less motion.
- **`AnimatedIcon.tsx`'s continuous 3D wobble + breathing glow now pause off-screen** - uses framer-motion's
  `useInView` (200px margin) so tiles below the fold on About/Products stop looping instead of animating
  indefinitely once mounted.
- **News reader images decode off the main thread** (`decoding="async"` on the reader hero, swipe-reader
  hero, and the shared/external-link article image in `NewsClient.tsx`/`SharedArticle.tsx`) - avoids a
  decode-blocking jank spike on mobile when a large hero image lands.
- No existing visual behavior changed - reduced-motion users already saw calmer motion elsewhere; this
  closes a gap the icon system missed. Full-motion users see no difference.

## 2026-07-14 — Basic XP system (engagement foundation)
- **New `XpEvent` model + migration 27** (`prisma/migrations/27_xp_events`): one row per user per action per
  day, `@@unique([userId, action, day])` makes awarding idempotent (a repeat call the same day is a graceful
  no-op, not an error). Denormalized `User.xp` counter kept in sync inside a `$transaction`.
- **`src/lib/xp.ts`**: the 5 actions (`checkin`, `research_view`, `news_read`, `tool_use`,
  `profile_update`), each worth a flat 1 XP for now - deliberately simple, the foundation for a fuller
  gamified system later (levels/streaks/badges), not that system itself.
- **`POST /api/xp/award`** (zod-validated action, rate-limited, session-gated) + **`GET /api/xp`** (total XP
  + today's already-claimed actions, so the client can show claimed/disabled state without guessing).
- **`AwardXpOnView`**: a passive client component, fires the award once per mount - wired into
  `research/[slug]/page.tsx` (unlocked posts only), the news reader in `NewsClient.tsx`, and `ToolsClient.tsx`.
  `SettingsClient.tsx`'s profile save fires the award directly on success.
- **Daily check-in**: new `DailyCheckIn` button in the navbar account menu (desktop dropdown + mobile panel)
  - checks today's claimed state on mount, awards +1 XP on click, shows a claimed state after.
- Everything degrades gracefully pre-migration (`.catch(() => [])`/`.catch(() => null)`); no existing route,
  page, or component's behavior changed beyond these additive wire-ups.

## 2026-07-14 — Mobile: Profile in bottom nav + floating XYZ AI
- **Bottom nav center slot is now Profile** (Markets / News / **Profile** / Research / Chat) - shows your
  avatar when signed in (linking to `/u/<handle>` or `/profile`), a generic icon linking to login when
  signed out. Direct profile access on mobile without going through a menu.
- **XYZ AI is now a floating launcher on mobile too** (previously desktop-only; mobile used to route
  through the bottom nav's center button instead) - positioned just above the bottom nav bar so nothing
  overlaps. Verified via a real mobile-viewport screenshot.
- Visual-only change, verified with a headless mobile screenshot; no other existing pages/routes touched.

## 2026-07-14 — Tools: 3 new calculators + tab bar polish
- **3 new calculators** on `/tools`: **Break-Even** (exit price where round-trip fees cancel your P&L),
  **Compounding** (project capital growth from a fixed return per period, with daily/weekly/monthly
  presets), and **Drawdown Recovery** (the real gain needed to recover from a loss - a 50% drawdown needs
  a 100% gain, not 50%). All pure functions in `src/lib/calculators.ts`, unit-tested.
- **Tab bar polish** - now scrolls horizontally on mobile instead of wrapping awkwardly with 8 tabs, and
  remembers your last-used calculator across visits (localStorage, no account needed).

## 2026-07-14 — Trading OS Phase 6: Premium tiering + share cards
- **Analytics tab tiering** — the 8 core stat tiles (win rate, P&L, profit factor, etc.) stay free for
  everyone; the deep dashboard (drawdown curve, activity heatmap, daily/weekly/monthly breakdown,
  best/worst by setup/asset/platform/session, mistake patterns) is now **Premium**, replaced with a
  compact upgrade card (`PremiumGate`, same visual language as the existing research `PremiumLock`) for
  Free members.
- **Challenges tiering** — Free members can run **1 active challenge** at a time; creating a second
  surfaces a clear upgrade message (enforced server-side in `POST /api/journal/challenges`, mirrored
  client-side in the create form).
- **Shareable challenge cards** — a new public image route (`/api/journal/share/challenge/[id]`, `next/og`
  `ImageResponse`, same pattern as the existing research `opengraph-image.tsx`) renders a branded
  1200×630 card with the challenge's title, return %, and day count. Private challenges (and any lookup
  failure) always fall back to a generic, data-free card - no private numbers are ever exposed to an
  unauthenticated image fetch. A "Share card" button appears on public/community challenges.
- **`src/lib/journal-limits.ts`** (new) - the tier definitions, reusing the existing `membership` field
  (already gates AI limits and premium research) rather than a new entitlements system.
- Sixth phase of the Trading OS roadmap. Nothing else existing was touched.

## 2026-07-14 — Trading OS Phase 4: Challenges tab
- **`/journal`** gains a fourth tab, **Challenges**, alongside Trades, Analytics, and Risk.
- **Create a challenge** with a fully custom duration - 30/90/120-day presets plus arbitrary start/end
  dates - starting capital, an optional target, and visibility (**private**, **public**, or **community**).
  The "4-month challenge" is one preset among many, not a hardcoded mode.
- **Not just solo** - a community challenge has one creator plus many participants
  (`ChallengeParticipant`), each ranked on a **leaderboard by return %**. Public/community challenges are
  browsable under "Discover" with a one-tap Join.
- **Privacy-safe leaderboard**: other participants' raw trade data never leaves the server - only the
  aggregated capital/return/trade-count is returned (`src/lib/challenge.ts`, pure, unit-tested, computed
  server-side for the leaderboard and reused client-side for progress bars).
- **Milestones** - lightweight, manually-toggled checkpoints a challenge creator can add and check off.
- New **`Challenge`**, **`ChallengeParticipant`**, **`ChallengeMilestone`** models + idempotent migration
  (`prisma/migrations/26_challenges`, also adds `Trade.challengeId` so a trade can optionally count toward
  a challenge's progress). `GET`/`POST /api/journal/challenges`, `GET`/`PATCH`/`DELETE
  /api/journal/challenges/[id]`, `POST .../join`, and milestone create/toggle/delete routes - all reusing
  the existing `journal` rate-limit bucket.
- Fifth and final planned phase of the Trading OS roadmap (`/tools` → Journal core → Analytics → Risk →
  **Challenges**). Linking a trade to a challenge from the Trade form is a natural quick follow-up.
  Nothing else existing was touched.

## 2026-07-14 — Trading OS Phase 3: Risk Management tab
- **`/journal`** gains a third tab, **Risk**, alongside Trades and Analytics.
- Set optional limits (all skip if left blank): account equity, max risk per trade, max daily loss, max
  weekly drawdown, max total open risk, a leverage warning threshold, max trades/day, and a revenge-trade
  cooldown window.
- **Breach detection** (`src/lib/risk.ts`, pure, unit-tested) computed client-side from the trade list +
  limits: daily loss limit, overtrading, correlated exposure (multiple open positions on the same symbol),
  high-leverage open trades, revenge trades (opened shortly after a loss), and total open risk - each
  surfaced with a plain-language message and a **rule-adherence score** (100, minus points per breach).
- **Safe-mode banner** after 3+ consecutive losing trades - a nudge to size down or step back, not a hard
  block.
- **Planned risk per open trade** table, in both dollars and % of account equity, flagging any trade over
  the configured per-trade risk limit.
- **`RiskProfile`** model + idempotent migration (`prisma/migrations/25_risk_profiles`) - one optional row
  per user. `GET`/`PUT /api/journal/risk-profile`, reuses the existing `journal` rate-limit bucket.
- Fourth phase of the Trading OS roadmap (`/tools` → Journal core → Analytics → **Risk**). Next: Challenges.
  Nothing else existing was touched.

## 2026-07-14 — Trading OS Phase 2: Journal Analytics tab
- **`/journal`** now has a **Trades / Analytics** tab bar. Trades is the existing log; **Analytics** is new:
  gross P&L, profit factor, expectancy, average realized R (P&L expressed as a multiple of planned risk),
  max drawdown, average hold time, early-exit rate (closed before hitting take-profit), and a long-vs-short
  split - all derived from the same fetched trade list, no new endpoint.
- **Drawdown curve** + a **GitHub-style activity heatmap** (last 12 weeks, colored by daily realized P&L).
- **Daily/weekly/monthly P&L breakdown** table with a granularity toggle.
- **Best/worst breakdowns** by setup, asset, platform, and session, plus a **mistake-pattern** frequency
  view (from the tags already captured when logging a trade).
- **`src/lib/journal-analytics.ts`** (new, pure, unit-tested) - every metric above as its own function,
  reusable later by the Risk Management and Challenge phases.
- `EquityCurveChart` generalized (unique gradient IDs, configurable caption/empty state) so the drawdown
  chart reuses it instead of duplicating the SVG rendering.
- Third phase of the Trading OS roadmap. Next: Risk Management. Nothing else existing was touched.

## 2026-07-14 — Tools: Funding Fee Calculator platform picker + registry expansion
- **Funding Fee Calculator** now has a **perp DEX picker** (Hyperliquid, GMX, dYdX, Vertex Protocol, Aevo,
  Variational) so it's always clear whose funding rate a number represents. Hyperliquid stays live-prefilled
  (the only wired data feed today, via `/api/markets/perp`); every other platform gets a clearly labeled
  manual-entry banner with a link to its own docs.
- **`src/lib/dex-registry.ts`** — added GMX, dYdX, Vertex Protocol and Aevo alongside Hyperliquid and
  Variational, plus a `hasLiveFunding` flag marking which platforms auto-prefill vs. need manual entry.
  Adding the next platform is still just one object in the array - no code rewrite.

## 2026-07-14 — Trading OS Phase 1: Journal core (Trade/TradeFill/edit history)
- **New `/journal`** (private, login required) — log trades with multiple entries/partial exits
  (`Trade` + child `TradeFill` rows), long/short, spot/futures/perp/custom, planned stop-loss/take-profit,
  setup/session/timeframe/tags, notes, and platform tagging (reuses the Phase 0 DEX registry). Every P&L,
  average entry price, and open/closed status is **derived** from a trade's fills, never stored
  redundantly (`src/lib/journal.ts`, pure + unit-tested).
- **Edit history** — every `PATCH` writes an append-only `TradeRevision` row capturing what changed.
- **Stats + equity curve** — win rate, total P&L, total trades and average planned R computed client-side
  from the fetched trade list; a new hand-rolled SVG equity curve (signed, can go negative, unlike the
  dashboard's always-positive `TrendChart`).
- **`prisma/migrations/24_trades`** (idempotent) — `Trade`, `TradeFill`, `TradeRevision` tables. New
  `journal` rate-limit bucket (30/min). `/api/journal/trades` (list/create) + `/api/journal/trades/[id]`
  (edit/delete), ownership-checked, degrade gracefully pre-migration.
- Added a **Journal** entry to the account menu (desktop + mobile), next to Messages/Settings.
- Second phase of the Trading OS roadmap (started with Phase 0's `/tools`). Next: Analytics tab, then Risk
  Management, then Challenges. Nothing existing was changed beyond the one nav entry.

## 2026-07-14 — Trading OS Phase 0: /tools hub (calculators + DEX registry)
- **New `/tools` page** — free, no-login trading calculators: **Funding Fee** (live-prefilled hourly
  rate from `/api/markets/perp`), **Points/Airdrop Value** (including a **Variational** preset with its
  published scenario numbers - 1B supply, 9.4M points, 25/30/34% TGE unlock, $700M-$30B FDV scenarios,
  all clearly marked as editable assumptions, not live data), **Liquidation Price**, **Position Size &
  Risk:Reward**, and **PnL**.
- **`src/lib/dex-registry.ts`** (new) — a typed config array for perp DEX/platform info, mirroring the
  existing `NEWS_SOURCES` pattern: adding a new platform is adding one object, no schema change needed.
  Seeded with Variational and Hyperliquid.
- **`src/lib/calculators.ts`** (new, pure, unit-tested) — the math behind every calculator, reusable by
  the upcoming Trading Journal's analytics.
- **`Products.tsx`**'s "Trading Tools" card is now clickable (was a dead end since it first shipped) and
  its badge reads "Live."
- First phase of a larger **Trading OS** roadmap (journal, analytics, risk management, challenges) - see
  `docs/changelog.md` entries as each phase ships. Nothing existing was changed beyond the card wiring and
  one new "Tools" nav link.

## 2026-07-13 — Fix: mobile black-screen (service worker cache bump)
- **`public/sw.js`** — bumped `CACHE` (`xyz-pwa-v3` → `xyz-pwa-v4`). The `activate` handler already
  purges any cache key that doesn't match `CACHE` and calls `clients.claim()`, so this forces every
  device (installed PWA and regular mobile Chrome tabs alike, since the service worker controls all
  same-origin requests, not just installed sessions) to discard any stale/broken cached page or asset
  next time it checks for a worker update, instead of continuing to serve old cached content.
- Verified the production build renders correctly (desktop + mobile viewport) via a local prod server
  and headless-Chrome screenshots — the app code itself is healthy; this targets a stale-cache class of
  bug on already-visited devices.

## 2026-07-12 — DMs: search people + emoji/photo/GIF + online + push
- **Search people to DM** — a search bar in the Messages inbox (`GET /api/dm/search`, logged-in)
  finds any member by name/@username; tap a result to open/start the conversation.
- **Emoji · Photo · GIF in DMs** — the DM composer gained the emoji picker, a photo button
  (`POST /api/media/upload`, any member) and a GIF picker (Giphy, when `GIPHY_API_KEY` is set) —
  same as community chat. Media renders inline (shared `chatMediaUrl` in `lib/chat-media.ts`).
- **Online status** — a green dot on avatars in both the inbox list AND the thread header, driven
  by one shared `site-visitors` presence subscription (`useOnlineSet`). Inbox `other` now carries `id`.
- **External DM push** — a new DM fires a phone push to the recipient (fire-and-forget, gated on
  VAPID, dead endpoints pruned); opens the thread on tap.

## 2026-07-12 — Profiles: follower/following lists + colourful socials + fixes
- **Followers / Following are clickable** — tapping either count opens a modal with tabs
  (`FollowListModal`) listing the users, each with avatar + name + a per-row **Follow / Following
  / Unfollow** button. So you can open **Following** and unfollow anyone right there, or follow back
  from **Followers**. New `GET /api/follow/list?username=&type=`.
- **Share button icon fixed** — the compact share button showed an empty circle because the `btn`
  base padding squeezed the icon out; added `!p-0` + explicit colour so the link icon shows.
- **Social logos are now brand-coloured** — Website (gold), X (white), Telegram (sky), Discord
  (indigo), YouTube (red), Instagram (pink), LinkedIn (blue), GitHub (white), each on a matching
  tinted ring — colourful + instantly recognisable (were all grey).
- **Bigger bio/description** — the About/Bio field now allows **500** characters (was 280) so
  members can write a few lines about themselves (edit via the profile **Edit** button → Settings).

## 2026-07-12 — Profiles: Twitter-style follow system + compact header
- **Follow / Following / Unfollow** — new `Follow` model (migration `23_follows`, idempotent) +
  `POST/GET /api/follow` (toggle + counts, logged-in + rate-limited, resilient pre-migration).
  New `ProfileFollow.tsx`: follower/following counts + a follow button that reads **Follow**
  (green) → **Following** (grey) → **Unfollow** (red on hover/again), optimistic, self-hidden on
  your own profile, redirects to login when logged out. **Live** — counts update via the profile's
  realtime channel + a new-follow fires an in-app notification.
- **Edit from the profile** — owner-only **Edit** button in the header (→ /settings), no need to
  dig into Settings.
- **Smaller Share** — the Share button is now a compact icon-only round button (was a big pill).
- **Icon-only social logos** — Website/X/Telegram/YouTube/LinkedIn/Discord/Instagram/GitHub now
  show just the logo (tap to open; full handle in the tooltip) — far less space.
- **Owner step:** apply migration `23_follows` (SQL / `db:push`). Until then follow shows 0 and the
  button no-ops gracefully.

## 2026-07-12 — Voice/compose polish + short news share links
- **Voice bar is now a small pill** (`VoiceRoom.tsx`) instead of a full-width bar — takes almost
  no space when idle; expands only when you're in the call.
- **Mic actually turns on** — the mic permission is now requested **inside the click gesture**
  (before the token fetch / connect awaits), so iOS/Safari don't drop the grant. Denied → clean
  "listening only" state.
- **Smaller send button** (community composer) — icon-only on mobile, icon + "Send" on ≥sm — so the
  message box gets more room.
- **Short news share links** — sharing a story now copies a tiny `/news/read?u=<source-url>` link
  (was a huge `?d=<base64 of the whole story>`). The reader resolves `?u=` by looking the story up
  in the live feed for a rich preview (falls back to a minimal card). Easy to paste anywhere.
- **News push note:** external news notifications require the `push-dispatch` cron to be running —
  set repo secrets `PROD_URL` + `CRON_SECRET` (and `CRON_SECRET` in Vercel). Chat push works without
  it (fired inline); news push needs the scheduled trigger.

## 2026-07-11 — Community voice rooms (LiveKit, Telegram-style)
- **Live voice chat in the lounge** — a "Join voice chat" bar on `/community`; members join one
  shared audio room, talk + listen, see who's speaking (speaking rings + mute state), mute/leave.
  Audio-only, powered by **LiveKit**.
  - **New:** `POST /api/voice/token` (server, logged-in + rate-limited) mints a short-lived
    LiveKit token signed with the API key/secret (never exposed client-side).
  - **New:** `VoiceRoom.tsx` — connects via `livekit-client` (**dynamically imported**, off the
    first-paint bundle), turns the mic on, renders participants; mic-denied → listener mode.
  - `env`: `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` + `NEXT_PUBLIC_LIVEKIT_URL` + `voiceEnabled`
    flag (bar hidden until all set). CSP updated for `wss://*.livekit.cloud` + blob workers +
    mediastream. Deps: `livekit-server-sdk`, `livekit-client`.
- **Owner setup:** create a free LiveKit Cloud project → add the 3 env vars (see `docs/VOICE.md`).
  No database/migration needed.

## 2026-07-11 — Web3 News: customizable external notifications
- **External news push was already live** (cron → high-impact stories → subscribers). This adds
  **per-device customization** so members control what gets pushed to their phone:
  - **All big news** (default), **For You** (only their saved interests), **Pick topics** (only
    the categories they choose), or **Off** (stay subscribed, muted).
  - New pref UI: a "sliders" popover next to the News alerts bell (`NewsAlertsToggle` +
    `showPrefs`) — mode radios + a topic multiselect over the 28 news `CATEGORIES`. Saves instantly.
  - `PushSubscription` gains `notifyMode` + `notifyCategories` (migration `22_push_prefs`,
    idempotent; existing rows default to `"high"` = prior behavior). `POST /api/push/subscribe`
    stores the prefs; a new `GET` returns them so the popover preselects.
  - `GET /api/push/dispatch` now **filters recipients per story**: `high` → everyone, `categories`
    → story matches their topics, `foryou` → story matches their `newsInterests`, `off` → skipped.
    Resilient pre-migration (falls back to send-to-all).
- **Owner step:** apply migration `22_push_prefs` (`npm run db:push` or paste the SQL). Until then
  everyone keeps getting all high-impact alerts (no break).

## 2026-07-11 — Community + DM + Home polish pass (9 fixes)
1. **Send buttons say "Send"** — community chat + DM send buttons now show a white paper-plane
   **+ "Send" label** so it's obvious where to send.
2. **DM online status** — the DM thread header shows a green dot + "online" when the other
   person is active anywhere on the site (new `useUserOnline` hook observing the shared
   `site-visitors` presence channel; DM API now returns the other user's id). Graceful no-op
   without realtime env.
3. **Community white-theme colors** — the jump-to-latest button is now theme-aware (was a black
   blob on white, and now sits above content + is clickable); the poll/GIF/photo attach buttons
   get a clean light surface + visible icons.
4. **More emojis** — the emoji picker set is greatly expanded (smileys, gestures, hearts,
   crypto, animals) and scrolls. (GIF picker already added — it appears once `GIPHY_API_KEY` is set.)
5. **Jump-to-latest fixed** — visible + clickable in both themes (see #3).
6. **Translation direction fixed** — `/api/chat/translate` now reliably converts **English→Hinglish
   and Hinglish→English** (explicit language detection + a hard "output language must differ" rule
   + examples), instead of echoing the same language.
7. **Home orbital — light theme** — the ecosystem orbital reads premium on white now: toned aurora,
   opaque brand-gold/mint rings + planet dots (the invisible white planet is gold in light), real
   white node chips with elevation + stronger colored rings. All scoped to `#ecosystem-orbital`;
   dark theme pixel-identical.
8. **Community opens faster** — initial render trimmed to 30 messages (lighter nested-join payload;
   "Load older" pages the rest), on top of the existing parallel queries + skeleton.
9. **Sends feel instant** — the message-send route no longer waits on the Supabase broadcast
   round-trip (fire-and-forget, like push/moderation), so the 201 returns immediately; the
   optimistic bubble already shows the message instantly.

## 2026-07-11 — Community: photo (admin) + GIF (everyone) sharing
- **GIF sharing for everyone** — a **GIF** button in the composer opens a Giphy-backed picker
  (search + trending). Picking one sends it as an inline GIF message. New `GifPicker.tsx` +
  `GET /api/chat/gif` (proxies Giphy so the key stays server-side; logged-in + rate-limited).
  Gated on `GIPHY_API_KEY` — the button hides itself when unset.
- **Photo sharing for admins** — admins get a photo button (hidden for everyone else) that
  uploads via the existing admin `/api/upload` (client-compressed) and sends the image inline.
- **Inline media rendering** (`MessageBody`) — a message whose whole body is a **trusted** media
  URL renders as an image/GIF: GIFs from giphy/tenor (anyone) or images in **our** Supabase
  Storage / inline data images (admin uploads only). Arbitrary pasted image links stay plain
  links, so "photos" remain admin-only by construction. `doSend` gained an override path so
  media sends optimistically without touching the composer text.
- **Owner setup:** GIFs need a free `GIPHY_API_KEY` (developers.giphy.com) in Vercel; photo
  sharing needs Supabase Storage configured (the same pending storage setup) — both degrade
  gracefully (GIF button hidden / photo shows a clear "needs Storage" message) until set.

## 2026-07-11 — Community: aligned composer + message translation (English ⇄ Hinglish)
- **Composer aligned** (`ChatClient.tsx`) — the poll button, text field, emoji and send button
  now sit on one clean row at equal height (44px), with the error + character count moved to a
  tidy full-width line below (they used to be crammed inside the input column, throwing the
  buttons out of alignment). Send button uses the solid white `SendGlyph` for consistency.
- **Translate any message** — a new Translate action (Languages icon) in each message's action
  bar converts it **English ⇄ Hinglish** via AI (`/api/chat/translate`, logged-in + rate-limited,
  graceful 503 when AI is off). The translation shows in a mint quote block under the message;
  tapping again hides/re-shows it (cached, no repeat AI call). Mentions, $tickers, emojis and
  URLs are preserved.

## 2026-07-11 — Send icon fix + instant sends everywhere + light-theme + faster opens (2c+)
- **Send button always shows a clear icon** — the lucide `<Send/>` outline was rendering
  invisible on the green send buttons (looked like a plain green blob). Replaced with a new
  **`SendGlyph`** (a filled white paper-plane inline SVG, hard-set fill — can never be
  invisible) on the News-comment (`NewsSocial.tsx`) and DM (`MessagesClient.tsx`) buttons.
  Screenshot-verified on the mint gradient.
- **Comments/messages post instantly** — News comments (`NewsSocial.tsx`) now insert an
  optimistic entry the moment you send (temp id → swapped for the server copy; rolled back +
  text restored on failure), matching the community chat + DM optimistic sends. Send feels
  instant on both mobile + desktop.
- **Light-theme fixes** — DM bubbles now read correctly in light theme (own gold bubble text
  was near-white/invisible; now `text-gold-950` in light, `gold-50` in dark; incoming bubble
  gets a proper light surface + dark text). The community chat header is a solid theme-aware
  surface (fixes the grey-gradient smudge in white theme).
- **Community heading** — removed the redundant "THE XYZ LOUNGE" eyebrow (the room header
  already says XYZ Lounge) and replaced it with a useful **"Markets · Alpha · Airdrops — live"**
  topic line.
- **Profile + Dashboard open faster** — their generic branded spinners are now
  **layout-shaped skeletons** (`u/[username]/loading.tsx`, `dashboard/loading.tsx`) that
  preview the real layout instantly, so navigation feels immediate.

## 2026-07-11 — Chat/DM: instant send + solid header + faster community open (2c)
- **DM messages send instantly** (`MessagesClient.tsx`) — DMs now insert an optimistic
  bubble the moment you hit send (temp id → reconciled with the server copy / deduped vs the
  realtime echo; rolled back with the text restored on failure). Previously the bubble only
  appeared after the server round-trip. (Community chat already sent optimistically; its
  "pending" fade was softened `opacity-60 → 85` so a sent message reads as committed.)
- **"Online" / header no longer looks transparent** (`ChatClient.tsx`) — the header was made
  translucent (`ink-900/40` + blur) in 2a, so the presence/online strip looked see-through.
  Reverted to a solid `bg-ink-900` header; composer bar bumped to `bg-ink-900/95`.
- **Community opens instantly** — the route now ships a **chat-shaped skeleton**
  (`community/loading.tsx`) that mirrors the app frame (was a generic skeleton), and the two
  independent history queries (messages + pinned) run in **parallel** (`Promise.all`) instead
  of sequentially, so the server renders faster.

## 2026-07-11 — Community Chat: external push notifications (2b)
- **Phone push alerts for the lounge** — a new message now nudges subscribed members'
  devices (home-screen notification), reusing the existing Web Push / VAPID infra that
  powers News alerts (no new keys, no new subscription model).
  - **New:** `src/lib/chat-push.ts` → `dispatchChatPush(created)` — fire-and-forget from
    the send route (`api/chat/messages` POST). Gated on `pushEnabled`; never blocks the send.
  - **Anti-spam:** only pings when a message **breaks a quiet spell** (previous message >5 min
    ago), and uses a fixed notification `tag` so repeats collapse into one — so a busy room
    never spams phones, but a fresh burst of activity brings people back. Sender's own devices
    are excluded; dead endpoints are pruned (same as the news dispatcher).
  - Notification opens `/community` (service worker already routes on `data.url`).
- **Enable-alerts toggle in the chat header** — `NewsAlertsToggle` gained `compact` + `title`
  props and now sits (icon-only) in the chat header so members can turn phone alerts on/off
  right from the lounge. Existing News-page usage unchanged.
- **Owner note:** requires the VAPID env vars (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` /
  `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`) — the same ones News alerts already use. Degrades to
  a no-op when unset.

## 2026-07-11 — Community Chat: app-style fixed frame + premium color polish (2a)
- **App-like chat screen** (`community/page.tsx`) — the community page is now one fixed
  full-height frame (`h-[100svh]`, `overflow-hidden`): the page itself never scrolls, only
  the message list inside scrolls (WhatsApp/Telegram feel). Removed the page footer +
  the big heading (compact eyebrow only) so the chat fills the screen. Composer stays
  pinned at the bottom above the mobile keyboard.
- **ChatClient fills its parent** (`ChatClient.tsx`) — outer frame changed from a fixed
  `68vh` box to `h-full`, so the page controls height and the box is bigger / edge-to-edge.
- **Professional color polish** (colors stay gold/mint, just refined): richer header
  gradient + backdrop-blur, own-message rows get a cleaner mint tint + inset ring, composer
  bar gets a subtle ink surface + blur, and the input is a deeper rounded field with a mint
  focus ring. No behaviour change; presence/typing/reactions/polls untouched.

## 2026-07-11 — Breaking-hero swap arrows + clearer send-button icon
- **Breaking News hero** (`NewsClient.tsx` → `BreakingHero`) now has **left/right swap
  arrows** — tap ‹ / › to change the breaking story manually (auto-rotate + progress dots
  stay). Arrows are glass circles on the image edges, hidden when there's only one story.
- **Send-button icon now clearly visible** — the News-comment send button
  (`NewsSocial.tsx`) and the DM send button (`MessagesClient.tsx`) rendered as a plain
  green button because the dark `Send` glyph was low-contrast on the mint gradient. The
  icon is now **white** (`!text-white`) with a bolder stroke, so it unmistakably reads as
  "send message" (Telegram/WhatsApp-style). No color/layout change elsewhere.

## 2026-07-11 — Remove Dependabot (automated dependency PRs)
- **Deleted `.github/dependabot.yml`.** Dependabot's grouped weekly bumps kept
  proposing risky **major** upgrades (Tailwind 3→4, Next 14→16, React 18→19,
  Prisma 5→7, framer-motion 11→12, zod 3→4, …) that would break the UI/build, and
  each open PR also spun up a Vercel preview deploy (churn on the Hobby plan). Per
  the owner: no auto-update risk for now — dependencies get updated **manually**,
  deliberately, later.
- CodeQL static analysis + the `npm audit` visibility step (`security.yml`) stay —
  they only scan and report, they never open PRs. Owner may still enable
  **Dependabot *alerts*** in repo settings (notification-only; no PRs).
- Docs updated: `SENTINEL.md` (scanning section + owner setup), `security.yml`
  comments. The 5 open Dependabot PRs (#95–#99) were closed unmerged.

## 2026-07-11 — Fixes: send-message icon visible + direct banner upload
- **Send buttons now clearly show the send icon** — the composer Send button in News comments
  (`NewsSocial.tsx`) and the DM send button (`MessagesClient.tsx`) rendered as "just a green button" because
  the `.btn-primary::after` shine could sit over the icon. The `Send` (and loading) icon is now `relative
  z-10` (always above the shine) + slightly larger, so it reads clearly as "send message".
- **Direct profile banner upload** (`SettingsClient.tsx` + new `/api/profile/banner` route) — the cover image
  can now be uploaded straight from the device (like the profile photo), not only pasted as a link. Mirrors
  the avatar route + the zero-config `uploadImage` (Supabase Storage when configured, else inline data URL).
  The "paste a link" field stays as a fallback. Guards the settings-form save so a data-URL banner (already
  saved by the banner route) isn't re-sent through the stricter profile schema.
- Files: `src/components/NewsSocial.tsx`, `src/components/MessagesClient.tsx`, `src/components/SettingsClient.tsx`,
  `src/app/api/profile/banner/route.ts`, `docs/changelog.md`. Verified: tsc + lint + build green.

## 2026-07-11 — XYZ Sentinel: AI security & monitoring (detect + alert)
New layered security-monitoring system (owner asked for an "AI agent that watches security + reports"). Honest
scope: detect + alert only — no autonomous code changes. Alerts go to **email + Telegram**.
- **Proactive CI scanning** — `.github/workflows/security.yml` (CodeQL static analysis + `npm audit`) and
  `.github/dependabot.yml` (weekly dependency + Actions update PRs). Catches vulns/bad code before + after ship.
- **Live AI Watchdog** — `.github/workflows/watchdog.yml` (cron every 30 min) → `/api/watchdog`
  (`src/app/api/watchdog/route.ts`, secured by `CRON_SECRET`, same pattern as push-dispatch). It:
  - reads live signals (`src/lib/security-signals.ts`): locked accounts / brute-force, OTP attempt spikes,
    AI error-rate + daily cost spikes, sensitive admin actions, config health (rate-limiting live? Sentry on?).
    Every query is guarded so an un-migrated DB never breaks it.
  - scores a deterministic **severity** (pure `scoreSignals`, unit-tested) and asks the AI (`completeText`,
    system task) for a short plain-English analysis.
  - on a **new** warn/critical (deduped vs the previous run) alerts the owner via `notifyOwner`
    (`src/lib/notify-owner.ts` → email `sendEmail` + `src/lib/telegram.ts` `sendTelegram`).
  - records every run in the new `WatchdogRun` model (migration 21) for history.
- **Env**: `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` + `telegramEnabled`/`sentryConfigured` flags (`env.ts`).
- **Docs**: `docs/SENTINEL.md` (how it works + one-time owner setup: bot token, GitHub secret-scanning +
  Dependabot, `PROD_URL`/`CRON_SECRET`, migration 21, optional Sentry DSN). Added to the docs TOC.
- Files: `src/lib/{security-signals,telegram,notify-owner}.ts`, `src/lib/__tests__/security-signals.test.ts`,
  `src/app/api/watchdog/route.ts`, `src/lib/env.ts`, `prisma/schema.prisma` +
  `prisma/migrations/21_watchdog_runs`, `.github/workflows/{security,watchdog}.yml`, `.github/dependabot.yml`,
  `docs/SENTINEL.md`, `docs/SUMMARY.md`, `docs/changelog.md`. Verified: tsc + lint + test + build green.
  **⚠️ Owner:** apply migration 21 + set the Vercel/GitHub secrets (see `docs/SENTINEL.md`) to turn it on.

## 2026-07-11 — Fixes: mobile product-card anims + News light-theme text + upload (real fix)
Owner-reported, bundled with PR-9.
- **Ecosystem product-card mini-visuals animate on mobile again** — the earlier `.mini-viz` mobile
  animation-freeze (perf) also froze the Web3 Academy "course progress" bars, airdrop eligibility, etc.
  Removed the rule; those visuals now animate on phones too.
- **News "Breaking" hero card readable in light theme** — the card is always dark (image + black overlay),
  but its `text-white`/`text-zinc-*` were being remapped to dark in light mode → the headline/source were
  invisible. Marked those text colors `!important` (`NewsClient.tsx`) so they stay light on the dark card in
  both themes.
- **Direct image upload — the REAL fix** (`storage.ts`). Root cause: Supabase env is set (for DB + realtime),
  so `storageEnabled` was `true`, but the storage *bucket* upload 502'd — and the inline fallback only ran when
  storage was fully *disabled*. Now `uploadImage()` **falls back to an inline data URL on ANY Supabase upload
  failure** (bucket missing/not public/etc.), so direct upload (post covers + profile pics) always succeeds
  with zero setup. If Storage is properly configured it still uses the CDN URL.
- Files: `src/app/globals.css`, `src/components/NewsClient.tsx`, `src/lib/storage.ts`, `docs/changelog.md`.
  Verified: tsc + lint + test (236) + build green.

## 2026-07-11 — V2 PR-9: Audit report + team-setup guide (+ PDF) — final V2 deliverable
Documentation-only (no code change). Completes the V2 program.
- **`docs/AUDIT-2026-07-11.md`** — full website audit + handoff: tech stack (frontend/backend), architecture,
  security review, performance review, SEO status, honest ratings per area + **overall ≈ 8/10**, worth &
  build-cost estimate, "why one language / no Python", "can you hire an engineer" answer, pending owner ops,
  and a next-level roadmap.
- **`docs/TEAM-SETUP.md`** + **`docs/XYZ-Crypto-Team-Setup-Guide.pdf`** — how multiple members can work in
  parallel without breaking the live site: GitHub collaborators + branch protection + Vercel previews (already
  in place) + a free staging database. Includes daily workflow, roles, new-engineer onboarding checklist, and
  costs. Same content as a branded, print-ready PDF for sharing.
- Added all three to the docs TOC (`docs/SUMMARY.md`), alongside the existing `docs/SEO.md`.
- Files: `docs/AUDIT-2026-07-11.md`, `docs/TEAM-SETUP.md`, `docs/XYZ-Crypto-Team-Setup-Guide.pdf`,
  `docs/SUMMARY.md`, `docs/changelog.md`. No app code touched.

---

## 2026-07-11 — Light-theme polish + globe emoji + homepage feed polling
Owner-reported (light theme + emoji + a small home-perf trim).
- **Light theme "next level"** (`globals.css`). Root cause of the grey boxes: several dark background
  opacities weren't remapped for light mode, so e.g. the Markets tab bar (`bg-ink-950/50`) rendered as a
  muddy grey slab on the white page. Added the missing remaps (`bg-ink-950/50` + `/95`, `bg-ink-900/40..60`
  → light). Also upgraded the light `.surface`/`.glass` cards from flat white to **premium**: a whisper of
  top-down gradient, a soft lift shadow, a hairline warm border, and a gold-tinted hover glow. Verified with a
  headless light-theme render.
- **Globe emoji** (`Ecosystem.tsx`) — the "XYZ Verse." 🌐 was doing a full flat spin (looked odd); switched to
  the gentle `float` variant so it bobs softly instead.
- **Home-perf trim** — the two decorative homepage live feeds now poll less often (market 15s→30s, news
  30s→60s); the real ticker at the top still updates every 10s, so nothing user-visible slows down while
  background fetches drop.
- Files: `src/app/globals.css`, `src/components/Ecosystem.tsx`, `src/components/LiveMarketVisual.tsx`,
  `src/components/LiveNewsVisual.tsx`, `docs/changelog.md`. Verified: tsc + lint + build green.

---

## 2026-07-11 — Fixes: mobile ecosystem icons live + zero-config image upload
Owner-reported fixes (bundled with PR-8).
- **Homepage "The Ecosystem" icons were frozen on mobile → live again.** PR-7 had frozen the bespoke `.i3d-*`
  icon loops on phones; removed that rule so the Products/ecosystem icons animate on mobile again. (The
  heavier `.mini-viz` product-card mini-visuals stay frozen on mobile for scroll perf.)
- **Direct image upload now works with ZERO config** (posts + profile pictures). Root cause: uploads required
  Supabase Storage, so without it every direct upload returned 501 "not configured" and only the paste-a-link
  fallback worked. Now `uploadImage()` (`src/lib/storage.ts`) — used by both `/api/upload` (post covers) and
  `/api/profile/avatar` — stores the (client-compressed) image **inline as a data URL** when Storage isn't
  configured, capped at ~700 KB. Post covers now compress client-side too (`PostEditor.tsx`). next/image marks
  data-URL sources `unoptimized` (`Avatar`, `PostCard`, article page). The JWT is sanitised so a data-URL
  avatar never enters the session cookie (`auth.ts`) — it renders from the DB on the profile + in comments;
  the navbar just falls back to initials for inline avatars. For scale, configuring Supabase Storage (env +
  a public bucket) upgrades these to external URLs — see `docs/HANDOFF.md`.
- Files: `src/app/globals.css`, `src/lib/storage.ts`, `src/components/PostEditor.tsx`, `src/lib/auth.ts`,
  `src/components/Avatar.tsx`, `src/components/PostCard.tsx`, `src/app/research/[slug]/page.tsx`,
  `src/app/api/profile/avatar/route.ts`, `docs/changelog.md`. Verified: tsc + lint + test (236) + build green.

---

## 2026-07-11 — V2 PR-8: SEO — canonical + OG/Twitter on index pages, sitemap, breadcrumbs
- **`/markets`, `/news`, `/research` now carry full per-page metadata** — a shared `pageSeo()` helper
  (`src/lib/seo.ts`) adds `alternates.canonical` + page-specific `openGraph` + `twitter` to each (they only
  had title + description before). Article + profile pages already did this.
- **Breadcrumb JSON-LD** on `/markets`, `/news`, `/research` (`breadcrumbJsonLd`) — Home › Section. (Site-wide
  `Organization` + `WebSite` JSON-LD already emit from the layout; articles already have `BlogPosting` +
  breadcrumbs.)
- **Sitemap** — added `/markets` + `/news` (hourly, priority 0.8) to `src/app/sitemap.ts`.
- **Owner-steps doc** — new `docs/SEO.md` documents what code can't do: set `NEXT_PUBLIC_SITE_URL` (real
  domain), `NEXT_PUBLIC_GSC_VERIFICATION` (Search Console tag → layout emits the meta), submit
  `/sitemap.xml` in GSC, optional `NEXT_PUBLIC_GA_ID` + a 1200×630 OG image.
- Files: `src/lib/seo.ts`, `src/app/markets/page.tsx`, `src/app/news/page.tsx`, `src/app/research/page.tsx`,
  `src/app/sitemap.ts`, `docs/SEO.md`, `docs/changelog.md`. Verified: tsc + lint + test (236) + build green.

---

## 2026-07-11 — V2 PR-7: Mobile perf (icon-loop freeze) + profile-URL handle bug fix
Note: most of the originally-planned PR-7 perf wins were already shipped in earlier passes (lazy XyzAiWidget +
SmoothScroll, mobile blur cuts, reduced-motion gating of ambient FX, `optimizePackageImports`/`removeConsole`,
three.js off the homepage). This PR adds the remaining safe wins + a real bug fix.
- **Mobile: freeze the bespoke `.i3d-*` icon loops** (`globals.css`, `@media max-width:768px`). The 3D icons
  each loop a transform/opacity animation and appear many times per screen; on phones we stop the *loop* for
  smoother scroll + battery. The icons keep their glossy 3D gradient/shadow (they just don't move), and
  hover/entrance still work. **Desktop is untouched** — including reduced-motion users, who explicitly asked
  to keep these alive. (Same tradeoff already applied to `.mini-viz` product visuals.)
- **Bug fix — pasting a full profile URL saved the wrong handle** (`profile.ts` `normalizeHandle`). It took the
  *first* path segment, so `linkedin.com/in/john-doe` became `in` and `youtube.com/@name` kept the `@`. Now it
  drops query/hash then takes the *last* path segment: `/in/john-doe → john-doe`, `/@name → name`, while the
  simple cases (`x.com/foo`, `github.com/bar`, `t.me/baz`) and bare `bar/extra → bar` still hold. +3 unit tests
  (236 total).
- Files: `src/app/globals.css`, `src/lib/profile.ts`, `src/lib/__tests__/profile.test.ts`, `docs/changelog.md`.
  Verified: tsc + lint + test (236) + build green.

---

## 2026-07-11 — V2 PR-6b: Profile social links (Discord / YouTube / LinkedIn / Instagram)
Adds four more social links to public profiles + settings. Colors unchanged. **Needs a migration (below).**
- **Schema + migration** — `User` gains 4 nullable columns `discord` / `youtube` / `linkedin` / `instagram`
  (`prisma/schema.prisma`) with idempotent migration `prisma/migrations/20_profile_socials` (`ADD COLUMN IF
  NOT EXISTS`). All nullable → existing rows unaffected.
- **Graceful pre-migration** — the profile + settings pages read these columns through a new guarded helper
  `fetchExtraSocials` (`src/lib/user-socials.ts`); on an un-migrated DB it returns nulls instead of throwing,
  so profiles/settings never 404. Saving a value before the migration returns the standard graceful 503; name
  edits keep working (empty socials aren't written).
- **Validation** — added `discord`/`youtube`/`linkedin`/`instagram` to the profile zod schema (`profile.ts`)
  as normalized handle fields; the handle charset now also allows `-` (GitHub/YouTube/LinkedIn slugs).
- **Settings UI** — four new inputs in the Social links section with prefixes (`discord.gg/`, `youtube.com/@`,
  `linkedin.com/in/`, `instagram.com/`) (`SettingsClient.tsx`).
- **Public render** — the profile pills now include the four new links with brand icons
  (`u/[username]/page.tsx`); new `DiscordIcon` + `InstagramIcon` added to `BrandIcons.tsx` (YouTube/LinkedIn
  already existed), both screenshot-verified.
- Files: `schema.prisma`, `migrations/20_profile_socials/migration.sql`, `profile.ts`, `user-socials.ts`
  (new), `BrandIcons.tsx`, `SettingsClient.tsx`, `settings/page.tsx`, `u/[username]/page.tsx`,
  `docs/changelog.md`. Verified: tsc + lint + test (235) + build green.
- **⚠️ Owner action:** apply migration 20 (`npm run db:push` with real `DATABASE_URL`/`DIRECT_URL`, or paste
  `prisma/migrations/20_profile_socials/migration.sql` into the Supabase SQL editor). Links stay hidden until
  then.
- **Profile interactivity/polish** (same PR): social pills now hover to each platform's brand colour and
  lift slightly; the stat cards gained pointer 3D tilt (`TiltCard`) + a soft gold glow on hover; recent-
  activity cards lift with a gold left-accent on hover. All reduced-motion / touch safe, colors unchanged.

---

## 2026-07-11 — V2 PR-6a: News TTS silence fix + mobile navbar spacing
No-migration fixes; colors unchanged.
- **News "Listen" (TTS) silence on mobile fixed** (`BriefingBlock.tsx`) — the old code always ran
  `speechSynthesis.cancel()` immediately before `speak()`; on mobile Safari/Chrome `cancel()` flushes
  asynchronously and drops the following `speak()`, so nothing played. Now it only clears the queue when
  something is actually `pending`/`paused`, keeps `speak()` inside the tap gesture (iOS requirement), and
  calls `resume()` right after (iOS sometimes starts the queue paused). Toggle-off also checks
  `synth.speaking`.
- **Navbar crowding at the md→lg band** (`Navbar.tsx`) — desktop nav links were `px-3.5` from 768px up, which
  crowds when a phone forces "Desktop site" (~768-1000px). Now `px-2.5` at md, widening to `px-3.5` at lg;
  the hover/active underline inset tracks the same (`inset-x-2.5 lg:inset-x-3.5`). Roomy desktop look intact.
- **Desktop profile name was hidden over the banner — fixed** (`u/[username]/page.tsx`). The avatar+name row
  was pulled up (`-mt-14`) so the large name rendered on top of the banner art (invisible over the bright
  logo). Now **only the avatar** overlaps the banner; the name + handle sit in the content area below it
  (`items-start`, avatar gets the negative margin), so the name is always readable. Verified with a headless
  render.
- **Mobile light-theme navbar was black — fixed** (`globals.css`). The mobile `.nav-shell` perf override
  forced a dark `rgba(10,10,15,.92)` background in BOTH themes. Made it theme-aware: `.dark` keeps the dark
  bar, `html:not(.dark)` gets a white `rgba(255,255,255,.92)` bar (matching the desktop light navbar).
- Files: `BriefingBlock.tsx`, `Navbar.tsx`, `u/[username]/page.tsx`, `globals.css`, `docs/changelog.md`.
  Verified: tsc + lint + test (235) + build green. (Profile social links + migration land next in PR-6b.)

---

## 2026-07-11 — V2 PR-5: Section headings live + community depth
- **Every remaining homepage section accent now animates** — swapped the static `.text-gold-gradient` for
  the moving `.text-shine` on: `Web3 research.` (ResearchPreview), `XYZ Crypto` (WhatsNew), `XYZ Verse.`
  (Ecosystem), `community.` (Social), `XYZ Crypto` (Faq). The whole homepage now reads consistently "alive"
  (Hero / Orbital / About / Products already shine).
- **Community (Social) section → next-level** — added an ambient gold `glow-orb` behind the heading for depth
  and wrapped the 4 social cards in `<TiltCard>` (pointer 3D tilt, mouse-only, reduced-motion/touch safe),
  matching the site's interactive-card language.
- Colors unchanged (gold + mint). Files: `ResearchPreview.tsx`, `WhatsNew.tsx`, `Ecosystem.tsx`, `Social.tsx`,
  `Faq.tsx`, `docs/changelog.md`. Verified: tsc + lint + test (235) + build green.

---

## 2026-07-10 — V2 PR-4 refinements #2 (owner feedback): scroll fix + fit + market icon + mobile perf
- **Auto-scroll now actually runs.** `.vscroll` was in the `prefers-reduced-motion` kill list, so on any
  machine with "reduce motion" ON the feeds sat still. Removed it from that list → market/news feeds always
  scroll. Added a `.vscroll-down` variant (news rains down from the top).
- **Web3 Market icon → new `CandlesIcon`** (green/red rising candlesticks) — reads as a market chart far more
  than the coin. Screenshot-verified. (Kept `CoinIcon` in the library for reuse.)
- **Live Market feed refit** (`LiveMarketVisual.tsx`) — fixed-height rows with hairline dividers, tabular
  numbers, a solid (no backdrop-blur) header; sits cleanly inside the card and scrolls smoothly.
- **Live News feed** (`LiveNewsVisual.tsx`) — now scrolls **downward**; headline rows + the pinned "Breaking"
  bar refit to exact heights; solid bar (no backdrop-filter).
- **Gamified visual redesigned** (`ProductVisuals.tsx`) — compact level badge + XP bar on one row, then a row
  of quest chips that light up in sequence; fits the box and reads more interactive.
- **Mobile scroll perf**: the small product-card mini-visuals (`.mini-viz`) now **freeze their continuous
  animations on phones** (`@media max-width:768px`) — dozens of simultaneous bar/sheen/orbit loops were the
  main Products-grid jank source. The two LIVE feeds keep scrolling (cheap transform), icons keep their motion.
  Also dropped `backdrop-filter` from the live-feed headers (repaint cost on scroll). Added `will-change:
  transform` to the vertical tracks so they stay on the compositor.
- Files: `Icons3D.tsx`, `Products.tsx`, `ProductVisuals.tsx`, `LiveMarketVisual.tsx`, `LiveNewsVisual.tsx`,
  `globals.css`, `docs/changelog.md`. Verified: tsc + lint + test (235) + build green; layouts + new icon
  screenshot-checked.

## 2026-07-10 — V2 PR-4 refinements (owner feedback): real live feeds + better icons
Follow-up on the same PR; colors unchanged.
- **Web3 Market icon → new `CoinIcon`** (`Icons3D.tsx`) — a glossy gold Web3 token (hexagon emblem + light
  sweep), much more "Web3" than the old trend arrow. Screenshot-verified.
- **Web3 Market visual is now genuinely realtime** (`LiveMarketVisual.tsx`) — pulls live prices from the
  cached `/api/ticker` proxy (refreshes every 15s while visible) and shows **more coins** (BTC/ETH/SOL/SUI/
  HYPE/BNB/XRP/DOGE/AVAX/LINK) that **auto-scroll slowly upward** in a seamless vertical loop. The old
  hardcoded/wrong prices are gone.
- **Web3 News visual is now live** (`LiveNewsVisual.tsx`) — real headlines from `/api/news` (30s refresh),
  **auto-scrolling bottom-to-top**, with the newest story pinned along the bottom as a live **"Breaking"**
  showcase (pulsing red dot).
- **AI Hub icon → our `RobotIcon`** (the XYZ mascot) instead of the generic activity glyph.
- **Gamified icon → new `GamepadIcon`** (`Icons3D.tsx`) — a violet game controller (d-pad + flickering
  action buttons), so the icon matches the product. Screenshot-verified.
- New CSS: `.vscroll` vertical-marquee utility + `.vscroll-mask` fade (globals.css), added to the
  reduced-motion kill list (scroll pauses for reduce-motion users). Both feeds are visibility-gated (no
  fetch/animation cost while the tab is hidden).
- Files: `src/components/Icons3D.tsx`, `src/components/Products.tsx`, `src/components/ProductVisuals.tsx`
  (dropped the static Market/News visuals), new `LiveMarketVisual.tsx` + `LiveNewsVisual.tsx`,
  `src/app/globals.css`, `docs/changelog.md`. Verified: tsc + lint + test (235) + build green.

## 2026-07-10 — V2 PR-4: Products / "The Ecosystem" next-level (bigger suite + live links)
Expanded the homepage Products grid and made the live products clickable; colors unchanged (gold + mint).
- **`power your edge.` accent now alive** — static `.text-gold-gradient` → the moving `.text-shine`.
- **Perp DEX status → "In Research"** (`Products.tsx`) — extended the `Status` union + `tone` map (mapped to
  the existing `violet` badge tone). Was "Coming Soon".
- **4 new products** (`Products.tsx` + new `*Visual`s in `ProductVisuals.tsx`), each with a live CSS mini-visual:
  - **Web3 Market** (Live → `/markets`) — `MarketVisual`: realtime BTC/ETH/SOL rows with pulsing green/red deltas.
  - **Web3 News** (Live → `/news`) — `NewsVisual`: a "Breaking" feed with a headline scan sweep.
  - **AI Hub** (Planned) — `AiVisual`: a violet "thinking" waveform + typing dots.
  - **Gamified** (Coming Soon) — `GamifiedVisual`: XP progress bar + orbiting level badge + next-reward line.
- **Live cards are clickable** — added an optional `href` to product items; the card renders as a `<Link>`
  (with an `ArrowUpRight` hint that animates on hover) when set. Web3 Market → `/markets`, Web3 News →
  `/news`, Web3 Academy → `/research`.
- **Larger grid** — the small-product grid now holds 8 cards (2 rows of 4 on desktop); **"& More" moved to
  last**. Reused all existing keyframes (bar-pulse / sheen / grow-x / badge-orbit / pulse-dot) so no new CSS.
- Files: `src/components/Products.tsx`, `src/components/ProductVisuals.tsx`, `docs/changelog.md`. Verified:
  tsc + lint + test (235) + build green.

---

## 2026-07-10 — Scroll performance: content-visibility on sections + lighter sticky-nav blur (mobile)
Focused on making homepage SCROLL smooth, especially on mobile.
- **`content-visibility: auto` on every homepage section** (`Section` primitive + Hero, both already
  `overflow-hidden` so no new clipping) via `.sect-cv` with `contain-intrinsic-size: auto 720px`. Off-screen
  sections skip layout/paint while scrolling → big jank reduction; `auto` remembers real height so no scroll
  jump. Ignored by browsers without support (safe).
- **Sticky-nav backdrop-blur cut on mobile** — the navbar (when scrolled) + the mobile bottom nav are sticky
  and their `backdrop-blur` repaints every scroll frame (classic mobile jank). On phones they now use
  `blur(8px)` + a more opaque bg via `.nav-shell`, so scrolling stays smooth.

---

## 2026-07-10 — Starfield: nicer stars + light-theme/mobile meteor rules + high-end mobile perf
- **Light theme → no shooting stars** (`globals.css`): they read as odd streaks on a bright sky; hidden.
- **Mobile → only ~3 shooting stars** (down from more); desktop keeps 12. Light theme (any size) = 0.
- **Nicer stars** (`Starfield.tsx`): more glowing "hero" stars (i%7) with a stronger halo, a touch more density
  (100 → 110) — a fuller, more premium sky.
- **High-end mobile perf**: only the bright + drift stars ANIMATE now; the rest are static dots — far fewer
  running animations for the same density. Mobile paints ~42 stars (was 55). The orbital's blurred aurora
  drops to `blur(14px)` on phones. (On top of: three.js off, planets removed, reduced particles/blurs.)

---

## 2026-07-10 — Orbital: remove Saturn/Moon/robot; trim mobile meteors; overall perf boost
- **Removed the Saturn + Moon + XYZ-robot bodies** (per owner) — `OrbitalBackdrop` now renders just the
  ambient starfield. This also drops all their continuous animations (spinning ring, moon/robot bob, band
  drift) from the render → a real paint win.
- **Fewer shooting stars on mobile**: extras (index ≥ 5) are hidden under 768px, so phones show ~5 meteors,
  desktop 12.
- **Perf boost (mobile + desktop)**: CSS starfield 120 → 100 stars (mobile now ~55 via a lower `-extra`
  threshold); the CSS orbital particle field 34/14 → 22/8 (desktop/mobile). Combined with three.js no longer
  loading, reduced background blurs, package-import tree-shaking, lazy widgets, and visibility-gated timers,
  the homepage is noticeably lighter.

---

## 2026-07-10 — Orbital: moon + Saturn into the side gutters; more desktop shooting stars
- Per the owner's marks, moved the moon into the left gutter (`left 3% → 13%`) and nudged Saturn (`77% → 76%`)
  so both sit balanced in the side gutters, clear of the text.
- Bumped shooting stars 8 → 12 spread across the visible area (incl. the upper-centre) with staggered delays,
  so meteors are clearly present on the wide desktop (they were already un-gated from reduced-motion).

---

## 2026-07-10 — Orbital: ring spin + shooting stars now run under reduced-motion; Saturn clear of text
- Root cause of "ring static + shooting stars not showing": both were gated off under
  `prefers-reduced-motion` (which the viewer likely has enabled). Removed `.saturn-ring` + `.star-shooter`
  from the reduced-motion kill-list so the ring keeps spinning and meteors keep streaking regardless of the
  OS animation setting (they're subtle, GPU-cheap decorative motion).
- **Saturn repositioned** to the upper-right GUTTER, below the heading + subtitle (`top: 12% → 30%`,
  `left: 68% → 77%`), so it no longer overlaps the text.

---

## 2026-07-10 — Orbital: realistic moon + obvious ring spin + more shooting stars + more perf
- **Realistic moon** (`globals.css`): removed the artificial glow halo; the crescent now has a SOFT terminator
  (gradient mask so the dark limb fades naturally) + a bright sunlit rim + body shading that darkens toward
  the terminator. Reads like a real crescent, not a blob. Screenshot-verified.
- **Ring spin now obvious** (`globals.css`): the conic ring is high-contrast (bright arcs + near-dark gaps)
  and spins faster (9s), so the rotation is clearly visible instead of looking static.
- **Saturn repositioned** — pulled in from the right edge + a touch larger so it's fully framed in the corner.
- **More shooting stars** (`Starfield.tsx` + `globals.css`): 5 → 8 meteors, shorter cycles (more frequent),
  and brighter/longer streaks with a warm-gold tail + glow.
- **More performance**: desktop background blurs cut (`.mesh` 130→96px, `.aurora` 88→62px) and the CSS
  starfield trimmed to 120 stars — cheaper paint with no visible change.

---

## 2026-07-10 — Orbital polish (spinning ring + moonlight) + perf boost + realtime WS fix
- **Saturn ring spins** (`globals.css`): the ring is now a conic-gradient (angular brightness) masked into two
  elliptical bands with a Cassini gap; a transform-only `ring-orbit` rotation makes the bright arcs visibly
  travel around = a live spinning ring (compositor-cheap, reduced-motion-gated). Screenshot-verified.
- **Moonlight** (`globals.css`): the crescent gets a soft blue-white glow halo + a brighter lit rim, so it
  reads as genuinely lit.
- **Performance**: WebGL disabled means **three.js is no longer downloaded on desktop** (previously fetched
  when the gate picked the 3D scene) and there's no WebGL render loop — a real desktop win. CSS starfield
  trimmed 180 → 120 stars. (On top of the earlier perf pass: package-import tree-shaking, lazy widgets,
  mobile blur cuts, visibility-gated timers.)
- **Realtime WS console spam fixed** (`env.ts` + `RealtimeSession.tsx`): `NEXT_PUBLIC_SUPABASE_URL` /
  `SUPABASE_URL` are now sanitized to the base project URL (strip a stray trailing `/rest/v1` that made the
  realtime WebSocket URL malformed → infinite failed retries). Also added a reconnect back-off so a failed
  realtime WS can't hammer the console.

---

## 2026-07-10 — Orbital: switch centerpiece to the reliable CSS version (Saturn + crescent moon + XYZ robot)
The WebGL scene rendered blank on the owner's desktop and could not be verified in CI (all local servers get
killed in the sandbox), so after many rounds it's **temporarily disabled** in favour of a guaranteed-render
CSS/SVG version that is screenshot-verified.
- **`useWebglGate` → always false** — OrbitalLazy always renders the CSS `OrbitalEcosystem`; the three.js code
  stays in the repo for a future verified pass.
- **Realistic gold Saturn** (`globals.css .saturn-body`): layered banded gold gradient (latitudinal cloud
  bands + pole shading + specular highlight) + the existing Cassini-gap ring. Screenshot-verified.
- **Crescent moon + XYZ robot** (`globals.css` + `Starfield.tsx`): `.moon-body` is now masked into a real
  crescent (offset-circle CSS mask) with craters on the lit face; the actual `RobotIcon` SVG sits in the
  crescent's curve (`.moon-robot`, gentle bob). Screenshot-verified.
- Bodies render on **desktop (≥900px)** only (via `OrbitalBackdrop`); phones/tablets keep the clean orbital
  with no planets. This finally makes the changes reliably visible on desktop.

---

## 2026-07-10 — Orbital: rebuild the crescent moon from proven primitives (likely crash fix) + SW cache bump
- The extruded-`Shape` crescent was the one un-proven primitive added in the previous commit and the prime
  suspect for the desktop "blank / no changes" report. Rebuilt `Moon.tsx` from **only the primitives that
  already rendered** in the earlier scene: a sphere + a terminator shader (which produces the CRESCENT look
  via lighting) + the XYZ robot as a camera-facing **sprite** (dropped `ExtrudeGeometry` + drei `Billboard`).
  Same cratered rock, robot mascot, and warm core-lit edge — far lower crash risk. Realistic gold Saturn kept.
- **Service worker cache bump** `xyz-pwa-v2 → v3` (`public/sw.js`): forces returning/PWA users' old cache to
  be cleared on next load, so updates actually reach installed/returning sessions.

---

## 2026-07-10 — Orbital: crash-proof the WebGL scene (never blank) + harden the robot texture
- **Error boundary** (`OrbitalLazy.tsx`): the WebGL scene is now wrapped so that if it ever throws at runtime
  (shader/driver/geometry issue on some device), it falls back to the CSS orbital instead of blanking the
  section. This is the safety net for the desktop "changes not showing / blank" report.
- **`robotFaceTexture()` hardened** (`textures.ts`): `ctx.roundRect` is feature-detected with a manual
  `arcTo` fallback, so texture creation can never throw on older canvas engines.
- Note: the sandbox couldn't run a live WebGL capture (server processes get killed), so the 3D composition
  is verified on the Vercel deploy; the 2D textures (Saturn body/ring, robot face, crescent) were all
  screenshot-verified. Open the preview in a fresh/incognito window to bypass the PWA service worker + cache.

---

## 2026-07-10 — Orbital (desktop): realistic gold Saturn + crescent moon with the XYZ robot
Desktop WebGL only (mobile has no planets). Per owner refs, keeping the brand gold + the robot's mint identity.
- **Realistic gold Saturn** (`textures.ts`): rewrote `saturnBodyTexture()` as a proper gas-giant in the GOLD
  ramp — darkened poles, many turbulent latitudinal bands (multi-octave sine field), wavy swirl streaks, and
  soft storm ovals (1024×512, anisotropy 8). Enriched `saturnRingTexture()` with a second (inner) division +
  an inner→outer warm/brightness shift. Screenshot-verified (2D).
- **Crescent moon + XYZ robot mascot** (`Moon.tsx`): the moon is now a real 3D **crescent** — `THREE.Shape`
  (big circle minus an offset circle) → `extrudeGeometry` with bevel → cratered grey rock material (reused
  `moonTextures()`). The **XYZ robot** sits in its curve as a camera-facing billboard: new `robotFaceTexture()`
  redraws the `RobotIcon` face (mint head + gloss + eyes + antenna) onto a canvas, mapped on a plane inside a
  drei `<Billboard>`, with a mint glow + gentle bob. Dropped the old sphere + night-terminator shader.
- Both keep desktop parallax/entrance; colours unchanged (gold Saturn, mint robot). tsc + build green.

---

## 2026-07-10 — Orbital (mobile): remove Saturn/Moon on phones/tablets (clean orbital + stars)
- Per owner: on mobile/tablet the orbital now shows just the ecosystem + starfield (no CSS Saturn/Moon).
  `OrbitalBackdrop` renders the CSS bodies only on desktop-light (WebGL desktop draws its own; mobile has
  none). Desktop 3D unchanged. (Realistic Saturn + crescent-moon-with-robot-face are a follow-up.)

---

## 2026-07-10 — Orbital (mobile): move CSS Saturn/Moon into the side gutters, out of the text
- On phones/tablets (which render the CSS orbital) the Saturn/Moon sat over the heading + subtitle. Moved
  their placement out of inline styles into responsive CSS (`globals.css` `.starfield .saturn/.moon`): on
  mobile they now sit LOW in the left/right gutters beside the orbital (clear of all text) and are smaller
  (Saturn pulled in so its ring no longer clips the right edge); wide light-theme desktop nudges them back up.
  Screenshot-verified at 400px. Colours unchanged.

---

## 2026-07-10 — Orbital: WebGL scene is desktop-only; phones/tablets get the polished CSS cosmos
- The cinematic WebGL orbital is composed for the large desktop square; on small screens the same world read
  cramped with oversized stars. `useWebglGate` now also requires `min-width: 1024px`, so **phones + tablets
  render the polished CSS orbital** (Saturn top-right + Moon left + starfield, `clamp()`-sized — the look
  approved earlier) while **desktop keeps the full 3D scene**. Cleaner on mobile and lighter (no three.js /
  render loop on phones). Re-evaluates on resize. No new files; one-line gate condition.

---

## 2026-07-10 — Performance pass (mobile + desktop): lighter paint, leaner JS, fewer background timers
Focus was making the site *feel* fast/light, especially on mobile. The heavy libs (three.js, PerpChart,
Supabase, anime.js) were already lazy, so the meaningful wins are runtime paint + background work.
- **Mobile paint** (`globals.css`): the full-screen Gaussian-blur background layers are the biggest phone
  cost. Under `@media (max-width:768px)` the `.mesh` blur drops 130px→55px, `.aurora` 88px→45px, `.glow-orb`
  90px→45px, and the 3 blurred `.starfield-neb` layers are hidden. Visually identical at phone size, much
  cheaper to composite.
- **Reduced-motion** (`globals.css`): the auto-scrolling `.marquee` ticker + the continuous `.text-shine` /
  button-shine / eyebrow sweeps now stop under `prefers-reduced-motion` (accessibility + battery + paint).
- **Leaner JS**: `next.config.mjs` adds `experimental.optimizePackageImports` (lucide-react / iconsax-react /
  framer-motion barrel tree-shaking) + `compiler.removeConsole` in production. `XyzAiWidget` and `SmoothScroll`
  (Lenis) are now `next/dynamic({ssr:false})` (new `XyzAiWidgetMount` / `SmoothScrollMount`) so they leave the
  eager path (the widget only renders for signed-in users). First-load JS stays ~160 kB shared (framer-motion
  is global via the Navbar); per-page eager code drops.
- **Background timers gated**: News feed 20s poll + headline carousel + 60s clock, Messages 30s clock now
  no-op while the tab is hidden (`document.hidden`) — no wasted CPU/network/battery in background tabs.
- No visual/color change in normal (motion-on) desktop use; all existing flows unchanged.

---

## 2026-07-10 — V2 PR-2.5 (tweak 2): Saturn ring spins + faces orbit, moon lit-from-orbit, mobile fit
- **Saturn ring now visibly rotates** (`textures.ts` + `Saturn.tsx`): added angular particle specks to the
  ring texture (screenshot-verified) and spun the ring mesh about its own axis, so the "outer layer" clearly
  turns. Re-tilted Saturn to face toward the core/orbit; moved it further from the heading text (down + a
  touch inward) and kept the real 3D front/back ring occlusion.
- **Moon lit from the orbit** (`Moon.tsx`): kept the crisp half/night terminator but added a warm gold glow
  spilling onto the core-facing (lit) edge, so it reads as illuminated by the XYZ ecosystem; softened the
  night strength a touch so the lit half stays bright.
- **Mobile fit**: tightened the `compact` placement/scale for Saturn + Moon so both sit fully inside the
  small square. Colours unchanged.

---

## 2026-07-10 — V2 PR-2.5 (tweak 1): half/night moon + Saturn alignment + mobile fit
- **Moon → half / "night" moon** (`Moon.tsx`): added a deterministic terminator-shade shell (a dot-product
  shader that darkens the hemisphere facing away from the core, lit side toward the XYZ core) so the moon
  reads as a real phase with a crisp day/night line, independent of scene lights. Rim glow kept on the lit limb only.
- **Saturn alignment** (`Saturn.tsx`): moved down + inward and shrank the ring (radius 0.62→0.55, ring outer
  ×2.15→×1.95) so it sits cleanly in the upper-right, clear of the section heading + right edge; trimmed the
  scroll/pointer parallax gains so it never drifts into the text.
- **Mobile fit**: Saturn + Moon take a `compact` prop (mobile tier) that pulls them inward + scales them down
  (`OrbitalScene.tsx` passes `compact={tier==='low'}`) so both fit fully in the small square. Colours unchanged.

---

## 2026-07-10 — V2 PR-2.5: cinematic WebGL orbital (three.js / R3F) — Living Solar System
- **New `src/components/orbital/` scene** (three.js + react-three-fiber, already-installed deps, ZERO new
  packages): the "Everything orbits XYZ Crypto" centerpiece becomes a real-time 3D cosmos.
  - **Saturn** (`Saturn.tsx`): procedural banded gas globe + a Cassini-gap ring that is a real 3D disc, so it
    occludes behind the top / in front of the bottom for free; fresnel rim + additive glow (fake bloom); slow
    spin + float + wobble; hover brightens; cinematic entrance with a one-shot ring light-sweep.
  - **Moon** (`Moon.tsx`): cratered sphere with a procedural bump map (real relief under the gold key light),
    deep shadow side, edge glow, opposite parallax, slides in from the left.
  - **EcosystemCore** (`EcosystemCore.tsx`): the XYZ logo billboard + breathing halo + gold frame ring + three
    tilted orbits (different speeds) of glowing product nodes + travelling energy motes + inward gold/mint pulses.
  - **Depth layers**: `StarField` (instanced, shader-twinkle distant stars), `SpaceParticles` (nebula clouds +
    foreground dust), `HeroLighting` (gold key / mint fill) — all parallax at different rates.
- **Scroll = advance**: section scroll progress tilts the whole solar-system plane + subtly dollies the camera
  forward + parallaxes each layer (rAF-throttled, cooperates with Lenis). Pointer adds damped parallax.
- **Textures are procedural** (`textures.ts`, drawn once on a `<canvas>`) — no external models/textures, no
  Draco/KTX2/worker loaders (CSP-safe). "Bloom" is faked with additive glow sprites (no postprocessing dep).
- **Gate + graceful fallback** (`useWebglGate.ts`, `OrbitalLazy.tsx`, `OrbitalBackdrop.tsx`): WebGL runs only
  on a capable **dark-theme** session with motion allowed; **light theme + reduced-motion + no-WebGL fall back
  to the polished CSS orbital** from PR-2. The section's CSS starfield drops its Saturn/Moon when WebGL is on
  (no double planets). Re-evaluates on theme toggle + reduced-motion change.
- **Perf**: lazy-loaded (`next/dynamic ssr:false`, three.js off the homepage first-load), dpr capped 1–1.5,
  `frameloop` pauses when offscreen or the tab is hidden, mobile tier drops dpr + particle counts + dust.
  Colors unchanged; no backend impact.

---

## 2026-07-10 — V2 PR-2 (cosmos): realistic 3D Saturn + Moon + light-theme starfield + mobile parity
- **Realistic 3D Saturn** (`Starfield.tsx` + globals): the flat disc is now a proper ringed planet — a
  shaded gas globe (radial highlight + inset terminator shadow + soft-light latitudinal bands that slowly
  drift to fake axial spin) wrapped by a Cassini-gap ring built from two elliptical borders. The ring is
  drawn twice: a back copy behind the globe and a front copy clipped to its lower arc, so it crosses
  **behind the top and in front of the bottom** like the real thing. Bobs slowly. Geometry screenshot-verified.
- **Realistic Moon** (left side): cratered, shaded silver sphere (radial-gradient craters + inset terminator
  shadow + soft halo) that drifts/bobs gently.
- **Mobile parity**: Saturn + Moon now render on phones too, sized with `clamp()` so they stay in proportion
  from phone → desktop (desktop-quality look on mobile, as asked).
- **Light theme fixed**: the whole starfield used to be hidden on white; now it STAYS and is retuned as a warm
  "day sky" — stars recolour to soft amber (`star-w`/`star-g` markers), meteors go gold, and Saturn/Moon get a
  stronger rim + drop shadow so they separate cleanly from the light surface. Verified in both themes.
- Every new motion (band-spin, bob, drift, meteors, twinkle) still stops under `prefers-reduced-motion`;
  colours unchanged; no backend impact.

---

## 2026-07-10 — V2 PR-2 (alive): starfield next-level — drifting stars + meteors + distant planet
- **Stars now MOVE** (`Starfield.tsx` + globals): ~1/4 of the faint stars slowly *drift* along a per-star
  vector (new `star-drift` keyframe, 26–50s) on top of the twinkle, so the field reads as alive, not just
  blinking. Drift + twinkle never fight over `transform` (each star runs exactly one keyframe).
- **More meteors**: shooting stars 2 → **5**, streaking in from all corners at varied angles/travel
  (per-shooter `--rot` / `--dx` / `--dy`) so no two repeat the same line.
- **Breathing nebula**: the three colour hazes now slowly drift + scale (new `neb-float`) for shifting depth.
- **Signature distant planet** (unique cosmos touch): a soft gold gradient sphere with a faint tilted ring
  that bobs slowly (new `planet-bob`), tucked upper-right in the orbital section (off in the hero so it never
  collides with the medallion). Geometry screenshot-verified (reads as a ringed planet, not a blob).
- Hero starfield bumped to `opacity-80` so the drift + meteors read behind the hero. All dark-only, hidden on
  light theme, and every new animation stops under `prefers-reduced-motion`; planet hidden on phones. Colors
  unchanged; no backend impact.

---

## 2026-07-10 — V2 PR-2: Orbital "One unified ecosystem" — starfield + real 3D tilt
- **Full-bleed starfield** (new `Starfield.tsx`): 64 deterministic (SSR-safe, no CLS) twinkling stars +
  two faint distant glows (gold / mint) behind the whole orbital section → a tasteful "deep space / solar
  system" backdrop. `pointer-events-none`, dark-only (hidden on light theme), twinkle stops under
  `prefers-reduced-motion`. Screenshot-verified tasteful (sparse, not busy).
- **Real 3D tilt**: the orbital's desktop pointer-parallax now rotates the whole disc in 3D
  (`rotateX/rotateY` under the existing `perspective`) instead of a flat 2D slide.
- **"XYZ Crypto" accent** → animated `.text-shine` (moving gold, same hue). New `.starfield` +
  `star-twinkle` CSS + light/reduced-motion coverage in globals. Colors unchanged; no backend impact.

---

## 2026-07-09 — S7-C: bespoke 3D icon SYSTEM (multi-hue) + snappier motion + homepage rollout
- **Icon system**: `Icons3D.tsx` expanded to **17 hand-built 3D icons** on a curated 7-hue palette
  (gold/amber/emerald/sky/indigo/violet/rose) — Research, Tooling, Community, Security, Markets, TrendUp,
  TrendDown, Layers, Activity, Flame, Gift, Crown, Academy, Gauge, Lock, Newspaper, Calendar. Each: gradient
  body + gloss + drop shadow (real depth) and a distinct always-on motion. Verified via rendered screenshot.
- **Snappier motion** (globals.css): retuned `i3d-spin 6s / bob 2.2s / scan 2.2s / pulse 1.8s` + new
  `i3d-tick / sweep / float / beat / twinkle / flick`; a `.group:hover` speeds the spin up.
- **Rollout**: Products tiles (Perp DEX→Markets, Trading→Gauge, Airdrop→Gift, Premium→Crown,
  Academy→Academy, & More→Layers) + About "Since 2019" stats (Calendar/Research/Community/Layers);
  **Premium** lock tile → bespoke `LockIcon`; **Contact** method tiles → bespoke `MailIcon` + `ClockIcon`
  (added Star/Mail/Clock to the set, now 20 icons). Brand logos + tiny functional glyphs unchanged.
- Presentational only; brand logos + functional UI glyphs unchanged.

## 2026-07-09 — S7-B: bespoke 3D icons (RobotIcon-style) for the About pillars
- **New `Icons3D.tsx`** — hand-built SVG icons in the RobotIcon spirit (gradient body + gloss highlight +
  soft drop shadow for real depth), each with an always-on **signature motion**: `ResearchIcon` (magnifier,
  light scans across the lens), `ToolingIcon` (gear, slowly spins), `CommunityIcon` (people, front figure
  bobs), `SecurityIcon` (shield, a light sweeps down + the check pulses). Unique gradient/filter ids per
  instance. Keyframes (`i3d-spin/bob/scan/pulse`) added by the RobotIcon ones in globals.css.
- **Wired into the About "Who we are" pillars** (Research-driven / Builder tooling / Community first /
  Security & trust), replacing the flat lucide-in-tile with these bespoke 3D icons; verified via a rendered
  screenshot before shipping.
- Presentational only, no new deps. Same treatment can roll out to Products / stats / other surfaces next.

## 2026-07-09 — S7-A: 3D "alive" icon tiles (pass 1)
- **AnimatedIcon rebuilt** as a genuinely-3D glossy tile (RobotIcon energy): the tile **continuously wobbles
  in 3D** (`rotateY/rotateX` loop) while the glyph sits on a raised `translateZ` plane so it **parallaxes
  forward** as the tile turns; a **coloured glow breathes** behind it and a top gloss gives a lit, rounded
  read. Every icon is **seeded off `index`** (duration/phase/direction) so a wall of them never ticks in
  sync — clearly 3D and clearly alive, not a subtle micro-motion. Added `sky` + `violet` tones. Spring 3D
  flip-in on scroll + pop on hover. Fully `prefers-reduced-motion` safe (static glossy tile fallback).
- **Applied**: About feature-card icons (unique `index`), the About "Since 2019" stat icons, and all
  Products icon tiles (Perp DEX, Trading Tools, the 4 product cards) — converted from static tiles.
- Presentational only — no color/brand change, no new deps. More surfaces + a background "next-level" pass
  follow separately.

## 2026-07-09 — S6-C: Ambient depth + interactive 3D tilt cards
- **Depth**: new `PageBackground` (mesh + masked grid + soft top glow) replaces the bare `<div class="mesh">`
  on /markets, /research and /news, so they get the layered depth of the home hero instead of a flat wash.
- **3D tilt**: new `TiltCard` (`"use client"`) adds subtle pointer-driven 3D tilt (springy, rAF-throttled,
  mirrors the Hero medallion math). No-op on touch and under `prefers-reduced-motion`; springs back flat on
  leave. Applied to the Products cards, the Ecosystem brand cards, and the research `PostCard` (so /research
  + home ResearchPreview cards tilt). Cards keep their existing `.surface/.lift/group` treatment.
- Pure presentational — no color/brand change, no new deps (reuses framer-motion + existing CSS FX).

## 2026-07-09 — S6-B: Product-page header harmonization (industry-grade rhythm)
- **Shared `PageHeader`**: new component unifies the /markets, /research and /news page headers so they
  read as one system — animated eyebrow → display-scale title → subtitle, with the homepage's staggered
  entrance (`Reveal` fade → blur → fade) and type tokens.
- **Consistency fixes**: product H1s now use the `text-display-lg` token (`font-semibold`, fluid) instead
  of three slightly different raw `text-4xl font-bold sm:text-6xl` blocks; header→body margin standardized
  to `mt-12` (was 12 / 14 / 10); News stops hand-inlining the eyebrow markup and uses the shared one.
- **Motion**: product headers now animate in (were static) matching the home sections' cadence.
- Pure presentational — no color/brand change, no behaviour change, no new deps.

## 2026-07-09 — S6-A: Deeper AI briefing + better TTS voice + more sources
- **Deeper briefing**: `buildNewsBriefingPrompt` now targets ~650-900 words with two new high-value
  sections — **Key players** (who's involved + what's at stake) and **Jargon buster** (plain-English
  defs of the story's crypto terms) — plus richer Key details / Different angles and the same strict
  no-fabrication guardrails. Briefing `maxTokens` 1400→2000 (Hinglish 1500→2100 to fit the longer text).
- **Better TTS voice**: new pure `src/lib/tts.ts` (`pickVoice` prefers Google/Natural/Neural/Microsoft
  engines within the right language; `nextRate` speed cycle) with unit tests. `BriefingBlock` now loads
  voices via `voiceschanged` (reliable first-play voice), sets `u.lang`/`u.pitch`, and adds a **speed
  toggle** (1× / 1.25× / 1.5× / 0.75×).
- **More sources**: +3 trusted feeds (Protos, CoinJournal, Finbold) in `news-sources.ts`. Best-effort,
  auto-degrading like the rest.

## 2026-07-08 — S4-B: DM realtime + "Message" from chat & comments
- **Live DMs**: sending a message now broadcasts to the recipient's per-user channel (`user:<id>`,
  event `dm_message`) via the existing realtime lib. The thread + inbox subscribe with `useRealtime`
  (append/refresh live), falling back to the 5s/10s poll when Supabase realtime isn't configured.
  Recipient-only broadcast (sender already has the row) so there's no self-echo to dedupe.
- **Navbar DM badge**: new `Mail` inbox icon in the nav activity cluster with a gold unread count from
  the new `GET /api/dm/unread`; refreshes on the per-user `dm_message` broadcast, the 60s poll, and every
  navigation (so it clears when you open a thread).
- **"Message" everywhere**: `MessageButton` gained a `compact` icon-only variant (reuses the same
  session/start logic; login callback now returns to the current page). Wired into **community chat**
  authors (hover action bar, hidden on your own messages), **research comments**, and **news comments** —
  each gated on the author having a `username`.
- Additive + graceful: no realtime env → polling; no migration (uses S4-A tables).

## 2026-07-08 — S5: Profile polish (desktop name + interactive stats)
- **Desktop name fix**: profile display name is larger and tighter on desktop (`sm:text-4xl lg:text-[2.6rem]`,
  tracking-tight, better baseline next to the avatar); handle sits a touch bigger with cleaner spacing.
- **Interactive stats**: new client `ProfileStats` — the Posts / Comments / Likes numbers **count up** on
  load (ease-out, `tabular-nums`, static when `prefers-reduced-motion`), and each card's icon lifts + scales
  on hover.
- **Share**: new `CopyLinkButton` next to Message copies the profile URL with a brief "Copied" state.
- No data/behaviour change; server page just hands the three counts to the client stat row.

## 2026-07-08 — S4-A: Direct messages (lean 1-on-1)
- **Telegram-style DMs**: members can message each other 1-on-1. New `/messages` inbox + thread page
  (two-pane on desktop, single-pane with back on mobile), and a **Message** button on every public
  profile (`/u/[username]`) that opens or creates the conversation and deep-links via `?c=`.
- **Data**: new `Conversation` (canonical user pair, denormalized last-message + per-side read marks
  for the unread badge) + `DirectMessage` Prisma models; idempotent migration `19_direct_messages`.
- **API** (all gated `getSessionUser` + `handleError`): `GET/POST /api/dm` (inbox + start by username),
  `GET/POST /api/dm/[id]` (thread w/ read-marking + send, rate-limited `dm`, participant-checked 404).
- **Navbar**: "Messages" entry in the account dropdown (desktop + mobile).
- **Helpers**: pure `src/lib/dm.ts` (`orderPair`/`snippet`/`otherOf`/`isUnread`) with unit tests.
- Thread polls every 5s for new messages (realtime is a later step). Graceful pre-migration.
  ⚠️ Owner: apply migration `19_direct_messages` (`npm run db:push`) to activate.

## 2026-07-08 — S3: News likes + comments
- **Social on stories**: readers can now like a news story and leave comments, keyed by story URL
  (mirrors the `SavedStory` per-user pattern). New `NewsLike` + `NewsComment` Prisma models, idempotent
  migration `18_news_social`.
- **API**: `/api/news/like` (POST toggle, rate-limited `like`) returns `{liked, count}`;
  `/api/news/social` (GET thread + like state, POST comment <=1000 chars rate-limited `comment`,
  DELETE own comment). All gated with `getSessionUser` + `handleError`.
- **UI**: new `NewsSocial` component in the reader (after the briefing) - optimistic heart toggle,
  expandable comment thread with avatars, `timeAgo`, self-delete, and Cmd/Ctrl+Enter to post.
- **Graceful**: pre-migration the endpoints return empty/503 and the UI stays quiet. Owner action: apply
  migration `18_news_social` (`npm run db:push`) to activate.

## 2026-07-08 — S1: product-page eyebrow animations + News pills fix
- **Animated eyebrows**: new shared `AnimatedEyebrow` (homepage `eyebrow-glass` sweep + live mint pulse
  + `text-shine` shimmer) applied to Markets ("Live Data"), Research ("Knowledge Hub"), Community, and
  the Premium "Coming Soon" accent + Markets/Research H1 accents now shimmer too. Consistent with the
  News "Live Intelligence" header.
- **News pills**: category chips (For You / All / Breaking / ...) now have a uniform height (h-8),
  even padding, snap-scroll, and cleaner active rings so they line up perfectly on mobile + desktop.
  No behavior change.
- typecheck + lint(0) + test(219) + build green.

## 2026-07-08 — NX4: free realtime push via GitHub Actions scheduler
- New `.github/workflows/push-dispatch.yml`: every ~10 min (+ manual run) it pings
  `${PROD_URL}/api/push/dispatch?secret=${CRON_SECRET}` so breaking-news pushes go out in near
  real time on **any** Vercel plan (no Pro cron needed). Skips gracefully until the two repo secrets
  (`PROD_URL`, `CRON_SECRET`) are set; `vercel.json` daily cron stays as the safe fallback.

## 2026-07-08 — NX3: remove the em-dash from all user-visible text
- Replaced every em-dash "—" with a hyphen "-" across `src/components`, `src/app`, `src/lib` and
  `public` (264 → 0): prose, meta descriptions, string props, and the "no data" placeholder glyphs
  (`compactUsd`/`pct`/etc. now return "-"). Unit-test expectations updated in lockstep. `docs/` left as-is
  (not user-visible).
- typecheck + lint(0) + test(219) + build green.

## 2026-07-08 — NX2: news important-first + faster + advanced briefing + Live animation
- **Important news first**: new pure `rankNews` (`src/lib/news.ts`, unit-tested) scores each story by
  impact blended with recency (High ≈ 8h head-start, Medium ≈ 3h), applied in `getNewsPage` — breaking/
  high-impact surfaces at the top while staying fresh (a stale big story still sinks).
- **Faster**: news `revalidate` 30→20s and client poll 30→20s.
- **Advanced AI briefing**: deeper prompt (adds **Key numbers**, **Different angles** bull/bear, richer
  What-happened; ~450-650 words), tokens 1100→1400 (Hinglish 1500).
- **Live Intelligence animation**: the News header eyebrow now uses the homepage `eyebrow-glass` sweep +
  a live mint pulse + `text-shine` shimmer; the "News" accent shimmers too.
- typecheck + lint(0) + test(219) + build green.

## 2026-07-08 — NX1: XYZ AI 3D-bot branding + navbar light fix + smoother colors
- **3D bot everywhere**: the ✨ Sparkles icon in every XYZ-AI-branded spot is now the **`RobotIcon`**
  (3D robot) — briefing header ("Full briefing · XYZ AI"), coin & protocol "XYZ AI take" (+ Generate),
  and the News "Why this matters" button. Consistent AI branding.
- **Navbar light-theme fix**: the "XYZ AI" label was `text-mint-100` (near-invisible on white); now
  `text-mint-700` in light, `dark:text-mint-100` in dark — readable in both themes.
- **Smoother colors**: softened light surfaces + hairline (`--bg`, `--surface-2`, `--hairline`) and a
  gentler theme transition (adds border-color, 0.35s).
- typecheck + lint(0) + test(216) + build green.

## 2026-07-08 — News v3 · NW5: performance polish
- **Fewer re-renders**: `NewsCard` is now `memo`-ized with **stable callbacks** (`onOpen(index)` /
  `onBookmark(item)` via parent `useCallback`), so saving/bookmarking or new stories no longer
  re-render the whole feed — only the affected card.
- **Offscreen skipping**: cards use `content-visibility: auto` (`.cv-auto`, with intrinsic size) so a
  long feed only paints what's visible — smoother scroll on mobile.
- typecheck + lint(0) + test(216) + build green.

## 2026-07-08 — News v3 · NW4: more trusted sources + Tech/Science
- **+6 reputable tech/science feeds** (Ars Technica, The Verge, Wired, MIT Tech Review, TechCrunch,
  ScienceDaily) → 25 sources total, for broader "what's happening" coverage beyond crypto.
- New **"Tech"** + **"Science"** categories with low-priority keyword rules in `categorize()` — crypto
  keywords still win the primary category, so only genuinely non-crypto items land in these buckets
  (and get their own filter chips). Best-effort fetch + cross-outlet dedupe unchanged.
- typecheck + lint(0) + test(216) + build green.

## 2026-07-08 — News v3 · NW3: real-time push notifications
- **Live cron**: push `dispatch` now runs **every ~10 min** (`vercel.json` `*/10 * * * *`, was once/day)
  so breaking news actually reaches devices soon after it lands. Window tightened to the last 2h,
  up to 3 sends/run; still deduped via `PushedStory` (no repeats).
- **Single, clear control**: removed the duplicate in-app "Alerts" bell (only fired with a tab open);
  `NewsAlertsToggle` (real web-push, works when the site is closed) is now the one notifications control.
  The realtime "N new stories" pill stays.
- ⚠️ Ops: notifications need **VAPID keys** in Vercel env (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`) + `CRON_SECRET`; keys generated separately and handed to the owner. Everything
  degrades gracefully (toggle hidden, dispatch skips) until they're set + redeployed.
- typecheck + lint(0) + test(216) + build green.

## 2026-07-08 — News v3 · NW2: swipe-through-all-news + motion + typography
- **Swipe navigation**: in the reader, a horizontal-dominant touch swipe (doesn't fight vertical
  scroll) moves to the prev/next story; as you near the end the next page **prefetches** (shared
  `loadMore`), so you can swipe through **all** news, not just the loaded page. Mobile "swipe ‹ ›" hint.
- **Motion (next-level)**: a **reading-progress bar** at the top of the reader, a direction-in
  **slide+fade** on each story change, and tactile `active:scale` on category chips. All reduced-
  motion friendly.
- **Typography**: larger, tighter reader headline (22/30px) + roomier body for a premium read.
- typecheck + lint(0) + test(216) + build green.

## 2026-07-08 — News v3 · NW1: article-length briefing + voice + Hinglish
- **Full read**: `buildNewsBriefingPrompt` rewritten to an article-length explainer (TL;DR ·
  What happened · Key details · Background · Why it matters · What to watch next, ~350-550 words);
  `mode:"briefing"` maxTokens 700→1100. So anyone can read the whole story on-site.
- **Voice assistant**: a **Listen** button (free browser `speechSynthesis`) reads the briefing
  aloud — picks an en-US/en-IN (or hi-IN for Hinglish) voice; play/stop, stops on close/change.
- **Hinglish**: new `mode:"hinglish"` on `why-matters` + `buildHinglishPrompt` translates the
  briefing to Roman-script Hinglish; an **EN / Hinglish** toggle swaps the text and Listen reads
  whichever is shown.
- Shared `BriefingBlock` powers both the reader and the shared-story page; `MarkdownLite` extended
  (distinct `###`, italics, ordered lists, blockquotes); pure `stripMarkdown` (`src/lib/strip-markdown.ts`,
  unit-tested) feeds TTS.
- typecheck + lint(0) + test(216) + build green.

## 2026-07-08 — News v2 · NV5: saved stories DB-sync + save-bug fix
- **Bug fixed**: "Saved" used to filter the *loaded feed* by bookmarked ids, so a saved story
  vanished once it aged out of the feed. Now the Saved tab renders **stored full stories**, so
  saves persist across time (and, when signed in, across devices).
- New **`SavedStory`** model + idempotent migration `17_saved_stories` (`@@unique([userId, url])`).
- New gated route **`/api/news/saved`** (GET list · POST save/upsert · DELETE unsave); rows are
  re-hydrated to full `NewsItem`s server-side. Tolerates a not-yet-migrated DB gracefully.
- `NewsClient`: `saved` (full stories) is the source of truth — DB-synced when signed in,
  localStorage for guests; Saved count + bookmark state + reader all read from it.
- ⚠️ Ops: apply migration `17_saved_stories` (`npm run db:push`); code degrades gracefully until then.
- typecheck + lint(0) + test(212) + build green.

## 2026-07-08 — News v2 · NV4: more trusted real-time sources
- **News**: +10 reputable feeds (The Block, Blockworks, DL News, CryptoSlate, CryptoPotato,
  U.Today, AMBCrypto, Watcher Guru, CoinGape, crypto.news) → 19 sources total, broader markets/
  DeFi/institutional coverage. All best-effort (a down feed is skipped, dedupe across outlets).
- **Markets**: DeFiLlama already aggregates *every* perp DEX / DEX / fee protocol in real time;
  widened the Top DEXs & Top Fees lists 8→12 for fuller (clickable) coverage.
- typecheck + lint(0) + test(212) + build green. (NV5 saved-DB + bug fixes next.)

## 2026-07-08 — News v2 · NV3: realtime + super-fast load
- **Instant first paint**: the `/news` page now **server-renders the first batch** (shared
  `getNewsPage` in `src/lib/news-fetch.ts`, used by both the page and the API route). NewsClient
  seeds from it and skips the initial client fetch — no blank-then-skeleton flash.
- **Faster refresh**: news cache `revalidate` 60→**30s** (route `s-maxage=30`), client poll
  90→**30s**.
- **Realtime "N new stories" pill** (Twitter-style): fresh stories are buffered and revealed on
  tap (smooth scroll to top) instead of jumping the feed.
- **Breaking browser notifications**: an **Alerts** bell requests permission and fires a native
  notification for high-impact stories when the tab is backgrounded.
- typecheck + lint(0) + test(212) + build green. (NV4 more sources · NV5 saved-DB + bug fixes next.)

## 2026-07-08 — News v2 · NV2: futuristic UI + motion + image breaking
- **Breaking hero** (`BreakingHero`): image-rich, **auto-rotating** through the top high-impact
  stories with a live pulse badge, source/time, tokens, progress dots, hover "Read on XYZ" — and
  it **opens the on-site reader** (no more off-site bounce). Pauses on hover.
- **Motion** (framer-motion): staggered card entrance on scroll, subtle hover-lift, animated
  reader open/close (AnimatePresence). All gated by `prefers-reduced-motion`.
- **Polish**: per-card sentiment accent bar, animated title underline on the hero, **shimmer**
  skeletons (replaces the flat pulse).
- typecheck + lint(0) + test(212) + build green. (NV3 realtime + speed next.)

## 2026-07-08 — News v2 · NV1: full on-site read + share-our-link + advanced AI
- **Advanced AI briefing** (`mode: "briefing"` on `why-matters`): a full, structured read —
  **TL;DR + Key points + Context + Why it matters** in light markdown (~full page), rendered by
  a new dependency-free `MarkdownLite`. The reader and shared page now auto-generate this so a
  reader gets the whole story without leaving the site.
- **Share = our own link**: `encodeStory`/`decodeStory`/`shareUrl` (`src/lib/news-share.ts`,
  unit-tested) pack a story into a URL-safe token; **`/news/read?d=…`** renders it on OUR domain
  with **OpenGraph/Twitter preview** (title, excerpt, image) + the AI briefing + "Read original".
  Card & reader Share buttons now share this link, not the raw source.
- Better reading typography in the briefing (headings, bullets, bold).
- typecheck + lint(0) + test(212) + build green. (NV2 futuristic UI/animations next.)

## 2026-07-08 — UX P3A: News reader view (read on-site, no bounce)
Clicking a story now opens an in-site reader instead of bouncing off-site.
- **`NewsReader`** modal: hero image, source + time, category/sentiment/impact badges + tokens,
  full summary, an **auto-generated AI Summary** (reuses the gated `why-matters` digest),
  **prev/next** through the current list, bookmark + share, and a **"Read original ↗"** link.
  Keyboard: Esc closes, ←/→ navigate; body scroll-locked; mobile = full-screen sheet.
- `NewsCard`: title + new "Read" open the reader (the off-site link becomes a small "original"
  icon); cards now show a **hero image** when the feed provides one.
- typecheck + lint(0) + test(209) + build green. (DB-synced saved stories land next in P3B.)

## 2026-07-07 — UX P2D: protocol detail pages (`/markets/protocol/[type]/[slug]`)
The Markets protocol rows now open real detail pages, like coins do.
- **`/markets/protocol/[type]/[slug]`** (type ∈ derivatives | dexs | fees; ISR + client
  refresh): header (logo, name, kind), 24h volume/fees + 7d change, **freshness pill**,
  **recent trend chart** (SVG), stats grid (24h/7d/30d/all-time), **chains** chips, an
  **XYZ AI take** (gated, education-only), **related news**, About + official link.
- New proxy `GET /api/markets/protocol/[type]/[slug]` (DeFiLlama `/summary/{type}/{slug}`,
  slug-sanitized, cached, graceful) and gated `POST /api/ai/protocol-brief`.
- `PerpDex`/`DexProtocol`/`FeeProtocol` gain a `slug` (pure `protocolSlug` helper, tested);
  **Top Perp DEXs**, **Top DEXs** and **Top Protocols by Fees** rows now link to their page.
- typecheck + lint(0) + test(209) + build green. (Overview's TVL-protocol/chain rows use a
  different DeFiLlama endpoint — a possible follow-up; not linked here to avoid dead links.)

## 2026-07-07 — UX P2C: trending / gainers / losers rows are clickable
Every coin row across Markets now opens its detail page (P2B), not just the main table.
- `TrendingCoin` + `MoverCoin` gain a CoinGecko `id` (populated in the coins route from
  `search/trending` `item.id` and from the list for gainers/losers).
- **Trending Now**, **Top Gainers (24h)** and **Top Losers (24h)** rows (Overview + Trending
  tabs) now link to `/markets/[id]` with a hover affordance.
- typecheck + lint(0) + test(207) + build green. (Protocol rows — perp DEXs/DEXs/fees — get
  their own detail pages next in P2D.)

## 2026-07-07 — UX P2B: coin detail pages (`/markets/[id]`)
Every coin is now a destination page (SEO long-tail) instead of just a table row.
- **`/markets/[id]`** (ISR shell + client live refresh): header with logo/name/symbol/rank,
  big live price + 24h change, **freshness pill**, **7-day area chart** (SVG), **stats grid**
  (market cap, 24h vol, 24h high/low, ATH + % from ATH, circulating/max supply, 1h/30d), a
  **24h range bar**, an **XYZ AI take** panel (gated, education-only, grounded in the live
  numbers), **related news** (filtered from `/api/news`), and an About blurb + official link.
- New proxy route `GET /api/markets/coin/[id]` (CoinGecko coin + 7d market_chart, id-sanitized,
  cached, graceful) and gated `POST /api/ai/coin-brief` (reuses the AI gateway + daily limits).
- Coin rows in the Markets table now **link** to their detail page; `CoinRow` gains a CoinGecko
  `id` (populated in the coins + search routes).
- Per-coin **SEO metadata** (title/description/canonical). All USD; freshness shown honestly.
- typecheck + lint(0) + test(207) + build green.

## 2026-07-07 — UX P2A: Markets coins table → terminal-grade
- **Sortable columns**: click any header (#, Coin, Price, 1h/24h/7d, Market Cap, Volume) to
  sort; direction toggles, sensible default per column. Pure `sortCoins`/`defaultDirFor` in
  `src/lib/markets.ts` (unit-tested).
- **Sticky header + bounded scroll** on desktop (`md:max-h-[65vh]`) — the terminal look;
  mobile keeps simple horizontal scroll (no janky nested scroll).
- **Real live-price flash**: a coin's price cell pulses green/red **only when its price
  actually changed** between two real polls (diffed per-symbol) — never fake. Respects
  reduced-motion.
- **Freshness pill**: "Updated Ns ago" from the snapshot's real server `ts` (mint when fresh,
  amber when >90s) — honest, no fake "live" claim.
- typecheck + lint(0) + test(207) + build green.

## 2026-07-07 — UX P1B: mobile bottom nav + notifications on mobile + shared states
Native-app feel on mobile + the two owner-flagged fixes.
- **`BottomNav`** (code-split, mobile-only, ~0 initial JS): fixed app-style bar — Markets ·
  News · **XYZ AI** (centered launcher) · Research · Chat — with **real active-route**
  highlight, `env(safe-area-inset-bottom)`, ≥52px targets, and an in-flow spacer so content/
  footer clear it. Hidden on immersive/auth/admin routes (`/community`, `/login`, `/signup`,
  `/forgot-password`, `/dashboard`) that have their own bottom UI. Pure helpers in
  `src/lib/bottom-nav.ts` (unit-tested). The floating AI FAB is now desktop-only (the bottom
  bar is the mobile AI entry); PWA install prompt raised above the bar on mobile.
- **Notifications on mobile**: the `NavActivity` bell (was desktop-only) now also shows in the
  mobile top bar for signed-in users.
- **Navbar**: desktop Search pill slimmed to a single icon (⌘K tooltip).
- **Shared primitives** (`ui/primitives.tsx`): `Skeleton`/`SkeletonList`/`EmptyState`/
  `ErrorState` for consistent loading/empty/error states going forward.
- typecheck + lint(0) + test(207) + build green.

## 2026-07-07 — UX P1A: global command palette + unified search
A `⌘K` / `/` command palette that searches **coins, news, research and pages** from one box
— the hallmark of a top-tier product.
- **`src/lib/command-search.ts`** (pure, unit-tested): static page/action commands +
  `scoreCommand`/`filterCommands` with auth/staff visibility rules.
- **`/api/search/posts`**: lightweight published-post search (title/excerpt) — public,
  rate-limited, cached, P2021/P2022-safe.
- **`CommandPalette`** (code-split via `CommandPaletteMount`, `ssr:false` → **~0 initial JS**):
  debounced (250ms) multi-source search — coins (`/api/markets/search`), news (`/api/news?q=`),
  posts, plus pages + "Ask XYZ AI"; keyboard nav (↑↓/↵/esc), aborts in-flight requests (no
  stale/fake states), **mobile full-screen sheet** with safe-area insets + 44px targets.
- **Navbar**: desktop Search pill (with ⌘K hint) + mobile search icon dispatch the palette.
- Perf budget honored: palette loads post-hydration in its own chunk; no first-paint cost.
- typecheck + lint(0) + test(203) + build green.

## 2026-07-07 — XYZ AI gateway (PR-E): plan-based model routing + docs (final)
Completes the 5-PR multi-provider AI gateway.
- **Plan-based routing** (`routing.ts`): the chat assistant now uses the **quality** model
  for **Premium/Admin** and the **fast** model for **Free** (still capable, keeps the free
  tier cheap + fast); bulk tasks stay on fast for everyone. The gateway passes the caller's
  plan into `routeTier`. (Behavior change: Free chat → fast model.)
- **`docs/ai-gateway.md`**: reference for providers/fallback, routing table, per-plan limits,
  cache/concurrency, usage analytics, cost behavior, the full env list, and the owner SQL ops.
- Tests updated for plan tiering (194 total).
- typecheck + lint(0) + test(194) + build green.

## 2026-07-07 — XYZ AI gateway (PR-D): admin AI Usage dashboard
A new **"AI Usage"** admin tab turns the `AiUsage` log into operational insight +
per-user control. Gated by a new **`ai:manage`** capability (Super Admins have it
implicitly; grant to staff via the Access tab).
- **`GET /api/dashboard/ai-usage`** (`ai:manage`): 30-day daily **requests + cost**
  series (raw-SQL `date_trunc`, reusing `fillDailySeries`), 30-day totals (requests,
  in/out tokens, est cost, errors, fallbacks, cache hits + hit-rate), **provider split +
  health** (from `providerHealth()`), **top members** by usage, and an **abuse watch**
  (members with the most failed calls). All best-effort — zeros before the migration lands.
- **`PATCH /api/users/[id]/ai-limit`** (`ai:manage`, `admin` rate-limit): set/clear a
  member's `aiDailyLimit`; writes an `AdminAudit` (`ai.limit.update`).
- **`AiUsagePanel`** in `DashboardClient`: StatCards + two `TrendChart`s (requests, cost),
  provider-health pills, abuse alerts, and a top-members table with an **inline per-user
  daily-limit editor** (reuses the existing dashboard primitives).
- typecheck + lint(0) + test(193) + build green.

## 2026-07-07 — XYZ AI gateway (PR-C): plan limits + cache + concurrency + graceful UI
Adds real abuse/cost controls and cost-saving caching on top of the gateway.
- **Per-plan daily limits** (`src/lib/ai/limits.ts`, pure + DB): defaults **Free 25 /
  Premium 300 / Admin 3000** per day (env `AI_DAILY_LIMIT_*` overrides + per-user
  `User.aiDailyLimit` override — migration **`16_ai_limits`**). Only user-initiated tasks
  (assistant / why / digest) count; auto-moderation + article summaries don't. Enforced in
  the assistant + why-matters routes → a friendly **429** ("you've reached today's limit,
  resets midnight UTC; upgrade for more"). No plan is "unlimited".
- **Exact-match response cache** (`cache.ts`): deterministic one-shot tasks (summary /
  moderation / why / digest) are cached by `sha256(task + normalized input)` — Upstash Redis
  when configured, else a bounded in-process LRU; both fail-open. **Never caches the
  live-grounded chat assistant.** A cache hit skips the provider and records a `cached`, $0
  usage row so the saving is visible.
- **Per-user concurrency guard** (`concurrency.ts`): one in-flight AI request per member
  (Redis INCR/DECR with a 60s safety TTL, fail-open) → **429** if a second overlaps.
- **`kv.ts`**: shared Upstash handle for cache + concurrency (mirrors the rate-limiter).
- **Graceful capacity**: all-providers-down surfaces a friendly message (why-matters → 503,
  assistant → inline), rendered by the existing widget/news error states.
- Tests: limits math, cacheKey + round-trip, isCacheable/isUserTask (193 total).
- typecheck + lint(0) + test(193) + build green.
- **Owner op (later):** apply migration `16_ai_limits`; until then the plan defaults apply
  (no per-user override) and everything degrades cleanly.

## 2026-07-06 — XYZ AI gateway (PR-B): per-call usage analytics
The gateway now records one durable `AiUsage` row per call — the data layer for
per-user limits (PR-C), the admin AI dashboard (PR-D) and cost visibility.
- **`AiUsage` model** + idempotent migration **`15_ai_usage`**: provider, model, task,
  input/output tokens, latency, status (`ok`/`fallback`/`error`), errorKind, estimated
  cost (integer **micro-dollars**), cached flag, createdAt. **Metadata only — never the
  prompt or response text.** `userId` is nullable + `SET NULL` so analytics survive account
  deletion. Indexed by `createdAt`, `(userId, createdAt)`, `(provider, createdAt)`.
- **`src/lib/ai/usage.ts`**: `recordAiUsage` (best-effort, P2021/P2022-safe — never breaks a
  request) + `errorKindOf` (stable error bucketing).
- **gateway**: `runComplete`/`runStream` meter every call — real provider token usage when
  available, else `estimateTokens`; streams record once fully consumed; failures record a
  `status:"error"` row. `status` is `fallback` when a non-primary provider served.
- Tests: `errorKindOf` + gateway assertions that fallback/ok/error rows are recorded (184 total).
- typecheck + lint(0) + test(184) + build green.
- **Owner op (later):** apply migration `15_ai_usage` SQL in Supabase; until then metering
  no-ops cleanly and the app is unaffected.

## 2026-07-06 — XYZ AI gateway (PR-A): multi-provider abstraction + fallback
Turned the single-provider `src/lib/ai.ts` into a real gateway (`src/lib/ai/*`) —
the foundation for provider fallback, usage analytics, plan limits and an admin
dashboard (later PRs). **No behavior change**: with only Groq configured the chain
resolves to the exact same models as before.
- **`src/lib/ai/`**: `providers/types.ts` (provider-agnostic contracts), `providers/groq.ts`
  (wraps the existing Groq calls), `providers/gemini.ts` (Google REST, no new dep — only
  active with `GEMINI_API_KEY`), `registry.ts` (ordered/enabled provider chain), `routing.ts`
  (task→model tier), `pricing.ts` (token/cost estimate), `gateway.ts` (timeout + bounded
  retry with backoff + **automatic fallback to the next provider** on genuine failure).
- **`ai.ts`** is now a thin back-compat shim (`streamAssistant`/`completeText`/`aiErrorMessage`/
  `aiEnabled`/`AiMessage` unchanged; adds an optional `ctx`), so all 5 consumers keep working.
- **env**: `GEMINI_API_KEY`, `AI_PROVIDER_ORDER` (default `gemini,groq` — adding a Gemini key
  makes it primary with Groq auto-fallback), `AI_DAILY_LIMIT_*`; flags `groqEnabled`/
  `geminiEnabled`; `aiEnabled` now means "≥1 provider configured". Keys stay server-only.
- Guardrails: one key per provider, **no key-rotation/quota-evasion**, fallback only on real
  failure/timeout/legit rate-limit.
- Tests: routing, pricing, registry ordering, and a gateway fallback/classify suite (+19; 182 total).
- typecheck + lint(0) + test(182) + build green.

## 2026-07-06 — Markets: more coins, coin search, all perp DEXs, trending news
- **Coins**: table expanded from top-50 to **top-250**, with a **search box** that
  filters instantly and, for coins beyond the top 250, looks up **any coin** via a
  new keyless **`/api/markets/search`** route (CoinGecko search → live market data).
- **Perp DEX**: DefiLlama derivatives list expanded 8 → **30** protocols; Hyperliquid
  markets 8 → **20** — a far more complete perp picture (volume + OI + funding).
- **Trending tab**: added **Latest Trading News** (from the /news aggregator, auto-
  refreshing) alongside trending coins and 24h gainers/losers.
- Also fixed the AI live-context coins key (`list`, not `coins`) so the assistant
  actually sees current prices.
- typecheck + lint(0) + test(163) + build green.

## 2026-07-06 — PWA: installable + offline app
XYZ Crypto is now an installable Progressive Web App — "Add to Home Screen" on
mobile/desktop gives an app-like, standalone experience that opens fast and
works offline for already-visited pages.
- **`public/sw.js`** upgraded from push-only to a full PWA service worker:
  network-first navigations (fresh online, cached offline, `/offline.html`
  fallback), cache-first for immutable `/_next/static` assets, and APIs/auth/
  realtime never cached. Push handlers remain (dormant while alerts are paused).
- **`manifest.ts`** enriched: `id`/`scope`/`orientation`/`categories`, a
  maskable icon, and app **shortcuts** (Markets / News / Research).
- **`PwaSetup`** (mounted in layout) registers the SW globally and shows a
  subtle, dismissible **"Install app"** pill when the browser reports the app is
  installable (Android + desktop Chrome/Edge); iOS installs via Share → Add to
  Home Screen. **`public/offline.html`** = branded offline fallback.
- Layout gains `appleWebApp` metadata (standalone title + status bar style).
- typecheck + lint(0) + test(158) + build green.

## 2026-07-06 — News: Web Push alerts for major events
Members can opt in to browser push notifications for high-impact crypto news.
- **`NewsAlertsToggle`** on /news (signed-in, supported browsers only): registers the
  service worker (`public/sw.js`), requests permission, subscribes to Web Push, and
  stores the subscription server-side. A second tap unsubscribes.
- **`/api/push/subscribe|unsubscribe`** (auth, rate-limited) upsert/delete the browser's
  `PushSubscription`. **`/api/push/dispatch`** = a `CRON_SECRET`-guarded cron entrypoint
  that finds NEW `High`-impact stories from the last 6h, de-dupes via `PushedStory`, and
  pushes the newest few (`MAX_PER_RUN=2`) to all subscribers — pruning dead endpoints.
- **`src/lib/push.ts`** = `web-push` wrapper (`sendPush` → ok/gone/error); `pushEnabled`
  gates the whole feature so it **no-ops gracefully when VAPID keys are absent**.
- **Schema** (migration `14_push`, idempotent): `PushSubscription` + `PushedStory`.
  **`vercel.json`** cron runs dispatch **daily** (`0 8 * * *`) — Hobby-safe (a
  sub-daily schedule makes Vercel reject the whole deployment on the Hobby plan).
  On **Vercel Pro**, bump the schedule to `*/30 * * * *` for 30-min dispatch.
- New env (names only): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`, `CRON_SECRET`.
- typecheck + lint(0) + test(154) + build green.

## 2026-07-05 — News: personalized "For You" feed
Members can now follow topics and get a personalized news feed.
- **`User.newsInterests String[]`** (migration `13_news_interests`, idempotent) + a
  **"For You"** chip on /news (signed-in) that filters to the followed categories, and a
  **Customize** modal to pick topics. `/api/news/interests` GET/POST (auth, P2022-safe so
  it no-ops cleanly before the migration lands).
- typecheck + lint(0) + test(154) + build green.

## 2026-07-05 — Live Web3 News & Intelligence Hub (/news)
A real-time crypto news hub aggregated from reputable RSS feeds — **keyless, no API
key** (owner request; CryptoPanic free tier had closed).
- **`/api/news`** aggregates ~9 reputable feeds (CoinDesk, Cointelegraph, Decrypt, The
  Defiant, Bitcoin Magazine, Crypto Briefing, BeInCrypto, Bitcoinist, NewsBTC) server-
  side, classifies each story, **de-duplicates the same event across outlets**, filters
  (category + search) + paginates. Cached, graceful (200 even if all feeds fail).
- **`src/lib/news.ts`** (pure, unit-tested): RSS/Atom parser, `categorize` (26 Web3
  categories), `sentiment` (bullish/bearish), `impact` (Low/Med/High), `relatedTokens`,
  `timeAgo`, `dedupe`. **`news-sources.ts`** = the feed list + favicon helper.
- **`/news` page + `NewsClient`**: category filter chips, debounced search, **Breaking
  News banner**, rich cards (source + favicon, headline, summary, "3 min ago", category,
  bullish/bearish, impact, related tokens, Read, Share, Bookmark), **infinite scroll**,
  **live auto-refresh** (90s), **Saved** (localStorage bookmarks), and per-card
  **"Why this matters" AI** (`/api/ai/why-matters`, Groq). **News** added to the navbar.
- typecheck + lint(0) + test(**154**, +12 for news) + build green; page verified.

## 2026-07-05 — Markets: live Web3 data hub (Phase C, PR C1)
New **/markets** page aggregating live market + DeFi data in one place (owner request).
- **Cached proxy routes** (graceful always-200 `live` flag, model on `/api/ticker`):
  `/api/markets/global` (CoinGecko `/global` + Fear & Greed + optional CoinMarketCap
  DeFi/stablecoin enrichment) and `/api/markets/defi` (DefiLlama — total TVL + trend,
  top protocols, top chains, stablecoin mcap). All free/keyless except CMC.
- **`src/lib/markets.ts`** (pure, unit-tested): `compactUsd`, `pct`, `fngLabel`,
  `topByTvl` + shared types.
- **`/markets` page** + **`MarketsClient`** (visibility-gated polling like MarketTicker):
  global KPI tiles, Fear & Greed gauge, DeFi TVL + sparkline, top protocols/chains,
  BTC/ETH candlesticks, live ticker. Reuses `.surface`/`.lift`, `mono`, `--chart-*`,
  `PerpChart`. **Markets** added to the navbar.
- **env:** `CMC_API_KEY` (optional) + `cmcEnabled` — hub works fully without it via the
  free sources; the CMC key just adds DeFi/stablecoin market-cap tiles.
- typecheck + lint(0) + test(137, +8 for markets) + build green; page verified.
- **Expanded (same PR):** professional **tabbed** hub (Overview · DeFi · Perp DEX · DEX &
  Fees · Yields · Trending) + always-visible 5-KPI strip (incl. **ETH gas** via keyless
  Cloudflare RPC). New routes: `/api/markets/perp` (**Perp DEX** — DefiLlama derivatives
  volumes + **Hyperliquid live funding/OI markets**), `/api/markets/dex` (DEX volume +
  fees), `/api/markets/coins` (trending + top gainers/losers), `/api/markets/yields`
  (top yield pools). All keyless/free, cached, graceful. test(141).
- **Polish (same PR):** removed the running ticker from the top of /markets (it overlapped
  the fixed navbar → glitch) and fixed the page padding. Added a **Coins** tab: a full
  CMC-style **market table** (rank, price, 1h/24h/7d %, market cap, 24h volume, 7d
  sparkline, top 50). **ETH gas** fixed (keyless public RPCs w/ fallback — Cloudflare
  gateway was dead); **Perp DEX** made resilient (DefiLlama + Hyperliquid independent).
  Realtime intervals tightened (prices/perp/gas 30s). test(**142**).

## 2026-07-05 — XYZ AI: switch provider to Groq (free, faster, higher limits)
Gemini's free tier limits were being hit. Moved to **Groq** (Llama models) for a more
generous free quota + faster inference. Single-wrapper design meant only `src/lib/ai.ts`
+ the env var changed — assistant, summaries, moderation, widget all unchanged.
- `src/lib/ai.ts`: `groq-sdk` client; models `llama-3.3-70b-versatile` (assistant),
  `llama-3.1-8b-instant` (bulk). `streamAssistant` still returns a provider-agnostic
  `AsyncIterable<string>`; `completeText` uses OpenAI-style chat messages.
- env: `GEMINI_API_KEY` → `GROQ_API_KEY` (free key at console.groq.com/keys).
- deps: remove `@google/genai`, add `groq-sdk`.
- Also: the assistant now shows a **specific** failure reason (usage-limit / not-configured
  / rephrase) instead of a generic message (`aiErrorMessage`).

## 2026-07-05 — XYZ AI Phase B PR 2: article summaries + chat auto-moderation
Two more in-product AI features (Google Gemini, model `gemini-2.5-flash-lite`, same
`GEMINI_API_KEY`; both no-op cleanly when AI is off).
- **AI article TL;DRs:** `Post.summary` (nullable) + idempotent migration
  `12_post_summary`. Generated on publish (`afterPublish`) and on body edits (research
  PATCH), plus an admin backfill endpoint `POST /api/ai/summarize` (`post:publish`).
  Rendered as a mint "TL;DR · XYZ AI" block atop the article; hidden pre-migration /
  until generated (P2022-safe read).
- **AI chat auto-moderation:** each new message is classified (`classifyToxic`); clearly
  toxic ones are auto-hidden via the existing moderation path (broadcast
  `message_hidden`), fully restorable from Dashboard → Moderation. **Fail-open + bounded
  (4s)** — any error/timeout/quota leaves the message visible; runs after create+broadcast
  so the (optimistic) send stays instant.
- **New:** `src/lib/ai-summary.ts` (pure prompt builders + parsers, unit-tested) ·
  `src/lib/ai-tasks.ts` (server `summarize` / `classifyToxic`, best-effort) ·
  `src/app/api/ai/summarize/route.ts`.
- typecheck + lint(0) + test(**129**, +9 for ai-summary) + build green.

## 2026-07-05 — XYZ AI: dedicated navbar entry + 3D robot + green look
Small UX polish on the shipped assistant (owner request, before PR 2):
- **Dedicated "XYZ AI" navbar item** (desktop + mobile). Clicking it opens the
  floating assistant via a `window` `xyz-ai:open` event (`XYZ_AI_OPEN_EVENT`
  exported from `XyzAiWidget`) — no page nav, no refactor.
- **3D robot icon** — new `RobotIcon` (`src/components/RobotIcon.tsx`): a glossy
  green robot head built from gradients + gloss highlight + drop shadow (per-instance
  gradient ids via `useId`). Replaces the flat sparkle/`Bot` across navbar, launcher,
  header, and gate.
- **Look** — navbar button is a **transparent glass** pill with a **live "active"
  green pulse** (glow + border + tint breathe together) and a subtle robot head-turn;
  the **floating launcher is green** (mint gradient) with a soft glow pulse. All
  animations disabled under `prefers-reduced-motion` (house convention).
- Verified (Playwright + screenshots): navbar transparent + `ai-active` animation +
  robot SVG, green launcher gradient, opens the assistant, 0 page errors.
  typecheck + lint(0) + test(120) + build green.
- **Robot idle life** (follow-up): the `RobotIcon` now blinks its eyes and pulses
  its antenna light everywhere it appears; the floating launcher's robot gently
  floats/tilts. Verified: `robot-antenna`/`robot-blink`/`ai-fab-float` animations
  live, 0 errors.
- **Always-on** (follow-up): these XYZ AI brand animations were being disabled by
  the desktop "reduce motion" OS/browser setting (why they looked static on some
  desktops). By owner decision they now run regardless of that preference — verified
  the pulse animates under emulated `prefers-reduced-motion: reduce`. (Trade-off:
  intentionally overrides reduce-motion for these subtle decorative animations only.)

## 2026-07-05 — XYZ AI: research assistant (Phase B, PR 1) — Google Gemini (free)
First in-product AI feature — a floating **"XYZ AI"** chat assistant, open to **all
signed-in members**, grounded in the site's own published research. Provider: **Google
Gemini free tier** (owner's call: free now, easy swap to Claude later).
- **New:** `src/lib/ai.ts` (single AI-provider wrapper — `GoogleGenAI`, `aiEnabled`
  graceful-degrade flag, `streamAssistant` returning a provider-agnostic
  `AsyncIterable<string>`, `completeText`, model constants) · `src/lib/ai-ground.ts`
  (pure, unit-tested grounding: keyword ranking + capped corpus + system prompt) ·
  `src/app/api/ai/assistant/route.ts` (streaming, logged-in gate, `ai` rate bucket, zod,
  article grounding) · `src/components/XyzAiWidget.tsx` (launcher + streaming chat;
  login gate; Markdown answers with `/research` citations).
- **Model:** `gemini-2.5-flash` (free), streamed. Single-wrapper design → switching to
  Claude later touches only `ai.ts`.
- **Env:** `GEMINI_API_KEY` (optional — everything no-ops cleanly when unset, house
  degradation pattern). Dashboard Integrations strip gains an **"XYZ AI"** health pill.
- **Access & safety:** any signed-in member; 15 turns/min per user; bounded grounding
  corpus (≤8 articles / ≤12k chars) + capped history (12 turns). **Premium article
  bodies are redacted from the corpus** (title+excerpt only) so the open assistant
  can't leak paid content.
- typecheck + lint(0 err) + test(**120**, +11 for ai-ground) + build green.

## 2026-07-03 — Social login: GitHub + X (Twitter) providers, unified buttons
- **New OAuth providers** (env-gated like Google): `GITHUB_CLIENT_ID/SECRET` and
  `TWITTER_CLIENT_ID/SECRET` (OAuth 2.0). Buttons appear on /login + /signup only when
  configured — zero UI change until keys are added.
- **Unified `SocialButtons`** (Google/GitHub/X) replaces the single GoogleButton; forms
  take a `providers` flags object from the server pages.
- **Provider stamping fixed**: `linkAccount` event now records the real provider
  (was hardcoded "google" for every OAuth signup).
- **Email caveat handled**: GitHub can hide email and X never shares it — such accounts
  get a stable placeholder (`gh-<id>/x-<id>@users.noreply.xyzcrypto.io`) so login works;
  email features simply no-op for them (documented in .env.example).
- Dashboard Integrations strip now shows GitHub login + X login status pills.
- typecheck + lint(0 err) + test(109) + build green.

## 2026-07-03 — Chat v3: message recovery + Telegram-style polls + pinned messages
Recovery point: branch `backup/pre-p6-security` (same base). Owner-requested chat upgrade:
- **Deleted messages recovered:** chat deletes were always soft (`status='hidden'`) —
  new one-click **"Restore all hidden (N)"** in Dashboard → Moderation → Chat
  (`action: "restore_all"` on the moderate API), plus per-message Restore (existing) and
  a HANDOFF SQL fallback. Nothing was ever destroyed.
- **Polls (Telegram semantics):** create from the composer "📊" button (question +
  2–8 options); one vote per member, tap another option to move your vote, tap your own
  to retract. Live results with share bars + counts via `poll_vote` broadcasts
  (anonymous counts only — voter identity never leaves the server; your own `myVote` is
  stamped per-request). New models `ChatPoll`/`ChatPollOption`/`ChatPollVote` +
  `ChatMessage.kind`, APIs `POST /api/chat/polls` + `POST /api/chat/polls/[id]/vote`,
  idempotent migration `11_chat_polls` (auto-applies via vercel-build).
- **Pinned messages:** admins pin/unpin from the message action bar; a gold banner above
  the chat shows the latest pin (tap → jump to message). `ChatMessage.pinnedAt`,
  `message_pinned` broadcast, pin state included in history + initial render.
- Poll math extracted to pure helpers (`applyPollVote`, `pollShares`) — 6 new unit tests
  (109 total). Poll messages aren't editable (question integrity); hiding a pinned
  message clears the banner; polls flow through moderation like any message.

## 2026-07-03 — Phase 6: security verification + hardening (audit §5 closed out)
Recovery point: branch `backup/pre-p6-security`. The audit's security section is now fully
verified/fixed/accepted (see AUDIT-2026-07-01 §5):
- **CSP: `'unsafe-eval'` dropped from script-src** — browser-verified on a prod build
  across home/research/community/login/premium: 0 CSP violations, 0 chunk/hydration
  errors. `'unsafe-inline'` remains an accepted risk pending a nonce pipeline
  (documented in `next.config.mjs`).
- **Dashboard email exposure**: Members table now shows `maskEmail()` with
  reveal-on-click; `SECURITY.md` reconciled (staff APIs/CSV intentionally return raw
  emails inside the `users:manage` trust boundary).
- **`/api/contact` gets its own rate bucket** (5/min/IP) — previously shared `subscribe`
  with `/track`, so page-view pings from one NAT could 429 real contact submissions.
- **Ops flags for the owner**: `UPSTASH_REDIS_REST_URL`/`TOKEN` are NOT set in prod
  (per the Vercel env screenshot) → all rate limits are permissive no-ops until added.
  Supabase private channels/RLS stays on the roadmap (privileged state is re-checked
  server-side, so public channels leak only presence/ping metadata).
- typecheck + lint(0 err) + test(103) + build green.

Note: Phase 5 (UI/UX polish) was **discarded by owner decision** — PR #42 closed
unmerged, original design retained; the work is preserved on `backup/pre-p5-uiux`.

## 2026-07-02 — Phase 4: Dashboard v2 — analytics, moderation, audit trail, subscribers (audit §2.2)
Recovery point: branch `backup/pre-p4-dashboard`. Four write-only/invisible datasets got
professional surfaces, plus real analytics:
- **30-day trend charts** in Overview — signups/day + page-views/day. New
  `GET /api/dashboard/timeseries` (dashboard:view, Postgres `date_trunc` bucketing,
  zero-filled server-side, cached 60s). Hand-rolled SVG area charts (no chart lib):
  hover crosshair + tooltip, peak label, sr-only data table; hues validated per theme
  with the dataviz six-checks (`--chart-mint`/`--chart-gold`).
- **Moderation tab** (post:manage) — global comment queue (`GET /api/comments`, new
  soft-hide `PATCH /api/comments/[id]`) and chat-message review incl. hidden
  (`GET/POST /api/chat/messages/moderate`, hide/restore with live broadcasts).
- **Activity tab** (users:roles) — the `AdminAudit` trail finally has a reader:
  `GET /api/admin/audit` + paginated panel (who changed whose access, when).
- **Subscribers tab** (users:manage) — `GET /api/subscribers` list + full CSV export
  (the table previously had no read endpoint at all).
- **Integration health strip** in Overview — Realtime/Storage/Rate-limits/Email/Google
  configured-or-not (booleans only, never values).
- **Content table**: mobile no longer forces a 640px scroll (Category/Views/Date fold
  into the title line, back at md:), and Views/Date column sorting.
- 6 new unit tests for the pure timeseries helpers (103 total).
- typecheck + lint(0 err) + test(103) + build green; /dashboard 247 kB first-load.

## 2026-07-02 — Phase 3: Community Chat — professional + full mobile parity (audit §1.1, §1.3)
Recovery point: branch `backup/pre-p3-chat-pro`. The chat now behaves like a native app on
phones and gains the "finished product" features:
- **Mobile parity:** container uses `dvh` (composer stays visible above the keyboard);
  message actions open on TAP on touch devices (the always-visible bar overlapped text);
  Enter inserts a newline on touch (send via button) and still sends on desktop; 16px
  composer font (no more iOS zoom-on-focus); safe-area padding (home-indicator clear);
  double-tap-❤️ is desktop-only (touch gets a ❤️ button in the tap menu — no zoom fight);
  header decluttered <640px (subtitle hidden, 3 avatars max); reaction/emoji popovers
  clamp to the viewport.
- **Message editing:** authors can edit within 15 min — `PATCH /api/chat/messages/[id]`,
  `message_edited` broadcast, inline edit UI, "(edited)" label. New `ChatMessage.editedAt`
  column (idempotent migration `10_chat_edited`, auto-applies via vercel-build).
- **"New messages" divider** marks where unread starts when you're scrolled up.
- **Honest connection state:** Live / Reconnecting… / Auto-refresh (was a forever
  "Connecting…" when realtime wasn't configured).
- **Removal tombstone:** deleted messages show "Message removed." in-session instead of
  silently vanishing mid-read.
- **Grouped-message timestamps** reveal in the gutter on hover / while the tap menu is open.
- Extracted pure helpers to `src/lib/chat-view.ts` (`canEditMessage`, `reconcilePoll`) with
  **9 new unit tests** (97 total).
- typecheck + lint(0 err) + test(97) + build green; `/community` 245 kB first-load;
  Playwright-verified at 390px + desktop.

## 2026-07-02 — Phase 2: all functional bugs fixed (audit §1.2, §2.1, §3)
Recovery point: branch `backup/pre-p2-bugfixes`. 20+ confirmed bugs from the audit, fixed:
- **Chat correctness (`ChatClient.tsx`):** polling now reconciles deletions (hidden
  messages disappear without realtime); presence uses stable presence-key fallback ids
  (guest online-count no longer drifts); reply-quote jump pages backwards (bounded) until
  the target loads; the realtime channel no longer re-subscribes on profile edits (deps on
  identity only, profile fields via ref); loadOlder guards all-deduped pages (no scroll
  jump) and reports whether rows were added; reaction popover closes on outside press;
  failed-send rollback no longer clobbers re-typed input; send/doSend split (no fake
  FormEvent); single steady typing-expiry interval; AudioContext closed on unmount.
- **Dashboard data:** new `GET /api/users` (users:manage) — paginated, server-searchable
  members + `?format=csv` **full** export; Members panel now searches ALL members
  (debounced, server-side) with Load-more, not just the 50 most recent; CSV button uses
  the full export; PremiumMembers re-seeds on server refresh; Content table shows
  per-post **Views**.
- **Site-wide:** comment "Load older" pagination (older comments were unreachable);
  MarketTicker light-mode remap (`/70`,`/90` opacities); research list/home/related no
  longer ship article bodies — cards use precomputed `readMinutes` (payload trim,
  PERFORMANCE.md win #1); notifications without a target render as non-links (no more
  jump-to-top `#`); `en-US` locale pinned in ticker/chart (hydration-safe); email fallback
  no longer logs OTP/message bodies in production; signup no longer reveals registered
  emails (generic response + "you already have an account" notice email); LikeButton
  ignores broadcasts while its own toggle is in flight; footer `/profile` link verified
  intentional (self-resolving redirect to `/u/<handle>`).
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.

## 2026-07-01 — Complete site audit (docs/AUDIT-2026-07-01.md)
Full-stack audit: chat (mobile + correctness + features), dashboard (bugs + missing
features + API gaps), site-wide bugs, UI/UX "AI-generic" review, security verification,
performance. Graded scorecard + every finding with severity/file:line/fix, mapped to a
6-phase remediation program (P2 bugs → P3 chat → P4 dashboard → P5 UI/UX → P6 security).
Docs-only change.

## 2026-07-01 — Fix: password reset now clears account lockout
Recovery point: branch `backup/pre-reset-lockout-fix`. **Bug:** a user who locked their
account by guessing (5 failed logins → 15-min `lockedUntil`) and then reset their password
still couldn't sign in with the new password — `authorize()` (`src/lib/auth.ts`) checks the
lock *before* comparing the password, and the reset handler updated only `passwordHash`.
- **Fix:** `src/app/api/auth/password/reset/route.ts` now clears `failedLoginCount` and
  `lockedUntil` in the same update that sets the new hash, so a reset unlocks the account
  immediately (no more ~15-min wait).
- Scope: one file; lockout policy and the authenticated change-password path are unchanged.
- typecheck + lint(0 err) + test(88) + build green.

## 2026-06-27 — Fix: CSP was blocking Supabase Realtime (the real "still not working")
Recovery point: branch `backup/pre-csp-fix`. **Root cause** of live-online + instant
sound being dead in prod despite correct env vars: the Content-Security-Policy
`connect-src` (`next.config.mjs`) didn't allow Supabase, so the browser silently blocked
the Realtime WebSocket (`wss://<ref>.supabase.co`). The channel never reached
`SUBSCRIBED` → no presence ("0 online" / "Connecting…"), no broadcasts, no sound.
- **Fix:** added `https://*.supabase.co wss://*.supabase.co` to `connect-src` (one line).
  Mirrors the `**.supabase.co` already allowlisted for images.
- Ruled out (all verified correct): the broadcast endpoint `/realtime/v1/api/broadcast`
  (current per Supabase docs, returns 202), NEXT_PUBLIC build-time inlining, Vercel
  "Sensitive" flag, and the entire client subscription/presence/event wiring.
- Documented in `docs/REALTIME-SETUP.md` so `connect-src` isn't tightened back.
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.

## 2026-06-27 — Community Chat: emoji-reaction sound + realtime setup guide
Recovery point: branch `backup/pre-reaction-sound`. Follow-up to the sound/live-online fix.
- **Sound on emoji reactions:** the `reaction` broadcast handler now plays the same
  subtle blip when **another** member adds an emoji reaction (opt-in toggle; never your
  own; `remove` is silent), mirroring the new-message rule. Reuses the existing shared
  `AudioContext` + `playBlip` — no new audio plumbing.
- **Realtime-only note:** reaction sound (like presence + instant message push) needs
  Supabase Realtime configured; the 10s polling fallback stays message-list-only and
  doesn't blip on reactions (no per-user reaction delta to key off → would misfire).
- **New ops guide `docs/REALTIME-SETUP.md`:** exact step-by-step to turn on live
  "who's online" + instant sound — copy the 3 Supabase keys → set 4 Vercel env vars →
  redeploy → 2-device verification + troubleshooting. Linked from `docs/HANDOFF.md §4`.
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.

## 2026-06-27 — Community Chat: sound + live-online fix
Recovery point: branch `backup/pre-sound-fix`. Targeted fix for "sound & live online
real-time showcase not working" — both bugs were client-side; the message core is untouched.
- **Sound now actually plays:** `playBlip()` previously created a *new* `AudioContext` on
  every incoming message — under browser autoplay policy a context created outside a user
  gesture stays `suspended`, so it was silent. Now a single shared `AudioContext`
  (`audioCtxRef`) is created **and resumed inside a user gesture** (`ensureAudio()` on the
  sound-toggle click and on send), and `playBlip(ctx)` only plays when `ctx.state === "running"`.
  Enabling sound also plays an immediate confirmation blip. Sound now fires on the polling
  fallback path too (not just realtime broadcast).
- **Live-online strip visible on mobile:** the online-members avatar stack was
  `hidden … xs:flex` (hidden below the `xs` breakpoint), so on phones the "who's online"
  showcase never appeared even when presence worked — changed to `flex` so it always shows.
- **Ops note (the other half):** presence ("live online") and new-message broadcast are
  **realtime-only** — they need `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (+ server `SUPABASE_SERVICE_ROLE_KEY` for broadcasts) set in prod with Supabase Realtime
  enabled. Without them the chat degrades to 10s polling and presence/sound can't surface.
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.

## 2026-06-27 — Community Chat: engagement v2 (#7) — mentions, quick-react, sound
Recovery point: branch `backup/pre-chat-v2`. Additive on top of v1; send/broadcast core untouched.
- **@mention autocomplete:** typing `@partial` in the composer suggests online members
  (with a handle), with avatar + name; selecting inserts `@username` (links to their profile).
- **Double-tap to ❤️:** double-click any message to toggle a heart (reuses `toggleReaction`).
- **Sound toggle:** a header speaker button (opt-in, persisted) plays a subtle Web-Audio
  blip on incoming messages (never your own) — that "new message" dopamine hit.
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.

## 2026-06-27 — Community Chat: futuristic overhaul v1 (#7) — live presence
Recovery point: branch `backup/pre-chat-overhaul`. Visual + presence only — the message
send/broadcast/reaction core is untouched (it's the fragile part).
- **Live "who's online" presence strip:** presence now tracks each member's name + avatar
  + handle, de-duped by user id; the header shows a stack of online members' avatars
  (linking to their `/u/<handle>` profiles) + a live count. Real social proof / "who's here".
- **Futuristic header + room identity:** "XYZ Lounge" with a pulsing live/connecting dot,
  `#general` subtitle, a mint gradient header bar and a mint "N online" pill.
- **Ambient glow** behind the room (mint top + gold corner), content layered above it.
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.
- Next iterations (optional): @mention autocomplete from online members, quick double-tap
  reactions, sound/streak cues — all layer on top of this without touching the core.

## 2026-06-27 — UX fixes + security audit + perf (items #2–#6)
Recovery point: branch `backup/pre-batch-fixes`.
- **#4 Footer:** "Create account"/"Log in" now hidden when signed in (GuestOnly) — members
  see "Your profile"/"Settings" instead.
- **#5 Emoji animations:** keyframes made subtle/professional (the `emoji-wobble` 360° flip
  and `emoji-launch` -7px jump are gone) — no more "out of box" motion; contained, no layout shift.
- **#6 Profile name:** added `min-w-0`/`break-words` so a long display name no longer gets
  clipped by the badges row on desktop.
- **#2 Security audit** (`docs/SECURITY-AUDIT.md`, full report): fixed **F-001 open redirect**
  (login `callbackUrl` now same-origin only), **F-005** bcrypt cost 10→12, **F-006** research
  edit/delete now `post:manage` (granular, not Super-Admin-only), **F-008** prod warning when
  rate-limiting is disabled. Documented the rest (realtime RLS, CSP nonce — ops/deferred).
- **#3 Performance** (`docs/PERFORMANCE.md`): comments lazy-load threshold 400→150px;
  `/api/users/staff` cached 30s; prioritized roadmap for the deeper wins.
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.

## 2026-06-27 — Navbar: show Dashboard link to all staff (not just Super Admins)
Recovery point: branch `backup/pre-navbar-staff`.
- **Root cause of "granted user can't reach the dashboard":** the navbar only showed the
  Dashboard link when `role === "ADMIN"`, so a member granted a capability (role `USER` +
  permissions) had no link to /dashboard even though the page now lets them in. The link
  (desktop account menu + mobile drawer) now shows for **any staff** via `isStaff(user)`
  (Super Admin OR ≥1 capability). After a refresh/re-login the granted member sees
  Dashboard and lands on their allowed tab(s).
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.

## 2026-06-27 — Access fixes: dashboard gate trap + "who has access" + What's-New emoji
Recovery point: branch `backup/pre-access-fixes`.
- **Granted access now works (core bug):** the dashboard required the specific
  `dashboard:view` capability and defaulted to a hardcoded "overview" tab — so granting
  any *other* capability (e.g. `whatsnew:manage`) let the member past nothing. Now the
  page gates on **`isStaff`** (Super Admin OR ≥1 capability) and the active tab defaults
  to the **first tab the viewer can see**. A member granted What's New now opens the
  dashboard straight onto the What's New tab.
- **"Who has access" Team section:** new `GET /api/users/staff` (gated `users:roles`,
  pre-migration-safe) lists everyone with a capability + Super Admins. The Access panel
  now shows a **Team** list (with capability counts + Edit) above the grant-access search.
- **What's New emoji picker:** the composer body has an emoji button (reuses the chat
  `EmojiPicker`) so entries can include emojis.
- AccessEditor hint clarifies that any capability grants dashboard access (refresh if
  already signed in).
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.

## 2026-06-27 — Milestone 4: animations/emoji polish (#3) + professional SEO (#9)
Recovery point: branch `backup/pre-m4`. Final milestone of the program.
- **#3 Animations/emoji:** consistent `AnimatedEmoji` accents added to every marketing
  section heading — About 🚀, Products ⚡, Ecosystem 🌐, Social 👋, What's New ✨, plus
  the new FAQ 💬 (Hero/Premium/Contact already had them). All reduced-motion-safe via
  the existing `AnimatedEmoji` (renders a static glyph when motion is reduced).
- **#9 SEO (brand-rank "XYZ Crypto"):**
  - JSON-LD builders moved to JSX-free `src/lib/seo-schema.ts` (unit-testable);
    `jsonld.tsx` re-exports them. **Organization** gains `foundingDate` (2019), sized
    `logo` ImageObject, `slogan`, `knowsAbout`, `email`, `areaServed`, `alternateName`.
    **Article** uses a `Person` author + a 640×640 publisher logo.
  - New **FAQPage** schema + a visible homepage **FAQ** section (shared `src/lib/faq.ts`
    source) targeting brand queries (what is XYZ Crypto, is it free, is it legit…).
  - **sitemap.ts** now includes public `/u/<handle>` profiles (capped).
  - Per-article **dynamic OG images** via `next/og`
    (`research/[slug]/opengraph-image.tsx`) — branded card with the post title (Node
    runtime, graceful fallback).
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.
- ⚙️ Ops: set `GSC_VERIFICATION` + submit the sitemap in Google Search Console.

## 2026-06-27 — Pre-M4 fixes: admin access search + migration auto-apply
Recovery point: branch `backup/pre-fixes`. Two owner-reported blockers.
- **Admin Access search:** the dashboard "Access" tab now searches **any member** by
  email/name via a new `GET /api/users/search` (gated `users:roles`, permission select
  guarded for pre-migration) instead of filtering only the recent 50 client-side. Each
  result shows current capability count + Grant/Edit access; grants are repeatable
  (grant → save → adjust → save), and the list refreshes after each save.
- **What's New "add" failed = DB not migrated:** the M1/M2 schema (login-lockout cols,
  `permissions`, `WhatsNewEntry`, `AdminAudit`) wasn't applied to prod. Added idempotent
  migration files `prisma/migrations/8_login_lockout` + `9_permissions_whatsnew_audit`,
  and a **`vercel-build`** script that runs `prisma db push` (best-effort, non-fatal) on
  every Vercel deploy so the schema auto-syncs. CI `build` unchanged (no DB) → stays green.
- typecheck + lint(0 errors) + test(85) + build green; shared First-Load JS 159 kB.
- ⚙️ Immediate unblock (before next deploy): `npm run db:push` (prod env) + `npm run seed`.

## 2026-06-27 — Milestone 3: realtime data + notifications (#7, #11)
Recovery point: branch `backup/pre-m3`. No schema changes (pure realtime layer).
- **Reusable `useRealtime` hook** (`src/lib/useRealtime.ts`): subscribes to a Supabase
  broadcast channel/event when configured, else **polls** a cached endpoint — broadcast-
  driven invalidation (server pushes a tiny ping, client refetches) so it never streams
  rows or hammers the DB. Pure `realtimeMode()` decision is unit-tested. Degrades to no-op.
- **#11 Live data:** likes update live for all viewers (broadcast on `post:<id>` from the
  like route → `LikeButton` refreshes the count); new comments appear without reload
  (`CommentSection` refetches on a `post:<id>` `comment` broadcast); **dashboard stats
  live-refresh** — new shared `getDashboardStats()` + cached `GET /api/dashboard/stats`
  (gated `dashboard:view`), Overview refreshes instantly on the notifications ping + a 30s
  backstop. `LiveStats` presence + membership realtime unchanged.
- **#7 Notifications + chat icon:** verified the existing realtime path — `notifyNewPost`/
  `notifyNewComment` ping clients so the bell updates instantly; the chat icon lights up on
  the `new_message` broadcast. (Already realtime; extended likes/comments to broadcast too.)
- typecheck + lint(0) + test(85) + build green; shared First-Load JS 159 kB.

## 2026-06-26 — Milestone 2: admin permissions (#10) + What's New CMS (#6)
Recovery point: branch `backup/pre-m2`. Scalable, production-ready. No re-architecture.
- **Granular permissions (#10):** new `src/lib/permissions.ts` capability **catalog**
  (`dashboard:view`, `post:publish`/`post:manage`, `users:manage`/`users:roles`,
  `premium:manage`, `whatsnew:manage`) — add a new capability in one line. `User.permissions
  String[]`; **Super Admin** (ADMIN_EMAILS / legacy role=ADMIN) implicitly holds all and is
  immutable. Session carries `permissions` + `isSuperAdmin` (`auth.ts`, guarded for
  pre-migration). `requirePermission()` gate in `src/lib/api.ts`; gates moved to capabilities
  (dashboard → `dashboard:view`, research publish → `post:publish`, membership → `premium:manage`).
  New `PATCH/GET /api/users/[id]/access` with **no-escalation** guards + `AdminAudit` trail +
  live `access_changed` broadcast (session refreshes via `RealtimeSession`). Dashboard
  **"Access"** tab: search members, grant/revoke capabilities; tabs now capability-gated. +7 tests.
- **What's New CMS (#6):** new `WhatsNewEntry` model (tags New/Improved/Fixed/Announcement/
  Security/Roadmap). `GET /api/whatsnew` (public, `?tag=&q=` filter/search, cached, **static
  fallback** when empty/unmigrated) + `POST`/`PATCH`/`DELETE` (gated `whatsnew:manage`).
  **Auto-entry** created on research publish (linked to the post); manual entries via the new
  dashboard **"What's New"** tab. Homepage `WhatsNew` is now DB-driven with **tabs** (filter by
  tag) + **realtime** refresh (`whatsnew_updated` broadcast) + `revalidatePath`. Seeded
  idempotently from the old static list. +2 tests.
- typecheck + lint(0) + test(82) + build green; shared First-Load JS 159 kB.
- ⚙️ Ops: apply the M2 migration (User.permissions, WhatsNewEntry, AdminAudit) — see HANDOFF §4.

## 2026-06-26 — Milestone 1: security hardening + critical bugs + mobile (#4,#5,#8,#2)
Recovery point: branch `backup/pre-m1`. First of the 4-milestone roadmap program.
- **#4 Premium CTA bug:** `/premium` "Create account" CTAs are now wrapped in
  `GuestOnly`; signed-in members get a member CTA instead (new `SignedIn.tsx`, the
  inverse of `GuestOnly`). Logged-in users no longer see "create account".
- **#5 Password + brute-force:** shared strong `passwordSchema` (min 8 + upper/lower/
  digit) enforced server-side at signup, reset and change (`src/lib/profile.ts`,
  signup/reset routes; `PasswordField` minLength→8). **DB-backed account lockout**
  (5 fails → 15 min) in `src/lib/auth.ts authorize()` — works even without Upstash;
  login path kept independent of the new columns so it degrades gracefully pre-migration.
  New User columns `failedLoginCount`, `lockedUntil`. +6 unit tests.
- **#8 Auto @handle:** handles already auto-assign on signup/OAuth + on-the-fly; added a
  standalone idempotent backfill (`prisma/backfill-usernames.ts`, `npm run
  backfill:usernames`) for any legacy NULL handles. Navbar already resolves `/u/<handle>`.
- **#2 Mobile/responsive:** dashboard members table no longer forces horizontal scroll
  on phones (date columns hidden < md, relaxed min-width); contact form inputs → 44px
  tap target (`py-3`).
- typecheck + lint(0) + test(73) + build green; shared First-Load JS 159 kB.
- ⚙️ Ops: apply the migration adding `User.failedLoginCount`/`lockedUntil`
  (lockout activates once applied); optionally run `npm run backfill:usernames`.

## 2026-06-26 — Desktop orbital: fix static animation + light rendering; park 3D
Reported on desktop (light preview): the orbital centerpiece was **static** and the
node pills rendered **dark on the light background**.
- **Root cause:** the WebGL gate fell back to the CSS orbital on the device, whose
  rotation was gated by `prefers-reduced-motion` (→ static); the node pills used
  `bg-ink-900/85`, a level not yet remapped for light (→ dark pills).
- **Fix:** `OrbitalEcosystem.tsx` now always animates the signature rings / aurora /
  logo glow / node float (deliberate always-on motion for the branded centerpiece);
  ring opacities bumped for visibility. `globals.css` remaps `bg-ink-900/85` → light
  surface so pills are light-on-light.
- **Consolidated to the CSS orbital on all devices** (`OrbitalLazy.tsx`): dropped the
  capability-gated R3F path. The branded, labeled CSS orbital is lighter, reliable,
  theme-correct and animates everywhere; **three.js is no longer fetched on the
  homepage** (bundle win). `OrbitalScene3D.tsx` parked in-repo for a future art pass.
- **Verified (Playwright + Chromium):** rings confirmed rotating in light, dark, and
  under emulated reduced-motion; pills render light-on-light (light) and dark (dark);
  dark unchanged. Shared First-Load JS 159 kB.

## 2026-06-26 — Phase 2 completion (B): light-theme migration (foundation + high-traffic)
Recovery point: branch `backup/pre-light-theme`. **Dark mode byte-for-byte unchanged**
— every rule is scoped to `html:not(.dark)`. CSS-only; no component classNames touched
(so zero dark-mode regression risk, hierarchy preserved).
- **B1 additions** (on top of the B0 foundation below): white `ring-*` outlines,
  gold/mint `text-*-400/500`, status text (`red`/`amber`/`sky`/`violet`/`blue`/
  `emerald` 200–400) lifted to readable shades, remaining dark chips (`bg-ink-800/600`),
  the `.eyebrow`/`.eyebrow-glass` pills, and the scrollbar track — all themed for light.
- **Visual verification (Playwright + Chromium, this repo):** rendered light mode at
  1440px on homepage, login, and contact and confirmed parity with dark — themed
  navbar, eyebrow pills, darkened gold-gradient headings, `.surface` cards, form
  inputs/labels, mint/gold buttons, and status/icon accents all read correctly. Dark
  re-rendered identical. (Covers the shared Field/card/prose/overlay patterns used by
  Settings, Dashboard, articles, and chat.)
- Shared First-Load JS unchanged (159 kB).

### B0 foundation
- `src/app/globals.css`: a consolidated light foundation that remaps the design's
  actual utilities under `html:not(.dark)`:
  - **Text ramp** (`text-zinc-50…700`, `text-white`) → a dark-on-light hierarchy.
  - **Brand accent text** (`text-gold-100/200/300`, `text-mint-200/300`, gradients,
    `text-shine`) → readable shades on white.
  - **Hairlines/tints** (`border-line`, `border-white/5,10`, `bg-white/…`) → dark tints.
  - **Inputs & overlays** (`bg-ink-700/60`, `bg-ink-9xx/8xx` dropdowns, `bg-ink-950`)
    → light surfaces.
  - **Primitives**: `.glass`/`.surface`/`.surface-hover`, `.btn-secondary`/`.btn-ghost`,
    `.prose-xyz` (headings/body/code/pre/blockquote/tables/links) → light treatments.
  - **Ambient FX** (`.mesh`/`.aurora`/`.particle`) hidden in light; `.grid-bg` softened.
- Shared First-Load JS unchanged (159 kB).
- ⏳ Next (B1, after preview review): targeted high-traffic className cleanups for the
  few spots the CSS remap can't reach (rings, inline gradient overlays, hero specifics).

## 2026-06-15 — Phase 2 completion (A): section polish + anime/iconsax rollout
Recovery point: branch `backup/pre-polish-rollout`. Styling-only, brand-consistent,
no behavior/feature change. First small checkpoint of the "complete the sweep" work.
- **Homepage sections** brought up to the polished standard (`Social`/`WhatsNew`):
  - `About.tsx`: credibility box → `surface surface-hover lift` + `glow-orb`; Learn/
    Trade/Earn get a mint left-accent; credential icons scale on hover.
  - `Products.tsx`: gold hover-glow on the Perp spotlight; icon `group-hover:scale`
    across all product cards.
  - `Ecosystem.tsx`: tone-aware hover glow (gold/mint) per card, logo scale, livelier
    Telegram CTA.
  - `Footer.tsx`: gold-dot column headers, social-icon `scale-110`, link hover shift,
    centered disclaimer; `FooterNewsletter.tsx` → contained premium glass card + eyebrow.
- **MagneticButton rollout** (desktop/fine-pointer only — auto-disabled on touch &
  reduced-motion; anime.js stays lazy): Navbar "Get Started", ChatClient "Log in to
  chat", PremiumLock CTAs. (Hero already covered.) Mobile-only CTAs intentionally
  skipped (magnetic no-ops there).
- **Iconsax accents** (standalone premium spots only — not mixed into uniform lucide
  icon arrays): `PremiumLock` `Lock`→iconsax `Lock`, `Sparkles`→`MagicStar`.
- Shared First-Load JS unchanged (159 kB); homepage First-Load unchanged (244 kB).

## 2026-06-15 — Phase 2 (increment 8): Admin Dashboard premium polish
Recovery point: branch `backup/pre-research-polish` (chained). Styling only; no logic change.
- **DashboardClient**: header eyebrow → premium glass pill; active tab gold glow +
  stronger divider (matches Settings/Community); stat cards get `lift` hover.
- Shared First-Load JS unchanged (159 kB). Closes the user-facing + admin premium sweep.

## 2026-06-15 — Phase 2 (increment 7): Community/Chat premium polish
Recovery point: branch `backup/pre-research-polish` (chained). **Styling only** —
no realtime/state/handler changes; chat logic untouched.
- **ChatClient**: own messages get a subtle mint tint (clearer own-vs-others),
  richer empty state (emoji + subcopy), typing dots brightened to mint.
- **Community page**: header eyebrow upgraded to the premium glass pill.
- Shared First-Load JS unchanged (159 kB).

## 2026-06-15 — Phase 2 (increment 6): Profile + Settings premium polish
Recovery point: branch `backup/pre-research-polish` (chained). No behavior/data change.
- **Public profile** (`u/[username]/page.tsx`): banner depth (gradient + hairline),
  stronger avatar ring + gold glow, social/location rendered as premium pills, wider
  stat spacing, hover on activity items, and a richer empty state (icon + subcopy).
- **Settings** (`SettingsClient.tsx`): active tab gets a subtle mint glow + stronger
  divider; input focus ring bumped (gold/20 → /30). Forms/logic unchanged.
- Shared First-Load JS unchanged (159 kB).

## 2026-06-15 — Phase 2 (increment 5): Research/Articles reading-experience polish
Recovery point: branch `backup/pre-research-polish`. No behavior/feature change; brand kept.
- **Reading typography** (`globals.css` `.prose-xyz`): added styling for previously
  unstyled elements — fenced **code blocks** (`pre` + `pre code` reset), **ordered
  lists**, `h4`, **images** (rounded + ring), **tables**, and a gold **`hr`** divider;
  refined list/line rhythm. Article column stays `max-w-3xl`.
- **Premium gate** (`PremiumLock.tsx`): premium visual upgrade — soft gold glow,
  blurred "hidden content" teaser lines, gold-shine lock badge, and a 3-perk value
  list. Gating logic + buttons unchanged (content still never sent to non-Premium).
- Shared First-Load JS unchanged (159 kB).

## 2026-06-15 — Phase 2 (increment 4): Anime.js micro-interactions + Iconsax accents
Recovery point: branch `backup/pre-fx`. Hero-scoped; brand palette; reduced-motion safe.
- **Iconsax accents** (`Hero.tsx`): eyebrow `Sparkles`→`MagicStar` (gold), trust-line
  `ShieldCheck`→`ShieldTick` (mint). Homepage First-Load JS +2 kB (244 kB); shared 159 kB.
- **Anime.js magnetic CTA** — new `MagneticButton.tsx`: primary hero CTAs ease toward
  the cursor and spring back (elastic) on leave. Disabled for reduced-motion / touch;
  anime.js **lazy** (only fetched on first hover — not in the initial bundle).
- No layout/section changes; backward-compatible.

## 2026-06-15 — Phase 2 (increment 3): Homepage + Navbar premium pass
Recovery point: branch `backup/pre-homepage-polish`. Brand kept; no new deps;
shared First-Load JS unchanged (159 kB).
- **Navbar** (`Navbar.tsx`): active-route indicator via `usePathname` (desktop
  underline persists + `text-zinc-50`; mobile gets `bg-white/5 text-gold-200`;
  `aria-current`); subtle gold ring on the scrolled glass bar.
- **Hero** (`Hero.tsx`): interactive hover on the live-stat cards. Medallion,
  parallax, badges, ticker, reduced-motion handling all unchanged.
- Anime.js micro-interactions + Iconsax accents remain a separate upcoming pass.

## 2026-06-15 — Phase 2 (increment 2): R3F orbital hero (lazy + CSS fallback)
Recovery point: branch `backup/pre-hero`. Stability/perf-first; brand palette only.
- New `OrbitalScene3D.tsx` — React-Three-Fiber premium orbital (gold core +
  mint/gold orbiting nodes + sparkles, auto-rotate + pointer parallax). Perf-budgeted:
  `dpr={[1,1.5]}`, low-poly, paused when offscreen/tab-hidden, no heavy postprocessing.
- `OrbitalLazy.tsx` — capability gate: renders the 3D scene only on capable desktop
  (WebGL + pointer:fine + ≥lg + not reduced-motion + ≥4 cores/4GB); otherwise the
  existing CSS `OrbitalEcosystem` (fallback unchanged). three.js is a **separate
  async chunk** (~672 KB) — only downloaded when the 3D scene mounts; **shared
  First-Load JS unchanged (159 kB)**, mobile/low-power never fetch it.
- Deps (pinned for React 18): `three@0.169` · `@react-three/fiber@8` ·
  `@react-three/drei@9` (+ `@types/three`). Noted in `docs/DESIGN-SYSTEM.md`.
- Hero/navbar premium polish kept minimal this pass (stability-first); deeper
  per-area passes follow.

## 2026-06-15 — Phase 2 (foundation): design system + light/dark theming
Recovery point: branch `backup/pre-phase2`. Brand identity preserved; **dark mode
pixel-identical** to before (zero regression); backward-compatible.
- **Theming:** Tailwind `darkMode: "class"`; semantic CSS-var tokens in `globals.css`
  (`:root` light / `.dark` dark = current values); `body` wired to tokens; no-FOUC
  inline script + default `dark` class in `layout.tsx`; new `ThemeToggle` in the navbar
  (desktop + mobile). Dark stays default for first-time visitors.
- **Design tokens:** semantic Tailwind aliases (`base`, `surface`, `surface-2`,
  `content`, `content-muted`, `hairline`), motion tokens (`ease-premium`,
  `duration-250/400`); documented in new `docs/DESIGN-SYSTEM.md`.
- **Libraries:** installed `animejs` (v4) + `iconsax-react` (additive); lazy
  `src/lib/anime.ts` helper. (R3F deferred to the hero increment.)
- No UI redesign in this pass — foundation only. Per-area premium polish + R3F hero
  are the next increments.

## 2026-06-15 — Phase 1: performance & stability
Recovery point: branch `backup/pre-phase1` (@ d5e9b63). All backward-compatible,
no UI/architecture change. First-Load JS unchanged (159 kB shared).
- **DB indexes** (`prisma/schema.prisma` + idempotent migration
  `7_phase1_indexes/`): `Notification[userId,createdAt]`, `User[membership,createdAt]`,
  `PageView[path,createdAt]`. Additive; app already tolerant if unapplied.
- **PageView retention** (`api/track`): opportunistic (~1.5%) fire-and-forget prune
  of rows older than 90 days → table stays bounded without cron/infra.
- **Dashboard premium list** (`dashboard/page.tsx`): bounded with `take: 100`
  (newest-first) to avoid an unbounded scan at scale.
- **Chat realtime hygiene** (`ChatClient.tsx`): `channel.unsubscribe()` before
  `removeChannel` on cleanup → no subscription buildup on repeated mounts.
- Image/bundle review: `next/image` lazy defaults already in place; only an
  admin-only preview `<img>` remains (non-public). No risky refactors.

## 2026-06-15 — Phase 0 deep audit + critical fixes (see docs/AUDIT-PHASE0.md)
Recovery point: branch `backup/pre-audit-fixes` (@ ca969f7) pushed to origin.
**Fixes (safe, backward-compatible):**
- **Upload content-type spoofing** — `src/lib/storage.ts` now magic-byte–sniffs
  uploads (`sniffImageType`) and rejects non-images regardless of client MIME;
  applies to `api/profile/avatar` (any user) + `api/upload` (admin). +unit tests (67 total).
- **Unbounded notification fan-out** — `notifyNewPost` (`src/lib/notifications.ts`)
  now caps recipients (50k) and inserts in 500-row batches.
- **Admin upload rate-limit** keyed per-user (`api/upload`) instead of IP.
- **Mobile** — notification dropdown `max-w-[calc(100vw-1rem)]` so it doesn't clip.
Deep audit report (chat/upload/CMS/scale/mobile) added. Not merged to main —
held for owner review. No architecture/UI/feature changes.

## 2026-06-14 — Pre-Phase-2 hardening, audit & recovery point (see docs/AUDIT-PRE-PHASE2.md)
**Recovery point:** backup branches `phase1-stable` + `pre-phase2-backup` pushed
to origin (tag `phase1-production` local; tag push blocked by env git proxy).
**Security:** like/comment routes rate-limit per `user.id` (was IP); `api/chart`
only interpolates an allowlisted coin key (SSRF fix); `lib/otp.ts` fails closed in
prod without `NEXTAUTH_SECRET`; `auth/password/start` no longer leaks account
existence on email-send failure; `notifications/read` ids constrained to CUID.
**Observability:** `app/error.tsx` now reports to Sentry.
**SEO:** homepage `metadata` + canonical; `WebSite` JSON-LD `SearchAction`;
canonicals on premium/contact/community/u/login/signup; `app/manifest.ts` (PWA);
sitemap adds premium/community/contact.
**Frontend:** ProofStrip `<img>` width/height + lazy/async (CLS); Hero parallax
skipped under reduced-motion.
**Quality:** removed dead `MembersShowcase.tsx`; added `clientIp` unit tests
(64 tests green). No architecture/UI/feature changes. Verdict: READY FOR MERGE.

## 2026-06-14 — Demo 3: branded loader, live emoji, orbital fix, realtime data
**Branded route loader**
- New `BrandLoader` (XYZ logo + orbiting/pulsing rings on mesh); `RouteSkeleton`
  now renders it, so every suspending navigation shows a branded transition.

**Emoji (real + actively animated)**
- Stronger keyframes in `globals.css`: `emoji-launch` (fly/lift loop),
  `emoji-wobble` (hourglass flip), new `emoji-twinkle` + `emoji-spin`;
  `AnimatedEmoji` gains `twinkle`/`spin` variants.
- Premium: heading rocket 🚀 flies, "Coming soon" ⏳ flips, "Most popular" now an
  animated ⭐ (twinkle) instead of the lucide Sparkles.
- Contact: real animated emoji (👋 ✉️ 💬 ⏱️) on the header badge + info cards,
  and the community social icons are now **brand-coloured** (red/white/sky/blue,
  reusing the `Social.tsx` map) instead of monochrome.

**Orbital desktop fix** (`OrbitalEcosystem.tsx`)
- Rings/aurora/logo-glow now animate on mount (gated only by
  prefers-reduced-motion) instead of waiting for an in-view `active` flag, and
  rotation speeds sped up (18/24/14s, aurora 16s) so it visibly runs on desktop.
  Particle field + parallax stay in-view/perf-gated.

**Real-time data for end users**
- New `useLivePresence` hook (observes the `site-visitors` presence channel),
  `GET /api/live/stats` (visits today/total + members), and `LiveStats` strip
  ("N online now · visits today · total · members") in the Footer + homepage.
- Live bell: `CH_NOTIFY` broadcast "ping" from `lib/notifications.ts` on every
  notification; `NavActivity` subscribes (+ community `new_message`) to refetch
  instantly, poll relaxed to 60s fallback. All degrade gracefully without
  Supabase.

## 2026-06-14 — Demo 2: UI/UX polish, in-app notifications, profile fix, speed
**Profile / Settings**
- Fixed "Profile opens Settings": every account now gets an auto-assigned unique
  handle on signup (`lib/username.ts`, wired in `auth.ts` credentials + Google
  `createUser`); new `/profile` route resolves/mints a handle and redirects to
  `/u/<handle>`; navbar Profile falls back to `/profile` (never Settings).
  `prisma/seed.ts` backfills handles for existing users (idempotent).
- Research post byline + (existing) chat/comment authors link to `/u/<handle>`.

**In-app notifications (new)**
- New `Notification` model + idempotent migration `6_notifications/`.
- `lib/notifications.ts` (new-post fan-out + new-comment to author, best-effort);
  triggers wired into `api/research` (publish) and `api/posts/[id]/comments`.
- `GET /api/notifications` (+ unread count) and `POST /api/notifications/read`,
  new `notifications` rate-limit bucket; both degrade gracefully pre-migration.
- `NavActivity`: navbar bell (gold unread count + animated dropdown) + community
  chat icon (mint unread dot vs per-device last-seen). Email left dormant via the
  existing `sendEmail` console fallback until a verified Resend domain is set.
- Homepage **"What's New"** section (`lib/whatsnew.ts` + `WhatsNew.tsx`) replacing
  the removed Members showcase.

**UI / animation polish**
- `ActionLink` + `.btn-press` (tap-scale + click/redirect sheen) on all primary
  CTAs (Hero, Navbar, Premium, StickyCta); reduced-motion aware.
- `AnimatedEmoji` (rocket/hourglass) — Premium "Coming Soon" + "Get started".
- Global page-transition `app/template.tsx` (fade/rise, reduced-motion aware).
- Navbar signed-in widget: avatar gold-ring pulse + animated account dropdown.
- Premium hero restacked to "Premium Plans" / "Coming Soon" (two lines).
- About: `lg:items-start` so "Who we are" / "Since 2019" align with the pillars.
- Orbital: reliable desktop activation (activate-if-near-viewport on mount).
- Hero CTAs centered below `lg` (mobile-desktop), left-aligned at `lg`.

**Performance**
- `loading.tsx` skeletons (`RouteSkeleton`) for `/research/[slug]`, `/community`,
  `/settings`, `/u/[username]`, `/dashboard` → instant paint on navigation.

## 2026-06-14 — Production hardening: audit fixes, perf, profile-photo (see docs/AUDIT-2026-06-14.md)
**Resilience/DB**
- Added real migration `prisma/migrations/5_post_views_pageview/` (idempotent).
- `getPost` (`research/[slug]/page.tsx`) + dashboard posts query now retry without
  `views` on Prisma P2022 → missing migration no longer 404s posts / 500s dashboard.

**Bugs/security**
- New per-user `profile` rate-limit bucket; `api/profile/avatar` + `api/profile`
  PATCH/DELETE switched from `admin`(IP) → `profile`(user id).
- `auth/password/start`: returns 502 when email delivery fails (enumeration-safe).
- `auth.ts` signup: recover from P2002 race (re-read winning row).
- `research/[slug]`: premium gating re-checks live role/membership from DB.
- Research `content` capped at 100k chars (`api/research` + `[id]`).

**Profile photo (both approaches)**
- `AvatarUploader`: added validated **"Use a link"** URL fallback (works without
  Supabase Storage); saves via existing `PATCH /api/profile`.
- `profile.ts`: new optional `image` field + `isAllowedImageHost()` (host allowlist
  synced with next/image `remotePatterns`); +unit tests.
- Setup/ops steps added to `HANDOFF.md` (Storage bucket + env, migration).

**Performance (no design change)**
- `PerpChart`: poll skips hidden tabs + refresh on focus.
- `MarketTicker`: `decoding="async"` on coin logos.
- Tuned `next/image` `sizes`: `PostCard`, article cover, Hero logo.

DoD: typecheck + lint + test (60) + build all green; shared First-Load JS 159 kB (unchanged).

## 2026-06-12 — Mobile responsiveness pass (Phase 3/3)
- New `xs` (400px) breakpoint to distinguish small vs large phones.
- Hero medallion + Orbital ecosystem: smaller base `max-w` on tiny phones
  (15/16.5rem) scaling up at `xs`/`sm` → no crowding/overflow at 320–360px.
- MarketTicker cell padding `px-5 → px-3.5 sm:px-5` (kills horizontal-scroll
  risk on narrow phones).
- Chat hover action bar (react/reply/copy/delete) now **always visible on touch**
  (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`) — was hover-only and
  unreachable on mobile.

## 2026-06-12 — Polish: interactive upload, green dashboard, animations, speed (Phase 2/3)
- **Interactive upload:** real progress bar (XHR `upload.onprogress`) + animated
  drag-drop highlight on the post cover uploader and the avatar uploader
  (shared `src/lib/upload.ts`).
- **Green profile dashboard** (`/settings`): mint-accented identity card (avatar,
  badge, member-since, view-profile link), mint active tabs + primary actions,
  animated tab transitions (framer-motion).
- **Speed:** homepage orbital lazy-loaded (`next/dynamic`, ssr:false, same-size
  placeholder) → homepage page JS 11.4 → 10.1 kB; shared JS unchanged (159 kB).
- **Colors:** primary actions standardized to mint, premium/brand stays gold.

## 2026-06-12 — Real-time admin: live visitors, analytics, post views, instant membership (Phase 1/3)
- **Real-time membership:** admin downgrade/upgrade now pushes to the affected
  user's browser via Supabase channel `user:<id>` → session refreshes → the
  Premium icon appears/disappears **instantly** (no re-login). New
  `RealtimeSession` mounted in the root layout.
- **Self-hosted analytics:** `PageView` table + `POST /api/track` ping (deduped
  per navigation) → admin Overview shows **Total visits / Visits today**, and a
  **Live online** count via Supabase presence (channel `site-visitors`).
- **Post views:** `Post.views` counter (prefetch-guarded increment on the article
  page), shown on the post byline + aggregated in admin.
- **Admin Premium tab:** dedicated section listing all Premium members with
  one-click downgrade; updates live via channel `members`.
- Generic `src/lib/realtime.ts` `broadcastEvent` (chat broadcast refactored onto
  it). ⚠️ One-time SQL (Post.views + PageView) in HANDOFF.md.

## 2026-06-11 — Community Chat → advanced group chat
- **Nav:** "Community" link renamed to "Community Chat" (href unchanged).
- **Reactions:** emoji reactions (👍❤️😂🔥🚀🎉👀💯) — `ChatReaction` table,
  `POST /api/chat/messages/[id]/react` toggle (reuses `like` limiter), live
  `reaction` broadcast + optimistic chips.
- **Replies:** quote/reply to any message — `ChatMessage.replyToId` self-relation,
  composer reply preview, in-message quoted snippet (click → scroll to original).
- **Realtime presence + typing:** "N online" count and "X is typing…" indicator
  via Supabase channel presence/broadcast (hidden gracefully on polling fallback).
- **Polish (framer-motion, /community chunk only):** animated message enter/exit,
  reaction pop, typing dots, jump-to-latest w/ unread count; consecutive-author
  message grouping; hover action bar (react/reply/copy/delete); emoji picker in
  composer (curated, no new dep); @mention highlighting → profile links.
- **Schema:** +`ChatReaction`, +`ChatMessage.replyToId`. ⚠️ Combined one-time SQL
  in HANDOFF.md. Chat-scoped change only; shared First-Load JS unchanged.

## 2026-06-11 — Community Chat (Supabase Realtime · public read, login to post)
- **New page `/community`** ("The XYZ Lounge"): live message feed with avatars,
  Premium ★/Team badges, day separators, smart auto-scroll + jump-to-latest,
  load-older pagination, optimistic send w/ draft restore, own/admin delete,
  guests read + "Log in to chat" CTA. Plain-text only (XSS-safe), links via
  `safeHref`. Performance: own route chunk — shared First-Load JS unchanged;
  `@supabase/supabase-js` (new dep) lazy-imported inside the chat page only.
- **Realtime:** server broadcasts `new_message`/`message_hidden` to Supabase
  channel `community` after DB writes; clients subscribe with the public anon
  key. Graceful fallback to visibility-aware 10s polling when env unset.
- **Schema:** `ChatMessage` (body ≤500, status visible|hidden, cascade on user
  delete). ⚠️ One-time prod migration — SQL in HANDOFF.md.
- **API:** GET/POST `/api/chat/messages` (cursor history / send, new `chat`
  rate-limit 10/min/user), DELETE `/api/chat/messages/[id]` (author or admin).
- Nav "Community" + orbital node now → `/community`; homepage community section
  gains an "Open Community Chat" CTA. New env (optional):
  `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 2026-06-11 — Docs book + continuity handoff (GitBook-ready)
- **New:** root `CLAUDE.md` (continuity anchor for any AI/dev session),
  `docs/SUMMARY.md` + `docs/README.md` (GitBook book structure), `docs/HANDOFF.md`
  (resume-from-any-account guide, env table names-only, pending-migration SQL),
  `docs/api-reference.md` (all 24 endpoints), `docs/SECURITY.md` (posture + secrets
  policy). Changelog/backend-state/frontend-state updated for Profiles v1.1.
- Docs-only release; no runtime changes.

## 2026-06-11 — Bug fixes + mobile/PC performance pass + audit (PR #11)
- **Bugs:** dedicated `password` rate-limit bucket (reset spam no longer blocks
  signups); settings save no longer blocked by stale handle check; `/u/[username]`
  double DB query → React `cache()`; profiles force-dynamic → **ISR 60s** with
  `revalidatePath` on profile/avatar edits.
- **Perf (mobile):** backdrop blur 10–18px+saturate → 8px on ≤768px; Lenis
  disabled on touch; orbital particles 34 → 14 on phones.
- **Perf (PC/both):** hero parallax rAF-throttled; ticker pauses in hidden tabs;
  dashboard 3 user counts → 1 groupBy. Bundle size unchanged.
- **Audit:** `docs/AUDIT-2026-06-11.md` (scorecard A−/A); backup branch
  `backup/v1.1-profiles` + source ZIP delivered to owner.

## 2026-06-11 — User profiles: public /u/[handle] + private /settings (PR #10)
- **Public profile** `/u/[username]`: banner, avatar (initials fallback), bio,
  location, socials (X/GitHub/Telegram/website), Premium/Team/member-since badges,
  stats (posts/comments/likes), recent-comment activity. Email never exposed.
- **Settings** (tabbed Profile/Account/Security): avatar upload (Supabase), name,
  unique handle w/ live availability, bio/location/website/socials, membership
  panel + upgrade CTA, change password (current-password verify), delete account
  (typed confirm, transactional).
- **Schema:** +username (unique), bio, location, website, twitter, github,
  telegram, bannerImage. ⚠️ Requires one-time prod migration (see HANDOFF.md).
- **API:** PATCH/DELETE `/api/profile`, POST `/api/profile/avatar`,
  POST `/api/profile/password`, GET `/api/profile/username`.
- Navbar: avatar + account dropdown (Profile/Settings/Dashboard/Sign out).
- 15 new unit tests (50 total). CI ESLint config fixed (`.eslintrc.json` + deps).

## 2026-06-11 — Orbital ecosystem section + auth simplification (Phase 4)
- **Home:** premium 3D Orbital Ecosystem section (additive; rings/nodes/particles,
  in-view + reduced-motion gated, no heavy libs, home stays ISR).
- **Auth:** login is now standard email+password (removed OTP 2FA step); authorize
  verifies bcrypt + rate-limit (login 10/min/account). Signup still OTP-verified;
  forgot-password unchanged. New PasswordField (show/hide + strength meter on signup).
  Removed dead /api/auth/login/start route.
- Verified: tsc clean, 35 tests, build exit 0.

## 2026-06-11 — Final pre-merge batch: session CTAs, Likes, perf, polish
- **Logged-in CTAs:** WaitlistForm/Hero/CtaBand/ResearchPreview now session-aware —
  account holders see "Explore Research" instead of early-access/waitlist (client-side
  checks; home stays ISR). New `EarlyAccessCta`.
- **Likes:** `PostLike` table (migration `4_likes`), `POST /api/posts/[id]/like`
  toggle (auth, rate-limited), `LikeButton` (optimistic) beside ShareRow on articles.
- **Perf:** CommentSection fetch deferred until in-view; AVIF/WebP image formats.
- **Polish:** PostManager alert() → inline errors.
- Verified: tsc, 31 tests, build exit 0, home ○ ISR intact.

## 2026-06-11 — Pre-merge audit + Premium Content + Comments + account privacy
- **Audit:** PASS, 88/100, no critical/regressions; image-upload "issue" = config (Storage env+bucket).
- **Premium Content:** `Post.premium` flag + editor toggle; **2-layer gating** — list
  API redacts body, `[slug]` server-renders `PremiumLock` (no body in HTML/JSON-LD)
  unless `membership==="Premium"`/admin. Premium badges on cards + manager. `[slug]` now dynamic.
- **Comments:** `Comment` table; `/api/posts/[id]/comments` (GET public, POST logged-in,
  auto-publish, Zod 1–1000, `comment` rate-limit) + admin `DELETE /api/comments/[id]`;
  `CommentSection` on articles (never exposes commenter email).
- **Account/privacy:** `membership` added to JWT+session; Navbar account chip with
  **masked email** (`maskEmail`) + Free/Premium pill + easy sign-out (desktop + mobile).
- **Upload hardening:** client type/size pre-check, drag-and-drop, 501→URL-fallback hint.
- **Migration:** `3_premium_comments` (additive; run in Supabase SQL Editor).
- **Docs:** new `backend-state.md` + `frontend-state.md`. Files unchanged in auth-login
  logic/deploy/existing columns. Verified: tsc, 31 tests, build exit 0.

## 2026-06-10 — OTP delivery fix + premium article + perf
- **Files:** `lib/email.ts`, 3 × `api/auth/*/start` routes, `research/[slug]/page.tsx`,
  `globals.css`, `PostCard.tsx`, new `ReadingProgress.tsx` + `ShareRow.tsx`, docs/.
- **Fix:** OTP emails — root cause `onboarding@resend.dev` only delivers to the
  Resend account owner (members got nothing). Send failures now return 502 to the
  user (no more silent stuck-on-OTP screen) + Sentry capture. Real fix = owner
  verifies domain in Resend and sets `EMAIL_FROM` to it (steps in RUNBOOK).
- **Design:** premium article page — reading progress bar, share row (copy/X/
  Telegram), author byline card, lead excerpt, `.prose-xyz` upgrades.
- **Perf:** lazy-loaded below-the-fold home sections (dynamic imports).

## 2026-06-10 — CMS upgrade (edit/draft/preview/upload) + feed pagination
- **Backend:** `GET/PATCH /api/research/[id]` (edit; stable slugs), paginated +
  searchable `GET /api/research`, `POST /api/upload` (Supabase Storage REST,
  graceful fallback), dashboard posts bounded. Zero schema changes.
- **Frontend:** `PostEditor` (toolbar, Write/Preview, cover URL/upload,
  draft/publish), `PostManager` (search/filter/status/edit/toggle/delete),
  `/research` search + Load more, related-posts on articles; framer-motion
  dropped from ResearchGrid. Tests 27.

## 2026-06-10 — Sentry + security hardening + indexes
- Sentry (client/server/edge, DSN-guarded; handleError 500s reported).
- Security headers (CSP/HSTS/XFO/nosniff/referrer/permissions), image-host
  allowlist (was `**`), `next` 14.2.5→14.2.35, DB indexes
  (`Post(published,category,createdAt)`, `User(createdAt)`), RUNBOOK.md.

## 2026-06-10 — Email OTP auth + Supabase Postgres migration
- Schema → Supabase Postgres (pooled + `pgbouncer=true`, `DIRECT_URL`).
- OTP system: `VerificationCode` table, signup verify-then-create, login 2FA,
  forgot/reset password; Resend integration w/ dev-mode fallback; 2-step
  Signup/Login UI + `/forgot-password`. Robust sign-out; ISR for home/research
  + on-demand revalidation; HMAC OTP hashing.

## 2026-06-XX — Backend hardening (Steps 1,3–7)
- **Files:** new `src/lib/env.ts`, `src/lib/api.ts`, `src/lib/ratelimit.ts`,
  `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx`,
  `vitest.config.ts`, `src/lib/__tests__/*`, `.github/workflows/ci.yml`;
  modified all `src/app/api/*` routes, `src/lib/auth.ts`,
  `src/lib/markdown.tsx`, `.env.example`, `package.json`.
- **Hardening:** centralized error handling (Zod→400, P2002→409, P2025→404,
  safe 500); env validation (warn-only) + multi-admin (`ADMIN_EMAILS`);
  Upstash rate limiting w/ no-op fallback (signup/subscribe/admin); real 404s +
  cuid guards on admin routes; fixed slug N+1; `allowDangerousEmailAccountLinking
  =false`; markdown link-protocol XSS guard; error/not-found boundaries.
- **Quality gate:** Vitest (15 tests) + GitHub Actions CI (typecheck→lint→
  test→build).
- **Pending:** Step 2 — Supabase Postgres migration (needs connection strings).

## 2026-06-XX — Analytics & SEO Foundation
- **Files:** new `src/lib/seo.ts`, `src/lib/jsonld.tsx`, `src/components/Analytics.tsx`,
  `src/app/robots.ts`, `src/app/sitemap.ts`; modified `src/app/layout.tsx`,
  `src/app/research/[slug]/page.tsx`, `.env.example`.
- **Added:** robots.txt (disallow /dashboard, /api, /login), dynamic sitemap.xml
  (static routes + published posts), canonical URLs, completed Open Graph +
  Twitter cards, GA4 (env-gated `NEXT_PUBLIC_GA_ID`), Google Search Console
  verification (`NEXT_PUBLIC_GSC_VERIFICATION`), JSON-LD structured data
  (Organization + WebSite site-wide; BlogPosting + BreadcrumbList per article),
  per-article metadata (article OG type, published/modified time, keywords).
- **Env:** `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GSC_VERIFICATION`.
- **Perf:** GA loads `afterInteractive`; sitemap is force-dynamic (no DB at build).
- Backend-phase plan Step 8. No frontend visual changes.

## 2026-06-XX — Memory system + baseline snapshot
- **Files:** added `/docs/{project-state, frontend-roadmap, design-system,
  brand-guidelines, component-registry, changelog}.md`.
- **Note:** Frontend untouched. Captures the deploy-ready baseline as source of truth.

## Baseline (deploy-ready) — summary of work to date
- **Hero:** glass animated eyebrow, "Everything you need to win in Web3.",
  7-badge orbit (WEB3/PERP DEX/DEFI/NFT/RWA/ALPHA/DEX), animated background,
  50K+ members stat.
- **Live data:** market ticker (10 coins, 10s, flash, scroll) via cached
  `/api/ticker`; real BTC+ETH **candlestick** charts with 1D/7D/1M via cached
  `/api/chart` (CoinGecko OHLC).
- **Sections:** Ecosystem pills (Alpha/Web3/Perp DEX/DeFi/NFT); brand-colored
  clickable proof strip + footer socials; About + "SINCE 2019" credibility;
  Products bento + animated visuals (Airdrop "You are eligible"); Ecosystem
  cards (Web3 Academy + TradeKaroVerse); Social; CTA/newsletter; sticky CTA.
- **System:** premium green CTAs w/ shine; gold brand accent; Geist + Geist
  Mono; Lenis smooth scroll; Reveal pop/bounce + heading cascade; glassmorphism;
  responsive container 1200→1320→1480; no em dashes (AI-tell removed).
- **Perf:** server-cached live-data routes (no client rate limits);
  reduced-motion aware; pure-CSS/transform animations.

<!-- Append new entries ABOVE this line, newest first. Template:

## YYYY-MM-DD — <short title>
- Files: ...
- Components: ...
- Design improvements: ...
- Performance improvements: ...
-->
