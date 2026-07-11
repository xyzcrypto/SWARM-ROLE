# Team Setup & Collaboration Guide

How to let **multiple people work on XYZ Crypto safely** — no one can break the
live site, and everyone can build in parallel. You do **not** need a second cloud
provider; you need the right *environments* + *workflow* (most of which the project
already gives you for free).

---

## 1. The big idea (why nothing breaks)

Production (the live site) only ever updates from **reviewed, tested code merged to
the `main` branch**. Everyone else works on their own **branch**, which Vercel
automatically deploys to a **separate preview URL**. So a teammate can build and
test on their own copy — the live site is untouched until their change passes
review + CI and is merged.

```
teammate → feature branch → auto preview deploy (own URL) → PR + review + CI green → merge to main → LIVE
```

This is exactly the workflow the whole build already used. The foundation is ready.

---

## 2. One-time setup (≈ 30 minutes)

### a) GitHub — code access
1. Repo → **Settings → Collaborators** → invite each teammate.
2. Give **Write** access (they can push branches + open PRs, but not force-merge).

### b) Branch protection (the safety lock — do this!)
Repo → **Settings → Branches → Add rule** for `main`:
- ✅ **Require a pull request before merging**
- ✅ **Require status checks to pass** (select the `build` / CI check)
- ✅ (recommended) **Require 1 approval**
- ✅ **Do not allow bypassing** / block force-pushes

Result: **no one — not even by accident — can push straight to production.** Every
change must be a reviewed, CI-passing PR.

### c) Vercel — deployments & previews
1. Move the project into a **Vercel Team** (Settings → invite members).
2. Members now see every branch's **Preview Deployment** to test on.
3. *Note:* the Vercel **Pro/Team** plan (~$20/member/month) is required for teams
   and for commercial use.

### d) Staging database (this is the real "second environment")
So teammates can test without touching **live user data**:
1. Create a **second Supabase project** (free tier) → call it `xyz-staging`.
2. In Vercel → **Settings → Environment Variables**, set `DATABASE_URL` /
   `DIRECT_URL` **per environment**:
   - **Production** → the real Supabase DB
   - **Preview** → the staging DB
3. Now preview deploys read/write the staging DB. Live data stays safe.

---

## 3. Daily workflow (for every teammate)

1. `git checkout main && git pull` — start from the latest.
2. `git checkout -b feature/<short-name>` — a new branch per task.
3. Build + commit. **Run before pushing:** `npm run typecheck && npm run lint &&
   npm run test && npm run build` (all must be green — CI runs the same).
4. `git push -u origin feature/<short-name>` → open a **Pull Request** to `main`.
5. Vercel posts a **preview URL** on the PR — test the change there.
6. Get a review, CI goes green → **squash-merge** → production updates automatically.

**Golden rules:** never commit to `main` directly · one branch per task · keep PRs
small · never commit secrets (use env vars).

---

## 4. Roles (suggested)

| Role | GitHub | Notes |
|---|---|---|
| Owner / lead | Admin | Manages settings, merges, secrets. |
| Engineer(s) | Write | Branches + PRs; can't bypass protection. |
| Designer / content | Write or via PR | Edits content/copy through PRs too. |
| Reviewer | Write | Approves PRs before merge. |

---

## 5. New-engineer onboarding checklist

Give a newly-hired engineer:
1. **Repo access** + point them at `docs/` — start with `CLAUDE.md`, then
   `docs/HANDOFF.md`, then `docs/AUDIT-2026-07-11.md`.
2. **Local run:** `npm install` → copy `.env.example` to `.env` (fill values) →
   `npm run dev`.
3. **The commands:** `typecheck · lint · test · build` (definition of done).
4. **Env/dashboard access:** Vercel + Supabase (read-only first, then as needed).
5. **The pending ops** (see AUDIT §10): apply migration 20, configure Supabase
   Storage, set the domain + GSC.

Because the stack is mainstream (Next.js/TypeScript), typed, tested, and
documented, a competent engineer is productive within a few days.

---

## 6. Cost summary

| Item | Cost |
|---|---|
| GitHub collaborators + branch protection | **Free** |
| Vercel Team (Pro) | ~**$20 / member / month** |
| Staging Supabase project | **Free tier** |

**Bottom line:** with GitHub collaborators + branch protection + Vercel previews
(already there) + a free staging database, your whole team can build in parallel
**without ever risking the live site.**
