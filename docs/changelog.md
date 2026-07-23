# XYZ Crypto — Changelog

Newest first. **Update this after every design change** with: date, files
changed, components changed, design improvements, performance improvements.

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
