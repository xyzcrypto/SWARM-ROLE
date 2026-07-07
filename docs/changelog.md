# XYZ Crypto — Changelog

Newest first. **Update this after every design change** with: date, files
changed, components changed, design improvements, performance improvements.

---

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
