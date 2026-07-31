---
name: pre-merge
description: Use before merging a branch or PR on this project, especially one that touches routes, caching, data fetching, or realtime. Triggers - "run the pre-merge checks", "is this safe to merge", "check this branch before I merge", reviewing a PR for cost or performance regressions, or preparing a branch for squash-merge to main. Runs the route-table comparison against main, the diff scan for cost patterns, the read-the-diff pass, and requires every PR to state a live observable - what changes on the deployed site, how to check it, and what would falsify it. Green CI is not permission to merge and does not satisfy this. For the actual caching numbers, route baseline, and cost traps, load the cost-check skill - this skill owns the procedure, cost-check owns the facts.
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

## Step 4 — The observable: state it before merge, check it after

**This is the step that gets skipped, and skipping it has already shipped a wrong
fix.** It is not optional and it is not "nice to have if there's time".

### Before merge: every PR body names its observable

Three lines, in the PR description:

1. **What changes on the live site** — one specific, checkable thing.
2. **How to see it** — the exact command, console one-liner, or click path. Not
   "check the logs"; the actual thing to run.
3. **What result would mean it did NOT work** — the falsifier. If you cannot write
   this, you do not yet understand what you changed.

**If a PR has no observable, say so explicitly in the body** — "no live observable:
test-only change" / "docs only". Writing that sentence is the point: it forces the
question, and it catches a change that quietly has no effect.

### After merge: run it, record the answer

Run the check on the deployed site. Put the result in the changelog entry. A check
that is defined but never run is worth nothing.

### The constraint that shapes this

**Claude cannot reach xyzcrypto.io** — outbound egress to it is blocked by policy
(403 on CONNECT). Every live check therefore has to be run by the owner.

So the division of labour is fixed: **Claude writes the exact one-liner, the owner
runs it, Claude interprets the output.** That has already produced real findings —
the Upstash rate-limit probe and the `x-vercel-cache`/`age` measurement both did.
The failure mode is not that this is slow; it is Claude not writing the one-liner
unless asked.

### Why this rule exists — PR #190

#190 shipped with green CI, all pre-merge steps passed, a verified build-log check,
and a claimed "10× fewer regenerations". **All of it wrong.** It changed
`export const revalidate` when `s-maxage` was what governed the CDN, so the problem
it claimed to fix was still live after merge.

It was caught only because the owner asked how to test it, and the answer took four
minutes. The build-log check that "verified" it faithfully reported the layer that
had just been changed, and said nothing about the layer that mattered.

**Green CI plus a passing internal check is not evidence the change did anything.**

### Useful observables by change type

| Change | Observable |
|---|---|
| Caching / ISR / `Cache-Control` | `x-vercel-cache` + `age` headers across repeated fetches — `age` resets when regenerated |
| Rate limiting | loop past the bucket limit, expect a `429` (or the documented silent drop) |
| Client bundle / `server-only` | browser console on the affected page — noise gone, or the value absent from `_next/static` chunks |
| Schema / migration | build log shows `in sync with your Prisma schema`, then exercise the feature |
| API behaviour | call the endpoint and read the response, not the source |
| Anything with a `catch {}` | the swallowed path — silence is not success |

### Also on the preview URL, when the PR touches UI

Lighthouse vs production for LCP/CLS/TBT; click through the surfaces touched (React
19 hydration issues surface in interactive components, so exercise forms, buttons and
the composer, not just page loads); Network tab for unexpected repeat requests.

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
| Docs only | **4**, 5 |
| Config / dependency change | 1, 2, **4**, 5 |
| Source change, no caching or data touched | 1, 2, 3, **4**, 5 |
| Anything touching caching, routes, data fetching, or realtime | All |
| Framework or major dependency upgrade | All, and do not skip Step 6 |

**Step 4 is in every row on purpose.** It used to be optional for everything except
the heaviest PRs, and was skipped accordingly — which is how #190 merged as a fix for
a problem that was still live. For a docs-only PR, satisfying Step 4 is one sentence
("no live observable: docs only"). That sentence is cheap and it is the whole
safeguard: it forces the question of whether the change does anything at all.

## Standing rules

- Run these **before** merging, not after. The point is preserving the option to say no.
- **Green CI is not permission to merge.** Neither is a passing internal check — see
  Step 4. What counts is the change being observed working on the deployed site.
- **No PR merges without an observable stated in its body**, even if the observable is
  "none — docs only". The count of merged PRs is not the metric; whether each one
  demonstrably improved the site is.
- **Write the one-liner, don't just name the check.** Claude cannot reach the live
  site, so any check it does not hand over as copy-pasteable never happens.
- Report-only when watching someone else's branch. An unattended fix pushed to the
  branch invalidates any comparison already run against it.
- Every push triggers a Vercel preview build, which spends budget. Batch pushes.
- `main` is production and auto-deploys. Never commit to it directly; feature branch
  → PR → CI green → squash-merge.

## Reporting

State the totals on both sides, name any route that changed mode or window, and say
explicitly which steps you ran and which you could not. "No change" is a useful
result and should be reported as one — silence is not the same as a pass.
