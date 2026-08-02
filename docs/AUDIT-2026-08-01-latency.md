# Latency & Resource-Utilization Audit — 2026-08-01

**Commit audited:** `319f722` (*Close the OTP attempt race, plus three repo-hygiene gaps (#194)*)
**Method:** clean `npm run build` at that commit + source-level tracing. Docs were not
used as evidence. Findings are tagged `[VERIFIED]` (read and traced) or `[SUSPECTED]`
(exact confirmation step stated).

> **⚠️ Read the Verification Pass before acting on finding #1.** An earlier draft of
> this audit recommended raising `MEMBERSHIP_TTL_MS`. **That advice is withdrawn** — it
> would have silently weakened permission revocation. Nothing in this codebase
> re-verifies authorization against the database, so the per-request session refresh
> that finding #1 identifies as waste is the only thing stopping a revoked admin from
> keeping admin. The finding stands; its original fix does not.


**Scope: analysis only.** No source changes were made as part of this audit; the
proposals below are unimplemented at the time of writing.

**Context.** Vercel Hobby. Three metered resources rationed: Fast Origin Transfer
(10 GB/mo), ISR Writes, Fluid Active CPU. Fluid bills *Active CPU*, so I/O wait is
cheap and CPU work is not. Functions run in `iad1`; Supabase is in Mumbai, so every
DB round trip costs ~250 ms and that is fixed. Findings are ranked accordingly:
**eliminating a query beats parallelising it, and parallelising beats everything else.**

`[VERIFIED]` = I read and traced it. `[SUSPECTED]` = confirmation step stated.

---

# VERIFICATION PASS — claims changed on recheck

Re-audited every load-bearing claim. **The mechanism behind finding #1 got stronger,
but its recommended fix was wrong and is withdrawn. Two other claims were wrong and
are corrected; one finding is demoted.**

### 🔴 #1 — THE PROPOSED FIX WAS WRONG AND IS WITHDRAWN

Revision 1 said: *"Raise `MEMBERSHIP_TTL_MS` substantially (30 min+)… The TTL is
redundant belt-and-braces."* **Do not do this.** I had not checked whether anything
else re-verifies authorization against the DB. Nothing does:

```ts
// src/lib/api.ts:97-101
export async function requirePermission(perm: Permission): Promise<SessionUser | null> {
  const user = await getSessionUser();          // ← reads JWT claims only
  if (!user) return null;
  return hasPermission(user, perm) ? user : null;
}
```

`getSessionUser()` (`api.ts:77-90`) and `getAdminSession()` (`api.ts:60-64`) both read
**JWT claims only**. So the token *is* the authorization decision, and the only thing
keeping it honest is the per-request refresh this finding identified as waste.

**Security consequence of the withdrawn fix.** With a 30-minute TTL, a user whose
`role`, `membership` or `permissions` were just revoked keeps them for up to 30 minutes
on every server-rendered path — admin capabilities, Premium content, granted
capabilities. The mitigation I cited (`RealtimeSession` calling `update()` on an
`access_changed` broadcast, `RealtimeSession.tsx:59,63`) only reaches a browser that is
open, connected to realtime, and cooperating. An attacker simply is not: they keep the
cookie they already hold.

**Today, revocation takes effect on the demoted user's very next request.** That is a
real security property, and the fix I proposed would have removed it silently — the
exact failure shape this project keeps hitting.

**Revised recommendation: leave `MEMBERSHIP_TTL_MS` alone.** Reduce the *number of
authenticated requests* instead (finding #2), which costs nothing in revocation
timeliness. If the latency is later judged to outweigh the security property, split the
policy — keep the short TTL on permission-gated and admin routes, lengthen it only for
ordinary member reads — rather than raising it globally.

**Related defect, new: a false comment that invites this exact mistake.**
`src/lib/auth.ts:318` reads *"routes always re-check DB anyway"* as the stated
justification for bounding the TTL. **They do not** — see `requirePermission` above.
That comment is what made the withdrawn fix look safe. Correcting it is a two-minute
change and is the highest-value thing in this entire report per minute spent.

### ✅ #1 mechanism — confirmed one level deeper than before

I had verified the discarded cookie. I had **not** verified that the `jwt` callback
even runs on a session read — if it did not, the whole finding collapses. It does:

```js
// node_modules/next-auth/core/routes/session.js:53
const token = await callbacks.jwt({ token: decodedToken, ... });
// :73-81  → re-encodes and pushes the rotated cookie into response.cookies
```

…which `next/index.js:143` then forwards into the RSC path's stub `setCookie() {}`.
**The chain is complete and verified end-to-end.**

There are **8** `getServerSession(authOptions)` call sites and **every one is
single-argument**, i.e. all on the RSC path: six server pages (`community:20`,
`research/[slug]:125`, `profile:13`, `settings:14`, `messages:14`, `dashboard:37`) plus
the two helpers in `src/lib/api.ts` — `getAdminSession` (`:61`) and `getSessionUser`
(`:78`) — through which all 54 authenticated files flow. There is no non-RSC call site
anywhere, so there is no path on which the rotated cookie survives.

### ⚠️ #1 — I overstated the *cost*; it is a latency finding, not a CPU finding

My report claimed "**Fluid Active CPU** meaningful reduction across every authenticated
path." **That is wrong on this billing model.** Fluid bills Active CPU and excludes I/O
wait — your own brief says so. `email` is `@unique` in `prisma/schema.prisma:24`, so the
refresh is a fast indexed lookup: ~250 ms of *waiting*, near-zero CPU.

**Corrected:** #1 removes ~250 ms from every authenticated request — a large **latency**
win — and a *modest* CPU/invocation saving. It does not meaningfully move the CPU meter.
Ranking unchanged (it is still the widest-reaching finding), reasoning corrected.

### ⚠️ #1 — scale was wrong: 54 files, not "~66 handlers"

54 files under `src/app` call `getSessionUser()` / `getServerSession(authOptions)` /
`getAdminSession()`. The 66 came from the rate-limit test's handler count and does not
apply here.

### ❌ #3 — blast radius was WRONG. The ticker is homepage-only, not site-wide.

I wrote *"shared site-wide via `useTickerPoll`, so this fires from every open tab on
**any** page."* **Not true.** Both consumers are homepage-only:

- `MarketTicker` → `src/app/page.tsx:45`
- `LiveMarketVisual` → inside `Products`, `src/app/page.tsx:52`

`grep -rn "MarketTicker\|LiveMarketVisual"` finds no other mount point.

**The defect is unchanged and still worth fixing** — a 60 s window against a 150 s poll
still regenerates on every poll — and `/` is the highest-traffic page on the site, so
the impact is real. But it is bounded to homepage visitors, not every tab everywhere.

### ✅ #4 — confirmed, re-read line by line

`allTrades` (`:35`), `myTrades` (`:54`), `dayNotes` (`:62`) key only on `challenge.id`
and `me.id`, never on each other. The leaderboard build between them consumes only
`allTrades`, so it moves after a `Promise.all` cleanly. Genuinely 3 independent queries
in series.

### ✅ #7 — confirmed. `RealtimeSession` is in the root layout (`src/app/layout.tsx:118`).

### ⬇️ #5 — DEMOTED, I over-ranked it

I wrote "the full text of **every** listed article." It is bounded: `take: 12` on
`/research` (`page.tsx:22,31`), `take: 3` on the homepage (`ResearchPreview.tsx:16`),
`take: 3` for related (`research/[slug]/page.tsx:139`). So ~12 bodies per regeneration,
not hundreds — a real but small win that costs a schema migration. **Moves below #7/#8.
Do not do this one soon.**

---

# STEP 0 — CURRENT STATE, ESTABLISHED FROM THE REPO

## Route table — measured, `npm run build` at `319f722`

**124 routes · 22 static · 102 dynamic · 12 ISR.**

**Identical to the `2f34b83` baseline in the `cost-check` skill.** Eighteen commits
merged and the route table did not move — no `○ → ƒ` regression.

> Counting note: a naive `grep -cE '^[┌├└]'` returns **125**. The legend line
> `○  (Static) prerendered as static content` matches because `○` (U+25CB) and `├`
> (U+251C) share a leading UTF-8 byte — exactly the over-count the `cost-check`
> skill warns about. Real total is 124.

Every ISR window, from the build output:

| Route | Revalidate | Route | Revalidate |
|---|---|---|---|
| `/` | 5m | `/api/markets/coins` | ≈3m (200s) |
| `/markets` | 5m | `/api/markets/defi` | ≈3m (200s) |
| `/research` | 5m | `/api/markets/global` | ≈3m (200s) |
| `/news` | ≈2m (90s) | `/api/markets/perp` | ≈3m (200s) |
| `/tools` | 1h | `/api/markets/dex` | ≈5m (320s) |
| `/api/ticker` | **1m (60s)** | `/api/markets/yields` | ≈5m (320s) |

All twelve carry a 1y expire. Every value matches the `cost-check` skill.

## Merged since `2f34b83` — 18 commits

#180 P&L card auth · #182 skills + doc consolidation · #181 URL validation ·
#183 Upstash verified live · `ec74473` security batch (6 findings) · #187 CodeQL
removed · #185 P1001 documented · #186 fail-loud schema push · #188 rate limits on
7 handlers · #189 `env.ts` server-only · #190 + #192 markets window alignment ·
#191 journal-activity revocation · #193 pre-merge observable rule · #194 OTP race.

## The four previously-reported issues — status each

**(a) Four market routes with windows shorter than their poll — ✅ FIXED. [VERIFIED]**
All six aligned, at both layers, with margin:

| Route | `revalidate` | `s-maxage` | poll | margin |
|---|---|---|---|---|
| coins / defi / global / perp | 200s | 200s | 180s | 11% |
| dex / yields | 320s | 320s | 300s | 6.7% |

`src/app/api/markets/*/route.ts` lines 10–15 (exports) and 36–114 (headers);
polls at `src/components/MarketsClient.tsx:92-97`. Inner fetch hints all pass the
shared `{ revalidate }` const except `global:77,95`, which pin `300` — **longer**
than the route's 200s, so the minimum-across-segment rule is not violated.

**(b) Four llama.fi fetches over the 2 MB data-cache cap — ⚠️ STILL UNCONFIRMED,
and I cannot confirm it from here. [SUSPECTED]**
The fan-out is real and unchanged: `src/app/api/markets/defi/route.ts:23` passes
`next: { revalidate: revalidateSec }` to four endpoints. I attempted to measure the
payloads and **egress is policy-blocked** — the proxy returned `403 to CONNECT` for
`api.llama.fi:443` and `stablecoins.llama.fi:443` (confirmed via
`$HTTPS_PROXY/__agentproxy/status`, `recentRelayFailures`). Owner-run confirmation:
`curl -sI https://api.llama.fi/protocols` and read `content-length`. Over ~2 MB means
the cache hint is inert. **Options are analysed as finding #6 below.**

**(c) `/api/chat/last-activity` rendering dynamic — ✅ TRUE, AND CORRECT. [VERIFIED]**
It is `ƒ` in the build table. That is right: it is a Route Handler doing a Prisma
read, and Next cannot prerender it. It is **not** a problem, because it sets
`Cache-Control: public, s-maxage=15, stale-while-revalidate=60`
(`src/app/api/chat/last-activity/route.ts:20`), so the edge absorbs the polling.
The route already replaced a much worse pattern (fetching 50 full messages to read
one timestamp — see its header comment). **No action.**

**(d) `src/lib/env.ts` reaching the client bundle — ✅ FIXED. [VERIFIED]**
`src/lib/env.ts:1` now carries `import "server-only"`. `src/lib/realtime.ts:5` still
imports it, but `realtime.ts` is server-only and clients import the zero-dependency
`src/lib/realtime-channels.ts` instead. I grepped every `"use client"` file for
`from "@/lib/realtime"` — **zero hits**. The only match was `realtime.ts` itself,
whose own comment contains the string `"use client"`.

## What contradicts the brief

1. **"the 102 dynamic routes" implies 102 dynamic-rendering opportunities.** Only
   **14 are pages**; 88 are API Route Handlers, which are dynamic by definition and
   cannot be static. See finding #10 — the real dynamic-page surface is ~2 routes,
   and neither should change.
2. **`.next/app-build-manifest.json` does not exist under Next 16 + Turbopack**, so
   the `cost-check` skill's suggested bundle measurement cannot be run as written.
   A working replacement is in finding #9.
3. `/u/[username]`, `/research/[slug]`, `/markets/[id]` show as `ƒ` in the build
   table but all three set `export const revalidate = 300`. They are **ISR-on-demand**
   (no `generateStaticParams`, so nothing prerenders at build), not truly dynamic.
   Reading the `ƒ` as "renders on every request" would be wrong.

---

# RANKED FINDINGS

---

## 1. Every authenticated server request pays an un-amortisable extra DB round trip to Mumbai
**[VERIFIED]** — `src/lib/auth.ts:300-359`; `node_modules/next-auth/next/index.js:116-119,143`;
`src/app/providers.tsx:9`

**What the code does.** The `jwt` callback refreshes role/membership/permissions from
the DB when the token is older than `MEMBERSHIP_TTL_MS = 60_000` (`auth.ts:314`),
then writes `syncedAt = Date.now()` back onto the token (`auth.ts:349`).

**Why it never takes effect.** `getServerSession(authOptions)` is called with one
argument everywhere in this codebase, which is next-auth's RSC path. In that path it
builds a **stub response object**:

```js
// node_modules/next-auth/next/index.js:116-119
res = { getHeader() {}, setCookie() {}, setHeader() {} };
...
cookies?.forEach(cookie => setCookie(res, cookie));   // :143 → no-op
```

The rotated cookie — carrying the fresh `syncedAt` — is written into a **no-op**.
So no server-side session read can ever advance the TTL.

**Why nothing else advances it either.** `src/app/providers.tsx:9` is
`<SessionProvider refetchOnWindowFocus={false}>` with no `refetchInterval` (default
0). The client hits `/api/auth/session` **once on mount**, and thereafter only when
`RealtimeSession` calls `update()` on a membership/access broadcast
(`src/components/RealtimeSession.tsx:59,63`).

**Net effect: 60 seconds after page load, `syncedAt` is stale and stays stale. From
then on, 100% of authenticated server-side requests run an extra
`prisma.user.findUnique` — ~250 ms to Mumbai — that can never be amortised.**

**What it costs.** **54 files** under `src/app` call `getSessionUser()` /
`getServerSession(authOptions)` / `getAdminSession()` — every authenticated API
handler, plus `/dashboard`, `/settings`, `/profile`, `/journal`, `/messages`,
`/community`, and premium `/research/[slug]` renders. Compounded by finding #2 below.

**Survives the region move?** The **latency** does not (250 ms → ~5 ms). The **CPU
and invocation cost** does — a redundant query is still a redundant query.

**Proposed change — ⚠️ WITHDRAWN. See the Verification Pass at the top of this report.**

~~Raise `MEMBERSHIP_TTL_MS` substantially (30 min+)… the TTL is redundant
belt-and-braces.~~ **Wrong.** Nothing else re-verifies authorization against the DB
(`api.ts:97-101`), so this per-request refresh is the *only* thing making permission
revocation timely. Raising the TTL would let a demoted admin keep admin for up to
30 minutes. **Leave it alone.**

**What to do instead — REMOVES work, without weakening revocation.** Cut the *number*
of authenticated requests rather than the freshness of each one: finding #2 (widen
`NavActivity`'s poll) removes ~2 of these per minute per logged-in tab and costs
nothing in security. If the latency is later judged to outweigh the security property,
split the policy by route class — short TTL on admin/permission-gated routes, longer
only for ordinary member reads — never a global raise.

**FOT** none · **ISR Writes** none · **Fluid Active CPU** *modest* only. Fluid excludes
I/O wait, and `email` is `@unique` (`prisma/schema.prisma:24`), so this is a fast
indexed lookup: ~250 ms of **waiting**, near-zero CPU. **Rank this as a latency fix,
not a cost fix** — it will not visibly move the CPU meter.

**Blast radius** auth token freshness. **Effort** ~15 min + a deliberate decision about
the fallback staleness bound.

**Falsifier:** if `syncedAt` were being persisted, a second authenticated request
within 60 s would skip the query. Confirm by logging inside the `if` at `auth.ts:319-321`
and hitting any authenticated route twice in quick succession — it should fire both times.

---

## 2. The navbar poller resonates with that TTL — 2 extra Mumbai round trips per minute per logged-in tab
**[VERIFIED]** — `src/components/NavActivity.tsx:21,89-101`; `Navbar.tsx:141`

`POLL_MS = 60_000`, and one `setInterval` tick fires **three fetches at once**:

```js
loadNotes();  // /api/notifications  → getSessionUser()
loadChat();   // /api/chat/last-activity → no auth
loadDm();     // /api/dm/unread      → getSessionUser()
```

Two of the three are authenticated, so per finding #1 each pays the extra
`user.findUnique`. They fire **concurrently**, so neither can see the other's token
refresh even if the refresh worked. The 60 s poll and the 60 s TTL are the same
number — the exact poll/window resonance the `cost-check` skill documents as trap 1,
in a different subsystem.

Correctly gated: `visibilityState === "visible"` (`:90`), and mounted only when
`session` exists (`Navbar.tsx:141`), so anonymous visitors pay nothing.

**Cost:** ~2 extra DB round trips/min/tab ≈ 2,880/day for one tab left open.

**Survives the region move?** Latency no; invocations and CPU yes.

**Proposed change — REORDERS work.** Fixing #1 removes the query. Independently,
widening `POLL_MS` to 120–180 s halves-to-thirds all three polls; realtime already
delivers instant updates and the comment at `:21` says the poll is only a fallback.

**FOT** small reduction · **ISR Writes** none · **Fluid CPU** reduction proportional
to the widening.

**Blast radius** notification/DM badge latency for users without realtime.
**Effort** ~10 min.

---

## 3. `/api/ticker` window is shorter than its poll — the fix from #192, on a route the test does not cover
**[VERIFIED]** — `src/app/api/ticker/route.ts:11,141`; `src/lib/useTickerPoll.ts:8`;
build table (`/api/ticker … 1m 1y`)

```
export const revalidate = 60;                                   // route.ts:11
"Cache-Control": "public, s-maxage=60, stale-while-revalidate=120"  // route.ts:141
const POLL_MS = 150_000;                                        // useTickerPoll.ts:8
```

The window expires **90 seconds before** every poll, so every poll regenerates. This
is precisely the bug #190/#192 fixed for `/api/markets/*`.

**It survived because the test that pins the invariant is scoped to markets only** —
`src/lib/__tests__/markets-poll-alignment.test.ts:35,47,132` all build paths as
`src/app/api/markets/${route}/route.ts`.

**Blast radius — corrected on recheck.** Both `useTickerPoll` consumers are
**homepage-only**: `MarketTicker` (`src/app/page.tsx:45`) and `LiveMarketVisual` inside
`Products` (`src/app/page.tsx:52`). My first pass called this site-wide; it is not.
It still matters because `/` is the highest-traffic page here, but it is bounded to
homepage visitors.

**Survives the region move?** Yes — entirely CDN/ISR, region-independent.

**Proposed change — REORDERS work.** Raise `revalidate` and `s-maxage` to 180 (a 20%
margin on the 150 s poll), and widen the test to enumerate every polled route rather
than globbing `markets/*`.

**FOT** reduction (fewer origin→edge transfers) · **ISR Writes** direct reduction ·
**Fluid CPU** reduction (fewer CoinGecko fetch + parse cycles).

**Blast radius** ticker prices up to 3 min stale instead of 1. **Effort** ~30 min
including the test widening.

**Falsifier:** on the live site, `age` on `/api/ticker` should climb past 150 and stay
`HIT`. If it resets at ~60 every time, nothing changed.

---

## 4. `/api/journal/challenges/[id]` GET — three mutually independent queries awaited in sequence
**[VERIFIED]** — `src/app/api/journal/challenges/[id]/route.ts:23,35,54,62`

```
:23  challenge.findUnique       ← required first (auth gate)
:35  trade.findMany   (allTrades)  ┐
:54  trade.findMany   (myTrades)   ├ all three depend only on `challenge`,
:62  challengeDayNote.findMany     ┘ not on each other — and all await in series
```

**Four sequential round trips ≈ 1000 ms of pure Mumbai latency.** `Promise.all` on the
last three makes it two legs ≈ 500 ms. Highest independent-sequential count on the site.

**Survives the region move?** No — this is the finding most specific to the region gap.
At ~5 ms RTT the saving drops to ~10 ms and stops mattering.

**Proposed change — REORDERS work.** One `Promise.all`. No new code paths.

**FOT** none · **ISR Writes** none · **Fluid CPU** neutral-to-slightly-better (same
queries, less wall time held open; Fluid bills Active CPU, so the win here is
**latency**, not cost — stated plainly per principle 3).

**Blast radius** one handler. **Effort** ~15 min.

### Full enumeration — independent queries awaited in sequence

| Route / page | Sequential awaits | Genuinely independent | Round trips saved |
|---|---|---|---|
| `api/journal/challenges/[id]` GET | 4 | **3** (`:35`,`:54`,`:62`) | 2 |
| `api/posts/[id]/like` POST | 4 | **2** (`:40`,`:46`) | 1 |
| `api/chat/messages` GET | 3 | **2** (`:27`,`:43`) | 1 |
| `u/[username]` page | 2 legs | 1 (see #11) | 1 |
| `api/follow/list` GET | 3 | 0 — genuine chain (`:20`→`:24`→`:41`) | 0 |
| `community` page | 3 legs | 0 — already `Promise.all` at `:67`; `:98` depends on it | 0 |
| `research/[slug]` page | 2–3 legs | 0 — already `Promise.all` at `:133` | 0 |
| `api/notifications` GET | 2 | 0 — already `Promise.all` at `:20` | 0 |

**`api/chat/messages` GET is worth calling out**: the `/community` **page** already
runs exactly this pair — history + pinned banner — inside a `Promise.all`
(`src/app/community/page.tsx:67`, with the comment *"run in parallel (independent
queries)"*). The API route serving the same data does not. The fix already exists in
the codebase, ten files away.

**Everything else is clean.** Most high-count routes are auth → verify-ownership →
mutate, which is correctly sequential.

---

## 5. `POST_CARD_SELECT` pulls article bodies to compute a reading time — DEMOTED
**[VERIFIED]** — `src/lib/post-select.ts:14`; `src/app/research/page.tsx:22,31`;
`src/components/ResearchPreview.tsx:16`; `src/app/research/[slug]/page.tsx:139,153-158`

```ts
content: true, // stripped before it leaves the server; used for reading time
```

The comment is accurate about the stripping — no body reaches the client. But those
bodies still cross the Mumbai→`iad1` link on every regeneration, so `readingTime()`
can count words and throw them away.

**Scope, corrected on recheck.** This is bounded, not "every article": `take: 12` on
`/research`, `take: 3` on the homepage, `take: 3` for related posts. ~12 bodies per
regeneration. **A real but small win that costs a schema migration — do this last, if
at all.**

**Survives the region move?** Partially. The bytes-over-the-wire cost shrinks with
latency but the payload size and the `JSON.parse` + word-count CPU do not.

**Proposed change — REMOVES work.** Store `readMinutes` (or a word count) as a column
written at publish time, and drop `content` from `POST_CARD_SELECT`. Card queries then
transfer excerpt-sized rows instead of article-sized ones.

**FOT** no direct change (content never reached the client) · **ISR Writes** none ·
**Fluid CPU** reduction on `/research` and `/` regeneration — less parse, no word count.

**Blast radius** a schema column + the publish path + one select. **Effort** ~1.5 h
including the migration. **This is the only proposal here that needs a schema change**,
so it is ranked below the free ones deliberately.

---

## 6. `/api/markets/defi` fans out to four llama.fi endpoints and discards nearly all of it
**[SUSPECTED on payload size — see Step 0(b); VERIFIED on the fan-out]** —
`src/app/api/markets/defi/route.ts:18-56`

Four upstream fetches per regeneration; ~30 trend points and the top 8 of each survive
(`:27,34,45`). If any response exceeds ~2 MB the `next: { revalidate }` hint at `:23`
is **inert** and that body is re-fetched and re-parsed on every regeneration.

**The four real options, with trade-offs:**

| Option | Effect | Trade-off |
|---|---|---|
| **(a) Accept it, drop the dead hints** | No CPU change; removes a misleading signal | Nothing is faster. But a hint that looks effective and is not is exactly this project's documented bug class. Cheapest honest move. |
| **(b) Narrower upstream params** | Real CPU reduction | llama.fi's `/protocols` has no server-side filter — there is no narrower endpoint. Would need a different provider. |
| **(c) Trim server-side before caching** | **Does not work.** | The 2 MB cap applies to the *fetch response*, before your code runs. Trimming after `await res.json()` is too late. Worth stating because it is the intuitive fix and it is wrong. |
| **(d) Wrap in `unstable_cache` keyed on the trimmed result** | Real fix: the raw body is parsed once per window, the trimmed result is what gets cached | ADDS code. Same pattern already used at `src/lib/news-fetch.ts:66`. ~1 h. |

**Recommended: measure first (owner-run `curl -sI`), then (a) if under 2 MB, (d) if over.**

**FOT** none · **ISR Writes** none · **Fluid CPU** the entire point of the finding.

**Survives the region move?** Yes — llama.fi is external, unaffected by `iad1`/`bom1`.

---

## 7. `/api/track` writes a row to Mumbai on every navigation, for every visitor
**[VERIFIED]** — `src/app/api/track/route.ts:18`; `src/components/RealtimeSession.tsx:26-33`

`RealtimeSession` is mounted site-wide and POSTs `/api/track` on **every navigation,
including anonymous ones**. The handler does an Upstash check then
`prisma.pageView.create()` — a DB **write** across the region gap — and on ~1.5% of
calls also fires an unbounded `deleteMany` retention scan (`:24-27`).

Correctly built otherwise: `keepalive: true`, fire-and-forget, never blocks paint,
rate-limited, and the retention prune is deliberately not awaited.

**Cost:** one function invocation + one cross-region INSERT per page view, site-wide.
The single highest-volume write path on the site.

**Survives the region move?** The write stays; only its latency shrinks. Invocation
count and CPU are unchanged.

**Proposed change — REMOVES work.** Sample. Write on ~25% of views and multiply in
`/api/dashboard/stats` + `timeseries`. Analytics precision is not the product.

**FOT** negligible (tiny response) · **ISR Writes** none · **Fluid CPU** ~75%
reduction on the highest-volume write path.

**Blast radius** page-view counts become an estimate — the dashboard queries must be
scaled in the same change or the numbers silently drop 4×. **Effort** ~1 h.
**Flagging as a judgement call:** if exact view counts matter to you, do not do this.

---

## 8. `/api/journal/share/overview/[userId]` has no `take`
**[VERIFIED]** — `src/app/api/journal/share/overview/[userId]/route.tsx:39`

`findMany` over a user's entire trade history with no bound. A member with thousands
of trades makes one share-card render arbitrarily expensive. Mitigated by
`s-maxage=3600`, so it is amortised — hence the low rank.

Same shape at `api/journal/challenges/[id]/route.ts:36,63`, both bounded in practice
by challenge scope.

**Proposed change — REMOVES work.** Add a `take`, or aggregate in SQL rather than
fetching rows to sum them in JS.

**FOT** none · **ISR Writes** none · **Fluid CPU** reduction proportional to the
heaviest user. **Effort** ~20 min.

---

## 9. Bundle size is measurable again — here is the baseline and the method
**[VERIFIED]** — measured at `319f722`

The `cost-check` skill proposes reading `.next/app-build-manifest.json`. **That file
does not exist under Next 16 + Turbopack.** The working replacement is the per-route
RSC manifest, `.next/server/app/**/page_client-reference-manifest.js`, which carries
the real per-route client chunk graph.

**Per-route client JS at `319f722`** (union of `clientModules` chunks, incl. shared):

| Route | gzip kB | Route | gzip kB |
|---|---|---|---|
| `/dashboard` | **232** | `/markets` | 105 |
| `/settings` | 130 | `/u/[username]` | 103 |
| `/news` | 121 | `/research` | 101 |
| `/journal` | 120 | `/premium`, `/privacy`, `/terms` | 98 |
| `/community` | 115 | `/signup`, `/login` | 78 |
| `/` | **113** | `/_not-found` (shared floor) | **69** |
| `/messages` | 111 | `/_global-error` | 13 |
| `/news/read`, `/research/[slug]` | 108 | | |

Largest chunks on disk: **220 kB gz** (three.js — see below), **132 kB gz**
(Tiptap/ProseMirror), **127 kB gz** (framework), **60 kB gz** (Supabase client).
60 chunks, 1.10 MB gzip total on disk.

**Two things this immediately shows:**

- **`/dashboard` at 232 kB gz is 2× the next-heaviest route.** 132 kB of that is the
  Tiptap editor, loaded eagerly for all dashboard tabs when only the post editor uses
  it. Admin-only, so low traffic — correctly ranked low, but it is the one clear
  bundle outlier.
- **three.js (220 kB gz) is on disk but never requested.** `useWebglGate()` returns a
  literal `false` (`src/components/orbital/useWebglGate.ts`), and `OrbitalLazy` only
  imports the WebGL scene behind that gate via `next/dynamic` + `ssr: false`. **Zero
  FOT.** CLAUDE.md is accurate here. `three` (30 MB) and `@react-three` remain in
  `package.json` and 8 orbital source files are dead — a build-time cost only.

**Proposed change — ADDS code, and it is the one addition the brief asked for.** Commit
the measurement script and diff it in the `pre-merge` skill's Step 3, replacing the
"unavailable, not passed" language with a real number.

**FOT / ISR Writes / Fluid CPU** all unaffected — this is a measurement, not a change.
**Effort** ~45 min. Script is written and verified; it produced the table above.

---

## 10. Rendering and caching — largely clean, and two places where the obvious fix is wrong

**Dynamic pages that could be static or ISR: essentially none. [VERIFIED]**
Of 102 dynamic entries, **88 are API Route Handlers** — dynamic by definition. Of the
14 dynamic pages:

- `/dashboard` `/settings` `/profile` `/journal` `/messages` `/community` — all
  authenticated. Correctly dynamic.
- `/u/[username]` `/research/[slug]` `/markets/[id]` `/markets/protocol/[type]/[slug]`
  — all set `revalidate = 300`; `ƒ` only because there is no `generateStaticParams`.
  Already ISR-on-demand. **No change available.**
- `/news/read` — `force-dynamic` (`page.tsx:8`), driven by `searchParams`.
  **Leave it.** Making it ISR would mint a cache entry per distinct `?d=` token, which
  is attacker-controllable and unbounded — a *worse* ISR Writes problem than the one
  it solves. See "what not to do".
- `/sitemap.xml`, `/research/-/opengraph-image`, `/tools/share/points-value/[id]` —
  low traffic, no meaningful lever.

**`getServerSession` called unconditionally where an anonymous path could skip it:
none found. [VERIFIED]** `research/[slug]/page.tsx:125` already gates it behind
`post.premium`, with a correct explanation at `:115-121`. `community/page.tsx:20`
needs it before the `CommunityPreview` branch at `:30`, which is unavoidable — the
branch *is* the auth decision.

**`Cache-Control` on public API routes:** 27 GET handlers have no header. **All 27 are
personalized/authenticated and all are `force-dynamic`**, so nothing is being wrongly
cached. Per the skill's rule 5 they should carry an explicit `private, no-store`, but
that is hygiene, not cost. The two mild exceptions worth a short public window are
`api/chat/gif` and `api/users/search`, both low-volume.

**N+1: none. [VERIFIED]** I swept every `await prisma.` for an enclosing
`.map`/`.forEach`/`for`. Every hit is a batching pattern — `Promise.all` over push
sends (`follow/route.ts:90`, `dm/[id]/route.ts:122`), `createMany`
(`push/dispatch/route.ts:49`), or ID collection followed by an `in: [...]` query.
This confirms the earlier audit and needs no further work.

**Polling and hidden tabs: clean. [VERIFIED]** All twelve components with a
`setInterval` carry a `document.hidden` / `visibilityState` guard. Realtime goes
through the `src/lib/realtimeClient.ts` singleton with no direct `createClient` in a
component. `/dashboard` polls at 30 s, the fastest on the site — admin-only, so
acceptable.

**Duplicate queries within a render: none found.** `research/[slug]` correctly wraps
`getPost` in React `cache()` (`:40`) so `generateMetadata` and the page share one query.

---

## 11. `/u/[username]` — one avoidable round trip
**[VERIFIED]** — `src/app/u/[username]/page.tsx:38,70,76-95`

`getProfile()` resolves the user, then six queries run in `Promise.all` keyed on
`user.id`. Two sequential legs ≈ 500 ms.

Five of the six could key on the relation instead (`where: { author: { username } }`),
collapsing to one leg. Public, ISR-cached at 300 s, so it is paid on regeneration
rather than per request — hence rank 11 rather than 4.

**Survives the region move?** No.
**Proposed change — REORDERS work.** **FOT/ISR/CPU** neutral; pure latency.
**Effort** ~30 min. **Lowest confidence of the sequential findings** — relation-keyed
counts may plan worse than id-keyed ones; needs `EXPLAIN ANALYZE` against real
cardinality before committing.

---

# 1. THE FIVE BEST IMPACT-TO-RISK

1. **Correct the false comment at `src/lib/auth.ts:318`.** It states *"routes always
   re-check DB anyway"* as the reason the TTL can be bounded. They do not
   (`api.ts:97-101`). That single sentence nearly talked me into shipping a silent
   authorization regression, and it will do the same to the next reader. **Two minutes,
   and the best value-per-minute in this report.**
2. **#3 — `/api/ticker` alignment + widening the test.** The only item here that
   reduces all three rationed metrics, on the highest-traffic page. Same class of bug
   the project has already fixed twice, and the coverage gap that hid it is worth
   closing more than the bug is worth fixing.
3. **#2 — widen `POLL_MS` in `NavActivity`** to 120–180 s. Now the *primary* lever on
   finding #1's cost, since the TTL itself must not be touched. Removes ~2 authenticated
   requests/min/tab with zero effect on revocation timeliness. Realtime already carries
   the instant path; the poll is explicitly a fallback.
4. **#4 — the `Promise.all` in `challenges/[id]`.** ~500 ms off the slowest handler
   for a one-line reorder, zero behaviour change, trivially reviewable.
5. **#9 — commit the bundle measurement.** The only proposal that adds code, and the
   only one that makes a currently-invisible regression class visible. Everything else
   here was found by reading; bundle growth cannot be.

**#1 has been removed from this list** — its proposed fix is withdrawn as an
authorization regression (see the Verification Pass). The *finding* stands; the fix does
not, and #2 is now how you recover part of the cost safely.

Deliberately **not** in the five: **#5** (needs a schema change), **#7** (changes
analytics semantics — your call, not mine), **#6** (blocked on a measurement I cannot
take), **#11** (needs `EXPLAIN ANALYZE` first).

# 2. WHAT NOT TO DO

- **Do not make `/news/read` static or ISR.** Its cache key is an attacker-controllable
  `?d=` token, so each variant mints an ISR entry. `force-dynamic` is correct.
- **Do not "fix" the llama.fi payloads by trimming after `await res.json()`.** The 2 MB
  cap applies to the fetch response before your code runs. It looks like the fix and
  does nothing — the exact failure mode this project keeps hitting.
- **Do not convert `<img>` to `next/image` for Supabase-hosted avatars.** Browser →
  Supabase costs zero Vercel transfer; routing through the optimizer spends FOT and
  image-optimization quota. The lint rule's "best practice" is the expensive option here.
- **🔴 Do not raise `MEMBERSHIP_TTL_MS` (`src/lib/auth.ts:314`).** Revision 1 of this
  report recommended exactly that and it was wrong. Nothing else re-verifies
  authorization against the DB, so the per-request refresh is the only thing making
  permission revocation timely. Raising it lets a demoted admin keep admin for the
  length of the window. Cut request *volume* (#2) instead.
- **Do not add `refetchInterval` to `SessionProvider`.** It would trade the discarded-
  cookie problem for a poll — more invocations, against principle 1 — and it does not
  address the finding either way.
- **Do not parallelise auth → ownership-check → mutate chains.** They read as
  sequential-await findings and are load-bearing security ordering.
- **Do not shorten any ISR window to make data fresher** without re-reading `cost-check`
  trap 0 — `s-maxage`, not `revalidate`, is what the edge honours, and the build output
  reports the wrong one.
- **Do not delete `three`/`@react-three` as a latency fix.** They cost zero at runtime
  (#9). Removing them is repo hygiene, and it discards a deliberately-preserved feature.

# 3. WHAT I DID NOT EXAMINE

- **Any production runtime measurement.** No profiling, no Lighthouse, no real traffic,
  no `x-vercel-cache`/`age` observations — egress to xyzcrypto.io is policy-blocked.
- **Actual DB behaviour**: index usage under real cardinality, `EXPLAIN ANALYZE`, the
  connection-pool ceiling under concurrency. Index *presence* in `schema.prisma` was
  not audited against query shapes — I ran out of budget before this and would rather
  say so than assert it is clean.
- **AI provider routes** (`api/ai/*`) — external-call latency and timeout behaviour.
- **`middleware.ts`**, if any, and its per-request cost.
- **Image and font delivery**, `next/font` behaviour, LCP element identification.
- **Streaming / Suspense opportunities** — I did not assess what could stream rather
  than block first paint.
- **`"use client"` boundary placement in detail.** I measured the resulting bundles
  (#9) but did not trace individual boundaries to see which could be pushed to leaves.
- **Realtime transport cost** — WebSocket message volume, presence-channel chatter.
- **The `cannot add presence callbacks for realtime:community after subscribe()`
  error** already known and parked.

# 4. WHAT I WOULD NEED TO MEASURE AND CANNOT FROM HERE

| Question | Why blocked | How to get it |
|---|---|---|
| llama.fi payload sizes (finding #6) | Proxy returns `403 to CONNECT` for `api.llama.fi:443` | `curl -sI https://api.llama.fi/protocols` → `content-length` |
| Real p50/p95 per route | No production access, no APM | Vercel → Observability → Routes; or a Sentry DSN, which would also fix the fact that nothing on this site reports an error today |
| Whether #1 actually fires per request | Needs a running server with real cookies | Log inside `auth.ts:319-321` and hit an authenticated route twice within 60 s |
| Whether #3's fix worked | `age`/`x-vercel-cache` only exist on the live edge | `fetch('/api/ticker', {cache:'no-store'})` in a browser console, watch `age` cross 150 |
| Which query is actually slowest | No `pg_stat_statements`, no query logs | Supabase → Query Performance |
| Whether the 250 ms RTT estimate is right | Cannot reach Supabase | Time a trivial `SELECT 1` from a deployed function |

**The single highest-leverage thing you could unblock: the Sentry DSN.** Every
"confirm on production" row above, and every silent-failure finding in the two earlier
audits, is downstream of having no error or performance telemetry from any runtime.
