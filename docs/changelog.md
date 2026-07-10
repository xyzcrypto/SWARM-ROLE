# XYZ Crypto — Changelog

Newest first. **Update this after every design change** with: date, files
changed, components changed, design improvements, performance improvements.

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
