---
name: cost-check
description: Use when a change could affect Vercel usage or page caching on this project. Triggers - adding or editing an API route; adding or changing a Cache-Control header, an `export const revalidate`, `dynamic = "force-dynamic"`, `cache: "no-store"`, or an `unstable_cache` wrapper; adding or shortening a setInterval/polling loop in a client component; adding a fetch to an external API; opening a Supabase Realtime channel; adding or re-enabling a cron in .github/workflows; swapping an <img> for next/image; or investigating a Vercel usage spike in Fast Origin Transfer, ISR Writes, or Fluid Active CPU. Also use when asked whether a change is "expensive", why a page stopped being cached, or what the route baseline is. This skill owns every caching and cost number for the project - do not restate them from docs.
---

# Cost & caching facts — xyzcrypto

This project runs on a **Vercel Hobby plan**. Three metrics are rationed and have
each already caused a real incident: **Fast Origin Transfer (FOT)**, **ISR Writes**,
and **Fluid Active CPU**. Assume any of them can be blown by a change that looks
harmless and passes CI.

This skill is the single home for these numbers. Other docs and skills should point
here rather than repeat them.

## Route baseline

Measured at `2f34b83` with `npm run build`:

**124 routes · 22 static · 102 dynamic · 12 ISR.**

Any change to those totals is a finding. The expensive direction is `○` (Static) →
`ƒ` (Dynamic): a page that was served from cache now renders on every request. That
is the single most expensive regression class on this project.

Count them excluding the legend lines — `○` (U+25CB) and `├` (U+251C) share a leading
UTF-8 byte, so a naive `grep -c '○'` over the whole table over-counts by one.

### Known ISR windows

`/` 5m · `/markets` 5m · `/research` 5m · `/tools` 1h · `/news` ≈2m · `/api/ticker` 1m ·
`/api/markets/coins` 2m · `/api/markets/defi` 2m · `/api/markets/dex` 5m ·
`/api/markets/global` 20s · `/api/markets/perp` ≈3m · `/api/markets/yields` 5m.
All with a 1y expire.

## The traps, in the order they have actually bitten

### 1. Poll interval shorter than the revalidate window
If a client polls faster than the route's `revalidate`, the window expires before
every poll and **each poll from every open tab triggers a regeneration**. Costs ISR
Writes and Fluid Active CPU.

Rule: `revalidate` >= poll interval, with margin.

Known drift (verified, still open as of the deep audit): `MarketsClient.tsx` polls
every 180s while `/api/markets/defi` and `/coins` revalidate at 120s and `/global`
and `/perp` at 150s — four of six misaligned. `/dex` and `/yields` are aligned at
300/300 and show the intended shape. Note that `changelog.md` claims these were
realigned; they were not. Verify against the route files, not the changelog.

### 2. Large external payloads silently defeat the data cache
Next's data cache **rejects responses over ~2 MB**. The `next: { revalidate }` hint
stays in the code looking effective while doing nothing, so the body is re-fetched
and re-parsed on every regeneration — burning Fluid Active CPU on `JSON.parse`.

`/api/markets/defi` fans out to four llama.fi endpoints (`historicalChainTvl`,
`protocols`, `v2/chains`, `stablecoins`, ~33 MB combined per revalidation) and then
discards nearly all of it — 30 trend points and the top 8 of each survive.

Before adding an external fetch with a cache hint, check the payload size
(`curl -sI <url>` → `content-length`). Over 2 MB means the hint is inert.

### 3. `<img>` → `next/image` is sometimes the *more* expensive choice
An `<img>` pointing at Supabase Storage is fetched browser-to-Supabase and costs
**zero Vercel transfer**. Routing it through `next/image` consumes both Fast Origin
Transfer and image-optimization quota. The lint rule's "best practice" is not the
cheap option here. Weigh it deliberately.

### 4. Inline `data:` images served from the DB
Base64 `data:` avatars stored in the DB get serialized into every response that
reads them. `stripInlineImage()` exists because this was served across six hot read
paths and blew FOT. Do not add a read path that returns a raw `data:` URL.

### 5. Every polled or public GET route needs `Cache-Control` from day one
- Anonymous-safe: `public, s-maxage=N, stale-while-revalidate=M`
- Personalized: `private, no-store`

Live examples: `api/ticker`, `api/news/social`, `api/chat/messages`. This rule exists
because of a real FOT incident. Do not wait for another one to retrofit it.

### 6. Realtime connections must share the singleton
Every realtime/presence hook goes through `src/lib/realtimeClient.ts`, which shares
one Supabase client. Creating a client directly opens a redundant WebSocket per page.

### 7. Crons are paused on purpose
Push-dispatch and watchdog GitHub Actions are `workflow_dispatch` only. The
`schedule:` blocks are deliberately disabled for the free plan. Re-enabling one is a
cost decision, not a cleanup.

### 8. Sync CPU on a hot path
`bcryptjs` is pure JS. A ~330 ms synchronous `bcrypt.compare()` added to the login
fast-fail path to close a timing oracle blew Fluid Active CPU on its own, and needed
the `loginIp` pre-bcrypt gate to recover. Treat any sync CPU on an unauthenticated
path as a cost question.

## Bundle size — currently a blind spot

Next 16 removed the `Size` and `First Load JS` columns from build output. Verified
absent even in a real terminal. **There is no bundle-size regression detection on
this project.** The old baseline was 160 kB First Load JS shared, under Next 14, and
has no direct successor.

Treat bundle size as **unavailable**, not as passed. A PR can grow the client bundle
substantially and nothing will report it.

Two ways to close it, when someone chooses to: sum the `.next/static/chunks/*` sizes
per route from `.next/app-build-manifest.json` on both sides and diff; or add
`@next/bundle-analyzer` behind an env flag.

Related: keep server-only modules out of the client graph. `src/lib/env.ts` has no
`import "server-only"` and reaches the browser via `src/lib/realtime.ts`, shipping a
zod schema and a `console.error` loop into public chunks.

## How to measure

```bash
# Route table for one side
npm run build 2>&1 | sed -n '/Route (app)/,/server-rendered on demand/p' > routes-<side>.txt

# Diff the two
diff routes-main.txt routes-branch.txt
```

Scan a diff for cost-relevant patterns:

```bash
git diff main...<branch> | grep -nE '^\+' | grep -iE \
  'force-dynamic|revalidate|no-store|unstable_cache|Cache-Control|s-maxage|stale-while-revalidate|setInterval|createClient|channel\(|fetch\(|next/image|prisma\.'
```

Also check for Prisma queries added inside loops (N+1) and new query shapes with no
matching index in `schema.prisma`.

## After a merge

Cost impact only becomes real once deployed. Check the Vercel usage dashboard daily
for about three days, specifically Fast Origin Transfer, ISR Writes, and Fluid Active
CPU. If usage jumps, the route-table diff tells you where to look.
