# Handoff & Continuity Guide

How to resume work on XYZ Crypto from **any** machine, any Claude account, or any
new developer — with zero context loss and zero secret exposure.

**Last updated:** 2026-07-25, after PR #177 (merged). This file is written to be
sufficient on its own — read `CLAUDE.md` first for the 60-second orientation, then
this file for full operational detail. You should not need any prior conversation
history to pick up exactly where the last session left off.

---

## 1. Resume from a new Claude account (3 steps)

1. **GitHub access** — the new account's Claude Code must be connected to GitHub
   with access to `xyzcrypto/SWARM-ROLE` (repo Settings → Collaborators, or the
   GitHub App's repository access list, if it isn't your own account).
2. **Open a session** on the repo: [claude.ai/code](https://claude.ai/code) → new
   session → select `xyzcrypto/SWARM-ROLE` (or `claude` in a local clone).
3. **First message to send:**
   > Read CLAUDE.md and docs/HANDOFF.md, then continue from "Current state" in
   > CLAUDE.md and section 7 ("Where things stand right now") below.

That's it — `CLAUDE.md` is auto-read by Claude Code at session start, and this
guide fills in operations. The docs are written so no chat history is required.

**Note on the other `docs/*.md` files** (`project-state.md`, `backend-state.md`,
`frontend-state.md`, `component-registry.md`, `frontend-roadmap.md`): these were
written at various earlier points in the project and have **not** been kept
current — some reference stale branch names, an old logo filename (`logo.jpg`,
actual file is `logo.png`), and a "Next: Community Chat" roadmap item that has
long since shipped. Treat `CLAUDE.md` + this file + the actual code as the source
of truth; the others are historical snapshots, useful for deep background but not
guaranteed accurate. `docs/changelog.md` (newest-first) is accurate and is the
best single place to see exactly what shipped and why, in chronological detail.

---

## 2. Branch & release model

| Thing | Value |
|---|---|
| Production branch | `main` (auto-deploys via Vercel Git integration) |
| Work branch (this session's default) | `claude/xyz-crypto-web3-site-BuytL` — reset to fresh `origin/main` at the start of every new task (see gotcha below) |
| CI | `.github/workflows/ci.yml`: prisma generate → typecheck → lint → test → build |
| Restore point | branch **`backup/v1.1-profiles`** (Profiles release snapshot) |
| Roll back | `git checkout -b restore backup/v1.1-profiles` → PR → merge |

Take a new `backup/<name>` branch (or ZIP via `git archive`) before each major phase.

### ⚠️ Git gotcha learned the hard way: stale pre-squash branch tip
This repo squash-merges every PR into `main`. The **feature branch's remote copy**
is never fast-forwarded to match the squash commit — its tip stays at the old
pre-squash local commit. The very next time you push new work from a fresh
`git checkout -B <branch> origin/main`, a plain `git push` will be **rejected as
non-fast-forward**, because your local branch (correctly based on the new squashed
`main`) has "rewritten" history relative to the stale remote tip.

**This is expected, not a real conflict.** Verify safety, then force-push:
```bash
git fetch origin <branch-name>
git diff origin/<branch-name> <latest-squashed-main-sha> --stat   # MUST be empty
git push --force-with-lease -u origin <branch-name>               # safe once diff is empty
```
If the diff is *not* empty, do not force-push blindly — that means the remote
branch has real unmerged work; investigate before overwriting anything.

### Rule for starting ANY new task on this repo
Always begin with:
```bash
git fetch origin main
git checkout -B claude/xyz-crypto-web3-site-BuytL origin/main
```
Never build new commits on top of a stale local branch tip left over from a
previous (already-merged) task — that caused a real merge conflict once (see
`docs/changelog.md`, PR #136 era) and cost real time to untangle.

### If a PR needs to stay unmerged for review
Some requests explicitly ask for a PR that is opened but **not** auto-merged
(design previews, or when the owner wants to eyeball Fast Origin Transfer /
architecture changes before committing). In that case:
- Still open the PR against `main`, still run the full verify pipeline, still
  push a real Vercel preview link.
- Do **not** call the merge tool until the owner explicitly says "merge" (or
  clearly equivalent) in a later message — a CI-green PR is not implicit
  permission to merge when the owner asked to review first.
- If the owner says "don't merge" and later work needs to build on top of that
  PR's branch, remember the branch is genuinely ahead of `main` until it merges —
  don't silently discard it by resetting to `origin/main` without checking.

---

## 3. Secrets & environment — SECURITY RULES

**Rule 1: secrets never live in the repo, docs, chats, or commits. Names only.**
**Rule 2: real values live ONLY in the provider dashboards** (Vercel project →
Settings → Environment Variables is the canonical store for runtime).

| Env var | Needed for | Without it | Value lives in |
|---|---|---|---|
| `DATABASE_URL` | All DB access (**must end `?pgbouncer=true`**) | Site 503s on DB pages | Vercel ← Supabase → Database → Connection (pooled, port 6543) |
| `DIRECT_URL` | Migrations only (port 5432) | `db:push`/migrate fail | Vercel ← Supabase (direct connection) |
| `NEXTAUTH_SECRET` | Sessions/JWT + OTP hashing | All auth breaks | Vercel (generate: `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Auth callbacks | Wrong callback URLs | Vercel (the prod URL) |
| `ADMIN_EMAILS` | Admin promotion on signup | No admin dashboards | Vercel (comma-separated emails) |
| `GOOGLE_CLIENT_ID/_SECRET` | Google sign-in (optional) | Google button hidden | Vercel ← Google Cloud Console OAuth |
| `UPSTASH_REDIS_REST_URL/_TOKEN` | Rate limits (optional) | Limits become no-ops | Vercel ← Upstash console |
| `RESEND_API_KEY`, `EMAIL_FROM` | OTP emails (optional) | Codes log to server console | Vercel ← Resend dashboard |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Image uploads (optional) | Uploads return 501 (URL-paste fallback still works) | Vercel ← Supabase → API keys |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Realtime (chat presence, live updates) (optional) | Falls back to 10s polling everywhere realtime is used | Vercel ← Supabase → Settings → API (anon key is public-safe) |
| `GROQ_API_KEY` | **XYZ AI** assistant + news briefings + chat auto-moderation (optional) | AI features no-op (503, launcher shows "not configured") | Vercel ← Groq console (console.groq.com/keys) — free, no card |
| `CMC_API_KEY` | **Markets** hub CMC enrichment (optional) | /markets still works from free sources | Vercel ← coinmarketcap.com/api (free tier) |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GSC_VERIFICATION` | SEO/analytics (optional) | Wrong canonical / no GA | Vercel |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error monitoring (optional) | Sentry no-op | Vercel ← Sentry project |
| `CRON_SECRET` | Protects `/api watchdog` and scheduled cron endpoints | Endpoint stays open (still gated by other checks) | Vercel (generate: `openssl rand -hex 32`) |
| `SEED_ADMIN_PASSWORD` | `npm run seed` only | Insecure default `changeme123` — **always set, change after first login** | Local shell only |

Every optional integration **degrades gracefully** when unset — the app never
crashes from missing env. Local dev: copy names into `.env` (gitignored).

---

## 4. Database migrations — current status

**Migrations now auto-apply on every deploy.** `package.json`'s `vercel-build`
script (`prisma generate && prisma db push --skip-generate (best-effort) && next
build`) runs on every Vercel deploy, so the production schema syncs automatically
whenever new columns/tables are additive. **Given how many PRs have merged to
`main` since migrations 28–30 were introduced, they have almost certainly already
auto-applied in production** — do not assume they're pending without checking
first (`SELECT to_regclass('"SharedCard"')` etc. in Supabase SQL Editor, or just
try the feature and see if it 503s).

If you ever need to force a migration through *immediately*, without waiting for
the next deploy:
```bash
npm run db:push       # with prod DATABASE_URL + DIRECT_URL set locally
npm run seed           # only if you also need seed data / admin backfill
```
Or paste the relevant idempotent SQL (below, and in `prisma/migrations/N_*/migration.sql`)
directly into Supabase → SQL Editor. All migration SQL in this repo is written
`IF NOT EXISTS` / wrapped in `DO $$ ... EXCEPTION WHEN duplicate_object$$` —
**safe to run more than once, safe to run out of order relative to `db push`.**

### Full migration list (0 → 30), newest three detailed
Migrations 0–27 cover: performance indexes, profiles, community chat + reactions
+ replies + editing + polls/pins, admin permissions + What's New, analytics/page
views, notifications, saved stories, news likes/comments, direct messages,
profile socials, watchdog runs, push notification prefs, follows, trading
journal (trades/fills/revisions), risk profiles, challenges, XP events. Each has
its own `prisma/migrations/N_name/migration.sql` — read the relevant one before
touching a feature you haven't worked on yet, rather than guessing the schema.

**28 — `SharedCard`** (short-link backing store for shareable tool results, e.g.
the points-value calculator's share card):
```sql
CREATE TABLE IF NOT EXISTS "SharedCard" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "SharedCard_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SharedCard_kind_createdAt_idx" ON "SharedCard"("kind", "createdAt");
```

**29 — `ChallengeDayNote`** (a Journal Challenge participant's own per-day
reflection note + mood; day P&L is derived from linked trades, never stored here):
```sql
CREATE TABLE IF NOT EXISTS "ChallengeDayNote" (
    "id" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL, "day" TEXT NOT NULL,
    "note" TEXT, "mood" TEXT, "challengeId" TEXT NOT NULL, "userId" TEXT NOT NULL,
    CONSTRAINT "ChallengeDayNote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChallengeDayNote_challengeId_userId_day_key" ON "ChallengeDayNote"("challengeId", "userId", "day");
CREATE INDEX IF NOT EXISTS "ChallengeDayNote_challengeId_userId_idx" ON "ChallengeDayNote"("challengeId", "userId");
-- + FK to Challenge(id) and User(id), both ON DELETE CASCADE (see migration file for the wrapped ALTER statements)
```

**30 — `JournalActivity`** (a public, aggregate-only log of Journal actions,
powers the "Journal Activity" section on public profiles — dollar amounts are
never stored here by design, only type/title/win-or-loss):
```sql
CREATE TABLE IF NOT EXISTS "JournalActivity" (
    "id" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL, "title" TEXT NOT NULL, "win" BOOLEAN, "userId" TEXT NOT NULL,
    CONSTRAINT "JournalActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "JournalActivity_userId_createdAt_idx" ON "JournalActivity"("userId", "createdAt");
-- + FK to User(id) ON DELETE CASCADE
```

### Supabase Storage (profile photo uploads)
Avatar/cover uploads need Storage configured, **else they return 501** ("Image
upload is not configured") and the uploader falls back to its "Use a link"
(paste image URL) option — this fallback works today without any setup.
1. Vercel env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (and
   `SUPABASE_STORAGE_BUCKET` if not the default `post-covers`).
2. Supabase → Storage → create a **public** bucket named `post-covers`.
3. `next.config.mjs` already allowlists `**.supabase.co`, so saved photos render.

### Verify everything works (run before and after every change)
```bash
npm ci && npx prisma generate
npm run typecheck && npm run lint && npm run test && npm run build
```
All four must pass — same gates as CI (`.github/workflows/ci.yml`).

---

## 5. Architecture map (quick reference — see `docs/api-reference.md` and
`docs/backend-state.md` for exhaustive endpoint lists, though treat both as
possibly-stale per the note in section 1)

**Stack:** Next.js 16.2 (App Router, React 19) · TypeScript · Tailwind · framer-motion ·
Prisma → Supabase Postgres · next-auth (JWT) · Upstash rate-limits · Resend
email · Supabase Storage · Sentry · Vercel hosting. Fonts: Geist Sans (body/UI,
via the `geist` npm package) + Geist Mono (data/eyebrows) + **Fraunces** (a
warm serif, `next/font/google`, scoped ONLY to the homepage hero's main
headline via its own `--font-fraunces` CSS variable — not the shared
`font-display` Tailwind class, which stays Geist Sans everywhere else, per an
explicit owner decision after an earlier site-wide pass was reverted).

**Major product surfaces:** homepage (hero + orbital ecosystem centerpiece +
About/Products/Ecosystem/Social/FAQ) · `/markets` (live prices, coin detail,
protocol detail pages) · `/tools` (calculators + DEX registry + Trading
Journal: trades/analytics/risk/challenges, premium-tiered, shareable result
cards) · `/research` (articles, premium-gated) · `/news` (aggregated feed, AI
briefings, likes/comments, saved stories, push notifications) · `/community`
(realtime chat with reactions/replies/polls/pins - anonymous visitors get a
read-only cached preview, logged-in members get the full live room) ·
`/messages` (1-on-1 DMs) · profiles (`/u/[handle]` public + `/settings`
private, public Journal Activity feed) · `/dashboard` (admin: analytics,
moderation, membership, access control, What's New) · auth (`/login`
`/signup` `/forgot-password`) · `/terms` `/privacy` `/contact` (static/ISR).

**XYZ AI** — an in-product assistant (floating launcher, all signed-in
members), Groq-hosted (`llama-3.3-70b-versatile`), grounded only in
public title+excerpt of premium articles (never leaks paid bodies). Same
Groq key also powers news article summaries/briefings and chat
auto-moderation (fail-open on any error/timeout/quota).

**Key libs (`src/lib/`):** `api.ts` (`ok`/`fail`/`handleError`/`getSessionUser`/
`getAdminSession`) · `auth.ts` (NextAuth options) · `ratelimit.ts` (Upstash,
keyed buckets) · `otp.ts` (HMAC-hashed 6-digit codes) · `email.ts` (Resend,
console fallback) · `storage.ts` (Supabase upload) · `profile.ts` (zod schemas)
· `env.ts` (**all** env access goes through here) · `chat.ts` (chat payload
shaping + `CHAT_PAGE_SIZE`) · `seo.ts`/`jsonld.tsx`.

**API convention:** every route follows `rateLimit → zod → auth gate → prisma
→ handleError`. Public GET routes that are polled on an interval or hit
frequently by anonymous visitors should set `Cache-Control` explicitly (the
recipe used throughout: `NextResponse.json(data, { headers: { "Cache-Control":
me ? "private, no-store" : "public, s-maxage=N, stale-while-revalidate=M" } })`
— see `api/ticker`, `api/news/social`, `api/chat/messages`,
`api/journal/share/activity/[userId]` for live examples). This pattern exists
specifically because of the Fast Origin Transfer investigations below — **default
new polled/public GET routes to having this from day one**, don't wait for a
usage-limit scare to retrofit it.

---

## 6. Conventions (match these — don't invent new patterns)

- Server pages fetch + serialize (Dates → ISO) → pass to a `"use client"`
  component.
- Design tokens: `gold-*`, `mint-*`, `ink-*`; surfaces `.glass`/`.surface`;
  buttons `btn-primary`/`btn-gold`/`btn-ghost`/`btn-secondary`; reveal
  animations via `<Reveal>` (`src/components/Reveal.tsx` — variants: `up`,
  `pop`, `fade`, `blur`, `left`, `right`, `scale`); text `text-gold-gradient`,
  `text-shine` (bold gold gradient sweep, for ONE accent phrase per heading —
  don't overuse), `text-shimmer` (quieter, slower near-white sweep, added for
  the hero headline's non-accent words so the whole line reads as
  continuously alive without competing with `text-shine`). Inputs: see
  `Field` in `LoginForm.tsx`.
- **`background-clip: text` gotcha** (real bug hit this session): applying a
  gradient-clip text class to a *wrapper* element does NOT paint through to
  nested inline children that don't have their own text content directly on
  the wrapper — apply the class to each leaf text node/span individually, not
  the parent, or words other than the ones with their own override will
  render invisible. See `Hero.tsx`'s `HeroWord` component for the fixed
  pattern.
- Never expose user emails publicly (use `maskEmail`); never put secrets in
  code or docs (env names only — values live in Vercel/Supabase dashboards).
- Animations must respect `prefers-reduced-motion` **only for the truly heavy,
  purely-decorative full-screen loops** (mesh blobs, aurora, background
  particles, starfield twinkle/drift, Saturn/Moon bob). As of this session,
  the ticker marquee, `.text-shine`/`.text-shimmer`, shooting stars, and the
  entire Icons3D system (`.i3d-*` classes used across About/Products/Markets/
  News/Premium) are **deliberately exempted** from `prefers-reduced-motion`
  — they're treated as core brand identity, not decoration, after repeated
  owner reports that the site looked "static" (root cause: `prefers-reduced-
  motion: reduce` active in the test environment/browser, which is not always
  a conscious user choice — some environments default to it). If you add a
  new decorative CSS `animation`, default it to being **exempted** from
  reduced-motion unless it's a genuinely heavy full-screen ambient effect —
  check `globals.css`'s `@media (prefers-reduced-motion: reduce)` block
  before assuming a new effect needs to be added there.
- One-shot entrance/reveal animations (anything driven by framer-motion
  `initial`/`animate`/`whileInView`, as opposed to an infinite CSS
  `animation`) are never gated on reduced-motion at all — this was a
  pre-existing, still-valid convention (JS-driven mount transitions read as
  "meaningful UI motion," not decoration).
- lucide-react v1 has no Twitter/Github icons — use
  `src/components/BrandIcons.tsx`.
- No em dashes in any user-visible copy (established brand-voice rule, see
  changelog "NX3" entry) — this document itself isn't user-visible copy so
  it's exempt, but anything shipped into the product UI must avoid them.

---

## 7. Where things stand right now (newest sessions last; latest 2026-07-25)

This section is a chronological summary of everything shipped in the most
recent working session, in case the changelog is too long to read in full.
PRs referenced are all merged to `main` unless noted "not merged."

1. **Terms of Service + Privacy Policy** (`/terms`, `/privacy`) — real,
   product-specific pages (not boilerplate), linked from the footer and the
   signup consent line. Both carry a visible "not yet incorporated / consult
   a lawyer" disclaimer since the company isn't formally registered yet
   (owner hasn't decided on incorporation jurisdiction — see the startup-guide
   PDF delivered earlier in the session, kept outside the repo in scratch,
   not part of the codebase). Grievance Officer contact uses the existing
   public support email; a named individual will be added post-incorporation.

2. **Fixed a real production regression**: homepage icon animations and the
   ticker went fully static for some visitors after a deploy. Root cause,
   confirmed by direct reproduction: a stale cached page can reference a JS
   chunk hash that no longer exists on the current deployment → 404 (served
   as HTML) → browser correctly refuses to execute HTML as a script (MIME
   mismatch) → hydration silently never finishes → every client-side
   animation and the ticker's data-fetch stays inert, while pure-CSS
   animations keep running (no JS needed). Fixed via: service worker cache
   version bump (`public/sw.js`), proactive SW update-check on tab focus, and
   a guarded one-time hard reload when a stale-chunk failure is detected
   (`PwaSetup.tsx` — capture-phase `error` listener, since resource-load
   failures like a `<script>` 404 only propagate on the capture phase, not
   bubble). Also added CryptoCompare as a third ticker upstream (`CoinGecko →
   Binance → CryptoCompare → last-known-good → seed fallback`) since
   Binance.com geo-blocks the US and other jurisdictions (HTTP 451), a real
   risk given Vercel's default serverless region.

3. **A second, unrelated regression, same symptom, different cause**: after
   the above shipped, the owner still reported the About/Products icons and
   hero shooting stars looking static. Root-caused via Playwright's
   `reducedMotion` emulation: those elements were correctly implementing
   `prefers-reduced-motion: reduce` support, but the test/owner's browser
   environment had that OS-level setting active (not necessarily a
   deliberate accessibility choice). Fixed by removing those specific
   elements from the reduced-motion disable list. When the owner then
   reported the ticker AND text-shine still static on the *next* check, the
   entire reduced-motion animation-disable block was removed (see the
   convention note in section 6) — everything except `scroll-behavior: auto`
   now plays regardless of that OS preference.

4. **Vercel Fast Origin Transfer reduction** (owner is on the free 10GB/month
   tier, usage was climbing toward the limit — goal: comfortably last another
   4-5 months). Three rounds so far:
   - `/research/[slug]` converted from `force-dynamic` to ISR
     (`revalidate=300`, was 60) — `getServerSession()` is now only called
     when `post.premium` is true, so free-post renders never touch a Dynamic
     API and are CDN-cacheable; premium posts stay fully dynamic (never
     cached, so premium content can never leak into a shared cache).
   - `/api/news/social`, `/api/journal/share/activity/[userId]`, and
     `/api/chat/messages` all now set `Cache-Control` — each was being
     polled frequently with no caching at all, and each has a response that
     is identical across anonymous visitors for a given key (url/userId/
     cursor), so they're now `public, s-maxage=N` for anonymous requests and
     `private, no-store` when personalized (logged-in) data is involved.
   - ISR windows lengthened on `research/[slug]` (60→300s), `research` hub
     (120→300s), `u/[username]` (60→300s) — these pages only actually change
     via an explicit edit that already calls `revalidatePath`, so a short
     time-based window was buying nothing but extra origin re-renders.
   - **Deliberately NOT done** (flagged as a future candidate, higher risk):
     `/community`'s own `force-dynamic` render, which also unconditionally
     calls `getServerSession()` even for anonymous visitors. Fixing it
     properly means moving poll-vote/`me` personalization out of the
     1744-line `ChatClient.tsx` into a client-side fetch (mirroring the
     `LikeButton` self-correction pattern already used elsewhere) — judged
     too large/risky a refactor to bundle into a caching pass. If FOT
     pressure returns, this is the next lever to pull.
   - `news/read/page.tsx` is dynamic only because it reads `searchParams`
     (share-link tokens), not a Dynamic API — low traffic, would need a
     route-param refactor (`/news/read/[token]`) to unlock ISR. Deferred.

5. **Premium hero redesign** (went through two rounds of owner feedback,
   final state merged as PR #142): the homepage hero headline
   ("Everything you need to win in Web3.") now uses **Fraunces**, a warm
   serif, scoped only to that one headline (an earlier attempt applied the
   new font site-wide via the shared `font-display` class and was explicitly
   reverted per owner feedback — every other heading is back to Geist Sans).
   The headline reveals **word-by-word** on page load (each word/chunk is
   its own `motion.span` with a staggered blur-in), and the whole line now
   has a continuous, slow ambient shimmer (`.text-shimmer`) on top of the
   entrance animation so it keeps feeling "alive," not just during the
   one-time reveal — the accent phrase "win in Web3." keeps the stronger,
   pre-existing gold `.text-shine` for emphasis. See the `background-clip:
   text` gotcha in section 6 if touching this again.

**Net result:** `main` is fully green (typecheck/lint/test/build), all
animation regressions are fixed and verified via direct computed-style
sampling (not just screenshots), the legal pages are live, and three rounds
of Fast Origin Transfer work have shipped. The most recent PR (#145) was
merged after the owner explicitly reviewed it live rather than auto-merging —
this signals a shift this session toward wanting a look before merge for
anything touching shared infrastructure or visual identity, worth defaulting
to for similar future requests unless told otherwise.

### 2026-07-17 — Security hardening + ISR Writes fix + desktop perf trims

**Security hardening pass** (owner asked for real fixes, not a report — all in
`src/lib/auth.ts` + `src/lib/ratelimit.ts` and the two auth `start` routes):
- **Login timing oracle closed**: "no such account", "account locked", and
  "wrong password" now all cost the same by running a dummy `bcrypt.compare()`
  against a fixed never-matching hash on the two fast-fail paths, so response
  latency no longer leaks whether an account exists. (This fix is what later
  caused the Fluid Active CPU overage — see the 2026-07-19 section below — so
  the two must be read together.)
- **Login-lockout race fixed**: the failed-attempt counter was a read-then-write
  (`fails = count + 1`), so N concurrent failed logins could all read the same
  start value and only advance it by 1, bypassing the 5-attempt lockout. Now a
  single atomic Prisma `{ increment: 1 }` (Postgres row-locks it).
- **IP-spoof bypass closed**: `clientIp()` now prefers `x-vercel-forwarded-for`
  (set by Vercel's edge, not client-settable) over the spoofable
  `x-forwarded-for`, so every IP-keyed limiter can no longer be defeated by
  rotating a client-set header.
- **New `otpEmail` limiter** (3 per 10 min, keyed by target email, independent
  of the IP-keyed limiters) wired into `api/auth/signup/start` +
  `api/auth/password/start` to stop email-bombing one address via IP rotation.
  Also added a `rateLimit()` on the signup OTP-verify path in `authorize()`.
- **Flagged, NOT auto-fixed** (needs owner go-ahead): `npm audit` shows 8 real
  CVEs in the Next.js dependency tree, all requiring `next` 14.2.35 → 16.2.10
  (two majors) — too large a blast radius for a hardening pass. See §8.

**ISR Writes fix** (owner hit 75% of the 200K/month quota; exceeding it pauses
the whole site): several hot routes had a `revalidate` window matched almost
exactly by a client poll of the same length, so the ISR cache regenerated as
fast as the code could trigger it (`/api/ticker` at a 10s window + 10s poll was
the single largest contributor, ceiling ~259K/month alone). Lengthened windows
and realigned the matching client polls across `ticker`, `news`/`news-fetch`,
and the `markets/*` routes (coins/perp/global/coin[id] + `/markets/[id]`), and
updated every `Cache-Control` header to match. No `revalidatePath()` call site
was a meaningful contributor (all admin-gated-rare or self-service rate-limited).

**Desktop perf trims**: `<NavActivity />` was mounted **twice** in `Navbar.tsx`
(once in the `hidden md:flex` desktop wrapper, once in `flex md:hidden` mobile) —
Tailwind `hidden` only toggles CSS `display`, not React mount state, so both
copies polled + held a realtime subscription at every viewport. Now a single
shared instance. Also: `PageBackground` bounded `absolute inset-0` → `h-screen`
(its blur layers were stretching the full scroll height of long pages); desktop
`.mesh`/`.aurora` base blur radii trimmed (96→70px, 62→45px); `priority` added
to the first research-grid image so the above-the-fold card isn't lazy-loaded.

### 2026-07-17/18 — Sodex added to the Points/Airdrop Value Calculator

Added **Sodex** (SOSO token, SoPoints program) as a preset platform on `/tools`,
via the existing registry-driven pattern (`src/lib/dex-registry.ts`) — no
component or share-flow code changed. A same-session owner-caught bug fix
followed: the first entry conflated the 150M-token SoPoints **pool size** with
SOSO's real 1B **total supply**, so the "Total token supply" field showed the
wrong number and skewed the implied price wildly. Corrected the data model
(`totalSupply` = real 1B, pool expressed as 15% via `allocationPctOfSupply`) and
added one-click `allocationScenarios` quick-select buttons (100%/50%/30% pool),
purely additive so every other platform renders identically.

### 2026-07-18/19 — Hobby-plan cost passes (two rounds)

**Round 1 (audit, no feature loss)**: deduped `MarketTicker`/`LiveMarketVisual`'s
independent `/api/ticker` polls into one shared hook (`useTickerPoll.ts`),
removed a self-fetch in `push/dispatch` that doubled its Function Invocations
per cron tick, dropped a redundant `vercel.json` native cron, parallelized
`/journal`'s two Prisma queries and gave it a `loading.tsx`. Full detail in
`docs/changelog.md`'s 2026-07-18 entry.

**Round 2 (explicit feature-downgrade request)** — the owner asked which
features could be traded for lower cost, then asked to ship all of them:
Tools replaced Markets in the mobile bottom nav; **Voice Rooms removed
entirely** (LiveKit deps + routes + docs deleted, reinstate from git history
if revisited on a paid plan); push-dispatch + watchdog GitHub Actions crons
**paused** (`schedule:` commented out, `workflow_dispatch:` kept for manual
runs — re-enable when off the free plan); the News AI briefing is now
manual-trigger instead of auto-firing on story open; ticker/news/markets poll
intervals widened (60-120s → 90-180s); **every realtime/presence hook now
shares one Supabase client** (`src/lib/realtimeClient.ts`) instead of each
opening its own WebSocket connection — this was the biggest single lever
found, since a page could previously open 2-4 redundant connections to the
same project; and `/community` now gives anonymous visitors a cached
read-only preview (`CommunityPreview.tsx` + `getCommunityPreview()`) instead
of the full live room, resolving the `/community` ISR item from section 8
below via a narrower, lower-risk path (branch on session presence rather
than refactoring `ChatClient.tsx`'s personalization out). Full detail +
complete file list: `docs/changelog.md`'s 2026-07-19 entry.

### 2026-07-19 — Free-tier overage fixes (Fluid CPU / ISR Writes / FOT) + signup-drift fix + email removal

The owner's Vercel dashboard showed **"Exceeded free resources"**: Fluid Active
CPU 6h23m/4h (already over), ISR Writes 161K/200K, Fast Origin Transfer
9.07/10GB. Three parallel root-cause fixes:
- **Fluid Active CPU (the urgent one, and a direct regression from the 07-17
  security fix)**: the dummy `bcrypt.compare()` added on every failed login to
  close the timing oracle costs ~317-352ms of *synchronous* CPU per call —
  `bcryptjs` is pure-JS (this repo doesn't use native `bcrypt`) so it can't
  offload to a threadpool, and Fluid Compute bills synchronous CPU. The login
  limiter was keyed only by email, so a bot rotating fake emails from one IP was
  barely throttled while still forcing a full bcrypt op each time. **Fix**: a
  genuine per-IP limiter (`loginIp`, 20/min/IP) checked *before* any bcrypt work
  runs, alongside the existing per-email `login` limiter. Needed
  `clientIpFromHeaders()` in `ratelimit.ts` since NextAuth's
  `authorize(credentials, req)` passes a plain headers record, not a `Headers`.
- **ISR Writes**: confirmed the 07-17 fix is working (rate roughly halved; the
  161K figure is mostly the old pre-fix rate earlier in the billing cycle).
  Found one missed route — `/api/markets/search`, still `revalidate = 60` and
  keyed by an arbitrary user-typed string (high cardinality) — lengthened to
  300s with matching `Cache-Control`.
- **Fast Origin Transfer** — a new, previously-uncaught contributor:
  `uploadImage()` (`src/lib/storage.ts`) falls back to storing an avatar/banner
  as a raw base64 `data:` URL (up to ~700KB) **directly in the DB** when
  Supabase Storage is unconfigured/fails, and that field was being selected raw
  in six hot, high-fan-out read paths (every chat message author, DM partner,
  post comments, follow lists, public profile + article pages). One active user
  with a large inline avatar could be a multi-hundred-MB/month contributor,
  invisible in payload-shape review since it's "just a string." **Fix**: added
  `stripInlineImage()` (`src/lib/utils.ts`, turns a `data:` image into `null` —
  client already falls back to initials) and applied it at all six read paths.
  **Owner action still open** (flagged, not code-fixable): a one-time read-only
  prod DB check for how many users actually hit this fallback — see §8.

**Signup silently failing on schema drift, made loud** (`src/lib/auth.ts`): the
owner noticed no new signups for a while and hit a "Database not migrated"
error on `/forgot-password`, confirming the prod DB had drifted behind
`schema.prisma` (the `vercel-build` `db push` is best-effort/non-fatal, so a
failed run persists silently). The signup-completion branch's
`prisma.user.findUnique` had no explicit `select`, so it fetched every column;
a missing column threw, NextAuth turned that into the same generic "incorrect or
expired code" the client shows for a real bad code, and since `verifyCode()`
already deleted the one-time code, the user was stuck in an unrecoverable loop
with no row ever created and nothing in the logs. **Fix**: both DB touches now
catch P2021/P2022, report to Sentry (tagged `area: signup-completion`) + console,
then return `null` — same safe behavior, now loud. This does **not** repair
already-drifted prod data (that needs a real migration re-run — owner action, §8).

**Hardcoded personal email removed** (`.env.example`, `src/lib/env.ts`): the
owner's real Gmail was hardcoded as `ADMIN_EMAIL` in `.env.example` and as
`VAPID_SUBJECT`'s fallback in `env.ts` — publicly documenting exactly which
inbox auto-promotes to ADMIN. `.env.example` now uses a generic placeholder;
`VAPID_SUBJECT` falls back to the site's public support address (`site.email`)
since `web-push` throws on an empty subject. Also regenerated `.env.example`,
which was 17 vars behind `env.ts` (GEMINI/AI_PROVIDER_ORDER/AI_DAILY_LIMIT_*,
CMC, GIPHY, the VAPID trio, CRON_SECRET, TELEGRAM_*, and the now-removed
LIVEKIT_* — all added or, for LiveKit, dropped alongside the voice removal).

### 2026-07-23 — Next 14 → 16 + React 18 → 19 (PR #158)

The upgrade that had been deferred since 07-17 as "too large a blast radius".
It turned out far smaller than feared, because **next-auth did not need
replacing**: v4 (4.24.15) now lists `next ^15||^16` and `react ^19` as peers, so
there was no Auth.js v5 rewrite and `getServerSession(authOptions)` is unchanged.
- **Deps**: next 14.2.35 → 16.2.11, react/react-dom 18 → 19, @sentry/nextjs →
  10.67, `@react-three/fiber` 8→9 + `@react-three/drei` 9→10 (React 19 forces
  these), eslint 8 → 9 + eslint-config-next → 16.
- **Code**: the official `next-async-request-api` codemod awaited
  `params`/`searchParams` across 31 files (there were no `cookies()`/`headers()`
  call sites, so that part was free); `/api/news`'s `revalidate` had to become a
  literal (Next 16 rejects a non-literal segment config export);
  `experimental.instrumentationHook` removed; tsconfig auto-set `jsx: react-jsx`.
- **Lint**: Next 16 removed `next lint`, so the project moved to an ESLint 9 flat
  config (`eslint.config.mjs`, script `eslint src`). This is what surfaced the
  react-hooks v6 warnings dealt with two days later.
- **The R3F/drei major bump is compile-only**: `useWebglGate()` is hardcoded
  `false`, so the three.js scene never renders in production and only needs to
  typecheck. The live centerpiece is the CSS `OrbitalEcosystem`.
- Cleared all 14 Next.js framework CVEs. Full detail: `docs/changelog.md`.

### 2026-07-23/24 — Product + security work from other sessions (#159-#167, #169, #170)

Landed in the same window but not part of the framework/infra thread above -
listed here so this section isn't misleading about what moved. See
`docs/changelog.md` for the detail on each:
- Admin post editor **rebuilt on Tiptap** (#165) after a run of typing/cursor/
  toolbar regressions (#161, #163, #164), plus a fix for published posts showing
  literal `{c:...}` colour syntax (#169).
- **Premium visual identity** across profile/feed/comments (#166), profile photo
  lightbox and the root-caused Markets Overview mobile overflow (#167).
- Mobile nav/menu fixes and footer restructure (#160), bottom-nav swap + DM
  scroll fixes (#162), RiseX added to the points calculator (#159).
- **Security audit fixes (#170)** - a DM realtime leak, a profile XSS, and a push
  IDOR. Worth reading before touching DMs, profile rendering, or push.

### 2026-07-24/25 — Sentry client monitoring restored, CSP tightened, pre-merge checks, react-hooks cleanup

1. **Client-side Sentry was silently dead, and had been for longer than the
   upgrade** (#168, #171). Two separate faults, found in that order:
   - Next 16 builds with **Turbopack**, which never loads `sentry.client.config.ts`
     - that file was only ever picked up by Sentry's *webpack* plugin. So the
     browser `Sentry.init()` stopped running at the 14→16 upgrade. Fixed by moving
     it to `src/instrumentation-client.ts` (the Turbopack-native entrypoint) and
     adding `onRouterTransitionStart`; the old file was deleted to avoid a
     double-init. Also dropped the deprecated `disableLogger`, whose replacement
     is webpack-scoped and inert under Turbopack.
   - Even with init fixed, events still couldn't leave the browser: the SDK POSTs
     envelopes via `fetch()` to the DSN's ingest host, and **`connect-src` never
     allowed a Sentry host** (`git log -S "sentry.io"` on `next.config.mjs`
     returns nothing). So client-side Sentry has most likely *never* delivered an
     event in production - the Turbopack regression was masking an older problem.
     Added `https://*.sentry.io` to `connect-src`. Chose the allowlist over
     Sentry's `tunnelRoute` deliberately: tunnelRoute proxies every event through
     a Vercel function, adding Function Invocations.
   - **Still unconfirmed end-to-end**: no sandbox in this environment can reach
     the network, so an event has never been *observed* arriving. Init is proven
     (the DSN compiles into a client chunk) and the CSP is proven (read off the
     served header), and the DSN is set in Vercel. To close it: on the live site,
     `setTimeout(() => { throw new Error("sentry client test"); })` should produce
     an ingest POST and an issue.
2. **`docs/PRE-MERGE-CHECKS.md`** added (#172) - a route-table/cost checklist to
   run *before* merging, since CI proves nothing broke but can't see a page that
   stopped being cached or a new polling loop. It got its first real use an hour
   later on #173.
3. **Dead LiveKit CSP sources removed** (#173) - `*.livekit.cloud` from
   `connect-src`, `mediastream:` from `media-src`, `blob:` from `worker-src`.
   `worker-src 'self'` was **kept**: the PWA service worker needs it. Verified by
   driving four pages with zero CSP violations and the SW still registering.
4. **react-hooks v6 warnings: 73 → 41** across four PRs (#174-#177). `purity` and
   `static-components` are clean and back on **error**; mount-time reads moved to
   `src/lib/useClientFlag.ts` (`useSyncExternalStore`); reset-on-prop-change now
   adjusts during render. Three were real bugs, not lint noise: the starfield
   reshuffled on any re-render, `CommandPalette` remounted its entire results
   list every render, and `ChatClient`'s `touchUi` never updated when a pointer
   device changed. The fetch-on-mount group is a **documented deliberate keep** -
   reasoning lives in `eslint.config.mjs`, summarised in §8.

## 8. Open items / natural next steps
- **Production DB schema drift — signups verified working; other tables still
  unverified.** Confirmed 2026-07-19 (see §7): the prod DB had drifted behind
  `prisma/schema.prisma`, silently starving signups and 503-ing
  `/forgot-password`. **Update (2026-07-19): live signups were verified working
  — a real account was created successfully — so the `User`-table columns the
  signup path touches are now in sync** (whether via a deploy re-running the
  `vercel-build` `db push`, or the drift having only ever affected other
  columns). The remaining open question is whether *other* tables are still
  drifted: verify the rest with `SELECT to_regclass('"...")` per table in
  Supabase, or exercise each feature and watch for a "Database not migrated"
  503 / the Sentry `area: signup-completion` event. If any are, repair by a
  fresh Vercel deploy (the `vercel-build` `db push` retries each deploy) or
  `npm run db:push` locally with prod `DATABASE_URL` + `DIRECT_URL`.
- **Confirm Sentry is actually receiving client events (one-time, ~10 seconds).**
  Two faults were fixed on 2026-07-24/25 (§7): the Turbopack init regression
  (#168) and a `connect-src` that had never allowed a Sentry host (#171). Each
  link is verified independently — the DSN compiles into a client chunk, the
  served CSP header allows the ingest host, and `NEXT_PUBLIC_SENTRY_DSN` is set
  in Vercel production — but **no event has ever been observed arriving**,
  because the agent sandbox has no outbound network. On the live site, open
  DevTools and run
  `setTimeout(() => { throw new Error("sentry client test"); })`: expect a
  successful POST to the ingest endpoint and a matching issue in Sentry, and
  *no* `Refused to connect … violates … connect-src` line in the console. If it
  fails, the console text identifies which link broke.
- **Inline avatar/banner data: URLs in the DB — one-time read-only check.** The
  2026-07-19 `stripInlineImage()` FOT fix stops these from being *served*, but
  doesn't quantify or backfill existing rows. Owner should run a read-only
  `SELECT username, length(image) FROM "User" WHERE image LIKE 'data:%'` in
  Supabase to see if any real users hit the base64 fallback and whether a
  backfill (re-upload to Storage, or clear the field) is worth it.
- ~~**Next.js dependency CVEs — upgrade `next` 14 → 16.**~~ **Done 2026-07-23**
  (next 14.2.35 → 16.2.11, react 18 → 19). All 14 Next.js framework advisories
  are cleared from `npm audit`. What the upgrade actually involved and what's
  left:
  - **Dependency cascade** (smaller than feared): next-auth stayed on v4 (4.24.7
    → 4.24.15 — v4 now lists `next ^15||^16` + `react ^19` as peers, so **no
    Auth.js v5 rewrite**), `@sentry/nextjs` → 10.67, `@react-three/fiber` 8 → 9
    and `@react-three/drei` 9 → 10 (React 19 forces these), eslint 8 → 9 +
    eslint-config-next → 16.
  - **Code migration**: the official `next-async-request-api` codemod awaited
    `params`/`searchParams` across 31 files (no `cookies()`/`headers()` call
    sites existed, so that part was free); one segment-config export
    (`/api/news` `revalidate`) had to become a literal; `experimental.
    instrumentationHook` removed; tsconfig auto-set `jsx: react-jsx`.
  - **Lint**: Next 16 removed `next lint`; migrated to ESLint 9 flat config
    (`eslint.config.mjs`, `eslint src`). The bundled react-hooks v6 adds new
    React-Compiler-era rules — see the react-hooks follow-up item below.
  - **The R3F/drei major bump is compile-only for us.** `useWebglGate()` is
    hardcoded `false` (the three.js orbital scene was disabled earlier — it
    rendered inconsistently and couldn't be CI-verified), so the WebGL scene
    never renders in production; the homepage centerpiece is the pure-CSS
    `OrbitalEcosystem`. The R3F 9 / drei 10 code only needs to typecheck/build,
    which it does — no runtime risk from that bump while the gate stays off.
  - **Verified**: typecheck + lint + 339 tests + `next build` (Turbopack) all
    green, and a headless-Chromium run of the running app confirmed the homepage
    renders and hydrates under React 19 with zero uncaught/hydration errors.
  - **Remaining `npm audit` (NOT the framework CVEs, and CI's audit step is
    `--audit-level=high || true`, non-blocking)**: `sharp`/libvips (2 high, new
    2026 CVEs in the image optimizer's native lib — Vercel-managed at runtime,
    awaiting an upstream sharp patch) and `postcss` (moderate, build-time
    XSS-in-stringify). Track separately; neither is a Next framework advisory.

  *(Original assessment, kept for context — this is what the 14 advisories were
  and why most never applied to this app:)*
  - **Residual exposure is DoS-class only, no data exposure.** The genuine
    matches are the RSC / Server-Component denial-of-service items
    (GHSA-h25m-26qc-wcjf, GHSA-q4gf-8mx6-v5v3, GHSA-8h8q-6873-q5fj — all high
    but availability-only), plus two low/moderate RSC cache-poisoning items
    (GHSA-vfv6-92ff-j949, GHSA-wfc6-r584-vfw7). None expose or corrupt data for
    this app's shape, and Vercel adds its own request limits on top.
  - **Most of the loud/high CVEs do NOT apply to us today**, because the app
    doesn't use the vulnerable feature (or Vercel manages it): SSRF via
    WebSocket upgrades (GHSA-c4j6, 8.6 — no Next-level WS server), Pages-Router
    + i18n middleware bypass (GHSA-36qx, 7.5 — App Router, no i18n, no
    middleware), rewrites request-smuggling (GHSA-ggv3 — no rewrites), the
    CSP-nonce and `beforeInteractive` XSS pair (GHSA-ffhc / GHSA-gx5p — neither
    used), and both `next/image` disk-cache / optimizer DoS items (Vercel-
    managed image pipeline).
  - **The real driver for upgrading is that Next 14 no longer receives security
    backports** — new advisories will keep landing against it and can only be
    fixed by moving to a supported major, independent of whether any single one
    applies today.
  - **Caveat — the "not affected" verdicts are conditional on current code.**
    They flip to *affected* the moment the app adds any of: `middleware.ts`, CSP
    nonces, i18n routing, `next.config` rewrites/redirects, or a custom
    server/WebSocket-upgrade path. Re-audit if any of those land before the
    upgrade ships.
  - Still deferred as its own task (too large a blast radius for a hardening
    pass) — full verify pipeline + a live Vercel preview before merge.
- **react-hooks v6 lint warnings — 73 → 41, largely settled.** eslint-config-next
  16 bundles `eslint-plugin-react-hooks` v6, whose React-Compiler-era rules
  flagged pre-existing patterns that passed CI under Next 14. All five were
  downgraded to **warn** so the framework upgrade wasn't blocked, then worked
  through in three passes (2026-07-25, see `docs/changelog.md`):
  - `purity` 11 → 0 and `static-components` 4 → 0 are clean and **promoted back
    to `error`**, so they can't regress. Several were real bugs: the starfield
    reshuffling on any re-render, and `CommandPalette` remounting its entire
    results list every render.
  - `refs` 5 → 1, `set-state-in-effect` 44 → 33 (mount-time browser reads now go
    through `src/lib/useClientFlag.ts`; reset-on-prop-change now adjusts during
    render). Both of those groups were fixing genuine one-frame artifacts, not
    just lint noise.
  - **Fetch-on-mount is a deliberate keep, not a TODO.** Full reasoning lives in
    `eslint.config.mjs` next to the rule config. Short version: `loading`
    already starts `true`, so the flagged call is a no-op bail-out on mount and
    a correct transition afterwards; no wrong data is ever painted. The rule
    really wants a data layer, and the two ways to give it one are both bad
    trades right now — Server Components would push Function Invocations and
    Fast Origin Transfer *up* (against §7's cost work), and adopting SWR /
    TanStack Query is a repo-wide commitment that should be scoped on its own
    merits. Revisit if we adopt a data library anyway, or if a specific screen
    shows a visible loading flash.
  - Consequence: `set-state-in-effect` stays on `warn`, so a newly-introduced
    instance won't be blocked. Accepted trade.
  - Also deliberately kept: the 2 `@next/next/no-img-element` warnings in
    `PostEditor` — routing those Supabase images through `next/image` would burn
    Fast Origin Transfer and image-optimisation quota (`docs/PRE-MERGE-CHECKS.md`
    Step 2 flags this exact case).
- **Post-upgrade `npm audit` residue (non-framework).** After the 14→16 upgrade,
  `sharp`/libvips carries 2 new 2026 highs (image-optimizer native lib; Vercel-
  managed at runtime, needs an upstream sharp bump) and `postcss` a moderate
  (build-time XSS-in-stringify). Neither is a Next framework advisory; revisit
  when upstream patches land.
- ~~**Harden the GitHub OAuth `profile()` callback — assert `primary &&
  verified` email.**~~ **Addressed 2026-07-20.** `src/lib/auth.ts`'s GitHub
  provider still uses `allowDangerousEmailAccountLinking: true`, but its
  `profile()` callback is now `async(profile, tokens)` and fetches
  `GET /user/emails` (granted by the `user:email` scope the provider already
  requests), keeping only a `primary && verified` address via the new
  `pickPrimaryVerifiedEmail()` helper (`src/lib/utils.ts`, unit-tested). It no
  longer trusts `profile.email` (GitHub's *public* email) for linking; when
  there's no primary+verified address — private-email setting, missing scope, or
  a failed/timed-out lookup — it falls back to the existing
  `gh-<id>@users.noreply.xyzcrypto.io` placeholder, so account-linking can never
  attach to an unverified address. (Was pre-existing since PR #105; the 07-17
  hardening pass did not touch OAuth linking.)
- ~~**`/community` ISR unlock**~~ — addressed 2026-07-19: anonymous visitors
  now get a cached read-only preview instead of the full dynamic room (see
  section 7's 2026-07-18/19 entry). `ChatClient.tsx` itself is unchanged for
  logged-in members, so this was the narrow fix, not the full refactor
  originally scoped here.
- **Incorporation decision** — the owner has an outstanding country-comparison
  writeup (delivered as a scratch PDF, not in the repo) they haven't acted on;
  `/terms` and `/privacy` are explicitly written to be updated once that
  happens (search both files for "not yet incorporated").
- **Cookie consent banner** — assessed as *not currently required* (site only
  uses an essential session/auth cookie, no ad-tracking); revisit if
  analytics/ad-tracking cookies are ever added.
- **Refund/cancellation policy** — deferred until premium paid tiers actually
  launch (currently free-tier only); `/terms` already notes this will follow.
- No other specific next phase was agreed with the owner as of this
  handoff — ask what they want to prioritize next rather than assuming.

---

## 9. Publish this book to GitBook (owner, one-time, ~2 min)
1. [gitbook.com](https://www.gitbook.com) → sign in → **New Space**.
2. Space → **Configure → Integrations → GitHub Sync** → authorize → pick
   `xyzcrypto/SWARM-ROLE`, branch `main`, **root directory `docs/`**.
3. GitBook renders `docs/README.md` as the cover and `docs/SUMMARY.md` as the
   table of contents. Every merge to `main` auto-updates the book.
   Keep the space **private** unless you intend the docs to be public.
