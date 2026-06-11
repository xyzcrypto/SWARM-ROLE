# XYZ Crypto — Backend State (authoritative)

> Source of truth for the backend. Update after every backend change.
> Stack: Next.js App Router (route handlers) + Prisma + Supabase Postgres +
> NextAuth (JWT) + Resend + Supabase Storage + Upstash + Sentry.

## Branch / deploy
- Work branch: `claude/xyz-crypto-web3-site-BuytL` (open as PR #6, **unmerged**).
- Production `main`. Deploy: Vercel auto-deploys `main`. Migrations applied **by
  hand** in Supabase SQL Editor (see RUNBOOK baselining).

## API routes (pattern: rateLimit → Zod → auth gate → Prisma → handleError)
| Route | Methods | Auth | Notes |
|---|---|---|---|
| `/api/auth/[...nextauth]` | * | — | Credentials (login=email+password, signup=OTP code) + Google |
| `/api/auth/signup/start` | POST | public | emails signup OTP; **502 if email send fails** |
| `/api/auth/password/start` | POST | public | reset OTP (generic reply, anti-enumeration) |
| `/api/auth/password/reset` | POST | public | code + new password |
| `/api/research` | GET | public | published-only; `page/pageSize/q/category`; **premium posts have body redacted** |
| `/api/research` | POST | ADMIN | create (+`premium`); stable slug + P2002 retry; revalidate |
| `/api/research/[id]` | GET | ADMIN | full post for editor |
| `/api/research/[id]` | PATCH | ADMIN | partial update (+`premium`); slug stable unless draft+title change |
| `/api/research/[id]` | DELETE | ADMIN | delete + revalidate |
| `/api/posts/[id]/comments` | GET | public | visible comments, paginated; **never returns commenter email** |
| `/api/posts/[id]/comments` | POST | logged-in | auto-publish; Zod 1–1000; rate-limited (`comment` 8/min) |
| `/api/comments/[id]` | DELETE | ADMIN | moderation |
| `/api/posts/[id]/like` | POST | logged-in | like toggle; rate-limited (`like` 20/min) |
| `/api/upload` | POST | ADMIN | image → Supabase Storage; 5 MB; jpeg/png/webp/gif/avif; 501 if unconfigured |
| `/api/users/[id]/membership` | PATCH | ADMIN | Free/Premium toggle |
| `/api/subscribe` | POST | public | waitlist upsert |
| `/api/ticker`, `/api/chart` | GET | public | CoinGecko, cached |

## Access control
- ADMIN gate: `getAdminSession()` (`src/lib/api.ts`). Any logged-in user:
  `getSessionUser()` (returns id/role/membership/email).
- Session carries `role` + `membership` (added to JWT+session callbacks in
  `src/lib/auth.ts`). **Membership in the token is a UI hint only — premium
  access is always re-checked against the DB server-side.**
- **Login = standard email + password** (bcrypt, rate-limited `login` 10/min per
  account). No 2FA. **Signup is still email-verified via OTP** (verify-then-create);
  forgot-password uses an OTP reset code.
- **Premium gating (2 layers):** list API redacts premium body; `[slug]` server
  page renders `PremiumLock` (no body in HTML) unless `membership==="Premium"`
  or ADMIN. JSON-LD content redacted when locked.

## Schema (Postgres) & migrations
Tables: User, Post (+`premium`), Subscriber, Account, Session,
VerificationToken, VerificationCode, **Comment**, **PostLike**. Draft = `Post.published=false`.
Migrations in `prisma/migrations/`: `0_init`, `1_verification_code`, `2_indexes`,
**`3_premium_comments`**, **`4_likes`** (CREATE PostLike + unique + FKs).
Apply 3_premium_comments in Supabase SQL Editor before this code goes live.

## Env (Vercel)
Required: `DATABASE_URL` (pooled `?pgbouncer=true`), `DIRECT_URL`,
`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAILS`, `RESEND_API_KEY`,
`EMAIL_FROM` (verified-domain sender — `onboarding@resend.dev` only reaches the
Resend owner). Optional/feature-flags: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
(+ public bucket `post-covers`) → image upload; `UPSTASH_*` → rate limiting;
`NEXT_PUBLIC_SENTRY_DSN` → monitoring; `NEXT_PUBLIC_SITE_URL/GA_ID/GSC_VERIFICATION`.

## Lib modules
`api.ts` (ok/fail/handleError/getAdminSession/getSessionUser/isCuid) ·
`auth.ts` · `otp.ts` (HMAC, single-use, 10min, 5 attempts) · `email.ts` (Resend
+ dev log + Sentry on fail) · `storage.ts` (Storage REST upload) · `env.ts`
(validated env + `emailEnabled`/`storageEnabled`) · `ratelimit.ts` ·
`markdown.tsx` (XSS-safe, `.prose-xyz`).

## Known backend issues / notes
- Image upload requires Supabase Storage config (bucket + 2 env vars) — until
  set, returns 501 and the editor guides the user to the URL field.
- Comments are auto-published (status `visible`); admin can delete. `status`
  field allows a future "approval" mode without migration.
- `/research/[slug]` is now dynamic (per-user premium gating); list/home stay ISR.

## Verification gate
`npx tsc --noEmit` · `npx vitest run` (31 tests) · `npm run build` exit 0.

## Profiles (v1.1, 2026-06-11) — addendum
- **Schema:** `User` += `username` (unique, `[a-z0-9_]{3,20}`), `bio`, `location`,
  `website`, `twitter/github/telegram` (bare handles), `bannerImage`.
  ⚠️ One-time prod migration required — idempotent SQL in `HANDOFF.md`.
- **Routes:** `PATCH/DELETE /api/profile` (update / transactional account delete),
  `POST /api/profile/avatar` (Supabase upload → `user.image`),
  `POST /api/profile/password` (current-password verify; OAuth-only rejected),
  `GET /api/profile/username` (availability). Full details: `api-reference.md`.
- **Validation:** `src/lib/profile.ts` — zod schemas, reserved handles, social
  normalization (strips @/URLs). 15 unit tests (`src/lib/__tests__/profile.test.ts`).
- **Sessions:** jwt/session callbacks also refresh `name/image/username` on
  `update()` so profile edits reflect without re-login.
- **Caching:** `/u/[username]` ISR 60s; profile/avatar APIs fire `revalidatePath`
  (old + new handle) so edits are instant. `getProfile` wrapped in React `cache()`.
- **Rate limits:** new dedicated `password` bucket (10/min/IP) for the reset flow.
- Verification gate is now **50 tests**.
