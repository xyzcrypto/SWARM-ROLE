# XYZ Crypto — Engineering Review

**Date:** 2026-08-05 · **Reviewed at:** `main` @ `bae69a7` · **Reviewer:** Claude (Opus 5)

Every number in this document was measured against the repository at that
commit, or read out of a live API. Where something could **not** be verified
from the review environment, it says so rather than estimating. That
distinction is the point of the document — a report you cannot trust the
uncertain parts of is a report you cannot trust the certain parts of either.

---

## 0. Executive summary

The codebase is **stronger than its process**. The application-layer security
work is genuinely good — layered rate limiting, HMAC-hashed OTPs, timing-attack
normalisation, fail-closed session revocation, a real CSP. The tests encode
invariants rather than trivia. The documentation culture is unusually
disciplined.

The exposure is almost entirely in **who can do what, and what happens when
something breaks**:

| # | Finding | Severity | Effort |
|---|---|---|---|
| 1 | `main` has **no branch protection**; two collaborators hold `write` | 🔴 Critical | 10 min |
| 2 | **Nothing reports errors** — Sentry has no DSN in any runtime | 🔴 Critical | 30 min |
| 3 | 3 **high** npm advisories, all with fixes available, CI does not gate | 🟠 High | 1 hour |
| 4 | **CodeQL was removed** on a private-repo assumption that is no longer true | 🟠 High | 15 min |
| 5 | XYZ Sentinel (`/api/watchdog`) 403s; its cron is paused | 🟡 Medium | 1 hour |
| 6 | Two conflicting definitions of "admin" in the authz layer | 🟡 Medium | 1 hour |
| 7 | 60 branches, ~52 of them stale | 🟢 Low | 30 min |

**If you do one thing this week, do #1.** Everything else is recoverable; an
unprotected `main` on a public repo with three write-capable accounts is the
one that can go wrong quietly and irreversibly.

---

## 1. What the project actually is (measured)

| Metric | Value |
|---|---|
| TypeScript / TSX files | 697 |
| Lines of source | 49,071 |
| API route handlers | 99 |
| Total routes (build) | 131 — 22 static · 109 dynamic · 12 ISR |
| Prisma models | 42 |
| Migrations | 35 |
| Test files / assertions | 64 files · 520 tests |
| CI workflows | 4 (`ci`, `security`, `watchdog`, `push-dispatch`) |
| Collaborators | 3 (1 admin, 2 write) |
| Branches | 60 |

This is not a prototype. At ~49k lines with 99 API routes and 42 models, it is
a mid-size production application, and it should be governed like one.

---

## 2. Security — step by step

### 2.1 The layers that exist, in request order

This is the actual path a request takes. Each layer was read in source, not
assumed.

```
1. Edge / headers      next.config.mjs  → CSP, HSTS (2y, preload), X-Frame-Options: DENY,
                                          frame-ancestors 'none', object-src 'none'
2. Rate limiting       lib/ratelimit.ts → 20 named buckets, Upstash-backed
3. Input validation    zod schema parse on every mutating body
4. Authentication      next-auth JWT; jwt callback re-reads the DB on a 60s TTL
5. Authorisation       getSessionUser() / getAdminSession() / requirePermission()
6. Data access         Prisma, parameterised by construction
7. Error shaping       handleError() maps Prisma P2021/P2022 → graceful 503
```

**Layer 1 — Headers.** CSP is real and reasonably tight: `frame-ancestors
'none'`, `object-src 'none'`, `'unsafe-eval'` deliberately dropped
(2026-07-03). `'unsafe-inline'` remains for script and style — a known,
documented trade for Next.js inline bootstrap and Tailwind. HSTS is 2 years
with `preload`.

*Residual risk:* `'unsafe-inline'` on `script-src` means CSP is not a
meaningful second line of defence against injected script. It is mitigated by
the sanitisation work, not by CSP. Moving to a nonce-based CSP is the real fix
and is a genuine project, not a config tweak.

**Layer 2 — Rate limiting.** 20 named buckets. The design is better than most
production systems I see: **security-sensitive flows use two independent keys**
so neither IP rotation nor a fixed victim can bypass them.

- login → `login` (per-email) **and** `loginIp` (20/min/IP, checked *before* any
  bcrypt runs)
- OTP send → `signup`/`password` (per-IP) **and** `otpEmail` (3 per 10 min per
  target address)

IP comes from `clientIp()`, which prefers the **un-spoofable**
`x-vercel-forwarded-for` over the client-controllable `x-forwarded-for`. That
is the correct choice and it is not the obvious one.

*The trap that remains, and it is documented:* when `UPSTASH_*` is unset,
`rateLimit()` returns success unconditionally and **every limiter silently
no-ops**. Upstash was verified live in production on 2026-07-29, so this is
currently fine — but it is a configuration away from being a total loss of rate
limiting with no error and no alarm. Given finding #2 (no error reporting),
nothing would tell you.

**Layer 3 — Validation.** Every mutating handler zod-parses its body. This is
enforced by convention, and partially by test
(`api-rate-limits.test.ts` asserts rate limiting on every mutating handler —
the same pattern should be extended to validation).

**Layer 4 — Authentication.** JWT sessions. Passwords are bcrypt at cost 12.
OTPs are HMAC-hashed, 6 digits, generated with `randomInt` (not `Math.random`).
Login timing is normalised with a dummy bcrypt compare so a nonexistent account
cannot be distinguished by response time.

As of PR #252 (merged today), **changing a password revokes sessions issued
before it** — closing a hole where a stolen session survived a password reset
for up to 30 days. Revocation is bounded by the same 60s TTL as role and
membership changes.

**Layer 5 — Authorisation.** Three gates: session, admin, and per-capability
permissions. See finding #6 — the admin gate and the permission gate disagree
about who counts as an admin.

**Layer 6 — Data access.** Prisma throughout; no raw SQL string interpolation
found. SQL injection is structurally excluded rather than defended against,
which is the right way to not have that class of bug.

**Layer 7 — Error shaping.** `handleError()` maps missing-column Prisma errors
to a graceful 503 rather than leaking a stack trace. Good.

### 2.2 Finding #1 — `main` is unprotected 🔴

**Verified via the GitHub API:**

```
repo visibility      public
branch main          "protected": false
collaborators        xyzcrypto (admin) · deepakpss (write) · Yaz42 (write)
```

Concretely, right now:

- Anyone with write access can **push directly to `main`**, bypassing CI
  entirely. The `ci.yml` checks are advisory, not required.
- Anyone with write access can **merge their own PR** with no review.
- Force-pushing `main` is not blocked.

**This is not hypothetical.** PR **#252** — a real authentication change that
also modifies `prisma/schema.prisma` — was **authored by `Yaz42` and merged by
`Yaz42`**, today, with no second pair of eyes. The change itself looks careful
and well-tested. That is not the point. The point is that the process permitted
a single person to put an auth change and a schema migration into production
alone, and would equally permit a careless one.

Your own rule — *"only merge PRs authored by the owner"* — is written in
`CLAUDE.md`. That is a **social control**. It binds anyone who reads and honours
the file. It does not bind anyone who does not.

**Fix (10 minutes, Settings → Branches → Add rule for `main`):**

| Setting | Value | Why |
|---|---|---|
| Require a pull request before merging | ✅ | Ends direct pushes |
| Required approvals | 1 | Ends self-merge |
| Dismiss stale approvals on new commits | ✅ | An approval should mean *this* code |
| Require status checks to pass | ✅ `build`, `npm audit` | Makes CI a gate, not a suggestion |
| Require branches to be up to date | ✅ | Catches semantic conflicts CI would miss |
| Do not allow bypassing the above | ✅ | Including admins — otherwise it is advisory again |
| Restrict force pushes | ✅ | `main` history becomes append-only |

⚠️ **One caveat specific to your workflow.** "Required approvals: 1" means
**you cannot merge your own PRs unaccompanied either** — you would need
`deepakpss` or `Yaz42` to approve. If you want to keep shipping solo, set
approvals to 0 but keep *require PR* + *require status checks* + *restrict force
pushes*. That still ends direct-to-`main` pushes and makes CI binding, which is
most of the value. It does not stop a teammate self-merging — for that you need
approvals ≥ 1, or `CODEOWNERS` with required review on the paths you care about
(`src/core/auth/**`, `prisma/**`, `.github/**`).

My recommendation: **approvals 1 + a `CODEOWNERS` file naming you on
`prisma/**` and the auth paths.** It costs you a click from a teammate on
ordinary PRs and makes the rules that currently live in a markdown file real.

### 2.3 Finding #2 — nothing reports errors 🔴

Sentry has **no DSN in any runtime** — browser, server or edge. This is
recorded in `HANDOFF.md §8` and remains true.

The consequence is not "we lack nice dashboards". It is:

- A 500 on checkout, signup or payment is **invisible** unless a user tells you.
- The Upstash-missing failure mode above would be **silent**.
- The `db push` failure that ran on **every deploy for weeks** in July was found
  by accident. The same class of thing would still be found by accident.

`NEXT_PUBLIC_*` is inlined at build time, so adding the variables **requires a
redeploy** — setting them in Vercel alone will not take effect.

This is the highest ratio of risk-removed to effort-spent on the list.

### 2.4 Finding #3 — 3 high advisories, not gated 🟠

```
high   next      fix available
high   postcss   XSS via unescaped </style> in CSS stringify output
high   sharp     inherited libvips CVE-2026-33327 / -33328
```

All three have fixes available. CI runs:

```yaml
- run: npm audit --audit-level=high || true
```

The `|| true` is deliberate and documented — audit reports, never blocks. That
was a defensible call when the alternative was a red build on an unfixable
transitive advisory. It is less defensible when **all three are fixable** and
one of them is the framework itself.

**Suggested change:** keep `|| true` for the weekly scheduled run, but make the
PR run fail on **high or critical with a fix available**. That gates the case
you can act on and stays quiet about the case you cannot.

### 2.5 Finding #4 — CodeQL was removed on an assumption that expired 🟠

`security.yml` says, in a comment:

> This workflow used to run GitHub's CodeQL static analysis. It was removed when
> the repository was made private, because code scanning is not available on a
> private repo without GitHub Advanced Security.

That reasoning was correct. **It is no longer true** — the API reports
`"visibility": "public"`, and CodeQL is **free on public repositories**.

So the project is currently paying nothing and getting nothing, when it could
pay nothing and get static analysis of a 49k-line TypeScript codebase. Restoring
that workflow is close to pure profit.

*(There is a branch named `claude/fix-codeql-permissions` already, which
suggests the plumbing exists.)*

### 2.6 Finding #5 — XYZ Sentinel is dark 🟡

`/api/watchdog` returns 403 despite `CRON_SECRET` being set in Vercel, and its
cron is paused. A security watchdog that does not run is worse than no watchdog,
because the org believes it is covered.

Either fix the 403 and re-enable the schedule, or **delete it and say so**. The
failure mode to avoid is leaving it in the repo looking operational.

### 2.7 Finding #6 — two definitions of "admin" 🟡

Noted inside PR #252 and worth elevating, because it is the kind of thing that
grows into a real vulnerability:

- `getAdminSession()` (`shared/utils/api.ts`) checks `role !== "ADMIN"` only.
- `isSuperAdmin()` accepts **either** the flag **or** the role.

A Super Admin listed in `ADMIN_EMAILS` therefore passes every
`requirePermission()` gate but is 401'd by every `getAdminSession()` route. It
fails **closed**, so today it is a correctness bug, not a hole.

The risk is directional: when two functions disagree about who is an admin, the
next person to write an authz check picks one, and eventually somebody picks
the one that fails *open*. Collapse them to a single predicate.

### 2.8 What I could not verify from here

Stated plainly, because a security report that hides its blind spots is
marketing:

- **No production access.** Rate limiting, session revocation and CSP were read
  in source and reasoned about; they were not exercised against production.
- **Outbound network is restricted** in this environment, so the live site could
  not be fetched.
- **No penetration testing.** No authenticated fuzzing, no IDOR sweep across the
  99 routes, no attempt to bypass the authz gates.
- **The Google-signup-renders-desktop-mode report is unexplained.** The usual
  cause (missing viewport meta) was ruled out — it is present and correct on
  `/`, `/signup`, `/login` — and no layout is decided in JavaScript. Without a
  phone and a Google OAuth client the flow cannot be run.

An external penetration test is the correct next step before you take real
money at scale. This document is a code and process review, which is a
different thing.

---

## 3. Bugs

### 3.1 Fixed in this session (all measured before and after)

| Bug | Evidence |
|---|---|
| Homepage invisible until hydration — 73 elements shipped at `opacity: 0` | LCP 7756ms → 1804ms on a 6× throttled phone |
| "Sign out" unreachable on mobile, behind the fixed bottom bar | Sign out `844–894` vs bar top `855` → `772–822` |
| Navbar overflowed iPad portrait by 257px, landscape by 65px | 13 device widths × 4 pages, none scroll sideways |
| Hero clipped / stats strip below the fold on short laptops | medallion 512✂ → 428; strip `586/630` visible |
| Hero lede stranded "and builders." on its own line | line widths `371,369,361,89` → `266,311,313,300` |
| DMs could never reach a phone — no push opt-in on `/messages` | opt-in added; dispatcher was already correct |
| Members' check-ins invisible on mobile dashboard | column was `hidden … lg:table-cell` |

### 3.2 Open

| Bug | Severity | Note |
|---|---|---|
| **TBT ~3.1s** on a 6× throttled phone | 🟠 High | Page *appears* fast then blocks. React hydrating a 2595-node tree from a 411KB bundle. Needs below-fold client components deferred — a real refactor. |
| Google signup renders desktop mode until refresh | 🟡 Medium | Unexplained; see §2.8. Owner check: does the URL after the OAuth round-trip match the host you started on (apex vs `www`)? Chrome's "Request desktop site" is per-host and `next-auth` returns to `NEXTAUTH_URL`. |
| Two "admin" definitions | 🟡 Medium | §2.7 |
| `/community` is `force-dynamic` | 🟢 Low | Known Fast Origin Transfer lever, twice deliberately deferred |

---

## 4. Feedback — what this project does better than most

This is not padding. These are habits that are rare and worth protecting,
because the instinct when tightening process is to flatten everything into
uniformity and these would be the first casualties.

**1. The commit and PR messages explain *why*, including what was wrong.**
Several PRs in this repo document the author's own false starts — "the first
attempt changed nothing", "this test did not catch it". That is the single
highest-value documentation habit a team can have, and almost nobody does it.

**2. Tests encode invariants, not coverage.** `api-rate-limits.test.ts` asserts
that *every* mutating handler is rate limited. `markets-poll-alignment.test.ts`
asserts poll intervals match cache windows. These catch the bug class rather
than one instance of it.

**3. `CLAUDE.md` is a real continuity document.** The "learned the hard way"
section — pgbouncer, the silent migration failure, `Math.sin` cross-runtime
drift, hydration-mismatch rules — is institutional memory that would otherwise
live only in one person's head.

**4. Deliberate decisions are recorded as decisions.** The narrow
`prefers-reduced-motion` policy, ISR windows, the `|| true` on audit — each has
a written rationale. Disagreeing with one is easy; nobody has to *guess*.

**5. Cost is treated as an engineering constraint.** The `cost-check` skill and
route baseline exist because of a real Vercel usage scare. Most teams learn this
after the bill.

---

## 5. Suggestions, ordered by value per hour

### This week

1. **Branch protection on `main`** (§2.2) — 10 min.
2. **Sentry DSN + redeploy** (§2.3) — 30 min. Nothing else on this list matters
   if you cannot see failures.
3. **Restore CodeQL** (§2.5) — 15 min, free.
4. **`npm audit fix`** for the three high advisories, then re-run the suite — 1 hr.

### This month

5. **A `CODEOWNERS` file** naming you on `prisma/**`, `src/core/auth/**`,
   `.github/**`. Turns "ask me before touching auth" into a required review.
6. **Resolve Sentinel** (§2.6) — fix it or delete it.
7. **Collapse the two admin definitions** (§2.7).
8. **Prune branches** — 60 branches, ~22 `backup/*` and ~30 merged `claude/*`.
   Tag the ones worth keeping (`git tag backup/v1.1-profiles <sha>`) and delete
   the branches. Tags do not clutter branch pickers and cannot be pushed to by
   accident.
9. **Attack the TBT** — defer below-fold client components. Biggest remaining
   user-visible performance win.

### This quarter

10. **A staging environment.** Every change currently goes to a preview deploy
    that shares the **production `DATABASE_URL`**. That is documented, and it is
    a live foot-gun: a preview that writes is writing to production data.
11. **Nonce-based CSP** — removes `'unsafe-inline'` from `script-src`.
12. **An external penetration test** before scaling paid tiers.
13. **Structured uptime monitoring** — an external prober, not a self-hosted
    watchdog that can fail with the thing it is watching.

---

## 6. Teamwork and process

### 6.1 The current shape

Three accounts, two with write access, no branch protection, no `CODEOWNERS`,
no required reviews, **0 open issues** on a repo with an active issue tracker.
Work is coordinated through chat and markdown files.

For a two-person team this is survivable. It has already produced one event
worth naming: a solo-authored, solo-merged authentication + schema change
reaching production the same hour it was written.

### 6.2 What to change, and what not to

**Change: make the rules enforceable.** The merge-ownership rule is currently a
paragraph in `CLAUDE.md`. Branch protection + `CODEOWNERS` express the same
intent in a form that does not depend on everyone reading the file.

**Change: use the issue tracker.** Zero open issues does not mean zero known
problems — this document alone lists seven. Work that lives only in chat cannot
be prioritised, assigned or found later. Every 🔴/🟠 here should be an issue.

**Change: define who reviews what.** With two engineers, "someone reviews
everything" is unrealistic. "Auth, schema and CI changes need the owner's
approval; everything else needs any second pair of eyes" is realistic and
covers the paths where a mistake is expensive.

**Do not change: the writing culture.** The commit messages, the changelog
discipline, the recorded rationales. If adding process makes people terser,
you have traded something valuable for something procedural.

**Do not change: the preview-first habit.** Shipping behind preview deploys and
checking the live observable before merge is genuinely good practice.

### 6.3 A concrete definition of done

The project already has one — *typecheck + lint + test + build green* — and it
is enforced by CI. I would extend it, because two of the bugs fixed this session
would have passed every one of those checks:

```
Existing:  typecheck · lint · test · build
Add:       - the change was viewed at 390px AND 1280px if it touches UI
           - the PR states a live observable: what changes on the deployed
             site, how to check it, and what would falsify it
           - route table unchanged, or the change is explained
```

The middle one is the one that pays. "It compiles and the tests pass" would not
have caught a Sign out button hidden behind the bottom bar, or a hero that
renders at `opacity: 0`.

---

## 7. What "industry level" actually requires

An honest scorecard. This is where the project stands against what a funded
Series-A team would be expected to have.

| Area | State | Gap |
|---|---|---|
| Application security | 🟢 Strong | Layered, thoughtful, tested |
| Secure SDLC | 🔴 Weak | No branch protection, no required review, no SAST |
| Observability | 🔴 Absent | No error reporting at all |
| Testing | 🟡 Good, narrow | 520 tests, invariant-focused; no E2E, no load testing |
| CI/CD | 🟡 Adequate | Green CI, but not a gate; no staging |
| Dependency hygiene | 🟠 Behind | 3 high advisories, all fixable |
| Documentation | 🟢 Exceptional | Better than most funded startups |
| Incident response | 🔴 Absent | No alerting → no detection → no response |
| Access control | 🟠 Weak | Write access without guardrails |
| Data protection | 🟡 Reasonable | Email masking, PII-light admin views; no formal retention policy |

**The pattern:** what you *build* is strong. What you *operate* is thin. That is
the normal shape for a small team shipping fast, and it is fixable with a few
hours of configuration rather than months of engineering — items 1–4 in §5 close
most of the gap.

The one thing genuinely worth budget rather than time is the **staging
environment**. Preview deploys sharing the production database is the
architectural risk most likely to cause a bad day that no code review would have
prevented.

---

## 8. If I could only say one thing

Your codebase is written like a senior engineer's. Your repository is
configured like a weekend project's.

The single highest-value hour available to you is not in `src/` at all — it is
in **Settings → Branches** and a **Sentry DSN**. Do those two, and the standard
of the code finally gets protected by a standard of process that matches it.
