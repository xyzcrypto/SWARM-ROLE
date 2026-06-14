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

## Architecture map (detail: docs/api-reference.md, docs/backend-state.md)
**Pages:** `/` (ISR 300) · `/research` (ISR 120) · `/research/[slug]` (dynamic,
premium-gated) · `/u/[username]` (ISR 60 + revalidatePath on edit) · `/settings`
(dynamic, auth) · `/dashboard` (dynamic, ADMIN) · `/login` `/signup`
`/forgot-password` (static).

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
  `comment`/`like`/`subscribe`).
- Server pages fetch + serialize (Dates → ISO) → pass to a `"use client"` component.
- Design tokens: `gold-*`, `mint-*`, `ink-*`; surfaces `.glass`/`.surface`; buttons
  `btn-primary`/`btn-gold`/`btn-ghost`/`btn-secondary`; reveal animations via
  `<Reveal>`; text `text-gold-gradient`. Inputs: see `Field` in `LoginForm.tsx`.
- Never expose user emails publicly (use `maskEmail`); never put secrets in code
  or docs (env names only — values live in Vercel/Supabase dashboards).
- Animations must respect `prefers-reduced-motion`; heavy effects gated by
  IntersectionObserver and reduced on mobile (see OrbitalEcosystem/SmoothScroll).

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

## Current state (2026-06-14)
- ✅ Live: homepage (orbital ecosystem), research hub + premium gating, likes,
  comments, auth (email+password, OTP signup, Google optional), profiles
  (`/u/[handle]` + `/settings`), admin dashboard with real-time analytics +
  membership + per-post views, community chat.
- ✅ Production-hardening pass (`docs/AUDIT-2026-06-14.md`): migration resilience
  (missing `views` no longer 404s posts / 500s dashboard), per-user rate limits on
  profile/avatar, password-reset email check, signup race fix, server-side premium
  re-check, research content cap, perf (PerpChart visibility-gating, image `sizes`),
  and the **profile-photo fix** — upload **+ validated "Use a link" URL fallback**.
- ⚠️ Pending ops (idempotent, in `docs/HANDOFF.md §4`): apply the analytics/views
  migration (`prisma/migrations/5_post_views_pageview`) and, for native uploads,
  configure Supabase Storage + a public `post-covers` bucket. Code degrades
  gracefully until both are done.
- 🔜 Next phase (agreed with owner): **UI/UX polish + navbar**, then roadmap.

## Docs book
`docs/SUMMARY.md` is the GitBook-compatible table of contents for the full
handbook (architecture, frontend, backend, API reference, security, runbook).
Update `docs/changelog.md` after every meaningful change.
