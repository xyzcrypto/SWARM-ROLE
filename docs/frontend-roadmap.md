# XYZ Crypto — Frontend Roadmap

## ✅ Done (shipped on `claude/xyz-crypto-web3-site-BuytL`)
- Premium hero (glass eyebrow, 7-badge orbit, animated bg, 50K+ stats).
- Live market ticker (10 coins, 10s, flash, scroll).
- Ecosystem pills (Alpha/Web3/Perp DEX/DeFi/NFT).
- Brand-colored clickable proof strip + footer socials.
- About + "SINCE 2019" credibility block.
- Products bento with **real candlestick charts** (BTC+ETH, 1D/7D/1M) + animated
  product visuals (Trading/Airdrop "You are eligible"/Premium/Academy/More).
- Ecosystem community cards (Web3 Academy + TradeKaroVerse).
- Research preview + hub + article pages; CMS dashboard; auth; members analytics.
- Email capture/waitlist + newsletter; sticky mobile CTA.
- Premium green CTAs with shine; Lenis smooth scroll; scroll reveals (pop/bounce).
- No em dashes in copy (AI-tell removed). Responsive: mobile → ultrawide.

## ⏳ Pending / known gaps
- **Roadmap section** — nav link `/#roadmap` exists but the section is not built.
- Dedicated **Community section** (separate from Social/Proof) — optional.
- Research hub: search + tags + pagination + related posts.
- `/account` area for regular (non-admin) members.
- Per-article OG images; referral/points; Perp DEX waitlist page.

## Production / infra
- Deploy on Vercel. For persistent signups switch Prisma datasource to
  `postgresql` (Vercel Postgres / Neon / Supabase) and set env
  (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAIL`,
  optional `GOOGLE_CLIENT_ID/SECRET`). Live ticker/chart need open network
  (works on Vercel; blocked in the build sandbox → shows fallback).

## Working rules for future changes
1. Read all `/docs` first (project-state, changelog especially).
2. Change ONLY what the owner asks; keep everything else intact.
3. Build (`npm run build`) → commit → **push immediately** (env can reset).
4. Update `changelog.md` after every change.
