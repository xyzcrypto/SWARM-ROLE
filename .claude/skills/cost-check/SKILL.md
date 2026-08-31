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

Measured at `59dddbf` with `npm run build`:

**137 routes · 25 static · 112 dynamic · 10 ISR.**

(Was 131/22/109/12 at `59dddbf`, and 124/22/102/12 at `2f34b83`. The six new routes
are the DM pin/hide work, `/api/ai/health` and the AI additions. **ISR fell 12 → 10
deliberately**: `/markets` and `/tools` are pure static shells — not `async`, no data
— so their `revalidate` only rebuilt byte-identical HTML, and it was removed.)

Any change to those totals is a finding. The expensive direction is `○` (Static) →
`ƒ` (Dynamic): a page that was served from cache now renders on every request. That
is the single most expensive regression class on this project.

Count them excluding the legend lines — `○` (U+25CB) and `├` (U+251C) share a leading
UTF-8 byte, so a naive `grep -c '○'` over the whole table over-counts by one.

### Known ISR windows

`/` **15m** · `/research` **30m** · `/research/[slug]` **1h** · `/news` **2m** ·
`/api/news` **120s** · `/api/ticker` **180s** · `/api/markets/coins` 200s ·
`/api/markets/defi` 200s · `/api/markets/global` 200s · `/api/markets/perp` 200s ·
`/api/markets/dex` 320s · `/api/markets/yields` 320s. All with a 1y expire.

`/markets` and `/tools` have **no window at all** — fully static, 0 ISR writes.

⚠️ **`/news`'s page window is pinned by the shared feed cache, not by its own
export.** The page declares `revalidate = 300` but `getNewsPage` uses
`NEWS_REVALIDATE` (120s) for both its fetch hint and its `unstable_cache`, and Next
takes the minimum across a segment — so the build reports the page at **2m**. This
is trap 1b in the wild on a *page* rather than an API route. `NEWS_REVALIDATE` is
the lever; changing the page export alone does nothing.

**Windows were raised on 2026-08-30 in response to real Vercel ISR analytics**
showing writes exceeding reads: `/` 385 writes vs 185 reads, `/research` 414 vs 177,
`/news` 560 vs 166, `/markets` 304 vs 175, `/tools` 88 vs 95. Raising them is safe
because on-demand `revalidatePath` already covers the content that actually changes
— both research write routes and all three whatsnew routes call it, so a publish
still appears immediately. The timers were only refreshing a member count and a
relative-time label.

The seven polled values are **derived from the client poll intervals**, not chosen
freely — each window is comfortably longer than the poll it serves:

| Route | Poll | Window | Poll defined in |
|---|---|---|---|
| `markets/{coins,defi,global,perp}` | 180s | 200s | `modules/markets/components/MarketsClient.tsx` |
| `markets/{dex,yields}` | 300s | 320s | ″ |
| `api/ticker` | 150s | **180s** | `modules/markets/lib/useTickerPoll.ts` |
| `api/news` | 90s | **120s** | `modules/news/components/NewsClient.tsx` (`NEWS_POLL_MS`) |

Changing either side without the other re-opens the drift below.

⚠️ `api/news` is the **third** distinct place a poll interval has lived — markets
client, then a hook, now a component. It sat at `revalidate = 90` and `s-maxage=90`
against a 90s poll (exactly equal, so jitter decided every tick) and produced the
worst write ratio on the site, **560 writes / 166 reads**. The alignment test did not
catch it because `TARGETS` did not list it. It does now. The lesson is the same one
the ticker taught: a check scoped to where the last bug was found does not prevent
the next one, so **any new polled route must be added to `TARGETS`**.

⚠️ Each of those seven routes **also sets its own `Cache-Control: s-maxage=…`**, and
that header — not the `revalidate` above — is what the edge honours (see trap 0).
They are kept equal on purpose. The Revalidate column in the build output shows the
`revalidate` value only, so it will look correct even when the edge is misaligned.

## The traps, in the order they have actually bitten

### 0. `s-maxage` governs the CDN edge — NOT `export const revalidate`
**Read this before trusting any window in this file.** If a route handler sets its
own `Cache-Control`, that header is what the Vercel edge honours. `export const
revalidate` controls Next's *internal* ISR cache, and the build output's Revalidate
column reports **that**, not the edge.

**Measured on production 2026-07-31**, `/api/markets/global` with
`revalidate = 200` and `Cache-Control: public, s-maxage=150, …`:

```
age: 0 … 121 … 142 → age: 162 STALE → age: 19   (reset)
```

It went stale at **162s**, tracking the 150s header, not the 200s export. So a fix
that changed only `revalidate` left the edge misaligned, while the build output
showed it as fixed.

**How to check the edge for real** — fetch the route repeatedly from a browser on
the live site and watch two response headers:

```js
const r = await fetch('/api/markets/global', { cache: 'no-store' });
r.headers.get('x-vercel-cache');  // HIT | STALE | MISS | PRERENDER
r.headers.get('age');             // seconds; resets when regenerated
```

`age` climbing past a window and resetting *there* tells you which number is in
charge. Nothing in the repo or the build log can tell you this.

**The same method confirmed a fix, 2026-08-04** — `/api/ticker` after #207 set both
layers to 180s:

```
age  51 … 147 … 157 … 167 … 177   HIT
age 188                            STALE
age   9                            HIT     (regenerated)
```

Expiry brackets between 177 and 188 at a ~10.5s sampling interval — **180s, the
`s-maxage`**. So the method works in both directions: it caught #190 shipping a
no-op, and it proved #207 landed. **Two data points, both saying the header wins.**
Run it after any caching change; the source file cannot answer this question.

**Rule:** keep `s-maxage` and `revalidate` equal on any route that sets both, and
size them off the client poll. `markets-poll-alignment.test.ts` enforces both.

### 1. Poll interval shorter than the revalidate window
If a client polls faster than the route's `revalidate`, the window expires before
every poll and **each poll from every open tab triggers a regeneration**. Costs ISR
Writes and Fluid Active CPU.

Rule: `revalidate` >= poll interval, with margin.

**Pinned by a test** — `src/lib/__tests__/markets-poll-alignment.test.ts` drives off an
explicit `TARGETS` list of every polled cached route, reads each one's poll interval
from the file it actually lives in, and fails if either the `revalidate` or the
`s-maxage` is shorter than that poll (or equal to it, since exactly-equal makes jitter
decide). **Adding a polled route means adding it to `TARGETS`.**

**The history is the reason the test exists — twice over.**
1. Four of six markets routes were misaligned (`defi`/`coins` at 120s, `global`/`perp`
   at 150s against a 180s poll) while `changelog.md` claimed "pollers realigned to match
   each route's new window". Nothing failed and nothing logged; the only symptom was the
   bill. That is why this skill says **verify against the route files, never the
   changelog**.
2. `/api/ticker` then had the identical defect — a 60s window and 60s `s-maxage` against
   a 150s poll — and the test did **not** catch it, because its first version globbed
   `src/app/api/markets/*` only and the ticker's poll lives in its own hook. It was
   found by audit and fixed by hand in #207; #236 widened the test so it cannot recur.
   **A check scoped to where the last bug was found does not prevent the next one.**

⚠️ Second-order hazard after #203: anything that reads a file *by path* — this test,
`bundle-report.mjs`, any codemod — must point at the real `src/modules/…` / `src/core/…`
implementation, never the `src/lib` / `src/components` re-export shims. A shim is one
`export * from` line, so a regex against it matches nothing and the check passes while
verifying nothing at all.

### 1b. A single fetch hint inside a route governs the WHOLE route's ISR window
**Next takes the MINIMUM `revalidate` across a route segment.** So one
`next: { revalidate: N }` on any fetch inside a handler silently overrides
`export const revalidate`, no matter how the export reads.

This is the trap that makes finding #1 hard to verify by reading source. Found
2026-07-31: `/api/markets/global` exported `revalidate = 200` while a gas-price
RPC inside it was pinned at `next: { revalidate: 20 }`, and `/api/markets/coins`
had the same shape with a `120` trending fetch. Both exports looked correct; only
the build output disagreed.

**Scope this correctly** — an earlier version of this note (and PR #190) claimed
the route therefore "regenerated every 20 seconds, ~10× the intended rate". That
was wrong: per trap 0, the **edge** was on the 150s `s-maxage` header the whole
time. What a short inner hint actually costs is that the *origin function*
re-fetches and re-parses its upstream APIs whenever it runs, rather than serving
from Next's data cache — real Fluid Active CPU and upstream bandwidth, but not a
10× regeneration rate. Fixing it is still worth doing; just do not overstate it.

**So: reading `export const revalidate` is NOT enough.** Either read the build
output's Revalidate column (it shows the effective value), or grep the handler for
`next: { revalidate:` and check every literal. Prefer passing the shared
`{ revalidate }` const to inner fetches so they cannot drift apart.

**An `unstable_cache` TTL counts toward that minimum too** — not just `fetch`
hints. Measured 2026-08-17 while moving the >2 MB llama.fi bodies behind
`unstable_cache`: a TTL of 200s inside a shared module pulled `/api/markets/dex`
from **≈5m to ≈3m** in the build output, under its **300s** client poll, while
the route file still read `export const revalidate = 320`. Nothing in the route
file was wrong; only the route table showed it.

**So a shared cache TTL must be >= the LARGEST window among its consumers**,
which is the opposite of the intuitive "use the shortest so nobody gets stale
data". The consumer with the longest window is the one whose window you break.

Pinned by `src/lib/__tests__/markets-poll-alignment.test.ts`, which fails on any
inner hint shorter than its route's window, and on any shared TTL in
`src/modules/markets/lib/llama.ts` shorter than a consumer route's window.

### 2. Large external payloads silently defeat the data cache
Next's data cache **rejects responses over ~2 MB**. The `next: { revalidate }` hint
stays in the code looking effective while doing nothing, so the body is re-fetched
and re-parsed on every regeneration — burning Fluid Active CPU on `JSON.parse`.

`/api/markets/defi` fans out to four llama.fi endpoints (`historicalChainTvl`,
`protocols`, `v2/chains`, `stablecoins`, ~33 MB combined per revalidation) and then
discards nearly all of it — 30 trend points and the top 8 of each survive.

Before adding an external fetch with a cache hint, check the payload size
(`curl -sI <url>` → `content-length`). Over 2 MB means the hint is inert.

**The fix is to cache the REDUCED value, not the body.** `unstable_cache` stores a
function's return value, and these routes return kilobytes, so the data cache
accepts them. `src/modules/markets/lib/llama.ts` does this for the four upstreams
the build log named — `yields.llama.fi/pools` (14.3 MB), `api.llama.fi/protocols`
(11.4 MB) and `overview/{dexs,fees,derivatives}` — and the inner fetches are
explicitly `cache: "no-store"` so Next stops trying to store a body it will always
reject. One entry per upstream, **shared across routes**: `overview/dexs` was
downloaded separately by `/api/markets/dex` and `sitemap.ts`, `derivatives` by
`/api/markets/perp` and `sitemap.ts`.

**How to tell it worked:** `npm run build` and grep the output. Every
`Failed to set Next.js data cache …` line is a hint that is doing nothing. Zero of
them is the pass condition — and mind trap 1b above while doing it.

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

## Bundle size — measurable, via `scripts/bundle-report.mjs`

Next 16 removed the `Size` and `First Load JS` columns from build output. This skill
then told you to read **`.next/app-build-manifest.json`** instead — and **Turbopack
never emits that file**, so the instruction was unfollowable and bundle size went
unchecked entirely while the skill read as though a method existed.

**Use this:**

```bash
npm run build && node scripts/bundle-report.mjs            # this branch
git checkout main && npm run build && node scripts/bundle-report.mjs > /tmp/before.txt
# ...then diff the two.
```

It reads the per-route RSC manifests at
`.next/server/app/**/page_client-reference-manifest.js` — which Turbopack *does*
emit — and sums the gzipped size of the unique JS chunks each route pulls in.

**Baseline at `59dddbf`** (gzip kB): `/dashboard` **237** · `/settings` 134 ·
`/news` 126 · `/journal` 124 · `/community` 121 · `/messages` 120 · `/` **117** ·
`/news/read` 112 · `/research/[slug]` 112.

**Read the number correctly:**
- Routes share framework chunks, so the column does **not** sum to a site total.
  Compare a route against **itself** across two builds — that is the regression
  question.
- Chunks behind `next/dynamic` still count if the route references them, so a large
  number is not automatically a large download. Live example: three.js sits in `/`'s
  graph but `useWebglGate()` returns a literal `false`, so it is never requested —
  zero transfer.
- `/dashboard` being ~2× everything else is the Tiptap editor loading eagerly for all
  dashboard tabs. Known, admin-only, low traffic.

The old Next 14 baseline of 160 kB "First Load JS shared" is **not comparable** to
these numbers — different measurement basis. Do not diff against it.

Related: keep server-only modules out of the client graph. `env.ts` gained
`import "server-only"` in #189 after it had reached the browser via `realtime.ts`,
shipping a zod schema, the server env's shape and a `console.error` loop into public
chunks. Client components get channel helpers from `realtime-channels.ts` instead.
The guard makes that class of regression a **build error** rather than something you
have to notice.

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
