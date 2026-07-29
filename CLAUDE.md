# CLAUDE.md — XYZ Crypto (read me first)

This file is the continuity anchor for any Claude / AI session (from **any**
account) and any human developer. Read this, then `docs/HANDOFF.md`, and you have
full context to continue safely.

## What this is
**XYZ Crypto** — premium Web3 ecosystem site (research hub, market data, user
accounts/profiles, premium content). Dark luxe design: gold + mint on near-black.
- **Stack:** Next.js 16.2 (app router, React 19) · TypeScript · Tailwind · framer-motion ·
  Prisma → Supabase Postgres · next-auth (JWT) · Upstash rate-limits* · Resend
  email · Supabase Storage · Sentry* · Vercel hosting.
  <br>*Don't read this list as "all wired up". **Upstash: ✅ verified live in
  production 2026-07-29** — limiters genuinely enforce (probe + method in
  `docs/HANDOFF.md §8`). Keep the no-op caveat in mind anyway: when `UPSTASH_*` is
  unset, `rateLimit()` returns success unconditionally and every limiter silently
  no-ops. **Sentry: 🔴 still dark** — no DSN in any runtime (browser, server or
  edge), so nothing is reported anywhere. Also dark: **XYZ Sentinel** (`/api/watchdog`)
  — `CRON_SECRET` is unset, so it 403s, and its cron is paused. All: `docs/HANDOFF.md §8`.
- **Owner contact:** niralekhan321@gmail.com

## Commands
```bash
npm run dev          # local dev server
npm run typecheck    # tsc --noEmit
npm run lint         # eslint src (ESLint 9 flat config: eslint.config.mjs)
npm run test         # vitest (unit tests in src/lib/__tests__)
npm run build        # prisma generate + next build
npm run db:push      # sync schema to DB (needs real DATABASE_URL/DIRECT_URL)
npm run seed         # seed admin + sample posts
```
**Definition of done:** typecheck + lint + test + build ALL green before pushing.
CI (`.github/workflows/ci.yml`) runs exactly these on every push/PR.

## Branch / deploy model
- `main` = production → auto-deploys on Vercel. **Never commit to main directly.**
- Work on a feature branch → push → PR → CI green → **squash-merge**.
- Restore points: branch `backup/v1.1-profiles` (+ ZIP with owner). To roll back:
  `git checkout -b restore backup/v1.1-profiles`.

## Architecture map (full detail + current status: docs/HANDOFF.md §5 — treat
docs/api-reference.md and docs/backend-state.md as possibly-stale background,
not authoritative; HANDOFF.md is kept current)
**Pages:** `/` (ISR 300) · `/research` (ISR 300) · `/research/[slug]` (ISR 300 for
free posts — `getServerSession()` only called when `post.premium`, so free posts
are CDN-cacheable and premium posts stay fully dynamic/never cached) ·
`/u/[username]` (ISR 300 + revalidatePath on edit) · `/settings` (dynamic, auth) ·
`/dashboard` (dynamic, ADMIN) · `/community` (dynamic — known Fast Origin Transfer
lever if usage climbs again, see HANDOFF §7) · `/tools`, `/markets`, `/news`,
`/messages` (mixed ISR/dynamic per sub-route) · `/login` `/signup`
`/forgot-password` `/terms` `/privacy` `/contact` (static).

**API routes** (all follow: `rateLimit → zod → auth gate → prisma → handleError`):
auth (signup/start, password/start+reset, [...nextauth]) · research CRUD ·
posts/[id]/like + comments · profile (PATCH/DELETE, avatar, password, username) ·
subscribe · upload (admin) · ticker/chart (CoinGecko, cached) · users/[id]/membership.

**Key libs (`src/lib/`):** `api.ts` (ok/fail/handleError/getSessionUser/
getAdminSession) · `auth.ts` (NextAuth options) · `ratelimit.ts` (Upstash, keyed
buckets) · `otp.ts` (HMAC-hashed 6-digit codes) · `email.ts` (Resend, console
fallback) · `storage.ts` (Supabase upload) · `profile.ts` (zod schemas + handle
normalization) · `env.ts` (the intended single door for env access — route new reads
through it, but note it does **not** yet enforce that: the zod result is only logged,
`process.env` is then re-read directly for the exported values, and the module lacks
`import "server-only"` so it currently reaches the client bundle. `docs/HANDOFF.md §8`)
· `seo.ts`/`jsonld.tsx`.

## Conventions (match these — don't invent new patterns)
- API: `ok(data)` / `fail(msg, status)` / `handleError(err, "context")`; zod-parse
  every body; pick the right rate-limit key (`signup`/`login`/`password`/`admin`/
  `comment`/`like`/`subscribe`, plus per-feature buckets — see `ratelimit.ts`).
  Security-sensitive flows use **two independent keys**: an IP-keyed limiter
  *and* a target-keyed one, so neither IP rotation nor a fixed victim can bypass
  it — login is `login` (per-email) + `loginIp` (20/min/IP, checked before any
  bcrypt runs), OTP send is `signup`/`password` (IP) + `otpEmail` (3/10min per
  target email). IP comes from `clientIp()`/`clientIpFromHeaders()`, which prefer
  the un-spoofable `x-vercel-forwarded-for` over `x-forwarded-for`.
- Server pages fetch + serialize (Dates → ISO) → pass to a `"use client"` component.
- Design tokens: `gold-*`, `mint-*`, `ink-*`; surfaces `.glass`/`.surface`; buttons
  `btn-primary`/`btn-gold`/`btn-ghost`/`btn-secondary`; reveal animations via
  `<Reveal>`; text `text-gold-gradient`, `text-shine` (bold accent sweep, one
  phrase per heading), `text-shimmer` (quieter continuous sweep for surrounding
  headline text). Inputs: see `Field` in `LoginForm.tsx`. Homepage hero headline
  uses **Fraunces** (serif, `--font-fraunces` CSS var) — scoped to that one
  headline only, not the shared `font-display` class (stays Geist Sans
  everywhere else; a site-wide font change was tried and explicitly reverted).
- Never expose user emails publicly (use `maskEmail`); never put secrets in code
  or docs (env names only — values live in Vercel/Supabase dashboards).
- `prefers-reduced-motion` policy (revised this session): only the heavy
  full-screen ambient loops (mesh, aurora, particles, starfield twinkle,
  Saturn/Moon bob) are gated by it. The ticker marquee, text-shine/shimmer,
  shooting stars, and the whole Icons3D system (`.i3d-*`) are deliberately
  **exempt** — treated as core brand identity, not decoration, after repeated
  reports of the site looking "static" traced to reduced-motion being active
  in the test environment. Default new decorative CSS animations to exempt
  unless they're a genuinely heavy full-screen effect. One-shot framer-motion
  entrance/reveal animations were never gated on this in the first place.
- Every new public/polled GET API route should set `Cache-Control` from day
  one (`public, s-maxage=N, stale-while-revalidate=M` for anonymous-safe
  responses, `private, no-store` for personalized ones) — see `api/ticker`,
  `api/news/social`, `api/chat/messages` for the live pattern. This exists
  because of a real Vercel Fast Origin Transfer usage scare — don't wait for
  another one to retrofit it on a new route.

## Gotchas (learned the hard way)
- `DATABASE_URL` **must** include `?pgbouncer=true` (Supabase pooler) or serverless
  requests fail with prepared-statement errors. Migrations use `DIRECT_URL`.
- Every env integration degrades gracefully when unset (no Upstash → limits no-op;
  no Resend → OTP logs to console; no Supabase storage → uploads 501). Keep it so.
- Missing DB columns → `handleError` maps Prisma P2021/P2022 to a graceful 503
  "Database not migrated".
- ISR pages must never read the DB at build time; profile/settings pages render
  on demand. Bust profile cache with `revalidatePath("/u/<handle>")` after edits.
- lucide-react v1 has no Twitter/Github icons — use `src/components/BrandIcons.tsx`.
- Migrations auto-apply on every Vercel deploy via the `vercel-build` script
  (`prisma db push`, best-effort/non-fatal) — don't assume a migration is
  "pending" just because it's recent; check before treating it as unapplied.
- Feature branches get squash-merged, so the branch's **remote** copy never
  fast-forwards to the squash commit — the next push from a freshly-reset local
  branch will be rejected as non-fast-forward. This is expected: verify
  `git diff origin/<branch> <latest-main-sha>` is empty, then
  `git push --force-with-lease`. Full detail + the "always reset from fresh
  origin/main before starting new work" rule: `docs/HANDOFF.md §2`.
- A stale cached page can reference a JS chunk hash that no longer exists after
  a new deploy → 404 served as HTML → browser refuses to execute it (MIME
  mismatch) → hydration silently never finishes → the page LOOKS static (no
  animations, stale data) even though nothing crashed. `public/sw.js` +
  `PwaSetup.tsx` now self-heal this (SW cache versioning + guarded reload on a
  detected stale-chunk failure) — bump the SW cache version string if you ship
  something that could otherwise strand users on old JS.
- `background-clip: text` on a wrapper element does not paint through to
  nested inline children — apply gradient-text classes (`text-shine`,
  `text-shimmer`) to each leaf span individually, not a parent wrapping
  multiple children, or the un-covered children render invisible.

## Current state (2026-07-25)
- ✅ Live: homepage (orbital ecosystem + Fraunces hero headline with word-stagger
  reveal + continuous shimmer), research hub + premium gating, likes, comments,
  auth (email+password, OTP signup, Google optional), profiles (`/u/[handle]` +
  `/settings` + public Journal Activity feed), admin dashboard, community chat
  (reactions/replies/polls/pins; anonymous visitors get a read-only preview,
  logged-in members get the full live room - see HANDOFF.md §7), 1-on-1 DMs,
  Trading Journal (trades/analytics/risk/challenges, premium-tiered, shareable
  cards), Markets hub, News hub (AI briefings - manual "Generate" trigger, not
  auto-fired - push notifications, saved stories), XYZ AI assistant, `/terms`
  + `/privacy`.
- 🔧 Hobby-plan cost pass: voice rooms (LiveKit) removed entirely; push-dispatch
  + watchdog GitHub Actions crons paused (`workflow_dispatch` only - re-enable
  `schedule:` when moving off the free plan); every realtime/presence hook
  shares one Supabase client via `src/lib/realtimeClient.ts` instead of each
  opening its own WebSocket connection; poll intervals widened across
  ticker/news/markets pollers. Full detail: `docs/HANDOFF.md §7`.
- 🔒 Security hardening (2026-07-17): login timing-oracle closed (equal-cost
  dummy `bcrypt.compare()` on fast-fail paths), login-lockout counter made
  atomic (`{ increment: 1 }`, was a race-bypassable read-then-write), IP-keyed
  limiters switched to the un-spoofable `x-vercel-forwarded-for`, new `otpEmail`
  + `loginIp` limiters. (The 14 Next.js-tree framework CVEs flagged here were
  cleared 2026-07-23 by the Next 14 → 16 / React 19 upgrade — see the Current
  state note below and `docs/HANDOFF.md §8`.)
- 💸 Free-tier overage fixes (2026-07-19): the security timing fix's dummy
  bcrypt (~330ms sync CPU, `bcryptjs` is pure-JS) blew past Fluid Active CPU —
  fixed with the `loginIp` pre-bcrypt gate. Plus an ISR-Writes fix
  (`/api/markets/search` window) and a Fast Origin Transfer fix
  (`stripInlineImage()` stops raw base64 `data:` avatars stored in the DB from
  being served across six hot read paths). Earlier rounds: static-regression
  fixes, hero redesign, Terms/Privacy, three FOT rounds (all `docs/HANDOFF.md §7`).
- ⚠️ Three open OWNER actions (`docs/HANDOFF.md §8`): (1) prod DB has drifted
  behind `schema.prisma` — was silently starving signups; code now fails loudly
  but the data needs a real migration re-run (fresh deploy or `db:push` with
  prod creds). (2) One-time read-only check for existing inline `data:` avatars
  in the DB. (3) 🔴 **Sentry is not configured in production at all** — verified
  on the live site 2026-07-25: no `NEXT_PUBLIC_SENTRY_DSN` *or* `SENTRY_DSN` in
  Vercel, `window.__SENTRY__` undefined, zero ingest requests, no DSN in any
  served chunk. So there is **no error monitoring from any runtime** (browser,
  server or edge). The #168/#171 code fixes are correct prerequisites, not
  ineffective — they just can't run without a DSN. `NEXT_PUBLIC_*` is inlined at
  build time, so adding the vars **requires a redeploy**. Full steps:
  `docs/HANDOFF.md §8`.
- ⬆️ Next 14 → 16 + React 19 upgrade (2026-07-23): next 14.2.35 → 16.2.11,
  react 18 → 19, next-auth stayed on v4 (4.24.15, no Auth.js v5 rewrite), R3F
  8→9 / drei 9→10 (compile-only — the WebGL orbital scene is gated off, CSS
  orbital is the live centerpiece), eslint 9 flat config (`next lint` removed).
  Async `params`/`searchParams` codemod across 31 files. Cleared all 14 Next.js
  framework CVEs; typecheck/lint/test/build green + homepage runtime-verified
  under React 19. Leftover: `sharp`/`postcss` audit residue (`docs/HANDOFF.md §8`).
- 🛰️ Sentry client monitoring restored (2026-07-24/25) — it had been dark, from
  **two independent faults**. (1) Next 16 builds with Turbopack, which never
  loads `sentry.client.config.ts` (a webpack-plugin mechanism), so the browser
  `Sentry.init()` stopped at the upgrade → moved to
  `src/instrumentation-client.ts` + `onRouterTransitionStart`. (2) `connect-src`
  had **never** allowed a Sentry host, so the ingest `fetch()` was CSP-blocked
  regardless → added `https://*.sentry.io`. Deliberately *not* `tunnelRoute`,
  which would route every event through a Vercel function. Server/edge Sentry
  was never affected. **Still unconfirmed end-to-end — see the owner action above.**
- 🧹 Housekeeping (2026-07-25): dead LiveKit CSP sources removed (`worker-src
  'self'` kept — the PWA service worker needs it); react-hooks v6 warnings
  73 → 41 with `purity` + `static-components` back on **error** (three were real
  bugs: starfield reshuffling on re-render, `CommandPalette` remounting its whole
  results list, `touchUi` never updating on pointer change). Mount-time browser
  reads now go through `src/lib/useClientFlag.ts`. The fetch-on-mount group is a
  **documented deliberate keep** — reasoning sits next to the rule in
  `eslint.config.mjs`; don't "fix" it without reading that first.
- 📋 **Before merging anything that touches routes, caching, data fetching or
  realtime, run the `pre-merge` skill** (route-table diff vs `main`, cost-pattern
  scan). CI proves nothing broke; it cannot see a page that stopped being cached
  or a new polling loop. The route baseline and every caching number live in the
  `cost-check` skill — see the Skills section above.
- 🔜 No specific next phase agreed with the owner as of this handoff — ask
  before assuming a direction. Full session-by-session detail: `docs/HANDOFF.md §7`.

## Skills (`.claude/skills/`)
Three project skills are committed to the repo, so any Claude session from any
account loads them on trigger instead of relying on someone naming a doc:

| Skill | Loads when | Owns |
|---|---|---|
| `pre-merge` | before merging anything touching routes/caching/data/realtime | the six-step check procedure, scaling table, standing rules |
| `cost-check` | touching an API route, poller, external fetch, `Cache-Control`, `revalidate`, realtime channel, or chasing a Vercel usage spike | **every caching and cost number** — route baseline, ISR windows, the 2 MB data-cache trap, bundle-size blind spot |
| `design-system` | building or restyling UI, choosing colors/spacing/motion, editing `tailwind.config.ts` or `globals.css` | the color rule, the narrow `prefers-reduced-motion` policy, the gradient-text gotcha |

Rule they follow: **a skill carries what changes a decision; the handbook in `docs/`
carries reference tables.** Don't duplicate a fact into both — duplicated facts drift.

## Docs book
`docs/SUMMARY.md` is the GitBook-compatible table of contents for the full
handbook (architecture, frontend, backend, API reference, security, runbook).
Update `docs/changelog.md` after every meaningful change.
