---
name: pre-merge
description: Use before merging a branch or PR on this project, especially one that touches routes, caching, data fetching, or realtime. Triggers - "run the pre-merge checks", "is this safe to merge", "check this branch before I merge", reviewing a PR for cost or performance regressions, or preparing a branch for squash-merge to main. Runs the route-table comparison against main, the diff scan for cost patterns, and the read-the-diff pass. Green CI is not permission to merge and does not satisfy this. For the actual caching numbers, route baseline, and cost traps, load the cost-check skill - this skill owns the procedure, cost-check owns the facts.
---

# Pre-merge checks — xyzcrypto

**Purpose:** verify a branch does not regress cost or performance **before** it merges
to `main` and auto-deploys.

**Why this exists:** CI (`typecheck → lint → test → build`) proves nothing broke. It
cannot detect a page that stopped being cached, a new polling loop, or a bundle that
grew. Those surface as a Vercel usage overage days later, not as a red check.

**Load the `cost-check` skill alongside this one** for the route baseline, the ISR
windows, the payload/data-cache trap, the bundle-size blind spot, and the
`<img>` vs `next/image` trade-off. Those numbers live there, once.

---

## Step 1 — Route table comparison

The core cost check.

1. Confirm a clean working tree. Check out fresh `main`, `npm run build`, save the
   route table.
2. Check out the branch, run `npm install` (**mandatory** if `package.json` or
   `package-lock.json` changed), `npm run build`, save the route table.
3. Diff and report:
   - **Any route that changed between `○` (Static) and `ƒ` (Dynamic), in either
     direction.** `○ → ƒ` is the most expensive regression class here.
   - **Any change to a `Revalidate` window.** Shorter = more ISR Writes and more FOT.
   - **Totals on each side:** routes, static, dynamic, ISR — compare against the
     baseline in `cost-check`.
4. Return to `main` with a clean tree. Nothing pushed, nothing merged.

## Step 2 — Diff scan for cost-relevant patterns

Route tables catch cached-to-uncached flips. They miss changes that raise cost
without changing render mode. Scan `git diff main...<branch>` for:

**Caching** — new `force-dynamic`, `revalidate = 0`, `cache: "no-store"`; a removed
`unstable_cache`; changed `Cache-Control` / `s-maxage` / `stale-while-revalidate`.

**Request volume** — new or shortened `setInterval` polling in client components
(multiplies invocations across every open tab); Realtime channels created directly
instead of via `src/lib/realtimeClient.ts`; new or re-enabled `schedule:` crons in
`.github/workflows/`.

**Data transfer** — new external `fetch` calls (watch the 2 MB data-cache limit);
`next/image` replacing an external `<img>`.

**Database** — Prisma queries inside loops (N+1); new query shapes with no matching
index in `schema.prisma`.

`cost-check` carries a ready-made grep for this scan.

## Step 3 — Bundle size

**Unavailable, not passed.** Next 16 removed the size columns from build output and
there is no replacement on this project yet. See `cost-check` for the detail and the
two ways to close the gap. Report it as a known blind spot rather than skipping it
silently.

## Step 4 — Real performance (outside Claude Code)

Every PR gets a Vercel preview URL. Local builds cannot measure real Core Web Vitals,
hydration behaviour, or whether a page actually looks right.

On the preview URL: run Lighthouse and compare LCP/CLS/TBT against production; click
through the surfaces the PR touches (React 19 hydration problems surface in
interactive components, so exercise forms, buttons and the composer, not just page
loads); watch the Network tab for unexpected repeat requests, which is where a new
polling loop becomes visible.

## Step 5 — Read the diff yourself

No automated check answers "is this what I asked for."

```bash
git diff --stat main...<branch>
git diff main...<branch> -- package.json next.config.mjs
```

Skip mechanical churn (codemods, formatting). Read config changes, new dependencies,
and anything touching auth, caching, or data access.

## Step 6 — After merging, watch usage

See `cost-check` → "After a merge".

---

## Scaling the checks to the PR

| PR type | Steps to run |
|---|---|
| Docs only | 5 |
| Config / dependency change | 1, 2, 5 |
| Source change, no caching or data touched | 1, 2, 3, 5 |
| Anything touching caching, routes, data fetching, or realtime | All |
| Framework or major dependency upgrade | All, and do not skip Step 6 |

## Standing rules

- Run these **before** merging, not after. The point is preserving the option to say no.
- **Green CI is not permission to merge.**
- Report-only when watching someone else's branch. An unattended fix pushed to the
  branch invalidates any comparison already run against it.
- Every push triggers a Vercel preview build, which spends budget. Batch pushes.
- `main` is production and auto-deploys. Never commit to it directly; feature branch
  → PR → CI green → squash-merge.

## Reporting

State the totals on both sides, name any route that changed mode or window, and say
explicitly which steps you ran and which you could not. "No change" is a useful
result and should be reported as one — silence is not the same as a pass.
