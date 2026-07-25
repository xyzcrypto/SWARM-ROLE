# Pre-Merge Cost & Performance Checks — xyzcrypto.io

**Purpose:** verify a PR branch does not regress cost or performance **before** it merges to `main` and auto-deploys.

**Why this exists:** CI (`typecheck → lint → test → build`) proves nothing broke. It cannot detect a page that stopped being cached, a new polling loop, or a bundle that grew. Those show up as a Vercel usage overage days later, not as a red check. This file closes that gap.

**How to use it:** commit this into `docs/`, then invoke it by name in the Code tab instead of pasting a long prompt:

> Run the pre-merge checks in docs/PRE-MERGE-CHECKS.md against the branch for PR #\<number>. Report only. Do not merge, do not push, and leave me on main when you're done.

---

## Step 1 — Route table comparison (Claude Code)

The core cost check. Compare `main` against the branch:

1. Confirm a clean working tree. Check out fresh `main`, run `npm run build`, save the route table.
2. Check out the PR branch, run `npm install` (mandatory if `package.json` or `package-lock.json` changed), run `npm run build`, save the route table.
3. Diff and report:
   - **Any route that changed between `○` (Static) and `ƒ` (Dynamic), in either direction.** A `○ → ƒ` flip means a page that was served from cache now renders on every request. This is the single most expensive regression class on this project.
   - **Any change to a `Revalidate` window.** A shorter window means more ISR Writes and more Fast Origin Transfer.
   - **Totals on each side:** total routes, static count, dynamic count, ISR count.
4. Return to `main` with a clean tree. Nothing pushed, nothing merged.

**Current baseline (Next 16.2.11):** 124 routes, 22 static, 102 dynamic, 12 ISR routes.

**Known ISR windows:** `/` 5m · `/markets` 5m · `/research` 5m · `/tools` 1h · `/news` ≈2m · `/api/ticker` 1m · `/api/markets/coins` 2m · `/api/markets/defi` 2m · `/api/markets/dex` 5m · `/api/markets/global` 20s · `/api/markets/perp` ≈3m · `/api/markets/yields` 5m. All with a 1y expire.

---

## Step 2 — Diff scan for cost-relevant patterns (Claude Code)

Route tables catch cached-to-uncached flips. They miss changes that raise cost without changing render mode. Ask for a scan of `git diff main...<branch>` for:

**Caching**
- New `export const dynamic = "force-dynamic"`, `export const revalidate = 0`, or `cache: "no-store"`
- Removal of an `unstable_cache` wrapper
- Changes to `Cache-Control` / `s-maxage` / `stale-while-revalidate` headers on API routes

**Request volume**
- New or shortened `setInterval` / polling loops in client components. Each one multiplies function invocations across every open tab.
- New Supabase Realtime channel subscriptions created directly instead of going through the shared singleton in `src/lib/realtimeClient.ts`. The singleton exists specifically to avoid redundant WebSockets per page.
- New or re-enabled cron schedules in `.github/workflows/`

**Data transfer**
- New `fetch` calls to external APIs. Next's data cache rejects responses over 2MB, so a large payload gets re-fetched and re-parsed on every revalidation. Four llama.fi endpoints already do this (~33MB combined per revalidation).
- New `next/image` usage replacing an external `<img>`. An `<img>` pointing at Supabase Storage is fetched browser-to-Supabase and costs zero Vercel transfer. Routing it through `next/image` consumes both Fast Origin Transfer and image-optimization quota. On this project the lint rule's "best practice" is sometimes the more expensive choice.

**Database**
- Prisma queries added inside loops (N+1)
- New query shapes with no matching index in `schema.prisma`

---

## Step 3 — Bundle size (currently a blind spot)

Next 16 removed the `Size` and `First Load JS` columns from build output. Verified: they are absent even when the build runs in a real terminal. **There is currently no bundle-size regression detection on this project.** The old baseline was 160 kB First Load JS shared by all, under Next 14, and it has no direct successor.

Until this is fixed, a PR can grow the client bundle substantially and nothing will report it.

Two ways to close it:
- **No new dependency:** read `.next/app-build-manifest.json` and sum the corresponding `.next/static/chunks/*` file sizes per route, on both sides, and diff. Establishes a new baseline in the same units on each run.
- **Tooling:** add `@next/bundle-analyzer` behind an env flag so it only runs on demand.

Worth doing once as its own small PR. Until then, treat Step 3 as unavailable rather than passed.

---

## Step 4 — Real performance (outside Claude Code)

Every PR gets a Vercel preview URL automatically. Local builds cannot measure real Core Web Vitals, hydration behaviour, or whether a page actually looks right.

On the preview URL:
- Run Lighthouse (Chrome DevTools → Lighthouse) and compare LCP, CLS, TBT against production
- Click through the surfaces the PR touches. React 19 hydration problems surface in interactive components, not static ones, so exercise forms, buttons, and the composer rather than just loading pages.
- Check the browser Network tab for unexpected repeat requests, which is where a new polling loop becomes visible

---

## Step 5 — Read the diff yourself

No automated check answers "is this what I asked for." Start with shape, then read where judgment lives:

```
git diff --stat main...<branch>
git diff main...<branch> -- package.json next.config.mjs
```

Skip mechanical churn (codemods, formatting). Read config changes, new dependencies, and anything touching auth, caching, or data access.

---

## Step 6 — After merging, watch usage

Cost impact only becomes real once deployed. Check the Vercel usage dashboard daily for about three days after merge, specifically **Fast Origin Transfer**, **ISR Writes**, and **Fluid Active CPU**.

A caching regression is invisible for hours and then obvious on the bill. If usage jumps, the route table diff from Step 1 tells you where to look.

---

## Scaling the checks to the PR

| PR type | Steps to run |
|---|---|
| Docs only | 5 |
| Config / dependency change | 1, 2, 5 |
| Source change, no caching or data touched | 1, 2, 3, 5 |
| Anything touching caching, routes, data fetching, or realtime | All |
| Framework or major dependency upgrade | All, and do not skip Step 6 |

---

## Standing rules

- Run these **before** merging, not after. The point is preserving the option to say no.
- Green CI is not permission to merge.
- Report-only for watchers. An unattended fix pushed to the branch invalidates any comparison already run against it.
- Every push triggers a Vercel preview build, which spends budget. Batch pushes rather than pushing each small edit.
