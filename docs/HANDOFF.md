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
