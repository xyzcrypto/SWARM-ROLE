# Brand assets — the 3D coin logo

## What is here

`logo-3d-master.png` — 1024×1024, RGBA, transparent background. The **reusable
source** for the 3D gold coin. Cropped to the coin's true bounding box and
re-centred with an even 6% margin, so it drops into a square frame without
sitting high. Not served: `docs/` is not `public/`, so this file is an archive,
not a route.

## Where the coin is used today (2026-08-21)

**Only the installed app's identity.** The website is deliberately on the
original `/public/logo.png` everywhere — navbar, footer, hero, homepage orbital
core, login page, loaders, offline page, favicon, share cards, JSON-LD.

| File | Slot | Why it is its own file |
|---|---|---|
| `public/logo-app.png` (512, transparent, coin 94%) | manifest `purpose: "any"` | Android centres it on `background_color` for the app-open splash, so transparency is correct |
| `public/logo-app-192.png` (192, transparent) | manifest `purpose: "any"` | the recommended 192 slot |
| `public/logo-app-maskable.png` (512, **opaque**, coin 70%) | manifest `purpose: "maskable"` | adaptive icons are cropped to a circle/squircle and only the centre **80%** is guaranteed; a full-bleed coin loses its gold rim. Must be opaque — a maskable icon fills edge to edge |
| `public/logo-app-apple.png` (180, **opaque**, coin 86%) | `apple-touch-icon` in `layout.tsx` | iOS renders transparency as **black** and applies its own rounded-rect mask |

Wired up in `src/app/manifest.ts` (`icons`) and `src/app/layout.tsx`
(`metadata.icons.apple`).

---

## If you roll it out site-wide later

This was attempted once and reverted on request, so the traps below are measured,
not theoretical. Read them before starting.

### ⚠️ Trap 1 — do not use a Telegram-emoji export

The 512px "XYZ Crypto Telegram Emoji" export has the coin's **dark face punched
out of the alpha channel**:

| file | centre alpha | result |
|---|---|---|
| 512px emoji export | min **0**, mean 152 | every dark surface shows straight through the coin |
| this master | min **252** | solid |

Shipped once. On the homepage the green mesh made the coin read as a green hole,
on mobile and desktop both. Always start from `logo-3d-master.png` and verify:

```python
from PIL import Image
im = Image.open("public/logo.png").convert("RGBA"); w, h = im.size; px = im.load()
print(min(px[w//2+dx, h//2+dy][3]
          for dy in range(-h//10, h//10, 4) for dx in range(-w//10, w//10, 4)))
# must be ~255. A 0 here means the coin face is see-through.
```

### ⚠️ Trap 2 — the coin has its own gold rim

Every site logo site wraps it in a frame that fights the artwork:

```
rounded-full / rounded-lg / rounded-xl  → clips the coin's outer rim
ring-1 / ring-2 ring-gold-500/40        → a second gold ring on top of its own
object-cover                            → crops instead of fitting
```

Replace with `object-contain`, drop the ring and the rounded clip, and express
the glow as `drop-shadow-[...]` (which follows the alpha) rather than
`shadow-gold` / `box-shadow` (which casts a rectangle behind a circular logo).
Since the artwork no longer bleeds to the frame edge, size each site up ~10%.

Sites to change (`grep -rn 'logo\.png' src/ public/`):

- `src/shared/components/Navbar.tsx`
- `src/shared/components/Footer.tsx`
- `src/shared/components/BrandLoader.tsx` — route + mobile loading screen
- `src/modules/auth/components/AuthShell.tsx` — login/signup
- `src/modules/notifications/components/PwaSetup.tsx` — install prompt
- `src/components/Hero.tsx`
- `src/components/OrbitalEcosystem.tsx` — the homepage core
  <br>(the three.js sprite in `EcosystemCore.tsx` was here too; that scene was
  deleted in #305 — it had been unreachable behind a `false` gate, and its
  856 KB chunk was the largest in the bundle)
- `public/offline.html` — `box-shadow` → `filter: drop-shadow(...)`
- `src/shared/utils/seo-schema.ts` — JSON-LD `width`/`height` (4 spots)

### ⚠️ Trap 3 — bump the service worker cache

`public/sw.js` precaches `/logo.png` at a URL that does **not** change when the
artwork does:

```js
const PRECACHE = [OFFLINE_URL, "/logo.png"];
```

`activate` deletes every cache whose name is not the current `CACHE`, so bumping
`CACHE` is the only thing that evicts a stale logo. Without it, every returning
visitor and every installed PWA keeps serving the old logo **indefinitely** and
never sees the change.

This is the one legitimate reason to bump it — an eviction because a precached
URL's *content* changed. It is not the retired bump-on-every-deploy ritual (see
CLAUDE.md; navigations are no longer cached).

### Also

- Check `src/app/opengraph-image.tsx` and
  `src/app/tools/share/points-value/[id]/card/route.tsx` — share cards draw the
  logo themselves.
- The favicon (`metadata.icons.icon`) is separate from the apple-touch-icon.
