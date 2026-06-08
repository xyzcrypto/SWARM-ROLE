# XYZ Crypto — Project State (Authoritative Baseline)

> **Read this file at the start of every session before touching any code.**
> If this file and the live deployment conflict, the live deployment wins.
> Update this file after every major change.

---

## Correct Baseline Confirmed

**Branch:** `claude/xyzcrypto-v2-backend-3die7`
**Tip commit:** `08ecf21` — feat: premium v3.1 — hook animations, 3D tilt, spotlight, counters, sticky CTA
**Version label:** v3.1

This is the correct frontend. **Do NOT revert to the old version** that used:
- Headline "Built for the Next Generation of Web3"
- Yellow/old gold CTA buttons without the compact `btn-gold-sm` nav variant
- Static hero stats (no animated counters)
- No StatsBand, no StickyCTA, no TiltCard, no spotlight, no particles

---

## Version History

| Version | Commit | Summary |
|---------|--------|---------|
| v1.0 | `5d33c88` | Initial XYZ Crypto website (basic landing page, old headline) |
| v2.0 | `5851bac` + `cc18a6e` | V2 backend (Prisma/Supabase/NextAuth/APIs) + frontend redesign start |
| v2.1 | `be3e4ff` | Headline locked to "The home of next-gen Web3." |
| v3.0 | `1d3345a` | Premium redesign — true black, JetBrains Mono, enterprise-grade UI |
| v3.0.1 | `b7fcc0d` | Added authoritative project-state.md |
| **v3.1** | `08ecf21` | **Current** — hook animations, 3D TiltCard, spotlight, animated counters, StickyCTA |

---

## Live Deployment

| Key | Value |
|-----|-------|
| URL | https://xyzcrypto.io |
| Active branch | `claude/xyzcrypto-v2-backend-3die7` |
| Latest commit | `08ecf21` |
| Admin email | niralekhan321@gmail.com |

---

## Homepage Section Order (`src/app/page.tsx`)

```
Navbar          — fixed header
Hero            — landing hero with headline, CTAs, medallion
StatsBand       — animated counter strip (4 stats)
About           — 4-pillar cards with TiltCard + spotlight
Products        — 6-product grid with TiltCard + spotlight
ResearchPreview — latest 3 DB posts
Ecosystem       — XYZ Crypto hub card + Web3 Academy + TradeKaroVerse
Social          — 4 platform cards
CtaBand         — dark luxury CTA banner
Footer          — 4-column footer
StickyCTA       — floating "Get Started Free" pill (appears after 520px scroll)
```

---

## Locked Headline (DO NOT CHANGE)

```
The home of      ← text-4xl/5xl/6xl, font-light, text-zinc-400
next-gen         ← text-5xl/7xl/5.5rem, font-extrabold, .text-gold-gradient
Web3.            ← text-4xl/6xl/7xl, font-extrabold, text-zinc-50
```

Each line uses `<RevealLine>` — a clip-mask slide-up entrance (y: "110%" → "0%", 0.85s, cubic-bezier(0.16,1,0.3,1)).

---

## Components Inventory

### New in v3.1 (not in the old version)

| File | Purpose |
|------|---------|
| `src/components/StatsBand.tsx` | Full-width animated counter strip between Hero and About |
| `src/components/StickyCTA.tsx` | Fixed bottom-right "Get Started Free" pill, appears at 520px scroll |
| `src/components/TiltCard.tsx` | Mouse-tracking 3D perspective tilt wrapper using Framer Motion springs |

### All Components

| Component | File | Type | Notes |
|-----------|------|------|-------|
| Navbar | `Navbar.tsx` | Client | Fixed; transparent → `bg-black/90 backdrop-blur-2xl` on scroll >24px |
| Hero | `Hero.tsx` | Client | Mouse spotlight, clip-reveal lines, animated counters, particles |
| StatsBand | `StatsBand.tsx` | Client | 4 stats with gold scan-line animation |
| About | `About.tsx` | Server+Client | TiltCard + spotlight overlay on each pillar card |
| Products | `Products.tsx` | Server+Client | TiltCard + spotlight; Perp DEX is featured card |
| ResearchPreview | `ResearchPreview.tsx` | Server | Fetches 3 latest published posts via Prisma |
| Ecosystem | `Ecosystem.tsx` | Server | XYZ parent card (full-width) + 2 community cards |
| Social | `Social.tsx` | Server | 4 platform cards with brand-specific hover colors |
| CtaBand | `CtaBand.tsx` | Server | Triple glow layers, top accent line, trust copy |
| Footer | `Footer.tsx` | Server | 4-column grid; Ecosystem column; "v3.0" label |
| StickyCTA | `StickyCTA.tsx` | Client | AnimatePresence float-in pill at bottom-right |
| TiltCard | `TiltCard.tsx` | Client | Reusable 3D tilt wrapper |
| Reveal | `Reveal.tsx` | Client | Scroll-triggered Framer Motion fade-up wrapper |
| PostCard | `PostCard.tsx` | Server | Research card with cover, category badge, meta |
| ResearchGrid | `ResearchGrid.tsx` | Client | Category filter tabs + AnimatePresence card grid |
| BrandLogo | `BrandLogo.tsx` | Client | Image with initials fallback for community logos |
| BrandIcons | `BrandIcons.tsx` | Server | YouTube, X, Telegram, LinkedIn, Google SVG icons |
| AuthShell | `AuthShell.tsx` | Server | Centered card wrapper for login/signup pages |
| LoginForm | `LoginForm.tsx` | Client | Email+Google login form |
| SignupForm | `SignupForm.tsx` | Client | Email registration form |
| GoogleButton | `GoogleButton.tsx` | Client | Google OAuth button |
| DashboardClient | `DashboardClient.tsx` | Client | 4-tab admin panel |

---

## Design System

### Body Background
```css
background-color: #000000;  /* true black */
```

### Color Palette

#### Ink (backgrounds, surfaces)
| Token | Hex | Use |
|-------|-----|-----|
| `ink-950` / `ink.DEFAULT` | `#000000` | Body bg, footer, true black |
| `ink-900` | `#030408` | Default bg (near-black) |
| `ink-800` | `#07080f` | Section surfaces |
| `ink-700` | `#0e1018` | Card backgrounds |
| `ink-600` | `#151822` | Lighter card surface, code bg |

#### Gold (primary brand accent)
| Token | Hex | Use |
|-------|-----|-----|
| `gold-50` | `#fdf6e3` | N/A (reserved) |
| `gold-100` | `#f9e0a8` | Pill text, category badge text |
| `gold-200` | `#f7c948` | Bright gold, btn gradient start, live ping |
| `gold-300` | `#e9bd54` | Icon color, stat highlights |
| `gold-400` | `#e9a020` | **Primary accent** — borders, section labels, hover |
| `gold-500` | `#c97f10` | Medium accent, scrollbar |
| `gold-600` | `#a06210` | Darker gradient end |
| `gold-700` | `#7a480c` | Deep gradient |
| `gold-800` | `#5e3a0c` | Darkest shadow |

---

### Typography

| Variable | Font | Source | Weight roles | Use |
|----------|------|--------|--------------|-----|
| `--font-sans` / `font-sans` | Inter | Google Fonts | 400–600 | Body text, nav links, UI |
| `--font-display` / `font-display` | Sora | Google Fonts | 600–800 | All headings, logo, card titles |
| `--font-mono` / `font-mono` | JetBrains Mono | Google Fonts | 400–700 | `.stat-num` numbers, code blocks |

All three fonts loaded via `next/font` with CSS variable injection and `display: swap`.

#### Type Scale (hero)
```
The home of   → font-light, text-zinc-400, 4xl / 5xl / 6xl
next-gen      → font-extrabold, .text-gold-gradient, 5xl / 7xl / [5.5rem]
Web3.         → font-extrabold, text-zinc-50, 4xl / 6xl / 7xl
```

#### Section Labels
```
text-xs font-bold uppercase tracking-[0.22em] text-gold-400
```

---

### CSS Utility Classes (`src/app/globals.css`)

| Class | Purpose |
|-------|---------|
| `.bg-grid` | Subtle 72px gold dot-grid with radial mask fade |
| `.glow-orb` | Positioned blur-100 radial glow element |
| `.section-sep` | 1px horizontal gold gradient line (`<hr>`) — separates all major sections |
| `.text-gold-gradient` | 7-stop 135deg gold gradient, background-clip: text |
| `.text-shine` | Animated moving gold shimmer on text (5s loop) |
| `.stat-num` | JetBrains Mono, tabular-nums, -0.02em tracking |
| `.glass` | Glassmorphism: backdrop-blur-20, white/7% border |
| `.card-gold-border` | Standard dark card: `ink-700→ink-900` bg, gold/12% border, hover brightens to gold/38% |
| `.brand-card` | Ecosystem/community card: `ink-600→ink-900` bg, gold/14% border, hover -6px lift |
| `.feature-card` | Featured product card: gold tint bg, `::before` radial, `::after` gradient shimmer on hover |
| `.feature-card-glow` | Animated glow-pulse box-shadow keyframe on featured card |
| `.pill-gold` | Small uppercase label pill: gold/5% bg, gold/25% border, gold-100 text |
| `.icon-box` | Square icon container: gold/6% bg, gold/14% border, group-hover glow + scale |
| `.spotlight` | Per-card CSS radial spotlight tracking mouse via `--mouse-x/y` CSS vars |
| `.shimmer-hover:hover` | Hover-triggered text shimmer animation |
| `.particle` | Absolute positioned float-particle element |
| `.clip-reveal` | `overflow: hidden; display: block` — clip container for RevealLine entrance |
| `.marquee` | Continuous horizontal scroll (34s, pauses on hover) |
| `.section-sep` | Gold gradient `<hr>` separator between sections |
| `.prose-xyz` | Article markdown prose styles |

---

### Button Variants

| Class | Height | Colors | Use |
|-------|--------|--------|-----|
| `.btn-gold` | 52px | `#f7c948 → #e9a020 → #b5740f`, black text | Primary CTAs (Hero, CTA band) |
| `.btn-ghost` | 52px | Transparent, gold/22% border, zinc-300 text | Secondary CTAs, mobile nav |
| `.btn-gold-sm` | 36px | Same gradient, compact | Navbar "Get Started", StickyCTA |

---

### Animations

#### Framer Motion (per component)

| Element | Animation | Timing |
|---------|-----------|--------|
| Hero badge pill | `opacity 0→1, y 10→0` | 0.5s |
| Hero headline — line 1 | Clip reveal, `y 110%→0%` | 0.85s, delay 0.12s |
| Hero headline — line 2 | Clip reveal, `y 110%→0%` | 0.85s, delay 0.26s |
| Hero headline — line 3 | Clip reveal, `y 110%→0%` | 0.85s, delay 0.40s |
| Hero subheading | `opacity 0→1, y 14→0` | 0.65s, delay 0.55s |
| Hero CTAs | `opacity 0→1, y 12→0` | 0.65s, delay 0.65s |
| Hero stats row | `opacity 0→1` | 0.9s, delay 0.78s |
| Hero medallion | `opacity 0→1, scale 0.88→1` | 1.1s, cubic-bezier(0.16,1,0.3,1) |
| Hero logo float | `y [0, -14, 0]` | 8s, infinite |
| Stat counters (Hero + StatsBand) | `0 → target` via `useMotionValue` + `animate()` | 2s easeOut, fires on inView |
| StatsBand cells | `opacity 0→1, y 12→0` | 0.55s, stagger 0.1s |
| TiltCard | `rotateX/Y ±intensity deg` | Spring: stiffness 260, damping 28 |
| Reveal (sections) | `opacity 0→1, y 28→0` | 0.6s, cubic-bezier(0.22,1,0.36,1) |
| ResearchGrid filter | `opacity 0→1, scale 0.96→1` | 0.3s per card |
| StickyCTA appear | `opacity 0→1, y 24→0, scale 0.95→1` | 0.35s, cubic-bezier(0.16,1,0.3,1) |
| StickyCTA disappear | `opacity→0, y→16, scale→0.95` | 0.35s |

#### CSS Keyframes (tailwind.config.ts)

| Name | Definition | Speed | Use |
|------|-----------|-------|-----|
| `spin-slow` | 0→360deg | 30s linear | Outer hero rings |
| `spin-rev` | 360→0deg | 40s linear | Inner dashed hero ring |
| `float` | translateY 0→-16px→0 | 8s ease-in-out | (available) |
| `shimmer` | bgPos -200%→200% | 6s linear | (available) |
| `pulse-ring` | scale 0.88→1.72, opacity 0.7→0 | 3.5s ease-out | Hero pulsing outer ring |
| `fade-up` | opacity 0→1, translateY 20→0 | 0.65s | (available) |
| `fade-in` | opacity 0→1 | 0.5s | (available) |
| `glow-pulse` | boxShadow min→max gold | 3s ease-in-out | Featured Perp DEX card |
| `scan-line` | bgPos -100%→200% | 4.5s linear | StatsBand gold sweep |
| `float-particle` | translateY/X float + opacity | 6s ease-in-out | Hero medallion particles |
| `border-flow` | bgPos 0%→100%→0% | 5s ease | (available) |
| `text-reveal` | translateY 110%→0% | — | RevealLine keyframe reference |
| `shine` | bgPos 0→200% | 5s linear | `.text-shine` moving shimmer |
| `marquee` | translateX 0→-50% | 34s linear | Hero ticker, pauses on hover |

---

## Ecosystem Architecture

```
XYZ Crypto (Hub)                 xyzcrypto.io
├── Web3 Academy                 t.me/X_Y_Z_Web3
└── TradeKaroVerse               t.me/TradeKaro_Verse
```

### Ecosystem Section Layout

```
[XYZ Crypto — full-width parent brand card]     ← hub, live, gold accent
    [Web3 Academy card]  [TradeKaroVerse card]  ← 2-col community grid
```

**Parent card (XYZ Crypto):**
- 80×80 logo, "The Hub" gold badge + "Live" emerald badge
- Description + "Explore Products" CTA arrow button
- Gold glow orbs, top gold accent line, hover lift

**Community cards:**
- BrandLogo (image with initials fallback) + name + tag badge
- Web3 Academy: gold tag, gold glow
- TradeKaroVerse: sky/blue tag, sky glow
- "Join on Telegram" link with Telegram icon + arrow

### Brand Asset Paths
| Asset | Path |
|-------|------|
| XYZ Crypto logo | `/public/logo.jpg` |
| Web3 Academy logo | `/public/web3-academy.jpg` |
| TradeKaroVerse logo | `/public/tradekaroverse.jpg` |

---

## Navigation

### Navbar Links (`src/lib/site.ts`)
```
About       → /#about
Products    → /#products
Research    → /research
Ecosystem   → /#ecosystem
Community   → /#community
```

### Nav CTA
- Guest: "Log in" (text link) + "Get Started" (`btn-gold-sm`, 36px)
- Auth: "Dashboard" (admin only, text link) + "Sign out" (text link)

### Nav Behavior
- Transparent at top
- `bg-black/90 shadow-[0_1px_60px_-12px_rgba(0,0,0,1)] backdrop-blur-2xl border-b border-white/5` after 24px scroll
- Desktop links in a pill container: `rounded-full border border-white/6 bg-white/2.5 backdrop-blur-md`

---

## Footer

4-column grid `[1.8fr_1fr_1fr_1fr]`:
1. **Brand** — Logo, slogan, 4 social icon buttons
2. **Explore** — nav links
3. **Ecosystem** — Web3 Academy · TradeKaroVerse · XYZ Premium
4. **Account** — Create account · Log in · Research hub · Contact us

Bottom bar: `© YEAR XYZ Crypto. All rights reserved.` + `"The home of next-gen Web3 · v3.0"`

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js App Router | 14.2.5 |
| Language | TypeScript | 5.5.4 |
| Styling | Tailwind CSS | 3.4.9 |
| Animations | Framer Motion | 11.3.24 |
| ORM | Prisma | 5.18.0 |
| Auth | NextAuth v4 | 4.24.7 |
| DB (dev) | SQLite | via Prisma |
| DB (prod) | PostgreSQL | Supabase |
| Fonts | Inter + Sora + JetBrains Mono | next/font |
| Email | — | (not yet integrated) |

---

## Key Differences: Old v1.0 vs Current v3.1

| Element | Old v1.0 | Current v3.1 |
|---------|---------|-------------|
| Hero headline | "XYZ Crypto / Built for the Next Gen..." | "The home of / next-gen / Web3." (clip-reveal) |
| Hero background | `#05060a` | `#000000` (true black) |
| Hero stats | Hardcoded static text | Animated `useMotionValue` counters |
| Hero ring count | 3 rings | 4 rings + pulsing outer ring + 8 floating particles |
| Hero medallion float | y: [0, -14, 0], 6s | y: [0, -14, 0], 8s |
| Spotlight effect | None | Mouse-tracking radial gradient on hero section |
| Primary nav CTA | `btn-gold !px-5 !py-2` | `btn-gold-sm` (36px compact pill) |
| CTA label | "Join Now" | "Get Started" |
| Section separators | None | `.section-sep` gold gradient `<hr>` between sections |
| Cards | Simple hover lift | TiltCard 3D perspective tilt + `.spotlight` overlay |
| Stats band | None | `StatsBand.tsx` (10K+ Members, 6+ Products, 3 Pillars, 100% Community) |
| Sticky CTA | None | `StickyCTA.tsx` — floating "Get Started Free" pill after 520px |
| About card watermarks | None | Ghost `01–04` numbers in background |
| Products status badges | Dot-less | With animated dot indicators |
| Ecosystem structure | 2 communities only | XYZ Crypto parent card + 2 community cards (3 total) |
| Footer columns | 3 `[1.5fr_1fr_1fr]` | 4 `[1.8fr_1fr_1fr_1fr]` — added Ecosystem column |
| Font trio | Inter + Sora | Inter + Sora + JetBrains Mono (`.stat-num`) |
| Gold hue | `#e0a82f` (warmer amber) | `#e9a020` (sharper gold) |
| Body bg | `#05060a` | `#000000` |
| Marquee speed | 26s | 34s (slower, more premium) |
| Marquee pause | No | Yes — pauses on hover |
| Scrollbar width | 10px | 6px (thinner, more refined) |
| Meta title | "...Built for the Next Generation of Web3" | "...The home of next-gen Web3" |

---

## Current Strengths

1. True black + gold palette with refined 7-stop gradient — Hyperliquid/Jupiter quality
2. Clip-reveal headline animation — editorial, not generic
3. Mouse spotlight on hero section + per-card spotlight overlay — premium interaction
4. TiltCard 3D perspective on all About + Products cards — tactile feel
5. Animated stat counters in both Hero and StatsBand — live data feel
6. StickyCTA persistent conversion path without interfering with navigation
7. Ecosystem section promotes all 3 brand pillars with correct logo hierarchy
8. JetBrains Mono for stats — enterprise/terminal credibility
9. `.section-sep` gold gradient lines create visual rhythm between sections
10. `feature-card-glow` animated glow-pulse on Perp DEX — draws the eye to flagship product
11. Marquee pauses on hover — interactive, not purely decorative

---

## Known Gaps (at v3.1 — do not fix without approval)

1. Hero CTAs still say "Join the Movement" / "Explore Research" (not "Get Started" / "Get Early Access")
2. Footer still says `v3.0` (should be updated to `v3.1`)
3. StickyCTA uses `btn-gold-sm` but the inner ping dot uses `bg-black/40` (looks invisible)
4. No user-facing account/profile page
5. No premium paywall UI (DB field `membership` exists, no purchase flow)
6. No token/tokenomics page
7. No interactive roadmap page
8. No search on research hub
9. No pagination on research hub
10. No 404 branded page
11. No newsletter/email capture
12. `web3-academy.jpg` and `tradekaroverse.jpg` may not exist in `/public` — BrandLogo shows initials fallback

---

*No code has been changed from the v3.1 baseline. Awaiting approval to proceed.*
