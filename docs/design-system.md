# XYZ Crypto — Design System

Premium, restrained, handcrafted. Bar: Apple · Linear · Stripe · Vercel ·
Hyperliquid · Phantom. Restraint over glow. Defined in `tailwind.config.ts`
and `src/app/globals.css`.

This is the single design-system doc. It covers both layers: the **brand spec**
(palette, spacing, components, motion) and the **theming layer** (light/dark,
semantic tokens). Brand identity is preserved by the theming layer, not replaced
by it.

> Consolidated 2026-07-29 from `design-system.md` + `DESIGN-SYSTEM.md`, which had
> drifted into two files whose names differed only by case. See `changelog.md`.

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

## Theming (light / dark)
- Strategy: Tailwind `darkMode: "class"`. **Dark is the default** (`<html class="dark">`).
- A no-FOUC inline script in `src/app/layout.tsx` applies the saved choice before paint.
- Toggle: `src/components/ThemeToggle.tsx` (navbar, desktop + mobile) — flips the
  `dark` class and persists `localStorage.theme`.
- **Dark values are unchanged** from the original design (pixel-identical). The light
  theme is a baseline at the chrome level; per-component light values are refined
  during per-area passes.

### Semantic tokens (CSS vars → Tailwind aliases)
Defined in `globals.css` (`:root` = light, `.dark` = dark). Prefer these aliases for
new or refactored UI so it themes automatically:

| Token / class | Meaning | Dark | Light |
|---|---|---|---|
| `bg-base` (`--bg`) | page background | `#08080a` | `#f6f7f9` |
| `bg-surface` (`--surface`) | card / panel | `#0e0e12` | `#ffffff` |
| `bg-surface-2` (`--surface-2`) | nested / hover | `#15151b` | `#eef0f3` |
| `text-content` (`--content`) | primary text | `#d4d4d8` | `#1b1b22` |
| `text-content-muted` (`--content-muted`) | secondary text | `#a1a1aa` | `#5b5b66` |
| `border-hairline` (`--hairline`) | hairline border | `rgba(255,255,255,.08)` | `rgba(0,0,0,.10)` |

**Brand constants (do not theme-swap):** `gold-*`, `mint-*`, `ink-*`, `bg-gold-shine`,
`text-gold-gradient`, `text-mint-gradient`. Identical in both themes.

## Typography
- UI/display: **Geist Sans** (`--font-sans`). Data/labels/numbers: **Geist Mono** (`.mono`).
- Display scale (clamp, in `tailwind.config.ts` `fontSize`): `display-xl` (~1.95→6rem),
  `display-lg`, `display-md` — fluid with tightened tracking. Use for hero/section
  headings; default sizes for body.
- Headings `tracking-tight`; mono labels uppercase, tracking ~0.16em.
- Body never below `zinc-400`.
- **Exception:** the homepage hero headline uses **Fraunces** (serif, `--font-fraunces`).
  Scoped to that one headline only — not the shared `font-display` class. A site-wide
  serif change was tried and explicitly reverted.

### Gradient text — read before using
`background-clip: text` on a wrapper does **not** paint through to nested inline
children. Apply `text-shine` / `text-shimmer` / `text-gold-gradient` to each leaf
span individually. Put one on a parent wrapping multiple children and the uncovered
children render invisible.

## Spacing & layout
- Container: `max-w-[1200px]` → `xl:1320px` → `2xl:1480px`, `px-5 sm:px-6 lg:px-8`.
- Section rhythm: `py-14 sm:py-20 lg:py-24`. Heading→content: `mt-10 sm:mt-12`.
- 8pt spacing. Card padding `p-5 sm:p-8` (large) / `p-6` (standard).

## Radius
- Pills/buttons `rounded-full`; inputs/tags `rounded-xl`; cards `rounded-3xl` /
  `rounded-4xl` (2rem, large premium cards).

## Shadows (premium, low-glow)
`shadow-card`, `shadow-card-hover`, `shadow-btn`, `shadow-elevate` (glass depth),
plus `shadow-gold` / `shadow-mint` for brand emphasis. Avoid stacking many
`blur-3xl` orbs.

## Surfaces / glass
- `.surface` — glass card (backdrop-blur + saturate + inset highlight) used by
  most cards; `.surface-hover` + `.lift` for hover.
- `.glass` — stronger glass (overlays). `.eyebrow-glass` — hero eyebrow glass + shine.

## Buttons
- `.btn-primary` — premium **green** gradient + layered shadow + active state +
  auto/hover **shine sweep**. (Get early access, Get Started, Join, Subscribe.)
- `.btn-gold` — gold gradient + shine (auth: Create account, Sign in).
- `.btn-secondary` — soft surface. `.btn-ghost` — outline.
- Inputs: see `Field` in `LoginForm.tsx`.

## Icons
- lucide-react, strokeWidth ~1.7, sizes `h-4/5/6`. BrandIcons for social SVGs.
- lucide-react v1 has **no** Twitter/Github icons — use `src/components/BrandIcons.tsx`.

## Motion
- Lenis smooth scroll (duration ~1.15).
- **Motion tokens:** `ease-premium` (`cubic-bezier(.22,1,.36,1)`), `ease-premium-in`;
  `duration-250` / `duration-400`.
- `Reveal` variants: `up` (rise, spring), `pop` (scale + bounce overshoot),
  `fade`. SectionHeading cascades eyebrow→title→subtitle.
- Hover: lift -4px, border light, icon micro-move. CTA/eyebrow shine sweep.
- Keyframes (globals): drift-a/b, aurora-spin, floatY, grid-pan, badge-orbit,
  bar-pulse, coin-drop, sheen, ping-soft, flow, grow-x, draw-line, btn-shine.

### `prefers-reduced-motion` policy (revised 2026-07-25 — narrower than it used to be)
**Only the heavy full-screen ambient loops are gated**: mesh, aurora, particles,
starfield twinkle, Saturn/Moon bob.

**Deliberately exempt** — treated as core brand identity, not decoration: the ticker
marquee, `text-shine` / `text-shimmer`, shooting stars, and the whole Icons3D system
(`.i3d-*`). This followed repeated reports that the site looked "static", every one
of which traced back to reduced-motion being active in the test environment.

Default a new decorative CSS animation to **exempt** unless it is a genuinely heavy
full-screen effect. One-shot framer-motion entrance/reveal animations were never
gated on this.

## Libraries
- **framer-motion** — primary component/scroll animation.
- **anime.js v4** — opt-in micro-interactions, lazy-loaded via `src/lib/anime.ts`
  (`loadAnime()` + `prefersReducedMotion()`); keep out of the initial bundle.
- **iconsax-react** — premium icon accents, used **additively** alongside the
  existing `lucide-react` set (no mass migration).
- **react-three-fiber 9 / drei 10** — installed and compiling, but the WebGL orbital
  scene is **gated off**. The CSS orbital is the live homepage centrepiece.

## Live data
- `/api/ticker` (cached) → 10 coins price/24h. `/api/chart?coin=&days=` (cached) →
  OHLC candles (1/7/30d). Both server-cached with graceful fallback.
- Cache windows and poll intervals are cost-sensitive and are **not** listed here —
  they live in the `cost-check` skill, which owns every caching number. One fact,
  one home.

## Conventions
- Prefer semantic tokens (`bg-surface`, `text-content`) for new/refactored UI so it
  themes automatically; keep brand gradients explicit.
- Reuse existing tokens and component classes. Do not invent new patterns — check
  `component-registry.md` before adding a component.
- Mobile-first; performance-first (lazy-load heavy visuals; budget bundle size).
- One area per increment; verify (typecheck/lint/test/build) before shipping.

## Related
- `brand-guidelines.md` — brand architecture, sub-brands, voice/tone, official links.
  Brand *policy*; this file is visual *implementation*.
- `component-registry.md` — the component inventory (note: currently stale, predates
  the community/journal/markets/news surfaces).
