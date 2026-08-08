# XYZ Crypto — Deep audit: the delta since `2f34b83`

| | |
|---|---|
| **Date** | 2026-08-06 · **corrected 2026-08-07** |
| **Audited at** | `bae69a7` (67 commits after `2f34b83`, 2026-07-25) |
| **Scope** | Delta only — changes since `2f34b83`, plus areas neither prior audit examined |
| **Mode** | Report only — no branch, no PR, no code changes |
| **Ranking criterion** | What hurts most sitting **unattended and unobserved for months** (Sentry dark; development pauses 14 August) |

> **Evidence rule used throughout:** every citation is `file:line` from code read and
> traced at `bae69a7`. Docs were not treated as evidence. Findings are tagged
> **[VERIFIED]** (read and traced) or **[SUSPECTED]** (with the exact confirmation step).

---

## 🚦 STATUS AS OF 2026-08-08 — read this before acting on anything below

**This document is a snapshot at `bae69a7`, not a live task list.** Four of its findings
were closed within two days of it being written. Treating the body below as current is the
exact drift this audit was written to catch, so the state is recorded here instead.

| # | Finding | Status |
|---|---|---|
| 1 | `/api/media/**` unbounded cache-key space | ✅ **Fixed — #264**, verified in production (real tokens `200`, forged `404`) |
| 2 | `realtime-channels.test.ts` vacuous | ✅ **Fixed — #256** |
| 3 | Two live copies of `markdown.tsx` | ✅ **Fixed — #255/#257** (incidentally), confirmed by #258's 247-file sweep |
| 4 | `jsonld` shim inverted | ✅ **Fixed — #263**, verified in production (3 JSON-LD blocks on `/`) |
| 5 | Block enforcement fails **open** on DB error | 🟠 **Open** — needs a schema fault to trigger |
| 6 | Journal-activity revocation swallows its own failure | 🟠 **Open** — needs a transient DB failure at the moment of revocation |
| 7 | Floating promise on `journalActivity.create` | 🟡 **Open** — fails safe (a missing feed row) |
| 8 | Bundle-baseline discontinuity | ℹ️ Measurement note, not a defect |

**Two corrections the body does not make, and one it makes only in §4:**

1. **Finding 1's magnitude was over-stated by roughly 200×.** The audit sized it on the
   5 MB upload cap and said ~2,000 requests would consume the monthly Fast Origin Transfer
   budget. Measured on production: the real avatar is **~24 KB**, so it is nearer **450,000
   requests** — a deliberate script running for an hour, not an accident. The mechanism was
   reported correctly; the scale was not. Fixed regardless, because unbounded is unbounded.
2. **The `npm audit` claim in §4 was wrong** — corrected in place there, with the original
   wording shown. Three high advisories exist and are **still open**; the CI check is green
   only because of `|| true`.
3. **Repository configuration was never examined**, and that omission outranks everything
   in this document. See §4. `main` is unprotected on a **public** repo with two `write`
   collaborators. That remains **open** and is a ten-minute settings change.

**Still open overall:** findings 5, 6, 7 · the three npm advisories · branch protection ·
the Sentry DSN · CodeQL (free now the repo is public) · the two competing admin
definitions. The unexamined areas in §4 remain unexamined, with the exception of
`src/lib/ai/*`, which #258 audited and hardened.

> **⚠️ Corrections applied 2026-08-07**, after reading the independent engineering review
> in `docs/REPORT-2026-08-05-engineering-review.md` (#253, same commit). Both are in
> **§4, What I did NOT examine** — the `npm audit` claim was **wrong** and is corrected in
> place with the original wording shown, and **repository configuration** has been added as
> the largest omission. Neither changes a finding in §🔴/🟠/🟡; both change what this
> report can be relied on to have covered. **Read §4 before acting on the priority order:
> an unprotected `main` on a public repo outranks everything here.**

---

**Scope:** report only. Audited at `bae69a7` (2026-08-06), 67 commits after `2f34b83`
(2026-07-25). Every citation is from current code, read and traced. Severity is ranked by
the stated criterion: **what hurts most sitting unattended and unobserved for months**,
given Sentry is dark and development pauses 14 August.

---

## ⚠️ Two premises in the brief are wrong — read this first

**1. There is no 2026-07-26 audit. There never was.**
```
git log --all --diff-filter=A --name-only -- 'docs/*' | grep -i audit
→ AUDIT-2026-06-11, 06-14, 07-01, 07-11, 08-01-latency, 08-02-responsive,
  AUDIT-PHASE0, AUDIT-PRE-PHASE2, SECURITY-AUDIT
```
No file matching `07-26` has ever existed in this repo's history, and no XSS/injection
audit is committed anywhere. `2f34b83` is dated **2026-07-25**. The nearest committed
baselines are `AUDIT-2026-07-11.md` and `SECURITY-AUDIT.md`.

**Consequence:** I could not defer to "covered by the 07-26 audit". Those findings were
almost certainly delivered in a chat session and never committed — which on a repo with
this much continuity discipline is itself a gap. **I audited the named areas from scratch
rather than assume coverage.** Nothing below is deferred to a document I could not read.

**2. `#203` is a *partial* migration, not a completed one.**
247 files remain in `src/lib/` + `src/components/`. **37 of them still contain real code**,
not shims — the whole of `src/lib/ai/` (gateway, providers, limits, usage, cache), plus
`src/lib/markdown.tsx`, `src/lib/command-search.ts`, and ~20 homepage components. The
mental model "src/lib/* are now shims" is about 85% true, and the 15% is where two of the
findings below live.

---

## 🔴 MUST FIX BEFORE 14 AUGUST

### 1. `/api/media/**` is an unauthenticated, unthrottled origin-transfer amplifier
**[VERIFIED]** — `src/app/api/media/[kind]/[id]/[v]/route.ts:68-103`, `src/shared/utils/utils.ts:137-148`

Four properties combine into a cost leak:

| Property | Evidence |
|---|---|
| No auth, no session | `route.ts:68` — handler takes `_req`, never reads a session |
| **No rate limiter** | `grep -c rateLimit` on the file → **0** |
| The `v` segment is accepted but **never validated** | `route.ts:66-68` — *"`v` is deliberately unused"* |
| Response up to **5 MB** | `MAX_UPLOAD_BYTES`, enforced at `api/upload/route.ts:23` and `api/profile/avatar/route.ts:24` |

Because `v` is unvalidated, `/api/media/avatar/<id>/<anything>` is a **fresh CDN cache key
every time**. Each distinct key is a guaranteed MISS → function invocation → DB query →
full image body from origin → then held for **30 days** (`s-maxage=2592000`, `route.ts:61`).

**Valid ids require no enumeration.** `publicImageUrl` (`utils.ts:148`) emits
`/api/media/${kind}/${encodeURIComponent(ownerId)}/${token}` — the raw user id is rendered
into public HTML on every profile page and beside every chat message.

**The arithmetic:** Hobby Fast Origin Transfer is 10 GB/month. At 5 MB per response,
**~2,000 requests consumes the entire monthly budget.** That is a `for` loop. The account
already overran FOT once (17.33 GB against 10 GB). With Sentry dark and nobody watching
until well after 14 August, the first signal would be the bill or a hard cap.

**Reachability: anonymous.** No account, no token, no CSRF, nothing to bypass.

**The one thing that bounds this, and you must check it.** The expensive branch only runs
when the stored value starts with `data:` (`route.ts:86`). If Supabase Storage is healthy,
most avatars are real URLs and the route answers a cheap 307. **The route is only *linked*
for data:-stored images — so any `/api/media/` URL in your public HTML is proof that at
least one expensive target exists**, and tells an attacker exactly which id to hit.

```bash
# Are there data:-stored images in production? Any output = the expensive path is live.
curl -s https://xyzcrypto.io/community | grep -o '/api/media/[a-z]*/[a-zA-Z0-9]*' | sort -u | head

# What does a forged version token cost? Note x-vercel-cache and content-length.
# Substitute a real id from the command above.
curl -sD - -o /dev/null "https://xyzcrypto.io/api/media/avatar/<ID>/forged$RANDOM" \
  | grep -iE 'HTTP/|x-vercel-cache|content-length|cache-control'
```
Run the second one twice with different `$RANDOM` values. **Two MISSes with a large
`content-length` confirms the finding.** A 307, or a small body, means the exposure is
limited to invocations and you can drop this to "leave open".

**Fix (small, no rewrite — it removes work rather than adding code):**
1. Validate `id` with the existing `isCuid()` from `@/lib/api` — already imported across
   the DM routes — so bogus ids cost nothing.
2. **Verify `v` against the token `publicImageUrl` derives**, rather than ignoring it.
   Mismatch → 404 with `MISS_CACHE`. This collapses the cache-key space from unbounded to
   exactly one per image and is the change that actually closes it.
3. Optional belt: an IP-keyed `rateLimit("media", clientIp(req))` bucket.

**Blast radius:** one file. **Effort:** ~30 minutes. **Cost implication:** eliminates an
unbounded FOT/invocation vector; no legitimate request changes, because real links already
carry the correct token. **Not safe to leave unattended** — this is the single item where
months of absence converts a bug into a bill.

---

### 2. `realtime-channels.test.ts` is vacuous — it verifies nothing
**[VERIFIED]** — `src/lib/__tests__/realtime-channels.test.ts:17`

This is precisely the shim hazard, and it has already happened:

```ts
const SRC = readFileSync(join(process.cwd(), "src/lib/realtime-channels.ts"), "utf8");
const importLines = [...SRC.matchAll(/^\s*import\s.+$/gm)].map((m) => m[0].trim());
```

Since `#203`, that path is a one-line shim:
```ts
// src/lib/realtime-channels.ts — entire file
export * from "@core/realtime/realtime-channels";
```

A shim has **no `import` statements** — it uses `export * from`. So `importLines` is `[]`,
and both assertions pass against an empty array:

- `it("has no imports at all")` → `expect([]).toEqual([])` → **vacuous**
- `it("in particular imports nothing server-side")` → filters `[]` → **vacuous**

The real module `src/core/realtime/realtime-channels.ts` is **never read**. Someone could
add `import { env } from "@/lib/env"` to it and both tests would still be green. I
confirmed the real module is currently clean (no import statements), so this is a **latent
hole, not a live break** — the guard is gone, the property still holds today.

Note the third describe block (`channel names are stable`) is fine: it *imports* the
symbols through the shim, so it exercises runtime values, not text.

**Reachability:** not an attack — a missing guard on a regression that already happened
once (`#189`, three client components pulling the env module into the browser bundle).

**Fix:** change line 17 to `src/core/realtime/realtime-channels.ts`, and add the
anti-vacuous assertion this repo already uses elsewhere — `journal-activity-revocation.test.ts:83`
does exactly this with `expect(creates.length).toBeGreaterThanOrEqual(6)`. Here:
`expect(SRC.length).toBeGreaterThan(200)` plus asserting a known export name appears.

**Blast radius:** one test file. **Effort:** 10 minutes. **Cost:** none.
**Fix before you pause** — not because it is dangerous now, but because it is 10 minutes
and it is the exact class of failure this project keeps repeating.

---

## 🟠 SHOULD FIX — cheap, and each is a silent-failure class

### 3. Two live copies of the markdown renderer; a security fix would land in the dead one
**[VERIFIED]** — `src/lib/markdown.tsx` (94 lines) vs `src/shared/utils/markdown.tsx` (94 lines)

They are byte-identical apart from one import specifier (`./links` vs `@/lib/links`, which
resolve to the same module). **Every consumer imports the legacy path:**
```
src/app/research/[slug]/page.tsx:8                   import { Markdown } from "@/lib/markdown";
src/modules/community/components/PostEditor.tsx:4    "@/lib/markdown"
src/modules/ai/components/XyzAiWidget.tsx:9          "@/lib/markdown"
```
Nothing anywhere imports `@shared/utils/markdown` — I grepped; the result is empty.

**Why this matters more than ordinary duplication:** this is the markdown sanitizer, on the
path that renders user-authored research posts, chat posts and AI output. The repo's own
convention (`CLAUDE.md`) says *"Import from the real module"* under `modules/core/shared`.
A future session following that convention would fix a sanitizer bug in
`src/shared/utils/markdown.tsx` — **the copy nobody imports** — run the tests
(`markdown-render.test.ts:2` imports `@/lib/markdown`, the live one, so it would still
pass), and ship a fix that does nothing.

**Fix:** delete `src/shared/utils/markdown.tsx`, or reduce it to a shim pointing at the
live copy. **Effort:** 5 minutes. **Blast radius:** zero — the file is unreferenced.

### 4. `jsonld` shim points the wrong direction
**[VERIFIED]** — `src/lib/jsonld.tsx` holds the real code; `src/shared/utils/jsonld.tsx` is the shim

Every other shim points legacy → new. This one is inverted: the "new" location re-exports
the legacy one. Same trap as #3 in reverse — anyone auditing `src/shared/utils/jsonld.tsx`
sees a shim and goes looking for an implementation under `modules/` that does not exist.
Contains the `</script>` breakout escaping, so it is not a file you want people confused
about. **Effort:** 10 minutes to invert. Cosmetic today; a navigation trap later.

### 5. Block enforcement fails **open** on any DB error
**[VERIFIED]** — `src/modules/messages/lib/dm-gate.ts:40`

```ts
.catch(() => null); // not-yet-migrated: fall open rather than break DMs
return !!row;
```
A thrown query returns `null` → `false` → **not blocked**. The same pattern at `:66` makes
`dmPrivacy` degrade to `"everyone"`.

The intent is defensible (don't break DMs on a migration lag) and it is documented. But on
*this* repo the premise is not hypothetical — `db push` failed silently on **every deploy
for weeks** (`CLAUDE.md` gotchas). If the `Block` table drifts, **every block silently stops
working**, harassers get through, and with Sentry dark there is no signal at all. The
person it protects is the least likely to file a report.

**Reachability:** requires a DB/schema fault — not attacker-triggered.
**Fix:** distinguish "table missing" (P2021/P2022 → fall open, as today) from any other
error (→ fail closed). `handleError` already maps those Prisma codes, so the precedent
exists. **Effort:** ~20 minutes. **Safe to leave unattended only if you accept that a
schema fault silently disables blocking.**

### 6. Journal-activity revocation is best-effort and can silently fail permanently
**[VERIFIED]** — `src/app/api/journal/trades/[id]/route.ts:115-117`, `:150-152`; same shape in `challenges/[id]/route.ts:123,158`

```ts
await prisma.journalActivity
  .deleteMany({ where: tradeActivityWhere(trade.id, me.id) })
  .catch(() => {}); // best-effort - never blocks the trade update
```
The mechanism is otherwise **correct and well-tested** — both revocation triggers (delete
the trade; drop visibility to private) delete the published rows, and
`journal-activity-revocation.test.ts` verifies every create site records a source *and*
guards against a vacuous sweep (`:83`).

The gap is the swallow. If the delete fails once, the row stays in the public feed —
readable anonymously via `api/journal/share/activity/[userId]` (no session gate by design,
`route.ts:8-14`) and on `/u/[username]`. There is no retry, no queue, no log, and with
Sentry dark, no signal. **A user who revoked their trading history would believe it was
withdrawn while it was still public** — and neither of you would find out.

**Reachability:** requires a transient DB failure during revocation. Low probability,
permanent and silent when it lands.
**Fix:** on failure, either return a non-OK to the caller so the UI can retry, or write a
row for reconciliation. Do **not** simply remove the `.catch` — that would fail the trade
update itself. **Effort:** ~30 minutes. Judgement call, not urgent.

---

## 🟡 LOW — note, do not act before 14 August

### 7. Floating promise: an activity row may never be created
**[VERIFIED]** — `src/app/api/journal/trades/[id]/route.ts:120-124` — `prisma.journalActivity.create(...)` with **no `await`**

Vercel may freeze the function once the response is sent, dropping the pending promise.
Symptom is a *missing* feed entry — fails in the safe direction (under-publishing, not
over-publishing). Contrast `:113` and `:150`, which are awaited.

### 8. Bundle floor moved 69 kB → 32 kB; treat the old baseline as not comparable
**[VERIFIED]** — `node scripts/bundle-report.mjs` at `bae69a7`

```
/dashboard 238   /settings 134   /news 126   /journal 125   /messages 122
/community 122   /          118   /research/[slug] 112   /markets 109
/login 41        /signup 41      /_not-found 32
```
Route-level numbers are near-flat vs the `59dddbf` baseline (`/dashboard` 237→238, `/`
117→118). But the floor (`/_not-found`) dropped **69 → 32**, which is too large to be real
tree-shaking. Most likely the manifest shape changed and a shared framework chunk is no
longer being counted — meaning **all** current numbers may under-report against the old
ones. Use the table above as the new baseline; do not diff it against the pre-`#210`
figures.

---

## ✅ CLEAN — checked, explicitly, and nothing to do

- **All 7 new routes are properly authorized server-side.** `presence` GET is
  `getAdminSession()` + `private, no-store` (`route.ts:79,92`); `reports` GET **and** PATCH
  both `requirePermission("post:manage")` (`:33,:107`); `chat/presence` and `presence` POST
  both session-gated and rate-limited on the `chatPresence` bucket; `dm/block` and
  `dm/report` session-gated, `isCuid`-validated, rate-limited on `dm`.
- **DM read authorization is enforced server-side on every path**, not implied by UI.
  `api/dm/[id]:22` and `api/dm/[id]/message/[messageId]:40` both reject a non-participant;
  `api/dm` and `api/dm/unread` scope by `OR:[{userAId:me.id},{userBId:me.id}]`. No IDOR.
- **`dmPrivacy` traces end to end correctly** — zod enum at `profile.ts:168`, enforced
  server-side in `dm-gate.ts:61-77`, and correctly gates only *new* conversations. The
  "following" direction is right (the recipient's follow list, not their followers), and
  block/privacy share one failure message so a harasser gets no confirmation signal.
- **`parseDataUrl` re-validates MIME against an image allowlist** (`shared/utils/media.ts`)
  before it reaches a `Content-Type` header — `image/svg+xml` deliberately excluded. **No
  stored-XSS via the media route.**
- **`chat-media.ts` fails closed and documents why** (`:38-52`), including a fixed
  substring-match bug that previously allowed `https://attacker.example/storage/v1/object/public/x.gif`.
  This is the pattern the rest of the repo should copy.
- **Realtime has exactly one `createClient()` (`core/realtime/realtimeClient.ts:23`) and
  one `client.channel()` (`shared/utils/sharedChannel.ts:105`).** Singleton intact; no new
  subscription bypasses the registry.
- **`NEXT_PUBLIC_*` audit: no guard is silently disabled by an unset var.** Seven vars in
  use; six are feature flags that degrade visibly (GA, GSC, VAPID, site URL, Supabase
  realtime). The only guard-shaped one — `chat-media`'s storage-origin allowlist — fails
  closed. **Sentry remains the sole instance of the pattern, and it is already known.**
- **`src/lib/env.ts` does NOT reopen the `#189` hole.** The hypothesis in the brief is
  wrong, in the safe direction. `export * from "@core/env/env"` is a static dependency
  edge, so a client component importing the shim still pulls `@core/env/env`, which carries
  `import "server-only"`. That resolves via `next/dist/compiled/server-only`, whose
  `exports` map sends non-`react-server` conditions to an `index.js` containing a bare
  `throw` — a build error. The guard survives the shim. *Confirmation step, since I could
  not run a build in report-only mode: add `import { env } from "@/lib/env"` to any
  `"use client"` file and run `npm run build` — it must fail.*
- **Rate limiting:** every mutating handler among the new routes has a bucket. `dm/search`
  uses the `comment` bucket — odd naming, correct behaviour.
- **The other four source-reading tests point at real paths, not shims.**
  `api-rate-limits` and `journal-activity-revocation` glob `src/app/api/**/route.ts` (routes
  were never moved by `#203`); `password-change-revokes-sessions` reads `src/core/auth/auth.ts`
  and `prisma/schema.prisma`; `markets-poll-alignment` was fixed in `#236`. **Only
  `realtime-channels.test.ts` is vacuous.**

---

## Closing answers

### 1. What MUST be fixed before 14 August

**Two items. Nothing else.**

1. **`/api/media/**` cache-key validation** (Finding 1) — *conditional*: run the two curl
   one-liners first. If you see MISS + a large `content-length`, fix it; that is an
   anonymous, unthrottled path to your entire monthly FOT budget, running unwatched for
   months. If it 307s, demote it to "leave open".
2. **Point `realtime-channels.test.ts` at the real module** (Finding 2) — 10 minutes, and
   it is the failure class this project repeats.

I deliberately kept Findings 3–6 off this list. They are real, but each fails in a safe
direction or needs a precondition, and a long list you half-finish before pausing is worse
than a short one you complete.

### 2. Safe to leave open for months, and why

- **3, 4 (duplicate/inverted modules)** — inert. The risk activates only when someone edits
  them, and nobody will be editing during the pause. Fix on return, before new work.
- **5 (block fails open)** — needs a schema fault to trigger. Migrations now fail the build
  loudly, so the drift that made this dangerous is much less likely than when it bit before.
- **6 (revocation swallow)** — needs a transient DB failure at the exact moment of
  revocation. Low probability; genuinely bad when it lands, which is why it is written down.
- **7, 8** — a missing feed row and a measurement artefact.
- **The two competing admin definitions** (`getAdminSession()` role-only vs `isSuperAdmin()`
  flag-or-role) — still open, still fails *closed*, still needs a decision rather than a
  drive-by. Unchanged from the earlier report.

### 3. What the earlier work got wrong, or has regressed

- **The 07-26 audits do not exist.** Not stale — absent from history entirely. Anything you
  believe was covered by them is unverified.
- **`#203` is described as complete; it is not.** 37 files of real code remain in the legacy
  tree, one shim points the wrong way, and one module exists twice. The "`src/lib/*` are
  re-export shims" line in `CLAUDE.md` is true enough to be misleading.
- **A regression the shim hazard already caused:** `realtime-channels.test.ts` has been
  passing vacuously since `#203`. `markets-poll-alignment.test.ts` was the near-miss that
  got caught; this one was not.
- **The brief's `src/lib/env.ts` hypothesis is wrong** — stated above with the mechanism.
  Worth recording so it is not re-raised.
- **`docs/PERFORMANCE.md` still claims `/research/[slug]` runs at `revalidate=60`; it is
  300.** Flagged previously, still uncorrected, still not in `SUMMARY.md`.

### 4. What I did NOT examine

Stated plainly so it is not mistaken for coverage:

- **`src/lib/ai/` (~600 lines across 14 files)** — never moved by `#203`, and I did not
  audit the gateway, provider fallback chain, prompt construction, or the daily-limit
  accounting. Prompt-injection surface on `/api/ai/*` is **unaudited**, and the missing
  07-26 audit means I cannot assume anyone else did it.
- **The ~20 homepage components still in `src/components/`** (Hero, Icons3D, Orbital*) —
  presentational, low security value, skipped deliberately.
- **XSS/injection sweep generally.** I checked the markdown and media paths because they
  surfaced through other findings. I did **not** run a systematic
  `dangerouslySetInnerHTML` / `href` / template-injection sweep — and since the 07-26 audit
  it was supposed to defer to does not exist, **that area currently has no committed
  coverage at all.** This is the largest gap in this report.
- **Live-site verification of anything.** No network access to `xyzcrypto.io`; every live
  check is written as a copy-pasteable one-liner for you to run.
- **The `#210` Mumbai move and caching changes** beyond confirming the realtime singleton
  and enumerating polls. `markets-poll-alignment.test.ts` covers poll↔window alignment and
  is not vacuous, so I relied on it rather than re-deriving.
- **Repository and org configuration — I never looked outside `src/`.** No review of branch
  protection, collaborator access, required reviews, `CODEOWNERS`, code scanning, or
  environment separation. That turned out to be the largest omission in this report: the
  independent engineering review in `docs/REPORT-2026-08-05-engineering-review.md` (#253,
  same commit) found `main` **unprotected** with two `write` collaborators, and I verified
  via the GitHub API that the repo is **`"private": false` — public**. A public repo with an
  unprotected default branch, going unwatched for months, **outranks every finding in this
  document** on the stated criterion, and it is a ten-minute settings change.
  Two consequences follow that I also missed: `security.yml:9` justifies removing CodeQL
  because *"the repository was made private"* — no longer true, so free static analysis on
  49k lines is unclaimed; and preview deploys share the **production `DATABASE_URL`**, so a
  preview that writes is writing to production data.

- **`npm audit` / dependency CVEs — ⚠️ CORRECTED 2026-08-07.**
  This bullet originally read: *"CI runs this and it was green on the last run."* **That was
  wrong, and wrong in the exact way this whole report is about.** Verified directly:

  ```
  next     9.3.4-canary.0 - 16.3.0-preview.10   fix available
  postcss  XSS via unescaped </style>            fix available
  sharp    libvips CVE-2026-33327 / -33328 / …   fix available
  3 high severity vulnerabilities
  ```

  The `npm audit` check is green **only because of `|| true`** (`.github/workflows/security.yml:79`),
  whose own comment says *"visibility, not a hard gate."* I cited a passing check as
  evidence of coverage on a check deliberately built never to fail — the same shape as the
  vacuous test in Finding 2, committed inside the audit that reports it. All three
  advisories have fixes available. Recorded rather than silently edited, for the reason
  given throughout: a claim someone might later build a decision on.
