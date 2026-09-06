# XYZ Crypto — Project State (Source of Truth)

> **READ THIS FIRST in every session.** This documents the current, deployed
> frontend. Never rely on memory alone — these docs are authoritative.

- **Repo branch (active):** `claude/xyz-crypto-web3-site-BuytL`
- **Production:** XYZCrypto.io (deployed via Vercel)
- **Status:** Frontend approved by owner & deploy-ready.

---

## Non-negotiable guardrails
1. **Current frontend is the baseline. Never revert to older versions.**
2. **Hero baseline:** `The Home Of Next Gen Web3.` — never revert to
   "Built for the Next Generation of Web3".
3. **Sub-brands are mandatory, never remove:** XYZ Crypto · TradeKaroVerse ·
   XYZ Web3 Academy.
4. **Real logos only** (in `/public`): `logo.jpg` (XYZ Crypto),
   `tradekaroverse.jpg`, `web3-academy.jpg`. Never replace.
5. **Design direction:** Premium Web3, Black + Gold, enterprise-grade,
   human-designed, smooth animations, mobile-first + desktop + monitor optimized.
6. Quality bar: Hyperliquid · Stripe · Linear · Vercel · Phantom · Apple.
   Must never feel AI-generated (e.g. no em dashes in copy, no "✨ AI" clichés
   beyond the single intentional hero sparkle).

---

## Tech stack
| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS + custom tokens (`globals.css`, `tailwind.config.ts`) |
| Motion | Framer Motion + **Lenis** smooth scrolling (reduced-motion aware) |
| Icons | lucide-react (stroke ~1.7) + custom BrandIcons (social SVGs) |
| Fonts | Geist Sans (UI) + Geist Mono (data/labels) |
| Auth | NextAuth (Google + email/password) |
| DB/ORM | Prisma (SQLite dev → Postgres prod) |
| Live data | CoinGecko via cached server routes (`/api/ticker`, `/api/chart`) |

---

## Current frontend — section by section

### Slogan
`The Home Of Next Gen Web3..` (in `src/lib/site.ts` → used in footer + SEO).

### Navigation (`Navbar.tsx`)
- Floating hairline **pill** navbar, becomes blurred + bordered on scroll.
- Logo (logo.jpg) + "XYZ Crypto" wordmark (gold gradient + white).
- Links: **Products · Research · Ecosystem · Roadmap · Community** with animated
  gold underline on hover.
- Right: "Log in" (text) + **"Get Started"** primary (green) CTA.
- Mobile: hamburger → dropdown panel.
- NOTE: a "Roadmap" nav link exists but a dedicated Roadmap section is **not yet
  built** (see frontend-roadmap.md — pending).

### Hero (`Hero.tsx` + `AnimatedBackground.tsx`)
- Eyebrow: **glass pill** "The Home Of Next Gen Web3.." with Sparkles icon +
  animated gold shine sweep.
- Headline: **"Everything you need to win in Web3."** (display-xl, gold gradient
  on "win in Web3.").
- Subtitle: "On-chain research, pro trading tools, a perpetual DEX, airdrop
  intelligence and a free academy. The complete Web3 toolkit, built for the
  next generation of traders and builders."
- CTAs: **"Get early access"** (green primary, shine) + **"Explore research"**
  (secondary).
- Trust line: "Free to join · No wallet required · Community first".
- Stats strip: **50K+** Members & growing · **6+** Products in pipeline ·
  **24/7** On-chain coverage.
- **Logo medallion:** pointer-reactive 3D tilt, rotating rings, floating logo,
  **7 orbiting badges**: WEB3 · PERP DEX · DEFI · NFT · RWA · ALPHA · DEX
  (per-tone glow + scale pulse).
- Background: drifting gradient mesh + aurora ribbon + floating particles +
  animated grid. Hero fills ~76vh on desktop.

### Live Market Ticker (`MarketTicker.tsx` + `/api/ticker`)
- Binance/CMC-style **continuous scroll** (pause on hover), full-bleed.
- 10 assets: BTC ETH SOL SUI HYPE BNB XRP DOGE AVAX LINK.
- Each: logo + symbol + price + 24h % + up/down arrow.
- **Green/red flash** on price change. Auto-refresh **10s**. Loading / Live /
  fallback (amber) states. Server-cached to avoid rate limits.

### Proof Strip (`ProofStrip.tsx`)
- "One ecosystem · trusted across every platform" — brand-colored, clickable:
  YouTube (red), X (white), Telegram (sky), LinkedIn (blue) + Web3 Academy &
  TradeKaroVerse (real logos). Scroll-reveal pop.

### About / Who We Are (`About.tsx`)
- Split layout: left = heading + Learn/Trade/Earn + **SINCE 2019 credibility
  block** (Active since 2019 · Research driven · Community first · Web3 native).
- Right = 4 pillar cards (Research-driven, Builder tooling, Community first,
  Security & trust), pop-in on scroll.

### Products (`Products.tsx` + `ProductVisuals.tsx` + `PerpChart.tsx`)
Bento grid:
- **Perp DEX** (spotlight, wide): **two real-time candlestick charts** (BTC +
  ETH) via `/api/chart` (CoinGecko OHLC) with **timeframe selector 1D/7D/1M**,
  live price + 24h change, 60s refresh.
- **Trading Tools** (tall): animated bars/PnL preview (TradingVisual).
- **Airdrop Tools**: dropping coins + progress + **"✓ You are eligible"** badge.
- **XYZ Premium**: rotating shine ring + crown + animated perks.
- **Web3 Academy**: animated course-progress bars + LIVE dot.
- **& More**: pulsing "shipping soon" node.

### Research (`ResearchPreview.tsx`)
- Latest 3 published posts from DB (force-dynamic). Full hub at `/research`
  (category tabs) + article pages `/research/[slug]` (markdown).

### Ecosystem communities (`Ecosystem.tsx`)
- Two community cards: **Web3 Academy** + **TradeKaroVerse** (real logos, status
  badge, blurb, "Join on Telegram", rich hover). Mobile-optimized sizing.
- (XYZ Crypto itself is the parent brand = the whole site.)

### Social (`Social.tsx`)
- 4 channel cards: YouTube · X · Telegram · LinkedIn, brand-color glow hover.

### CTA / Newsletter (`CtaBand.tsx` + `WaitlistForm.tsx`)
- "Join the waitlist" email capture (`/api/subscribe`) + "Create a full account"
  + social proof count.
- Footer also has "Get alpha in your inbox" newsletter capture.

### Footer (`Footer.tsx`)
- Newsletter band + brand-colored social icons + Explore/Account link columns +
  copyright + **risk disclaimer**.

### Sticky mobile CTA (`StickyCta.tsx`)
- Bottom bar on mobile (hidden for signed-in users): "Join XYZ Crypto for free".

### Auth & Admin
- `/login`, `/signup` (email + Google). `/dashboard` (admin only): Overview
  stats, Publish (markdown CMS → auto-appears live), Content (delete), Members
  (email, signup date, last login, membership Free/Premium toggle, CSV export).

---

## Color system (summary — see design-system.md)
- **Base:** ink/black (`#08080a`).
- **Brand accent:** gold (`gold-400 #e2a72f`) — wordmark, headings, eyebrows,
  badges, auth buttons (`btn-gold`).
- **Primary action CTAs:** **premium green** (`btn-primary`) — Get early access,
  Get Started, Join, Subscribe.
- **Data only:** green = up / red = down (ticker, candles, PnL). Sky/violet used
  sparingly on product status badges.

## Typography
- Geist Sans (display + body), Geist Mono (numbers, labels, handles, badges).
- Display scale via clamp: `display-xl/lg/md`. Body min contrast `zinc-300/400`.

## Animations
- Lenis smooth scroll; Reveal variants (up / pop-bounce / fade, spring-based);
  SectionHeading cascade; card pop-in; CTA + eyebrow shine sweep; orbit badges;
  animated background; live candlesticks + ticker; product micro-animations.
- All gated by `prefers-reduced-motion`.

## Responsive behavior
- Container: `1200px` → `xl:1320px` → `2xl:1480px`; padding `px-5 sm:px-6 lg:px-8`.
- Mobile-first; hero/medallion/stats scale down; ecosystem & product cards
  reflow to single column; ticker scrolls; no horizontal overflow
  (`body{overflow-x:hidden}`). Hero `lg:min-h-[76vh]`.

> The recurring red curvy line / floating circle some screenshots show is the
> **in-app browser overlay** (Telegram/IG webview), NOT the site.

---

## Backend state (updated 2026-06-10 — authoritative)

> **Frontend = LOCKED baseline** (owner-approved). Build features on top;
> never redesign existing sections without explicit owner request.

### Stack & infra
- DB: **Supabase Postgres** via Prisma. `DATABASE_URL` = pooled 6543 **must
  include `?pgbouncer=true`** (else 42P05). `DIRECT_URL` = 5432 (migrations).
- Auth: NextAuth JWT + **email OTP**: signup = verify-then-create; login =
  password + emailed 2FA code; forgot-password = emailed reset code.
- Email: **Resend** (`RESEND_API_KEY`, `EMAIL_FROM`). ⚠️ `onboarding@resend.dev`
  delivers ONLY to the Resend account owner — production needs a **verified
  domain** + `EMAIL_FROM` on that domain, else members get no OTP.
- Monitoring: Sentry (DSN-guarded; `NEXT_PUBLIC_SENTRY_DSN`). Errors from
  `handleError`, email failures, global-error boundary.
- Rate limiting: Upstash (optional env; fail-open no-op without it).
- Image upload: Supabase Storage REST (`SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY`, public bucket `post-covers`); URL field works without it.

### API routes (all follow: rateLimit → Zod → auth gate → Prisma → handleError)
| Route | Methods | Auth | Notes |
|---|---|---|---|
| `/api/auth/[...nextauth]` | * | — | OTP-credentials provider + Google |
| `/api/auth/signup/start` | POST | public | validates, emails OTP; 502 if email fails |
| `/api/auth/login/start` | POST | public | password check → 2FA OTP email |
| `/api/auth/password/start` | POST | public | reset OTP (anti-enumeration generic reply) |
| `/api/auth/password/reset` | POST | public | code + new password |
| `/api/research` | GET | public | published-only; `page/pageSize/q/category`, returns total/hasMore |
| `/api/research` | POST | ADMIN | create; stable slug + P2002 retry; revalidates / + /research |
| `/api/research/[id]` | GET | ADMIN | full post (incl. drafts) for editor |
| `/api/research/[id]` | PATCH | ADMIN | partial update; slug stable unless draft+title-change |
| `/api/research/[id]` | DELETE | ADMIN | delete + revalidate |
| `/api/upload` | POST | ADMIN | image → Supabase Storage, 5MB, jpeg/png/webp/gif/avif |
| `/api/users/[id]/membership` | PATCH | ADMIN | Free/Premium toggle |
| `/api/subscribe` | POST | public | waitlist upsert |
| `/api/ticker`, `/api/chart` | GET | public | CoinGecko cached |

### Schema (7 tables, Postgres) & migrations
User, Post, Subscriber, Account, Session, VerificationToken, **VerificationCode**
(OTP: hashed code, purpose, attempts, expiry). Draft = `Post.published=false`.
Migrations in `prisma/migrations/`: `0_init`, `1_verification_code`, `2_indexes`
— **applied manually via Supabase SQL Editor** (not via `migrate deploy`;
baselining steps in RUNBOOK). Never hand-edit schema without a migration file.

### Key lib modules
`lib/api.ts` (ok/fail/handleError/getAdminSession/isCuid) · `lib/otp.ts` (HMAC
codes, single-use, 10min, 5 attempts) · `lib/email.ts` (Resend + dev fallback)
· `lib/storage.ts` (Storage REST) · `lib/env.ts` (validated env + feature flags)
· `lib/ratelimit.ts` · `lib/markdown.tsx` (XSS-safe renderer, `.prose-xyz`).

### CMS (dashboard)
`PostEditor` (create+edit, markdown toolbar, Write/Preview via `.prose-xyz`,
cover URL/upload, Save-draft vs Publish) · `PostManager` (search, category +
status filter, Draft/Published badges, inline edit, publish-toggle, delete-confirm).

### Rendering / perf
Home + /research + /research/[slug] = **ISR** (300/120/300s) + on-demand
`revalidatePath` on content changes. All list queries bounded/paginated.
Security headers (CSP/HSTS/XFO…) in `next.config.mjs`; image hosts allowlisted.

### Verification gate (run before every push)
`npx tsc --noEmit` · `npx vitest run` (27+ tests) · `npm run build` exit 0.
