# API Reference

All routes live under `src/app/api/**/route.ts` and follow one pattern:
**`rateLimit → zod validate → auth gate → prisma → handleError`**, returning
`ok(data, status)` or `fail(message, status)` from `src/lib/api.ts`.
Errors are mapped safely (Zod → 400, P2002 → 409, P2025 → 404, P2021/22 → 503
"not migrated", unknown → 500 + Sentry). No stack traces ever reach the client.

Auth levels: **Public** · **User** (`getSessionUser()`) · **Admin**
(`getAdminSession()`). Rate-limit buckets are Upstash sliding windows
(`src/lib/ratelimit.ts`) and no-op when Upstash env is unset.

## Auth

| Route | Method | Auth | Limit | Purpose |
|---|---|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | — | — | NextAuth handler: Credentials (login/signup flows) + Google (if configured). JWT sessions. |
| `/api/auth/signup/start` | POST | Public | `signup` 5/min/IP | Validate name/email/password → bcrypt-hash → email 6-digit OTP. Body: `{name,email,password}`. |
| `/api/auth/password/start` | POST | Public | `password` 10/min/IP | Begin reset; generic success (never reveals if email exists). Body: `{email}`. |
| `/api/auth/password/reset` | POST | Public | `password` 10/min/IP | Verify code, set new password. Body: `{email,code,password}`. |

Login itself goes through NextAuth credentials (`flow:"login"`), bcrypt-compared,
rate-limited `login` 10/min **per account**.

## Content (research posts)

| Route | Method | Auth | Limit | Purpose |
|---|---|---|---|---|
| `/api/research` | GET | Public | — | List published posts; paginated (≤48), category/search filters; premium bodies redacted; `s-maxage=60, swr=300`. |
| `/api/research` | POST | Admin | `admin` 30/min/IP | Create post (markdown). Revalidates home + list. |
| `/api/research/[id]` | GET/PATCH/DELETE | Admin | `admin` | Read full / update (stable slug once published) / delete. |
| `/api/upload` | POST | Admin | `admin` | Cover image → Supabase Storage (JPEG/PNG/WebP/GIF/AVIF, ≤5MB). Returns `{url}` 201. |

## Engagement

| Route | Method | Auth | Limit | Purpose |
|---|---|---|---|---|
| `/api/posts/[id]/like` | POST | User | `like` 20/min/IP | Toggle like → `{liked, count}`. |
| `/api/posts/[id]/comments` | GET | Public | — | Visible comments, paginated 20; `s-maxage=15, swr=60`. |
| `/api/posts/[id]/comments` | POST | User | `comment` 8/min/IP | Create comment (1–1000 chars, auto-visible). |
| `/api/comments/[id]` | DELETE | Admin | `admin` | Moderate (hide) a comment. |

## Profile & account

| Route | Method | Auth | Limit | Purpose |
|---|---|---|---|---|
| `/api/profile` | PATCH | User | `admin` 30/min/IP | Partial profile update (name, username, bio, location, website, socials). 409 on taken handle. Revalidates `/u/<handle>` (old + new). |
| `/api/profile` | DELETE | User | `admin` | Permanent account deletion; requires `{confirm:true}`. Deletes likes+comments in a transaction; posts detach (SetNull); Account/Session cascade. |
| `/api/profile/avatar` | POST | User | `admin` | Avatar upload (same constraints as `/api/upload`); sets `user.image`; revalidates profile. |
| `/api/profile/password` | POST | User | `login` 10/min/account | Change password; verifies current; rejects OAuth-only accounts. |
| `/api/profile/username` | GET | User | — | `?handle=` availability check (own handle counts available). |
| `/api/users/[id]/membership` | PATCH | Admin | `admin` | Set membership `Free`/`Premium`. |

## Misc

| Route | Method | Auth | Limit | Purpose |
|---|---|---|---|---|
| `/api/subscribe` | POST | Public | `subscribe` 10/min/IP | Waitlist email capture (idempotent upsert). |
| `/api/ticker` | GET | Public | — | Top-coin prices (CoinGecko), `revalidate 10`, graceful fallback payload. |
| `/api/chart` | GET | Public | — | OHLC candles (BTC/ETH; 1/7/30d), `revalidate 120`. |

## Validation sources
- Profile/password schemas: `src/lib/profile.ts` (username `[a-z0-9_]{3,20}`,
  reserved-words list, social-handle normalization, bio ≤280).
- Post schemas: in `api/research` routes. OTP rules: `src/lib/otp.ts`
  (HMAC-SHA256 hash, 10-min TTL, 5 attempts, single-use).
