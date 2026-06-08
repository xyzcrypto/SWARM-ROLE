# XYZ Crypto — Project State

> **Read this file at the start of every session before touching any code.**
> If this file and the live deployment conflict, the live deployment wins.
> Update this file after every major change.

---

## Live Deployment

| Key | Value |
|-----|-------|
| URL | https://xyzcrypto.io |
| Current version | **v3.0** |
| Active branch | `claude/xyzcrypto-v2-backend-3die7` |
| Latest commit | `1d3345a` — feat: premium v3 frontend redesign |
| Admin email | niralekhan321@gmail.com |

---

## Version History

| Version | Commit | Summary |
|---------|--------|---------|
| v1.0 | `f7eb47c` | Initial XYZ Crypto website (basic landing page) |
| v2.0 | `5851bac` / `cc18a6e` | V2 backend infrastructure (Prisma/Supabase/NextAuth/APIs) + frontend redesign |
| v2.1 | `be3e4ff` | Headline locked to "The home of / next-gen / Web3." |
| **v3.0** | `1d3345a` | **Current** — Premium redesign: true black, JetBrains Mono stats, enterprise-grade UI |

---

## Current UI State

### Homepage Section Order (`src/app/page.tsx`)

| Order | Component | File | Section ID |
|-------|-----------|------|------------|
| 1 | Navbar | `Navbar.tsx` | fixed header |
| 2 | Hero | `Hero.tsx` | — |
| 3 | About | `About.tsx` | `#about` |
| 4 | Products | `Products.tsx` | `#products` |
| 5 | ResearchPreview | `ResearchPreview.tsx` | `#research` |
| 6 | Ecosystem | `Ecosystem.tsx` | `#ecosystem` |
| 7 | Social | `Social.tsx` | `#community` |
| 8 | CtaBand | `CtaBand.tsx` | — |
| 9 | Footer | `Footer.tsx` | — |

### Section Descriptions

**Hero** — Two-column layout. Left: tiered headline (light "The home of" / extrabold gold "next-gen" / extrabold white "Web3."), JetBrains Mono stats row, two CTAs. Right: concentric rotating rings + floating logo medallion. Marquee ticker at bottom.

**About** — 4-pillar card grid: Research-Driven (01), Builder Tooling (02), Community First (03), Security & Trust (04). Ghost watermark numbers, icon-box, hover lift.

**Products** — 6-product grid (sm:2-col, lg:3-col). Perp DEX is the featured card (sm:col-span-2). Status badges: Live/Coming Soon/In Development/Planned/Next Version.

**ResearchPreview** — Latest 3 published posts from DB. Server component (Prisma query). Empty state with CTA if no posts.

**Ecosystem** — XYZ Crypto full-width parent card + Web3 Academy + TradeKaroVerse in 2-col grid. All 3 brands show logo images (/logo.jpg, /web3-academy.jpg, /tradekaroverse.jpg).

**Social** — 4 platform cards: YouTube (red), X/Twitter (zinc), Telegram (sky), LinkedIn (blue). "Follow" CTA appears on hover.

**CtaBand** — Dark luxury banner. Triple glow layers, gold top accent, two buttons + trust copy.

**Footer** — 4 columns: Brand (logo + slogan + social icons), Explore (nav links), Ecosystem (community links), Account (auth links). Bottom bar: copyright + "v3.0".

---

## Design System

### Color Palette

#### Ink (backgrounds)
| Token | Hex | Use |
|-------|-----|-----|
| `ink-950` | `#000000` | True black, footer, body bg |
| `ink-900` | `#030408` | Default body bg |
| `ink-800` | `#07080f` | Section surfaces |
| `ink-700` | `#0e1018` | Card backgrounds |
| `ink-600` | `#151822` | Lighter card surface |

#### Gold (primary brand color)
| Token | Hex | Use |
|-------|-----|-----|
| `gold-50` | `#fdf6e3` | Lightest highlight |
| `gold-100` | `#f9e0a8` | Pill text, category badges |
| `gold-200` | `#f7c948` | Bright gold, btn gradient start |
| `gold-300` | `#e9bd54` | Stat highlights |
| `gold-400` | `#e9a020` | **Primary gold** — most UI accents |
| `gold-500` | `#c97f10` | Medium accent |
| `gold-600` | `#a06210` | Darker accent |
| `gold-700` | `#7a480c` | Scrollbar, subtle elements |
| `gold-800` | `#5e3a0c` | Deep shadow color |

### Typography

| Variable | Font | Weight roles | Use |
|----------|------|--------------|-----|
| `--font-sans` / `font-sans` | Inter | 400–600 | Body text, navigation, UI |
| `--font-display` / `font-display` | Sora | 600–800 | Headlines, brand logo, card titles |
| `--font-mono` / `font-mono` | JetBrains Mono | 400–700 | Stats (`.stat-num`), code blocks |

### CSS Utility Classes

| Class | Purpose |
|-------|---------|
| `.text-gold-gradient` | Animated gold gradient text (background-clip) |
| `.text-shine` | Shimmer animated gold text |
| `.stat-num` | JetBrains Mono, tabular-nums, -0.02em tracking |
| `.pill-gold` | Small uppercase label pill with gold border |
| `.icon-box` | Square icon container, gold bg/border, group-hover glow |
| `.section-sep` | 1px horizontal gradient separator (`<hr>`) |
| `.bg-grid` | Subtle gold grid background overlay |
| `.glow-orb` | Positioned radial blur glow element |
| `.glass` | Glassmorphism panel (backdrop-blur, white/7% border) |
| `.brand-card` | Ecosystem/brand card with hover lift + glow |
| `.feature-card` | Featured product card (gold tint bg + strong glow) |
| `.card-gold-border` | Standard dark card with gold hover border |
| `.prose-xyz` | Article/blog markdown prose styling |

### Button Variants

| Class | Height | Use |
|-------|--------|-----|
| `.btn-gold` | 52px | Primary CTA — gold gradient, black text |
| `.btn-ghost` | 52px | Secondary CTA — outline, backdrop blur |
| `.btn-gold-sm` | 36px | Nav CTA — compact gold for header |

### Box Shadows
| Name | Definition | Use |
|------|-----------|-----|
| `shadow-gold` | ring + 60px spread | Card hover |
| `shadow-gold-sm` | 32px blur, 55% opacity | Small card hover |
| `shadow-gold-lg` | 80px blur, 48% opacity | Medallion, large elements |
| `shadow-gold-xl` | 120px blur, 55% opacity | Hero logo |

---

## Brand Guidelines

### Locked Headline (DO NOT CHANGE)
```
The home of      ← font-light, text-zinc-400
next-gen         ← font-extrabold, .text-gold-gradient
Web3.            ← font-extrabold, text-zinc-50
```

### Brand Copy
- **Slogan**: "The home of next-gen Web3."
- **Meta title**: "XYZ Crypto — The home of next-gen Web3"
- **Description**: "A next-generation Web3 ecosystem — research, trading tools, perp DEX, airdrop tools, premium intelligence & education. Built for the next generation of Web3."
- **Tagline sub-copy**: "Research, trading tools, a perp DEX, airdrop tools, premium intel and education — one ecosystem engineered for the builders, traders and degens of tomorrow."

### Logo & Assets
| Asset | Path | Use |
|-------|------|-----|
| Main logo | `/public/logo.jpg` | Navbar, hero medallion, footer, OG image |
| Web3 Academy | `/public/web3-academy.jpg` | Ecosystem section community card |
| TradeKaroVerse | `/public/tradekaroverse.jpg` | Ecosystem section community card |

### Social Handles
| Platform | Handle | URL (from `src/lib/site.ts`) |
|----------|--------|------------------------------|
| YouTube | @xyzcrypto | https://youtube.com/@xyzcrypto |
| X (Twitter) | @XYZCryptos | https://x.com/XYZCryptos |
| Telegram (main) | @X_Y_Z_Crypto | https://t.me/X_Y_Z_Crypto |
| LinkedIn | /company/xyzcrypto | https://www.linkedin.com/company/xyzcrypto/ |

---

## Ecosystem Structure

```
XYZ Crypto (Hub)          xyzcrypto.io           The Hub — Live
├── Web3 Academy          t.me/X_Y_Z_Web3         Learn — Telegram community
└── TradeKaroVerse        t.me/TradeKaro_Verse     Trade — Telegram community
```

All configured in `src/lib/site.ts` → `site.ecosystem`.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.5 |
| Language | TypeScript | 5.5.4 |
| Styling | Tailwind CSS | 3.4.9 |
| Animations | Framer Motion | 11.3.24 |
| ORM | Prisma | 5.18.0 |
| Database | Supabase PostgreSQL | — |
| Auth | NextAuth | 4.24.7 |
| Auth adapter | @next-auth/prisma-adapter | 1.0.7 |
| Passwords | bcryptjs | 2.4.3 |
| Validation | Zod | 3.23.8 |
| Storage | @supabase/supabase-js | 2.107.0 |

---

## Database Schema

**Provider:** Supabase PostgreSQL
**ORM:** Prisma with PgBouncer (transaction mode on port 6543, direct on port 5432)

### User Model
```
id           String    @id @default(cuid())
name         String?
email        String    @unique
emailVerified DateTime?
image        String?
passwordHash String?
role         String    @default("USER")     // USER | PREMIUM | ADMIN
membership   String    @default("standard") // standard | premium | enterprise
provider     String    @default("credentials") // credentials | google
status       String    @default("active")   // active | disabled
lastLogin    DateTime?
signupDate   DateTime  @default(now())
createdAt    DateTime  @default(now())
updatedAt    DateTime  @updatedAt
```

### Post Model
```
id          String    @id @default(cuid())
title       String
slug        String    @unique            // auto-generated from title
excerpt     String
content     String                       // Markdown
cover       String?                      // image URL (Supabase Storage)
category    String    @default("Research") // Research | Article | Post
tags        String    @default("[]")     // JSON array string
published   Boolean   @default(false)
publishedAt DateTime?
authorId    String?
createdAt   DateTime  @default(now())
updatedAt   DateTime  @updatedAt
```

### NextAuth Models
- **Account** — OAuth provider link (userId, provider, providerAccountId)
- **Session** — JWT sessions (userId, sessionToken, expires)
- **VerificationToken** — Email verification (identifier, token, expires) — *currently unused*

---

## API Surface

| Route | Method | Auth Required | Purpose |
|-------|--------|---------------|---------|
| `/api/auth/[...nextauth]` | GET, POST | — | NextAuth (credentials + Google OAuth) |
| `/api/signup` | POST | — | Email/password registration |
| `/api/research` | GET | — (drafts: ADMIN) | List published posts; `?drafts=1` for drafts |
| `/api/research` | POST | ADMIN | Create new post |
| `/api/research/[id]` | GET | — | Fetch single post by ID |
| `/api/research/[id]` | PATCH | ADMIN | Edit post (title, content, published, etc.) |
| `/api/research/[id]` | DELETE | ADMIN | Delete post |
| `/api/admin/users` | GET | ADMIN | List users with `?search=&page=&limit=` |
| `/api/admin/users/[id]` | PATCH | ADMIN | Update user role/membership/status |
| `/api/upload` | POST | ADMIN | Upload image to Supabase Storage (max 5MB, JPEG/PNG/WebP/GIF) |

---

## Security Layer (`src/middleware.ts`)

### Rate Limiting (in-memory, per edge instance)
| Endpoint | Limit |
|----------|-------|
| `/api/auth/*`, `/api/signup` | 10 req/min |
| All other `/api/*` | 60 req/min |

> **Note:** In-memory implementation resets per instance restart. Upgrade to Upstash Redis for production multi-instance deployments.

### Route Protection
- `/dashboard` → requires authenticated session with `role === "ADMIN"`
  - Not authenticated → `/login?callbackUrl=/dashboard`
  - Authenticated but not ADMIN → `/` (homepage)

### Security Headers Applied to All Routes
| Header | Value |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | self + fonts.googleapis.com + supabase.co + accounts.google.com |

---

## Components — Completed

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Navbar | `src/components/Navbar.tsx` | ✅ v3 | Glass pill nav, btn-gold-sm CTA, black blur |
| Hero | `src/components/Hero.tsx` | ✅ v3 | Tiered weight headline, JetBrains Mono stats |
| About | `src/components/About.tsx` | ✅ v3 | Ghost numbers, icon-box, 4 pillars |
| Products | `src/components/Products.tsx` | ✅ v3 | Bento grid, featured Perp DEX, status dots |
| PostCard | `src/components/PostCard.tsx` | ✅ v3 | Category badge, meta row, hover scale |
| ResearchPreview | `src/components/ResearchPreview.tsx` | ✅ v3 | Server component, empty state CTA |
| Ecosystem | `src/components/Ecosystem.tsx` | ✅ v3 | All 3 brands, top accent, refined glows |
| Social | `src/components/Social.tsx` | ✅ v3 | Platform cards, follow CTA on hover |
| CtaBand | `src/components/CtaBand.tsx` | ✅ v3 | Triple glow, gold accent, trust copy |
| Footer | `src/components/Footer.tsx` | ✅ v3 | 4 columns, ink-950 bg, v3.0 stamp |
| DashboardClient | `src/components/DashboardClient.tsx` | ✅ v2 | Admin tabs, user mgmt, CSV export, publish |
| AuthShell | `src/components/AuthShell.tsx` | ✅ | Auth page wrapper |
| LoginForm | `src/components/LoginForm.tsx` | ✅ | Credentials + Google login |
| SignupForm | `src/components/SignupForm.tsx` | ✅ | Email/password registration |
| GoogleButton | `src/components/GoogleButton.tsx` | ✅ | OAuth trigger button |
| Reveal | `src/components/Reveal.tsx` | ✅ | Scroll animation (Framer Motion) |
| BrandLogo | `src/components/BrandLogo.tsx` | ✅ | Logo w/ initials fallback |
| BrandIcons | `src/components/BrandIcons.tsx` | ✅ | SVG: YouTube, X, Telegram, LinkedIn, Google |

## Components — Do Not Touch Without Explicit Instruction

These are stable and must not be modified:

- `src/components/AuthShell.tsx` — auth layout wrapper
- `src/components/LoginForm.tsx` — login form
- `src/components/SignupForm.tsx` — signup form
- `src/components/GoogleButton.tsx` — Google OAuth button
- `src/components/Reveal.tsx` — animation utility
- `src/components/BrandLogo.tsx` — logo component
- `src/components/BrandIcons.tsx` — icon library
- `src/app/login/page.tsx` — login page
- `src/app/signup/page.tsx` — signup page
- `src/app/research/page.tsx` — research hub page
- `src/app/research/[slug]/page.tsx` — article page
- `src/app/providers.tsx` — NextAuth provider wrapper
- All files under `src/app/api/` — backend API routes
- `prisma/schema.prisma` — data model
- `src/lib/auth.ts` — NextAuth configuration
- `src/lib/prisma.ts` — Prisma client
- `src/lib/site.ts` — brand/nav/social config
- `src/middleware.ts` — security + rate limiting

---

## Environment Variables

```bash
# ── Supabase PostgreSQL ──────────────────────────────────
DATABASE_URL="postgresql://[user]:[password]@[host]:6543/[db]?pgbouncer=true"
DIRECT_URL="postgresql://[user]:[password]@[host]:5432/[db]"

# ── NextAuth ─────────────────────────────────────────────
NEXTAUTH_SECRET="<openssl rand -base64 32>"
NEXTAUTH_URL="https://xyzcrypto.io"   # production; http://localhost:3000 for dev

# ── Google OAuth (optional) ──────────────────────────────
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# ── Admin bootstrap ──────────────────────────────────────
ADMIN_EMAIL="niralekhan321@gmail.com"  # auto-promoted to ADMIN on first signup

# ── Supabase Storage ─────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
SUPABASE_STORAGE_BUCKET="xyz-crypto-media"
```

---

## Future Roadmap / Pending Work

### Backend (Medium Priority)
| Item | Notes |
|------|-------|
| Upstash Redis rate limiter | Replace in-memory rate limiting for multi-instance prod |
| Email verification flow | `VerificationToken` model exists, logic not wired |
| Password reset flow | No reset endpoint yet |
| Full-text post search | `GET /api/research?q=` query param not implemented |
| Formal Prisma migrations | Currently using `db push`; add `prisma migrate` workflow |

### Frontend (Low Priority — only change if explicitly requested)
| Item | Notes |
|------|-------|
| Research [slug] page styling | Uses prose-xyz but could be polished further |
| Dashboard visual upgrade | DashboardClient.tsx is functional v2, not v3 styled |

### Products (Actual Products — not website features)
| Product | Status |
|---------|--------|
| Perp DEX | Coming Soon |
| Trading Tools | In Development |
| Airdrop Tools | Planned |
| XYZ Premium | Planned |
| Web3 Academy | Live (Telegram) |

---

## Maintenance Rules

1. **After any frontend component change** — update "Components Completed" table and "Current UI State" section
2. **After any API route addition** — update "API Surface" table
3. **After any schema change** — update "Database Schema" section
4. **After any new env var** — update "Environment Variables" section
5. **After every deployment** — update "Live Deployment" table (commit hash + version)
6. **Do not change the locked headline** — "The home of / next-gen / Web3." is production-locked
7. **Treat live xyzcrypto.io as source of truth** — if repo and live differ, audit before overwriting

---

*Last updated: 2026-06-08 after v3 premium redesign commit `1d3345a`*
