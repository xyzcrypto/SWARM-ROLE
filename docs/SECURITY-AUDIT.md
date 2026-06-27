# Security Audit — XYZ Crypto

**Date:** 2026-06-27 · **Stack:** Next.js 14 (app router) · Prisma → Supabase Postgres ·
next-auth (JWT) · Upstash rate-limits · zod.

## Executive summary
The app has **strong security fundamentals**: zod validation on every route, HMAC + timing-safe
OTP, granular permission RBAC with no-escalation, rate-limiting on sensitive surfaces, bcrypt
hashing, parameterized Prisma (no raw SQL), magic-byte upload checks, strict security headers/CSP,
and safe error handling. One **critical** issue (open redirect) and a few medium items were found;
the high-value ones are **fixed in this pass** (marked ✅).

## Findings

| ID | Severity | Area | File | Issue | Status |
|----|----------|------|------|-------|--------|
| F-001 | **Critical** | Open redirect | `LoginForm.tsx` | `?callbackUrl` pushed to router unvalidated → phishing redirect | ✅ **Fixed** — only same-origin relative paths allowed (`/^\/(?!\/)[^\\]*$/`) |
| F-005 | Medium | Password hashing | signup/reset/profile-password routes | bcrypt cost 10 (low) | ✅ **Fixed** — raised to cost **12** |
| F-006 | Medium | AuthZ | `api/research/[id]` | edit/delete gated on Super-Admin only (`getAdminSession`), bypassing granular perms | ✅ **Fixed** — now `requirePermission("post:manage")` |
| F-008 | Medium | Rate limiting | `lib/ratelimit.ts` | silent no-op if Upstash unset (prod limits off, unnoticed) | ✅ **Fixed** — logs a `SECURITY` warn in production |
| F-016 | Low | XSS / markdown | `lib/links.ts` | `javascript:` via leading whitespace | ✅ **Already safe** — `safeHref` trims before the protocol check |
| F-009 | Medium | Search input | `api/users/search` | unsanitized `q` | ✅ **Mitigated** — Prisma `contains` is parameterized (ILIKE, no injection); `q` capped at 120 chars |
| F-002 | High | Realtime | `lib/realtime.ts` | broadcast channels are `private:false`; a client with the anon key could observe/spoof events (`membership_changed`, `access_changed`, notification pings) | **Open (ops)** — broadcasts are advisory only and **every privileged action is re-checked server-side** (the client `update()` re-reads the DB), so spoofing yields no real privilege. Recommended: enable Supabase **RLS** + private channels, and/or HMAC-sign sensitive payloads. |
| F-003 | High→Info | Cookies | next-auth config | flags not explicit | **By design** — next-auth defaults already set `HttpOnly` + `Secure` (`__Secure-` prefix) + `SameSite=lax` in production. Left as-is to avoid breaking auth. |
| F-004 | High→Accepted | Deploy | `package.json vercel-build` | `prisma db push` at build needs `DIRECT_URL` | **Accepted (owner choice)** — auto-apply on deploy was explicitly requested; it's best-effort/non-fatal. Mitigation: scope `DIRECT_URL` to a least-privileged migration role; consider a post-deploy hook later. |
| F-010 | Medium | Lockout | `lib/auth.ts` | 5 fails / 15-min lock; concurrent-fail race | **Acceptable** — counter increments are guarded; values are reasonable. Optionally tighten to 5/30-min and add lockout alerting. |
| F-012 | Low | JWT size | `lib/auth.ts` | permissions array could grow the token | **Watch** — fine today; if perms balloon, store a permission hash + re-fetch. |
| F-014 | Low | OTP | `lib/otp.ts` | 10-min TTL; no issuance rate-limit | **Minor** — consider 15-min TTL + a `codeIssue` limiter to prevent email spam. |
| F-015 | Low | CSP | `next.config.mjs` | `'unsafe-inline'` for scripts/styles | **Deferred** — needs a nonce middleware; client code is clean of dynamic handlers. |

## Notable strengths (keep doing)
- **OTP**: HMAC-SHA256 + timing-safe compare; fails closed without `NEXTAUTH_SECRET`.
- **RBAC**: single capability catalog, immutable Super Admins, no privilege escalation in `/access`.
- **Validation**: zod on every body; `isCuid` pre-checks; safe `handleError` (no stack leaks; Sentry).
- **Uploads**: magic-byte sniffing + 5 MB cap (`lib/storage.ts`).
- **Headers**: HSTS preload, X-Frame-Options DENY, nosniff, strict Referrer-Policy, locked Permissions-Policy.
- **DB**: 100% parameterized Prisma; service-role key is server-only (never shipped to client).

## Recommended next (ops, not code)
1. Enable Supabase **RLS** + mark realtime channels private (closes F-002 fully).
2. Ensure **Upstash** is configured in prod (the new warn will flag it if not).
3. Confirm `NEXTAUTH_SECRET` is set and rotated; scope `DIRECT_URL`'s DB role to migrations only.
