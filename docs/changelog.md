# XYZ Crypto — Changelog

Newest first. **Update this after every design change** with: date, files
changed, components changed, design improvements, performance improvements.

---

## 2026-06-26 — Milestone 2: admin permissions (#10) + What's New CMS (#6)
Recovery point: branch `backup/pre-m2`. Scalable, production-ready. No re-architecture.
- **Granular permissions (#10):** new `src/lib/permissions.ts` capability **catalog**
  (`dashboard:view`, `post:publish`/`post:manage`, `users:manage`/`users:roles`,
  `premium:manage`, `whatsnew:manage`) — add a new capability in one line. `User.permissions
  String[]`; **Super Admin** (ADMIN_EMAILS / legacy role=ADMIN) implicitly holds all and is
  immutable. Session carries `permissions` + `isSuperAdmin` (`auth.ts`, guarded for
  pre-migration). `requirePermission()` gate in `src/lib/api.ts`; gates moved to capabilities
  (dashboard → `dashboard:view`, research publish → `post:publish`, membership → `premium:manage`).
  New `PATCH/GET /api/users/[id]/access` with **no-escalation** guards + `AdminAudit` trail +
  live `access_changed` broadcast (session refreshes via `RealtimeSession`). Dashboard
  **"Access"** tab: search members, grant/revoke capabilities; tabs now capability-gated. +7 tests.
- **What's New CMS (#6):** new `WhatsNewEntry` model (tags New/Improved/Fixed/Announcement/
  Security/Roadmap). `GET /api/whatsnew` (public, `?tag=&q=` filter/search, cached, **static
  fallback** when empty/unmigrated) + `POST`/`PATCH`/`DELETE` (gated `whatsnew:manage`).
  **Auto-entry** created on research publish (linked to the post); manual entries via the new
  dashboard **"What's New"** tab. Homepage `WhatsNew` is now DB-driven with **tabs** (filter by
  tag) + **realtime** refresh (`whatsnew_updated` broadcast) + `revalidatePath`. Seeded
  idempotently from the old static list. +2 tests.
- typecheck + lint(0) + test(82) + build green; shared First-Load JS 159 kB.
- ⚙️ Ops: apply the M2 migration (User.permissions, WhatsNewEntry, AdminAudit) — see HANDOFF §4.

## 2026-06-26 — Milestone 1: security hardening + critical bugs + mobile (#4,#5,#8,#2)
Recovery point: branch `backup/pre-m1`. First of the 4-milestone roadmap program.
- **#4 Premium CTA bug:** `/premium` "Create account" CTAs are now wrapped in
  `GuestOnly`; signed-in members get a member CTA instead (new `SignedIn.tsx`, the
  inverse of `GuestOnly`). Logged-in users no longer see "create account".
- **#5 Password + brute-force:** shared strong `passwordSchema` (min 8 + upper/lower/
  digit) enforced server-side at signup, reset and change (`src/lib/profile.ts`,
  signup/reset routes; `PasswordField` minLength→8). **DB-backed account lockout**
  (5 fails → 15 min) in `src/lib/auth.ts authorize()` — works even without Upstash;
  login path kept independent of the new columns so it degrades gracefully pre-migration.
  New User columns `failedLoginCount`, `lockedUntil`. +6 unit tests.
- **#8 Auto @handle:** handles already auto-assign on signup/OAuth + on-the-fly; added a
  standalone idempotent backfill (`prisma/backfill-usernames.ts`, `npm run
  backfill:usernames`) for any legacy NULL handles. Navbar already resolves `/u/<handle>`.
- **#2 Mobile/responsive:** dashboard members table no longer forces horizontal scroll
  on phones (date columns hidden < md, relaxed min-width); contact form inputs → 44px
  tap target (`py-3`).
- typecheck + lint(0) + test(73) + build green; shared First-Load JS 159 kB.
- ⚙️ Ops: apply the migration adding `User.failedLoginCount`/`lockedUntil`
  (lockout activates once applied); optionally run `npm run backfill:usernames`.

## 2026-06-26 — Desktop orbital: fix static animation + light rendering; park 3D
Reported on desktop (light preview): the orbital centerpiece was **static** and the
node pills rendered **dark on the light background**.
- **Root cause:** the WebGL gate fell back to the CSS orbital on the device, whose
  rotation was gated by `prefers-reduced-motion` (→ static); the node pills used
  `bg-ink-900/85`, a level not yet remapped for light (→ dark pills).
- **Fix:** `OrbitalEcosystem.tsx` now always animates the signature rings / aurora /
  logo glow / node float (deliberate always-on motion for the branded centerpiece);
  ring opacities bumped for visibility. `globals.css` remaps `bg-ink-900/85` → light
  surface so pills are light-on-light.
- **Consolidated to the CSS orbital on all devices** (`OrbitalLazy.tsx`): dropped the
  capability-gated R3F path. The branded, labeled CSS orbital is lighter, reliable,
  theme-correct and animates everywhere; **three.js is no longer fetched on the
  homepage** (bundle win). `OrbitalScene3D.tsx` parked in-repo for a future art pass.
- **Verified (Playwright + Chromium):** rings confirmed rotating in light, dark, and
  under emulated reduced-motion; pills render light-on-light (light) and dark (dark);
  dark unchanged. Shared First-Load JS 159 kB.

## 2026-06-26 — Phase 2 completion (B): light-theme migration (foundation + high-traffic)
Recovery point: branch `backup/pre-light-theme`. **Dark mode byte-for-byte unchanged**
— every rule is scoped to `html:not(.dark)`. CSS-only; no component classNames touched
(so zero dark-mode regression risk, hierarchy preserved).
- **B1 additions** (on top of the B0 foundation below): white `ring-*` outlines,
  gold/mint `text-*-400/500`, status text (`red`/`amber`/`sky`/`violet`/`blue`/
  `emerald` 200–400) lifted to readable shades, remaining dark chips (`bg-ink-800/600`),
  the `.eyebrow`/`.eyebrow-glass` pills, and the scrollbar track — all themed for light.
- **Visual verification (Playwright + Chromium, this repo):** rendered light mode at
  1440px on homepage, login, and contact and confirmed parity with dark — themed
  navbar, eyebrow pills, darkened gold-gradient headings, `.surface` cards, form
  inputs/labels, mint/gold buttons, and status/icon accents all read correctly. Dark
  re-rendered identical. (Covers the shared Field/card/prose/overlay patterns used by
  Settings, Dashboard, articles, and chat.)
- Shared First-Load JS unchanged (159 kB).

### B0 foundation
- `src/app/globals.css`: a consolidated light foundation that remaps the design's
  actual utilities under `html:not(.dark)`:
  - **Text ramp** (`text-zinc-50…700`, `text-white`) → a dark-on-light hierarchy.
  - **Brand accent text** (`text-gold-100/200/300`, `text-mint-200/300`, gradients,
    `text-shine`) → readable shades on white.
  - **Hairlines/tints** (`border-line`, `border-white/5,10`, `bg-white/…`) → dark tints.
  - **Inputs & overlays** (`bg-ink-700/60`, `bg-ink-9xx/8xx` dropdowns, `bg-ink-950`)
    → light surfaces.
  - **Primitives**: `.glass`/`.surface`/`.surface-hover`, `.btn-secondary`/`.btn-ghost`,
    `.prose-xyz` (headings/body/code/pre/blockquote/tables/links) → light treatments.
  - **Ambient FX** (`.mesh`/`.aurora`/`.particle`) hidden in light; `.grid-bg` softened.
- Shared First-Load JS unchanged (159 kB).
- ⏳ Next (B1, after preview review): targeted high-traffic className cleanups for the
  few spots the CSS remap can't reach (rings, inline gradient overlays, hero specifics).

## 2026-06-15 — Phase 2 completion (A): section polish + anime/iconsax rollout
Recovery point: branch `backup/pre-polish-rollout`. Styling-only, brand-consistent,
no behavior/feature change. First small checkpoint of the "complete the sweep" work.
- **Homepage sections** brought up to the polished standard (`Social`/`WhatsNew`):
  - `About.tsx`: credibility box → `surface surface-hover lift` + `glow-orb`; Learn/
    Trade/Earn get a mint left-accent; credential icons scale on hover.
  - `Products.tsx`: gold hover-glow on the Perp spotlight; icon `group-hover:scale`
    across all product cards.
  - `Ecosystem.tsx`: tone-aware hover glow (gold/mint) per card, logo scale, livelier
    Telegram CTA.
  - `Footer.tsx`: gold-dot column headers, social-icon `scale-110`, link hover shift,
    centered disclaimer; `FooterNewsletter.tsx` → contained premium glass card + eyebrow.
- **MagneticButton rollout** (desktop/fine-pointer only — auto-disabled on touch &
  reduced-motion; anime.js stays lazy): Navbar "Get Started", ChatClient "Log in to
  chat", PremiumLock CTAs. (Hero already covered.) Mobile-only CTAs intentionally
  skipped (magnetic no-ops there).
- **Iconsax accents** (standalone premium spots only — not mixed into uniform lucide
  icon arrays): `PremiumLock` `Lock`→iconsax `Lock`, `Sparkles`→`MagicStar`.
- Shared First-Load JS unchanged (159 kB); homepage First-Load unchanged (244 kB).

## 2026-06-15 — Phase 2 (increment 8): Admin Dashboard premium polish
Recovery point: branch `backup/pre-research-polish` (chained). Styling only; no logic change.
- **DashboardClient**: header eyebrow → premium glass pill; active tab gold glow +
  stronger divider (matches Settings/Community); stat cards get `lift` hover.
- Shared First-Load JS unchanged (159 kB). Closes the user-facing + admin premium sweep.

## 2026-06-15 — Phase 2 (increment 7): Community/Chat premium polish
Recovery point: branch `backup/pre-research-polish` (chained). **Styling only** —
no realtime/state/handler changes; chat logic untouched.
- **ChatClient**: own messages get a subtle mint tint (clearer own-vs-others),
  richer empty state (emoji + subcopy), typing dots brightened to mint.
- **Community page**: header eyebrow upgraded to the premium glass pill.
- Shared First-Load JS unchanged (159 kB).

## 2026-06-15 — Phase 2 (increment 6): Profile + Settings premium polish
Recovery point: branch `backup/pre-research-polish` (chained). No behavior/data change.
- **Public profile** (`u/[username]/page.tsx`): banner depth (gradient + hairline),
  stronger avatar ring + gold glow, social/location rendered as premium pills, wider
  stat spacing, hover on activity items, and a richer empty state (icon + subcopy).
- **Settings** (`SettingsClient.tsx`): active tab gets a subtle mint glow + stronger
  divider; input focus ring bumped (gold/20 → /30). Forms/logic unchanged.
- Shared First-Load JS unchanged (159 kB).

## 2026-06-15 — Phase 2 (increment 5): Research/Articles reading-experience polish
Recovery point: branch `backup/pre-research-polish`. No behavior/feature change; brand kept.
- **Reading typography** (`globals.css` `.prose-xyz`): added styling for previously
  unstyled elements — fenced **code blocks** (`pre` + `pre code` reset), **ordered
  lists**, `h4`, **images** (rounded + ring), **tables**, and a gold **`hr`** divider;
  refined list/line rhythm. Article column stays `max-w-3xl`.
- **Premium gate** (`PremiumLock.tsx`): premium visual upgrade — soft gold glow,
  blurred "hidden content" teaser lines, gold-shine lock badge, and a 3-perk value
  list. Gating logic + buttons unchanged (content still never sent to non-Premium).
- Shared First-Load JS unchanged (159 kB).

## 2026-06-15 — Phase 2 (increment 4): Anime.js micro-interactions + Iconsax accents
Recovery point: branch `backup/pre-fx`. Hero-scoped; brand palette; reduced-motion safe.
- **Iconsax accents** (`Hero.tsx`): eyebrow `Sparkles`→`MagicStar` (gold), trust-line
  `ShieldCheck`→`ShieldTick` (mint). Homepage First-Load JS +2 kB (244 kB); shared 159 kB.
- **Anime.js magnetic CTA** — new `MagneticButton.tsx`: primary hero CTAs ease toward
  the cursor and spring back (elastic) on leave. Disabled for reduced-motion / touch;
  anime.js **lazy** (only fetched on first hover — not in the initial bundle).
- No layout/section changes; backward-compatible.

## 2026-06-15 — Phase 2 (increment 3): Homepage + Navbar premium pass
Recovery point: branch `backup/pre-homepage-polish`. Brand kept; no new deps;
shared First-Load JS unchanged (159 kB).
- **Navbar** (`Navbar.tsx`): active-route indicator via `usePathname` (desktop
  underline persists + `text-zinc-50`; mobile gets `bg-white/5 text-gold-200`;
  `aria-current`); subtle gold ring on the scrolled glass bar.
- **Hero** (`Hero.tsx`): interactive hover on the live-stat cards. Medallion,
  parallax, badges, ticker, reduced-motion handling all unchanged.
- Anime.js micro-interactions + Iconsax accents remain a separate upcoming pass.

## 2026-06-15 — Phase 2 (increment 2): R3F orbital hero (lazy + CSS fallback)
Recovery point: branch `backup/pre-hero`. Stability/perf-first; brand palette only.
- New `OrbitalScene3D.tsx` — React-Three-Fiber premium orbital (gold core +
  mint/gold orbiting nodes + sparkles, auto-rotate + pointer parallax). Perf-budgeted:
  `dpr={[1,1.5]}`, low-poly, paused when offscreen/tab-hidden, no heavy postprocessing.
- `OrbitalLazy.tsx` — capability gate: renders the 3D scene only on capable desktop
  (WebGL + pointer:fine + ≥lg + not reduced-motion + ≥4 cores/4GB); otherwise the
  existing CSS `OrbitalEcosystem` (fallback unchanged). three.js is a **separate
  async chunk** (~672 KB) — only downloaded when the 3D scene mounts; **shared
  First-Load JS unchanged (159 kB)**, mobile/low-power never fetch it.
- Deps (pinned for React 18): `three@0.169` · `@react-three/fiber@8` ·
  `@react-three/drei@9` (+ `@types/three`). Noted in `docs/DESIGN-SYSTEM.md`.
- Hero/navbar premium polish kept minimal this pass (stability-first); deeper
  per-area passes follow.

## 2026-06-15 — Phase 2 (foundation): design system + light/dark theming
Recovery point: branch `backup/pre-phase2`. Brand identity preserved; **dark mode
pixel-identical** to before (zero regression); backward-compatible.
- **Theming:** Tailwind `darkMode: "class"`; semantic CSS-var tokens in `globals.css`
  (`:root` light / `.dark` dark = current values); `body` wired to tokens; no-FOUC
  inline script + default `dark` class in `layout.tsx`; new `ThemeToggle` in the navbar
  (desktop + mobile). Dark stays default for first-time visitors.
- **Design tokens:** semantic Tailwind aliases (`base`, `surface`, `surface-2`,
  `content`, `content-muted`, `hairline`), motion tokens (`ease-premium`,
  `duration-250/400`); documented in new `docs/DESIGN-SYSTEM.md`.
- **Libraries:** installed `animejs` (v4) + `iconsax-react` (additive); lazy
  `src/lib/anime.ts` helper. (R3F deferred to the hero increment.)
- No UI redesign in this pass — foundation only. Per-area premium polish + R3F hero
  are the next increments.

## 2026-06-15 — Phase 1: performance & stability
Recovery point: branch `backup/pre-phase1` (@ d5e9b63). All backward-compatible,
no UI/architecture change. First-Load JS unchanged (159 kB shared).
- **DB indexes** (`prisma/schema.prisma` + idempotent migration
  `7_phase1_indexes/`): `Notification[userId,createdAt]`, `User[membership,createdAt]`,
  `PageView[path,createdAt]`. Additive; app already tolerant if unapplied.
- **PageView retention** (`api/track`): opportunistic (~1.5%) fire-and-forget prune
  of rows older than 90 days → table stays bounded without cron/infra.
- **Dashboard premium list** (`dashboard/page.tsx`): bounded with `take: 100`
  (newest-first) to avoid an unbounded scan at scale.
- **Chat realtime hygiene** (`ChatClient.tsx`): `channel.unsubscribe()` before
  `removeChannel` on cleanup → no subscription buildup on repeated mounts.
- Image/bundle review: `next/image` lazy defaults already in place; only an
  admin-only preview `<img>` remains (non-public). No risky refactors.

## 2026-06-15 — Phase 0 deep audit + critical fixes (see docs/AUDIT-PHASE0.md)
Recovery point: branch `backup/pre-audit-fixes` (@ ca969f7) pushed to origin.
**Fixes (safe, backward-compatible):**
- **Upload content-type spoofing** — `src/lib/storage.ts` now magic-byte–sniffs
  uploads (`sniffImageType`) and rejects non-images regardless of client MIME;
  applies to `api/profile/avatar` (any user) + `api/upload` (admin). +unit tests (67 total).
- **Unbounded notification fan-out** — `notifyNewPost` (`src/lib/notifications.ts`)
  now caps recipients (50k) and inserts in 500-row batches.
- **Admin upload rate-limit** keyed per-user (`api/upload`) instead of IP.
- **Mobile** — notification dropdown `max-w-[calc(100vw-1rem)]` so it doesn't clip.
Deep audit report (chat/upload/CMS/scale/mobile) added. Not merged to main —
held for owner review. No architecture/UI/feature changes.

## 2026-06-14 — Pre-Phase-2 hardening, audit & recovery point (see docs/AUDIT-PRE-PHASE2.md)
**Recovery point:** backup branches `phase1-stable` + `pre-phase2-backup` pushed
to origin (tag `phase1-production` local; tag push blocked by env git proxy).
**Security:** like/comment routes rate-limit per `user.id` (was IP); `api/chart`
only interpolates an allowlisted coin key (SSRF fix); `lib/otp.ts` fails closed in
prod without `NEXTAUTH_SECRET`; `auth/password/start` no longer leaks account
existence on email-send failure; `notifications/read` ids constrained to CUID.
**Observability:** `app/error.tsx` now reports to Sentry.
**SEO:** homepage `metadata` + canonical; `WebSite` JSON-LD `SearchAction`;
canonicals on premium/contact/community/u/login/signup; `app/manifest.ts` (PWA);
sitemap adds premium/community/contact.
**Frontend:** ProofStrip `<img>` width/height + lazy/async (CLS); Hero parallax
skipped under reduced-motion.
**Quality:** removed dead `MembersShowcase.tsx`; added `clientIp` unit tests
(64 tests green). No architecture/UI/feature changes. Verdict: READY FOR MERGE.

## 2026-06-14 — Demo 3: branded loader, live emoji, orbital fix, realtime data
**Branded route loader**
- New `BrandLoader` (XYZ logo + orbiting/pulsing rings on mesh); `RouteSkeleton`
  now renders it, so every suspending navigation shows a branded transition.

**Emoji (real + actively animated)**
- Stronger keyframes in `globals.css`: `emoji-launch` (fly/lift loop),
  `emoji-wobble` (hourglass flip), new `emoji-twinkle` + `emoji-spin`;
  `AnimatedEmoji` gains `twinkle`/`spin` variants.
- Premium: heading rocket 🚀 flies, "Coming soon" ⏳ flips, "Most popular" now an
  animated ⭐ (twinkle) instead of the lucide Sparkles.
- Contact: real animated emoji (👋 ✉️ 💬 ⏱️) on the header badge + info cards,
  and the community social icons are now **brand-coloured** (red/white/sky/blue,
  reusing the `Social.tsx` map) instead of monochrome.

**Orbital desktop fix** (`OrbitalEcosystem.tsx`)
- Rings/aurora/logo-glow now animate on mount (gated only by
  prefers-reduced-motion) instead of waiting for an in-view `active` flag, and
  rotation speeds sped up (18/24/14s, aurora 16s) so it visibly runs on desktop.
  Particle field + parallax stay in-view/perf-gated.

**Real-time data for end users**
- New `useLivePresence` hook (observes the `site-visitors` presence channel),
  `GET /api/live/stats` (visits today/total + members), and `LiveStats` strip
  ("N online now · visits today · total · members") in the Footer + homepage.
- Live bell: `CH_NOTIFY` broadcast "ping" from `lib/notifications.ts` on every
  notification; `NavActivity` subscribes (+ community `new_message`) to refetch
  instantly, poll relaxed to 60s fallback. All degrade gracefully without
  Supabase.

## 2026-06-14 — Demo 2: UI/UX polish, in-app notifications, profile fix, speed
**Profile / Settings**
- Fixed "Profile opens Settings": every account now gets an auto-assigned unique
  handle on signup (`lib/username.ts`, wired in `auth.ts` credentials + Google
  `createUser`); new `/profile` route resolves/mints a handle and redirects to
  `/u/<handle>`; navbar Profile falls back to `/profile` (never Settings).
  `prisma/seed.ts` backfills handles for existing users (idempotent).
- Research post byline + (existing) chat/comment authors link to `/u/<handle>`.

**In-app notifications (new)**
- New `Notification` model + idempotent migration `6_notifications/`.
- `lib/notifications.ts` (new-post fan-out + new-comment to author, best-effort);
  triggers wired into `api/research` (publish) and `api/posts/[id]/comments`.
- `GET /api/notifications` (+ unread count) and `POST /api/notifications/read`,
  new `notifications` rate-limit bucket; both degrade gracefully pre-migration.
- `NavActivity`: navbar bell (gold unread count + animated dropdown) + community
  chat icon (mint unread dot vs per-device last-seen). Email left dormant via the
  existing `sendEmail` console fallback until a verified Resend domain is set.
- Homepage **"What's New"** section (`lib/whatsnew.ts` + `WhatsNew.tsx`) replacing
  the removed Members showcase.

**UI / animation polish**
- `ActionLink` + `.btn-press` (tap-scale + click/redirect sheen) on all primary
  CTAs (Hero, Navbar, Premium, StickyCta); reduced-motion aware.
- `AnimatedEmoji` (rocket/hourglass) — Premium "Coming Soon" + "Get started".
- Global page-transition `app/template.tsx` (fade/rise, reduced-motion aware).
- Navbar signed-in widget: avatar gold-ring pulse + animated account dropdown.
- Premium hero restacked to "Premium Plans" / "Coming Soon" (two lines).
- About: `lg:items-start` so "Who we are" / "Since 2019" align with the pillars.
- Orbital: reliable desktop activation (activate-if-near-viewport on mount).
- Hero CTAs centered below `lg` (mobile-desktop), left-aligned at `lg`.

**Performance**
- `loading.tsx` skeletons (`RouteSkeleton`) for `/research/[slug]`, `/community`,
  `/settings`, `/u/[username]`, `/dashboard` → instant paint on navigation.

## 2026-06-14 — Production hardening: audit fixes, perf, profile-photo (see docs/AUDIT-2026-06-14.md)
**Resilience/DB**
- Added real migration `prisma/migrations/5_post_views_pageview/` (idempotent).
- `getPost` (`research/[slug]/page.tsx`) + dashboard posts query now retry without
  `views` on Prisma P2022 → missing migration no longer 404s posts / 500s dashboard.

**Bugs/security**
- New per-user `profile` rate-limit bucket; `api/profile/avatar` + `api/profile`
  PATCH/DELETE switched from `admin`(IP) → `profile`(user id).
- `auth/password/start`: returns 502 when email delivery fails (enumeration-safe).
- `auth.ts` signup: recover from P2002 race (re-read winning row).
- `research/[slug]`: premium gating re-checks live role/membership from DB.
- Research `content` capped at 100k chars (`api/research` + `[id]`).

**Profile photo (both approaches)**
- `AvatarUploader`: added validated **"Use a link"** URL fallback (works without
  Supabase Storage); saves via existing `PATCH /api/profile`.
- `profile.ts`: new optional `image` field + `isAllowedImageHost()` (host allowlist
  synced with next/image `remotePatterns`); +unit tests.
- Setup/ops steps added to `HANDOFF.md` (Storage bucket + env, migration).

**Performance (no design change)**
- `PerpChart`: poll skips hidden tabs + refresh on focus.
- `MarketTicker`: `decoding="async"` on coin logos.
- Tuned `next/image` `sizes`: `PostCard`, article cover, Hero logo.

DoD: typecheck + lint + test (60) + build all green; shared First-Load JS 159 kB (unchanged).

## 2026-06-12 — Mobile responsiveness pass (Phase 3/3)
- New `xs` (400px) breakpoint to distinguish small vs large phones.
- Hero medallion + Orbital ecosystem: smaller base `max-w` on tiny phones
  (15/16.5rem) scaling up at `xs`/`sm` → no crowding/overflow at 320–360px.
- MarketTicker cell padding `px-5 → px-3.5 sm:px-5` (kills horizontal-scroll
  risk on narrow phones).
- Chat hover action bar (react/reply/copy/delete) now **always visible on touch**
  (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`) — was hover-only and
  unreachable on mobile.

## 2026-06-12 — Polish: interactive upload, green dashboard, animations, speed (Phase 2/3)
- **Interactive upload:** real progress bar (XHR `upload.onprogress`) + animated
  drag-drop highlight on the post cover uploader and the avatar uploader
  (shared `src/lib/upload.ts`).
- **Green profile dashboard** (`/settings`): mint-accented identity card (avatar,
  badge, member-since, view-profile link), mint active tabs + primary actions,
  animated tab transitions (framer-motion).
- **Speed:** homepage orbital lazy-loaded (`next/dynamic`, ssr:false, same-size
  placeholder) → homepage page JS 11.4 → 10.1 kB; shared JS unchanged (159 kB).
- **Colors:** primary actions standardized to mint, premium/brand stays gold.

## 2026-06-12 — Real-time admin: live visitors, analytics, post views, instant membership (Phase 1/3)
- **Real-time membership:** admin downgrade/upgrade now pushes to the affected
  user's browser via Supabase channel `user:<id>` → session refreshes → the
  Premium icon appears/disappears **instantly** (no re-login). New
  `RealtimeSession` mounted in the root layout.
- **Self-hosted analytics:** `PageView` table + `POST /api/track` ping (deduped
  per navigation) → admin Overview shows **Total visits / Visits today**, and a
  **Live online** count via Supabase presence (channel `site-visitors`).
- **Post views:** `Post.views` counter (prefetch-guarded increment on the article
  page), shown on the post byline + aggregated in admin.
- **Admin Premium tab:** dedicated section listing all Premium members with
  one-click downgrade; updates live via channel `members`.
- Generic `src/lib/realtime.ts` `broadcastEvent` (chat broadcast refactored onto
  it). ⚠️ One-time SQL (Post.views + PageView) in HANDOFF.md.

## 2026-06-11 — Community Chat → advanced group chat
- **Nav:** "Community" link renamed to "Community Chat" (href unchanged).
- **Reactions:** emoji reactions (👍❤️😂🔥🚀🎉👀💯) — `ChatReaction` table,
  `POST /api/chat/messages/[id]/react` toggle (reuses `like` limiter), live
  `reaction` broadcast + optimistic chips.
- **Replies:** quote/reply to any message — `ChatMessage.replyToId` self-relation,
  composer reply preview, in-message quoted snippet (click → scroll to original).
- **Realtime presence + typing:** "N online" count and "X is typing…" indicator
  via Supabase channel presence/broadcast (hidden gracefully on polling fallback).
- **Polish (framer-motion, /community chunk only):** animated message enter/exit,
  reaction pop, typing dots, jump-to-latest w/ unread count; consecutive-author
  message grouping; hover action bar (react/reply/copy/delete); emoji picker in
  composer (curated, no new dep); @mention highlighting → profile links.
- **Schema:** +`ChatReaction`, +`ChatMessage.replyToId`. ⚠️ Combined one-time SQL
  in HANDOFF.md. Chat-scoped change only; shared First-Load JS unchanged.

## 2026-06-11 — Community Chat (Supabase Realtime · public read, login to post)
- **New page `/community`** ("The XYZ Lounge"): live message feed with avatars,
  Premium ★/Team badges, day separators, smart auto-scroll + jump-to-latest,
  load-older pagination, optimistic send w/ draft restore, own/admin delete,
  guests read + "Log in to chat" CTA. Plain-text only (XSS-safe), links via
  `safeHref`. Performance: own route chunk — shared First-Load JS unchanged;
  `@supabase/supabase-js` (new dep) lazy-imported inside the chat page only.
- **Realtime:** server broadcasts `new_message`/`message_hidden` to Supabase
  channel `community` after DB writes; clients subscribe with the public anon
  key. Graceful fallback to visibility-aware 10s polling when env unset.
- **Schema:** `ChatMessage` (body ≤500, status visible|hidden, cascade on user
  delete). ⚠️ One-time prod migration — SQL in HANDOFF.md.
- **API:** GET/POST `/api/chat/messages` (cursor history / send, new `chat`
  rate-limit 10/min/user), DELETE `/api/chat/messages/[id]` (author or admin).
- Nav "Community" + orbital node now → `/community`; homepage community section
  gains an "Open Community Chat" CTA. New env (optional):
  `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 2026-06-11 — Docs book + continuity handoff (GitBook-ready)
- **New:** root `CLAUDE.md` (continuity anchor for any AI/dev session),
  `docs/SUMMARY.md` + `docs/README.md` (GitBook book structure), `docs/HANDOFF.md`
  (resume-from-any-account guide, env table names-only, pending-migration SQL),
  `docs/api-reference.md` (all 24 endpoints), `docs/SECURITY.md` (posture + secrets
  policy). Changelog/backend-state/frontend-state updated for Profiles v1.1.
- Docs-only release; no runtime changes.

## 2026-06-11 — Bug fixes + mobile/PC performance pass + audit (PR #11)
- **Bugs:** dedicated `password` rate-limit bucket (reset spam no longer blocks
  signups); settings save no longer blocked by stale handle check; `/u/[username]`
  double DB query → React `cache()`; profiles force-dynamic → **ISR 60s** with
  `revalidatePath` on profile/avatar edits.
- **Perf (mobile):** backdrop blur 10–18px+saturate → 8px on ≤768px; Lenis
  disabled on touch; orbital particles 34 → 14 on phones.
- **Perf (PC/both):** hero parallax rAF-throttled; ticker pauses in hidden tabs;
  dashboard 3 user counts → 1 groupBy. Bundle size unchanged.
- **Audit:** `docs/AUDIT-2026-06-11.md` (scorecard A−/A); backup branch
  `backup/v1.1-profiles` + source ZIP delivered to owner.

## 2026-06-11 — User profiles: public /u/[handle] + private /settings (PR #10)
- **Public profile** `/u/[username]`: banner, avatar (initials fallback), bio,
  location, socials (X/GitHub/Telegram/website), Premium/Team/member-since badges,
  stats (posts/comments/likes), recent-comment activity. Email never exposed.
- **Settings** (tabbed Profile/Account/Security): avatar upload (Supabase), name,
  unique handle w/ live availability, bio/location/website/socials, membership
  panel + upgrade CTA, change password (current-password verify), delete account
  (typed confirm, transactional).
- **Schema:** +username (unique), bio, location, website, twitter, github,
  telegram, bannerImage. ⚠️ Requires one-time prod migration (see HANDOFF.md).
- **API:** PATCH/DELETE `/api/profile`, POST `/api/profile/avatar`,
  POST `/api/profile/password`, GET `/api/profile/username`.
- Navbar: avatar + account dropdown (Profile/Settings/Dashboard/Sign out).
- 15 new unit tests (50 total). CI ESLint config fixed (`.eslintrc.json` + deps).

## 2026-06-11 — Orbital ecosystem section + auth simplification (Phase 4)
- **Home:** premium 3D Orbital Ecosystem section (additive; rings/nodes/particles,
  in-view + reduced-motion gated, no heavy libs, home stays ISR).
- **Auth:** login is now standard email+password (removed OTP 2FA step); authorize
  verifies bcrypt + rate-limit (login 10/min/account). Signup still OTP-verified;
  forgot-password unchanged. New PasswordField (show/hide + strength meter on signup).
  Removed dead /api/auth/login/start route.
- Verified: tsc clean, 35 tests, build exit 0.

## 2026-06-11 — Final pre-merge batch: session CTAs, Likes, perf, polish
- **Logged-in CTAs:** WaitlistForm/Hero/CtaBand/ResearchPreview now session-aware —
  account holders see "Explore Research" instead of early-access/waitlist (client-side
  checks; home stays ISR). New `EarlyAccessCta`.
- **Likes:** `PostLike` table (migration `4_likes`), `POST /api/posts/[id]/like`
  toggle (auth, rate-limited), `LikeButton` (optimistic) beside ShareRow on articles.
- **Perf:** CommentSection fetch deferred until in-view; AVIF/WebP image formats.
- **Polish:** PostManager alert() → inline errors.
- Verified: tsc, 31 tests, build exit 0, home ○ ISR intact.

## 2026-06-11 — Pre-merge audit + Premium Content + Comments + account privacy
- **Audit:** PASS, 88/100, no critical/regressions; image-upload "issue" = config (Storage env+bucket).
- **Premium Content:** `Post.premium` flag + editor toggle; **2-layer gating** — list
  API redacts body, `[slug]` server-renders `PremiumLock` (no body in HTML/JSON-LD)
  unless `membership==="Premium"`/admin. Premium badges on cards + manager. `[slug]` now dynamic.
- **Comments:** `Comment` table; `/api/posts/[id]/comments` (GET public, POST logged-in,
  auto-publish, Zod 1–1000, `comment` rate-limit) + admin `DELETE /api/comments/[id]`;
  `CommentSection` on articles (never exposes commenter email).
- **Account/privacy:** `membership` added to JWT+session; Navbar account chip with
  **masked email** (`maskEmail`) + Free/Premium pill + easy sign-out (desktop + mobile).
- **Upload hardening:** client type/size pre-check, drag-and-drop, 501→URL-fallback hint.
- **Migration:** `3_premium_comments` (additive; run in Supabase SQL Editor).
- **Docs:** new `backend-state.md` + `frontend-state.md`. Files unchanged in auth-login
  logic/deploy/existing columns. Verified: tsc, 31 tests, build exit 0.

## 2026-06-10 — OTP delivery fix + premium article + perf
- **Files:** `lib/email.ts`, 3 × `api/auth/*/start` routes, `research/[slug]/page.tsx`,
  `globals.css`, `PostCard.tsx`, new `ReadingProgress.tsx` + `ShareRow.tsx`, docs/.
- **Fix:** OTP emails — root cause `onboarding@resend.dev` only delivers to the
  Resend account owner (members got nothing). Send failures now return 502 to the
  user (no more silent stuck-on-OTP screen) + Sentry capture. Real fix = owner
  verifies domain in Resend and sets `EMAIL_FROM` to it (steps in RUNBOOK).
- **Design:** premium article page — reading progress bar, share row (copy/X/
  Telegram), author byline card, lead excerpt, `.prose-xyz` upgrades.
- **Perf:** lazy-loaded below-the-fold home sections (dynamic imports).

## 2026-06-10 — CMS upgrade (edit/draft/preview/upload) + feed pagination
- **Backend:** `GET/PATCH /api/research/[id]` (edit; stable slugs), paginated +
  searchable `GET /api/research`, `POST /api/upload` (Supabase Storage REST,
  graceful fallback), dashboard posts bounded. Zero schema changes.
- **Frontend:** `PostEditor` (toolbar, Write/Preview, cover URL/upload,
  draft/publish), `PostManager` (search/filter/status/edit/toggle/delete),
  `/research` search + Load more, related-posts on articles; framer-motion
  dropped from ResearchGrid. Tests 27.

## 2026-06-10 — Sentry + security hardening + indexes
- Sentry (client/server/edge, DSN-guarded; handleError 500s reported).
- Security headers (CSP/HSTS/XFO/nosniff/referrer/permissions), image-host
  allowlist (was `**`), `next` 14.2.5→14.2.35, DB indexes
  (`Post(published,category,createdAt)`, `User(createdAt)`), RUNBOOK.md.

## 2026-06-10 — Email OTP auth + Supabase Postgres migration
- Schema → Supabase Postgres (pooled + `pgbouncer=true`, `DIRECT_URL`).
- OTP system: `VerificationCode` table, signup verify-then-create, login 2FA,
  forgot/reset password; Resend integration w/ dev-mode fallback; 2-step
  Signup/Login UI + `/forgot-password`. Robust sign-out; ISR for home/research
  + on-demand revalidation; HMAC OTP hashing.

## 2026-06-XX — Backend hardening (Steps 1,3–7)
- **Files:** new `src/lib/env.ts`, `src/lib/api.ts`, `src/lib/ratelimit.ts`,
  `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx`,
  `vitest.config.ts`, `src/lib/__tests__/*`, `.github/workflows/ci.yml`;
  modified all `src/app/api/*` routes, `src/lib/auth.ts`,
  `src/lib/markdown.tsx`, `.env.example`, `package.json`.
- **Hardening:** centralized error handling (Zod→400, P2002→409, P2025→404,
  safe 500); env validation (warn-only) + multi-admin (`ADMIN_EMAILS`);
  Upstash rate limiting w/ no-op fallback (signup/subscribe/admin); real 404s +
  cuid guards on admin routes; fixed slug N+1; `allowDangerousEmailAccountLinking
  =false`; markdown link-protocol XSS guard; error/not-found boundaries.
- **Quality gate:** Vitest (15 tests) + GitHub Actions CI (typecheck→lint→
  test→build).
- **Pending:** Step 2 — Supabase Postgres migration (needs connection strings).

## 2026-06-XX — Analytics & SEO Foundation
- **Files:** new `src/lib/seo.ts`, `src/lib/jsonld.tsx`, `src/components/Analytics.tsx`,
  `src/app/robots.ts`, `src/app/sitemap.ts`; modified `src/app/layout.tsx`,
  `src/app/research/[slug]/page.tsx`, `.env.example`.
- **Added:** robots.txt (disallow /dashboard, /api, /login), dynamic sitemap.xml
  (static routes + published posts), canonical URLs, completed Open Graph +
  Twitter cards, GA4 (env-gated `NEXT_PUBLIC_GA_ID`), Google Search Console
  verification (`NEXT_PUBLIC_GSC_VERIFICATION`), JSON-LD structured data
  (Organization + WebSite site-wide; BlogPosting + BreadcrumbList per article),
  per-article metadata (article OG type, published/modified time, keywords).
- **Env:** `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GSC_VERIFICATION`.
- **Perf:** GA loads `afterInteractive`; sitemap is force-dynamic (no DB at build).
- Backend-phase plan Step 8. No frontend visual changes.

## 2026-06-XX — Memory system + baseline snapshot
- **Files:** added `/docs/{project-state, frontend-roadmap, design-system,
  brand-guidelines, component-registry, changelog}.md`.
- **Note:** Frontend untouched. Captures the deploy-ready baseline as source of truth.

## Baseline (deploy-ready) — summary of work to date
- **Hero:** glass animated eyebrow, "Everything you need to win in Web3.",
  7-badge orbit (WEB3/PERP DEX/DEFI/NFT/RWA/ALPHA/DEX), animated background,
  50K+ members stat.
- **Live data:** market ticker (10 coins, 10s, flash, scroll) via cached
  `/api/ticker`; real BTC+ETH **candlestick** charts with 1D/7D/1M via cached
  `/api/chart` (CoinGecko OHLC).
- **Sections:** Ecosystem pills (Alpha/Web3/Perp DEX/DeFi/NFT); brand-colored
  clickable proof strip + footer socials; About + "SINCE 2019" credibility;
  Products bento + animated visuals (Airdrop "You are eligible"); Ecosystem
  cards (Web3 Academy + TradeKaroVerse); Social; CTA/newsletter; sticky CTA.
- **System:** premium green CTAs w/ shine; gold brand accent; Geist + Geist
  Mono; Lenis smooth scroll; Reveal pop/bounce + heading cascade; glassmorphism;
  responsive container 1200→1320→1480; no em dashes (AI-tell removed).
- **Perf:** server-cached live-data routes (no client rate limits);
  reduced-motion aware; pure-CSS/transform animations.

<!-- Append new entries ABOVE this line, newest first. Template:

## YYYY-MM-DD — <short title>
- Files: ...
- Components: ...
- Design improvements: ...
- Performance improvements: ...
-->
