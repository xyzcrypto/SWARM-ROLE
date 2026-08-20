# XYZ Crypto — Product Roadmap 2026–2027

> Saved: 2026-08-20. Owner-approved direction. Start execution next month.
> Full audit context: see `docs/HANDOFF.md` for current codebase state.

---

## Current State (August 2026)

### Live & Production-Ready
- Homepage (live DB stats, ISR 300s)
- Community Chat (Supabase Realtime, polls, GIFs, reactions, moderation)
- Direct Messages (1-on-1, reply/forward/block/report)
- Markets Hub (CoinGecko + DefiLlama — coins, DeFi, DEX, fees, perps)
- News Aggregator (RSS, AI context, save/like/comment)
- Research Hub (CMS, ISR, AI summaries, premium gating)
- Trading Journal (trades, fills, analytics, equity curve, risk panel, challenges, share cards)
- Auth (OTP email + Google OAuth, brute-force defense)
- Profile System (/u/[username], follow graph, journal activity feed)
- Admin Dashboard (members, posts, AI analytics, moderation, audit log, push)
- Tools (funding fee, liquidation, position size calculators + shareable OG cards)
- XP event logging (DB + award endpoint active — UI missing)

### Known Bugs / Gaps to Fix
- `/premium` page — "Notify me at launch" button is disabled/dead. No payment flow.
- Gamified UI — XP is being logged in DB but **zero visible UI** (leaderboard, levels, badges)
- Hardcoded fallback numbers in `/api/markets/global` and `/api/markets/defi` (stale if APIs down)
- AI features — require `GROQ_API_KEY` or `GEMINI_API_KEY` in Vercel env. Currently may not be set.
- Airdrop Tools — card shown in Products grid, no actual page exists

---

## 4-Month Plan (Sept – Dec 2026)

### Month 1 — Journal + Markets Depth
**Journal: Exchange API Integration**
- Connect Binance / Bybit / OKX read-only API keys per user
- Auto-import trades + fills (no manual entry needed)
- Real-time P&L sync from exchange

**Markets: More Data Layers**
- Options data — Deribit API (free public endpoints)
- Funding rates across exchanges (Binance + Bybit + OKX APIs, all free)
- Whale alerts feed — WhaleAlert free tier
- On-chain metrics — active addresses, exchange inflow/outflow (Glassnode free tier or CryptoQuant)

### Month 2 — Portfolio Management (New Feature)
- Exchange API sync → auto-populate holdings
- Multi-wallet tracker (ETH/SOL public RPC, no key needed)
- Portfolio value over time chart
- Asset allocation breakdown
- Unrealized P&L, 24h change, cost basis
- Integrated with Journal (trades update portfolio automatically)
- News: coin-specific news page (`/news?coin=bitcoin`), keyword alerts, daily digest email

### Month 3 — Gamified UI + Premium Page Fix
**Gamified (XP data exists, just needs UI)**
- XP counter in navbar
- Level system: Beginner → Trader → Degen → OG
- `/leaderboard` page
- Badges for milestones (first trade, 30-day streak, 100 research reads)
- Challenges integrated with XP rewards

**Premium Page**
- Working waitlist form (Resend email capture) — fix the dead button
- Stripe integration — payment intent, basic subscription setup
- Real tier comparison with actual feature gates

### Month 4 — Trading Bot (Basic)
**Scope (realistic for 1 month):**
- Rule-based alert engine: "notify me when BTC drops 5%"
- DCA bot — auto buy at set intervals via exchange API
- Paper trading mode first, live execution opt-in
- Journal auto-logs bot trades

**Out of scope for Month 4:**
- ML/AI prediction models
- HFT or latency-sensitive execution
- Multi-exchange arbitrage

---

## Year 2 Plan (2027)

### Q1 — Premium Backend Full Build
- Stripe subscriptions (monthly/annual, webhook-driven)
- Hard feature gates by tier across all products
- Premium research feed (private posts, member-only)
- Priority AI access with higher daily limits
- Team/Pro tier for trading firms

### Q2-Q3 — Own AI Infrastructure
- Current: Groq/Gemini (per-token cost, scales badly)
- Target: Self-hosted LLaMA 3 / Mistral on Hetzner or vast.ai (~$50-100/month vs API fees at scale)
- Fine-tune on XYZ research content
- Dedicated inference for: assistant, coin briefs, news summaries, journal insights
- Estimated break-even: ~5,000 MAU on AI features

### Q3-Q4 — Gamified Full System
- XP marketplace — spend XP to unlock premium features temporarily
- NFT-style achievement badges (on-chain optional, Solana cheap)
- Referral rewards tied to XP
- Trading tournaments with community prize pools
- Season system (quarterly resets, Hall of Fame)

---

## Priority Order If Bandwidth Is Limited

1. Fix `/premium` dead button → real waitlist (1 day of work)
2. Show XP in navbar → Gamified is already half-built (1 week)
3. Journal exchange API → highest user value (2-3 weeks)
4. Portfolio tracker (3-4 weeks)
5. Markets depth (ongoing, incremental)
6. Trading bot DCA (last, most complex)

---

## Tech Notes for Implementation

- **Exchange APIs**: Use HMAC-SHA256 signed requests. Store API keys encrypted in DB (`crypto.createCipheriv`). Never log them.
- **Portfolio wallets**: Alchemy/Ankr free RPC for ETH, Helius free for SOL (10k req/day free tier)
- **Stripe**: Use `stripe` npm package. Webhook endpoint `/api/stripe/webhook` with raw body parsing.
- **Own AI**: Ollama Docker container, expose via internal network, swap `GROQ_API_KEY` logic in `src/lib/ai.ts`
- **Gamified UI**: XP data already at `/api/xp` — just needs frontend components
