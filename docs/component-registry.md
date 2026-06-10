# XYZ Crypto — Component Registry

Reuse these; do not duplicate. Paths under `src/`.

## UI primitives — `components/ui/`
| Component | File | Notes |
|---|---|---|
| Container | `primitives.tsx` | responsive max-width + padding |
| Section | `primitives.tsx` | section vertical rhythm |
| Eyebrow | `primitives.tsx` | mono uppercase pill (gold dot) |
| SectionHeading | `primitives.tsx` | eyebrow→title→subtitle, cascades via Reveal |
| Badge | `primitives.tsx` | tone variants |
| Button | `Button.tsx` | variants primary/secondary/ghost, sizes sm/md/lg |
| Input / Field | `Input.tsx` | hairline input |
| Tag | `Tag.tsx` | mono category pill |
| Counter | `Counter.tsx` | count-up on scroll |

## Sections / features — `components/`
| Component | File | Purpose |
|---|---|---|
| Navbar | `Navbar.tsx` | floating blur pill nav + green CTA |
| Hero | `Hero.tsx` | flagship hero, 7-badge orbit, glass eyebrow |
| AnimatedBackground | `AnimatedBackground.tsx` | mesh + aurora + particles + grid |
| MarketTicker | `MarketTicker.tsx` | live scrolling ticker (10 coins) |
| EcosystemPills | `EcosystemPills.tsx` | Alpha/Web3/Perp DEX/DeFi/NFT pills |
| ProofStrip | `ProofStrip.tsx` | brand-colored clickable platform logos |
| About | `About.tsx` | Who We Are + SINCE 2019 credibility block |
| Products | `Products.tsx` | bento product cards |
| PerpChart | `PerpChart.tsx` | real candlestick chart + timeframe (per coin) |
| ProductVisuals | `ProductVisuals.tsx` | Trading/Airdrop/Premium/Academy/More visuals |
| ResearchPreview | `ResearchPreview.tsx` | latest research from DB |
| Ecosystem | `Ecosystem.tsx` | Web3 Academy + TradeKaroVerse cards |
| Social | `Social.tsx` | YouTube/X/Telegram/LinkedIn cards |
| CtaBand | `CtaBand.tsx` | waitlist + account CTA |
| WaitlistForm | `WaitlistForm.tsx` | email capture (→ /api/subscribe) |
| Footer | `Footer.tsx` | newsletter + colored socials + links + disclaimer |
| StickyCta | `StickyCta.tsx` | mobile bottom CTA |
| SmoothScroll | `SmoothScroll.tsx` | Lenis controller (mounted in layout) |
| Reveal | `Reveal.tsx` | scroll-reveal (up/pop/fade) |
| BrandIcons / BrandLogo | `BrandIcons.tsx` / `BrandLogo.tsx` | social SVGs / logo-with-fallback |
| DashboardClient | `DashboardClient.tsx` | admin tabs (overview/publish/content/members) |
| AuthShell / LoginForm / SignupForm / GoogleButton | auth UI |

## API routes — `app/api/`
`ticker/` (live prices, 10s) · `chart/` (OHLC candles, coin+days) ·
`subscribe/` (email capture) · `research/` + `research/[id]/` (CMS) ·
`users/[id]/membership/` (admin) · `auth/[...nextauth]/`.

## Pages — `app/`
`page.tsx` (home) · `research/` + `research/[slug]/` · `login/` · `signup/` ·
`dashboard/` · `layout.tsx` (fonts, metadata, SmoothScroll).

## Libs — `lib/`
`site.ts` (brand, links, subBrands, navLinks) · `utils.ts` (cn, dates) ·
`auth.ts` · `prisma.ts` · `markdown.tsx`.

## Brand assets — `/public/`
`logo.jpg` · `tradekaroverse.jpg` · `web3-academy.jpg`.

## Backend/CMS components (2026-06-10)
| Component | File | Purpose |
|---|---|---|
| PostEditor | `src/components/PostEditor.tsx` | Create/edit posts: markdown toolbar, Write/Preview (`.prose-xyz`), cover URL or upload, Save-draft vs Publish |
| PostManager | `src/components/PostManager.tsx` | Dashboard content tab: search, category/status filters, badges, inline edit, publish-toggle, delete-confirm |
| OtpStep | `src/components/OtpStep.tsx` | Shared 6-digit OTP entry (signup + login 2FA): resend cooldown, devCode hint |
| ForgotPasswordForm | `src/components/ForgotPasswordForm.tsx` | Email → code → new password flow |
| ReadingProgress | `src/components/ReadingProgress.tsx` | Gold scroll-progress bar on article pages |
| ShareRow | `src/components/ShareRow.tsx` | Copy link / X / Telegram share buttons on articles |
