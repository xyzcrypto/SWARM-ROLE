# CLAUDE.md — XYZ Crypto (read me first)

This file is the continuity anchor for any Claude / AI session (from **any**
account) and any human developer. Read this, then `docs/HANDOFF.md`, and you have
full context to continue safely.

## What this is
**XYZ Crypto** — premium Web3 ecosystem site (research hub, market data, user
accounts/profiles, premium content). Dark luxe design: gold + mint on near-black.
- **Stack:** Next.js 16.2 (app router, React 19) · TypeScript · Tailwind · framer-motion ·
  Prisma → Supabase Postgres · next-auth (JWT) · Upstash rate-limits* · Resend
  email · Supabase Storage · Sentry* · Vercel hosting.
  <br>*Don't read this list as "all wired up". **Upstash: ✅ verified live in
  production 2026-07-29** — limiters genuinely enforce (probe + method in
  `docs/HANDOFF.md §8`). Keep the no-op caveat in mind anyway: when `UPSTASH_*` is
  unset, `rateLimit()` returns success unconditionally and every limiter silently
  no-ops. **Sentry: 🔴 still dark** — no DSN in any runtime (browser, server or
  edge), so nothing is reported anywhere. Also dark: **XYZ Sentinel** (`/api/watchdog`)
  — it 403s (`CRON_SECRET` *is* set in Vercel; cause not yet pinned) and its cron is
  paused. **Migrations were silently failing on every deploy until 2026-07-29** and are
  now fixed — but the failure mode is invisible, so read the build log (see Gotchas).
  All: `docs/HANDOFF.md §8`.
- **Owner contact:** hi@xyzcrypto.io

## Commands
```bash
npm run dev          # local dev server
npm run typecheck    # tsc --noEmit
npm run lint         # eslint src (ESLint 9 flat config: eslint.config.mjs)
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

## Architecture map (full detail + current status: docs/HANDOFF.md §5 — treat
docs/api-reference.md and docs/backend-state.md as possibly-stale background,
not authoritative; HANDOFF.md is kept current)
**Pages:** `/` (ISR 300) · `/research` (ISR 300) · `/research/[slug]` (ISR 300 for
free posts — `getServerSession()` only called when `post.premium`, so free posts
are CDN-cacheable and premium posts stay fully dynamic/never cached) ·
`/u/[username]` (ISR 300 + revalidatePath on edit) · `/settings` (dynamic, auth) ·
`/dashboard` (dynamic, ADMIN) · `/community` (dynamic — known Fast Origin Transfer
lever if usage climbs again, see HANDOFF §7) · `/tools`, `/markets`, `/news`,
`/messages` (mixed ISR/dynamic per sub-route) · `/login` `/signup`
`/forgot-password` `/terms` `/privacy` `/contact` (static).

**API routes** (all follow: `rateLimit → zod → auth gate → prisma → handleError`):
auth (signup/start, password/start+reset, [...nextauth]) · research CRUD ·
posts/[id]/like + comments · profile (PATCH/DELETE, avatar, password, username) ·
subscribe · upload (admin) · ticker/chart (CoinGecko, cached) · users/[id]/membership.

**Key libs (`src/lib/`):** `api.ts` (ok/fail/handleError/getSessionUser/
getAdminSession) · `auth.ts` (NextAuth options) · `ratelimit.ts` (Upstash, keyed
buckets) · `otp.ts` (HMAC-hashed 6-digit codes) · `email.ts` (Resend, console
fallback) · `storage.ts` (Supabase upload) · `profile.ts` (zod schemas + handle
normalization) · `env.ts` (the intended single door for env access — route new reads
through it, but note it does **not** validate: the zod result is only logged,
`process.env` is then re-read directly for the exported values
(`src/core/env/env.ts:55,66-70`), so `.url()` and `.min(16)` never reject or gate
anything. It **is** now server-only — `import "server-only"` was added in #189, so a
`"use client"` file importing it is a build error; client components get channel
helpers from `realtime-channels.ts`)
· `seo.ts`/`jsonld.tsx`.

## Conventions (match these — don't invent new patterns)
- API: `ok(data)` / `fail(msg, status)` / `handleError(err, "context")`; zod-parse
  every body; pick the right rate-limit key (`signup`/`login`/`password`/`admin`/
  `comment`/`like`/`subscribe`, plus per-feature buckets — see `ratelimit.ts`).
  Security-sensitive flows use **two independent keys**: an IP-keyed limiter
  *and* a target-keyed one, so neither IP rotation nor a fixed victim can bypass
  it — login is `login` (per-email) + `loginIp` (20/min/IP, checked before any
  bcrypt runs), OTP send is `signup`/`password` (IP) + `otpEmail` (3/10min per
  target email). IP comes from `clientIp()`/`clientIpFromHeaders()`, which prefer
  the un-spoofable `x-vercel-forwarded-for` over `x-forwarded-for`.
- Server pages fetch + serialize (Dates → ISO) → pass to a `"use client"` component.
- Design tokens: `gold-*`, `mint-*`, `ink-*`; surfaces `.glass`/`.surface`; buttons
  `btn-primary`/`btn-gold`/`btn-ghost`/`btn-secondary`; reveal animations via
  `<Reveal>`; text `text-gold-gradient`, `text-shine` (bold accent sweep, one
  phrase per heading), `text-shimmer` (quieter continuous sweep for surrounding
  headline text). Inputs: see `Field` in `LoginForm.tsx`. Homepage hero headline
  uses **Fraunces** (serif, `--font-fraunces` CSS var) — scoped to that one
  headline only, not the shared `font-display` class (stays Geist Sans
  everywhere else; a site-wide font change was tried and explicitly reverted).
- Never expose user emails publicly (use `maskEmail`); never put secrets in code
  or docs (env names only — values live in Vercel/Supabase dashboards).
- `prefers-reduced-motion` policy (revised this session): only the heavy
  full-screen ambient loops (mesh, aurora, particles, starfield twinkle,
  Saturn/Moon bob) are gated by it. The ticker marquee, text-shine/shimmer,
  shooting stars, and the whole Icons3D system (`.i3d-*`) are deliberately
  **exempt** — treated as core brand identity, not decoration, after repeated
  reports of the site looking "static" traced to reduced-motion being active
  in the test environment. Default new decorative CSS animations to exempt
  unless they're a genuinely heavy full-screen effect. One-shot framer-motion
  entrance/reveal animations were never gated on this in the first place.
- Every new public/polled GET API route should set `Cache-Control` from day
  one (`public, s-maxage=N, stale-while-revalidate=M` for anonymous-safe
  responses, `private, no-store` for personalized ones) — see `api/ticker`,
  `api/news/social`, `api/chat/messages` for the live pattern. This exists
  because of a real Vercel Fast Origin Transfer usage scare — don't wait for
  another one to retrofit it on a new route.

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
- **Migrations apply on production deploys only, and a failure now fails the build.**
  `vercel-build` runs `prisma generate && node scripts/db-push.mjs && next build`.
  `scripts/db-push.mjs` skips unless `VERCEL_ENV === "production"` (so local builds, CI
  and **preview deploys** never touch the schema — previews share the production
  `DATABASE_URL`), retries 3× with 2s/4s backoff, then **fails the build loudly**. A
  failed build never takes the site down: Vercel keeps the previous deployment serving
  and only swaps the production alias after a build succeeds.
  - ⚠️ **It did not always work this way, and that is the lesson.** Until 2026-07-30 the
    script was `prisma db push --skip-generate || echo 'db push skipped …'`. That `||`
    swallowed every non-zero exit, so the deploy succeeded and **CI went green whether or
    not the schema synced**, with no signal anywhere but the build log.
  - This is not hypothetical: **from an unknown date until 2026-07-29, `db push` failed
    on every single deploy** with `P1001: Can't reach database server at
    db.<ref>.supabase.co:5432`, and nobody noticed for weeks. Cause was `DIRECT_URL`
    pointing at the *direct* Supabase host (IPv6-only) from an IPv4-only Vercel runtime;
    fixed by repointing it at the **session pooler** (`…pooler.supabase.com:5432`).
    History + full diagnosis: `docs/HANDOFF.md §8`.
  - **The check, whenever schema matters:** open the deployment's Build Log and look for
    `in sync with your Prisma schema`. A failure is now loud (`SCHEMA SYNC FAILED`, build
    red) rather than silent, but read the log anyway — an earlier version of this line
    said "don't assume a migration is 'pending' just because it's recent", which nudged
    readers toward assuming success and is exactly why the outage above went unseen.
- Feature branches get squash-merged, so the branch's **remote** copy never
  fast-forwards to the squash commit — the next push from a freshly-reset local
  branch will be rejected as non-fast-forward. This is expected: verify
  `git diff origin/<branch> <latest-main-sha>` is empty, then
  `git push --force-with-lease`. Full detail + the "always reset from fresh
  origin/main before starting new work" rule: `docs/HANDOFF.md §2`.
- A stale cached page can reference a JS chunk hash that no longer exists after
  a new deploy → 404 served as HTML → browser refuses to execute it (MIME
  mismatch) → hydration silently never finishes → the page LOOKS static (no
  animations, stale data) even though nothing crashed. **`public/sw.js` no
  longer caches navigations at all** (2026-08-03), so an HTML shell can never
  outlive the chunks it names and this class is gone — you do NOT need to bump
  the SW cache version on every deploy any more. That ritual was the previous
  mitigation and it did not survive contact with reality: the version was last
  bumped in #140 and six deploys shipped over it in one day, which is when the
  blank-page reports started. `PwaSetup.tsx`'s guarded one-shot reload stays as
  a backstop for dynamic-import chunk errors. Cost: a previously-visited page
  no longer renders offline (`/offline.html` still does), which is the right
  trade for a live market/chat app.
- **Nothing that reaches the DOM may be derived from a client-only signal
  during render.** This caused the site's worst bug: `app/template.tsx` wrapped
  every route in a `motion.div` unless framer-motion's `useReducedMotion()` said
  otherwise. That hook returns `null` on the server but reads `matchMedia` on
  the client's FIRST render, so reduced-motion visitors got a different DOM
  shape than the server sent, React threw `#418` on **every page** and
  re-rendered the whole document client-side. The server was also shipping every
  page at `opacity: 0`, so any hydration failure showed as a **blank page** with
  the content present but invisible. Reduced motion is on by default under
  Android battery saver / iOS Low Power - this hit phones hardest.
  - Use `useReducedMotionSafe()` / `useMediaQuery()` from `useClientFlag.ts`
    (`useSyncExternalStore` with a server snapshot), never framer-motion's
    `useReducedMotion()`, for anything that renders. Even `whileTap={reduced ?
    undefined : ...}` counts: framer-motion emits a `tabindex` attribute when a
    gesture prop is present.
  - Prefer a CSS media query over a hook whenever the effect can be expressed in
    CSS. A media query is not a render input, and the result survives JS failing.
  - Never make content depend on JS to become visible.
- **Format dates with an explicit `timeZone`.** Vercel runs UTC, readers do not.
  `toLocaleDateString("en-US", …)` pins the locale but leaves the timezone to
  the runtime, so a timestamp near midnight renders a different calendar day on
  each side of hydration - measured `Aug 2, 2026` (server) vs `Aug 3, 2026`
  (IST browser) on `/settings`, and `6:06 AM` vs `11:36 AM` on `/community`,
  both #418. `formatDate`/`formatDateWithDay`/`formatDateTime` pin UTC. Where a
  date genuinely means *the reader's* day (chat Today/Yesterday, clock times),
  render UTC through hydration and switch to local afterwards via
  `useHydrated()`. Same rule for `toLocaleString()` on numbers: pin `"en-US"`,
  because `en-IN` groups digits differently from 10,000 up.
- `Math.sin`/`Math.cos` are **not** required by ECMAScript to be correctly
  rounded, and Node and the browser really do differ in the last bits (observed:
  `5.721816934965318` vs `5.721816935692914`). Never let a raw transcendental
  result reach an SSR'd attribute - quantize it first. See
  `src/shared/utils/starfield-seed.ts` and its test.
- `background-clip: text` on a wrapper element does not paint through to
  nested inline children — apply gradient-text classes (`text-shine`,
  `text-shimmer`) to each leaf span individually, not a parent wrapping
  multiple children, or the un-covered children render invisible.

## Current state (2026-08-04)
**This section is a standing summary, not a history.** Per-change detail lives in
`docs/changelog.md` (newest first) and `docs/HANDOFF.md §7` (session by session);
open items live in `docs/HANDOFF.md §8`. Those are authoritative — if this section
disagrees with them, they win. It used to carry a dated narrative of every recent
session, which drifted out of date within a week and duplicated both.
- ✅ Live: homepage (orbital ecosystem + Fraunces hero headline with word-stagger
  reveal + continuous shimmer), research hub + premium gating, likes, comments,
  auth (email+password, OTP signup, Google optional), profiles (`/u/[handle]` +
  `/settings` + public Journal Activity feed), admin dashboard, community chat
  (reactions/replies/polls/pins; anonymous visitors get a read-only preview,
  logged-in members get the full live room - see HANDOFF.md §7), 1-on-1 DMs,
  Trading Journal (trades/analytics/risk/challenges, premium-tiered, shareable
  cards), Markets hub, News hub (AI briefings - manual "Generate" trigger, not
  auto-fired - push notifications, saved stories), XYZ AI assistant, `/terms`
  + `/privacy`.
- 🗂️ **`src/` is organised into `modules/` · `core/` · `shared/` (#203).** The old
  `src/lib/*` and `src/components/*` paths still exist as **one-line `export * from`
  re-export shims**. Import from the real module; and if you are writing a script or
  test that *reads a file*, point it at the real path — reading a shim silently
  matches nothing, which is how a check passes while verifying nothing.
- 🌏 **Functions run in Mumbai (`bom1`, see `vercel.json`), co-located with Supabase
  (#210).** The old ~250ms-per-query cross-region penalty is gone. Advice written
  before that — including `docs/AUDIT-2026-08-01-latency.md` — ranks findings around
  a gap that no longer exists; that file now carries a banner saying so.
- 🩹 **Recent work has been fixes and hardening, not new surface** — security batches,
  cost/caching alignment, the fail-loud migration guard, realtime ownership, and DM
  safety. Read `docs/changelog.md` for what and why.
- ⚠️ **Open OWNER actions live in `docs/HANDOFF.md §8` and only there.** The headline
  one: 🔴 **Sentry has no DSN in any runtime**, so nothing on this site reports an
  error from the browser, server or edge. `NEXT_PUBLIC_*` is inlined at build time,
  so adding the vars **requires a redeploy**. XYZ Sentinel (`/api/watchdog`) is also
  still dark. Do not re-list §8's items here — this file has already carried a copy
  that said a resolved item was still open.
- 🧪 **Established invariants have tests, and the tests are the record.** Rate limiting
  on every mutating handler, poll↔window alignment on every polled cached route
  (`markets-poll-alignment.test.ts` — markets *and* the ticker), server-only channel
  imports, journal-activity revocation. If you change one of those behaviours, the
  test tells you.
- 📋 **Before merging anything that touches routes, caching, data fetching or
  realtime, run the `pre-merge` skill** (route-table diff vs `main`, cost-pattern
  scan). CI proves nothing broke; it cannot see a page that stopped being cached
  or a new polling loop. The route baseline and every caching number live in the
  `cost-check` skill — see the Skills section above.
- 🔜 No specific next phase agreed with the owner as of this handoff — ask
  before assuming a direction. Full session-by-session detail: `docs/HANDOFF.md §7`.

## Skills (`.claude/skills/`)
Three project skills are committed to the repo, so any Claude session from any
account loads them on trigger instead of relying on someone naming a doc:

| Skill | Loads when | Owns |
|---|---|---|
| `pre-merge` | before merging anything touching routes/caching/data/realtime | the six-step check procedure, scaling table, standing rules |
| `cost-check` | touching an API route, poller, external fetch, `Cache-Control`, `revalidate`, realtime channel, or chasing a Vercel usage spike | **every caching and cost number** — route baseline, ISR windows, the 2 MB data-cache trap, bundle-size blind spot |
| `design-system` | building or restyling UI, choosing colors/spacing/motion, editing `tailwind.config.ts` or `globals.css` | the color rule, the narrow `prefers-reduced-motion` policy, the gradient-text gotcha |

Rule they follow: **a skill carries what changes a decision; the handbook in `docs/`
carries reference tables.** Don't duplicate a fact into both — duplicated facts drift.

## Docs book
`docs/SUMMARY.md` is the GitBook-compatible table of contents for the full
handbook (architecture, frontend, backend, API reference, security, runbook).
Update `docs/changelog.md` after every meaningful change.
