# Performance Notes — XYZ Crypto

**Date:** 2026-06-27. Goal: faster Community (chat), Research/content, and Dashboard loads.

## Applied in this pass ✅
- **Comments** lazy-load threshold tightened (`rootMargin 400px → 150px`,
  `CommentSection.tsx`) — fewer comment fetches on articles users don't scroll.
- **`/api/users/staff`** now `Cache-Control: private, max-age=30` — repeated dashboard
  opens hit the DB far less.
- (Dashboard stats already cache `private, max-age=10`; likes/comments/dashboard refresh
  are realtime broadcast-driven, not polling — see M3.)

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
| 4 | Research `[slug]`: avoid the **second membership query** on premium views — trust the JWT membership, re-check only after a `membership_changed` event | `research/[slug]/page.tsx` | S | −50–100 ms/premium view |
| 5 | Chat initial payload: fetch **25** messages instead of 50 (realtime fills the rest) | `community/page.tsx` | S | −100 ms first paint |
| 6 | Defer `RealtimeSession` Supabase import until first interaction | `RealtimeSession.tsx` | M | −30–50 ms/navigation |

> Note: the Community page can't be ISR-cached (it passes the per-user session `me` to
> ChatClient), so its speed comes from a smaller initial query + the singleton client +
> the chat overhaul (#7), not page caching.
