# XYZ Crypto — Phase 0 Deep Audit + Critical Fixes
_Date: 2026-06-15 · Scope: chat/community, image upload, CMS/dashboard, DB/scalability, mobile — extending `docs/AUDIT-PRE-PHASE2.md` (already merged). This pass fixed the genuine Criticals only; everything else is documented for Phase 1/2. No rebuild, no architecture change, all changes backward-compatible._

## Executive Summary
The Phase-1 foundation is **stable and production-ready**. A deep audit of the
previously-skimmed systems surfaced mostly scale/UX hardening and a few real
input-validation gaps — **no show-stopping Criticals** remained after yesterday's
security pass. Four safe, backward-compatible fixes were applied (below); the rest
is triaged and scheduled.

| Score | Rating |
|------|--------|
| Project health | **9.0 / 10** |
| Production readiness | **9.2 / 10** |
| Risk | **Low** |

**Merge readiness for this pass: ready, but held for owner review** (per instruction: audit + criticals, then stop — not merged to `main`).

## Severity triage — agent flags vs. verified reality
The audit agents over-flagged several items. Verified assessment:
| Agent claim | Verdict |
|---|---|
| Chat cursor "SQL injection" | **False** — `isCuid()` + Prisma parameterization; results always filtered `status:visible`. Cosmetic pagination edge only. |
| Presence "spoofing" (CRITICAL) | **Overstated** — affects only a vanity online-count; no data/auth impact. Proper fix = server-signed presence (architecture add) → deferred. |
| Chat-delete trusts JWT role | **Low** — soft-delete, reversible; brief staleness window. Documented. |
| Reaction TOCTOU / typing flood | **Low** — negligible impact. Documented. |
| N+1 on chat authors | **False** — Prisma batches nested `select`. |
| Markdown XSS | **Already mitigated** — admin-only authoring + `safeHref` + React escaping. |
| Image-host suffix match = SSRF | **Not exploitable** — locked vendor domains (google/github/supabase/unsplash); tightening would break legit avatar subdomains (`lh3..lh6`, `avatars0..5`). Kept. |
| Admin role: page vs API | **Not a vuln** — `getAdminSession()` is the real boundary; same session role. |

---

## 1) Architecture Report
Next.js 14 app-router, server components + typed API routes following
`rateLimit → zod → auth → prisma → handleError`; Prisma/Supabase; next-auth JWT;
Supabase realtime (broadcast + presence) with polling fallback; Sentry across
runtimes. Clean separation in `src/lib/*`. **Strength, preserve as-is.** No
architecture change made or needed.

## 2) Production-Readiness Report
Pipeline green (typecheck, lint, **67** tests, build 31 routes). Graceful
degradation everywhere (no Upstash → no-op limits; no Resend → console; missing
table P2021/P2022 → quiet empty/503). Error boundaries + Sentry wired. Pending
ops (documented in HANDOFF, non-blocking): apply `5_post_views_pageview` +
`6_notifications` migrations; set `NEXTAUTH_SECRET`, verified `EMAIL_FROM`,
`SENTRY_AUTH_TOKEN` in prod.

## 3) Security Report — fixes applied + posture
**Fixed this pass:**
- **[High] Upload content-type spoofing** — `uploadImage` (`src/lib/storage.ts`)
  now magic-byte–sniffs the bytes (`sniffImageType`) and rejects anything that
  isn't a real JPEG/PNG/WebP/GIF/AVIF, regardless of the client `Content-Type`.
  Covers both `api/profile/avatar` (any user) and `api/upload` (admin). No new dep.
- **[Med] Admin upload rate-limit** — `api/upload` now keys on the admin `user.id`
  instead of client IP (can't be dodged by IP rotation; no shared-NAT throttling).

**Verified safe / preserved:** auth gates + zod on all mutating routes; OTP
fail-closed (yesterday); per-user limits on like/comment/chat; markdown escaping;
secrets server-only; full security-header set.
**Documented, deferred:** server-signed presence; chat-delete DB role re-check;
typing-event server validation. (All Low real-world risk.)

## 4) Performance Report
Strong baseline: ISR on list pages, lazy `OrbitalLazy`/`PerpChartLazy`/`ChatClient`,
visibility-gated polling, GPU-transform animations, `next/image` with `sizes`/
`priority`. No regressions introduced. Phase-1 opportunities: image lazy/priority
sweep, bundle review, chat client `unsubscribe`/close hygiene.

## 5) Scalability Report — fix applied + watch-list
**Fixed:** **[High] unbounded notification fan-out** — `notifyNewPost`
(`src/lib/notifications.ts`) now loads recipients with a cap (50k) and inserts in
**500-row batches** (bounded memory/transaction size). Identical behavior at
current scale.
**Watch (Phase 1):** `PageView` growth → add retention + `@@index([path, createdAt])`;
dashboard premium-member list → paginate + `@@index([membership, createdAt])`;
optional `Notification @@index([userId, createdAt])`. None urgent at present scale.

## 6) Risk Report
- **Low residual risk.** No data-loss, auth-bypass, or crash paths open.
- Biggest scale risks (PageView growth, dashboard premium query) are bounded and
  scheduled for Phase 1; fan-out is now batched.
- Realtime is best-effort with polling fallback → no hard dependency.

## 7) Rollback Plan
- Recovery branches on origin: **`backup/pre-audit-fixes`** (this pass's pre-change
  HEAD `ca969f7`), plus `phase1-stable` / `pre-phase2-backup`.
- Roll back: `git checkout -b restore backup/pre-audit-fixes` → deploy that branch
  (Vercel), or hard-reset the working branch to it. (Tags blocked by env git proxy;
  branches are the rollback path.)
- This pass is **not merged to `main`** — production is unaffected until you approve.

---

## Triaged findings table
| # | Severity | Area | Finding (file) | Status |
|---|----------|------|----------------|--------|
| 1 | High | Security | Upload trusts client MIME (`storage.ts`, avatar/upload routes) | ✅ Fixed (magic-byte sniff) |
| 2 | High | Scale | Unbounded notification fan-out (`notifications.ts`) | ✅ Fixed (cap + 500-batch) |
| 3 | Med | Security | Admin upload limit keyed by IP (`api/upload`) | ✅ Fixed (per-user) |
| 4 | Med | Mobile | Notification dropdown clips off-screen (`NavActivity.tsx`) | ✅ Fixed (`max-w`) |
| 5 | Med | Scale | PageView growth + count() scan (`schema.prisma`) | ⏳ Phase 1 (retention + index) |
| 6 | Med | Perf | Dashboard premium list unpaginated (`dashboard/page.tsx`) | ⏳ Phase 1 |
| 7 | Low | Security | Chat-delete trusts JWT role (`chat/.../[id]`) | 📝 Documented |
| 8 | Low | Security | Presence userId client-set (vanity count) | 📝 Documented (needs server-signed presence) |
| 9 | Low | UX/Mobile | Dashboard table horizontal scroll < 680px | ⏳ Phase 2 (mobile) |
| 10 | Low | Robustness | Chat realtime client not explicitly closed | ⏳ Phase 1 (hygiene) |
| — | — | — | Markdown XSS / chat XSS / image-host / cursor | ✅ Already safe (no action) |

## Strengths to preserve
Modular libs + consistent API contract; auth gates + zod + rate-limits on all
writes; graceful degradation; Prisma indexes for hot queries; Sentry + error
boundaries; lazy-loading + reduced-motion; idempotent migrations; the realtime +
polling-fallback design.

## Phase 1 / Phase 2 roadmap (not built this pass)
- **Phase 1 (perf/scale/stability):** PageView retention + index; dashboard
  pagination + membership index; notification index; chat client unsubscribe/close;
  image/bundle sweep.
- **Phase 2 (premium UI/UX, brand kept, no rebuild):** unified design system
  (typography, spacing, tokens, buttons, motion) across Homepage+Navbar,
  Research/Articles+Profile, Dashboard+Community; light + dark mode; Anime.js
  micro-interactions; Iconsax icons; React-Three-Fiber orbital hero; mobile-first,
  performance-first — shipped sub-area by sub-area with verification.
