# XYZ Crypto — Design System

Premium, restrained, handcrafted. Bar: Apple · Linear · Stripe · Vercel ·
Hyperliquid · Phantom. Restraint over glow. Defined in `tailwind.config.ts`
and `src/app/globals.css`.

## Color tokens
- **ink** 950→500 — black surfaces, base `#08080a`.
- **gold** 50→800 — brand accent; primary `gold-400 #e2a72f`.
- **mint** 50→800 — primary-action green (`btn-primary`) + market "up".
- **red-400** — market "down" only.
- **line** (DEFAULT / soft / strong / gold) — hairline borders.
- Text: `zinc-50` headings · `zinc-300` body · `zinc-400/500` secondary · `zinc-600` faint.
- Accent (sparingly, product status only): sky, violet.

Rule: gold = brand/identity, green = action + positive data, red = negative data.
Do not introduce random colors.

## Typography
- UI/display: **Geist Sans** (`--font-sans`). Data/labels/numbers: **Geist Mono** (`.mono`).
- Display scale (clamp): `display-xl` (~1.95→6rem), `display-lg`, `display-md`.
- Headings `tracking-tight`; mono labels uppercase, tracking ~0.16em.
- Body never below `zinc-400`.

## Spacing & layout
- Container: `max-w-[1200px]` → `xl:1320px` → `2xl:1480px`, `px-5 sm:px-6 lg:px-8`.
- Section rhythm: `py-14 sm:py-20 lg:py-24`. Heading→content: `mt-10 sm:mt-12`.
- 8pt spacing. Card padding `p-5 sm:p-8` (large) / `p-6` (standard).

## Radius
- Pills/buttons `rounded-full`; inputs/tags `rounded-xl`; cards `rounded-3xl` /
  `rounded-4xl` (2rem).

## Shadows (premium, low-glow)
`shadow-card`, `shadow-card-hover`, `shadow-btn`, `shadow-elevate`, plus
`shadow-gold` for brand emphasis. Avoid stacking many `blur-3xl` orbs.

## Surfaces / glass
- `.surface` — glass card (backdrop-blur + saturate + inset highlight) used by
  most cards; `.surface-hover` + `.lift` for hover.
- `.glass` — stronger glass (overlays). `.eyebrow-glass` — hero eyebrow glass + shine.

## Buttons
- `.btn-primary` — premium **green** gradient + layered shadow + active state +
  auto/hover **shine sweep**. (Get early access, Get Started, Join, Subscribe.)
- `.btn-gold` — gold gradient + shine (auth: Create account, Sign in).
- `.btn-secondary` — soft surface. `.btn-ghost` — outline.

## Icons
- lucide-react, strokeWidth ~1.7, sizes `h-4/5/6`. BrandIcons for social SVGs.

## Motion spec
- Lenis smooth scroll (duration ~1.15, reduced-motion off).
- `Reveal` variants: `up` (rise, spring), `pop` (scale + bounce overshoot),
  `fade`. SectionHeading cascades eyebrow→title→subtitle.
- Hover: lift -4px, border light, icon micro-move. CTA/eyebrow shine sweep.
- Keyframes (globals): drift-a/b, aurora-spin, floatY, grid-pan, badge-orbit,
  bar-pulse, coin-drop, sheen, ping-soft, flow, grow-x, draw-line, btn-shine.
- **Everything respects `prefers-reduced-motion`** (ambient loops disabled).

## Live data
- `/api/ticker` (10s cache) → 10 coins price/24h. `/api/chart?coin=&days=`
  (120s cache) → OHLC candles (1/7/30d). Both: server-cached + graceful fallback.
