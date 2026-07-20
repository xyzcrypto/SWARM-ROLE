# CLAUDE.md — XYZ Crypto (read me first)

This file is the continuity anchor for any Claude / AI session (from **any**
account) and any human developer. Read this, then `docs/HANDOFF.md`, and you have
full context to continue safely.

## What this is
**XYZ Crypto** — premium Web3 ecosystem site (research hub, market data, user
accounts/profiles, premium content). Dark luxe design: gold + mint on near-black.
- **Stack:** Next.js 14.2 (app router) · TypeScript · Tailwind · framer-motion ·
  Prisma → Supabase Postgres · next-auth (JWT) · Upstash rate-limits · Resend
  email · Supabase Storage · Sentry · Vercel hosting.
- **Owner contact:** niralekhan321@gmail.com

## Commands
```bash
npm run dev          # local dev server
npm run typecheck    # tsc --noEmit
npm run lint         # next lint (eslint config: .eslintrc.json)
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
normalization) · `env.ts` (ALL env access goes through here) · `seo.ts`/`jsonld.tsx`.

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

## Current state (2026-07-19)
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
  + `loginIp` limiters. Next.js-tree CVEs (14 as of the latest audit, up from 8
  first counted; need `next` 14→16) flagged, NOT fixed — for this app the
  residual is RSC DoS-class only (no data exposure), but Next 14 gets no
  security backports so new advisories keep landing against it. Owner action,
  `docs/HANDOFF.md §8`.
- 💸 Free-tier overage fixes (2026-07-19): the security timing fix's dummy
  bcrypt (~330ms sync CPU, `bcryptjs` is pure-JS) blew past Fluid Active CPU —
  fixed with the `loginIp` pre-bcrypt gate. Plus an ISR-Writes fix
  (`/api/markets/search` window) and a Fast Origin Transfer fix
  (`stripInlineImage()` stops raw base64 `data:` avatars stored in the DB from
  being served across six hot read paths). Earlier rounds: static-regression
  fixes, hero redesign, Terms/Privacy, three FOT rounds (all `docs/HANDOFF.md §7`).
- ⚠️ Two open OWNER actions (`docs/HANDOFF.md §8`): (1) prod DB has drifted
  behind `schema.prisma` — was silently starving signups; code now fails loudly
  but the data needs a real migration re-run (fresh deploy or `db:push` with
  prod creds). (2) One-time read-only check for existing inline `data:` avatars
  in the DB.
- 🔜 No specific next phase agreed with the owner as of this handoff — ask
  before assuming a direction. Full session-by-session detail: `docs/HANDOFF.md §7`.

## Docs book
`docs/SUMMARY.md` is the GitBook-compatible table of contents for the full
handbook (architecture, frontend, backend, API reference, security, runbook).
Update `docs/changelog.md` after every meaningful change.
