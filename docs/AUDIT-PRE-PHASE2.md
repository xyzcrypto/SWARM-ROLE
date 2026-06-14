# XYZ Crypto — Pre-Phase-2 Audit, Hardening & Stabilization Report
_Date: 2026-06-14 · Scope: stabilize/secure/optimize the existing Phase-1 foundation without rebuilding. Branch: `claude/xyz-crypto-web3-site-BuytL` (PR #19)._

## Executive Summary
Phase 1 (Demos 1–3) is feature-complete and architecturally sound. A full
security / backend / SEO / frontend / performance / build / code-quality audit
was performed; the safe **Critical + High + Medium** findings were fixed in place.
No architecture, UI, routes, or features were changed — fixes are surgical.

| Score | Rating | Notes |
|------|--------|-------|
| **Project health** | **9.0 / 10** | Clean modular architecture, strict TS, good test base, hardened. |
| **Production readiness** | **9.2 / 10** | Pipeline green; resilient degradation; recovery point in place. |
| **Risk** | **Low** | Residual items are documented, non-blocking, or ops/Phase-2. |

**Verdict: ✅ READY FOR MERGE** (confidence: High — see Merge Readiness).

## Recovery Point (verified)
- Backup branches pushed to origin: **`phase1-stable`**, **`pre-phase2-backup`** (both at `e07d35f`).
- Annotated tag `phase1-production` created locally; **tag push was rejected by this environment's git proxy (HTTP 403 on tag refs)** — the two backup **branches** fully provide rollback, so this is not a blocker.
- **Rollback:** `git checkout -b restore phase1-stable` (or `pre-phase2-backup`) → redeploy. Instant, lossless.

---

## Security Report
**Fixed (this pass):**
- **[High] Rate-limit bypass on authed routes** — `api/posts/[id]/like` & `api/posts/[id]/comments` keyed limits on client IP; an authed user could rotate IPs to bypass. Now keyed on `user.id` (matches chat reactions). _Verify:_ rapid likes/comments throttle per-account.
- **[High] SSRF/URL-injection on chart proxy** — `api/chart` interpolated the raw `coin` query into the CoinGecko URL. Now only an allowlisted key (`COINS`) is ever interpolated; unknown coins fall back to `bitcoin`. _Verify:_ `?coin=<anything>` never alters the upstream host/path.
- **[High] OTP fail-closed** — `lib/otp.ts` hashed codes with a guessable `"insecure-dev-secret"` fallback if `NEXTAUTH_SECRET` was unset. Now throws at hash time in production, preventing brute-forceable OTPs. _Verify:_ prod without secret refuses OTP issuance; dev unaffected.
- **[High] Password-reset account enumeration** — `api/auth/password/start` returned a 502 only for real accounts on email-send failure. Now logs server-side and always returns the same generic success. _Verify:_ identical response for known/unknown emails.
- **[Med] Notification id validation** — `api/notifications/read` now constrains `ids` to CUID shape.

**Reviewed & already safe (preserve, no change):**
- Auth: JWT strategy, race-safe signup (P2002 recovery), admin promotion, OTP TTL (10m) + attempt cap (5) + `timingSafeEqual`.
- All mutating API routes are auth-gated, zod-validated, and rate-limited (correct keys after this pass).
- XSS: comments/chat render through React auto-escaping; markdown is **admin-authored only** and link hrefs pass `safeHref`.
- Uploads: admin-only, MIME + size validated; avatar URL fallback host-allowlisted (`isAllowedImageHost`).
- Secrets: service-role key & `NEXTAUTH_SECRET` are server-only (never `NEXT_PUBLIC_*`).
- Headers: CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy all set.

**Documented (not changed — by design / Phase-2 / ops):**
- **[Med] CSP `script-src 'unsafe-inline'`** — required without a nonce pipeline; tightening needs per-request nonce middleware (Phase-2; invasive, deferred to avoid hydration breakage).
- **[Low] Service-role key rotation** — ops policy (store as CI/Vercel secret, rotate periodically).
- Contact form HTML-escaping is regex-based but output is escaped (safe).

---

## Backend Audit Report
**Strengths (preserve):** clean `ok/fail/handleError` contract with trace IDs + Sentry; Prisma indexes match query patterns (`Post[published,category,createdAt]`, `Notification[userId,read,createdAt]`, etc.); pgbouncer pooling documented; graceful degradation everywhere (no Upstash → limits no-op; no Resend → console; missing table P2021/P2022 → quiet 503/empty).
**Fixes:** rate-limit keys (above); enumeration fix (above).
**Notes:** `notifyNewPost` fan-out uses a single `createMany` + one realtime ping — fine at current scale; if the user base grows large, move fan-out to a queue/digest (Phase-2).

## Frontend Audit Report
**Strengths (preserve):** modular components; `next/image` with `priority`/`sizes` on above-the-fold; lazy `OrbitalLazy`/`PerpChartLazy`/`ChatClient`; `loading.tsx` skeletons + branded `BrandLoader`; `template.tsx` transitions; aria-labels on all icon buttons; `prefers-reduced-motion` honored across animations; `next/font` (no CLS).
**Fixes:** ProofStrip `<img>` now has explicit width/height + `loading="lazy"` + `decoding="async"` (CLS); Hero mouse-parallax now skipped under reduced-motion.

## Bug Report
No functional/logic/state/navigation/form bugs found in review. Items addressed were security/SEO/quality hardening rather than user-facing defects. The Demo-3 orbital "not animating on desktop" issue was already fixed (rings animate on mount, gated only by reduced-motion). **Remaining bugs: none known.**

## Performance Report
**Current:** good. Modern image formats (AVIF/WebP); code-split heavy/below-fold UI; visibility-gated polling (NavActivity 60s, LiveStats 30s) supplemented by realtime; GPU transforms + rAF throttling on animations.
**Improved:** reduced potential CLS (ProofStrip logos); fewer wasted animation frames under reduced-motion (Hero).
**Remaining opportunities (Phase-2, non-blocking):** nonce-based CSP; optional Vitest coverage reporting; consider digesting notification fan-out at scale.

## SEO Report
**Implemented this pass:**
- Homepage now exports brand-tuned `metadata` with absolute title + `canonical "/"`.
- `WebSite` JSON-LD gains a `SearchAction` (Google sitelinks search box) targeting `/research?q=`.
- Canonicals added to `/premium`, `/contact`, `/community`, `/u/[username]`, `/login`, `/signup`; descriptions added to login/signup.
- PWA `manifest.webmanifest` via `app/manifest.ts` (Next auto-links it).
- Sitemap now includes `/premium`, `/community`, `/contact`.
**Already strong (preserve):** complete root metadata (title template, OG, Twitter, robots, GSC hook), Organization + WebSite JSON-LD site-wide, Article + Breadcrumb on posts, dynamic sitemap (includes all published posts), correct robots.txt disallows (`/api`, `/dashboard`, `/login`).
**Recommendations (later):** add user profiles to the sitemap if/when public discovery is desired; per-post OG image generation.

## Foundation Strength Report
**Strong:** strict TypeScript; 9-table Prisma schema with proper indexes + idempotent migrations (0–6); Sentry across server/client/edge + global-error + (now) route error; CI runs typecheck/lint/test/build on Node 20; dependency set current (Next 14.2.x, Prisma 5, next-auth 4, zod, framer-motion). 
**Weak / watch:** test coverage is lib-focused — auth/notifications/rate-limit internals are only partially covered (added `clientIp` tests; deeper Prisma-mocked tests deferred to avoid introducing a mock framework now). CI uses placeholder DB env (unit tests are node-only by design).
**Future risks (Low/Med):** notification fan-out at very large scale; CSP tightening; email deliverability requires a verified Resend domain (currently graceful console fallback).

## Code Quality
- Removed confirmed-dead `src/components/MembersShowcase.tsx` (zero imports after Demo 2).
- Verified `public/web3-academy.jpg` & `public/tradekaroverse.jpg` are **in use** (ProofStrip) — retained.
- No other dead components found; naming/structure consistent.

## Deployment Readiness
- `npm run typecheck && lint && test && build` — all green (31 static/dynamic routes; `manifest.webmanifest` served).
- Error monitoring: Sentry wired (server/client/edge/global-error/route-error), no-op without DSN.
- Recovery/rollback: backup branches on origin (above).
- Pending ops (unchanged, documented in HANDOFF): apply `5_post_views_pageview` + `6_notifications` migrations; configure Supabase Storage; set a verified `EMAIL_FROM` domain; ensure `NEXTAUTH_SECRET` + `SENTRY_AUTH_TOKEN` set in prod.

---

## Merge Readiness Report
**✅ READY FOR MERGE — confidence: High.**

Justification: all Critical/High/Medium safe findings fixed; full pipeline green; no
known functional regressions; architecture/UI/features preserved; a verified
rollback point exists. Residual items are explicitly documented and are either
ops tasks (migrations, domain/secrets) or non-blocking Phase-2 enhancements
(nonce CSP, deeper test coverage, fan-out scaling). The pending DB migrations are
**not merge blockers** — the app degrades gracefully until they are applied.
