# XYZ Crypto — Changelog

Newest first. **Update this after every design change** with: date, files
changed, components changed, design improvements, performance improvements.

---

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
