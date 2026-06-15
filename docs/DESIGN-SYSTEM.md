# XYZ Crypto — Design System

The shared visual language. Brand identity (dark luxe, **gold + mint** on near-black)
is preserved; this layer makes it consistent, themeable, and premium. Introduced in
Phase 2 (foundation). Adopt these tokens incrementally — existing utilities keep working.

## Theming (light / dark)
- Strategy: Tailwind `darkMode: "class"`. **Dark is the default** (`<html class="dark">`).
- A no-FOUC inline script in `src/app/layout.tsx` applies the saved choice before paint.
- Toggle: `src/components/ThemeToggle.tsx` (in the navbar, desktop + mobile) — flips the
  `dark` class and persists `localStorage.theme`.
- **Dark values are unchanged** from the pre-Phase-2 design (pixel-identical). The light
  theme is a baseline at the chrome level; per-component light values are refined during
  the per-area passes.

## Semantic color tokens (CSS vars → Tailwind aliases)
Defined in `globals.css` (`:root` = light, `.dark` = dark). Use the Tailwind aliases:

| Token / class | Meaning | Dark | Light |
|---|---|---|---|
| `bg-base` (`--bg`) | page background | `#08080a` | `#f6f7f9` |
| `bg-surface` (`--surface`) | card / panel | `#0e0e12` | `#ffffff` |
| `bg-surface-2` (`--surface-2`) | nested / hover | `#15151b` | `#eef0f3` |
| `text-content` (`--content`) | primary text | `#d4d4d8` | `#1b1b22` |
| `text-content-muted` (`--content-muted`) | secondary text | `#a1a1aa` | `#5b5b66` |
| `border-hairline` (`--hairline`) | hairline border | `rgba(255,255,255,.08)` | `rgba(0,0,0,.10)` |

**Brand constants (do not theme-swap):** `gold-*`, `mint-*`, `ink-*`, `bg-gold-shine`,
`text-gold-gradient`, `text-mint-gradient`. These stay identical in both themes.

## Typography
Display ramp (in `tailwind.config.ts` `fontSize`): `text-display-xl` / `display-lg` /
`display-md` (fluid `clamp()` + tightened tracking). Body: `font-sans` (Geist);
code/labels: `mono` (Geist Mono). Use the display ramp for hero/section headings,
default sizes for body.

## Radius, elevation, motion
- Radius: Tailwind scale + `rounded-4xl` (2rem) for large premium cards.
- Elevation: `shadow-gold` / `shadow-mint` / `shadow-elevate` (glass depth).
- **Motion tokens:** `ease-premium` (`cubic-bezier(.22,1,.36,1)`), `ease-premium-in`;
  `duration-250` / `duration-400`. Pair with `Reveal`/framer-motion; **always honor
  `prefers-reduced-motion`**.

## Libraries (Phase 2)
- **framer-motion** — primary component/scroll animation (existing).
- **anime.js v4** — opt-in micro-interactions, lazy-loaded via `src/lib/anime.ts`
  (`loadAnime()` + `prefersReducedMotion()`); keep out of the initial bundle.
- **iconsax-react** — premium icon accents, used **additively** alongside the existing
  `lucide-react` set (no mass migration).
- **react-three-fiber** (next increment) — the orbital hero, **lazy + SSR-off** with the
  current CSS orbital as the instant fallback and on mobile/reduced-motion.

## Conventions
- Prefer semantic tokens (`bg-surface`, `text-content`) for new/refactored UI so it
  themes automatically; keep brand gradients explicit.
- Mobile-first; performance-first (lazy-load heavy visuals; budget bundle size).
- One area per increment; verify (typecheck/lint/test/build) before shipping.
