# Security

Security posture of XYZ Crypto, current as of 2026-06-11 (post-audit, see
[AUDIT-2026-06-11.md](AUDIT-2026-06-11.md) — overall **A−**).

## Authentication & sessions
- NextAuth **JWT** sessions (`NEXTAUTH_SECRET`-signed); no session rows for JWT path.
- Passwords: **bcrypt cost 10**, hash-only storage; OAuth-only accounts have
  `passwordHash = null` and can set one via the reset flow.
- Signup requires **email OTP**: 6-digit, stored as HMAC-SHA256 hash only, 10-min
  TTL, 5 attempts, single-use (`src/lib/otp.ts`).
- Login brute-force guard: `login` bucket 10/min **per account**; password-change
  reuses the same per-account bucket; reset flow has its own `password` 10/min/IP.
- Google OAuth: `allowDangerousEmailAccountLinking: false` (prevents OAuth
  account-takeover of an existing credentials account with the same email).
- Admin = `role === "ADMIN"`, auto-promoted only for `ADMIN_EMAILS` addresses.

## API hardening
- Every mutating route: session gate (`getSessionUser`/`getAdminSession`) +
  zod validation + rate limit + safe error mapping (no stack traces, Prisma codes
  translated, unknown errors → trace-id + Sentry).
- Path params CUID-validated before DB hits. Account deletion requires an explicit
  `{confirm:true}` body and runs in a transaction.
- Upload constraints: MIME allowlist (JPEG/PNG/WebP/GIF/AVIF), 5 MB cap,
  collision-resistant object paths, service-role key used **server-side only**.

## Headers & content security (next.config.mjs)
- CSP (script/style allow inline — documented accepted risk, no nonce pipeline
  yet; everything else locked to known origins), HSTS 2y preload,
  `X-Frame-Options: DENY`, `nosniff`, strict referrer, locked Permissions-Policy.
- `next/image` remote hosts allowlisted (was `**` — fixed in audit).
- Markdown renderer is custom + `safeHref()` blocks `javascript:`/`data:` URLs.

## PII & privacy
- User emails are **never** rendered publicly: navbar/dashboard use `maskEmail()`;
  the public profile (`/u/[handle]`) exposes only opt-in fields (name, handle,
  bio, socials, stats). Public APIs never select email.
- Password-reset returns a generic success whether or not the account exists.
- CSV export escapes cells against spreadsheet formula injection (`csvCell`).

## Secrets policy
1. No secret values in repo, docs, commits, or chat — **env var names only**.
2. Canonical store: **Vercel → Project → Environment Variables** (sourced from
   Supabase / Upstash / Resend / Google Cloud / Sentry dashboards).
3. `.env*` is gitignored. `SEED_ADMIN_PASSWORD` must be set when seeding
   (default `changeme123` is dev-only — change after first login).
4. If a secret ever leaks: rotate it at the provider, update Vercel, redeploy —
   see [RUNBOOK.md](RUNBOOK.md).

## Accepted risks / future hardening
- CSP `unsafe-inline` for scripts/styles (Next hydration + GA without a nonce
  pipeline). Tighten with nonce middleware later.
- Rate limiting is permissive no-op until Upstash env is set — set it in prod.
- No CSRF tokens on custom APIs beyond NextAuth's session cookie model (SameSite
  cookies + origin-bound fetches); acceptable for current threat model.
- Orphaned storage objects (old avatars/covers after deletes) accumulate — needs a
  periodic cleanup job (cosmetic cost only).

## Reporting
Security issues → **niralekhan321@gmail.com** (owner). Please do not open public
GitHub issues for vulnerabilities.
