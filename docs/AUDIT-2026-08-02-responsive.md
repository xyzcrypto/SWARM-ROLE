# Responsive & Cross-Device Audit — 2026-08-02

**Commit audited:** `1ded4d3` (*Move functions to Mumbai, and remove the serial round trips (#210)*)
**Constraint:** the UI is approved and frozen. Design, layout, colours, components,
branding, animations and visual appearance must not change. The goal is
**consistent behaviour**, not a redesign.

**Method — measured, not eyeballed.** A production build (`next build && next start`)
was driven with a headless Chromium harness across **9 viewports × 18 pages**, plus a
dedicated editor-interaction pass. Dev mode is unusable for this on this project: the
CSP blocks `unsafe-eval` (which React needs in development) and the HMR socket does not
survive the proxy, so edits appear to do nothing.

To reach the auth-gated surfaces (dashboard, Publish editor, settings, journal) the
harness ran a **local Postgres 16** with the real Prisma schema pushed into it, a seeded
ADMIN user, and a genuine next-auth JWE session cookie minted with `next-auth/jwt`.
Without that the dashboard renders its error state and the editors are unreachable.

| Band | Viewports exercised |
|---|---|
| Mobile phones 320–480 | 320×568, 375×667, 430×932 |
| Large phones / tablets 481–1024 | 768×1024, 1024×768 |
| Laptops 1025–1440 | 1280×800, 1440×900 |
| Large desktop 1441+ | 1920×1080, 2560×1440 |

---

## Headline result

**The site was in far better shape than a request of this size implies.** Measured
across all 9 viewports and 18 pages, there were **zero** instances of:

- horizontal overflow (`document.scrollWidth > clientWidth`)
- nested scroll containers (a scroller inside a scroller)
- z-index conflicts (a fixed/sticky bar covered by another element)
- JavaScript errors
- unguarded `vh` units in inline styles

`/community` and `/messages` already use `h-[100svh]`, and the navbar sheet already uses
`max-h-[calc(100dvh-6rem)]` — the small/dynamic viewport units that handle mobile browser
chrome correctly. That work had already been done.

**Two real defects were found, one of them site-wide, and both are fixed.** Everything
else was either a deliberate design decision or an artifact of the test harness, and is
documented as such below rather than "fixed".

---

# FINDING 1 — 🔴 Mouse wheel did not scroll ANY inner container on desktop

**Severity: high. Site-wide, single root cause.**
`src/shared/components/SmoothScroll.tsx`

Lenis (the momentum smooth-scroll library) intercepts wheel events globally and scrolls
the page. It has an escape hatch for elements that scroll on their own —
`data-lenis-prevent` — and `globals.css` already styles that attribute:

```css
.lenis.lenis-smooth [data-lenis-prevent] { overscroll-behavior: contain; }
```

**The attribute was applied to exactly zero elements in the entire codebase.** So on
desktop, Lenis swallowed the wheel over every inner scroll container and moved the page
behind it instead.

### Measured, Publish editor filled with 40 paragraphs

| viewport | wheel over editor | page moved too? |
|---|---|---|
| 320×568 | scrollTop 300 ✅ | no |
| 375×667 | scrollTop 300 ✅ | no |
| 430×932 | scrollTop 300 ✅ | no |
| 768×1024 | scrollTop 300 ✅ | no |
| **1280×800** | **scrollTop 0 ❌ did not scroll** | **YES — page scrolled instead** |
| **1920×1080** | **scrollTop 0 ❌ did not scroll** | **YES — page scrolled instead** |

Phones were unaffected only because Lenis already opts out on coarse pointers
(`SmoothScroll.tsx:22`) — which is exactly why this never showed up in mobile testing.

**Blast radius:** the Publish rich-text editor, the News Briefing block, every textarea,
the chat message list, the mobile nav sheet — anything on the site with its own scrollbar,
for every desktop and laptop visitor.

### Fix

Lenis 1.3.25 accepts a `prevent(node)` predicate. Rather than annotating dozens of
containers by hand — which a container added next month would silently miss — the
predicate detects scrollability directly:

```ts
prevent: (node) => {
  if (!node || node.nodeType !== 1) return false;
  if (node.hasAttribute?.("data-lenis-prevent")) return true;
  if (node.scrollHeight <= node.clientHeight) return false;   // can't consume it
  const overflowY = getComputedStyle(node).overflowY;
  return overflowY === "auto" || overflowY === "scroll";
}
```

`data-lenis-prevent` is still honoured for anything needing an explicit opt-out.

### Verified after the fix

Every viewport now reports `wheel → scrollTop 300 OK` and `scroll chained to page: no
(contained)`. **No layout or visual effect** — this only changes which element consumes a
wheel event.

---

# FINDING 2 — 🟠 The Publish editor was a fixed 416px on every device

**Severity: medium. Mobile only.**
`src/modules/community/components/PostContentEditor.tsx`

The rich-text container was `h-[26rem]` — a hard 416px regardless of screen. On a
320×568 phone that is **73% of the entire screen for one form field**, and its bottom sat
133px below the fold, so you had to scroll the page to see the box you were already
scrolling inside.

### Fix

`h-[26rem]` → `h-[min(26rem,62svh)]`

- `min()` keeps the **approved desktop size exactly**: 26rem wins whenever 62svh is
  larger, i.e. on every viewport taller than ~671px.
- `svh` (small viewport height), not `vh`: `svh` is the space left when mobile browser
  chrome is showing. `vh` would size against the tallest possible viewport and push the
  bottom of the box under the address bar — on precisely the phones this helps.

### Measured before → after

| viewport | before | after | visual change? |
|---|---|---|---|
| 320×568 | 416px | **352px** | yes — intended, it now fits |
| 375×667 | 416px | **414px** | 2px |
| 430×932 | 416px | **416px** | **none** |
| 768×1024 | 416px | **416px** | **none** |
| 1280×800 | 416px | **416px** | **none** |
| 1920×1080 | 416px | **416px** | **none** |

Only short screens change. Every laptop and desktop is pixel-identical.

---

# FINDING 3 — 🟡 Undersized tap targets

19 unique interactive elements measured under 28px on touch viewports (WCAG 2.5.8 and
the iOS HIG ask for ~44px). Smallest: the `1D` / `7D` / `1M` chart range buttons at
**23×18px**.

**The naive fix — padding or `min-height` — changes how the control looks, which the
freeze forbids.** So the hit area is grown with a transparent pseudo-element instead. The
element's own box, padding, font size and position are untouched; only the region that
responds to a finger changes.

```css
.tap-target-y::after  { content: ""; position: absolute; inset: -9px 0; }  /* vertical only */
.tap-target-all::after{ content: ""; position: absolute; inset: -8px;   }  /* both axes */
```

**Axis choice matters.** Two controls a few px apart, both expanding toward each other,
end up with overlapping hit areas and the one later in the DOM silently wins — a worse
bug than the small target. The chart range pills sit 2px apart, so they get `-y` only.

### Verified by hit-testing (not by measuring the box — the box deliberately does not change)

| element | visual height | effective hit area |
|---|---|---|
| `1D` chart range | 18px (unchanged) | **35px** |
| `7D` chart range | 18px (unchanged) | **35px** |
| `Forgot password?` | 16px (unchanged) | **31px** |
| `Create an account` | 18px (unchanged) | **34px** |
| `Back to login` | 18px (unchanged) | **34px** |
| `← Back to home` | 16px (unchanged) | **32px** |

### Deliberately NOT changed

The remaining undersized elements are **inline links inside sentences** —
`shorttechinfo@gmail.com`, `Contact page`, `Privacy Policy`, `Terms of Service` in the
legal copy, `Hyperliquid docs ↗` inside its explanatory banner. **WCAG 2.5.8 explicitly
exempts these** ("Inline: the target is in a sentence or block of text"), and expanding
them vertically would overlap the lines of text above and below, stealing taps from
neighbouring words. Leaving them is the correct reading, not an omission.

---

# NOT DEFECTS — investigated and dismissed

Recording these so the next audit does not re-raise them.

### `CLIPPED` on `/` — deliberate masking, at every viewport
The harness flags elements whose content exceeds their box while `overflow` is hidden.
On the homepage these are `.vscroll-mask` (the ticker strip) and `.starfield` (the
decorative star layer). `.vscroll-mask` is a `mask-image` gradient that fades the strip
at top and bottom — the clipping *is* the effect. `.starfield` is a full-bleed decorative
layer. Both correct as-is.

### `/profile` returned HTTP 500 at every viewport — test harness, not the site
Caused by `NEXTAUTH_SECRET` being unset in the audit environment
(`[next-auth][error][NO_SECRET]`). With the secret set, `/profile` returns **307** and
redirects to login, which is the intended behaviour. Not a site bug — and worth noting
because it looked like a 9× reproduced production fault.

### Touch-swipe reported `scrollTop 0`
Synthetic `TouchEvent`s do not drive Chromium's compositor, so the harness cannot
actually produce a touch scroll. This is a limitation of the measurement, **not evidence
of a bug**: the containers use `overflow-y: auto` with `overscroll-contain`, and Lenis is
already disabled on coarse pointers, so touch scrolling is native. Flagged rather than
silently reported as passing.

### `min-h-screen` on ~25 page shells
`min-height: 100vh` as a *minimum* on a page-level container is benign — it cannot clip
content and does not create a scroll trap. Replacing it with `svh`/`dvh` across 25 files
would be churn against a frozen design for no measured behaviour change.

---

# Files modified

| File | Change | Why |
|---|---|---|
| `src/shared/components/SmoothScroll.tsx` | added Lenis `prevent()` predicate | Finding 1 — wheel over any inner scroller scrolled the page instead |
| `src/modules/community/components/PostContentEditor.tsx` | `h-[26rem]` → `h-[min(26rem,62svh)]` | Finding 2 — 416px was 73% of a small phone screen |
| `src/app/globals.css` | added `.tap-target-y` / `.tap-target-all` | Finding 3 — grow hit area with zero visual change |
| `src/modules/markets/components/PerpChart.tsx` | `tap-target-y` on range buttons | 23×18px, the smallest targets on the site |
| `src/modules/auth/components/LoginForm.tsx` | `tap-target-all` on 2 links | standalone links at 16–18px |
| `src/modules/auth/components/SignupForm.tsx` | `tap-target-all` on 1 link | standalone link at 18px |
| `src/modules/auth/components/ForgotPasswordForm.tsx` | `tap-target-all` on 1 link | standalone link at 18px |
| `src/modules/auth/components/AuthShell.tsx` | `tap-target-all` on 1 link | standalone link at 16px |
| `src/shared/components/Footer.tsx` | `tap-target-y` on Terms/Privacy | 33×17 and 46×17 in the bottom bar |

**No file changes design tokens, colours, spacing scales, typography, component structure
or animation.** The only rendered-geometry change anywhere is the Publish editor height,
and only on viewports shorter than ~671px.

---

# Editor behaviour — final state, all viewports

Publish editor loaded with 40 paragraphs (3924px of content in a 352–416px box):

| check | 320 | 375 | 430 | 768 | 1280 | 1920 |
|---|---|---|---|---|---|---|
| mouse wheel scrolls it | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| keyboard (Ctrl+End) scrolls it | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| caret stays visible after jump | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| reaches the bottom of content | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| never locks / never clips | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| scroll stays contained (no chaining) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| box fits within the viewport | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Touch scrolling is native (`overflow-y: auto`, Lenis disabled on coarse pointers) but
could not be driven by the harness — see the note above.

---

# What still cannot be verified from here

Stated plainly rather than implied as covered:

1. **Real iOS Safari and real Android Chrome.** Everything above is headless Chromium
   with device emulation. Emulation does not reproduce iOS Safari's address-bar resize
   behaviour, `-webkit-overflow-scrolling` momentum, or Safari's `svh` support
   differences. The `svh` choice in Finding 2 is specifically aimed at that gap.
2. **Real touch scrolling** — see above.
3. **The live site.** Outbound egress to xyzcrypto.io is blocked from this environment
   (403 on CONNECT), so every measurement here is against a local production build.
