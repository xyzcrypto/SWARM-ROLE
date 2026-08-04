# Performance Notes — XYZ Crypto

> ## ⚠️ DATED SNAPSHOT — verify before acting (banner added 2026-08-04)
>
> This is a record of what was applied on **2026-06-27**, not a description of the
> system today. Some of it has since changed, and at least one number in it is now
> wrong: it says `/research/[slug]` is ISR at **`revalidate=60`**; it is **300**
> (`src/app/research/[slug]/page.tsx:31`).
>
> It is also **not in `docs/SUMMARY.md`**, so nothing links here — treat anything you
> find in it as a lead to verify, never as evidence.
>
> **Current, maintained sources instead:**
> - **Every caching number, poll interval, route baseline and cost rule** → the
>   `cost-check` skill. It owns those and is kept current.
> - **Per-route client JS** → `npm run build && node scripts/bundle-report.mjs`
> - **What changed and why** → `docs/changelog.md`, `docs/HANDOFF.md §7`
>
> **One thing here is globally obsolete:** advice written before **#210** assumes
> functions ran in a US region while Supabase sat in Mumbai, ~250ms per query. They
> are now co-located in `bom1` (`vercel.json`). Anything ranked around that gap needs
> re-weighing — see the banner in `docs/AUDIT-2026-08-01-latency.md` for a worked
> example of which findings survived that change and which did not.

**Date:** 2026-06-27. Goal: faster Community (chat), Research/content, and Dashboard loads.

## Applied in this pass ✅
- **Comments** lazy-load threshold tightened (`rootMargin 400px → 150px`,
  `CommentSection.tsx`) — fewer comment fetches on articles users don't scroll.
- **`/api/users/staff`** now `Cache-Control: private, max-age=30` — repeated dashboard
  opens hit the DB far less.
- (Dashboard stats already cache `private, max-age=10`; likes/comments/dashboard refresh
  are realtime broadcast-driven, not polling — see M3.)

## Applied 2026-07-16 (Fast Origin Transfer reduction)
- **Research `[slug]` is now ISR** (`revalidate=60`) for free posts — `getServerSession()` is only called
  when `post.premium` is true, so free-post renders never touch a Dynamic API and are CDN-cacheable.
  Premium posts stay fully dynamic (never cached). This also folds in roadmap item #4 below: the second
  membership DB re-check is gone, trusting the JWT + `RealtimeSession`'s `membership_changed` push instead.
  View counting moved off the render path to a client beacon (`TrackPostView` → `POST /api/posts/[id]/view`).
- **`/api/journal/share/activity/[userId]`** now sends `Cache-Control: public, s-maxage=30,
  stale-while-revalidate=60` (was uncached, polled every 60s from the public `/u/[username]` page).

## Already good
- Research list is **ISR** (`revalidate=120`) + CDN cache headers.
- Comments + 3D hero + anime.js + Supabase JS are **lazy/dynamic** (not in the 159 kB shared bundle).
- Markdown renderer is **zero-dependency**; premium gating is server-side (no leaks).
- API cache headers on research / whatsnew / ticker / stats.

## Prioritized roadmap (next perf PR)
| # | Win | File | Effort | Benefit |
|---|-----|------|--------|---------|
| 1 | Drop `content` from the research **list** query (use `select`, not `include`) | `research/page.tsx:24` | S (typing) | −~60 kB RSC payload |
| 2 | **Supabase client singleton** (`getSupabaseClient()` reused by Chat/Dashboard/RealtimeSession) instead of `createClient` per component | new `lib/supabase-client.ts` | M | −150–200 ms per realtime mount |
| 3 | Dashboard Overview: collapse the **9 parallel aggregates** + cache `getDashboardStats()` (refresh on broadcast, not every render) | `dashboard/page.tsx`, `lib/dashboard-stats.ts` | M | −400–800 ms admin load |
| ~~4~~ | ~~Research `[slug]`: avoid the second membership query~~ — done 2026-07-16, see above | | | |
| 5 | Chat initial payload: fetch **25** messages instead of 50 (realtime fills the rest) | `community/page.tsx` | S | −100 ms first paint |
| 6 | Defer `RealtimeSession` Supabase import until first interaction | `RealtimeSession.tsx` | M | −30–50 ms/navigation |

> Note: the Community page can't be ISR-cached (it passes the per-user session `me` to
> ChatClient), so its speed comes from a smaller initial query + the singleton client +
> the chat overhaul (#7), not page caching.
