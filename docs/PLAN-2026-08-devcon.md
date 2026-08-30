# Devcon runway — 10-day plan (2026-08-21 → 2026-08-31)

**Goal:** get xyzcrypto.io to a state you can confidently put in front of people at
Devcon in November.
**Budget:** 30–60 min/day of *owner* time. Claude does the code; your time goes to
the things only you can do.
**At the end:** Day 10 is the planning session for September + October.

---

## The one structural idea

Most of what is blocking this site is **not code**. It is six values in two
dashboards and a redeploy. Claude cannot do any of those — no access to Vercel,
Supabase, or the live site (egress is blocked by policy).

So the split is:

| Your 30–60 min | Claude's job |
|---|---|
| Dashboard actions, secrets, redeploys, running SQL, verifying on a real phone | Writing and testing the code, opening PRs, documenting |

Days 1–5 are almost entirely yours and unblock everything else. Days 6–9 are
mostly review-and-merge. **Front-load the dashboard work** — it is cheap in time
and it is what is actually holding the site back.

---

## ⚠️ One hard date inside this window

**Supabase says projects are restricted from 31 Aug 2026** if the org stays over
its previous-cycle quota (seen on the dashboard 2026-08-18, `HANDOFF §8` item 7).

The current cycle is well inside every limit — egress 2.36/5 GB, DB 44/500 MB,
storage 4 MB/1 GB, MAU 0/50 000 — so nothing is failing today. But the database is
what the entire site runs on, and the date is fixed and lands inside these 10 days.
**This is Day 1 and it is not optional.** Everything else on this list is worthless
if the database is restricted in November.

---

## Phase 1 — Make failures visible (Days 1–4)

Right now this site cannot tell you when it breaks. Sentry has no DSN in any
runtime, so nothing reports an error from the browser, server, or edge. Every bug
fixed this month was **reported by a user**, not caught. That is survivable at
today's traffic. It is not survivable when you hand your URL to people at a
conference.

### Day 1 — Supabase quota (20 min, owner)

1. Supabase → **Usage**. Find which metric went over in the **previous** cycle.
2. Note how far into the current cycle you are — 2.36 GB early-cycle projects over
   5 GB; late-cycle it does not.
3. Egress is the likely one. The 2026-08 work already cuts it (inline `data:`
   avatars stopped being re-serialized into every poll, avatars are CDN-cached now).
4. If it is genuinely going to breach again: decide upgrade vs. trim, and tell
   Claude — there is more egress work available.

### Day 2 — Set every pending env var, then **one** redeploy (30 min, owner)

Four separate items have been waiting on a redeploy each. Do them in one pass.
`NEXT_PUBLIC_*` is inlined at build time, so **setting a value alone does nothing** —
the redeploy is the step that matters.

In Vercel → Settings → Environment Variables:

| Variable | Value | Unblocks |
|---|---|---|
| `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` | from sentry.io | all error visibility |
| `AI_PROVIDER_ORDER` | `groq,gemini` | AI speed (see below) |
| `NEXT_PUBLIC_GSC_VERIFICATION` | from Search Console | SEO indexing |
| `NEXT_PUBLIC_GA_ID` | from GA4 | measuring Devcon traffic |

Then **Redeploy** (production).

> **On AI speed** — you said the assistant feels slow. It already streams, so
> this is not a streaming problem; it is time-to-first-token. Gemini is currently
> primary. Groq's entire product is fast inference. Flipping the order is an env
> var, not a code change, and it is likely the single biggest perceived-quality
> win available for zero risk. If it does not help, we measure properly and fix
> the real cause.

### Day 3 — Verify all four landed (30 min, owner)

Setting a variable is not evidence it works. Check each:

- **Sentry** — trigger a test error, confirm it appears in the Sentry dashboard.
  Check **both** browser and server.
- **AI** — open the assistant, time the first token. Compare to before.
- **GA** — GA4 Realtime should show you.
- **GSC** — Search Console verification should pass.

### Day 4 — Verify the three unverified fixes + PageSpeed baseline (45 min, owner)

Three fixes shipped but were never confirmed on the live site (Claude cannot reach
it). From a real phone:

- **Login** (#285) — a member who has reset/changed their password signs in and
  lands *signed in*.
- **Avatar** (#283) — a profile shows a photo, not a name as text.
- **DM quote** (#283) — replying to a photo shows **📷 Photo**, not a storage URL.

Then run PageSpeed (mobile) on `/`, `/research`, `/markets`, `/community` and save
the numbers. **This is your baseline** — without it, "is the site faster?" in
October is unanswerable.

---

## Phase 2 — Remove the things that can break at the worst moment (Days 5–7)

### Day 5 — XYZ Sentinel (30 min, owner)

The watchdog is dark, so nothing is checking whether the site is up. One
unauthenticated request now tells you which of the two causes it is:

```
curl -s -o /dev/null -w "%{http_code}\n" https://xyzcrypto.io/api/watchdog
```

- **503** → the variable is absent from the running deployment. **Redeploy.** No code change.
- **403** → present, but the earlier probe's token was wrong. Re-check the value.

Then the second door: `watchdog.yml`'s `schedule:` is still commented out, and it
reads secrets from **GitHub Actions**, not Vercel. A green workflow run is *not*
evidence it ran — it exits 0 with a skip message when secrets are missing. Both
doors have to be opened.

### Day 6 — `next/font/local` migration (20 min owner review, Claude codes)

`next/font/google` **downloads fonts at build time**. CI already hit this on
2026-08-11 — `module-not-found` on `fraunces_*.module.css`, while the *same commit*
built green in a parallel run. The same fetch failing on Vercel reds your deploy
with no code change, and you cannot fix it from a conference floor.

Fraunces and Geist are both OFL, so committing the files is fine. **The hero UI is
approved — this must be byte-identical in output, not a restyle.**

### Day 7 — PR #284 (30 min, owner)

Reviewed and sound, but has one blocker and **the order matters**. `Post.readMinutes`
is `Int @default(0)` with no backfill, and `PostCard` renders `${post.readMinutes}m`
with no fallback — so every existing article shows **"0m read"** until backfilled.

Sequence (the column does not exist until the deploy runs `db push`, so running the
SQL first fails):

1. Paste the backfill SQL into the Supabase editor — **do not run it**
2. Merge the PR
3. Wait for the build; confirm `in sync with your Prisma schema` in the build log
4. **Now** run the SQL
5. Wait out the 5m ISR window on `/` and `/research`

SQL and verification query: `HANDOFF §8` item 1.

> **Repo rule:** #284 is `deepakpss`'s PR. **You merge it, not Claude.**

---

## Phase 3 — RAG foundation (Days 8–9)

**Honest scope:** RAG will not be finished in two days at this budget. There is
currently **no pgvector and no embeddings** — this is greenfield. Days 8–9 lay
foundations; retrieval and evaluation are the September plan.

Why it is worth starting now: a generic chatbot is not a differentiator at Devcon —
every project has one. An assistant that answers accurately *from your own research
library* is. That is the demo.

### Day 8 — Enable pgvector + schema (10 min owner, Claude codes)

- Owner: Supabase → Database → Extensions → enable **`vector`**. Two minutes.
- Claude: embedding table + migration + chunking strategy, opened as a PR for review.

Decision needed from you: **what the assistant should be grounded in.** Research
posts only, or also news, docs, and market data? This changes the schema.

### Day 9 — Embedding pipeline + backfill (30 min owner, Claude codes)

- Claude: embedding generation (Gemini embedding API) + backfill script.
- Owner: run the backfill over existing research posts, confirm row counts.

Retrieval wiring into the assistant lands early September.

---

## Day 10 — Month-end review + plan September/October (60 min, together)

The session you asked for. Inputs to bring:

- What actually got done vs. this plan (and where it slipped — that is the useful data)
- PageSpeed baseline from Day 4
- Sentry's first week of real errors — this will likely surprise you
- The Supabase quota answer from Day 1

Then we scope Sept + Oct against a November Devcon date.

---

## 🅿️ Parked — X / trusted-source feed (decide on Day 10)

Owner idea, 2026-08-21: a section in `/news` that surfaces important posts from
trusted X accounts as fast as possible. **Parked, not rejected.** Research below so
it does not have to be redone.

**It fits the existing architecture.** `/api/news` is already an RSS aggregator —
29 keyless sources (`news-sources.ts`), best-effort (a down feed is skipped),
`revalidate = 90` with `s-maxage=90, stale-while-revalidate=300`, and **no cron**
(it refreshes on demand, so it costs nothing when nobody is looking). Adding a new
*source type* is a natural extension, not a rewrite.

**The blocker is X API pricing, not engineering.**

| Tier | Cost | Read access |
|---|---|---|
| Free | $0 | effectively write-only — not usable for reading timelines |
| Basic | **~$200/month** | ~15k tweet reads/month |
| Pro | ~$5,000/month | — |

Even Basic does not obviously work: 20 accounts polled every 5 min is ~5,760
calls/day, which burns a 15k/month quota inside a week. ⚠️ **Pricing is from
training data and moves — verify at x.com/products/x-api before committing.**

Unofficial routes (Nitter, RSSHub) are largely blocked by X, break constantly, and
carry ToS risk. Not production-worthy for this site.

**The cheaper path that actually works — Telegram.** Nearly every crypto "trusted
source" that posts on X also broadcasts on Telegram (Whale Alert, Watcher Guru,
protocol announcements, analysts). The Bot API is free and reliable, and public
channels also expose a keyless HTML page at `t.me/s/<channel>`. Same outcome, no
$200/month.

**Plus admin curation.** A "pin this post" action in `/dashboard` (the admin CRUD
pattern already exists) lets the owner put any X URL at the top by hand. Zero cost,
and it is the literal meaning of "trusted source" — the owner's judgement.

**Reframe the goal.** Being *faster than X* is not achievable — the post originates
there. What is achievable, and more defensible, is being the one place where a
curated trusted set is **ranked and summarised**. The AI briefing already does the
summarising half.

**Estimated size:** ~1–2 days of Claude work for the Telegram + admin-pin version,
because the whole RSS pipeline is reused. **Recommended slot: September**, not these
10 days — RAG is the stronger Devcon differentiator, and two large features do not
fit ~8 hours of owner time per month.

**If it is built:** it adds a polled GET route and external fetches, so load the
`cost-check` skill first — every caching and cost number lives there, and CLAUDE.md
requires `Cache-Control` on a new public GET route from day one.

---

## What is deliberately NOT in these 10 days

Naming these so they are decisions, not oversights:

- **New features.** Nothing here adds surface. Before a conference, *reliability and
  speed* are the work; a new half-finished feature is worse than none.
- **Finishing RAG.** Foundation only. Rushing it produces an assistant that
  confidently answers wrong, which is worse at Devcon than not having it.
- **The Journal share-card robots question** (`HANDOFF §8` item 6). Needs a product
  decision — is anyone expected to paste those PNG links into a social post? Not
  urgent, but decide it in the Day 10 session.
- **A redesign.** The frontend is approved and production-ready. Leave it.

---

## Standing rules for this run

- Definition of done stays: **typecheck + lint + test + build all green** before push.
- Anything touching routes/caching/data/realtime runs the **`pre-merge`** skill first.
- Only owner-authored PRs get merged by Claude. #284 is Deepak's — you merge it.
- Update `docs/changelog.md` after every meaningful change.
