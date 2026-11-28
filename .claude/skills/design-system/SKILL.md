---
name: design-system
description: Use when building or restyling any UI on this project. Triggers - creating a new page, section or component; choosing a color, spacing value, radius, shadow, or font size; adding or changing an animation or transition; editing tailwind.config.ts or src/app/globals.css; adding a button, card, input, badge or heading; making something "look premium" or matching the existing style; deciding whether an effect should respect prefers-reduced-motion. Carries the rules that change a decision - the color rule, the deliberately narrow reduced-motion policy, the gradient-text gotcha, and the do-not-invent-tokens rule. Full token tables live in docs/design-system.md.
---

# Design system — xyzcrypto

Dark luxe: **gold + mint on near-black**. Premium, restrained, handcrafted. Bar:
Apple · Linear · Stripe · Vercel · Hyperliquid · Phantom. **Restraint over glow.**

Tokens are defined in `tailwind.config.ts` and `src/app/globals.css`. The exhaustive
tables (semantic token values, spacing scale, keyframe list) live in
**`docs/design-system.md`** — read it when you need a specific value. This skill
carries the rules that change what you do.

## The color rule

**gold = brand/identity · green (mint) = action + positive data · red = negative data.**

Gold for the wordmark, headings, eyebrows, badges, premium/auth buttons. Mint for
conversion CTAs (`btn-primary`) and market "up". `red-400` for market "down" **only**.
Sky and violet exist but are for product status, used sparingly.

**Do not introduce new colors.** If a value seems missing, it is more likely the
wrong component is being used.

## Do not invent patterns

Reuse what exists. Before adding anything, check `docs/component-registry.md` and
these:

- Surfaces: `.surface` (glass card, most cards) · `.surface-hover` + `.lift` for hover ·
  `.glass` (stronger, overlays) · `.eyebrow-glass`
- Buttons: `.btn-primary` (mint, conversion) · `.btn-gold` (auth) · `.btn-secondary`
  (soft surface) · `.btn-ghost` (outline)
- Inputs: the `Field` component in `LoginForm.tsx`
- Reveal animations: `<Reveal>` with `up` / `pop` / `fade`
- Text accents: `text-gold-gradient`, `text-shine`, `text-shimmer`
- Icons: lucide-react at `strokeWidth ~1.7`, sizes `h-4/5/6`

Prefer semantic tokens (`bg-base`, `bg-surface`, `text-content`, `border-hairline`)
for new or refactored UI so it themes light/dark automatically. Keep brand gradients
(`gold-*`, `mint-*`, `ink-*`) explicit — those never theme-swap.

## `prefers-reduced-motion` — narrower than you expect

This is the rule most likely to be applied wrongly, because the instinct and the
older docs both say "gate everything."

**Gate only the heavy full-screen ambient loops:** mesh, aurora, particles, starfield
twinkle, Saturn/Moon bob.

**Deliberately exempt** — treated as core brand identity, not decoration: the ticker
marquee, `text-shine` / `text-shimmer`, shooting stars, and the entire Icons3D system
(`.i3d-*`). This policy was revised after repeated reports that the site looked
"static", every one of which traced back to reduced-motion being active in the test
environment.

**Default a new decorative CSS animation to exempt** unless it is a genuinely heavy
full-screen effect. One-shot framer-motion entrance/reveal animations were never
gated on this and should not become gated.

## Gradient text — the invisible-children gotcha

`background-clip: text` on a wrapper element does **not** paint through to nested
inline children. Apply `text-shine` / `text-shimmer` / `text-gold-gradient` to **each
leaf span individually**.

Put one on a parent that wraps multiple children and the uncovered children render
**invisible** — no error, no warning, just missing text.

Related: `text-shine` is the bold accent sweep, one phrase per heading.
`text-shimmer` is the quieter continuous sweep for the surrounding headline text.

## Typography

Geist Sans for UI/display, Geist Mono (`.mono`) for data, labels and numbers. Display
ramp `display-xl` / `display-lg` / `display-md` (fluid clamp, tight tracking) for
hero and section headings. Headings `tracking-tight`; mono labels uppercase at
~0.16em. Body never lighter than `zinc-400`.

**One exception:** the homepage hero headline uses **Fraunces** (serif,
`--font-fraunces`), scoped to that single headline — *not* the shared `font-display`
class. A site-wide serif change was tried and explicitly reverted. Do not widen it.

## Layout rhythm

Container `max-w-[75rem]` → `xl:max-w-[82.5rem]` → `2xl:max-w-[92.5rem]` (1200 /
1320 / 1480px at the default size), `px-5 sm:px-6 lg:px-8`.

**Sizes are rem, never px.** From 1920px up the root font size grows with the
screen (115% at 2560, 200% at 3840, so a 4K TV shows the 1920 layout full-screen).
A `text-[11px]` or `w-[240px]` does not grow, so on a TV it renders at half the size
of everything around it. Write `text-[0.6875rem]`, `w-[15rem]`. Hairlines (<= 2px),
borders, rings, blurs and shadows stay px. Breakpoints stay px (`min-[1366px]:`).
Not CSS `zoom`: it doubles every `100vh`/`100vw` element.

**A responsive grid declares its base column:** `grid grid-cols-1 sm:grid-cols-2`,
never `grid sm:grid-cols-2`. Without it, below `sm` the implicit column grows to its
widest content and pushes the page off a phone. On `/news` that cut off the top
story's bookmark button at 320px.

Both rules are enforced by `responsive-fit.test.ts`.
Section rhythm `py-14 sm:py-20 lg:py-24`; heading→content `mt-10 sm:mt-12`. 8pt
spacing. Cards `p-5 sm:p-8` (large) or `p-6` (standard).

Radius: pills/buttons `rounded-full`, inputs/tags `rounded-xl`, cards `rounded-3xl` /
`rounded-4xl`.

Shadows: `shadow-card`, `shadow-card-hover`, `shadow-btn`, `shadow-elevate`,
`shadow-gold` / `shadow-mint` for brand emphasis. **Avoid stacking many `blur-3xl`
orbs** — that is the main way this design drifts from restrained to cheap.

## Theming

Tailwind `darkMode: "class"`; **dark is the default** (`<html class="dark">`). A
no-FOUC inline script in `src/app/layout.tsx` applies the saved choice before paint;
`ThemeToggle.tsx` flips the class and persists `localStorage.theme`. Dark values are
pixel-identical to the original design — the light theme is a chrome-level baseline
refined per area.

## Practical rules

- Mobile-first, performance-first. Lazy-load heavy visuals.
- Server pages fetch and serialize (Dates → ISO), then pass to a `"use client"`
  component.
- One area per increment; typecheck + lint + test + build green before shipping.
- Adding a heavy visual or a new dependency is also a cost question — see the
  `cost-check` skill for the bundle-size blind spot.

## Related

- `docs/design-system.md` — full token tables, semantic token values, keyframe list.
- `docs/brand-guidelines.md` — brand architecture, sub-brands, voice and tone,
  official links. Brand *policy*; this is visual *implementation*. Note its copy
  rule: no em dashes in site body copy.
