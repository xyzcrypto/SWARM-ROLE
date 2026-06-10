# XYZ Crypto — Ops Runbook

## 1. Database migrations (fix the drift — do this ONCE)

The first two migrations (`0_init`, `1_verification_code`) were applied by hand
in the Supabase SQL Editor, so Prisma's `_prisma_migrations` table doesn't know
about them. Baseline once, then use `migrate deploy` forever after.

From a machine with `DIRECT_URL` (port 5432) set to your Supabase project:

```bash
# Mark already-applied migrations as applied (no SQL is run for these):
npx prisma migrate resolve --applied 0_init
npx prisma migrate resolve --applied 1_verification_code

# Apply everything new (e.g. the performance indexes):
npx prisma migrate deploy
```

After baselining, **always** ship schema changes as a migration and let
`migrate deploy` apply them — never hand-edit the DB again.

### Quick alternative (no baselining)
If you just want the new indexes now, run this in the Supabase SQL Editor:

```sql
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
CREATE INDEX "Post_published_category_createdAt_idx" ON "Post"("published", "category", "createdAt");
```

> `CREATE INDEX` is safe on a live DB. For very large tables use
> `CREATE INDEX CONCURRENTLY` (cannot run inside a transaction).

## 2. Security headers
CSP + HSTS + X-Frame-Options etc. are set in `next.config.mjs` (`headers()`).
After deploy, verify at https://securityheaders.com against your domain.
If you add a new third-party script/host, update the CSP `*-src` lists.

## 3. Error monitoring (Sentry) — needs your DSN
Not yet wired (requires an account + DSN). To enable:
```bash
npx @sentry/wizard@latest -i nextjs
```
Then add `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` in Vercel. Until then,
errors are logged via `console.error` → Vercel Functions logs (with Prisma
error codes, see `src/lib/api.ts`).

## 4. Environment variables (Vercel → Production)
Required: `DATABASE_URL` (pooled, `?pgbouncer=true`), `DIRECT_URL` (5432),
`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAILS`, `RESEND_API_KEY`, `EMAIL_FROM`.
Optional: `GOOGLE_CLIENT_ID/SECRET`, `UPSTASH_REDIS_REST_URL/TOKEN`,
`NEXT_PUBLIC_SITE_URL/GA_ID/GSC_VERIFICATION`.

## 5. Rollback
Vercel → Deployments → pick the last good build → **Promote to Production**.
DB changes are not auto-rolled-back — additive migrations (like indexes) are
safe; destructive ones must be reversed manually.

## 6. Email deliverability (Resend) — REQUIRED for member OTPs
The test sender `onboarding@resend.dev` delivers ONLY to the Resend account
owner's email. Members will not receive OTP codes until a domain is verified:

1. Resend dashboard → **Domains** → **Add Domain** → `xyzcrypto.io`.
2. Resend shows DNS records (DKIM TXT, SPF TXT, optionally MX for the
   `send.` subdomain). Add them at your DNS provider (where xyzcrypto.io is managed).
3. Wait for the domain to show **Verified** (minutes up to a few hours).
4. Vercel → Environment Variables → set
   `EMAIL_FROM = XYZ Crypto <noreply@xyzcrypto.io>` (Production + Preview) → Redeploy.
5. Test: sign up with ANY non-owner email → OTP should arrive. Failures appear
   in Sentry tagged `area:email` and in Vercel logs as `[email] Resend send failed`.
