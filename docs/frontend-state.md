# XYZ Crypto — Frontend State (authoritative)

> The frontend is the **LOCKED, owner-approved baseline.** Build on top; never
> redesign existing sections. Design system: premium Web3, **black + gold**,
> glassmorphism, Geist/Geist-Mono, Lenis smooth scroll, mobile-first. Quality
> bar: Hyperliquid/Stripe/Linear/Vercel/Phantom. No em dashes in copy. See
> `project-state.md` guardrails + `design-system.md`.

## Pages (rendering strategy)
- `/` home — **ISR (revalidate 300)**; lazy charts; member count cached.
- `/research` — **ISR (120)**; server renders first 12, client search + Load more.
- `/research/[slug]` — **dynamic** (premium gating reads session); single indexed query.
- `/dashboard` — `force-dynamic`, ADMIN-gated (redirect on non-admin).
- `/login`, `/signup`, `/forgot-password` — 2-step OTP flows.

## Key components
| Component | Role |
|---|---|
| `Navbar` | Logged-in **account chip**: masked email (`ra***@gmail.com` via `maskEmail`) + Free/Premium pill + Dashboard (admin) + Sign out. Robust `handleSignOut`. |
| `PostEditor` | Create/edit: markdown toolbar, Write/Preview (`.prose-xyz`), cover URL **or** upload (click/drop, 5MB, type-checked), **Premium toggle**, Save-draft vs Publish. |
| `PostManager` | Dashboard content tab: search, category/status filter, Published/Draft + **Premium** badges, inline edit, publish-toggle, delete-confirm. |
| `PremiumLock` | Locked teaser for non-Premium users (excerpt + CTA). |
| `CommentSection` | Per-article comments: list + form (logged-in), admin delete, char counter. |
| `PostCard` | Feed card: cover, category + **Premium** badge, hover zoom. |
| `ReadingProgress` / `ShareRow` | Article progress bar + copy/X/Telegram share. |
| `OtpStep` / `ForgotPasswordForm` | Auth OTP entry + reset. |

## Account / privacy (Step 6)
Logged-in nav shows a masked email + membership pill + easy Sign out
(desktop chip + mobile menu). Full email never shown. `maskEmail()` in `lib/utils.ts`.

## Premium UX
Premium posts appear in the feed with a "Premium" badge + 🔒. Free users see
title/excerpt/cover + `PremiumLock` CTA; full body only for Premium/admin.

## Performance
ISR for home/list; lazy `PerpChart`; `next/image` sized + cover `priority`;
removed framer-motion from ResearchGrid; bounded/paginated queries.

## Known frontend issues / notes
- PostManager toggle/delete errors use `alert()` (functional; future: inline).
- Home First-Load JS ~234 kB (Sentry client SDK) — acceptable.

## Verification
`npx tsc --noEmit` · `npx vitest run` · `npm run build` exit 0. Manual: auth,
dashboard publish/edit/draft/preview/upload, premium lock+unlock, comments, mobile.

## Profiles + perf pass (v1.1, 2026-06-11) — addendum
- **Pages:** `/u/[username]` (public profile: banner, Avatar w/ initials fallback,
  badges, socials, stats, recent activity; ISR 60s) · `/settings` (tabbed
  Profile/Account/Security; dynamic, auth-gated).
- **Components:** `Avatar`, `AvatarUploader`, `SettingsClient`, `BrandIcons` +=
  GitHubIcon. Navbar: account chip → avatar + dropdown (Profile/Settings/
  Dashboard/Sign out; outside-click + Escape close).
- **Mobile perf:** backdrop blur reduced to 8px ≤768px; Lenis skipped on
  `pointer: coarse`; orbital particles 14 on phones (34 desktop).
- **PC perf:** hero parallax rAF-throttled; ticker pauses when tab hidden.
- Home First-Load JS unchanged (159 kB shared).
