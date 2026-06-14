# Handoff & Continuity Guide

How to resume work on XYZ Crypto from **any** machine, any Claude account, or any
new developer — with zero context loss and zero secret exposure.

---

## 1. Resume from a new Claude account (3 steps)

1. **GitHub access** — the new account's Claude Code must be connected to GitHub
   with access to `xyzcrypto/SWARM-ROLE` (repo Settings → Collaborators, or the
   GitHub App's repository access list, if it isn't your own account).
2. **Open a session** on the repo: [claude.ai/code](https://claude.ai/code) → new
   session → select `xyzcrypto/SWARM-ROLE` (or `claude` in a local clone).
3. **First message to send:**
   > Read CLAUDE.md and docs/HANDOFF.md, then docs/SUMMARY.md for the full book.
   > Continue from the "Current state" section in CLAUDE.md.

That's it — `CLAUDE.md` is auto-read by Claude Code at session start, and this
guide fills in operations. The docs are written so no chat history is required.

## 2. Branch & release model

| Thing | Value |
|---|---|
| Production branch | `main` (auto-deploys via Vercel Git integration) |
| Work branches | `claude/...` feature branches → PR → CI green → **squash-merge** |
| CI | `.github/workflows/ci.yml`: prisma generate → typecheck → lint → test → build |
| Restore point | branch **`backup/v1.1-profiles`** (Profiles release snapshot) |
| Roll back | `git checkout -b restore backup/v1.1-profiles` → PR → merge |

Take a new `backup/<name>` branch (or ZIP via `git archive`) before each major phase.

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
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Image uploads (optional) | Uploads return 501 | Vercel ← Supabase → API keys |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GSC_VERIFICATION` | SEO/analytics (optional) | Wrong canonical / no GA | Vercel |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error monitoring (optional) | Sentry no-op | Vercel ← Sentry project |
| `SEED_ADMIN_PASSWORD` | `npm run seed` only | Insecure default `changeme123` — **always set, change after first login** | Local shell only |

Every optional integration **degrades gracefully** when unset — the app never
crashes from missing env. Local dev: copy names into `.env` (gitignored).

## 4. Pending operational state (check before building new features)

### ⚠️ Profiles DB migration (one-time, production Supabase)
The v1.1 Profiles release added columns that must exist in the prod DB. Until
applied, `/settings` and `/u/*` return a graceful 503 (rest of site unaffected).
Run **either** `npm run db:push` (with prod env), **or** this idempotent SQL in
Supabase → SQL Editor:

```sql
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "username"    TEXT,
  ADD COLUMN IF NOT EXISTS "bio"         TEXT,
  ADD COLUMN IF NOT EXISTS "location"    TEXT,
  ADD COLUMN IF NOT EXISTS "website"     TEXT,
  ADD COLUMN IF NOT EXISTS "twitter"     TEXT,
  ADD COLUMN IF NOT EXISTS "github"      TEXT,
  ADD COLUMN IF NOT EXISTS "telegram"    TEXT,
  ADD COLUMN IF NOT EXISTS "bannerImage" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE INDEX        IF NOT EXISTS "User_username_idx" ON "User"("username");
```

### ⚠️ Community Chat migration (one-time, production Supabase)
The chat (incl. reactions + replies) needs these tables/columns. Same flow —
`npm run db:push` **or** this **combined idempotent SQL** in Supabase → SQL
Editor. Safe to run whether or not an earlier version was already applied:

```sql
-- Base messages table
CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id"        TEXT PRIMARY KEY,
  "body"      TEXT NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'visible',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId"    TEXT NOT NULL,
  CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ChatMessage_status_createdAt_idx"
  ON "ChatMessage"("status", "createdAt");

-- Reply / quote (self-reference)
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "replyToId" TEXT;
DO $$ BEGIN
  ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToId_fkey"
    FOREIGN KEY ("replyToId") REFERENCES "ChatMessage"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Emoji reactions
CREATE TABLE IF NOT EXISTS "ChatReaction" (
  "id"        TEXT PRIMARY KEY,
  "emoji"     TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "messageId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  CONSTRAINT "ChatReaction_messageId_fkey" FOREIGN KEY ("messageId")
    REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChatReaction_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChatReaction_messageId_userId_emoji_key"
  ON "ChatReaction"("messageId", "userId", "emoji");
CREATE INDEX IF NOT EXISTS "ChatReaction_messageId_idx"
  ON "ChatReaction"("messageId");
```

### ⚠️ Analytics + post views migration (one-time, production Supabase) — APPLY THIS
Adds visit tracking + per-post view counts. Now also shipped as a real Prisma
migration: `prisma/migrations/5_post_views_pageview/`. Apply with
`npx prisma migrate deploy` (or `npm run db:push`) **or** paste this idempotent
SQL in Supabase → SQL Editor:

```sql
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "views" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "PageView" (
  "id"        TEXT PRIMARY KEY,
  "path"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PageView_createdAt_idx" ON "PageView"("createdAt");
```

The app is now **resilient** if this lags: a missing `views` column (P2022) no
longer 404s research posts or 500s the dashboard — views just read as 0 until
the migration runs. Apply it to enable real view/visit numbers.

### ⚠️ Notifications migration (one-time, production Supabase) — APPLY THIS
Adds the in-app notification system (navbar bell + unread badges). Shipped as a
real Prisma migration: `prisma/migrations/6_notifications/`. Apply with
`npx prisma migrate deploy` (or `npm run db:push`) **or** paste this idempotent
SQL in Supabase → SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS "Notification" (
  "id"        TEXT PRIMARY KEY,
  "type"      TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "body"      TEXT,
  "href"      TEXT,
  "read"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId"    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "Notification_userId_read_createdAt_idx"
  ON "Notification"("userId", "read", "createdAt");
-- FK (cascade on user delete); skipped if it already exists.
```

The app is **resilient** if this lags: `/api/notifications` maps a missing table
(P2021/P2022) to a quiet empty state, so the bell just shows no notifications
until the migration runs. After applying, run `npm run seed` once to **backfill
public usernames** for any pre-existing accounts (so every member has a working
`/u/<handle>` profile).

### ⚠️ Profile photo uploads — Supabase Storage setup (production)
Avatar/cover uploads need Storage configured, **else they return 501** ("Image
upload is not configured") and the avatar uploader falls back to its "Use a link"
(paste image URL) option.
1. Vercel env: set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (and
   `SUPABASE_STORAGE_BUCKET` if not the default `post-covers`).
2. Supabase → Storage → create a **public** bucket named `post-covers`.
3. `next.config.mjs` already allowlists `**.supabase.co`, so saved photos render.
The URL fallback works without any of this (https image from Unsplash, Cloudinary,
GitHub, Google or Supabase — hosts allowlisted for `next/image`).

**Realtime env (optional but recommended):** add to Vercel —
`NEXT_PUBLIC_SUPABASE_URL` (same value as `SUPABASE_URL`) and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Settings → API → **anon** key; this
key is public-safe by design). Without them the chat falls back to 10s polling.

### Verify everything works (run before and after changes)
```bash
npm ci && npx prisma generate
npm run typecheck && npm run lint && npm run test && npm run build
```
All four must pass — same gates as CI.

## 5. Roadmap position
Done: homepage + orbital ecosystem · research hub + premium gating · likes ·
comments · auth (email+password, OTP signup, optional Google) · profiles
(`/u/[handle]` + `/settings`) · admin dashboard · perf/bugfix audit pass.
**Next agreed phase: Community Chat.** Longer list: `frontend-roadmap.md`.

## 6. Publish this book to GitBook (owner, one-time, ~2 min)
1. [gitbook.com](https://www.gitbook.com) → sign in → **New Space**.
2. Space → **Configure → Integrations → GitHub Sync** → authorize → pick
   `xyzcrypto/SWARM-ROLE`, branch `main`, **root directory `docs/`**.
3. GitBook renders `docs/README.md` as the cover and `docs/SUMMARY.md` as the
   table of contents. Every merge to `main` auto-updates the book.
   Keep the space **private** unless you intend the docs to be public.
