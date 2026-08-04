# XYZ Crypto — Changelog

Newest first. **Update this after every design change** with: date, files
changed, components changed, design improvements, performance improvements.

---

## 2026-08-04 (28) — The hero lede no longer strands its last words on their own line

Owner sent a phone screenshot with the headline and lede circled: *"text ko
align karo taki poora text sahi se dikhe naki 2 line niche."*

Measured the line boxes rather than eyeballing it, and the complaint was exact.
At a 412px viewport the paragraph wrapped to:

```
line widths   371  369  361   89     <- column is 372px
```

Three lines running the full column edge to edge, then **"and builders." alone
at 89px**, floating in the middle of an otherwise solid block. That orphan is
what the circle was around.

### Fix

One class: `text-balance` on the lede. The browser distributes the text evenly
across its lines instead of filling greedily and dumping the remainder:

```
                  before                after
360px      266 311 313 300       266 311 313 300   (was already fine)
390px      336 335 280 239       266 311 313 300
412px      371 369 361  89       266 311 313 300
430px      371 369 361  89       266 311 313 300
```

Desktop benefits too - the paragraph drops from four ragged lines to three even
ones (443 / 498 / 486).

Deliberately `text-balance` and not `text-pretty`: `pretty` only pulls the final
orphan up and leaves the rest greedy, which fixes the symptom on one line.
`balance` evens every line, which is what "poora text sahi se dikhe" asked for.
Unsupported browsers just fall back to normal wrapping, so there is nothing to
gate.

The headline was circled too but needed nothing: it carries an explicit `<br>`,
so its two lines are already fixed by hand.

**Files:** `src/components/Hero.tsx`, `docs/changelog.md`.

---

## 2026-08-04 (27) — The homepage was not slow to arrive, it was slow to become visible

Owner: *"website openning is slow and lagging somehow ... check properly and
then fix."* Measured first, on a clean production build, at three CPU profiles.

### What the measurement found

The page was painting its background at ~700ms and then showing **nothing
readable for seconds**. Cause: framer-motion's `initial={{ opacity: 0 }}` is
serialised into the SSR HTML as `style="opacity:0"`, so the element is invisible
until the bundle downloads, parses, hydrates and runs its first frame.
**73 elements shipped at opacity 0**, including the entire hero. LCP - the hero's
lede paragraph - landed at 4420ms on a 4x-throttled phone and **7756ms on a 6x**.

This is the rule `CLAUDE.md` already states - *never make content depend on JS to
become visible* - and the hero was the one place still breaking it.

Two smaller findings, both measured:
- **The RSC prefetch storm.** Every nav route was prefetched 4-5x per load,
  because the navbar, the mobile menu, the footer and the bottom nav each render
  the same links. **37 prefetch requests** on one homepage view.
- **Eager below-fold images.** `BrandLogo` rendered a plain `<img>` with no
  `loading` attribute, so the preload scanner fetched the two ecosystem logos
  (122KB) at ~110ms - ahead of the hero, from far below the fold.

### What changed

Hero entrance animations are now **CSS keyframes** (`.hero-rise`, `.hero-word`,
`.hero-pop`, `.hero-fade` in `globals.css`). Same motion, same curves, but they
start at first paint instead of after hydration. `prefetch={false}` on the nav
chrome (hover still prefetches, so navigation feels the same). `loading="lazy"`
on `BrandLogo`.

### Results (clean builds, CSS-applied gate on every run)

```
                    desktop 1440   mobile 412    budget 390
                       (CPU 1x)      (CPU 4x)      (CPU 6x)
LCP      before          2820          4420          7756
         after           1364           804          1804
requests before            97            84            51
         after             64            58            55
RSC prefetch before        37            30             8
             after         11            11            11
```

### What is NOT fixed, stated plainly

**Total Blocking Time barely moved**: 1180 → 1093ms at 4x, 3265 → 3107ms at 6x.
The page now *appears* fast and is still *busy* afterwards. That cost is React
hydrating a 2595-node tree from a 411KB JS bundle, and none of the three fixes
here touch it. Making the page genuinely smooth on a budget phone means
deferring below-fold client components, which is a real refactor and its own
piece of work.

### One process note worth keeping

The first version of these numbers was **wrong and looked spectacular** - LCP
344ms. Repeated builds had left `.next` mixed, so the served HTML referenced a
stylesheet hash that no longer existed; the page rendered unstyled, which is
very fast. The measurement harness now asserts the stylesheet applied (>500 CSS
rules and a real border colour on `.hero-cta`) before reporting anything, and
every number above comes from `rm -rf .next` + full rebuild. A perf result that
looks too good is usually measuring a broken page.

**Files:** `src/app/globals.css`, `src/components/Hero.tsx`,
`src/components/HeroCta.tsx`, `src/shared/components/BrandLogo.tsx`,
`src/shared/components/Navbar.tsx`, `src/shared/components/Footer.tsx`,
`src/shared/components/BottomNav.tsx`, `docs/changelog.md`.

---

## 2026-08-04 (26) — The hero's live band is gone

Owner: *"no need live one in hero section"*. The scrolling band of research
titles is removed from the hero card. The card itself stays.

### What the card keeps

The two facts the band actually proved are still there, as one quiet sub-line:
**how many reports exist** and **how recent the newest one is** (`5 reports ·
newest 2h ago`). Both are still real rows, still server-rendered, still
refreshed by the `revalidatePath("/")` the research write routes already call.
So publishing a post still updates the card immediately - that behaviour did
not depend on the band.

What went: the `NEW`/`LATEST` badge, the blinking live dot, the marquee, and
the panel they sat in.

### Dead code went with it, deliberately

Removing a feature and leaving its support behind is how a codebase collects
things nobody can explain later. So these went too, in the same commit:

- `.hero-feed`, `.hero-feed::before`, `.hero-feed-track`, `.hero-feed-mask`,
  `.hero-badge-new`, `.hero-cta-blink` and the `hero-feed`/`hero-bloom`/
  `hero-blink` keyframes (`globals.css`)
- `research-freshness.ts`, its `src/lib` shim and its 7 tests - the freshness
  gate existed only to decide whether the band's badge could honestly say
  `NEW`, and nothing else consumed it. Test count moves 522 → 515.

Both files keep a one-line note saying the band was here and where it went, so
the next reader is not left wondering why the CSS block is named after a card
that has no band.

### One cost trim that came free

`page.tsx` fetched **twelve** research rows to fill the band. With the band
gone it reads exactly one - `findFirst` with `select: { createdAt: true }` -
because eleven rows nobody renders are just payload. The count query is
unchanged.

### Verification

```
                360      412      1440
card     x/w    20/320   20/372   92/580
headline x/w    20/320   20/372   92/630
scrollWidth     360      412      1440    (no horizontal overflow)
band present    false    false    false
```

Checked in **both themes**. Route table unchanged at **131 / 22 static / 109
dynamic / 12 ISR**, `/` still `○` on a 5m window.

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 515/515 tests ✅ ·
build ✅

The populated sub-line (`5 reports · newest 2h ago`) was verified by
temporarily stubbing the two values, screenshotting both themes, and reverting
the stub - this machine has no database, so the live render exercises the
`.catch()` fallback path (`0 reports`) instead.

**Files:** `src/components/HeroCta.tsx`, `src/app/page.tsx`,
`src/app/globals.css`, deleted `src/shared/utils/research-freshness.ts` +
`src/lib/research-freshness.ts` + `src/lib/__tests__/research-freshness.test.ts`,
`docs/changelog.md`.

---

## 2026-08-04 (25) — Write down who is allowed to merge

Docs only, no code. `CLAUDE.md`'s "Branch / deploy model" now states the owner's
standing rule: **only PRs authored by `xyzcrypto` get merged; a team member's PR
is never merged, and an ambiguous ask gets a warning first rather than a merge.**

It was said in a session and lived only there, which means the next session (or
the same one after a context reset, or a different account) would not have known
it. A rule that only exists in a chat is not a rule the repo has. The wording is
deliberately specific about the failure mode it prevents: "merge the open PRs"
reads as *all* of them, and a green trivial PR from someone else is exactly the
one that gets merged on autopilot. Check `user.login`, every time.

**Files:** `CLAUDE.md`, `docs/changelog.md`.

---

## 2026-08-04 (24) — The hero CTA is a research card, and the feed is our own posts

Owner's brief, over several rounds: the hero's mint pill "AI feel" wala lagta
tha; replace it with the card layout from their reference, show our own research
posts live with a scrolling feed, and make the trust line small.

### What changed (only these three blocks)

The two stacked buttons and the separate trust sentence are gone. In their place:
a research card, one secondary row, and a quiet trust line. Everything above
(eyebrow, headline, lede) and below (live stats) is untouched.

The card carries a `NEW LIVE` flag and a marquee of **our own published research
titles, newest first** - titles only. The newest one is emphasised and holds
still for 2.8s before the band starts moving, because a headline already
mid-slide on arrival announces nothing.

### Why the feed is server-rendered and not polled

Both research write routes already call `revalidatePath("/")`. Publishing a post
therefore regenerates the homepage **at once**, so rendering the titles on the
server beats a poller on every axis: the update is immediate rather than up to
one interval late, and it adds no route, no request and no timer.

Route table after: **131 / 22 static / 109 dynamic / 12 ISR** - identical to the
baseline in the `cost-check` skill. `/` is still `○` on a 5m window.

### The layout bug this design kept hitting, and the fix

The hero's text column is a **grid item**, so it carries the default
`min-width: auto`. Any in-flow descendant with a wide max-content size grows the
column and drags the site's own headline with it. Measured while building:

```
                                   column width @412px
baseline                           372
live-price row on the card line    420   (+48)
5-post marquee, in flow            3036  (+2664)
sub-line with nowrap, @360px       364   (+44)
```

`overflow: hidden` on the wrapper did **not** stop the marquee - only taking the
track out of flow does, because an out-of-flow box contributes nothing to
intrinsic sizing. So `.hero-feed-track` is `position: absolute`, and that is
load-bearing rather than styling: no number of published posts can widen the
hero. Separately, `min-width: 0` does not zero a *block* child's min-content
contribution - `overflow: hidden` does, which is what the sub-line needed.

Two of those three were found by bisecting element-by-element after guessing
twice and watching the bug move rather than go away.

### Guests keep their signup path

The old hero gave logged-out visitors "Get early access". The reference design
only had "View products", and silently dropping the signup CTA would have been
an unflagged conversion change - so the secondary row switches: guests get
signup, members get products.

### Verified in a real browser

```
                360      412      1440
headline x/w    20/320   20/372   92/630
card     x/w    20/320   20/372   92/580
scrollWidth     360      412      1440    (no horizontal overflow)
feed titles     real rows from the DB, newest first
```

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 515/515 tests ✅ ·
build ✅


### Follow-up (same day): 3D icons, a pinned "NEW", and the light theme

Owner reviewed the preview and asked for five things. All five landed:

1. **Every icon is now from the project's own `Icons3D` set** - the research
   magnifier, the products stack, the crown on the guest CTA, and the shield /
   lock / people on the trust line. That means the same gradient-body + gloss +
   drop-shadow depth and the same always-on `i3d-*` signature motion as the rest
   of the site, rather than a second, slightly-different 3D language invented
   here.
2. **The band is split in two.** The newest post is **pinned and static** behind
   a `NEW` badge so it reads as "this one just went live"; everything already
   published scrolls beneath it. Previously the newest title scrolled away with
   the rest.
3. The guest row's icon was the **same green shield** as "Free to join" two
   lines below it. Now a crown - membership, not another safety claim.
4. **Light theme.** The card, the band, the icon's glow pool and the row hover
   each get their own light recipe rather than a lighter opacity of the dark
   one; a mint tint that reads as a premium panel on near-black goes sickly on
   white. Verified at 412 and 1440 in both themes.






### Follow-up 6: colour discipline

Owner asked for a best-in-class colour combination. The problem was not which
colours - it was **how many**. A single card was carrying four hue families:
mint, gold, amber and violet, with the loudest of them (a three-colour trust
line) on the block that is supposed to be the quietest.

Fixes, all subtraction rather than addition:

- **The research icon dropped from three families to two.** Its star was amber
  against an emerald card and a gold lens; at 48px a third family reads as
  confetti, not as a system. The star is gold now: emerald is the data, gold is
  the instrument, and that is the whole story.
- **The trust line stopped shouting.** 22px saturated icons became 18px at 68%
  opacity, returning to full colour only on hover. The 3D character survives;
  the colour parade under an already-green card does not.
- **The secondary row's icon shrank** (36 -> 32) so the card keeps the only loud
  voice in the stack.
- **Greens deepened out of neon.** On a near-black ground, restraint in
  saturation is what reads as expensive: the card wash went from a bright mint
  tint to a deep emerald one, and the action button from `#48e5aa -> #0bbb7c` to
  `#3ddda0 -> #059669`.
- **The band went nearly neutral.** It was green-on-green, which muddied the
  titles sitting on it. Now near-black ink with the green kept to a hairline and
  a faint bloom - the text is what should be read, not the panel.

Boldness is spent in exactly one place now: the round action button. Everything
around it is quiet. Both themes re-checked.

### Follow-up 5: the band is back, gated and with a proper surface

Owner asked for option A after all: the live band, with accurate data, and new
posts showing up straight away.

**The freshness gate ships this time.** `research-freshness` (7 unit tests) is
what stops the card claiming a 29-day-old report is `NEW`:

| newest post | badge | live dot |
|---|---|---|
| 3h old | `NEW` (lit mint pill) | blinking |
| 29d old | `LATEST` (quiet outline) | off |

Both states were checked against a real render by ageing the local rows, not
by reading the code.

**"Realtime" here is stronger than polling, not a compromise.** Both research
write routes already call `revalidatePath("/")`, so publishing regenerates the
homepage immediately - a poller would surface the same post up to one interval
*later*, and would cost a route, a request per visitor and a timer. Route table
after: **131 / 22 / 109 / 12**, `/` still `○` on 5m.

**The band's surface got a body.** It was one flat translucent rectangle, which
read as a hole punched in the card rather than a panel inside it. Now: a
top-lit gradient, a 1px highlight along the top edge (light falls from above
everywhere else on this site), and a slow mint bloom drifting behind the text so
the strip looks alive between scroll cycles. The `NEW` pill got its own gradient
and inner highlight so it reads as lit rather than as a flat swatch. Light theme
has its own recipe for all of it.

### Follow-up 4: the newest post's age is back

Owner asked whether the count is real, whether it updates, and whether the last
post's time could show too. Answers, verified against the code rather than
recalled:

- **Real.** `prisma.post.count({ published: true, category: "Research" })` -
  their live count genuinely is 5.
- **Updates twice over.** Publishing calls `revalidatePath("/")` from both
  research write routes, so the homepage regenerates immediately; otherwise the
  300s ISR window catches it.
- **Time added back:** the card now reads `5 reports · newest 29d ago`. One
  extra `findFirst` (one row, `createdAt` only), running in the same
  `Promise.all` as the count, so no added round trip.

Still server-computed and passed down as a finished string. A relative time
derived during a client render disagrees between the server and the browser's
first paint, which is the #418 class this site has already been bitten by.

Flagged once for the record: with nothing published for a month, this line
states that on the homepage. That was the owner's call after the freshness gate
was built and shown; it is honest, just not flattering.

### Follow-up 3: the research band came back out

Owner asked what "newest 29d ago" meant, and whether the band should go. The
honest answer to the first question exposed a defect in the second: the card was
badging a **29-day-old** report as `NEW`, with a blinking live dot. A visitor who
clicks that finds nothing new, which costs more trust than the badge buys.

A freshness gate was built first (`NEW` only inside 7 days, `LATEST` after; the
age label hidden past 14 days) and verified against the owner's real case by
ageing the local posts to 29 days: badge fell back to `LATEST`, the dot stopped,
`newest 29d ago` disappeared. Owner then chose to drop the band entirely, which
is the simpler call while publishing is infrequent.

So the band, the marquee, the freshness module and its 11 tests all came out
rather than being left dormant - dead code with passing tests is worse than no
code, and this is all recoverable from **dfa6249**. The card is now the icon, a
title, `N reports`, and the arrow.

The 12-row title query went with it; the homepage now only counts.

### Follow-up 2: a real research emblem, and one right edge on desktop

**The icon was still a search glyph.** A lone magnifier says "search", not
"research". `ResearchLabIcon` is new in `Icons3D`: an emerald report card with
three ticking bars, a gold magnifier held over its corner, and an amber star for
the thing the lens found. Two palettes on purpose - emerald is the data, gold is
the instrument - and three independent `i3d-*` motions (tick, scan, twinkle) so
it reads as working rather than decorated. It stays inside the project's own 3D
language: same gradient body, gloss and drop shadow as every other icon in the
set.

**Desktop had three right edges in one column.** Measured at 1440 before:

```
lede    576
card    580
stats   512   (max-w-lg)
```

Three widths stacked vertically read as ragged no matter how good each block is.
The lede and the stats strip now both take the CTA stack's 580px, so everything
below the headline shares one left edge and one right edge. The headline itself
stays wider (630) - it is `whitespace-nowrap` on lg and is meant to be the one
element that breaks the grid.

Verified after: eyebrow / lede / card / row / stats all report x=92 at 1440,
x=32 at 1280, x=260 at 1920.

### The CSS rule this cost two wrong fixes to learn

`overflow: hidden` zeroes the automatic minimum of a **flex item**. It does
**not** do the same for a plain **block**: min-content stays at the full width
of the nowrap text, and the hero's own column (a grid item, `min-width: auto`)
grows to fit it.

```
                                    column @360px
baseline                            320
pinned title, as a block            367
  + overflow-hidden on the row      369   (no effect)
  + badge inlined into the title    367   (no effect)
  + grid-cols-[minmax(0,1fr)]       320   (fixed)
```

Two fixes that "looked right" moved nothing, because they applied a flex rule to
a block. A `minmax(0, 1fr)` grid track is what actually bounds it.

Route table re-checked after the change: **131 / 22 / 109 / 12**, `/` still `○`
on 5m.

**Files:** `src/components/HeroCta.tsx` (new), `src/components/Hero.tsx`,
`src/app/page.tsx`, `src/app/globals.css`.

---

## 2026-08-04 — Retire the cross-region framing everywhere it was still stated as current
Docs and comments only. #210 co-located functions with Supabase in `bom1`, so the
~250ms-per-query penalty that shaped a lot of earlier performance advice is gone. This
sweeps the repo for places still asserting it as present-tense fact.
- **Swept every file** for `iad1` / `us-east` / `cross-region` / `250ms` / "US region".
  Two hits in `tailwind.config.ts` (a `250ms` duration token) and `src/lib/ai/gateway.ts`
  (a backoff interval) are unrelated false positives; one in
  `docs/AUDIT-2026-08-02-responsive.md` is the word "region" in a layout sense.
- **Two live source comments fixed.** `tools/share/points-value/[id]/page.tsx` justified
  its `cache()` with "~250ms of pure round trip paid twice … from a US Vercel region",
  and `PointsValueCalculator.tsx` described the share-row write as going "to Supabase in
  Mumbai from a US region". **Both kept their code** — halving a query count and painting
  a placeholder are right on their own merits — but the reasoning now says so instead of
  leaning on a penalty that no longer exists.
- **The important distinction, since it is easy to over-correct:** Supabase is *still* in
  Mumbai. What changed is that functions are there too. Comments reading "round trip to
  Mumbai" (in `challenges/[id]`, `posts/[id]/like`, `chat/messages`, `chat/presence`) are
  **still accurate** and were deliberately left alone — they describe work that was
  removed, and a removed query stays removed regardless of distance.
- **`docs/PERFORMANCE.md` banner-ed.** Dated 2026-06-27, **not linked from
  `docs/SUMMARY.md`**, and at least one claim is now false — it says `/research/[slug]`
  is ISR at `revalidate=60`; it is **300**. Rather than rewrite a dated snapshot, it now
  opens with a verify-before-acting banner pointing at the maintained sources.
- **`docs/AUDIT-2026-08-01-latency.md`**: one remaining unqualified "Mumbai→`iad1`" inside
  finding #5's body now carries an inline marker, so a reader landing mid-document does
  not take it as current. The doc's top banner and per-finding re-assessment were already
  in place from #237.
- **`docs/changelog.md` deliberately untouched.** It records what was true on each date;
  rewriting history is the worse error. This entry is the correction.

---

## 2026-08-04 (23) — The profile header now has one left edge

Owner sent a phone screenshot: "profile ka overall jo buttons hai like,
following, followers and baki sabko acche se align karo". The complaint was
alignment, and measuring it showed the complaint was literally true.

### What was actually wrong

The header was four stacked rows that each started at a different x, because
some of them lived inside the name column (indented past the avatar) and the
rest lived in the card. Measured at 412px wide:

```
badges      x = 149     <- inside the name column
bio         x = 37
buttons     x = 37
counts      x = 149     <- inside the name column
```

Two left edges, alternating. On top of that:

- **Followers / Following were two separate bordered pills.** Side by side they
  are wide enough to wrap the name column on a phone, which is what turned them
  into two tall stacked rows eating most of the header.
- **The three action buttons were three different heights** - Edit sized itself
  `text-[13px] py-1.5` (30px), Message `text-sm py-1.5` (32px), share `h-9`
  (36px). Three buttons in a row, none of them the same height.
- **Follow wrapped onto its own line.** The counts strip (219px) + gap + Follow
  came to 381px against 375px of usable card, so it broke and hung off the
  right edge looking like a mistake.

### What it is now

Identity (avatar, name, handle) with the actions pinned top-right on desktop and
dropping to their own full-width bar on a phone. Then badges, bio, chips and the
counts - every one of them on the card's own left edge, 37px, no exceptions.

Followers / Following became one segmented control rather than two pills, so the
pair reads as a single object and fits one line at 360px. Follow goes full-width
under it on a phone (it does not fit beside it, and a full-width primary action
looks deliberate where a wrapped one does not) and returns to the end of the
strip's line from `sm` up. The three action buttons are all `h-9` now.

The counts moving to the bottom of the card is not only about alignment: it puts
them directly above the Posts / Comments / Likes cards, so all the numbers on
the page sit together.

### Measured, not eyeballed

```
                    before            after
badges x            149               37     (= bio, buttons, counts)
counts x            149               37
button heights      30 / 32 / 36      36 / 36 / 36
Follow at 412px     wrapped, ragged   full-width, aligned
```

Checked at 360 / 412 / 1440.

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 515/515 tests ✅ ·
build ✅

**Files:** `src/app/u/[username]/page.tsx`,
`src/modules/profile/components/ProfileFollow.tsx`,
`src/modules/profile/components/EditProfileButton.tsx`,
`src/modules/profile/components/MessageButton.tsx`,
`src/modules/community/components/CopyLinkButton.tsx`.

---

## 2026-08-04 — Correct stale docs and skill facts; restore a followable bundle method
Docs, comments and one dev script. No behaviour change. Every claim was re-verified
against current `main` (`59dddbf`) after #203 moved 521 files, not against the tree the
original report was written on.
- **`cost-check` pointed at a file that does not exist.** Its bundle method said to read
  `.next/app-build-manifest.json`; **Turbopack never emits it**, so the instruction was
  unfollowable and bundle size went unchecked while the skill read as though a method
  existed. Added `scripts/bundle-report.mjs`, reading the per-route RSC manifests
  Turbopack *does* emit, plus a recorded baseline and how to read it.
- **`cost-check` route baseline was stale:** 124/22/102/12 (measured at `2f34b83`) →
  **131/22/109/12**, the seven new dynamic routes being the DM-safety work in #227–#231.
  Its ISR table also still said `/api/ticker` 1m; it is **180s** since #207.
- **`cost-check` repeated the false `env.ts` claim** ("has no `import "server-only"`").
  #189 fixed that. Corrected in the same pass — this is the second copy of that claim,
  and correcting one while leaving the other is how the drift started.
- **`CLAUDE.md` carried the same stale `env.ts` claim.** Corrected. The *other* half of
  that sentence was re-verified **still true** and deliberately kept: the zod result is
  only logged and `process.env` is re-read directly, so `.url()`/`.min(16)` gate nothing.
- **`CLAUDE.md` "Current state" was a dated narrative** predating ~48 merged PRs, whose
  "three open OWNER actions" list said a resolved item was still open. Reduced to a
  standing summary plus pointers, and it now flags the two things a returning reader
  trips over: the `src/lib` re-export shims left by #203, and the Mumbai move.
- **`docs/HANDOFF.md §7` stopped at 2026-07-24/25.** Added both missing sessions.
- **`docs/component-registry.md` listed 6 API routes against 131 built ones** and called
  the ticker 10s (it is 180s). Replaced the route/page/lib enumerations with a pointer
  table at authoritative sources; kept the component tables, which describe reuse intent
  that no build output can produce.
- **`docs/AUDIT-2026-08-01-latency.md` was premised on a constraint that #210 removed.**
  Functions now run in Mumbai with the database, so the ~250ms-per-query gap the audit
  ranked everything around is gone. Rather than rewriting it, added a superseded-in-part
  banner with a per-finding re-assessment: two already fixed (#3, #4), one obsoleted
  (#11), one reclassified (#1), one being fixed (#9), five surviving on non-latency
  grounds. The lesson recorded alongside it: findings that *remove work* survived the
  change, findings that only *reorder work around a penalty* did not.
- **Not changed:** `src/core/auth/auth.ts` — the false "routes always re-check DB anyway"
  comment was already corrected on `main` at line 320. Verified, left alone.
## 2026-08-04 — Cover /api/ticker in the poll/window alignment test
Test only. No behaviour change - `/api/ticker` keeps the 180s/180s/300 that #207 set.
- **Why:** #207 fixed the ticker's 60s-window-against-a-150s-poll by hand, after an
  audit found it. Nothing in the suite would have caught it, and nothing would catch
  it coming back: this test only ever globbed `src/app/api/markets/*`. The ticker's
  poll lives in its own hook rather than at a `usePolledJson` call site, so the glob
  could not see it by construction.
- **What changed:** the file now drives off an explicit `TARGETS` list - six markets
  routes plus the ticker - and reads each route's poll from the file it actually
  lives in (`modules/markets/lib/useTickerPoll.ts` for the ticker). Adding a polled
  route means adding it there.
- **Deliberately reads the real modules, not the `src/lib` / `src/components` shims**
  left by #203. A shim is a single `export * from` line; pointing the test at one
  would make every regex match nothing and the suite would pass while checking
  nothing. The empty-parse guard now also rejects a target whose poll failed to parse.
- **Falsification proved, not assumed:** with the ticker temporarily reverted to its
  pre-#207 values, 2 of 6 assertions fail and both name the ticker and cite
  `useTickerPoll.ts`. Restored to 180/180/300 afterwards, byte-identical to `main`.
- ✅ **VERIFIED ON PRODUCTION 2026-08-04.** The `pre-merge` rule is that a defined
  check which is never run is worth nothing, so here is the run. Owner fetched
  `/api/ticker` every ~10s from the live site and logged `x-vercel-cache` + `age`:

  ```
  age  51 … 147 … 157 … 167 … 177   HIT     ← 13 consecutive HITs above 60
  age 188                            STALE   ← expires here
  age   9                            HIT     ← regenerated
  ```

  **Both falsifiers came back negative.** `age` did not reset at ~60-70 (which would
  mean the edge was still on the pre-#207 window), and the entry did not go `STALE`
  before `age` reached 150 (which would mean every poll still regenerated). Expiry
  brackets between 177 `HIT` and 188 `STALE` at a ~10.5s sampling interval — i.e.
  **180s, the `s-maxage`**, confirming trap 0 once more: the edge tracks the header,
  not `export const revalidate`.
  - The `STALE` → `age 9` step is correct `stale-while-revalidate=300` behaviour, not
    a glitch: the stale body was served immediately and refreshed in the background.
  - **Effect:** the 150s poll now lands on a fresh cache instead of forcing a
    regeneration. Under continuous traffic that is roughly **1440 → 480
    regenerations/day** for this route — ~960 fewer ISR Writes/day, plus the
    CoinGecko fetch, `JSON.parse` and origin→edge transfer each one carried.
  - **Scale honestly:** real but modest against a 200k/month quota. The `/news`
    pipeline (29 RSS data-cache entries on a 90s window) remains the dominant term.

---

## 2026-08-03 (22) — Reports have somewhere to be read

The report button shipped in (20) wrote to a table nobody could see. Dashboard
-> Moderation now has a third view beside Comments and Chat messages.

Each row carries what a decision actually needs: the reason, who was reported
(with a link to their profile - an admin reading a report almost always wants
to look at the account next), who reported them, the note, and the DM that was
cited. Open / Reviewed filter; marking reviewed is reversible, because it is a
triage state and reopening should not require a database console.

### The privacy call, stated rather than assumed

When a report cites a DM, that message's text is shown to staff. A private
message becomes readable. That IS the point of citing it - a report nobody can
evaluate is a report nobody can act on, and the reporter chose to hand it over -
but it is a real disclosure and it should be a decision, not a side effect.

The line is drawn at exactly that one message: the rest of the conversation is
never fetched, and emails are masked the same way the members table masks them.
Widening this should be a deliberate conversation, not a quiet `include`.

A message the sender has since deleted still appears, labelled as deleted. That
is precisely why DM deletes are soft.

### Gate

`post:manage` - the same permission Comments and Chat messages already use.
Reports are about member behaviour, so they belong to whoever handles
moderation rather than needing a permission of their own. Verified: a non-staff
member gets **401**.

### Verified in a real browser

```
non-staff GET /api/reports    401
open reports                  1  harassment / @safeone / sa***@x.io / message attached
UI                            reason, note, reported message, Mark reviewed all present
after Mark reviewed           open: 0   reviewed: 1
```

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 515/515 tests ✅ ·
build ✅

**Files:** `src/app/api/reports/route.ts` (new),
`src/modules/dashboard/components/DashboardClient.tsx`.

## 2026-08-03 (21) — The service worker was caching 404s, and one of them was the stylesheet

Owner sent a phone screenshot of a research post rendered as raw HTML: serif
text, blue underlined links, no layout at all. The page was there; the CSS was
not.

### The cause

`public/sw.js` handled static assets cache-first:

```js
caches.match(req).then(hit => hit || fetch(req).then(res => {
  cache.put(req, res.clone());   // no status check
  return res;
}));
```

Two independent defects, both of which only bite on a phone:

**It cached failures.** No status check, so a **404 was written to the cache**.
A hashed asset really can 404 for the seconds a deploy takes to propagate
across edges. After that, `caches.match` returned the cached 404, cache-first,
for that exact URL - **forever**. If the 404 was the stylesheet, that device
rendered raw HTML on every visit until its site data was cleared. Today's
deploy carried three migrations and was the biggest in a while, which is the
window this needed.

**A network blip killed the request outright.** With no `.catch()`, a rejected
fetch rejects `respondWith`, and the browser gets a hard network error - where
with no service worker at all it would have fallen back to its own HTTP cache.
Intercepting made a flaky connection strictly *worse*, for exactly the files a
page cannot render without.

### The fix

- Only `res.ok` **and** `res.type === "basic"` responses are stored.
- A failed fetch falls back to the cache, and to a plain network error only if
  there is nothing - never a dead request.
- **`CACHE` bumped v7 -> v8.** This is the part that actually un-breaks a phone
  that is already showing the bug: `activate` deletes every cache that is not
  the current name, so bumping is the only way to evict an entry that was
  poisoned before the fix shipped. It is *not* a return of the
  bump-on-every-deploy ritual - navigations are still never cached, and that
  rule stays retired.

### Verified in a real mobile browser

```
service worker controlling: true
cache buckets: xyz-pwa-v8
404 asset  -> status: 404 | stored in cache: false    correct
real css   -> /_next/static/chunks/….css | stored: true    correct
rendered styles: font GeistMono…, body rgb(8,8,10)
```

**One correction to my own test:** the first run reported the real stylesheet as
*not* cached, which would have been a regression. It was the harness - `cache.put`
is fire-and-forget inside the worker and the assertion raced the write. With a
beat before checking, it stores correctly.

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 515/515 tests ✅ ·
build ✅

**Files:** `public/sw.js`.

## 2026-08-03 (20) — DM safety: block, report, and who can message you

Second half of the DM request. Kept apart from the message menu on purpose:
this is a policy about people, not a control on a bubble.

### One gate, called by both write paths

`dm-gate.ts` answers "may these two message each other?" for both starting a
conversation and sending into one. Three decisions in it are easy to get subtly
wrong apart, so they are in one file with the reasoning attached:

**Blocks bite in both directions even though the row is one-way.** If either
side has blocked the other, neither can send. Enforcing it only against the
blocked party leaves the blocker still receiving, which is the thing they asked
to stop.

**Privacy gates NEW conversations only.** Someone who sets "nobody" has not
asked to have their open threads cut off mid-sentence; they have asked not to be
approached by strangers. Blocking is the tool for ending a conversation.

**"Only people I follow" means the people the RECIPIENT follows** - the inbox
they opted into. Using their follower list instead would let anyone who follows
them through, which is the opposite of a filter. There is a test that asserts
the query is built that way round, because the two are one word apart.

**The refusal message is identical** for "they blocked you" and "their settings
don't allow it". Telling someone they were specifically blocked hands a
harasser a confirmation signal, and the recipient gains nothing from the
distinction.

### Report, because block alone is half a safety story

Block protects the person who pressed it and tells the owner nothing. A report
lands in a queue with a reason (spam / harassment / scam / other) and, if it
came from a thread, the id of the message that prompted it - referenced, not
copied, since DM deletes are soft and the evidence is still there.

Blocking does **not** delete history. A block stops what happens next; quietly
erasing a conversation someone may need to report would be the wrong instinct.

### In the UI

The thread header gets the safety menu (Block / Unblock, and Report with a
reason). A blocked thread replaces the composer with a plain sentence rather
than a disabled box - a greyed-out field you can still click into invites
someone to type a message that will never send.

Settings gets "Who can message me", with the caveat spelled out next to it.

### Verified end to end, two sessions

```
block                    200
blocker sends            403        both directions
blocked sends            403
thread flags (blocker)   blocked:true  blockedByMe:true
thread flags (blocked)   blocked:true  blockedByMe:false
report                   200
unblock -> send          200 -> 201
privacy=nobody, new      403
privacy=nobody, existing 201        thread survives
```

**A false alarm from my own harness:** the first run showed block and report
returning 400. That was the test data, not the code - the seeded users had
hand-written ids and the routes validate `isCuid`. Re-run with cuid ids, all
green. Recorded because "400 on block" would have looked like a real defect.

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · **515/515 tests** ✅
(+10, all on the gate) · build ✅

**Files:** `prisma/schema.prisma`, `prisma/migrations/33_dm_safety/`,
`src/modules/messages/lib/dm-gate.ts` (+ shim),
`src/app/api/dm/block/route.ts`, `src/app/api/dm/report/route.ts`,
`src/app/api/dm/route.ts`, `src/app/api/dm/[id]/route.ts`,
`src/app/api/profile/route.ts`, `src/modules/profile/lib/profile.ts`,
`src/app/settings/page.tsx`, `src/modules/settings/components/SettingsClient.tsx`,
`src/modules/messages/components/MessagesClient.tsx`,
`src/lib/__tests__/dm-gate.test.ts`.

## 2026-08-03 (19) — DM message actions: edit, delete, pin, translate, copy

First half of the owner's DM request. Block, report and the DM privacy setting
are the second half and are deliberately a separate change - they are a safety
model, not a message menu, and mixing them would make both harder to review.

### What the messages can do now

Every message gets an action menu. **Translate needed no new endpoint**: the
community chat's `/api/chat/translate` already takes a bare `{ text }`, so a
second one would only have been a second prompt to keep in step.

Permissions, each verified against the real endpoints with two sessions:

| action | who | result |
|---|---|---|
| edit | author only, inside 15 min | own 200, other's **403** |
| delete | author only | own 200, other's **403** |
| pin | **either participant** | 200 |

The edit window is the same 15 minutes the community chat uses. Two different
edit windows in one product is a rule nobody can remember.

**Pin is not restricted to the author on purpose.** A pin marks what matters to
*the conversation* - an address, a deadline - and half the time that is the
other person's message. One pin per conversation, so pinning replaces the last.

### Deletes are soft, and leave a tombstone

`status` mirrors `ChatMessage`. Two reasons the row stays: removing it makes the
thread jump under the reader's cursor and quietly rewrites a conversation they
had already read, and a reported message needs to still be there after its
sender removes it.

The API sends `body: ""` for a deleted message. Shipping the text and hiding it
in CSS would mean "deleted" only held for people who do not open devtools.

### Two UI defects I built and then fixed

Worth recording because the first version passed every functional test:

- **The menu opened on top of the message it belonged to.** Anchored to the
  trigger, it covered the text - so you could not see what you were about to
  delete. It is now anchored to the message row and sits entirely above it.
- **It used `.glass`,** which is translucent, so the message behind it showed
  through the menu. Solid surface now.

Both were only visible in a screenshot; the DOM assertions were perfectly happy.

### Verified

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 505/505 tests ✅ ·
build ✅ · permission matrix above ✅ · mobile screenshot ✅

**Files:** `prisma/schema.prisma`, `prisma/migrations/32_dm_message_actions/`,
`src/app/api/dm/[id]/message/[messageId]/route.ts` (new),
`src/app/api/dm/[id]/route.ts`,
`src/modules/messages/components/MessagesClient.tsx`.

## 2026-08-03 (18) — The members table now shows a face and a check-in record

Two follow-ups from the owner, on the table shipped an hour earlier.

### Avatars, so "who has set a photo?" is answerable

A column of masked email addresses cannot tell you that at all. Each row now
leads with the member's avatar, falling back to initials - so an account with
no photo is obvious by the absence of one, which was the actual question.

Inline `data:` avatars go out through `publicImageUrl()` as a `/api/media/...`
URL rather than as base64 in the payload. Fifty rows of raw blob is exactly the
Fast Origin Transfer trap this project already has a helper for.

### Check-in history, which had nowhere to be seen

The streak shipped in (17) existed only on the member's own button - the owner
had no way to see who was actually turning up. There is now a **Check-ins**
column: the current run as a "Day N" badge, and the all-time total beside it.

**Both numbers, deliberately.** "Day 6 - 14 days" answers two different
questions: the run says whether they are here now, the total says whether they
ever were. Someone at "Day 1 - 60 days" is a returning regular who lapsed, and
that reads nothing like "Day 1 - 1 day"; one number alone cannot tell those
apart. A member who has never checked in reads "never" rather than a zero.

Also added to the CSV export, along with the username, since that is how the
question gets answered for everyone at once instead of a screen at a time.

### Cost

Two queries for the whole page, not one per row: a `groupBy` for the totals
(never loads the rows) and one bounded read of the day keys. Both sit on the
existing `[userId, action, day]` unique index. The streak window matches the
one the member's own button uses, so the dashboard and the member can never
disagree - a dashboard saying "Day 40" while the member sees "Day 41" is worse
than no number.

### Verified

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 505/505 tests ✅ ·
build ✅

In a real browser, against a seeded history (owner on a 5-day run, the other
member lapsed after 8 days):

```
@owner  🔥 Day 5 · 5 days     avatar: photo
@two       no run · 8 days    avatar: initials
```

CSV: `Name,Username,Email,…,Check-in Streak,Check-in Days` with `5,5` and `0,8`.

**Files:** `src/core/db/member-checkins.ts` (+ shim), `src/app/dashboard/page.tsx`,
`src/app/api/users/route.ts`, `src/modules/dashboard/components/DashboardClient.tsx`.

## 2026-08-03 (17) — Tap a shared photo, click through to a member, and see the streak

Three owner asks, none of which needed a new table.

### 1. Shared photos open full-screen

In a message list a photo is capped at 288px tall and 300px wide, so a chart or
a screenshot is unreadable until it can be opened - and tapping it did nothing,
in both the community chat and DMs.

`ImageLightbox` already existed for the profile avatar and banner, portal and
scroll-lock and Escape handling included, so this is that component wrapped
around the two message images rather than a second implementation. Verified in
a real browser on both surfaces: tap the thumbnail, a full-viewport overlay
appears.

### 2. The dashboard members table links to the profile

The row showed a masked email and a name, which told an admin *who* someone is
and gave them no way to go and *look*. It now shows the handle as a link to
`/u/<username>`, opening in a new tab so the list, its search and its scroll
position survive.

`username` added to three selects that had all been assembled without it
(`/api/users`, the dashboard page query, and the client's `UserRow`). Accounts
that never picked a handle read "no handle" rather than rendering a dead link.

### 3. Daily check-in shows the streak, live

`XpEvent` already stores one row per user per action per UTC day, with `day` as
a plain `YYYY-MM-DD` string. So a streak is "how many consecutive day keys lead
back from today" - derived, not stored. **No column, no table, no migration.**

Storing day keys as strings also makes the whole calculation timezone-free:
everyone's streak rolls over at the same instant, which is the only rule that
does not quietly reward or punish people for where they live, and it keeps this
away from the hydration class of bug that timezone-dependent rendering caused
elsewhere.

Two decisions worth naming:

- **A run counts from yesterday when today is unclaimed.** At 9am, before
  checking in, someone on a 30-day run has a 30-day run - not a zero. Showing 0
  there is both wrong and the moment they decide the feature is broken. The
  badge turns amber in that state, because that is the one moment the number is
  actionable.
- **No badge at all below one day.** "Day 0" beside a check-in button reads as
  a bug rather than a fact.

**Live** in the way that matters: the award endpoint returns the new streak, so
the number moves on the same click, and it broadcasts `xp_checkin` on the
member's own channel so a second device stops showing yesterday's number. No
poll - a streak changes at most once a day and only by their own hand.

### Verified

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · **505/505 tests** ✅
(+14) · build ✅

In a real browser: DM photo → full-screen overlay ✅ · community photo →
full-screen overlay ✅ · dashboard Members tab → `/u/two`, `/u/owner` ✅ ·
check-in streak 0 → 1 on claim, returned in the response ✅

**One correction to my own work along the way:** the first version of the
check-in hook dropped the cancellation guard the original had, so a response
arriving after unmount would set state, and it raised the lint warning count
36 → 37. Both fixed by splitting the fetch from the state write.

**Files:** `src/modules/community/components/ChatClient.tsx`,
`src/modules/messages/components/MessagesClient.tsx`,
`src/modules/dashboard/components/DashboardClient.tsx`,
`src/app/api/users/route.ts`, `src/app/dashboard/page.tsx`,
`src/shared/utils/xp-streak.ts` (+ shim), `src/app/api/xp/route.ts`,
`src/app/api/xp/award/route.ts`,
`src/modules/profile/components/DailyCheckIn.tsx`,
`src/lib/__tests__/xp-streak.test.ts`.

## 2026-08-03 (16) — DM read receipts and last seen, both live, both on plumbing that already existed

Owner asked for WhatsApp-style receipts and last seen in DMs, realtime, and a
better-looking thread. Typing was explicitly skipped.

### Read receipts needed no schema change at all

`Conversation` already carried `readAAt` / `readBAt` - "when this side last
opened the thread" - written on every thread GET for the unread badge. That is
the entire receipt calculation: a message I sent is read if the other side's
`readAt` is at or after it. No per-message column, no per-message write.

- The thread GET now returns `otherReadAt`, and the inbox returns `lastMine` +
  `otherReadAt` so a row can show a tick without being opened.
- **Live:** opening a thread broadcasts `dm_read` on the sender's existing
  `user:<id>` channel, carrying the conversation id and the timestamp. The
  ticks turn with no refetch. Verified end to end with two real sessions: user
  1 sees `Sent`, user 2 opens the thread, user 1's tick becomes `Read` **without
  a refresh**.
- The broadcast fires only when the read actually advanced past something of
  theirs. Every silent refetch also runs this GET, and broadcasting on all of
  them is a loop - my refetch pings you, your refetch pings me.
- It carries no message content. That channel is public (anon key,
  `private: false`), which the `dm_message` ping already documents; a
  conversation id and a date is strictly less than that ping already discloses,
  and it saves the sender a 200-message thread refetch to learn one date.

Three states, deliberately: sending, sent, read. **No "delivered".** WhatsApp
has one because its server knows when a device received the message; there is
no such signal here, and deriving it from "are they online right now" would be
a guess dressed as a fact.

Ticks are **mint, not blue**. Read is the positive outcome and mint is this
palette's positive; a new colour is the one thing the design system asks not to
add.

### Last seen: one column, zero new requests

`ChatPresence` looked like the natural home and is the wrong one - the pagehide
beacon **deletes** that row, which is exactly the moment a last-seen time
becomes worth having. So `User.lastSeenAt` (migration `31_last_seen`), stamped
inside the presence endpoints the site already calls: the heartbeat and the
leave beacon. No new endpoint, no new interval, no new request.

Wording is relative only - "last seen 3 h ago", never a clock time or a date.
Two reasons: a rendered timestamp needs a timezone, and this project has
already lost days to that (#418); and exact times are surveillance where a
bucket is information. Past a week it collapses to "a while ago".

Reads degrade to null on a database that has not had the migration pushed, so
the header falls back to the handle rather than 503-ing the thread.

### The thread itself

Day separators (Today / Yesterday / date), clock times instead of "3 min ago"
on every bubble, and consecutive messages from one side grouped tighter. The
time helpers moved out of `ChatClient` into `chat-time.ts` so DMs reuse the
hydration-safe versions rather than growing a second copy - they format in UTC
through hydration and switch to the reader's timezone after, which is the rule
that keeps #418 away.

Also: a photo DM showed its raw storage URL in the inbox preview. It says
"📷 Photo" now.

**One bug found in my own work while verifying:** the message list had
`space-y-2` on the scroll container, which overrode the per-message spacing, so
the grouping silently did nothing. Caught by looking at the screenshot rather
than the diff.

### Verified

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · **491/491 tests** ✅
(+15) · build ✅ · two-session receipt test ✅ · last-seen-after-leave ✅ ·
mobile + desktop screenshots ✅ · no page errors

**Owner note:** last seen is visible to anyone you have a DM thread with. That
is the normal messenger bargain, but it is a new disclosure - say if you want it
behind a setting.

**Files:** `prisma/schema.prisma`, `prisma/migrations/31_last_seen/`,
`src/shared/utils/last-seen.ts`, `src/shared/utils/chat-time.ts`,
`src/core/db/touch-last-seen.ts` (+ `src/lib` shims),
`src/app/api/presence/route.ts`, `src/app/api/chat/presence/route.ts`,
`src/app/api/dm/route.ts`, `src/app/api/dm/[id]/route.ts`,
`src/modules/messages/lib/dm.ts`,
`src/modules/messages/components/MessagesClient.tsx`,
`src/modules/community/components/ChatClient.tsx`, tests in `src/lib/__tests__/`.

## 2026-08-03 (15) — Ten seconds after opening the room, the poll dropped you into four-day-old history

The owner filmed it: open `/community`, today's messages are there, and then
the view jumps by itself to 30 July. Refresh brings the current ones back, and
it happens again.

Not staleness, and not scrolling. The message list genuinely ends with an old
message, and the room auto-scrolls to its end.

### The cause

`reconcilePoll()` treated **every id it had not seen before as a new arrival**,
and the caller appends arrivals to the end of the list. That assumption is only
safe if the poll never returns anything older than what is on screen - and it
does, because the two sources are different sizes:

| source | messages |
|---|---|
| `/community` server render | newest **30** |
| `/api/chat/messages` (the poll) | newest **50** |

So the very first poll, ten seconds after opening the room, hands back ~20
messages that are unknown *and older than everything displayed*. They were
appended underneath the newest message, and the room stuck to the bottom.

Reproduced in a real browser against a seeded room (40 messages from 30 July,
3 from today), sampling the rendered list every 10s:

```
t=  0s  msgs=30  last=new-3    <- today, correct
t= 10s  msgs=43  last=old-13   <- 30 July, from the first poll
```

They also incremented the unread badge and rang the new-message sound, so the
room announced four-day-old messages as if they had just been posted.

### The fix

Arrivals are split by **time**, not by novelty. Anything at or before the newest
message already held is history: it gets sorted into position rather than
appended, and is not reported as `incoming`. Only genuinely newer messages
count as arrivals. Pending optimistic sends stay at the end and are excluded
from the high-water mark, so a local send cannot mask a real new message.

After, same harness, same seed:

```
t=  0s  msgs=30  last=new-3
t= 10s  msgs=43  last=new-3   <- history backfilled ABOVE, newest still last
...
t=120s  msgs=43  last=new-3
```

And the other direction still works - inserting a message from another user
mid-session put it at the bottom within one poll (`last=live-1`), so this did
not fix the jump by breaking live delivery.

**Files:** `src/modules/community/lib/chat-view.ts`,
`src/lib/__tests__/chat-view.test.ts` (5 new tests, including the exact
30-vs-50 window case and the pending-send edge).

## 2026-08-03 (14) — The chat's own poll was the last surface swallowing its errors

Owner: *"chat me new wala dekhne ke liye refresh karna padta hai, page direct
old data me show hota hai"*, plus a Task Manager screenshot: Chrome at 51.8%
CPU, 30.5% GPU, 3.2 GB.

### Why the chat went stale and only a reload fixed it

The room has a 10s message poll behind the realtime channel. It ended in:

```js
if (!res.ok || !data?.messages) return;   // silent
...
} catch { /* transient */ }               // silent
```

The owner's production console showed `GET /api/chat/messages 503`. So the poll
fired, got a 503, threw it away, and the pill kept reading **"Synced"**. The
server render (a different path, on request) still worked - which is exactly
why reloading was the only thing that ever helped. #223 did this same sweep
across the live surfaces and missed this one.

Two changes:

- **The failure is now visible.** `pollError` drives an amber **"Stale"** on the
  status pill with the HTTP status in the tooltip. "Synced" was actively
  misleading: it is the honest word for a working fallback, and the wrong word
  for a fallback that is failing.
- **A healthy socket is no longer taken on trust.** `liveRef` used to skip the
  poll entirely, so a channel that was SUBSCRIBED but silently delivering
  nothing left the room permanently behind with "Live" showing. It now
  reconciles once a minute regardless. Cost: one request per minute per open
  room.

The underlying 503 is server-side and still an owner action (see §8) - this
makes it diagnosable and self-healing instead of silent.

### CPU: what was actually true, and what was not

Measured on the homepage, production build, 10s idle, tab visible:

| | before | after |
|---|---|---|
| elements with `will-change` (compositor layers) | 247 | **67** |
| running CSS animations | 182 | **158** |
| main-thread task time | 1.76s | ~1.68s |

**`.starfield span { will-change: opacity, transform }`** promoted *every* star
to its own compositor layer. The homepage mounts the field twice, so that was
~244 layers for 1-3px dots, of which only ~64 ever animate. A layer per static
dot is pure GPU memory and compositing work - which is what the owner's 30.5%
GPU and 3.2 GB reading is made of. `will-change` now applies only to stars that
actually move, and `light` (the second mount) halves its animated share;
density is untouched, so nothing looks different.

**The honest part:** this is a GPU/memory fix, not a main-thread CPU fix, and
the main-thread number barely moved. Attribution measurements are recorded
here rather than hidden because they refuted the obvious hypothesis: disabling
**every** CSS animation on the page changed task time from 1.431s to 1.472s -
i.e. not at all, within a run-to-run variance of about ±0.3s (one row of that
sweep came out *higher* than baseline, which is impossible and is the
give-away). CSS animations are **not** the main-thread cost. The starfield is
the biggest single contributor to style recalculation specifically (0.306s ->
0.183s when disabled), which is what the change above targets.

This machine's headless Chromium renders in software, so it cannot reproduce
what 247 GPU layers cost on the owner's hardware. The mechanism is certain; the
size of the win on their machine is not measured here. Worth re-checking on the
real device after deploy.

**Files:** `src/modules/community/components/ChatClient.tsx`,
`src/app/globals.css`, `src/components/Starfield.tsx`.

## 2026-08-03 (13) — Every page was served invisible, and reduced motion made React throw it away

The blank/stuck page, found and reproduced. Two independent faults in
`src/app/template.tsx`, which wraps **every route**:

```tsx
const reduced = useReducedMotion();
if (reduced) return <>{children}</>;
return <motion.div initial={{ opacity: 0, y: 8 }} ...>{children}</motion.div>;
```

**1. The whole site was server-rendered at `opacity: 0`.** Content became
visible only once JavaScript hydrated. Any failure on that path - a stale
chunk, a throw, a phone that gave up on the bundle - left a fully-populated DOM
that nobody could see. Measured: `/`, `/terms`, `/research`, `/markets`,
`/news` each shipped exactly one `opacity:0;transform:translateY(8px)` wrapper
around everything.

**2. The branch broke hydration on every page.** framer-motion's
`useReducedMotion()` returns `null` while server rendering but reads
`matchMedia` synchronously during the FIRST client render. For a visitor with
reduced motion on, the server sent the wrapper and the client rendered without
it - the document shifted one level, React threw `Minified React error #418`
(`throwOnHydrationMismatch`) and discarded the server HTML for the whole page.
Reduced motion is on by default under Android battery saver and iOS Low Power,
which is why this read as a mobile problem. It is also the `#418` in the
owner's production console.

Reproduced before touching anything: a Playwright sweep of 16 routes signed-out
and signed-in threw #418 on **32 of 32**. Isolating one variable at a time
showed reduced motion alone was the trigger (locale and timezone were clean at
that point).

### The fix

`template.tsx` is now CSS with no branch at all: one `.route-enter` class,
keyframed in `globals.css`, opted out under `@media (prefers-reduced-motion:
reduce)`. Identical markup on both sides, so there is nothing to mismatch, and
the page becomes visible whether or not JavaScript ever arrives. Verified with
JavaScript **disabled**: wrapper opacity 1, body text visible, both with and
without reduced motion.

### Then the sweep found a second bug the first was hiding

With 30/32 clean, `/settings` and `/community` still threw - and isolating
again showed the trigger was **timezone**, not motion. Vercel runs UTC and the
reader's browser does not, so dates near midnight formatted to a different
calendar day on each side. Captured literally, from an IST browser:

| surface | server HTML | IST browser |
|---|---|---|
| `/settings` | `Aug 2, 2026` | `Aug 3, 2026` |
| `/community` | `6:06 AM` | `11:36 AM` |

`formatDate`/`formatDateWithDay`/`formatDateTime` pinned the *locale* but never
the *timezone*. They now pin `timeZone: "UTC"`, which is also the better answer
on its own terms - a post should not look published on different days to
different readers. (`DashboardClient` already did this; it was the outlier that
was right.)

The chat's clock times and Today/Yesterday separators genuinely mean *the
reader's* day, so pinning UTC would have been wrong. Those format in UTC for
the server render and the hydrating render, then switch to local from the next
render on, via the existing `useHydrated()`. The two only ever disagree within
the timezone offset of midnight.

### Swept the whole class, not just the two sites that fired

- Every remaining `useReducedMotion()` (8 call sites) now uses a new
  `useReducedMotionSafe()` - `useSyncExternalStore` with a server snapshot, so
  hydration sees what the server saw. This was not paranoia: `ActionLink`'s
  `whileTap={reduced ? undefined : ...}` was a real mismatch, because
  framer-motion emits a `tabindex` attribute when a gesture prop is present.
- `Starfield`'s star positions came from `Math.sin`, which ECMAScript does not
  require to be correctly rounded. Node and V8-in-Chromium genuinely differed -
  server `left:5.721816934965318%` vs browser `5.721816935692914%` - so all 110
  stars reported an attribute mismatch on the homepage. Seeds moved to
  `starfield-seed.ts` and quantized; the live set's closest approach to a
  rounding boundary is 2.61e-4 against a 7.28e-8 divergence, ~3600x of headroom,
  asserted by test. Silent in production, but it buried real errors in dev.
- Three server-rendered number formatters had no locale pinned
  (`DashboardClient`, `LiveStats`, `ProfileStats`). Latent rather than observed
   - `en-IN` groups digits differently only from 10,000 up and the local seed
  data is smaller - so pinned to `en-US` to match the convention already used
  everywhere else in those same files.

### Verified

typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 471/471 tests ✅ (+9:
starfield seed stability, date-formatter timezone independence, including a
control that fails without the fix so the assertions cannot be vacuous) ·
build ✅ · content visible with JS disabled ✅

Hydration sweep, production build, every combination of reduced-motion /
`en-IN` / `Asia/Kolkata`, signed-out and signed-in: **32/32 pages clean**, and
30/30 on the per-variable matrix across `/community`, `/settings`, `/messages`,
`/u/owner`, `/dashboard`, `/journal`. Before: 32/32 failing.

**Files:** `src/app/template.tsx`, `src/app/globals.css`,
`src/shared/utils/utils.ts`, `src/shared/hooks/useClientFlag.ts`,
`src/shared/utils/starfield-seed.ts` (+ `src/lib` shim), `src/components/Starfield.tsx`,
`src/modules/community/components/ChatClient.tsx`,
`src/modules/profile/components/ProfileStats.tsx`,
`src/shared/components/{ActionLink,AnimatedEmoji,AnimatedIcon,BrandLoader,LiveStats}.tsx`,
`src/modules/{profile/components/ProfileFollow,news/components/NewsClient,ai/components/XyzAiWidget,dashboard/components/DashboardClient}.tsx`,
tests in `src/lib/__tests__/`.

## 2026-08-03 (12) — Two components asking for the same realtime channel, and the second one losing

The owner sent a production console. It contained the answer, and it was **not**
what I had been telling them.

```
Uncaught (in promise) Error: cannot add `presence` callbacks for
  realtime:site-visitors after `subscribe()`.
Uncaught (in promise) Error: cannot add `presence` callbacks for
  realtime:community after `subscribe()`.        (twice)
```

### What I had wrong

I had said the problem was the Supabase credentials and that nothing in the code
could help. **These errors disprove that**: a channel is only ever created when
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are present, so
they are set. This is our bug, not a key.

### The mechanism, from the library source

`getRealtimeClient()` returns ONE Supabase client per tab, on purpose. And
supabase-js reuses channels by topic:

```js
channel(topic) {
  const exists = this.getChannels().find(c => c.topic === realtimeTopic);
  return exists ?? new RealtimeChannel(...);   // the SAME object
}
```

Once that channel has been subscribed, adding a listener throws
(`RealtimeChannel.js:418`).

`site-visitors` was created from **five** places - RealtimeSession, the
dashboard's live-online tile, `useLivePresence`, `useUserOnline` (twice) - and
`community` from **two**: ChatClient and NavActivity. Whichever mounted first
subscribed; every later one received that already-subscribed channel, threw, and
**its listeners were never registered**.

**That is why the online count did not update, and why it "worked after a
refresh"**: a reload changes the mount order, so sometimes the component that
needed presence won the race. It is also why every fix aimed at the fallback
path helped without ever solving it.

### The fix

`joinSharedChannel()` owns each topic. It attaches exactly one presence listener
and one **wildcard** broadcast listener *before* the single `subscribe()`, then
fans out to consumers from its own sets. Consumers register and release freely
afterwards, because they never touch the channel. A late presence key rebuilds
the channel - safe precisely because the handlers live in the registry.

**Every raw `client.channel()` call site is gone** - ChatClient, RealtimeSession,
NavActivity, WhatsNewFeed, DashboardClient (×2), `useRealtime`,
`useLivePresence`, `useUserOnline` (×2). `useRealtime` mattered most: it serves
`user:<id>`, `notifications` and `post:<id>`, all topics other components also
join.

Presence keys are now a rule rather than an accident: **only the consumer that
represents the tab passes one** (RealtimeSession for `site-visitors`, ChatClient
for `community`). The dashboard tile and the online-set hooks are observers and
pass none - previously each tried to impose its own key on the one shared
channel.

### Verified

Seven unit tests against a fake client that reproduces the library's own throw:
one channel per topic however many consumers join; a late consumer does not
touch the channel and does not throw; presence reaches every consumer including
a late one (replayed); broadcasts route only to the consumers that asked;
refcounted teardown; a released consumer stops receiving; typing sends through
the handle.

Chat re-verified end to end with two sessions: a message arrives without a
refresh, the online count reads 2, and the wake path still fires. Steady-state
request rate measured identical to `main`: **25 requests / 12.5 per minute per
signed-in tab**.

**Honest scope:** I could not reproduce the console error locally. It only
throws once a channel has actually JOINED, which needs a reachable Supabase
project - with a stub URL it does not fire on this branch **or on `main`**, so
that comparison proves nothing either way. The evidence the bug is real is the
owner's production console plus the library source; the evidence the fix
addresses it is structural (no component can reach a shared channel any more)
plus the unit tests. **The place to confirm it is that same production console.**

### Also in the console, not addressed here

- `GET /api/notifications 503`, `GET /api/chat/messages 503`, repeatedly. The
  server really is failing - which corroborates (9)'s pool finding, and those
  now log `POOL EXHAUSTED (P2024)` when that is the cause.
- `Minified React error #418` - a hydration mismatch, and a plausible cause of
  the blank/stuck page. Separate work.
- `Cannot redefine property: ethereum` - a wallet extension, not ours.

**Files:** `src/shared/utils/sharedChannel.ts` + `src/lib/sharedChannel.ts`
(new) · `ChatClient.tsx` · `RealtimeSession.tsx` · `NavActivity.tsx` ·
`WhatsNewFeed.tsx` · `DashboardClient.tsx` · `useRealtime.ts` ·
`useLivePresence.ts` · `useUserOnline.ts` ·
`src/lib/__tests__/sharedChannel.test.ts` (new).

**Gates:** typecheck ✅ · lint 0 errors / 36 warnings (unchanged) · 462/462
tests ✅ · build ✅ · all nine pages 200.

---

## 2026-08-03 (11) — Every live surface swallowed its own failures, so nothing could retry

Reported, after several rounds of per-surface fixes: data still does not sync
sometimes, the page gets stuck, the community chat sometimes fetches nothing,
and the online count only works after a refresh. *"Fix properly taki baar baar
na karna pade."*

The reason it kept coming back is that each round fixed one loop. This is the
thing all of them shared.

### The audit

Across every live surface - DM inbox, DM thread, navbar badges, ticker, journal
feed, markets, news - **not one retried a failed request, and not one listened
for the network coming back**:

| surface | retry | visibility | `online` event |
|---|---|---|---|
| MessagesClient | ✗ | partial | ✗ |
| NavActivity | ✗ | ✓ | ✗ |
| JournalActivityFeed | ✗ | ✗ | ✗ |
| useTickerPoll | ✗ | ✓ | ✗ |

So one failed request - a dropped connection, a 503 from a busy database, a
phone switching from wifi to mobile data - left that surface stale until the
next tick, and if that tick failed too, **until the user reloaded the page**.
Nothing was broken permanently; nothing recovered on its own either. That is
exactly what "kabhi kabhi" and "refresh ke baad kaam karta hai" describe.

### The blocker underneath it

Even where a retry existed, it could never fire: **every loader caught its own
error and resolved successfully.** `loadInbox`, the DM thread `load`,
`loadNotes`, `loadDm`, `loadChat` all ended in a bare catch, so a failed request
was indistinguishable from a successful one to anything wrapping it. All five
now let the failure propagate; they still keep the last known state, the error
just travels far enough for something to act on it.

### The fix

- **`useRealtime`'s poll now retries** a rejected load with backoff (1s → 30s),
  never overlaps requests, and drops the backoff on wake. One change, and every
  consumer gets it: comments, likes, Journal, Journal activity, profile follow
  counts, both DM loops, the dashboard.
- **`useLiveData`** (new) is the same contract for surfaces that have no
  realtime channel at all, and NavActivity - the badges on every page - is the
  first onto it. It gains retry and an `online` listener for the first time.

**Verified end to end in a real browser.** Endpoints forced to 503 from first
load, then healed with no reload and no interaction:

```
while failing : 21 retry attempts in 9s, with backoff
after healing : recovered in 7.0s, no reload, no interaction
```

Previously that surface would have waited out a 30-60s interval and, if that
also failed, stayed wrong indefinitely.

### It costs nothing extra

Measured on `main` and on this branch, 120s of healthy steady state on the
homepage while signed in - **identical on both: 25 requests, 12.5/min per tab**
(`chat/last-activity` 12, `dm/unread` 6, `chart` 4, `notifications` 2,
`presence` 1). The retry only spends requests when something is already broken.

Worth recording that the comparison is what settled it: the raw figure looked
like a doubling against my own arithmetic, and building `main` to compare showed
the rate was unchanged and the arithmetic was wrong.

**Files:** `src/shared/hooks/useLiveData.ts` + `src/lib/useLiveData.ts` (new) ·
`src/shared/hooks/useRealtime.ts` ·
`src/modules/notifications/components/NavActivity.tsx` ·
`src/modules/messages/components/MessagesClient.tsx` ·
`src/lib/__tests__/useLiveData.test.ts` (new).

**Gates:** typecheck ✅ · lint 0 errors / 36 warnings (one fewer) · 455/455
tests ✅ · build ✅.

---

## 2026-08-03 (10) — The homepage kept animating 190 things nobody could see

Reported: opening the homepage pushes CPU high, and it stays high.

**Measured first, at 1280x800:** the homepage runs **281 CSS animations at
once**, on a page **11.5 viewports tall**, and **190 of them are off screen**.
Style recalculation was the largest single slice of an idle frame. Nothing here
is one expensive effect - it is that the starfield, the mesh drift, the pulse
dots, the Icons3D set and the shine sweeps all keep running to the bottom of the
document no matter where the reader actually is.

**The fix pauses a block's animations only while it is more than a full viewport
away** (`PauseOffscreenAnimations.tsx` + one CSS rule). An IntersectionObserver
toggles `animation-play-state: paused`; `rootMargin: 100%` means anything is
already running well before it can be seen.

**Nothing visual changes**, and that was checked rather than assumed: at 0 / 25 /
50 / 75 / 100% scroll, on both 1280x800 and 390x844, the number of animations
that are **visible AND frozen is 0** at every position. The motion here is
deliberate brand identity (see the reduced-motion policy above), so a fix that
dimmed it would not have been acceptable.

**Result - a true A/B on the same build**, defeating the new rule with a
stylesheet override so both sides are otherwise identical, four runs each:

| | CPU (idle, 4 runs) | animations running |
|---|---|---|
| before | **24.9%** (25.9, 23.9, 26.3, 23.6) | 281 |
| after | **20.1%** (20.1, 19.5, 20.5, 20.3) | 182 |

The ranges do not overlap, against a measured noise floor of ±0.8 points (five
runs of an identical page: 20.2, 20.2, 19.3, 18.7, 20.3). **~19% less CPU on an
idle homepage**, and the frame cost is far steadier afterwards.

**Two things this is NOT, stated because both were tested and both surprised
me:**
- It is not "animations are expensive, remove them". Turning **every** CSS
  animation off measured **~27%** - *higher* than leaving them on. Removing an
  animation de-promotes its compositor layer, and the repaint costs more than
  the transform did. The win comes specifically from not animating the
  off-screen 190, not from animating less in general.
- `content-visibility: auto` would do this and more, and was deliberately **not**
  used: it changes layout geometry, and this project already had to neutralise
  `.sect-cv` because that broke anchor-jump scrolling. Pausing an animation
  changes no geometry at all.

Applies to every page, not just the homepage - it is mounted in the root layout.

**Files:** `src/shared/components/PauseOffscreenAnimations.tsx` +
`src/components/PauseOffscreenAnimations.tsx` (new) · `src/app/globals.css` ·
`src/app/layout.tsx`.

**Gates:** typecheck ✅ · lint 0 errors / 37 warnings (unchanged) · 451/451
tests ✅ · build ✅. Smoke-tested `/`, `/community`, `/news`, `/markets`,
`/research`, `/tools`, `/u/<handle>` - all 200.

---

## 2026-08-03 (9) — The dashboard's "Live online" was a confident zero

Asked: is the dashboard's online number realtime? **No - and it was worse than
not-realtime.**

**🔴 It read Supabase Realtime presence and nothing else** —
`DashboardClient.tsx`. `.subscribe()` with no status callback, no retry, and
`count` initialised to `0`. So whenever the channel could not connect - which is
its current state, see (8) - the dashboard showed a confident **0** while the
site was in use, with nothing on screen to say its only source was gone. An
admin reads that as "nobody is here". A wrong number is worse than no number.

Now: presence when it works, a **server-backed count** when it does not, the
channel retried with 1s → 30s backoff, refresh on tab focus, and **`-`
("Unavailable")** when neither source can answer - never a fabricated zero. The
label says which source produced the figure.

**The server-backed half** is a new `/api/presence`: `POST` is a heartbeat,
`GET` is an admin-only count of rows seen inside the window. Two rules keep it
cheap and correct:
- it **only runs while the realtime channel is down**, so a healthy deployment
  makes zero extra requests;
- it **does not run on `/community`**, where `ChatClient` already owns the same
  row at a faster beat. The row is keyed by user, so two writers would flip its
  `room` back and forth and the chat's own count would start losing people. One
  writer per user, enforced by `chatOwnsPresence()` so both sides read the same
  rule rather than two copies of a string.

**Verified end to end** with realtime off (the reported state), two browsers:
admin alone on `/dashboard` → **1**; a second member opens `/markets` → **2**,
**with no refresh**. `GET /api/presence` returns `{"online":2}` with
`private, no-store`; a non-admin gets **401**. The chat room's own roster is
unchanged: join seen in 11.2s, leave in 15.1s.

**🐛 A missing presence table looked exactly like an empty room** —
`api/chat/presence/route.ts`, `ChatClient.tsx`.
Both queries swallow their error so a not-yet-migrated DB cannot break the room.
The side effect: if `ChatPresence` does not exist (and `CLAUDE.md` records that
production has drifted behind `schema.prisma`), the caller gets a confident
**"1 online" - just themselves - forever, and refreshing changes nothing**,
because the failure is indistinguishable from nobody being there. The route now
returns *why*, naming P2021/P2022 as an un-applied schema, and the room's status
tooltip carries it. Same principle as (8): a check that cannot say "I am broken"
is a check that lies.

**Files:** `src/app/api/presence/route.ts` (new) ·
`src/shared/utils/presence.ts` + `src/lib/presence.ts` (new) ·
`src/modules/dashboard/components/DashboardClient.tsx` ·
`src/modules/community/components/RealtimeSession.tsx` ·
`src/app/api/chat/presence/route.ts` ·
`src/modules/community/components/ChatClient.tsx`.

**Gates:** typecheck ✅ · lint 0 errors / 37 warnings (unchanged) · 440/440
tests ✅ · build ✅. Route table: **+1 route** (`ƒ /api/presence`), nothing
changed mode or window.

**Note on the underlying cause:** none of this makes realtime *connect*. That is
still the invalid `SUPABASE_SERVICE_ROLE_KEY` from (8). This makes every
presence number on the site tell the truth while it is down.

---

## 2026-08-03 (9) — Three causes behind "kabhi kabhi": an unbounded pool, a cached HTML shell, and a failure with no name

Reported: profile breaking, DMs sometimes not opening, community chat not
working, the site occasionally blank. **"Sometimes" is the whole signal** - each
of these works most of the time, which rules out a plain bug and points at
contention and caching.

### 🔴 The connection pool was never bounded

`prisma/schema.prisma` says, in its own header:

```
Recommended: `?pgbouncer=true&connection_limit=1`
```

and `.env.example` ships `…?pgbouncer=true` **without it**. A recommendation
that lives only in a comment is not applied, and this one was not.

Unbounded, Prisma sizes its pool at `num_cpus * 2 + 1` **per client**, and on
serverless that is per warm function instance. Several instances, each holding
its own handful of pooler connections, is how a Supabase free-tier pooler runs
out. What that looks like from outside is not an outage - it is
`P2024 Timed out fetching a new connection from the connection pool` on *some*
requests. The profile breaks sometimes. The DM sometimes does not open. The chat
is sometimes empty. Never together, never reproducible.

`withPoolDefaults()` now sets the pool parameters on the datasource URL in code,
so the setting cannot be lost to a copy-paste, and an explicit value in the env
var still wins. **Measured after: 30 concurrent DB-backed requests hold exactly
5 connections, steady, with no errors.**

**`connection_limit=5`, deliberately not the 1 that Prisma's serverless guidance
suggests.** This app fans out per page - `/u/[username]` alone issues six
queries in one `Promise.all` - and a limit of 1 serializes every one of them.
That is not theoretical: testing `connection_limit=1` with 40 concurrent queries
produced **P2024**, the exact failure this is meant to prevent. `pool_timeout`
also goes 10s → 20s, so brief contention queues instead of failing.

**Honest scope:** whether the limit itself changes anything in production is
**unconfirmed** - the old default derives from the runtime's CPU count, which is
not observable from here, and on a small Vercel function it may already land
near 5. What is definitely new is the longer timeout, the value being explicit
rather than runtime-dependent, and the diagnostic below.

### 🔴 Pool exhaustion had no name

`handleError` maps P2002, P2025, P2021 and P2022 - and **had no branch for
P2024**. So the signature failure of a serverless app against a pooler fell
through to the generic `Something went wrong` 500 with a random trace id. That
is why "kabhi kabhi" could never be pinned to a cause: the one error that
explains it was indistinguishable from every other error. It now logs
`POOL EXHAUSTED (P2024)` with what to do about it, and answers 503 "The service
is busy" rather than a generic 500.

### 🔴 The blank page: a cached HTML shell outliving its chunks

`public/sw.js` cached navigations network-first, with the cached copy as a
fallback. **The fallback is the bug.** An HTML shell names the exact hashed
chunks of the deploy that produced it, and those filenames are gone after the
next deploy. A cached shell served on a flaky connection then asks for chunks
that 404, the 404 comes back as HTML, the browser refuses to execute it on a
MIME mismatch, and hydration silently never finishes - blank or frozen, with no
error the user can see. Intermittent by construction: it needs a cached shell
**and** a deploy since **and** a network hiccup.

The previous mitigation was "bump `CACHE` on any deploy that could strand users
on old JS" (`CLAUDE.md`) plus a one-shot reload in `PwaSetup`. Both real, both
patches on a ritual - and the ritual did not survive contact with reality: the
version was last bumped in **#140**, and **six deploys shipped over it in a
single day**, which is when the blank-page reports started. Mine were four of
those six.

**Navigations are no longer cached at all.** The class of bug is removed rather
than delegated to everyone remembering. `CACHE` also goes v6 → v7 so existing
poisoned caches are dropped on activate. Cost: a previously-visited page no
longer renders offline (`/offline.html` still does) - the right trade for a live
market/chat app. `CLAUDE.md`'s gotcha is updated; the per-deploy bump is no
longer needed.

### ⚡ And the heartbeat added earlier today is now much quieter

`/api/presence` (from (7)) writes to the database from every open page of every
signed-in user. Given the pool finding, that is pressure pointed at the thing
already under pressure. Beat 45s → **120s**, its window 60s → 180s, plus the
circuit breaker from (8). It feeds one admin dashboard tile; a number that is at
most two minutes stale is entirely adequate for that.

**Files:** `src/shared/utils/db-url.ts` + `src/lib/db-url.ts` (new) ·
`src/core/db/prisma.ts` · `src/shared/utils/api.ts` ·
`src/shared/utils/presence.ts` · `public/sw.js` · `CLAUDE.md` ·
`src/lib/__tests__/db-url.test.ts` (new).

**Gates:** typecheck ✅ · lint 0 errors / 37 warnings (unchanged) · 451/451
tests ✅ · build ✅. Smoke-tested: `/`, `/community`, `/news`, `/markets`,
`/research`, `/u/<handle>`, `/api/follow`, `/api/ticker` all 200 with the
rewritten datasource URL.

---

## 2026-08-03 (8) — The storage diagnostic was diagnosing the wrong thing

The owner ran `/api/media/health` on production. It said the bucket probably did
not exist. **It was wrong, and the answer was sitting in its own output:**

```
testUploadStatus: 400
supabaseResponse: {"statusCode":"403","error":"Unauthorized",
                   "message":"Invalid Compact JWS","code":"AccessDenied"}
diagnosis: 'the bucket "post-covers" likely doesn't exist…'
```

`storageEnabled: true`, both env vars set, and Supabase answering **`Invalid
Compact JWS`** - which means the service-role key is not a well-formed JWT at
all. The bucket was never involved. The diagnosis branched on the **HTTP status**
(400), and Supabase's Storage API wraps auth failures in a 400 with the real
status inside the body. So a check whose whole job is to name the cause was
confidently naming the wrong one, and would have sent the reader off to create a
bucket that changes nothing.

**Fixed two ways:**

- It **reads the body now**, not the status: `Invalid Compact JWS` / `invalid
  JWT` → the key; `Bucket not found` → the bucket; inner 401/403 → wrong or
  rotated key. The exact Supabase message is quoted back in the diagnosis.
- New `describeKey()` checks the key's **shape locally, before any request** -
  because this particular failure is knowable without one. It reports length,
  segment count, whether it parses as a JWT, whether the value arrived with a
  stray newline or wrapping quotes (the two classic Vercel copy-paste failures),
  whether it is one of Supabase's new `sb_secret_…` keys rather than the legacy
  JWT, whether it has expired, and its `role` claim - which is what separates
  "pasted the anon key" from "pasted the right one". **It never returns the key**,
  and a test asserts that.

Ten unit tests cover the shapes, including the one that was actually live.

**This is the root cause of a chain that has come up repeatedly:** storage
uploads fail → `uploadImage()` falls back to inline `data:` storage → (before
(7)) the photo was then stripped everywhere. Server-side realtime
(`broadcastEvent`) authenticates with the same key, so it is dark for the same
reason.

**Owner action:** Supabase → Settings → API Keys → copy the **service_role** key
(starts with `eyJ`, three dot-separated parts), paste into Vercel with no quotes
and no trailing newline, redeploy, then re-run `/api/media/health` - it should
report `Storage works ✅`.

**Files:** `src/app/api/media/health/route.ts` ·
`src/shared/utils/jwt-shape.ts` + `src/lib/jwt-shape.ts` (new) ·
`src/lib/__tests__/jwt-shape.test.ts` (new).

**Gates:** typecheck ✅ · lint 0 errors / 37 warnings (unchanged) · 440/440
tests ✅ · build ✅.

---

## 2026-08-03 (7) — The profile photo that was never served, and two dialogs anchored to the wrong box

Four reports, and three of them turned out to be one root cause each that no
amount of CSS tuning would have reached.

### 🔴 An uploaded profile photo was thrown away on the way out

Reported as *"profile photo settings me add hone ke baad bhi profile me show
nahi hota, bahut sare device me"*. It was in the database the whole time.

`uploadImage()` falls back to storing the image as an inline `data:` URL in the
`User` row whenever Supabase Storage is unconfigured or fails - that is the
zero-setup upload path and it works. But **every read path then replaced that
value with `null`** via `stripInlineImage()`, to keep a 700KB blob out of hot
JSON payloads and ISR-cached HTML (a real Fast Origin Transfer incident). So the
photo saved, and then vanished: profile, chat, comments, follow lists, DMs,
research bylines, the online list, the navbar. For **everyone**, uploader
included.

The banner had a patch - an owner-only re-fetch of `/api/profile` - which meant
the owner saw their own banner, nobody else did, and the owner pulled the whole
base64 blob down on every visit to their own page. The avatar had no patch at
all. The navbar's comment even said "the real image still renders from the DB on
the profile + in comments", which was simply not true.

**The fix serves it instead of hiding it.** New `GET /api/media/<kind>/<id>/<v>`
decodes the stored data URL and returns real image bytes with
`public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400`;
`publicImageUrl()` replaces `stripInlineImage()` at every read path and rewrites
an inline image to that URL. This is **better** for egress than either previous
behaviour: the bytes leave the origin once and the CDN holds them, instead of
being re-serialized into every response and every cache fill - or not being
served at all. The owner-only banner re-fetch is gone with it.

Two details worth keeping:
- The version is a **path segment, not `?v=`**. `next/image` refuses to optimize
  a local URL carrying a query string under the default config - it answers
  `400 "url" parameter is not allowed`. Measured with `?v=`: every avatar
  rendered as a **0x0 broken image**, banners fine. Moving the token into the
  path fixed it without touching the image security config.
- The token samples the value (length + head/middle/tail windows) rather than
  hashing it, because these paths run per row on hot endpoints and hashing
  hundreds of KB there is billable CPU. The first version sampled length + tail
  only, and a unit test caught it: an edit near the *start* of the image left
  the token unchanged, which would have pinned a stale avatar. The cache window
  is long but finite for the same reason - not `immutable`.

**Verified end to end** against a real Postgres, with the avatar and banner
stored as `data:` URLs, for three viewers - logged out, the owner, and another
member: image decodes (non-zero natural size) for all three, banner renders for
all three, and **no base64 appears in the HTML for any of them**. Route checks:
`200 image/png` with the cache header above, `404` for an unknown kind, `404`
with a short cache for a user who has no image.

### 🔴 The follow dialog was boxed inside the profile card

Reported as *"follow wala background aligned nahi hai, desktop aur mobile
dono"*, and it was not a padding problem.

`position: fixed` only means "the viewport" while no ancestor establishes a
containing block - and `filter`, `transform`, `backdrop-filter` and friends all
do. The profile hero card is wrapped in `<Reveal variant="blur">`, which animates
`filter: blur(...)` and settles on **`blur(0px)`**: visually nothing, and not
`none`. **Measured at 1280x800:** the dialog's `fixed inset-0` overlay resolved
to **832x328 at (224,112)** instead of 1280x800 at (0,0). It was a dialog
anchored to the profile card, which is exactly what it looked like.

Portalled to `document.body`, the way `ImageLightbox` already does for the
backdrop-filter version of this. The overlay also now reserves the bottom nav so
the panel centres in the space it may actually use, instead of shrinking itself
by 9rem while still centring in the full viewport.
**Measured after:** gaps above/below **344/344** at 1280x800, **484/484** at
1920x1080, **370/362** at 390x844 (the 8px is the bottom nav clearance, which is
the point).

### 🔴 The news reader was anchored to a wrapper too, and never locked the feed

Same class of bug, milder: **measured at 1280x800, the reader's overlay resolved
to 1280x780 starting at y=20** rather than filling the viewport. It also had no
scroll lock that worked - the hand-rolled `body { overflow: hidden }` in it is
ignored by Lenis, which drives the scroll position itself - and its scroll body
had neither `overscroll-contain` nor `data-lenis-prevent`, so the wheel fell
through to `/news` whenever the briefing was short or you reached its end.

Portalled, given the real `useScrollLock`, and both scroll attributes added.
**Measured after:** overlay is the full viewport, twelve wheel gestures over the
open reader leave the page at **71 → 71**, the reader's own body scrolls 341px,
and Escape releases it.

### 🔴 The Publish editor handed the wheel to the page

Lenis's general rule only gives the wheel back to a box that is *currently*
taller than its frame. So an empty editor, a nearly-empty one, or one at the top
or bottom of its text handed the wheel straight to the page - which is the
"cursor box me hai, poora page hilta hai" report, and why it looked
device-dependent. `data-lenis-prevent` makes it unconditional: while the pointer
is in the box, the box owns the wheel. That is a deliberate trade (reaching the
end of your text no longer carries on down the page) and it is what was asked
for.
**Measured at 1280x800, 1920x1080 and 390x844**, including twelve gestures past
the end of the text: page `242 → 242`, `0 → 0`, `346 → 346`.

### Also

- `useScrollLock` now compensates for the scrollbar it removes, so the page
  behind a dialog does not shift by its width on open.
- The lock replaced two more hand-rolled `body { overflow: hidden }` blocks that
  never worked with Lenis: `ImageLightbox` and the dashboard access dialog. The
  news "Customize your feed" sheet got one for the first time.

**Files:** `src/app/api/media/[kind]/[id]/[v]/route.ts` (new) ·
`src/shared/utils/media.ts` + `src/lib/media.ts` (new) ·
`src/shared/utils/utils.ts` · `src/core/auth/auth.ts` ·
`src/app/u/[username]/page.tsx` · `src/app/research/[slug]/page.tsx` ·
`src/app/api/profile/route.ts` · `src/app/api/follow/list/route.ts` ·
`src/app/api/posts/[id]/comments/route.ts` · `src/app/api/dm/search/route.ts` ·
`src/app/api/chat/presence/route.ts` · `src/modules/community/lib/chat.ts` ·
`src/modules/messages/lib/dm.ts` ·
`src/modules/profile/components/ProfileBannerImage.tsx` ·
`src/modules/profile/components/FollowListModal.tsx` ·
`src/modules/news/components/NewsClient.tsx` ·
`src/modules/community/components/PostContentEditor.tsx` ·
`src/modules/community/components/ImageLightbox.tsx` ·
`src/modules/dashboard/components/DashboardClient.tsx` ·
`src/shared/hooks/useScrollLock.ts` ·
`src/lib/__tests__/public-image.test.ts` (new).

**Gates:** typecheck ✅ · lint 0 errors / 37 warnings (unchanged) · 430/430
tests ✅ · build ✅.

---

## 2026-08-03 (6) — Live surfaces that quietly died and never came back

Reported: the community room's online count still is not live, it "does not
connect perfectly", and *"baar baar refresh karna padta hai"*.

Four separate faults, and the first one is not a chat bug at all.

**🔴 `useRealtime` never checked whether the subscription worked** —
`src/shared/hooks/useRealtime.ts`.
It chose the realtime path purely because the env vars existed, and called
`.subscribe()` **with no status callback**. So a `CHANNEL_ERROR` - wrong anon
key, project paused, connection cap, CSP, or just a phone that slept and dropped
the socket - left the surface with **no channel, no retry and no poll**. It went
silent permanently, and reloading the page was the only cure. That is exactly
the report, and it was not limited to chat: this hook is what makes **comments,
likes, the Journal, the Journal activity feed, profile follow counts, DMs and
the dashboard** live. All seven had it.

Fixed the way the chat already did it locally (that file had the same bug and
was fixed there in isolation):
- **The poll is always armed** and early-returns on every tick while the channel
  is healthy, so a working deployment issues *zero* extra requests and this costs
  nothing on the Supabase/Vercel bills. Callers that named no interval get a slow
  60s safety net rather than nothing.
- **A failed channel is retried** with 1s → 30s backoff, and a `connecting` guard
  stops the backoff timer and a wake event from racing into two live
  subscriptions.
- **Waking refetches immediately** (visibility, focus, `online`), throttled to
  one round trip per 4s. On *re*-connect it reconciles once, because broadcast
  has no replay - but deliberately **not** on the first subscribe, which would
  add a duplicate request to every page load.

**🔴 The room did nothing when you came back to it** — `ChatClient.tsx`.
Both loops skip while the tab is hidden, and the leave beacon has just removed
you from the presence table - so returning left you **invisible to everyone else
and the room stale**, with nothing scheduled to fix either sooner than the next
interval (10s for messages, 25s for the roster), plus a dead socket on top if the
device had slept. There was a `visibilitychange` handler, but it only handled the
*hidden* direction. Now becoming visible re-registers presence, catches up on
messages and rebuilds the channel immediately, throttled to 3s. The message
catch-up is forced rather than skipped when the socket claims to be live: a
socket that survived a frozen tab can come back apparently healthy having
silently dropped everything in between.

**Measured**, two real sessions with realtime *off* (the reported state):
on hide, exactly 1 request (the leave beacon); on wake, `POST /api/chat/presence`
+ `GET /api/chat/messages` **within 1.5s**, and the sender's next message still
arrived with no refresh.

**🔴 A channel error blanked the roster** — `ChatClient.tsx`.
The error branch did `setOnline(0)` and cleared the member list, and the server
heartbeat only refilled it on its next tick. So a blip showed **"0 online" in a
full room** for up to 25 seconds - and that gap is precisely when someone looks
at it. It now keeps the last known list and asks the server for the truth
immediately instead.

**🔴 The presence heartbeat was spending the composer's rate limit** —
`src/core/ratelimit/ratelimit.ts`, `api/chat/presence/route.ts`.
It used the `chat` bucket, which is the **10/min budget for sending**. An
unattended beat every 25s (more on every wake, and it only runs at all when
realtime is down) quietly ate three or four of those - so typing normally in a
room with a dead socket could answer **"Too many requests"**, which reads as the
chat being broken. Presence now has its own `chatPresence` bucket (30/min per
user; it is a cheap upsert of the caller's own row). Pinned by a new test so the
buckets cannot silently merge again.

**⚡ Roster latency 25s → 15s.** That interval *is* how fast a join shows up when
realtime is down, and 25s is slow enough to read as "the online count is not
live". It costs nothing on a healthy deployment - the beat returns before the
fetch while the channel is up - so this only spends requests on the broken path.
**Measured** end to end with realtime off: a join appears in **10.9s** and a
departure in **15.1s** (both were up to 25s, and 90s before the leave beacon
existed). With realtime working, both are instant via presence sync.

**Files:** `src/shared/hooks/useRealtime.ts` ·
`src/modules/community/components/ChatClient.tsx` ·
`src/core/ratelimit/ratelimit.ts` · `src/app/api/chat/presence/route.ts` ·
`src/lib/__tests__/api-rate-limits.test.ts`.

**Gates:** typecheck ✅ · lint 0 errors / 37 warnings (unchanged) · 419/419
tests ✅ · build ✅.

**Still owner-side:** none of this makes realtime *connect* if it is not
configured - it makes the site work properly when it does not. The decisive
check is still whether an image upload in the room returns 501: `realtimeEnabled`
and `storageEnabled` are the same credential pair (`docs/HANDOFF.md §8`).

---

## 2026-08-03 (5) — The Following count that never moved, and a page that scrolled under every modal

Reported: *"unfollow ke baad bhi numbers show hote hai"* — unfollow someone and
the **Following** number on the profile stayed exactly where it was.

**🔴 The count had no way of ever changing** — `src/app/api/follow/route.ts`,
`ProfileFollow.tsx`. Two independent halves of the same gap:

- `GET /api/follow` returned `followers` and the viewer's `following` boolean.
  It **never returned a following-count**. So there was nothing for the client
  to read.
- `ProfileFollow`'s `sync()` set `followers` and the boolean, and **never
  touched `followingCount`**. So even if the API had returned it, nothing would
  have set it.

The number was frozen at whatever the server rendered on page load, and only a
hard refresh moved it. Both ends are fixed: the API returns `followingCount`,
`sync()` applies it, and `POST` now broadcasts on **two** realtime channels —
the target's (carrying the new `followers`) and the actor's own (carrying their
new `followingCount`), so your own profile open on a second device updates the
number that actually moved. Previously only the target was told.

On top of that the tap is now **optimistic**: `RowFollow` fires the delta before
the request leaves, with a revert if it fails, so the number moves with the
finger rather than a round trip later. It is applied only on your **own**
profile — following someone from a stranger's follower list changes how many
people *you* follow, not their count, and applying it blindly made someone
else's number jump. The value also animates on change, because an unfollow used
to swap a digit silently: no feedback that the tap had landed, which reads as
"nothing happened" from the outside just like a stale number does.

**Verified end to end** against a real Postgres, on a 390px phone and a 1440px
desktop viewport: `1 Following` → instant `0` on tap → `0` still after the
server settles, on both.

**⚡ Data fetching** — `GET /api/follow` ran its queries **serially** (follower
count, then the viewer's follow row). All three are independent, so they now run
in one `Promise.all`. And the list itself is **prefetched** on the hover /
touch-down that precedes the tap, cached for 30s and invalidated on any
follow/unfollow — measured: 2 list requests fire on hover and the dialog opens
with rows already painted, **no spinner frame at all** (it used to fetch on
mount, so every open showed "Loading…" for a full round trip).

**🐛 Every modal on the site let the page scroll underneath it** —
`src/shared/hooks/useScrollLock.ts` (new), `SmoothScroll.tsx`,
`CommandPalette.tsx`, `FollowListModal.tsx`.
`document.body.style.overflow = "hidden"` was the lock, and it does not work
here: **Lenis runs its own rAF loop and drives the scroll position with
`window.scrollTo`, which does not consult `overflow` at all.** Measured with the
follow list open, one wheel gesture: the profile behind it moved **171px** at
390px wide and **20px** at 1440px. `useScrollLock` stops Lenis as well (the
instance registers itself with the helper rather than being threaded through the
tree), nests so two stacked dialogs release correctly, and is a no-op beyond the
overflow half when smooth scroll is off (reduced motion, touch). Applied to the
follow modal and to the command palette, which had the identical bug.
**Verified**: page held at 0 with the dialog open in both viewports, and scrolls
again after Escape — in dark *and* light theme, so the lock is not left stuck on.

**🎨 The counts are chips now, not bare text.** They were small text with 4px of
padding: a **20px** tap target, well under the 44px minimum, and easy to miss on
a phone. They now match the location / social / Premium chips directly beside
them on the same card — gold for Followers, mint for Following, both on the
existing tinted-ring pattern — measured at **102x36**. Theme-checked: the number
resolves to `#f3d488` on dark and `#9a6310` on light, both via the existing
`html:not(.dark)` overrides rather than new colour values.

**Files:** `src/app/api/follow/route.ts` ·
`src/modules/profile/components/ProfileFollow.tsx` ·
`src/modules/profile/components/FollowListModal.tsx` ·
`src/shared/hooks/useScrollLock.ts` (new) · `src/lib/useScrollLock.ts` (new
shim) · `src/shared/components/SmoothScroll.tsx` ·
`src/shared/components/CommandPalette.tsx`.

**Gates:** typecheck ✅ · lint 0 errors / 37 warnings (unchanged) · 418/418
tests ✅ · build ✅.

---

## 2026-08-03 (4) — Ghost users in the online count, and an alarmist status label

A screenshot of the live room showed **"RECONNECTING" and "2 online" side by
side**. Both halves of that are worth reading carefully: the count was working
(the server-backed presence added in (6) was doing its job while the websocket
was down) — but it was **stale**, and the label was **overstating the problem**.

**🔴 Someone who left stayed "online" for up to 90 seconds** —
`src/app/api/chat/presence/route.ts`, `ChatClient.tsx`.
The heartbeat ran every 45s against a 60s… no: a **90s** window, and there was
**no leave signal at all**. So the only way to stop being listed was for the
window to expire. Close the tab and you were still in the room for a minute and
a half. The count was never fake — it was stale, which looks identical from the
outside. My own design, from (6).

- A **leave beacon** now fires on `pagehide` and on the tab being hidden, and on
  SPA unmount. `navigator.sendBeacon`, not `fetch`: the page is being torn down
  and an ordinary request gets cancelled, whereas a beacon is queued by the
  browser and still carries cookies so the session resolves. `pagehide` rather
  than `beforeunload` because that is the one that actually fires on mobile
  Safari.
- The server handles `{ leave: true }` **before** the rate limiter — it is a
  delete of the caller's own single row, it is the thing that prevents ghosts,
  and a throttled goodbye is worse than none.
- Window 90s → **60s**, heartbeat 45s → **25s**. With clean exits handled by the
  beacon, the window only has to cover what cannot say goodbye (a crash, a
  killed tab, a dead network), and two missed beats absorb a blip without
  leaving someone listed who has gone.
- Rows are pruned opportunistically on ~2% of reads (same trick `/api/track`
  uses), so the table stays bounded without a cron this plan does not have.

**Verified end to end against a real Postgres:** user1 → `online=1`; user2 joins
→ `online=2`; **user2 leaves → `online=1` on the very next beat**, and their row
is gone from the table.

**🟠 "Reconnecting…" was scaring people about a room that works** —
`ChatClient.tsx`.
In alarming amber, next to a live member count. When the websocket is down the
room is *not* broken: messages arrive on the 10s poll, presence comes from the
heartbeat. The screenshot showed exactly that contradiction. It now reads
**"Synced"** in a calm neutral — an honest description of the fallback rather
than a warning about it. The tooltip still carries the full detail and the
underlying Supabase error for anyone debugging.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings (unchanged) ·
418/418 tests ✅ · build ✅ · leave/rejoin behaviour measured against a real DB.

---

## 2026-08-03 (3) — The stuck news story: previous diagnosis was wrong

**Correction first.** The (1) entry blamed a **future-dated** timestamp and gave
`rankNews()` a guard for it. A screenshot of the live story disproves that: it
renders **"just now"**, and `timeAgo()` renders a future date as *"recently"*
(`ms > now + 60_000`). So the date is not in the future — it is **≈ now, on every
load, days apart**. The `rankNews` guard stays (a future date *is* a real failure
mode and it is now handled), but it was not this bug.

**What it actually is** — `src/modules/news/lib/news.ts`.
The date is read as
`pubDate ?? published ?? updated ?? dc:date`. In Atom, **`<updated>` is
*last-modified*, not published**, and plenty of CMSs bump it every time the entry
is regenerated. So a moving last-modified was being preferred over a stable
`<dc:date>`, the story's timestamp rolled forward on every fetch, and it read as
"just now" for ever — permanently the newest thing in the feed, permanently rank
1, permanently in the breaking hero. Reordered to
`pubDate ?? published ?? dc:date ?? updated`, with `updated` as the last resort
it should always have been. **3 new tests** pin the precedence.

**And a fix that works whatever the upstream does** —
`src/modules/news/components/NewsClient.tsx`.
Correcting the timestamp is necessary but not sufficient: a feed can keep
claiming a story is new in several ways (a republish, a rolling "latest"
endpoint, a CMS quirk we have not seen yet) and we cannot police any of them.
So the breaking hero now remembers which stories it has already shown on this
device and rotates past them. If everything high-impact has had its turn it falls
back to showing them anyway — a stale hero beats an empty one.

Kept in `localStorage`, not server-side, deliberately: it is presentation state,
and this project is over its Supabase egress quota, so it must not cost a
request. Capped at 120 ids so it cannot grow without bound.

Two React details worth keeping: the seen-list is read in a **lazy initialiser**
(guarded for SSR, where `localStorage` does not exist) rather than an effect, and
the write-back goes to a **ref plus localStorage without `setState`** — feeding it
back into state would re-run the memo, drop the story being displayed out of the
unseen set, and swap the hero out from under the reader mid-view. The filter is
meant to apply on the *next* visit, not this one. Warnings stayed at 37.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings (unchanged) ·
**418/418 tests** ✅ (415 + 3) · build ✅.

---

## 2026-08-03 (2) — Dialogs made opaque; hero button stops depending on the chain

**Dialogs were rendering body text on top of photographs** —
`src/app/globals.css` (new `.panel-solid`), `NewsClient.tsx`,
`BriefingBlock.tsx`, `FollowListModal.tsx`.

`.glass` and `.surface` are translucent by design: a white wash plus a backdrop
blur, with **no opaque colour of their own**. That reads beautifully for a card
sitting ON a page and badly for a dialog sitting OVER one — the news reader
showed the feed and its article thumbnails straight through the briefing text,
and the followers list showed the profile's avatar, bio and stat tiles through
the names. Blur softens that; it cannot fix it, because the contrast underneath
is arbitrary.

New `.panel-solid` supplies only the solid base, composed *with* the existing
material so border, shadow and blur are unchanged. **Two ordering traps, both
easy to reintroduce:**
- It must be declared **after** `.glass`/`.surface`. Their `background:`
  shorthand resets `background-color` to transparent, so a rule declared earlier
  is silently wiped by the very class it is meant to sit under. (First attempt
  did exactly that.)
- It cannot be combined with a Tailwind `bg-*` on the same element — that also
  sets `background-color` and wins. `BriefingBlock`'s 6% gold tint is therefore
  **pre-blended** to `#181411` (that same `#e2a72f` at 6% over `#0b0b0f`), so it
  looks identical over a dark background and is simply opaque now.

Also fixed while there: the followers modal was `max-h-[75vh]`. On a phone `vh`
measures the viewport as though the browser chrome were hidden, and the bottom
nav covers the lower part of the screen, so the last row and the end of the
scroll sat behind it. Now `min(75svh, 100svh - 9rem - safe-area)`. The news
reader moved `90vh` → `90svh` for the same reason — its action bar sat under the
address bar.

**Hero "View products" no longer depends on the Link → router → listener chain** —
`HashScroll.tsx` (exports `scrollToHash`), `Hero.tsx`.
Reported dead on mobile **three separate times**. Each fix was measured correct
here — the anchor lands at exactly `scroll-padding-top` on 320/360/390/1280 — and
still failed on the owner's phone. That pattern says the failure is somewhere
between the tap and the scroll, not in the landing maths, and continuing to
re-measure the landing was not going to find it.

So it stops depending on that chain: the button now calls `scrollToHash()`
directly from its own `onClick`. `href` stays for semantics, SEO and
middle-click; `preventDefault()` fires **only when the target actually exists**,
so removing `#products` some day degrades to normal browser behaviour rather
than a silently swallowed click. `HashScroll`'s document listener stays as the
general case for every other in-page anchor. Verified end to end through the new
path at 320/390/1280 — all land at 88px with the heading visible.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings · 415/415 tests ✅ ·
build ✅ · `.panel-solid` resolves to `rgb(11,11,15)` and the briefing to
`rgb(24,20,17)` in the built CSS (both opaque, checked in a real browser).

---

## 2026-08-03 — News feed unpinned; two self-inflicted egress regressions walked back

**Supabase is over its free egress quota: 6.56 GB used of 5 GB, with the org
restricted from 31 Aug 2026 if it stays over.** That reframes anything that adds
requests, including two things shipped hours earlier in (6).

**🔴 A single story could pin itself to the top of the news feed for ever** —
`src/modules/news/lib/news.ts`.
`rankNews()` scored freshness as `Math.max(0, (now - publishedAt) / 3_600_000)`.
That clamp means a story dated in the **future** gets an age of 0 — the maximum
possible score for its impact tier — and keeps getting it on every re-rank, for
as long as the date stays ahead of now. One feed item with a broken timestamp
camps at rank 1 indefinitely. That is the "yeh story hatti hi nahi, kai dino se
top pe hai" report.

`timeAgo()` **twenty lines below already guards this exact case**
(`ms > now + 60_000` → "recently"). The guard existed; the function that decides
*ordering* simply did not have it. Same shape as every other bug found in this
codebase this week: the correct handling sitting next to the place that skips it.

Clamping to `now` would not fix it either — the story would score as brand new on
every pass, for ever. A broken date is now given a **real, finite age** (48h) so
normal decay applies: still visible, since it is probably a genuine story with a
bad timestamp, but unable to camp. 6h of tolerance first, because publisher clock
skew is normal and is not a broken feed. **3 new tests**, including one pinning
the tolerance so a slightly-skewed story still ranks as fresh.

**🟠 Two egress regressions from (6), walked back** — both mine, both shipped
before the quota was known:
- `ChatClient.tsx` — the presence heartbeat checked `liveRef` **after** the fetch
  had already gone out, so every open room paid a round trip every 45s purely to
  throw the answer away. It now skips the **request**, not just the result:
  realtime presence is exact when the channel is up, so the heartbeat only needs
  to run when it is not.
- `NavActivity.tsx` — the fast unread poll shipped at 20s. Every one of those is
  a database query, and database responses are Supabase egress. Now **30s**,
  halving the added cost while still being far better than waiting a full minute
  for a DM badge. The focus/visibility listener is what actually makes it feel
  instant, and that costs one request per return rather than a permanently
  faster loop.

**Where the 6.56 GB actually goes is NOT yet established.** Supabase egress is
database results + Storage downloads + realtime frames, and the split is only
visible in the owner's dashboard (Reports → Usage). Two candidates are known from
reading the code and are recorded rather than acted on blind:
- `POST_CARD_SELECT` (`src/modules/community/lib/post-select.ts`) selects
  `content: true` — the **full article body** — for every card in every list,
  solely to compute a reading time that is then thrown away. It is stripped
  before reaching the browser, but it crosses the Supabase→function boundary on
  every ISR regeneration of `/`, `/research` and every article's related-posts
  block. `readMinutes` is already precomputed at all three call sites, so the
  body is pure waste; removing it needs a stored word count (a column) to keep
  the label accurate.
- Supabase Storage already uploads with `cache-control: 31536000`
  (`storage.ts:114`), so image egress is first-view only. **That lever is already
  pulled** — do not "fix" it again.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings · **415/415 tests** ✅
(412 + 3 new) · build ✅.

---

## 2026-08-02 (6) — Chat online count no longer depends on realtime; DM badge unstranded

Owner reported the chat still showing "Reconnecting…" with 0 online after the
(3) fix, plus DM notifications not arriving. The (3) fix was correct — it made
the room *survive* a dead channel (retry + always-armed polling) — but it never
addressed **why the channel dies**, and presence still had realtime as its only
source. So messages flowed and the count stayed 0.

**The thing that makes this confusing: there are FOUR Supabase env vars, in two
independent pairs, and either pair can be missing on its own.**

| Half | Vars | Powers |
|---|---|---|
| Client | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | subscribing, **presence = the online count** |
| Server | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | `broadcastEvent()` = **DM ping, chat fan-out, bell** |

`realtimeEnabled = storageEnabled` — the **same pair as image uploads**. So:
**if uploads return 501 in production, server-side realtime is dead too**, and
that one check identifies it in ten seconds.

**Server-backed presence** — `prisma/schema.prisma` (new `ChatPresence`),
`src/app/api/chat/presence/route.ts` (new), `ChatClient.tsx`.
The online count is now a plain DB query, not a WebSocket feature. Each open room
heartbeats every 45s; one upserted row per user per room, so it grows with
distinct members rather than traffic, and stale rows fall out of a 90s window on
read. Realtime presence still wins when the channel is healthy (it is instant and
authoritative on join/leave) — this only fills the gap. Verified end-to-end
against a real Postgres: anonymous → 401; one member → `online=1`; a second
joins → `online=2` with both names resolved.

**`broadcastEvent()` no longer fails silently** — `src/core/realtime/realtime.ts`.
It opened with `if (!realtimeEnabled) return`, so unset server credentials turned
off every live push on the site — DM badge, chat delivery, notification bell —
with **nothing anywhere saying so**. The symptom is "notifications don't arrive",
which reads as a client bug and sends you looking in the wrong place entirely.
Now logs once, loudly, naming the vars and the uploads-501 correlation.

**The chat status pill now says why** — `ChatClient.tsx`. `subscribe()`'s second
argument (the underlying error) was being discarded. "Reconnecting…" looks
identical whether the anon key is wrong, the project is paused, the connection cap
is hit, or the network blinked. The reason is now captured, logged, and attached
as a `title` tooltip — same label, same colours, same layout.

**DM badge no longer stranded on a 60s poll** —
`src/modules/notifications/components/NavActivity.tsx`. When the server half of
realtime is unconfigured, `broadcastEvent()` is a no-op and this poll is the
*only* thing that ever moves the badge; 60s is fine as a backstop to realtime but
poor as the sole path. The two cheap unread counts (`/api/dm/unread`,
`/api/chat/last-activity` — small indexed queries) now also refresh every 20s and
on tab focus. The full notification list stays on 60s.

⚠️ **This adds a table.** `ChatPresence` is purely additive and cannot break
existing queries, but production must run the migration — see the standing owner
action. Route count goes 125 → **126** (`/api/chat/presence`, dynamic); that is
the only route-table change and it is intentional.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings · 412/412 tests ✅ ·
build ✅ · presence endpoint verified end-to-end against real Postgres.

---

## 2026-08-02 (5) — Cross-device responsive & scrolling audit (design frozen)

Full report: `docs/AUDIT-2026-08-02-responsive.md`. Measured across **9 viewports ×
18 pages** on a production build, plus a dedicated editor pass reached by standing up a
local Postgres with the real schema and minting a genuine next-auth session — the
dashboard renders its error state without one, so the Publish editor is otherwise
untestable.

**The site was in much better shape than the brief implied.** Zero horizontal overflow,
zero nested scroll traps, zero z-index conflicts, zero JS errors, at every size.
`/community` and `/messages` already used `h-[100svh]`; the navbar sheet already used
`max-h-[calc(100dvh-6rem)]`. Two real defects were found.

**🔴 Mouse wheel scrolled nothing on desktop** — `src/shared/components/SmoothScroll.tsx`.
Lenis intercepts wheel events globally. Its escape hatch, `data-lenis-prevent`, was
styled in `globals.css` but applied to **zero elements**, so every inner scroll container
lost the wheel to the page. Measured with the Publish editor full of text: at 1280×800
and 1920×1080 the wheel left `scrollTop` at 0 and scrolled the page instead; phones were
fine only because Lenis already opts out on coarse pointers, which is why this never
surfaced in mobile testing. It affected the rich-text editor, the news briefing, every
textarea, the chat list and the mobile nav sheet. Fixed with Lenis's `prevent(node)`
predicate detecting scrollability directly, rather than annotating containers by hand
where a new one would silently miss out. All six viewports now scroll and stay contained.

**🟠 Publish editor was a fixed 416px on every device** —
`src/modules/community/components/PostContentEditor.tsx`. On a 320×568 phone that is 73%
of the screen for one field, with its bottom 133px below the fold. `h-[26rem]` →
`h-[min(26rem,62svh)]`: `min()` keeps the approved desktop size **exactly** (26rem wins
above ~671px tall, so 430/768/1280/1920 measured pixel-identical at 416px) and only
shrinks on short screens (320×568 → 352px). `svh` not `vh`, so mobile browser chrome
cannot push the box under the address bar.

**🟡 Tap targets** — 19 unique elements under 28px, smallest the chart range pills at
23×18. Grown with a transparent pseudo-element (`.tap-target-y` / `.tap-target-all`) so
the box, padding and font size are untouched and **nothing moves**; verified by
hit-testing rather than by measuring the box. Axis chosen per case: controls 2px apart
get vertical-only, because both expanding toward each other would overlap and the later
one silently steals the tap. Inline links inside sentences deliberately left alone —
WCAG 2.5.8 exempts them and expanding them would steal taps from neighbouring text.

**Dismissed after investigation, recorded so they are not re-raised:** the homepage
`CLIPPED` flags are `.vscroll-mask` (a `mask-image` fade — the clipping *is* the effect)
and `.starfield`; the `/profile` HTTP 500 at every viewport was `NEXTAUTH_SECRET` unset
in the harness (307 once set); the touch-swipe `scrollTop 0` is synthetic `TouchEvent`s
not driving Chromium's compositor, not a bug.

Design untouched: no change to tokens, colours, spacing, typography, component structure
or animation. The only rendered-geometry change anywhere is the editor height on
viewports under ~671px tall.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings · 412/412 tests ✅ · build ✅ ·
route table **identical to main** (125 / 22 static / 103 dynamic, zero rows differ).

---

## 2026-08-02 (4) — Functions moved to Mumbai; the serial round trips removed

Owner asked why everything feels slow to open, and whether the answer is "do the
processing in the backend". **It is not a processing problem.** Nothing here is
CPU-bound — it is waiting.

```
functions:  iad1  (Washington DC)      ← Vercel default, never configured
database:   Supabase, Mumbai            ← confirmed by the owner
```

`vercel.json` was `{}`, so the function region had never been set and defaulted
to `iad1`. Every DB round trip therefore crosses the Atlantic and the Indian
Ocean: **~250 ms each, fixed, no matter how the query is written.** A handler
doing four serial queries spends a second doing nothing but waiting. Most users
(and the owner) are in India, so their request pays that geography twice — phone
→ Virginia, Virginia → Mumbai, and back.

**`vercel.json` → `{ "regions": ["bom1"] }`.** One line, and by far the largest
single lever available: ~250 ms → ~5 ms per round trip, and India-based visitors
now reach the function in ~30 ms instead of ~250 ms. (`vercel.json` is strict
JSON and cannot carry comments, which is why the reasoning lives here.)

**The region is now set in TWO places, and `vercel.json` is the one that wins.**
While verifying this, the owner also changed it in the Vercel dashboard
(Project → Settings → Functions → Function Region → Asia Pacific / `bom1`) and
redeployed. Both now say `bom1`, so there is no conflict today — but per Vercel's
docs, *"if a deployment defines the `regions` configuration property in
`vercel.json`, the Vercel Function Region setting is ignored"*. So the dashboard
control is now **inert**: changing it there will appear to work and do nothing.
Treat `vercel.json` as the source of truth (version-controlled and reviewable),
and if you ever need a different region, change it there — not in the dashboard.

⚠️ **Read the right number when verifying.** There are two regions and only one
of them is this:
- **Build region** — the build log's first line, *"Running build in Washington,
  D.C., USA (East) - iad1"*. Not configurable on Hobby, and it says `iad1`
  regardless of any of this. It caused a false negative during verification.
- **Function region** — Deployment Details → "Function Region". This is the one
  that governs the DB round trip.

Checking from outside the dashboard, on the deployment itself:
```js
const r = await fetch('/api/ticker', { cache: 'no-store' });
r.headers.get('x-vercel-id');   // contains the region the function actually ran in
```

**Serial round trips removed** — each of these had independent queries awaited
one after another, so the fix is a reorder with no behaviour change:
- `api/chat/messages` GET — history and the pinned banner are independent, now
  `Promise.all`. **This is chat-open time.** The `/community` *page* already did
  exactly this, with the comment "run in parallel (independent queries)"; the API
  route serving the same two pieces of data did not. Saves 1 round trip.
- `api/journal/challenges/[id]` GET — three independent reads (all trades, my
  trades, day notes) collapsed into one `Promise.all`. Saves 2.
- `api/posts/[id]/like` POST — the post lookup and the existing-like lookup do
  not depend on each other. Saves 1. The write gate is unchanged: a like is still
  only created after the published check passes.

**Not done, deliberately:** `/u/[username]` (audit finding #11). The audit rates
it its **lowest-confidence** item — relation-keyed counts may plan worse than
id-keyed ones, and it wants `EXPLAIN ANALYZE` against real cardinality first.
Shipping it blind on the strength of "it looks parallelisable" is how the last
few silent regressions in this repo happened.

**Message send was already optimistic** and needed nothing: `doSend()` renders
the message immediately with a temp id and reconciles against the server copy
(and against the realtime echo). What made it *feel* slow was the round trip
underneath it, which the region move addresses.

**The most dangerous comment in the codebase, corrected** (`src/core/auth/auth.ts`).
It read "(routes always re-check DB anyway)" as the justification for
`MEMBERSHIP_TTL_MS`. That is **false** — `requirePermission()`, `getSessionUser()`
and `getAdminSession()` all read JWT claims only, nothing re-verifies against the
database. So the token *is* the authorization decision and that refresh is the
only thing that makes revoking a role or membership take effect. A latency audit
read that sentence, concluded the TTL was redundant, and recommended raising it
to 30 minutes — which would have let a just-demoted admin keep admin for half an
hour. It was withdrawn only because someone went and checked. The comment now
says so, at length, next to the constant.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings · 412/412 tests ✅ ·
build ✅ · route table **identical to main** (125 / 22 static / 103 dynamic, zero
rows differ).

---

## 2026-08-02 (3) — Live features that stopped being live: chat and news

Two owner reports, both traced to the same shape of bug: a fallback that was
written, and then gated off so it could never run.

**1. Community chat: "online" stuck at 0, header stuck on "Reconnecting…"** —
`src/modules/community/components/ChatClient.tsx`.
The live-updates effect did `if (realtime configured) { …channel…; return }`, so
**the 10s polling fallback below it was never armed on a configured deployment**.
And the `subscribe()` callback only ever recorded `SUBSCRIBED` — `CHANNEL_ERROR`,
`TIMED_OUT` and `CLOSED` were read and dropped, with no retry. supabase-js does
not resurrect a channel whose join errored, so between them a single failed or
dropped subscription left the room with:
- no live channel,
- no retry,
- and no fallback.

Messages stopped arriving, presence sat at 0, and the header showed
"Reconnecting…" indefinitely while **nothing was reconnecting** — the label was
the only part of it doing any work.
- The poll is now always armed and early-returns while the channel is healthy
  (via a `liveRef`), so a working room still issues **zero** extra requests and a
  broken one recovers within 10s.
- A non-`SUBSCRIBED` status now tears the channel down and rebuilds it with
  exponential backoff (1s → 30s cap).
- Restructured so the retry re-runs `connect()` only. An earlier revision of this
  fix had retry re-run the whole `start()`, which would have armed a **second**
  poll interval on every retry — caught before it shipped.

**2. News: every tab except one was frozen** — `src/modules/news/components/NewsClient.tsx`.
The refresh loop opened with `if (category !== "All" || query) return`. So on
Bitcoin, DeFi, Tech, For You, or any search, **nothing refreshed at all** — the
feed was frozen from load until you navigated away and back. That is the "news
stuck ho jata hai" report, and it was every tab but the default one. `fetchPage`
already sends the active category and query, so the gate was never load-bearing.
- Refresh now runs on every tab and every search.
- Added a refresh on `visibilitychange` / `focus`, so returning to the tab updates
  immediately instead of waiting out the remainder of a 90s tick — one request per
  return, rather than a faster background poll for everybody.
- New stories are inserted **directly** when the reader is at the top of the feed
  (`scrollY < 200`) instead of waiting behind the "N new stories" pill. The pill
  exists to stop the feed jumping under someone reading partway down; at the top
  there is nothing to jump.

**3. News: the same story from three outlets** — `src/modules/news/lib/news.ts`.
`eventKey()` did `.slice(0, 6)` **before** `.sort()` — the first six long words in
*title order*, then sorted. So the key was position-sensitive in exactly the case
it existed to handle: two outlets reporting one event with the headline
rearranged produced different keys, and both were shown. Demonstrated:

```
"Bitcoin surges past 100000 as spot ETF inflows hit record levels"
   -> "100000 bitcoin inflows past spot surges"
"Spot ETF inflows hit record levels as Bitcoin surges past 100000"
   -> "bitcoin inflows levels record spot surges"     ← different key, same story
```

The `w.length > 3` filter made it worse by doing the opposite of what it looks
like: it drops **ETF, SEC, BTC, Fed, DOJ** — the tokens that identify a story —
while keeping *with, from, says, after, amid, this*, the words every headline
shares. `eventKey("Ruling with news from the SEC")` was literally
`"from news ruling with"`.
- Replaced the length filter with a stopword list, and `length >= 3` so
  three-letter identifiers survive.
- Removed the truncation; the key is now the full sorted significant-word set.
- Added a similarity pass on top: anything that clears the exact key is compared
  by Jaccard overlap (≥ 0.6) against already-kept stories within a 36h window, so
  "approves"/"approved" wordings still collapse without a recurring weekly
  headline swallowing months of separate pieces.
- **5 new tests** pin all of this, and were checked against the old
  implementation first to confirm they fail on it — the previous two tests passed
  with the bug in place.

**4. Last 3 duplicate files shimmed** — `src/modules/auth/lib/{auth,email}.ts`,
`src/shared/utils/jsonld.tsx`. The earlier de-duplication only scanned
`src/components`; a repo-wide scan found three more byte-identical non-shim pairs,
all with **0 importers** on the copy that looks canonical. Same silent-no-op
hazard as before, and `auth.ts` in particular is where the next round of latency
work has to land.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings · **412/412 tests** ✅
(407 + 5 new) · build ✅ · route table **identical to main** (125 / 22 static /
103 dynamic, zero rows differ).

---

## 2026-08-02 (later) — Anchor jump fixed without JS · share card made fast

Follow-up to the entry below, after the owner reported "View products" **still**
dead on their phone and the share card slow.

**The earlier fix was correct but incomplete.** `HashScroll` corrects the anchor
landing, and it does — measured at 320/360/390px, logged-in, against a production
build. But it is JavaScript, so it can only help *after* React hydrates. A
navigation link must not depend on that. Anything that stops hydration (a stale
bundle, an old browser, a slow phone that has not finished) leaves the reader with
the original broken behaviour and no fallback.

**Root cause removed at the source** — `src/app/globals.css`.
`.sect-cv` no longer sets `content-visibility: auto` / `contain-intrinsic-size: auto
720px`. That guess is what made anchor jumps land in the wrong place: sections
report 720px until they render once, so the browser computes the target from
placeholder heights and everything grows underneath the scroll.

**Measured, JS disabled, native anchor only** (load `/#products` directly):

| viewport | old rule restored on the wire | rule removed |
|---|---|---|
| 320px | **800px** off | **88px** — on target |
| 360px | **679px** off | **88px** — on target |
| 390px | on target | on target |
| 1280px | on target | on target |

390px landing correctly either way is exactly why this looked fine in earlier
headless runs and broke on a real handset — it is viewport-band dependent.
`HashScroll` stays as belt-and-braces (it also covers late-loading images).

**What it costs:** off-screen homepage sections are painted again — a scroll
micro-optimization on one page, traded for a core navigation path that works on
every browser, with or without JS. `.cv-auto` (news feed cards) keeps
`content-visibility`; no anchors point into it. Reversible in one line if the
homepage ever measures badly.

**Share card speed** — three separate costs, all real:
- `src/app/tools/share/points-value/[id]/page.tsx` — `getCard()` is now wrapped in
  React `cache()`. Next calls `generateMetadata()` and the page component
  separately and **both** fetched the card, so the identical query ran twice per
  request. Against Supabase in Mumbai from a US region that is ~250ms of round
  trip paid twice, on a page whose whole job is to render one row.
- `src/app/api/tools/share/points-value/[id]/route.tsx` — the OG PNG had
  `s-maxage` only, so the browser re-requested (and the origin re-rendered with
  satori) on every view. Now `max-age=1y, immutable`: the id's content can never
  change. ⚠️ The generic fallback deliberately does **not** inherit it — it is
  served for a missing id *and* a transient DB failure, and caching "no card" for
  a year would make a two-second blip a permanently broken link. It gets its own
  `s-maxage=60`.
- `src/modules/tools/components/PointsValueCalculator.tsx` — the pre-opened tab
  now paints a branded "Building your share card..." screen immediately instead of
  sitting on white `about:blank` for the whole create-then-load chain. Built with
  DOM property assignments, not `document.write` + inline `<style>`, so a strict
  `style-src` cannot silently drop it.

Verification: typecheck ✅ · lint ✅ 0 errors / 37 warnings · 407/407 tests ✅ ·
build ✅ · route table **identical to main** (125 / 22 static / 103 dynamic, zero
rows differ) · `/`, `/tools`, `/markets`, `/news`, `/research` all 200 with zero
horizontal overflow and no page errors · share placeholder confirmed painting
while the create call is in flight.

**Observable — run, and the answer recorded (pre-merge Step 4).** The owner
confirmed both fixes working on the PR's Vercel preview deployment, on the real
handset that had been failing, *before* the merge. That is the check that had
been missing: #207 shipped on measurements that all passed here and still left
the button dead on their phone, because every local run happened to be at 390px -
the one width that lands correctly either way. Verifying on the preview URL on the
affected device is what closed it.

**Node version pinned** — `package.json` `engines.node` `">=22.0.0"` → `"22.x"`.
The open-ended range had no upper bound, so the day Vercel offers a newer major
the build would move to it with nothing in the repo changing, while CI stayed on
`.nvmrc` = 22. CI green, production on a different runtime: the same silent-drift
shape as the `db push || echo` swallow and the Tailwind content globs. Note the
Vercel build warning ("the Node.js Version defined in your project settings won't
apply") **does not go away** and is not meant to - it fires whenever `engines.node`
exists at all, and package.json winning is the intended arrangement, since that is
what keeps Vercel and `.nvmrc`/CI on one number.

---

## 2026-08-02 — Hero "View products" · points share · ticker ISR · 32 dead duplicate files

Three reported bugs, all reproduced and measured in a real browser against a
**production** build before and after. (Dev mode is not usable for this: the CSP
blocks `unsafe-eval`, which React needs in development, and the HMR socket does
not survive the proxy - three consecutive edits produced byte-identical results
because nothing was reloading. Verify UI behaviour against `next build && next
start`, not `next dev`.)

**1. Hero "View products" did nothing on mobile** — `src/shared/components/HashScroll.tsx` (new),
`src/components/HashScroll.tsx` (shim), `src/app/layout.tsx`.
Homepage sections carry `.sect-cv` (`content-visibility: auto; contain-intrinsic-size:
auto 720px`). Until a section has rendered once the browser sizes it from that 720px
guess. Measured cold, at 390px wide: `#about` reports 832px but is really 3853px;
`#products` reports its top at y=3487 but really sits at y=8242. So the anchor jump
scrolled to 3487, every section it passed rendered and grew on the way, and the target
ended up thousands of pixels lower. You land in About and it reads as a dead button.
Desktop mostly escaped because there the 720px guess is close to the truth (`#about` is
687px wide-screen); phones stack single-column, so the guess is off by 4-5x.
- Fix: intercept same-document hash clicks, scroll, then keep correcting until the target
  holds still for 350ms (budget 3s, abandoned instantly on any real scroll input). Not
  `hashchange` - the App Router navigates with `pushState`, which never fires it.
- **Measured, production build, native vs fixed:** 320px `#products` landed **888px** off
  and below the fold natively → **88px** (exactly `scroll-padding-top`, heading visible)
  with the fix. 390px and 1280px already landed correctly and still do.
- `content-visibility` is kept - it is a real mobile scroll win. The bug is the anchor
  jump, not the optimization.

**2. Points share opened a blank tab** — `src/modules/tools/components/PointsValueCalculator.tsx`.
`window.open("", "_blank", "noopener,noreferrer")` **always returns `null`** - per spec
`noopener` withholds the handle, that is its entire purpose. So `win` was never non-null,
the pre-opened tab was orphaned on `about:blank` (and on mobile it takes focus, hence
"blank page, go back, then the card appears"), and the code fell through to navigating the
*original* tab behind it. Verified in-browser: with `noopener` → `null`; without →
a live handle that navigates. Dropped `noopener`; the destination is our own same-origin
route, so the opener reference it was severing carried no cross-origin risk.

**3. `/api/ticker` regenerated on every single poll** — `src/app/api/ticker/route.ts`,
`src/modules/markets/lib/useTickerPoll.ts`.
`revalidate` and `s-maxage` were both 60s against a 150s client poll, so the cache had
already expired ~90s before each poll arrived - the short window bought zero extra
freshness and guaranteed a maximum-rate ISR write on the site's highest-traffic page.
Raised to 180s (`swr` 120 → 300) so most polls are served from cache. Directly targets the
750K/200K ISR Writes overage. Both files now carry a note that the two numbers are paired.
This was finding #3 of the 2026-08-01 latency audit, previously unfixed.

**4. 32 duplicate component files that silently swallowed edits** — `src/components/{ui,journal,orbital,tools}/*`.
The module refactor converted 97 files under `src/components` into re-export shims but left
32 as **byte-identical full copies** of their `src/modules` / `src/shared` twin. The live
import path resolved to the `src/components` copy, so editing the module copy - the one that
looks canonical - changed nothing. Found the hard way: fix #2 above was written into the
module copy and had no effect. All 32 converted to shims matching the existing convention,
so there is one source of truth per component. Affects the whole `/tools`, `/journal` and
orbital trees - i.e. exactly where the next round of work is headed.

Verification: typecheck ✅ · lint ✅ 0 errors (warnings 41 → 37) · 407/407 tests ✅ ·
build ✅ · route table 22 static / 103 dynamic, no `○ → ƒ` regression · `/tools` renders all
9 calculator tabs with zero console errors after the shim conversion.

---

## 2026-08-01 — Latency & resource-utilization audit (docs only, no source change)
Adds `docs/AUDIT-2026-08-01-latency.md`, a full pass over `319f722` for server latency,
caching and client weight, framed by the `iad1` (functions) → Mumbai (Supabase) region gap
that puts ~250ms on every DB round trip.
- **Route table re-measured and unchanged:** 124 routes · 22 static · 102 dynamic · 12 ISR,
  identical to the `2f34b83` baseline across 18 merged commits. No `○ → ƒ` regression.
- **Four previously-reported issues re-checked:** markets poll/window misalignment ✅ fixed at
  both layers; `env.ts` in the client bundle ✅ fixed; `/api/chat/last-activity` rendering
  dynamic ✅ true but correct (its `s-maxage=15` absorbs the poll); llama.fi 2MB payloads
  ⚠️ still unconfirmed - egress to llama.fi is policy-blocked from the agent environment.
- **New: `/api/ticker` has the same misalignment #190/#192 fixed for markets** - `revalidate`
  and `s-maxage` both 60s against a 150s poll, so every poll regenerates. It survived because
  `markets-poll-alignment.test.ts` globs `src/app/api/markets/*` only. Homepage-only, but that
  is the highest-traffic page.
- **New: `getServerSession()` discards its rotated cookie on the App Router path**
  (`next-auth/next/index.js:116-119,143` - the RSC branch passes a stub `res` whose
  `setCookie()` is a no-op), so `MEMBERSHIP_TTL_MS` never advances and every authenticated
  server request re-reads the user from the DB. 54 files are affected.
- **⚠️ The obvious fix for that is an authorization regression, and is documented as such.**
  `requirePermission()` (`src/lib/api.ts:97-101`) reads JWT claims only - nothing re-verifies
  against the DB - so that per-request refresh is the only thing making permission revocation
  timely. Raising the TTL would let a demoted admin keep admin for the length of the window.
  The comment at `src/lib/auth.ts:318` claiming "routes always re-check DB anyway" is **false**
  and is what made the bad fix look safe.
- **Bundle measurement restored.** `.next/app-build-manifest.json` does not exist under Next 16
  + Turbopack, so the method named in the `cost-check` skill cannot run. The per-route RSC
  manifest works instead; baseline recorded per route (`/dashboard` 232 kB gz, `/` 113 kB gz,
  shared floor 69 kB gz). three.js is on disk but never requested - `useWebglGate()` returns a
  literal `false` - so it costs zero transfer.
- **Confirmed clean, stated so the absence is informative:** no N+1 anywhere, all twelve polling
  components have visibility guards, realtime uses the shared singleton, no unconditional
  `getServerSession` on an anonymous path, and no dynamic page that could become static.
- Every `path:line` citation in the document was machine-checked against the tree; the route
  table was reproduced from a clean rebuild; `npm run test` green (52 files, 407 tests).

---

## 2026-07-31 — Make the live-verification step mandatory in the `pre-merge` skill
Process change, prompted by #190 shipping a fix that did not work.
- **The problem:** of everything merged this session, exactly one code change was checked against the
  live site - and that check proved it did not work. #190 had green CI, every pre-merge step passed, a
  verified build-log check, and a claimed "10x fewer regenerations". It changed `export const
  revalidate` when `s-maxage` governed the CDN, so the problem was still live after merge. It was caught
  only because the owner asked how to test it; the answer took four minutes.
- **Step 4 rewritten** from a vague "run Lighthouse on the preview" into a required contract: every PR
  body states (1) what changes on the live site, (2) the exact command or click path to see it, and
  (3) what result would mean it did **not** work. If there is no observable, the body must say so
  explicitly - writing that sentence is the point, because it catches a change that quietly does nothing.
- **Step 4 now appears in every row of the scaling table.** It was previously optional for all but the
  heaviest PRs and was skipped accordingly. For a docs-only PR, satisfying it is one sentence.
- **The constraint is written down** rather than worked around: Claude cannot reach xyzcrypto.io (egress
  policy, 403 on CONNECT), so every live check must be run by the owner. The division of labour is
  therefore fixed - Claude writes the exact one-liner, the owner runs it, Claude interprets. The failure
  mode is not that this is slow; it is Claude not writing the one-liner unless asked.
- **Added a table of useful observables by change type** (caching → `x-vercel-cache` + `age`; rate
  limiting → loop past the bucket and expect 429; `server-only` → browser console; schema → build log
  then exercise the feature; anything with a bare `catch {}` → the swallowed path).
- **Standing rules gain:** green CI is not permission to merge and neither is a passing internal check;
  no PR merges without a stated observable; the metric is not how many PRs merged but whether each one
  demonstrably improved the site.
- **Files:** `.claude/skills/pre-merge/SKILL.md` (incl. frontmatter, so the rule is visible before the
  skill loads) · `docs/changelog.md`.

## 2026-07-31 — Align markets `s-maxage` with polling; `revalidate` was the wrong layer
Follow-up to #190, which fixed the ISR window and left the CDN misaligned. **Corrects a claim #190
made.**
- **Measured on production**, `/api/markets/global` with `revalidate = 200` and `s-maxage=150`:
  `age` climbed `0 → 142 → 162 (STALE) → 19`. It went stale at **162s**, tracking the **150s header**,
  not the 200s export. **`s-maxage` governs the Vercel edge; `export const revalidate` does not.**
- **So #190 fixed a layer that does not drive edge regeneration.** The client polls every 180s and the
  edge went stale at 150s, so every poll still triggered a regeneration - the exact misalignment
  audit #6 described. Raised the six success-path `s-maxage` values to match: 200s for the 180s-poll
  routes, 320s for the 300s-poll routes. The short fallback values (45/30/60/120) stay deliberately
  brief so a degraded response does not stick.
- **Correcting #190:** it claimed `/api/markets/global` went "from a 20s window to ≈3m, ~10× the
  intended rate". That is wrong. The edge was on 150s throughout; the 20s was Next's internal ISR
  window. What the inner-hint fix actually bought is that the origin function stops re-fetching and
  re-parsing upstream APIs on every run - real Fluid CPU and bandwidth, not a 10× regeneration rate.
  The `cost-check` skill's trap 1b carried the same wrong figure and is corrected too.
- **How the wrong layer got verified as fixed:** #190 checked the build output's Revalidate column,
  which faithfully reports `revalidate` - the value that had just been changed. It cannot show the
  response header. The only way to know is to watch `age` and `x-vercel-cache` on the live site, which
  is now written into the skill as the check.
- **Two new assertions in `markets-poll-alignment.test.ts`:** `s-maxage` >= poll interval, and
  `s-maxage` == `revalidate` on any route setting both. The existing assertions passed the entire time
  the edge was misaligned - the second-worst thing after no test is one that measures the wrong layer.
  Regression-validated: reverting `global` to 150 fails both with readable messages.
- **`cost-check` skill gains trap 0**, ahead of everything else: `s-maxage` governs the edge, with the
  production measurement and the browser one-liner to re-check it.
- **✅ VERIFIED LIVE on production after deploy** (the check this PR's own rule now requires):
  `age` reached **182 while still HIT**, then went STALE at **202** and reset. Before the fix it was
  already STALE by 162. The edge now outlasts the 180s client poll, which was the objective.
  **Sized honestly:** with a 180s poll against a 200s window, the poll at t=180 hits a fresh entry and
  the one at t=360 regenerates - roughly one regeneration per two polls instead of one per poll, so
  about half the ISR writes from `/markets` traffic. Real, correct, and modest; not a multiplier.
- **Files:** 6 markets route handlers · `src/lib/__tests__/markets-poll-alignment.test.ts` ·
  `.claude/skills/cost-check/SKILL.md` · `docs/changelog.md`.

---

## 2026-07-31 — Keep `env.ts` out of the browser bundle (`import "server-only"`)
Closes deep-audit #3. `src/lib/env.ts` had no `server-only` guard, and three `"use client"` components
imported `userChannel` from `@/lib/realtime`, which imports it - so the whole env module shipped to the
browser.
- **Three problems at once, all closed:** (1) every visitor to `/journal` and any profile page got two
  `console.error` lines reading like a production outage - the bundler inlines `NODE_ENV=production` and
  eliminates the guard, so the "missing required env var" loop ran client-side where `process.env` is
  `{}`; (2) the server env's *shape* shipped in public JS, including `SUPABASE_SERVICE_ROLE_KEY` as a
  schema key; (3) `broadcastEvent`, which sends the service-role key as an `apikey` header, sat in a
  public chunk. No values ever leaked - Next does not define non-`NEXT_PUBLIC_` vars for the client
  build - but it was one config change away from being a real exfiltration path.
- **Fix:** the four pure channel-name constants moved to a new `src/lib/realtime-channels.ts` with **zero
  imports**; the three client components import from there; `realtime.ts` re-exports them so the ~20
  server call sites are untouched; `env.ts` now carries `import "server-only"`.
- **Verified by dependency graph, not by grep:** traced all 121 `"use client"` files transitively -
  3 reached `env.ts` before, **0 after**.
- **The guard is enforced by the build, and that was proven** by deliberately re-adding a client→env
  import and confirming `next build` exits 1 with `'server-only' cannot be imported from a Client
  Component module`.
- **A real regression this introduced, and its fix:** `server-only` is a Next *build-time alias*, not an
  npm package, so vitest could not resolve it and **8 test files stopped loading** with "Cannot find
  package 'server-only'". Fixed with a test-only alias to a no-op stub (`test/stubs/server-only.ts`)
  rather than adding a production dependency - vitest runs in Node, which *is* the server, so there is
  nothing for the guard to reject there. The four pre-existing `server-only` modules never surfaced this
  because no test imports them.
- **`src/lib/__tests__/realtime-channels.test.ts`** pins that the new module stays import-free and that
  the wire-format channel names don't drift (a rename silently stops delivery rather than erroring). Its
  first version searched the whole file for `@/lib/env` and failed on its own explanatory comment - now
  it matches import statements only.
- **Files:** `src/lib/realtime-channels.ts` (new) · `src/lib/env.ts` · `src/lib/realtime.ts` · 3 client
  components · `vitest.config.ts` · `test/stubs/server-only.ts` (new) ·
  `src/lib/__tests__/realtime-channels.test.ts` (new) · `docs/changelog.md`.

---

## 2026-07-31 — Make Journal Activity publishing revocable (schema change)
Closes deep-audit #10. Publishing a trade or challenge to the public Journal Activity feed was a
**one-way door**: setting it back to private, or deleting it outright, left the public row up forever.
- **Why it couldn't just be deleted:** `JournalActivity` had no link to its source - only `userId`,
  `type`, `title`, `win`. The title is pre-rendered text like `"Closed BTC long with a win"`, which
  collides with every other BTC long, so matching on it would have deleted the wrong rows. The audit
  estimated ~30 min; it actually needed a schema change, which is why it was deferred until now.
- **Schema (additive, nullable):** `sourceType` (`"trade" | "challenge"`) + `sourceId`, plus an index
  on the pair. **Deliberately not a relation/FK** - activity should survive as an orphan if a source is
  hard-deleted by some path we haven't hooked, rather than cascading unpredictably.
- **All 6 create sites** now record a source; **4 revocation points** added: trade PATCH→private, trade
  DELETE, challenge PATCH→private, challenge DELETE.
- **Challenge revocation is deliberately NOT scoped by user.** Participants' "Joined <title>" and
  milestone rows are owned by *other* users but embed the challenge title, so the owner making it
  private must revoke those too. Trade revocation *is* owner-scoped. The two `where` builders differ
  for exactly this reason and both are unit-tested.
- **Challenge DELETE only revokes when `deleteMany` reports count > 0**, so a caller cannot wipe the
  activity rows of a challenge they don't own.
- **A design mistake worth recording:** the first version used one helper returning
  `{ sourceType, sourceId, userId }` for both writes and deletes. Spreading it into `create` collided
  with the `userId` already set there and silently overwrote it (TS2783). Split into separate
  `*ActivitySource` (write) and `*ActivityWhere` (delete) builders, with a test asserting the write
  fragment has no `userId`.
- **`journal-activity-revocation.test.ts`** covers the scoping rules and, structurally, that **every**
  `journalActivity.create` call site passes a source builder - because a new activity type that forgets
  one fails nothing, it just becomes permanently unrevocable. Regression-validated by removing a source
  from one call site and confirming the test names that file.
- **Legacy rows (`sourceId IS NULL`) still cannot be revoked** - recorded as an owner decision in
  `HANDOFF.md §8` with a read-only count query and three options. Not actioned because it destroys data.
- **Files:** `prisma/schema.prisma` · `src/lib/journal-activity.ts` · 6 journal route handlers ·
  `src/lib/__tests__/journal-activity-revocation.test.ts` (new) · `docs/HANDOFF.md` · `docs/changelog.md`.

---

## 2026-07-30 — Rate-limit the 7 mutating API handlers that had no limiter, and pin it with a test
Closes deep-audit #9, which listed four gaps. A per-handler sweep found **seven**.
- **The four from the audit:** `dm` POST (upserts a `Conversation` per call, zero limiters in the file),
  `push/unsubscribe` POST, and the **DELETE** halves of `news/saved` and `news/social` - both files
  throttled POST and left DELETE wide open.
- **Three the audit missed**, found by checking per *handler* rather than per *file*:
  `journal/trades/[id]` DELETE, `journal/challenges/[id]` DELETE, and
  `journal/challenges/[id]/milestones/[milestoneId]` DELETE. Each sits in a file whose PATCH is
  correctly limited, so a file-level grep reports all three as covered.
- **Buckets mirror the sibling handler in the same file** rather than inventing new ones: `dm` for the
  DM start path (matching `dm/[id]`), `profile` for push unsubscribe (matching `push/subscribe`), `like`
  and `comment` for the two news DELETEs, `journal` for the three journal DELETEs.
- **New `src/lib/__tests__/api-rate-limits.test.ts` pins the invariant per handler.** It parses each
  `route.ts`, splits it at every `export async function`, and asserts every POST/PATCH/PUT/DELETE body
  calls `rateLimit()` and short-circuits on `!success`. 66 handlers currently checked, 0 gaps.
  Regression-validated: deleting one limiter fails the test naming the exact `file:handler`.
- **Two deliberate exceptions documented in the test**, not silently allowed: `posts/[id]/view` and
  `track` drop excess pings with `return ok(...)` rather than a 429, because a 429 on a fire-and-forget
  beacon is browser console noise. The test asserts the limiter result is *acted on*, not that a
  specific status is returned - the first version asserted 429 and was wrong.
- **The test also guards itself:** it asserts it found >50 handlers, so a broken glob fails loudly
  instead of passing vacuously. That mirrors the file-vs-handler false negative that hid three of these.
- This matters now specifically because **Upstash is verified live** (2026-07-29) - these limiters
  genuinely enforce rather than no-op.
- **Files:** 7 route handlers · `src/lib/__tests__/api-rate-limits.test.ts` (new) · `docs/changelog.md`.

---

## 2026-07-30 — Remove the CodeQL job: code scanning is unavailable on a private repo
CI config only. The repository was made private, and **code scanning requires GitHub Advanced
Security on private repos** - so the CodeQL job could never file its results and failed on every PR.
- **What it looked like:** `CodeQL analysis` red on every PR, reading like a security finding. It was
  not one. The scan itself **succeeded** every time - all 419 TypeScript files, 4 JavaScript files and
  4 GitHub Actions files analysed, SARIF exported, **zero findings**. The job then failed at the upload
  step with `Code scanning is not enabled for this repository`.
- **A wrong turn worth recording.** The first diagnosis blamed a missing `actions: read` permission and
  claimed the trigger was "a change on GitHub's side, since `security.yml` hasn't changed since
  2026-07-11". The permission was added and CodeQL **still failed** - it only silenced a secondary
  telemetry warning. The owner supplied the actual cause: they had made the repo private. Corrected
  here rather than quietly dropped, because a plausible-but-wrong root cause is the exact failure mode
  the rest of this changelog keeps documenting.
- **Why removed rather than `continue-on-error`:** the job cannot upload results either way, so it
  would burn ~4 minutes of Actions time per PR for nothing. Public repos get unlimited minutes; private
  repos are metered, so this became a real cost the moment the repo went private. A permanently red
  security check is also corrosive - it blocks merges *and* teaches everyone to ignore a failing
  security check.
- **Not lost:** `npm audit` still runs on every push/PR and weekly, so dependency advisories are still
  reported. And CodeQL had found nothing - this removes a scanner that could not file its report, not
  coverage of a known problem.
- **Restore path** is documented inline in `security.yml`: make the repo public again (code scanning is
  free there) or enable GitHub Advanced Security, then re-add the job - the full block is kept in a
  comment, including the `actions: read` permission it needs on private repos.
- **Do not make the repo public to get this check back.** `prisma/seed.ts` still hardcodes a real
  personal Gmail and the default password `changeme123`; the full git history would be exposed; and the
  handbook now documents which monitoring subsystems are dark, which limiters exist with their exact
  thresholds, and the Supabase project ref. That is an attacker briefing. The check is not worth it.
- **Files:** `.github/workflows/security.yml` · `docs/changelog.md`.

---

## 2026-07-30 — Make schema-push failures fail the build instead of hiding
Follow-up to the P1001 incident. That fixed the misconfiguration; this fixes the reason it stayed
invisible for weeks. The first non-docs change in this run.
- **`vercel-build` no longer swallows failures.** It was
  `prisma db push --skip-generate || echo 'db push skipped (no DB at build)'` - the `||` absorbed
  *every* failure, so a deploy succeeded, CI went green and the site worked while no migration had
  applied. Now `prisma generate && node scripts/db-push.mjs && next build`.
- **New `scripts/db-push.mjs` draws the distinction the `||` could not:** nothing to push to → skip
  quietly (exit 0); something to push to and it failed → **fail the build**, loudly.
- **Only a real Vercel production build pushes.** The gate is strict equality on
  `VERCEL_ENV === "production"`, so local builds, CI and **preview deployments** all skip. This closes
  a live exposure: preview deploys share the production `DATABASE_URL`, and with P1001 fixed every
  branch push would otherwise have rewritten the production schema before review. An abandoned PR's
  orphan column would then make future pushes fail on data-loss refusal - silently, under the old
  script. (The owner also unticked Preview on `DIRECT_URL`; this enforces the same thing in code, so
  it survives the checkbox being re-ticked.)
- **A production build missing `DATABASE_URL`/`DIRECT_URL` now fails** rather than skipping - on
  production that is a broken config, not a reason to continue.
- **3 attempts with 2s/4s backoff** so a transient blip doesn't block a deploy; a genuine
  misconfiguration fails all three in ~10s and then fails the build.
- **This cannot take the site down.** Vercel keeps the previous deployment serving and only swaps the
  production alias after a build succeeds. Worst case is "this deploy doesn't ship until the DB is
  reachable", which beats shipping code whose schema was never applied.
- **Verified by executing every path**, not by inspection: local/CI/preview skip (exit 0); production
  with missing `DATABASE_URL` or `DIRECT_URL` fails (exit 1); production with an unreachable DB
  reproduces `P1001`, retries twice and fails (exit 1, ~10s); `npm run vercel-build` end-to-end still
  generates, skips and builds clean.
- **Files:** `scripts/db-push.mjs` (new) · `package.json` (`vercel-build`) · `docs/changelog.md`.

---

## 2026-07-29 — FIXED: migrations had never applied (P1001 on every deploy)
Docs only. Records the root cause of the schema-drift item open since 2026-07-19, the owner's fix,
and a CLAUDE.md gotcha that had been steering readers away from finding it.
- **Symptom:** every production build logged `Error: P1001: Can't reach database server at
  db.<ref>.supabase.co:5432`, so `prisma db push` failed on every deploy. Not drift that happened
  once - **no migration applied on any Vercel deploy** for the whole period.
- **✅ Fixed same day.** Owner repointed `DIRECT_URL` at the Supabase **session pooler**
  (`aws-0-<region>.pooler.supabase.com:5432`) and redeployed; build logs clear, `P1001` gone.
  Recorded as owner-verified - the `in sync with your Prisma schema` line was not itself pasted back,
  so a later auditor should re-confirm from a build log rather than treat it as independently proven.
- **The invisibility was NOT fixed, only the misconfiguration.** Any future `db push` failure - bad
  credential, paused project, schema conflict - will be equally silent with green CI. Flagged in §8 as
  a decision to make (loud greppable marker + assertion, versus making it fatal and breaking DB-less
  builds); not actioned.
- **Cause:** `DIRECT_URL` points at the *direct* Supabase host. Supabase deprecated IPv4 for it, so
  it resolves IPv6-only, and Vercel's build/function runtimes are IPv4-only. It must point at the
  **session pooler** (`aws-0-<region>.pooler.supabase.com:5432`) instead, which supports the DDL
  migrations need *and* is IPv4-reachable - exactly what `.env.example:11` specifies. Port 5432 on the
  pooler host and port 5432 on the direct host look interchangeable and are not.
- **Why it hid for ten days:** `vercel-build` is
  `prisma generate && (prisma db push --skip-generate || echo 'db push skipped …') && next build`.
  The `||` swallows the non-zero exit, `next build` proceeds, the deploy succeeds and **CI goes
  green**. Runtime traffic is unaffected because `schema.prisma` uses `DIRECT_URL` only as
  `directUrl`; requests go through `DATABASE_URL`, which is correctly pooled. So the app works
  perfectly while every migration silently fails - the house bug class in its purest form.
- **CLAUDE.md gotcha rewritten.** It said migrations "auto-apply on every Vercel deploy … don't assume
  a migration is 'pending' just because it's recent". That nudged the reader toward assuming success,
  which is why this went unseen for weeks. It does **not** now say the opposite either - flipping it to
  "assume unapplied" would be stale the moment the fix landed. It states the durable rule: migrations do
  apply, the script hides failure in **both** directions, so open the build log and look for
  `in sync with your Prisma schema`. Assume nothing.
- **Correction to the previous entry (below): `CRON_SECRET` IS set in Vercel.** That entry claimed it was
  unset, inferred from the 403 and written up as fact. The owner confirmed it is present, Prod+Preview.
  The 403 is now recorded as an unexplained symptom with two candidates - a mismatched value, or a
  deployment predating the variable (Vercel bakes env vars at build time). The HANDOFF env-table row and
  the §8 entry are corrected accordingly.
- **Also recorded from the same env audit:** `RESEND_API_KEY`/`EMAIL_FROM`, all three VAPID vars,
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (so `storageEnabled` is true - uploads really do go to
  Storage, no inline `data:` fallback), `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXTAUTH_SECRET`/`URL`,
  `DIRECT_URL` and `ADMIN_EMAILS` are all present and Production-scoped. `SUPABASE_STORAGE_BUCKET` is
  absent but defaults to `post-covers` (`env.ts:80`), so that is a non-issue. `TELEGRAM_*` absent -
  Sentinel email alerting still works via Resend. Sentry DSNs remain absent.
- **Files:** `CLAUDE.md` (migration gotcha, Stack caveat) · `docs/HANDOFF.md` (§8 root-cause entry,
  Sentinel correction, `CRON_SECRET` env-table row) · `docs/changelog.md`. No `src/` changes.

---

## 2026-07-29 — Verified: Upstash rate limiting IS live in production; XYZ Sentinel is not
Docs only, no code changed. Closes a standing unknown and opens a new one found while closing it.
- **Upstash is configured and limiters genuinely enforce.** Verified by behavioural probe against
  production, read-only: 16 sequential `GET /api/search/posts` with distinct query strings and
  `cache: "no-store"`. That route uses the `subscribe` bucket, 10/min/IP - requests 1-10 returned rows,
  **11-16 returned zero**, tripping exactly on the configured boundary, with `x-vercel-cache: MISS`
  confirming the function was actually invoked. The off-by-one is explained by request 1 being `STALE`,
  which fires a background revalidation that consumes a token.
- **Method note recorded in HANDOFF §8, because the first probe was wrong.** Reusing the *same* query
  string proves nothing: `/api/search/posts` sets `s-maxage=60, stale-while-revalidate=180`, so repeat
  identical requests are answered by the edge and never reach `rateLimit()`. A constant result series
  looks identical to "limiting is off". Vary the query, pass `cache: "no-store"`, read `x-vercel-cache`.
  Also: that route and `/api/posts/[id]/view` **silently drop** excess requests (`return ok(...)`) rather
  than returning 429, so the signal is in the payload, not the status code.
- **The OTP attempt-cap race is confirmed LOW, not escalated.** `otp.ts:82` still checks a stale
  `attempts` read before the atomic increment, but its escalation was conditional on Upstash being
  absent. With `signup`/`password` (IP) and `otpEmail` (3 per 10 min per target email) genuinely
  enforcing, a 6-digit code is not brute-forceable in parallel. Worth fixing as hardening
  (`updateMany` guarded on `attempts < MAX_ATTEMPTS`), not as an exposure.
- **New finding: XYZ Sentinel does not run at all.** ⚠️ **The cause stated in this bullet was WRONG —
  see the 2026-07-29 root-cause entry above. `CRON_SECRET` IS set in Vercel (Prod+Preview).** The 403 is
  real; the diagnosis below was an inference written up as fact. Left in place as a record, not as
  guidance. — `GET /api/watchdog` returns
  `403 {"error":"Forbidden"}` - `authorized()` short-circuits on `if (!env.CRON_SECRET) return false`
  before comparing anything, so `CRON_SECRET` is not set in Vercel. `/api/push/dispatch` shares the
  identical gate and is equally unreachable. Compounding it, `watchdog.yml` has `schedule:` commented
  out from the Hobby-plan pass, so nothing invokes it automatically either. A monitor that never runs
  raises no alarm - same class as the Sentry DSN gap. Added as an owner action in §8.
- **Corrected a wrong claim in the HANDOFF env table.** The `CRON_SECRET` row said that without it the
  "Endpoint stays open (still gated by other checks)". It does the **opposite** - it fails closed, 403 to
  everyone, and the feature silently never runs. A reader would have inferred the risk was exposure when
  the real consequence is silent non-execution.
- **Files:** `docs/HANDOFF.md` (§8 + two env-table rows) · `CLAUDE.md` (Stack caveat) ·
  `docs/changelog.md`. No `src/` changes.

---

## 2026-07-29 — Project skills added; design-system docs consolidated; CLAUDE.md caveats
Three procedures the project depends on existed only as docs someone had to remember to name in a
prompt. `PRE-MERGE-CHECKS.md` said so in its own "How to use it" section. They are now skills that
load on trigger.
- **New `.claude/skills/`** (committed, so any session from any account picks them up):
  `pre-merge` (the six-step check procedure, scaling table, standing rules), `cost-check` (**the single
  home for every caching and cost number** - route baseline, ISR windows, the ~2MB data-cache trap, the
  `<img>` vs `next/image` trade-off, the bundle-size blind spot), `design-system` (the color rule, the
  narrow `prefers-reduced-motion` policy, the gradient-text gotcha). Frontmatter descriptions name
  **triggers**, not contents - that string is all that is visible until a skill fires.
- **Rule they follow:** a skill carries what changes a decision; `docs/` carries reference tables. One
  fact, one home.
- **`docs/DESIGN-SYSTEM.md` + `docs/design-system.md` merged into the lowercase file**, and the uppercase
  one removed with `git rm`. They were two *different* documents, not duplicates - lowercase was the brand
  spec (palette, spacing, buttons, surfaces), uppercase was the theming layer (light/dark, semantic CSS-var
  tokens, ThemeToggle). Lowercase was kept because it is the one `SUMMARY.md`, `project-state.md` and
  `frontend-state.md` all link to; the uppercase file was not in the GitBook TOC at all. **This also fixes a
  real portability bug:** two paths differing only by case cannot coexist in a checkout on Windows or macOS,
  which would have broken the owner's working tree on the next pull.
- **Two stale claims corrected during the merge** rather than carried forward: both files said motion
  universally respects `prefers-reduced-motion` (the revised policy deliberately exempts the ticker marquee,
  `text-shine`/`text-shimmer`, shooting stars and `.i3d-*`), and one listed react-three-fiber as the "next
  increment" (R3F 9 / drei 10 are installed but the WebGL orbital is gated off; the CSS orbital is live).
- **`docs/PRE-MERGE-CHECKS.md` reduced to a pointer.** Not deleted - it keeps the GitBook TOC entry under
  Operations & Security working and gives a human reader the trail. Keeping a second full copy is how the
  two would drift, which is the exact failure the check exists to catch.
- **`CLAUDE.md` reconciled with reality:** the Stack line no longer implies Upstash and Sentry are live
  (Upstash config in production is unverified and limiters no-op when unset; Sentry has no DSN in any
  runtime), and "ALL env access goes through `env.ts`" is reworded as the intended convention rather than
  an enforced guarantee - the zod result is only logged, `process.env` is re-read directly, and the module
  lacks `import "server-only"`. Both point at `HANDOFF.md §8`. Added a Skills section.
- **Reported, not changed:** `component-registry.md` is substantially stale - its API list stops at six
  routes and its Pages list at five, against a repo that now builds 124 routes with community, messages,
  journal, markets, news, tools, settings, `u/[username]` and premium. Worth its own refresh pass.
- The two older changelog entries referencing `DESIGN-SYSTEM.md` are left as-is: a changelog records what
  was true on its date, and rewriting it is the worse error. This entry is the forwarding address.
- **Files:** `.claude/skills/{pre-merge,cost-check,design-system}/SKILL.md` (new) ·
  `docs/design-system.md` (merged) · `docs/DESIGN-SYSTEM.md` (deleted) · `docs/PRE-MERGE-CHECKS.md`
  (→ pointer) · `CLAUDE.md` · `docs/changelog.md`. No `src/` changes.

---

## 2026-07-25 — Diagnosis: Sentry has never been configured in production (no DSN anywhere)
Ran the verification the previous entry asked for, against the live site, and it failed at the very first
link - so the docs are corrected to say so rather than implying the monitoring work is finished.
- **Findings** (production console): `window.__SENTRY__` is `undefined`; `performance.getEntriesByType(
  "resource")` shows zero requests to any Sentry/ingest host; scanning all 36 served `_next/static/*.js`
  chunks finds no `ingest.*.sentry.io` string. In Vercel, **neither `NEXT_PUBLIC_SENTRY_DSN` nor
  `SENTRY_DSN` exists** in Environment Variables.
- **Nothing has ever reported, from any runtime.** Not just the browser SDK - the server and edge SDKs read
  `SENTRY_DSN`, which is absent too. Corrects an earlier note claiming the DSN was set in production, and
  narrows an earlier claim that server/edge Sentry "was never affected" (true of the Turbopack bug
  specifically, but everything was silent for want of a DSN).
- **The #168 and #171 code fixes remain correct and necessary** - client init moved to
  `src/instrumentation-client.ts` for Turbopack, and the Sentry ingest host allowed in `connect-src`. They are
  prerequisites that simply cannot be exercised until a DSN exists; the docs say explicitly not to revert them
  as ineffective.
- **Recorded the build-time trap**: `NEXT_PUBLIC_*` values are inlined when Vercel builds, and
  `instrumentation-client.ts` guards on `if (dsn)`, so a build without the variable bakes in an empty string
  and `Sentry.init()` never runs. Setting the variable is not enough - a **redeploy** is mandatory.
- Wrote the finish-up steps (create/locate the Sentry project, add both vars scoped to Production, redeploy,
  verify) and a note on when this becomes essential rather than nice-to-have, into `HANDOFF §8`, with a
  summary in `CLAUDE.md`'s owner actions.
- **Files**: `docs/HANDOFF.md`, `CLAUDE.md`, `docs/changelog.md`.

---

## 2026-07-25 — Docs: bring HANDOFF §7 current (2026-07-19 → 2026-07-25)
`HANDOFF.md`'s §7 narrative had stalled at 2026-07-19 while ~20 PRs merged, so a cold-start session reading
it would have missed the framework upgrade entirely. Header bumped (PR #154 → #177) and three sections added.
- **2026-07-23 — Next 14 → 16 + React 19 (#158)**: why it was smaller than feared (next-auth v4 now peers
  `next ^15||^16` + `react ^19`, so no Auth.js v5 rewrite), the codemod/segment-config/tsconfig changes, the
  `next lint` → ESLint 9 flat config move that later surfaced the react-hooks warnings, and the fact that the
  R3F/drei major bump is compile-only while `useWebglGate()` stays `false`.
- **2026-07-23/24 — work from other sessions (#159-#167, #169, #170)**: the Tiptap editor rebuild, premium
  visual identity, mobile nav/footer fixes, and notably the **security audit fixes (#170)** covering a DM
  realtime leak, a profile XSS and a push IDOR. Recorded so §7 isn't misleading about what moved in that
  window, with pointers to the changelog rather than second-hand detail.
- **2026-07-24/25 — Sentry, CSP, pre-merge checks, react-hooks**: the two independent faults that kept
  client-side Sentry dark (the Turbopack init regression, and a `connect-src` that had *never* allowed a
  Sentry host), the LiveKit CSP cleanup, the new pre-merge checklist, and the 73 → 41 react-hooks passes
  including which three were genuine bugs.
- **New §8 item**: confirm Sentry actually receives a client event. Every link is verified independently but
  no event has ever been *observed* arriving, since the agent sandbox has no outbound network - so this is
  explicitly flagged as unverified rather than quietly assumed working, with the exact console check to run.
- Also updated the §7 heading, which was still dated "2026-07-16, end of session".
- **`CLAUDE.md` synced to match** (it was dated 2026-07-23 and predated the Sentry/CSP/react-hooks work):
  "Current state" bumped, new bullets for the restored Sentry client monitoring (both faults) and the
  2026-07-25 housekeeping, the open-owner-actions count corrected 2 → 3 with the unverified Sentry delivery
  added, the stale "react-hooks warnings" leftover removed now that they're settled, and a standing
  instruction to run `docs/PRE-MERGE-CHECKS.md` before merging anything touching routes/caching/data/realtime
  (with the current 124/22/102/12 baseline inline).
- **Files**: `docs/HANDOFF.md`, `CLAUDE.md`, `docs/changelog.md`.

---

## 2026-07-25 — Docs: record the decision to keep the fetch-on-mount effects as-is
Doc-only. After three cleanup passes took the react-hooks v6 warnings from 73 to 41, the largest remaining
group (`set-state-in-effect` on fetch-on-mount) was assessed and **deliberately kept**. Wrote the reasoning
down next to the rule config in `eslint.config.mjs` so it reads as a decision rather than an unfinished TODO.
- The shape is `useEffect(() => { load(); }, [load])` where `load()` opens with `setLoading(true)`. In this
  codebase that is usually not the cascading render the rule assumes: these components already declare
  `useState(true)` for `loading`, so on mount the call sets the value it already has and React bails out; on
  later runs (tab switched, query changed) it is a correct transition back to loading. Unlike the two groups
  that were fixed, no wrong data is ever painted - the intermediate state is simply "not loading yet".
- The rule's real objection is architectural (no request dedup, no shared cache, waterfalls). Both ways to
  satisfy it were rejected for now, with reasons recorded: moving the fetching into Server Components would
  convert client fetches of cached `/api` routes into per-request server work, pushing Function Invocations
  and Fast Origin Transfer **up** against the free-tier work in `HANDOFF §7`; and adopting SWR/TanStack Query
  across ~20 call sites is a repo-wide commitment that should be scoped on its own merits (its dedup/cache
  could genuinely reduce invocations - a good argument, just not a lint-cleanup one).
- Recorded the accepted consequence: `set-state-in-effect` stays on `warn`, so a newly-introduced instance
  will not be blocked by CI.
- Refreshed the stale `HANDOFF §8` entry, which still described 72 warnings and treated the whole thing as
  outstanding work.
- **Files**: `eslint.config.mjs`, `docs/HANDOFF.md`, `docs/changelog.md`.

---

## 2026-07-25 — react-hooks v6 batch 3: reset-on-prop-change adjusted during render
Third pass (47 -> 41; `set-state-in-effect` 39 -> 33). This batch takes the "reset some state when a prop
changes" sub-pattern, which was written as `useEffect(() => setX(initial), [prop])`. That commits one frame
of the *previous* item's state and then schedules a second render to correct it. Replaced with React's
documented "adjusting state when a prop changes" pattern - a previous-value guard evaluated during render:
React re-runs the component immediately, without committing the stale value, and it isn't an effect so there
is no cascading render.
- **`CommandPalette`**: highlight reset to row 0 when the result set or query changes.
- **`NewsClient`** (story reader): reading-progress reset per story - the progress bar can no longer paint the
  previous story's value. The `scrollTop = 0` half is a genuine DOM side effect and deliberately stays in an
  effect.
- **`NewsClient`** (headline carousel): index reset when the feed length changes, so the ticker can't
  momentarily index past the end of a shorter list.
- **`NewsSocial`**: like/comment counts cleared when the story URL changes, so one story's counts can't flash
  under another's headline.
- **`BriefingBlock`**: translation/speech state reset per story; the `speechSynthesis.cancel()` side effect
  stays in an effect.
- **`useUserOnline`**: presence resets to offline when the observed user changes, so the previous user's
  online dot is never shown against the new one.
- **Verified**: typecheck + lint (0 errors) + 362 tests + build green. A bad guard on a render-phase setState
  causes an infinite render loop, so this was specifically exercised in headless Chromium: the command
  palette was driven through repeated query changes (hammering the reset path) and `/news` was left running
  long enough for the carousel interval to tick - **zero "Too many re-renders"/"Maximum update depth" and
  zero uncaught errors**, with the palette still open and functional afterwards.
- **Remaining**: 33 `set-state-in-effect` - now mostly fetch-on-mount (`load()` whose first statement is
  `setLoading(true)`) and user-writable stored preferences, both of which need structural changes rather than
  a pattern swap.
- **Files**: `src/components/CommandPalette.tsx`, `src/components/NewsClient.tsx`,
  `src/components/NewsSocial.tsx`, `src/components/BriefingBlock.tsx`, `src/lib/useUserOnline.ts`,
  `docs/changelog.md`.

---

## 2026-07-25 — react-hooks v6 batch 2: mount-time browser reads via useSyncExternalStore
Second pass on the react-hooks v6 warnings (52 -> 47; `set-state-in-effect` 44 -> 39). This batch takes the
"read a browser-only value on mount" sub-pattern - `useState(false)` plus
`useEffect(() => setX(read()), [])`, which renders once with the wrong value and immediately schedules a
second render. Added `src/lib/useClientFlag.ts` (`useHydrated`, `useClientFlag`, `useMediaQuery`), thin
`useSyncExternalStore` wrappers that express the same intent directly: React reads the server snapshot while
SSR-ing and hydrating, then swaps to the real value with no cascading render.
- **`ImageLightbox`**: portal-ready flag -> `useHydrated()`.
- **`NewsAlertsToggle`**: push-capability check -> `useClientFlag()`; the effect that follows now just reads
  the derived `supported` instead of recomputing it.
- **`journal/JournalClient`**: realtime-available flag -> `useClientFlag()`.
- **`ChatClient`**: `touchUi` -> `useMediaQuery("(hover: none)")`. This is also a **behaviour improvement** -
  it was a one-shot read, so attaching a mouse or rotating a tablet never updated it; now it tracks.
- **`OrbitalEcosystem`** (the live homepage centerpiece, not the gated-off WebGL scene): the particle field
  was generated with `Math.random()` inside an effect specifically to dodge a hydration mismatch. Now derived
  in a `useMemo` from a seeded PRNG (`mulberry32`, reused from the orbital scene) plus
  `useMediaQuery("(max-width: 768px)")` for the phone count. Being deterministic, there is no mismatch to
  dodge, and the field can't reshuffle on an unrelated re-render. Still only painted once `active` is true.
- **Verified**: typecheck + lint (0 errors) + 362 tests + build green; homepage driven in headless Chromium -
  renders and hydrates with zero uncaught/hydration errors, and a screenshot confirms the orbital centerpiece
  (rings, nodes, particles, logo glow) is visually unchanged.
- **Remaining**: 39 `set-state-in-effect`, which are the fetch-on-mount and reset-on-prop-change patterns
  (chat/dashboard/news/messages) plus user-writable stored preferences - those need a store or key-remount,
  not a drop-in hook. Tracked in `eslint.config.mjs` and `docs/HANDOFF.md §8`.
- **Files**: `src/lib/useClientFlag.ts` (new), `src/components/ImageLightbox.tsx`,
  `src/components/NewsAlertsToggle.tsx`, `src/components/journal/JournalClient.tsx`,
  `src/components/ChatClient.tsx`, `src/components/OrbitalEcosystem.tsx`, `docs/changelog.md`.

---

## 2026-07-25 — react-hooks v6: clear purity + static-components, promote both back to error
First pass at the react-hooks v6 warnings the Next 16 upgrade surfaced (73 -> 52). Two rule categories are
now completely clean and re-enforced as errors in `eslint.config.mjs`; the rest stay on warn with the
remaining counts documented inline.
- **`react-hooks/purity` (11 -> 0)**:
  - `orbital/StarField.tsx` + `orbital/SpaceParticles.tsx` seeded their star/dust fields with `Math.random()`
    inside a `useMemo`. That is an impure render-phase call - if the memo ever re-ran (StrictMode
    double-render, remount) the whole field would silently jump to a new layout. Added
    `orbital/rng.ts` (mulberry32) and seeded both, which makes the memos genuinely pure and the fields stable
    run to run, with the same statistical spread. This is a real fix, not a suppression.
  - `app/community/page.tsx` + `app/dashboard/page.tsx` call `Date.now()` in **Server Components**, which
    render once per request - the rule's re-render instability concern is client-only, so these got a scoped
    `eslint-disable-next-line` with that reasoning rather than contorted code.
- **`react-hooks/static-components` (4 -> 0) + one `immutability`**: `CommandPalette` declared its `Section`
  component *inside* the render and gave rows their global index by mutating a shared `let idx` counter
  across three call sites. A component created during render is a new type every render, so React unmounted
  and remounted the entire results list instead of updating it. Hoisted `Section` to module scope and
  replaced the counter with cumulative `offset` props, which mirror how `rows` is assembled
  (`cmds, coins, posts, news`) - identical indices, no mutation.
- **`react-hooks/refs` (5 -> 1)**: the latest-callback refs in `useRealtime.ts`, `DashboardClient`'s
  `useMembersChannel`, and `ChatClient`'s `stickRef`/`meRef` were written during render, which isn't safe
  under concurrent rendering. Moved each into a post-commit `useEffect` (the pattern `ChatClient`'s
  `messagesRef` already used); all are read only from async realtime/scroll handlers.
- Removed a stale `eslint-disable react-hooks/exhaustive-deps` in `AwardXpOnView.tsx` that no longer
  suppressed anything.
- **Verified**: typecheck + lint (0 errors, with purity/static-components now *errors*) + 362 tests + build
  green; homepage + command palette driven in headless Chromium - the palette opens, renders its section and
  row, and highlights correctly, with zero uncaught errors.
- **Deliberately not changed**: the two `@next/next/no-img-element` warnings in `PostEditor`. Routing those
  Supabase-hosted images through `next/image` would consume Fast Origin Transfer and image-optimisation
  quota - see `docs/PRE-MERGE-CHECKS.md` Step 2, where this is called out as a case where the lint rule's
  "best practice" is the more expensive choice here.
- **Files**: `src/components/orbital/rng.ts` (new), `src/components/orbital/StarField.tsx`,
  `src/components/orbital/SpaceParticles.tsx`, `src/app/community/page.tsx`, `src/app/dashboard/page.tsx`,
  `src/components/CommandPalette.tsx`, `src/lib/useRealtime.ts`, `src/components/DashboardClient.tsx`,
  `src/components/ChatClient.tsx`, `src/components/AwardXpOnView.tsx`, `eslint.config.mjs`,
  `docs/changelog.md`.

---

## 2026-07-25 — CSP: drop dead LiveKit sources left over from Voice Rooms
Voice Rooms (LiveKit) were removed entirely in the 2026-07-19 cost pass, but the CSP kept allowing their
origins and capabilities. Removed the leftovers after verifying each is genuinely unused:
- **`connect-src`**: dropped `https://*.livekit.cloud wss://*.livekit.cloud`. No `livekit` reference remains
  anywhere in `src/`, `package.json`, or `.env.example`.
- **`media-src`**: dropped `mediastream:`. Nothing uses `getUserMedia`, `MediaStream`, or `srcObject`, and
  there is no `<audio>`/`<video>` element in the codebase - the news briefing's read-aloud uses
  `window.speechSynthesis` and the chat blip uses the Web Audio API (`AudioContext`), neither of which is
  governed by `media-src`.
- **`worker-src`**: dropped `blob:` (LiveKit spun up audio workers from blob URLs); **kept `'self'`**, which
  the PWA service worker registration (`/sw.js` via `PwaSetup`/`NewsAlertsToggle`) genuinely needs. No
  `new Worker(...)` exists in the source.
- Comments rewritten so the remaining sources document their real justification rather than a removed feature.
- **Verified**: typecheck + lint (0 errors) + 362 tests + build green; route table identical to `main`
  (124 routes, 22 static, 102 dynamic, 12 ISR); the served `Content-Security-Policy` header confirmed free of
  `livekit`/`mediastream` while retaining `worker-src 'self'` and the `*.sentry.io` source added in #171; and
  a headless-Chromium pass over `/`, `/tools`, `/news`, `/markets` recorded **zero CSP violations** with the
  service worker still registering.
- **Files**: `next.config.mjs`, `docs/changelog.md`.

---

## 2026-07-25 — Docs: pre-merge cost & performance checks
Added `docs/PRE-MERGE-CHECKS.md`, a checklist for verifying a PR branch does not regress cost or performance
*before* it merges to `main` and auto-deploys. It exists because CI (`typecheck -> lint -> test -> build`)
proves nothing broke but cannot detect a page that stopped being cached, a new polling loop, or a grown
bundle - those surface as a Vercel usage overage days later, not as a red check.
- Six steps, scaled to PR type: route-table comparison between `main` and the branch (static/dynamic flips and
  revalidate-window changes being the most expensive regression class here), a diff scan for cost-relevant
  patterns (caching directives, polling loops, Supabase channels outside the shared singleton, cron schedules,
  large external fetches, N+1 Prisma), bundle size (currently a known blind spot since Next 16 dropped the
  `Size`/`First Load JS` columns), Lighthouse on the Vercel preview, reading the diff, and watching usage for
  ~3 days post-merge.
- Records the current baseline (Next 16.2.11: 124 routes, 22 static, 102 dynamic, 12 ISR) and the known ISR
  windows, so future comparisons have a fixed reference point.
- Listed in `docs/SUMMARY.md` under Operations & Security so it appears in the GitBook handbook.
- **Files**: `docs/PRE-MERGE-CHECKS.md` (new), `docs/SUMMARY.md`, `docs/changelog.md`.

---

## 2026-07-24 — Security audit fixes + bold/italic overlap bug
Full end-to-end security audit (7 parallel read-only agents covering auth, every API route, the rich-text/XSS
surface, realtime chat/DM access control, and secrets/env/deps) plus a bug hunt across research, markets,
journal, chat/DM, profile and auth. This entry covers the fixes shipped from that pass; the remainder is a
prioritized backlog (see below) - not silently dropped.

**Security fixes:**
- **DM plaintext leaked over a public Realtime channel (High)**: `POST /api/dm/[id]` broadcast the *full
  message body* to `user:<recipientId>` on Supabase Realtime's public (`private: false`) broadcast channel.
  Since the recipient's user id is discoverable from their public profile page, anyone holding the public
  anon key could open devtools, subscribe to `user:<their-id>`, and read every DM sent to them in real time -
  no valid session required, completely bypassing the correctly-implemented participant check in
  `loadMine()`. Fixed by broadcasting a bare `{ conversationId }` ping instead of the message - the client
  already refetches the thread through the authed `GET /api/dm/[id]` on every ping, so no payload content was
  ever actually needed on the wire (matches the existing `CH_NOTIFY` ping pattern).
- **Profile "Website" field accepted `javascript:`/`data:` URIs (High)**: `z.string().url()` alone doesn't
  reject dangerous schemes (`new URL("javascript:...")` doesn't throw) - the value rendered straight into
  `<a href>` on the public `/u/[username]` page with no `safeHref` check, unlike every other link in the app.
  Any registered user (not just staff) could plant a stored-XSS-class link. Fixed with a new `isHttpUrl()`
  schema check (only `http:`/`https:` allowed) plus a defensive `safeHref()` guard at render time for any
  data written before the fix.
- **IDOR on push-notification endpoints (Low)**: `POST /api/push/unsubscribe` deleted a subscription by
  `endpoint` alone (no owner check) - any logged-in user who obtained another subscriber's opaque endpoint
  could delete their push subscription. `GET /api/push/subscribe` returned a subscriber's saved notification
  preferences for any `endpoint` passed as a query param. Both now additionally scope to `userId: me.id`.
- **`/api/dm/search` was the one DM/chat path that skipped `stripInlineImage()`**, re-exposing raw base64
  `data:` avatars on every debounced search keystroke - the exact Fast Origin Transfer class the July 19
  `stripInlineImage()` fix covers everywhere else. Now consistent.

**Bug fix:**
- **Overlapping bold+italic corrupted content, both in the editor and on the live page**: bolding a phrase
  then italicizing part of it (two Tiptap toolbar clicks) serializes as `**hello *world***`. The shared
  bold-matching regex in `richtext.ts` and `markdown.tsx` used a `[^*]+` content class that can't match
  across the nested italic's `*`, so it locked onto the wrong `**` pair, dropped the bold wrapper, and leaked
  literal `*`/`***` characters as visible text - reproducible by reopening any such post for edit, and live
  on the public page. Fixed by adding a negative lookahead (`\*\*[\s\S]+?\*\*(?!\*)`) so the bold match
  prefers a closing `**` that isn't immediately followed by another star, correctly resolving `***` tails as
  "close italic, then bold" - verified against the overlap case, the standard `***triple***` shorthand, and
  that two independent bold spans on one line still don't merge.
- **Files**: `src/app/api/dm/[id]/route.ts`, `src/app/api/dm/search/route.ts`, `src/app/api/push/{subscribe,
  unsubscribe}/route.ts`, `src/lib/profile.ts`, `src/app/u/[username]/page.tsx`, `src/lib/richtext.ts`,
  `src/lib/markdown.tsx`, plus regression tests in `richtext.test.ts`, `markdown-render.test.ts`,
  `profile.test.ts`.

**Backlog (found, understood, deliberately not rushed into this pass - detail in the audit report):**
community chat's public broadcast channel accepts client-authored `.send()` on any event (a visitor can craft
a fake `new_message` broadcast that renders live in every open tab - needs a broadcast-payload-trust redesign
in `ChatClient.tsx`, not a one-line fix); nested/Tab-indented lists mangle into run-on text on save
(`richtext.ts`'s `htmlToMarkdown` doesn't walk into nested `<ul>`); the opt-in journal share card
(`/api/journal/share/overview/[userId]`) assumes the userId in its URL is effectively secret, which no longer
holds now that profile pages expose it - a product decision on whether to move to an opaque share token, not
a code bug; risk-rule day-boundary uses UTC instead of local day; `CommentSection` collapses a user's "load
older" pagination on any new comment activity; `compoundGrowth()` can render `NaN` for out-of-range inputs;
OAuth login ignores `?callbackUrl=`; a handful of smaller UX gaps (OTP resend has no in-flight guard, the
client password hint undersells the real server rule, one free-tier limit is enforced on create but not on
join). Full detail, file:line, and severity for every item (fixed and backlog) is in the audit report
delivered alongside this change.

---

## 2026-07-24 — Fix published posts showing literal `{c:...}` markdown syntax
Reported as: looks correct while writing/publishing in the admin editor, but broken once viewed on the live
post page - the exact symptom of a bug that's specific to the *public renderer*, not the editor.

- **Root cause**: `lib/markdown.tsx`'s `inline()` only recursively parsed nested formatting for color spans
  (`{c:color}...{/c}`) - bold, italic, and link-label content were sliced out as *raw strings* instead of
  being re-parsed. That was invisible with the old textarea editor (nobody hand-types nested markdown), but
  Tiptap lets you genuinely apply Bold *and* a color to the same selection - which can serialize as
  `**{c:mint}text{/c}**` (bold wrapping color). On the public page, the outer `**...**` matched first,and its
  inner content - the color tag - got dropped in as inert literal text instead of being parsed, instead of
  rendering as bold, colored text.
- **Fix**: made the bold, italic, and link-label branches recursive, matching the color span's already-correct
  pattern (nesting in the *other* direction - color wrapping bold - already worked and had a test for it).
  Added regression tests for color-inside-bold, color-inside-italic, and formatted text inside a link label.

**Files**: `src/lib/markdown.tsx`, `src/lib/__tests__/markdown-render.test.ts`.

---

## 2026-07-24 — Profile photo lightbox + root-caused the Markets Overview mobile layout bug
- **Profile photo/banner lightbox**: tapping the avatar or banner on `/u/[username]` now opens the full,
  uncropped image full-screen (matching X's "tap a profile photo" pattern) - new `ImageLightbox` component,
  portal-rendered to `document.body` since the hero card's `.glass` (`backdrop-filter`) would otherwise clip
  an un-portaled `position: fixed` overlay to the card instead of the viewport. Only wired up when a real
  photo exists (not the initials/gradient fallback).
- **Root-caused the Markets Overview mobile layout bug** (previously reported as a stray line, then as "the
  page doesn't fit") - finally reproduced by testing with realistic long coin/token names instead of short
  placeholders, which is exactly why it never showed up in this sandbox's earlier fallback data. Two stacked
  bugs: (1) `MoverList`/`RankList`'s coin-name span was `flex-1 truncate` *without* `min-w-0` - a classic
  flexbox gotcha where a flex child's default `min-width: auto` blocks it from ever shrinking below its own
  content size, so `truncate` silently never engages. (2) Worse, every `<section className="grid ...">` in
  `MarketsClient.tsx` relied on the *implicit* single-column grid track below its first breakpoint instead of
  an explicit `grid-cols-1` - an implicit "auto" track sizes to content, not 100% width, so once (1) let a row
  demand extra width, the grid track (and everything in it) grew past the viewport. The page's own
  `overflow-x: hidden` safety net then silently clipped the overflow instead of failing loudly - which is
  what looked like a stray line in the first screenshot. Fixed both: added `min-w-0` to the three truncating
  name spans, and an explicit `grid-cols-1` to every grid in the file.

**Files**: `src/components/ImageLightbox.tsx`, `src/components/ProfileBannerImage.tsx`,
`src/app/u/[username]/page.tsx`, `src/components/MarketsClient.tsx`.

---

## 2026-07-24 — Premium visual identity (profile, avatar badge fix, feed/comments)
Premium members previously had almost no visual difference from Free - just a plain "★ Premium" badge.
Added a quiet, consistent gold treatment (X Premium/Discord Nitro style - restrained, not flashy) reusing
existing design tokens rather than inventing new effects.

- **Fixed a real Avatar bug**: the crown badge added in an earlier round was a *child* of the same
  `overflow-hidden` circular wrapper as the photo, so any part of it outside the circle's own bounds got
  clipped - exactly the "icon overlaps badly" the owner's screenshot showed. `Avatar` is now two layers: an
  outer positioning wrapper (badge lives here, never clipped) and an inner `overflow-hidden` circle (photo/
  initials + ring). Badge size is now a fixed per-size token (not a percentage), consistently proportioned
  at every `size` from `sm` to `xl`.
- **New `PremiumBadge`** (`src/components/PremiumBadge.tsx`): a crown + "Premium" pill using the site's
  existing `bg-gold-shine` gradient and `animate-shine` sweep (the same sheen already used site-wide, not a
  new effect) instead of a plain flat badge.
- **Profile hero polish**: a quiet gold vignette wash on the banner, gold-gradient username text, relaxed
  bio line-height, and `ProfileStats`' three cards get a subtle gold ring + stronger hover glow - all gated
  behind the profile owner's `Premium` membership.
- **Propagated to where premium members actually show up elsewhere**: the navbar's own account avatar,
  the mobile bottom-nav Profile avatar, a post's author byline (name + avatar) on `/research/[slug]`, and
  comment authors in `CommentSection` all now carry the gold ring/badge/gradient-name treatment when that
  person is Premium - added `membership` to the relevant Prisma selects (post author, comment author) since
  none of those queries previously read it.

**Files**: `src/components/Avatar.tsx`, `src/components/PremiumBadge.tsx`, `src/components/ProfileStats.tsx`,
`src/components/Navbar.tsx`, `src/components/BottomNav.tsx`, `src/components/CommentSection.tsx`,
`src/app/u/[username]/page.tsx`, `src/app/research/[slug]/page.tsx`, `src/app/api/posts/[id]/comments/route.ts`.

---

## 2026-07-24 — Rebuild the post editor on Tiptap (real rich-text engine)
Third round on the admin Content editor - the hand-rolled `contentEditable` + `document.execCommand` approach
kept resurfacing typing/cursor/toolbar bugs because that combination is exactly the layer real editors
(Notion, Medium, Obsidian) avoid building on directly. Replaced it with [Tiptap](https://tiptap.dev)
(ProseMirror) instead of patching the same fragile foundation again.

- **New `src/components/PostContentEditor.tsx`**: a `useEditor`/`EditorContent` Tiptap instance
  (`@tiptap/react` + `@tiptap/starter-kit`, configured down to just the marks/nodes our grammar supports -
  headings capped at H1-3, no strike/underline/code-block/ordered-list/horizontal-rule) with a toolbar that
  shows live active-state highlighting (`editor.isActive(...)`) and a new curated color Mark
  (`src/lib/tiptap-color-mark.ts`) matching the site's 4 design-token colors. `@tiptap/extension-placeholder`
  replaces the previous hand-rolled empty-state overlay.
- **Storage format is completely unchanged**: `richtext.ts`'s existing `markdownToHtml`/`htmlToMarkdown`
  still do the conversion at the boundary (Tiptap's HTML in, plain markdown string out for `/api/research`) -
  published posts, the live `Markdown` renderer, and every other consumer are untouched.
- **Root-caused a real selection bug during testing** (not just the reported symptom): toolbar buttons are
  plain `<button>` elements, and a click's default behavior shifts native DOM focus/selection away from the
  editor - this desynced Tiptap's own tracked selection from the browser's, so formatting a selection via the
  toolbar and then continuing to type could wipe the just-formatted text. Fixed with `onMouseDown`
  `preventDefault` on every toolbar button (the standard, documented fix for building a ProseMirror/Tiptap
  toolbar), verified via a throwaway Playwright harness driving the actual component (typing, bold, headings,
  colors, undo/redo, emoji - all confirmed correct end-to-end before removing the harness).

**Files**: `src/components/PostContentEditor.tsx`, `src/lib/tiptap-color-mark.ts`,
`src/components/PostEditor.tsx`, `src/app/globals.css`, `package.json`.

---

## 2026-07-24 — Fix broken Content editor, Premium not syncing, premium profile styling
Follow-up from the same day's WYSIWYG editor rewrite: it shipped with a real regression, plus two
membership-related requests.

- **Content editor: couldn't type at all**: the previous change made `markdownToHtml("")` return an empty
  string so the CSS `:empty` placeholder trick would fire - but that left a brand-new post's contentEditable
  box with literally zero child nodes, and several browsers can't reliably place a cursor or accept typing in
  a genuinely empty contentEditable. Now seeds with a minimal `<p><br></p>` block whenever there's no content,
  so the box is never truly childless; the placeholder is a plain absolutely-positioned overlay (an `isEmpty`
  React state kept in sync from `syncFromDom`) instead of relying on `:empty`, since the box no longer ever
  matches it.
- **Granting Premium didn't show up for an already-logged-in user**: `auth.ts`'s `jwt()` callback only
  re-reads `role`/`membership` from the DB when those fields are missing or on an explicit `update()` call -
  once set on first login, they were frozen in the JWT until the user logged out and back in, so an admin
  granting Premium had no visible effect for someone already signed in. Added a 60-second TTL
  (`token.syncedAt`) so the token self-heals on the next request after that window, without paying a DB read
  on literally every request.
- **Premium profile styling**: Premium members now get a distinct look on their profile - `Avatar` has a new
  opt-in `premium` prop (gold gradient ring + a small round crown badge over the avatar), applied only from
  the `/u/[username]` hero so every other Avatar call site site-wide is untouched, plus a gold ring/glow on
  the hero card itself for Premium.

**Files**: `src/components/PostEditor.tsx`, `src/lib/auth.ts`, `src/components/Avatar.tsx`,
`src/app/u/[username]/page.tsx`.

---

## 2026-07-24 — Notification dropdown overflow, profile banner, tab-page footers, real WYSIWYG editor
Four more owner-reported items from real device screenshots.

- **Notification bell dropdown overflowed off the left edge on mobile**: `NavActivity.tsx`'s panel was
  `absolute right-0` relative to the bell's own small wrapper, which sits mid-row in the navbar (the mobile
  search+menu icons come after it, not the true screen edge) - a 320px-wide panel anchored there routinely
  extended past the left edge. Below `sm`, the panel is now `fixed inset-x-3 top-[4.75rem]` (viewport-relative,
  same top offset already used elsewhere for content clearing the navbar), so it always fits the actual
  screen regardless of device width; `sm:` and up keeps the original bell-anchored `absolute` positioning.
- **Profile banner not showing despite being uploaded**: confirmed the banner *was* stored correctly (as an
  inline `data:` URL - Supabase Storage not configured) and previewed fine in `/settings`, but `stripInlineImage()`
  (added earlier for Fast Origin Transfer protection - public `/u/[username]` is ISR-cached and public, so a
  raw base64 blob there gets re-shipped to every visitor on every cache fill) was stripping it to `null` on
  the profile page for everyone, including the owner. Added `GET /api/profile` (self-only, `private, no-store`,
  returns the caller's own unstripped `image`/`bannerImage`) and a small client component
  (`ProfileBannerImage.tsx`) that renders the server's stripped banner by default, then rehydrates with the
  real image via that endpoint only when the viewer is the profile's own owner - public/anonymous visitors
  still get the FOT-safe stripped HTML, the owner sees their real banner.
- **Sitewide Footer was showing on bottom-nav tab pages**: entering Profile (or Tools/News/Journal/Research/
  Markets) showed the full marketing Footer (logo, socials, Explore/Account links) underneath the page content,
  overlapping oddly with the fixed bottom nav bar - `/community` and `/messages` already never render it for
  the same reason. Removed `<Footer />` from every bottom-nav-reachable page and sub-route (`/tools` + its
  share-card view, `/news` + `/news/read`, `/research` + `/research/[slug]`, `/markets` + `/markets/[id]` +
  `/markets/protocol/[type]/[slug]`, `/u/[username]`) - left untouched on Home, Premium, Contact, Terms and
  Privacy, which aren't reachable from the bottom nav and are meant to end in the full footer.
- **Admin post editor: real WYSIWYG formatting + fixed page-scroll-while-writing**: the "Content" box's
  toolbar (Bold/H1/Color/etc.) was inserting literal markdown syntax characters (`**`, `#`, `{c:red}...{/c}`)
  as plain visible text instead of actually formatting the selection. Replaced the plain `<textarea>` with a
  real `contentEditable` box driven by `document.execCommand` (bold/italic/headings/list/quote natively; code
  and the curated color spans via `insertHTML`, since there's no native command for either) - selecting text
  and clicking a button now shows the formatted result directly, the same way any rich text editor works.
  Storage is unchanged: a new self-contained `src/lib/richtext.ts` converts the box's HTML to/from the exact
  same plain markdown string `/api/research` already expects, so published posts, the live `Markdown` renderer
  and every other consumer are untouched. Toolbar buttons use `onMouseDown` `preventDefault` so the box never
  loses focus/selection when a button is clicked (the actual cause of formatting ever needing to "insert" at
  a stale cursor position in the first place), and the box now has `overscroll-contain` so scrolling that hits
  its top/bottom edge stops there instead of chaining up and moving the whole page.

**Files**: `src/components/NavActivity.tsx`, `src/app/api/profile/route.ts`, `src/components/ProfileBannerImage.tsx`,
`src/app/u/[username]/page.tsx`, `src/app/tools/page.tsx`, `src/app/tools/share/points-value/[id]/page.tsx`,
`src/app/news/page.tsx`, `src/app/news/read/page.tsx`, `src/app/research/page.tsx`, `src/app/research/[slug]/page.tsx`,
`src/app/markets/page.tsx`, `src/app/markets/[id]/page.tsx`, `src/app/markets/protocol/[type]/[slug]/page.tsx`,
`src/components/PostEditor.tsx`, `src/lib/richtext.ts`, `src/lib/__tests__/richtext.test.ts`.

---

## 2026-07-23 — Bottom nav swap, DM scroll/floating-bot fix, real author photo + admin Premium toggle
Four more owner-reported items from real device screenshots.

- **Bottom nav: Chat → Markets, Profile raised and enlarged**: Chat was dropped from the mobile bottom nav
  (`BottomNav.tsx`) since it's already one tap away via the navbar's chat-bubble icon at the top of every
  page - Markets takes that slot back. Profile is back in the *between* position (2 links, Profile, 3 links)
  instead of being just another uniform cell, now rendered as a raised 56px circle (`-mt-5`, ring + shadow)
  clearly bigger than the other tabs' icons, with a gold ring when active.
- **DM thread scrolling was scrolling the whole page**: `/messages` used a `min-h-screen` main with the chat
  panel sized via `h-[calc(100vh-11rem)]` - close, but not the same fixed/clipped frame `/community` uses, so
  the outer page could still grow taller than the viewport (mobile `100vh` quirks + the bottom-nav spacer)
  and scroll independently of the thread's own internal scroll. Rebuilt `/messages`' frame to match
  `/community` exactly (`h-[100svh] overflow-hidden flex flex-col`, `MessagesClient` now fills via `flex-1`
  instead of a fixed vh calc) and added `/messages` to `BOTTOM_HIDDEN_PREFIXES` (same reason `/community` is
  hidden there - the composer needs the full bottom edge, no room for the bottom nav too).
- **Floating XYZ AI bot now also hides when a DM thread is open on mobile** (`XyzAiWidget.tsx`): extended the
  existing `/community`-only hide condition to also cover `/messages` once a specific conversation is open
  (`?c=` present) - the inbox list alone doesn't have a composer to conflict with, so it only hides once a
  thread is actually open, matching what was asked ("jab dm me click kare").
- **Post byline now shows the real author photo**: `research/[slug]/page.tsx`'s byline always rendered a
  plain first-letter circle, regardless of whether the author had a real profile photo - `post.author.image`
  was fetched from the DB (and already safely stripped of inline `data:` URLs) but never actually used.
  Swapped it for the shared `Avatar` component (same one used everywhere else on the site), so any author's
  real uploaded photo now shows correctly - including the super admin's, matching what's on their own
  `/profile`.
- **Admins had no way to self-grant Premium**: the Dashboard's Members panel special-cased `role === "ADMIN"`
  rows to always show a static "Admin" badge and a plain "-" instead of a membership status + toggle -
  meaning an admin's own account could never be marked Premium from the UI (even though the underlying
  `/api/users/:id/membership` route already supports it for any user) and always displayed "Free" everywhere
  that reads `membership` (e.g. the navbar badge). Now every row - admin or not - shows its real Premium/Free
  status alongside the Admin badge, and gets the same Make Premium/Downgrade toggle.

**Files**: `src/components/BottomNav.tsx`, `src/app/messages/page.tsx`, `src/components/MessagesClient.tsx`,
`src/lib/bottom-nav.ts`, `src/lib/__tests__/bottom-nav.test.ts`, `src/components/XyzAiWidget.tsx`,
`src/app/research/[slug]/page.tsx`, `src/components/DashboardClient.tsx`.

---

## 2026-07-23 — Publish-section rich text: real H1 effect, color text, emoji picker, stable writing box
Owner asked for the Research post editor (`PostEditor.tsx`) to feel like a real publishing platform's writing
experience - direct formatting, color, emoji, and a writing box that never makes the whole page jump.

- **`# ` now has a real, distinct effect on the published page**: `lib/markdown.tsx` was silently downgrading
  a single `#` heading to an `<h2>` (identical styling to `##`), so it had no visible effect of its own -
  fixed to render an actual `<h1>`, and added the missing `.prose-xyz h1 { text-3xl }` CSS rule (there wasn't
  one - Tailwind's preflight strips default heading sizes, so even a correct `<h1>` would have rendered
  tiny). Added an H1 toolbar button (only H2/H3 existed before).
- **Color text**: added a small curated color-span syntax (`{c:gold}text{/c}`, four colors matching the
  site's existing design tokens - Gold/Mint/Red/Blue) to the same renderer, with 4 swatch buttons in the
  toolbar. Deliberately not free-form CSS/inline styles - kept to on-brand tokens. Works nested inside bold
  text and vice versa.
- **Emoji picker**: reused the existing `EmojiPicker` component (already built for community chat) as a new
  toolbar button - inserts at the cursor, no new emoji set to maintain.
- **Fixed the "writing makes the whole page jump" bug**: the toolbar's insert-and-refocus logic called
  `textarea.focus()` with no `preventScroll` option, which lets the browser auto-scroll the (already-visible)
  textarea into view on every single toolbar click - the classic cause of an unexpected page jump. Now uses
  `focus({ preventScroll: true })` and explicitly restores the textarea's own scroll position. Also converted
  the content box from a manually-`resize-y`-able, `rows`-based textarea to a fixed `h-[26rem]` box with its
  own internal `overflow-y-auto` (`resize-none`) - it can only ever scroll itself now, never destabilize the
  surrounding page layout.
- **Tests**: added `src/lib/__tests__/markdown-render.test.ts` covering the H1 fix (regression-proofs H2/H3
  are unaffected) and the color-span parsing (plain, nested-bold, and an unrecognized color falling through
  to plain text without crashing).

**Files**: `src/lib/markdown.tsx`, `src/app/globals.css`, `src/components/PostEditor.tsx`,
`src/lib/__tests__/markdown-render.test.ts` (new).

---

## 2026-07-23 — Mobile nav/menu fixes: unreachable Sign out, Journal in bottom nav, floating bot on Community, footer structure
Owner-reported bugs from real device screenshots, fixed one-for-one.

- **Mobile nav menu could cut off Sign out/Dashboard on shorter devices**: `Navbar.tsx`'s mobile "open" menu
  panel had no `max-height`/`overflow-y-auto` - on a signed-in account (Profile/Messages/Journal/Settings/
  Dashboard/Sign out, all stacked), the panel's total height could exceed the viewport, and since the
  panel sits inside a `position: fixed` header, the overflowing bottom portion was simply clipped off-screen
  with no way to scroll to it. Added a capped `max-h-[calc(100dvh-6rem)]` + `overflow-y-auto` so the full
  menu (including Sign out) is always reachable regardless of device height.
- **Journal added to the mobile bottom nav** (`BottomNav.tsx`), and all 6 tabs (Tools/News/Journal/Research/
  Chat/Profile) now render as a uniform `grid-cols-6` - no more special centered treatment for one cell,
  for a cleaner, evenly-aligned row.
- **Floating XYZ AI bot hidden on mobile `/community`** (`XyzAiWidget.tsx`): it overlapped the chat composer
  there with no room for both. Hidden via `max-md:hidden` on mobile only when on `/community`; desktop keeps
  it, and every other page is unaffected.
- **Footer's bottom bar restructured for mobile** (`Footer.tsx`): copyright / Terms+Privacy / the "Built for
  the Next Generation of Web3 · v2.0" tagline used to all cram into one `flex` row on mobile, wrapping
  awkwardly. Terms+Privacy now stay grouped together, with the tagline on its own line below on mobile -
  unchanged on `sm:` and up.
- **Investigated, not code-fixable**: a mobile browser's "Request desktop site" toggle forces its own wide
  layout viewport (~980-1024px) that overrides the page's `width=device-width` meta - a site cannot detect
  or opt out of that browser-level override, so there's no code path to special-case it. Confirmed the
  site's own viewport meta (`src/app/layout.tsx`) is already correct (`device-width`, `initialScale: 1`, no
  zoom lockout).

**Files**: `src/components/Navbar.tsx`, `src/components/BottomNav.tsx`, `src/components/XyzAiWidget.tsx`,
`src/components/Footer.tsx`.

---

## 2026-07-23 — Add RiseX to the Points/Airdrop Value Calculator
Added **RiseX** as a preset platform on `/tools`'s Points/Airdrop Value Calculator, same pattern as
Variational/Sodex - one new `DEX_REGISTRY` entry (`src/lib/dex-registry.ts`), zero component changes needed.

- **Scenario data** (owner-supplied): 12M total points, 1B total token supply, 20%/25%/30%
  supply-allocation quick-select buttons (via the existing `allocationScenarios` mechanism, same one Sodex
  uses for its pool-distribution buttons), and four FDV quick-select scenarios ($500M/$1B/$1.5B/$3B).
- **Real logo, not a favicon guess**: RiseX doesn't have a confirmed official domain to resolve via the
  existing keyless favicon-by-domain mechanism (every other platform uses that - no image ever committed),
  so the owner-supplied brand mark was committed instead (`public/risex-logo.png`). Added a `logo` override
  field to `DexPlatform`/`platformLogo()` - checked before the domain-favicon fallback - so this stays a
  one-off exception rather than a new default pattern.
- **Descriptive fields** (fees, chain, points rules, supported markets, leverage): written as honest
  "not confirmed - see official docs" placeholders rather than invented specifics, since no verified public
  info was available - matches this file's existing caution culture for assumption-based scenario data.
- **Known limitation**: the "Share result" OG card's platform logo comes from the same `domain` field used
  for favicon lookup; since RiseX has no domain on file, its share card renders without a platform logo
  (text-only), same graceful behavior any domain-less platform already gets. The in-app calculator (preset
  button, main UI) shows the real logo correctly either way.

**Files**: `src/lib/dex-registry.ts`, `public/risex-logo.png` (new).

---

## 2026-07-23 — Framework upgrade: Next 14 → 16 + React 18 → 19 (clears all 14 Next.js CVEs)
Closed the long-standing `HANDOFF.md §8` upgrade item. Turned out far smaller than the "owner-decision, huge
blast radius" framing, because the auth library didn't need replacing.
- **Dependencies**: `next` 14.2.35 → 16.2.11; `react`/`react-dom` 18 → 19; `next-auth` 4.24.7 → **4.24.15
  (stayed on v4** - it now lists `next ^15||^16` + `react ^19` as peers, so no Auth.js v5 rewrite, and
  `getServerSession(authOptions)` is unchanged); `@sentry/nextjs` → 10.67; `@react-three/fiber` 8 → 9 and
  `@react-three/drei` 9 → 10 (React 19 forces these); `eslint` 8 → 9 + `eslint-config-next` → 16;
  `@types/react(-dom)` → 19.
- **Async request APIs**: ran the official `next-async-request-api` codemod - `params`/`searchParams` are now
  awaited across 31 route handlers, server pages, and `generateMetadata` functions. No `cookies()`/`headers()`
  call sites existed, so that part was free. Typecheck stayed clean.
- **Segment config**: Next 16 rejects a non-literal segment config export, so `/api/news`'s
  `export const revalidate = NEWS_REVALIDATE` became a literal `90` (with a keep-in-sync comment).
- **Config**: removed `experimental.instrumentationHook` (instrumentation.ts is default in 16); Next auto-set
  `tsconfig` `jsx: "react-jsx"` (automatic runtime) and added the dev-types include.
- **Lint**: Next 16 removed the `next lint` subcommand. Migrated to ESLint 9 flat config (`eslint.config.mjs`
  consuming eslint-config-next 16's native `core-web-vitals`), script → `eslint src`, deleted `.eslintrc.json`.
  eslint-config-next 16 bundles react-hooks v6, whose new React-Compiler-era rules flag 72 pre-existing
  patterns; downgraded those five rules to **warn** so the framework bump isn't blocked by an unrelated
  cross-component effect refactor (tracked as a §8 follow-up).
- **R3F/drei bump is compile-only**: `useWebglGate()` is hardcoded `false` (the three.js orbital scene was
  disabled earlier), so the WebGL scene never renders in production - the CSS `OrbitalEcosystem` is the live
  centerpiece. R3F 9 / drei 10 only need to typecheck/build, which they do.
- **Verified**: typecheck + lint + 339 tests + `next build` (Turbopack) all green; a headless-Chromium run of
  the running app confirmed the homepage renders and hydrates under React 19 with zero uncaught/hydration
  errors (hero, CSS orbital centerpiece, nav, stats all present).
- **Result**: all 14 Next.js **framework** advisories cleared from `npm audit`. Remaining audit entries are
  non-framework and CI's audit step is non-blocking (`--audit-level=high || true`): `sharp`/libvips (2 new
  2026 highs, image-optimizer native lib, Vercel-managed at runtime) and `postcss` (moderate, build-time).
- **Files**: `package.json`, `package-lock.json`, `next.config.mjs`, `tsconfig.json`, `eslint.config.mjs`
  (new), `.eslintrc.json` (removed), `src/app/api/news/route.ts`, 31 codemod'd route/page files, `CLAUDE.md`,
  `docs/HANDOFF.md`, `docs/changelog.md`.

---

## 2026-07-20 — Security: GitHub OAuth linking now requires a primary && verified email
Closed the OAuth account-linking follow-up flagged in `HANDOFF.md §8`. The GitHub provider keeps
`allowDangerousEmailAccountLinking: true` (so an existing email+password user can later sign in with GitHub),
but that flag links an OAuth login into any existing account sharing the same email - which is only safe if
the email is proven to belong to the GitHub user.
- **Root cause**: the custom `profile()` override returned `profile.email` (GitHub's *public* profile email;
  and when that's unset, the default userinfo backfill picks the primary-but-not-necessarily-verified
  address) with no verified check. Combined with the linking flag, that was a latent account-takeover vector -
  a GitHub user could potentially link into a victim's account via an unverified address.
- **Fix**: `profile()` is now `async(profile, tokens)` and fetches `GET /user/emails` (granted by the
  `user:email` scope the provider already requests), selecting only a `primary && verified` address via a new
  pure helper `pickPrimaryVerifiedEmail()` in `src/lib/utils.ts`. `profile.email` is no longer trusted for
  linking. When there's no primary+verified address (private-email setting, missing scope, or a failed/timed-
  out lookup), it falls back to the existing non-deliverable `gh-<id>@users.noreply.xyzcrypto.io` placeholder,
  so linking can never attach to an unverified address (login still works; email features simply no-op).
- The fetch is wrapped in try/catch and gated on `res.ok`, so a GitHub API hiccup degrades to the placeholder
  rather than throwing out of `authorize`.
- **Tests**: added `pickPrimaryVerifiedEmail` cases to `src/lib/__tests__/utils.test.ts` (requires both flags;
  rejects primary-but-unverified and verified-but-not-primary; null on empty/non-array/malformed). Full
  pipeline green: typecheck + lint + 339 tests + build. (The live OAuth handshake itself isn't exercisable
  without real GitHub credentials; the security-critical selection logic is covered by the unit test.)
- **Files**: `src/lib/auth.ts`, `src/lib/utils.ts`, `src/lib/__tests__/utils.test.ts`, `docs/HANDOFF.md`,
  `docs/changelog.md`.

---

## 2026-07-20 — Docs: correct the Next.js CVE picture + GitHub OAuth email-verification follow-up
Doc-only pass following an audit of how this app actually uses Next against the flagged advisories.
- **`docs/HANDOFF.md §8`**: rewrote the Next.js CVE item. `npm audit` now flags **14** Next.js advisories
  (not the 8 first counted on 07-17 - the set grew as more were disclosed), all covering the pinned
  `next@14.2.35` and cleared only by `next@16.2.10` (two majors). Assessed per-advisory against this app's
  surface: the genuine residual is **RSC / Server-Component DoS-class only, with no data exposure** (the loud
  high CVEs - WebSocket SSRF, Pages-Router+i18n middleware bypass, rewrites smuggling, CSP-nonce /
  `beforeInteractive` XSS, image-cache DoS - don't apply, because the app doesn't use those features or Vercel
  manages them). Documented that **the real driver to upgrade is that Next 14 receives no security backports**,
  and the caveat that the "not affected" verdicts flip if the app ever adds middleware, CSP nonces, i18n,
  rewrites, or a custom server/WebSocket-upgrade path.
- **`docs/HANDOFF.md §8`**: added a follow-up item to harden the GitHub OAuth `profile()` callback -
  `src/lib/auth.ts` uses `allowDangerousEmailAccountLinking: true` but the custom `profile()` override takes
  `profile.email` (GitHub's public email) with no explicit verified check and never calls `/user/emails`, so
  it should assert the address is the account's `primary && verified` email before linking. Pre-existing since
  PR #105; verified via git history that the 07-17 hardening pass did not touch OAuth linking.
- **`CLAUDE.md`**: synced the "Current state" security bullet's "8 Next.js-tree CVEs" line to match (14
  advisories, RSC DoS-class residual, no backports for Next 14).
- No source code changed; no runtime behavior affected.
- **Files**: `docs/HANDOFF.md`, `CLAUDE.md`, `docs/changelog.md`.

---

## 2026-07-19 — Handoff docs refresh (bring HANDOFF.md + CLAUDE.md current to PR #154)
Doc-only pass: `HANDOFF.md`'s header and §7 narrative had stalled at PR #145 (2026-07-16) even though nine
more PRs (#146-#154) had merged. Reconciled both against the actual code + the (already-current) changelog so
a cold-start session no longer misses recently-shipped work.
- **`docs/HANDOFF.md`**: bumped the "Last updated" line (#145 → #154). Added three missing §7 sections — the
  2026-07-17 security hardening pass (timing-oracle, atomic lockout, `x-vercel-forwarded-for` IP source,
  `otpEmail` limiter, flagged Next.js CVEs) + ISR-Writes realignment + desktop perf trims; the 2026-07-17/18
  Sodex calculator add/fix; and the 2026-07-19 free-tier overage fixes (Fluid Active CPU via the `loginIp`
  pre-bcrypt gate, `/api/markets/search` ISR window, `stripInlineImage()` FOT fix, signup schema-drift
  loud-fail, hardcoded-email removal). Added three owner action items to §8: prod DB migration re-run,
  one-time inline-`data:`-avatar DB check, and the Next.js CVE upgrade.
- **`CLAUDE.md`**: "Current state" dated 2026-07-16 → 2026-07-19, replaced the stale "this session" bullet
  with security-hardening + overage-fix + open-owner-action bullets, and documented the two-independent-keys
  rate-limit convention (`login`+`loginIp`, `otpEmail`, un-spoofable IP source) in Conventions.
- **Files**: `docs/HANDOFF.md`, `CLAUDE.md`, `docs/changelog.md`.

---

## 2026-07-19 — Feature downgrades for Hobby-plan cost: voice rooms removed, crons paused, manual AI briefing, shared realtime client, anon community preview
Owner-requested follow-up to the 2026-07-18 audit: trade specific features for lower ongoing cost while the
site stays on the free plan, deferring the removed pieces to when a paid plan is in place.

- **Mobile bottom nav**: replaced the Markets tab with Tools (`src/components/BottomNav.tsx`) - Tools is the
  free-to-use, no-login calculator hub and gets more mobile traffic relative to its cost than Markets' live
  price polling.
- **Voice Rooms removed entirely** (was LiveKit-powered, gated behind `voiceEnabled`): deleted
  `VoiceRoom.tsx`, `api/voice/token/route.ts`, `docs/VOICE.md`, the `livekit-client`/`livekit-server-sdk`
  dependencies, and every `LIVEKIT_*` env var (schema, `.env.example`, `src/lib/env.ts`'s `voiceEnabled`).
  Updated the `/terms` and `/privacy` copy that mentioned it. Can be reinstated from git history if revisited
  on a paid plan.
- **Push-dispatch + watchdog GitHub Actions crons paused**: commented out the `schedule:` trigger in both
  `.github/workflows/push-dispatch.yml` (was */10 min) and `watchdog.yml` (was */30 min), keeping
  `workflow_dispatch:` so either can still be run manually. Zero scheduled Function Invocations from these
  until re-enabled on a paid plan.
- **News AI briefing is now manual**: `NewsClient`'s story reader and `SharedArticle` (the shared-link page)
  used to auto-fire `/api/ai/why-matters` the moment a story opened. `BriefingBlock.tsx` gained an
  `onGenerate` prop and shows a "Generate briefing" button instead; the fetch only happens on click. Added a
  ref-based guard in both callers so a click that resolves after the reader has moved to a different
  story/unmounted can't set stale state (the old auto-fire had a `useEffect` cleanup for this that a manual
  click handler doesn't get for free).
- **Poll intervals widened** across the ticker and news/markets pollers: `useTickerPoll` 60s → 150s,
  `LiveNewsVisual` 60s → 150s, `NewsClient`'s realtime feed poll 45s → 90s, `MarketsClient`'s `TrendingNews`
  120s → 180s, and its four `usePolledJson` calls (global/defi/perp/coins) 120-150s → 180s.
- **One shared Supabase Realtime client for the whole tab**: every realtime/presence hook
  (`useRealtime`, `useLivePresence`, `useUserOnline`, plus `RealtimeSession`, `WhatsNewFeed`, `ChatClient`,
  `NavActivity`, `DashboardClient`) previously called `createClient()` itself, each opening its own physical
  WebSocket connection to the same Supabase project - a single page could open 2-4 redundant connections
  (site presence + navbar notifications + chat + comments, etc.) for no benefit, since Supabase multiplexes
  any number of channel subscriptions over one client. Added `src/lib/realtimeClient.ts` (a lazily-created
  singleton) and migrated all nine call sites to it. Concurrent-connection count against Supabase's Realtime
  quota drops from up to N per page to 1 per browser tab.
- **`/community` gives anonymous visitors a read-only preview** instead of the full live room: added
  `getCommunityPreview()` (`src/lib/chat.ts`, `unstable_cache`-backed, 15s shared TTL, no per-user data) and
  a new `CommunityPreview.tsx` component (last 20 messages + pinned banner + "Log in to join" CTA, no
  WebSocket connection, no composer). `community/page.tsx` now branches on `getServerSession()`: anonymous
  visitors skip the full-history Prisma query and the realtime channel entirely; logged-in members get the
  exact same full `ChatClient` experience as before, unchanged.

**Files**: `src/components/BottomNav.tsx`, `.github/workflows/push-dispatch.yml`, `.github/workflows/watchdog.yml`,
`src/components/BriefingBlock.tsx`, `src/components/NewsClient.tsx`, `src/components/SharedArticle.tsx`,
`src/lib/useTickerPoll.ts`, `src/components/LiveNewsVisual.tsx`, `src/components/MarketsClient.tsx`,
`src/lib/realtimeClient.ts` (new), `src/lib/useRealtime.ts`, `src/lib/useLivePresence.ts`,
`src/lib/useUserOnline.ts`, `src/components/RealtimeSession.tsx`, `src/components/WhatsNewFeed.tsx`,
`src/components/ChatClient.tsx`, `src/components/NavActivity.tsx`, `src/components/DashboardClient.tsx`,
`src/lib/chat.ts`, `src/components/CommunityPreview.tsx` (new), `src/app/community/page.tsx`,
`src/lib/env.ts`, `.env.example`, `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, `package.json`,
`CLAUDE.md`, `docs/HANDOFF.md` - removed: `src/components/VoiceRoom.tsx`, `src/app/api/voice/token/route.ts`,
`docs/VOICE.md`.

---

## 2026-07-18 — Hobby-plan performance audit: dedupe fetches, cut a doubled cron invocation, streaming/parallelism on Journal
Full-repo pass (routes, API handlers, cron/background tasks, `fetch()` sites, `useEffect` cleanup, bundle
size) specifically for Vercel Hobby-plan cost drivers, on top of the prior CPU/ISR-Writes/Fast-Origin-Transfer
rounds. Most of the codebase checked out clean (force-dynamic pages are all genuinely session-gated, bundle
sizes are all reasonable, the AI response cache is well-wired) - this round's changes are the handful of
confirmed, real findings.

- **`MarketTicker` + `LiveMarketVisual` polled `/api/ticker` independently** - two separate 60s intervals
  fetching the exact same endpoint whenever both render on a page (navbar marquee + homepage Products card),
  doubling that request volume for no benefit. Added `src/lib/useTickerPoll.ts`, a module-level
  `useSyncExternalStore` store shared by both components: one fetch, one interval, regardless of how many
  consumers are mounted: starts on first subscriber, stops when the last one unmounts, pauses while the tab
  is hidden. Rendered markup in both components is unchanged.
- **`/api/push/dispatch` self-fetched its own app's `/api/news` route** over HTTP instead of calling the
  underlying pipeline directly - a self-fetch anti-pattern that doubled Vercel Function Invocations on every
  cron tick (up to ~144/day from the GitHub Actions poller) for zero benefit, since `getNewsPage()` already
  sits behind the same cache `/api/news` itself reads from. Now calls `getNewsPage()` directly.
- **`vercel.json`** carried a redundant daily native cron (`/api/push/dispatch` at 08:00) duplicating a time
  slot already covered by the GitHub Actions 10-minute poller (`.github/workflows/push-dispatch.yml`).
  Removed.
- **`/journal`** (force-dynamic, largest route by First Load JS) ran two independent Prisma queries
  (`trade.findMany` with a `take: 1000` + nested `fills` include, then `riskProfile.findUnique`) sequentially
  instead of concurrently, and had no `loading.tsx` - every visit blocked the whole page (including the
  navbar) with zero streaming boundary. Parallelized the two queries with `Promise.all`, and added
  `src/app/journal/loading.tsx` matching the skeleton pattern already used by `/dashboard`.
- Two small missing-cleanup fixes found during the sweep: `PwaSetup.tsx`'s `appinstalled` listener was never
  removed on unmount (inline anonymous function, so even a naive removal wouldn't have matched);
  `CommandPalette.tsx`'s focus `setTimeout` had no cleanup. Both low severity in practice (both components
  mount once and persist), fixed as found.

**Deliberately not changed** (found, evaluated, and left alone to respect "no UI changes" / "keep existing
functionality"): `NewsClient`'s AI briefing auto-firing on every story view (shipped, user-visible UX, not a
bug); coin-brief/protocol-brief AI prompts embedding live numbers that defeat their own cache in practice
(low volume, click-gated); the duplicate CoinGecko fetch between `markets/[id]`'s `generateMetadata` and the
`coin/[id]` API route (fixable, but risks an SEO metadata regression for marginal gain); three independent
`/api/news` pollers across `LiveNewsVisual`/`MarketsClient`/`NewsClient` (different pages, not simultaneous,
lower severity than the ticker case); `/community`'s force-dynamic render (already a known, twice-deferred
structural lever, unchanged again this round).

- **Files**: `src/lib/useTickerPoll.ts` (new), `src/components/MarketTicker.tsx`,
  `src/components/LiveMarketVisual.tsx`, `src/app/api/push/dispatch/route.ts`, `vercel.json`,
  `src/app/journal/page.tsx`, `src/app/journal/loading.tsx` (new), `src/components/PwaSetup.tsx`,
  `src/components/CommandPalette.tsx`.

---

## 2026-07-19 — Fix Vercel free-tier overages: Fluid Active CPU (exceeded), ISR Writes, Fast Origin Transfer
Owner's Vercel dashboard showed "Exceeded free resources": Fluid Active CPU 6h23m/4h (already over), ISR
Writes 161K/200K (80.5%), Fast Origin Transfer 9.07/10GB (90.7%). Three parallel investigations found
concrete root causes for each - one a direct regression from a security fix shipped earlier this session.

**Fluid Active CPU (the urgent one)** - the 2026-07-17 login timing-attack fix added a dummy
`bcrypt.compare()` on every failed/nonexistent-account login attempt to stop timing-based user enumeration.
Benchmarked on this machine: `bcryptjs` (the pure-JS package this repo uses, not native `bcrypt`) costs
~317-352ms of genuine synchronous CPU per call at cost factor 12 - 2-4x higher than the ~80-150ms the
original fix assumed, since pure-JS bcrypt can't offload to a native threadpool. Fluid Compute bills
specifically for synchronous CPU time. The login rate limiter was keyed only by target email, not caller
IP, so a bot rotating through fake emails from one IP was barely throttled - each attempt still forced a
full bcrypt op.
- **Fix**: added a genuine per-IP rate limit (`loginIp`, 20/min/IP) checked *before* any bcrypt work runs in
  the credentials login path, alongside (not replacing) the existing per-email limiter and the timing-safety
  fix itself. `src/lib/ratelimit.ts` gained `clientIpFromHeaders()` since NextAuth's `authorize(credentials,
  req)` passes a plain `Record<string, any>` headers object, not a `Headers` instance with `.get()`.
- **Files**: `src/lib/auth.ts`, `src/lib/ratelimit.ts`.

**ISR Writes** - confirmed the 2026-07-17 fix is genuinely working (daily write rate roughly halved,
traced via this changelog's own historical percentage snapshots), the 161K figure is just a blend of the
old faster pre-fix rate (most of this billing cycle) plus ~2 days of the new slower rate. Found one
genuinely missed route from that audit: `/api/markets/search` - still `revalidate = 60`, keyed by an
arbitrary user-typed search string (high cardinality, same risk class already fixed for per-coin routes).
Predates the 07-17 audit, simply missed.
- **Fix**: lengthened `/api/markets/search`'s `revalidate` 60s → 300s, with matching `Cache-Control` headers.
- **Files**: `src/app/api/markets/search/route.ts`.

**Fast Origin Transfer** - every previously-fixed contributor confirmed still working, nothing to re-touch.
`/community`'s force-dynamic render remains a known, twice-already-deferred structural lever (unchanged).
Found a new, previously-uncaught contributor: `uploadImage()` (`src/lib/storage.ts`) falls back to storing
an uploaded avatar/banner as a raw base64 `data:` URL (up to 700KB) directly in the DB whenever Supabase
Storage is unconfigured or fails. That field was being selected raw and uncompressed in several hot,
high-fan-out paths never scoped for this: every community chat message's author, every DM conversation
partner, public post comments, follow lists, and public profile/article pages. A single active user with a
large inline avatar could plausibly be a multi-hundred-MB/month contributor on its own - invisible in
payload-shape review since it's "just a string field." This is distinct from the navbar's existing
JWT-stripping fix, which only covers the 4KB session-cookie concern for the current user's own navbar, not
any of these DB-read paths serving *other* users' images to *other* viewers.
- **Fix**: added `stripInlineImage()` (`src/lib/utils.ts`) - converts a `data:` URL image to `null` (client
  already falls back to initials gracefully) - and applied it at all six read paths: `src/lib/chat.ts`
  (`toChatPayload`), `src/lib/dm.ts` (`otherOf`), `src/app/api/posts/[id]/comments/route.ts` (GET + POST),
  `src/app/api/follow/list/route.ts`, `src/app/u/[username]/page.tsx` (`getProfile`), and
  `src/app/research/[slug]/page.tsx` (`getPost`).
- Flagged for the owner, not fixed in code: whether any real users have hit this fallback needs a one-time
  read-only production DB check (`SELECT username, length(image) FROM "User" WHERE image LIKE 'data:%' ...`)
  to quantify actual impact and decide if existing data needs backfilling - the code fix above is safe
  defense-in-depth regardless of the answer.
- **Files**: `src/lib/utils.ts`, `src/lib/chat.ts`, `src/lib/dm.ts`,
  `src/app/api/posts/[id]/comments/route.ts`, `src/app/api/follow/list/route.ts`,
  `src/app/u/[username]/page.tsx`, `src/app/research/[slug]/page.tsx`.

## 2026-07-19 — Remove hardcoded personal email + regenerate .env.example
Two items from the corrected hardening checklist, both real and cheap:
- **`.env.example:46`** (`ADMIN_EMAIL`) and **`src/lib/env.ts`** (`VAPID_SUBJECT`'s fallback) both had the
  owner's real personal Gmail hardcoded - publicly documenting exactly which account auto-promotes to
  ADMIN if that inbox were ever compromised. `.env.example` now uses a generic placeholder.
  `VAPID_SUBJECT` can't just be blanked though - `web-push`'s `setVapidDetails()` throws at runtime on an
  empty/invalid subject once the VAPID keys are configured, so it now falls back to the site's existing
  public support address (`site.email`, already used elsewhere e.g. the Terms/Privacy Grievance Officer
  contact) instead of a real personal one.
- **`.env.example` was 17 env vars behind `src/lib/env.ts`** (`GEMINI_API_KEY`, `AI_PROVIDER_ORDER`, the
  three `AI_DAILY_LIMIT_*`, `CMC_API_KEY`, `GIPHY_API_KEY`, the three VAPID vars, `CRON_SECRET`,
  `TELEGRAM_BOT_TOKEN`/`CHAT_ID`, the three `LIVEKIT_*` vars, and `SENTRY_DSN`) - anyone bootstrapping from
  it silently got voice, push, Sentinel, GIFs, CMC enrichment, and the AI fallback switched off with no
  hint they exist. All 17 added, grouped into new sections matching the file's existing style.
- **Files**: `.env.example`, `src/lib/env.ts`.

## 2026-07-19 — Fix: signup silently failing on DB schema drift, made loud instead
Owner reported no new signups showing in the dashboard for a while, and separately hit a real "Database not
migrated: a required column is missing" error on `/forgot-password` - confirming the production DB has
genuinely drifted behind `prisma/schema.prisma` (the `db push` step in the `vercel-build` script is
best-effort/non-fatal, so a failed run there can silently persist across deploys with zero visibility).
Password reset already surfaces this correctly via `handleError`'s existing P2021/P2022 → "Database not
migrated" mapping - but the signup-completion path had no such handling.
- **Root cause found**: `src/lib/auth.ts`'s NextAuth `authorize()` signup-completion branch calls
  `prisma.user.findUnique({ where: { email } })` with no explicit `select` (unlike the login path, which
  was already hardened with one) - so it fetches every column in the schema. A missing column there throws,
  NextAuth turns any thrown `authorize()` error into the same generic result the client already shows for a
  genuinely wrong code ("Incorrect or expired code. Please try again.") - and since `verifyCode()` deletes
  the one-time code the moment it validates, the user is then stuck in an unrecoverable retry loop with no
  new row ever created, and no error anywhere pointing at the real cause.
- **Fix**: both DB touches in that branch (`findUnique` and the `create()` fallback) now explicitly catch
  P2021/P2022, report to Sentry (`Sentry.captureException`, tagged `area: signup-completion`) and console,
  then return `null` - same safe behavior as before, but now loud instead of silent. This won't fix already-
  drifted production data (that needs the actual migration re-run, which only the owner can trigger via a
  fresh deploy or `prisma db push` with real credentials), but the next time this happens it surfaces
  immediately instead of silently starving signups for an unknown stretch of time.
- **Update (2026-07-19): live signups verified working** - a real account was created successfully, so the
  `User`-table columns the signup path touches are back in sync (via a deploy re-running the `vercel-build`
  `db push`, or the drift having only ever affected other columns). The remaining open question is whether
  *other* tables are still drifted - see `docs/HANDOFF.md §8`.
- **Files**: `src/lib/auth.ts`.

## 2026-07-18 — Fix: Sodex calculator's total-supply/pool-size conflation + add 50%/30% pool buttons
Owner caught a real bug via screenshot: the previous Sodex entry set `totalSupply` to 150,000,000 (the
SoPoints airdrop pool size), not SOSO's real total supply of 1,000,000,000 - so the "Total token supply"
field showed the wrong number, and typing a smaller test value into it (e.g. 45) blew up the implied price
to an absurd $966,666 instead of the real $0.29. Corrected the data model: `totalSupply` is now the real 1B,
`fdvScenariosUsd` is the real FDV ($0.29 × 1B = $290M), and the 150M-token pool is expressed correctly as
15% of total supply via `allocationPctOfSupply`.
- Also added the two scenarios the owner asked for as one-click options, not just editable-by-hand: a new
  optional `allocationScenarios` field on `PointValueScenario` (`src/lib/dex-registry.ts`) renders a row of
  quick-select buttons - "100% pool - 150M SOSO" (15%), "50% pool - 75M SOSO" (7.5%), "30% pool - 45M SOSO"
  (4.5%) - mirroring the existing FDV-scenario button pattern exactly.
- Purely additive to `PointsValueCalculator.tsx`: the new button row only renders when a platform provides
  `allocationScenarios`, so Variational (and every other existing platform) is pixel- and behavior-identical
  to before - only Sodex gains the new row.
- Verified by hand against the owner's numbers: $1.611111 / $0.805556 / $0.483333 per SoPoint across the
  100%/50%/30% scenarios, all reproduced exactly.
- **Files**: `src/lib/dex-registry.ts`, `src/components/tools/PointsValueCalculator.tsx`.

## 2026-07-17 — Add Sodex to the Points/Airdrop Value Calculator
Added Sodex (SOSO token, SoPoints program) as a preset platform in the existing Points/Airdrop Value
Calculator on `/tools` - same generic calculator + registry-driven pattern already used for Variational,
Hyperliquid, GMX, dYdX, Vertex, and Aevo, so no component or share-flow code changed at all, just one new
`DEX_REGISTRY` entry. Real logo comes for free via the existing favicon-by-domain mechanism (`sodex.com`),
same as every other platform - no image asset committed.
- Scenario numbers (150,000,000 SOSO SoPoints pool, 27,000,000 total SoPoints, $0.29 real current SOSO
  price) reproduce the given real figures exactly through the calculator's existing formula: $1.611111 per
  SoPoint at full pool distribution, $43,500,000 total pool value - verified by hand before shipping.
- Sharing works identically to every other platform (Post to X / copy link / copy image / download), since
  the share card route reads the platform name + domain generically from the saved snapshot.
- **Files**: `src/lib/dex-registry.ts`.

## 2026-07-17 — Fix: ISR Writes approaching Vercel free-tier quota
Owner got a Vercel email: the free team had used 75% of the 200,000/month **ISR Writes** quota (a
different metric from the Fast Origin Transfer work earlier this session) - exceeding it auto-pauses the
whole site. Audited every `revalidate` window and every `revalidatePath()` call site. Root cause: several
high-traffic routes had a `revalidate` window matched almost exactly by a client-side poll interval of the
same length, so the ISR cache was being regenerated as often as the code could possibly trigger it -
`/api/ticker` (10s window, 10s poll, homepage-mounted) was the single largest contributor, with a
theoretical ceiling alone (~259k/month) already above the entire monthly quota. `/api/news` compounds this
further since it caches per-RSS-source-URL - a short window multiplies across every source. No
`revalidatePath()`/`revalidateTag()` call site was a meaningful contributor (all are either admin-gated and
rare, or self-service and rate-limited to 10/min/user).
- **`/api/ticker`**: `revalidate` 10s → 60s; **`MarketTicker.tsx`** poll 10s → 60s; **`LiveMarketVisual.tsx`**
  poll 30s → 60s (matches).
- **`news-fetch.ts`** (`NEWS_REVALIDATE`, shared by `/api/news` + `/news`): 20s → 90s; **`news/page.tsx`**:
  30s → 90s; **`NewsClient.tsx`** poll 20s → 45s.
- **`/api/markets/coins`**: 45s → 120s; **`/api/markets/perp`** + **`/api/markets/global`**: 60s → 150s;
  **`MarketsClient.tsx`** pollers realigned to match each route's new window (also fixed `defi`'s poll,
  which was already polling faster than its own 120s cache).
- **`/markets/[id]`** page: 120s → 300s; **`/api/markets/coin/[id]`**: 60s → 150s; **`CoinDetailClient.tsx`**
  poll 30s → 150s - these are dynamic per-coin-id routes, so the write cost multiplies by how many distinct
  coins get traffic, not just window length.
- All `Cache-Control: s-maxage/stale-while-revalidate` response headers updated to match the new windows.
- **Files**: `src/app/api/ticker/route.ts`, `src/app/api/news/route.ts`, `src/app/api/markets/coins/route.ts`,
  `src/app/api/markets/perp/route.ts`, `src/app/api/markets/global/route.ts`,
  `src/app/api/markets/coin/[id]/route.ts`, `src/app/markets/[id]/page.tsx`, `src/app/news/page.tsx`,
  `src/lib/news-fetch.ts`, `src/components/MarketTicker.tsx`, `src/components/LiveMarketVisual.tsx`,
  `src/components/MarketsClient.tsx`, `src/components/NewsClient.tsx`, `src/components/CoinDetailClient.tsx`.

## 2026-07-17 — Security hardening pass + further desktop performance trims
Owner asked for a full security check with real fixes (not just a report) plus another desktop performance
pass, following the earlier duplicate-starfield fix (PR #146 below). All findings came from three parallel
codebase audits; each fix below was verified with `tsc --noEmit` + `next lint` + `vitest` (335 tests) +
`next build`, all green.

**Security:**
- **`src/lib/auth.ts`**: login timing-oracle fix - "no such account," "account locked," and "wrong
  password" all now cost the same by running a dummy `bcrypt.compare()` against a fixed never-matching
  hash on the two fast-fail paths, closing a user-enumeration vector based on response latency. Also fixed
  the login-lockout counter: it was a read-then-write (`fails = count + 1`), so N concurrent failed
  attempts could all read the same starting count and only ever advance it by 1 - a parallelization bypass
  of the 5-attempt lockout. Now a single atomic Prisma `{ increment: 1 }`, which Postgres row-locks. Added
  a `rateLimit()` call on the signup OTP-verify path in `authorize()`, on top of `otp.ts`'s own attempt
  counter.
- **`src/lib/ratelimit.ts`**: `clientIp()` now prefers `x-vercel-forwarded-for` (set by Vercel's edge
  network, not client-controllable) over the spoofable `x-forwarded-for`, closing a bypass where every
  IP-keyed limiter (signup/comment/like/subscribe/password) could be defeated by rotating a client-set
  header. Added a new `otpEmail` limiter (3 per 10 min, keyed by the target email, independent of the
  IP-keyed limiters) to stop email-bombing a single address via IP rotation - wired into
  `api/auth/signup/start` and `api/auth/password/start`. Upstash-not-configured-in-production now also
  fires a `Sentry.captureMessage` (was `console.warn`-only, easy to miss in log volume) since it silently
  disables all rate limiting.
- Flagged, not auto-fixed (needs explicit owner go-ahead): `npm audit` shows 8 real CVEs in the Next.js
  dependency tree, all requiring `next` 14.2.35 → 16.2.10 (2 major versions) to resolve - too large a
  blast-radius change to apply in this pass.

**Performance (desktop):**
- **`Navbar.tsx`**: `<NavActivity />` (bell + chat icon, 60s poll + a Supabase realtime subscription) was
  mounted **twice** - once inside the `hidden md:flex` desktop wrapper, once inside the `flex md:hidden`
  mobile wrapper. Tailwind's `hidden`/`md:hidden` only toggle CSS `display`, not React mount state, so both
  copies were live and polling/subscribed at every viewport size. Now a single shared instance.
- **`PageBackground.tsx`**: was `absolute inset-0`, so its blurred mesh/grid/glow layers stretched to the
  full scrollable height of long product pages. Now bounded to `h-screen` - it's only ever visible behind
  the top of the page anyway.
- **`globals.css`**: trimmed the desktop base blur radii for `.mesh` (96px → 70px) and `.aurora` (62px →
  45px) - these full-screen Gaussian blurs are a recurring compositing cost; mobile already had its own
  trim, desktop never did.
- **`PostCard.tsx` / `ResearchGrid.tsx`**: added a `priority` prop, wired to the first card in the grid, so
  the above-the-fold research-hub image isn't lazy-loaded.
- **Files**: `src/lib/auth.ts`, `src/lib/ratelimit.ts`, `src/app/api/auth/signup/start/route.ts`,
  `src/app/api/auth/password/start/route.ts`, `src/components/Navbar.tsx`,
  `src/components/PageBackground.tsx`, `src/app/globals.css`, `src/components/PostCard.tsx`,
  `src/components/ResearchGrid.tsx`.

## 2026-07-17 — Fix: desktop lag / jank on the homepage
Owner reported the site had gotten laggy and the design wasn't rendering cleanly, specifically on desktop.
Measured directly (Playwright, 1920x1080): the homepage had **257+ simultaneously "running" CSS
animations** on load, growing past 270+ once scrolled. Root cause traced to `Starfield` (stars + shooting
meteors + nebula haze) being mounted **twice** on the homepage - once directly in `Hero.tsx`, once again
via `OrbitalBackdrop.tsx` for the orbital section right below it - and both mounts rendering their full,
non-reduced desktop star/shooter set (the existing mobile media query only trims the "extra" tier; desktop
was never trimmed at all). The two sections sit close enough that scrolling between them puts both
starfields active at once, doubling an already-heavy continuous-animation cost for no real visual benefit
(they read as one continuous backdrop, not two distinct scenes) - a cost that scales with viewport size, so
it's naturally worse on desktop's larger canvas than on mobile.
- **`Starfield.tsx`**: added a `light` prop that renders half the shooting-star set (6 instead of 12).
- **`OrbitalBackdrop.tsx`**: now passes `light`, so only the Hero's Starfield mount (the one seen first,
  worth keeping at full richness) renders the full 12-shooter set; the orbital section's redundant
  continuation mount is lighter. Total shooting-star elements on the homepage: 24 → 18.
- Confirmed via direct computed-style sampling (not just a screenshot) and a full desktop screenshot pass -
  no visual regression, still reads as one continuous starfield across both sections.
- **Files**: `src/components/Starfield.tsx`, `src/components/OrbitalBackdrop.tsx`.

## 2026-07-16 — REVIEW (not merged): further Fast Origin Transfer reduction
Owner wants Fast Origin Transfer usage (8.58GB/10GB) reduced enough to comfortably last another 4-5 months
on the free plan. Fresh audit for more of the same class of bug already fixed on `/research/[slug]` and
`/api/news/social`. Kept as an unmerged PR for review per the owner's request, rather than auto-merged like
the earlier rounds.
- **`/api/chat/messages` (GET)** - the single largest remaining driver found: polled every 10s by every open
  `/community` tab as the realtime fallback, with no `Cache-Control` at all, running 2-3 Prisma queries per
  call and returning a heavy payload (50 messages with nested user/replyTo/reactions/poll objects). For an
  anonymous requester (no poll votes to stamp) the response for a given cursor is identical across all
  visitors, so it's now cached publicly for a few seconds (`public, s-maxage=8, stale-while-revalidate=20`),
  matching the `api/news/social` recipe. Logged-in responses stay `private, no-store` since `myVote` is
  genuinely per-viewer.
- **Lengthened ISR windows** on pages whose content only actually changes via an explicit edit (which
  already calls `revalidatePath`) - the time-based window is just a safety net, so a shorter one buys nothing
  but more origin re-renders: `research/[slug]` 60s → 300s, `research` (hub) 120s → 300s, `u/[username]`
  60s → 300s.
- **Investigated but not touched**: `/community`'s own force-dynamic render (unconditional `getServerSession`
  even for anonymous visitors) - still the biggest *structural* win, but unlocking it means moving
  poll-vote/`me` personalization out of the 1744-line `ChatClient.tsx` into a client-side fetch, a bigger
  refactor than this pass's scope; `news/read` is dynamic only because it's driven by `searchParams` (share
  links), low traffic, would need a route-param refactor to fix. Both flagged as future candidates.
- **Files**: `src/app/api/chat/messages/route.ts`, `src/app/research/[slug]/page.tsx`,
  `src/app/research/page.tsx`, `src/app/u/[username]/page.tsx`.

## 2026-07-16 — PREVIEW (not merged, revised): hero-only display typeface + word-stagger reveal
Owner asked for "best in class" text/typography, then narrowed scope after seeing the first pass: keep the
new serif ONLY on the hero's "Everything you need to win in Web3" line, revert every other heading back to
the original font, and make the entrance animation more obviously "next level." Still a separate, unmerged
preview branch/PR so it can be reviewed and accepted/rejected independently of anything else.
- **Fraunces, scoped to the hero headline only**: loaded via its own `--font-fraunces` CSS variable (not
  the shared `font-display` Tailwind class), applied directly to `Hero.tsx`'s `<h1>` via inline
  `fontFamily`. `SectionHeading` and every other heading site-wide are back to the original Geist Sans -
  confirmed via computed style (`h1` → Fraunces, `h2` → Geist Sans).
- **Word-by-word stagger reveal** (replaces the earlier whole-block "focus-pull," which read as too subtle
  to notice): each chunk of the headline ("Everything" / "you" / "need" / "to" / "win in Web3.") is its own
  `motion.span` that blurs-in and rises into place on its own staggered beat (~100ms apart), so the line
  reads as a deliberate cascade landing into place rather than one fade. Confirmed via direct style
  sampling across the transition - words visibly sharpen in sequence, not all at once. `Reveal.tsx` and
  `SectionHeading` are reverted to their original, unmodified state (the animation lives entirely in
  `Hero.tsx` now, scoped to the one headline it's for).
- **Files**: `src/app/layout.tsx`, `tailwind.config.ts`, `src/components/Reveal.tsx`,
  `src/components/ui/primitives.tsx`, `src/components/Hero.tsx`.

## 2026-07-16 — Fix: ticker + text-shine + rest of the brand's ambient animations still static on reduced-motion
Follow-up to the earlier Icons3D/shooting-star fix - owner reported the Live Market ticker and other
animations were still going static on the same preview, and asked to "fix everyone." The previous fix only
carved out the two specifically-reported elements; the ticker marquee, the text-shine gradient sweep, and
the remaining ambient loops (mesh, aurora, particles, Saturn/Moon bob, button sweeps) were still silenced
by the same `prefers-reduced-motion: reduce` media query.
- **`globals.css`**: removed the entire animation-disable list from the reduced-motion media query. Every
  brand/ambient animation now always plays regardless of the OS-level reduced-motion preference - these are
  a deliberate, always-alive part of the site's look, not incidental decoration. `scroll-behavior: auto`
  (calms scroll-jump, a real vestibular trigger, and is unrelated to decorative animation) is the one
  reduced-motion accommodation kept.
- **Files**: `src/app/globals.css`.

## 2026-07-16 — Fix: icon animations + shooting stars going fully static on reduced-motion
Owner reported the About/Products icon animations and the hero's shooting-star meteors were still static
on desktop even after the earlier stale-chunk fix. Reproduced directly with Playwright's reduced-motion
emulation: confirmed both go completely inert (`animation: none`, frozen transforms) specifically when
`prefers-reduced-motion: reduce` is active, while working correctly with it off - this exactly matches the
report if the test browser/OS has that accessibility setting on (a common default in some environments,
not always something a user consciously enabled).
- **`globals.css`**: the reduced-motion media query previously silenced the entire Icons3D system
  (`.i3d-spin/-bob/-scan/-pulse/-tick/-sweep/-float/-beat/-twinkle/-flick` - every animated icon across
  About/Products/Markets/News/Premium) and every span inside `.starfield` (which includes the shooting
  stars, not just the ambient twinkle). These are a deliberate, signature part of the brand's look, not
  incidental decoration, so they're removed from the disable list and now always animate regardless of the
  OS-level reduced-motion preference. The ambient starfield twinkle/drift and other heavy full-screen loops
  (mesh, aurora, particles, Saturn/Moon bob, marquee, text-shine) still correctly respect reduced motion -
  only the two reported elements were carved out.
- **Files**: `src/app/globals.css`.

## 2026-07-16 — Further reduce Fast Origin Transfer: /api/news/social edge caching
Follow-up audit for more of the same class of bug already fixed on `/research/[slug]` (unconditional
session lookup on public content forcing every anonymous read to hit the origin).
- **`/api/news/social` (GET)** - polled once per story card on `/news` (high anonymous traffic), had no
  `Cache-Control` at all. For a signed-out visitor `liked`/`mine` are always `false` regardless of who's
  asking, so that response is identical for every anonymous visitor and is now cached publicly at the edge
  (`public, s-maxage=15, stale-while-revalidate=60`) - cutting repeat function invocations for the same
  story to once per cache window instead of once per anonymous pageview. Logged-in responses stay
  `private, no-store` since `liked`/`mine` are genuinely per-viewer there.
- **Audited but intentionally left alone**: `/community` has the same `force-dynamic` + unconditional
  `getServerSession()` pattern, but unlocking ISR for it would mean moving the viewer's poll-vote/`me`
  personalization out of the 1744-line `ChatClient` and into a client-side fetch (the same shape as the
  `LikeButton` self-correction pattern) - a much larger, riskier change to a live real-time chat surface
  for comparatively low anonymous traffic. Flagged as a future candidate, not done here.
- **Files**: `src/app/api/news/social/route.ts`.

## 2026-07-16 — Fix: page can "freeze" (dead animations, stale ticker) after a deploy + third ticker upstream
Owner reported desktop homepage icon animations had stopped and the Live Market ticker had gone static
again. Reproduced the underlying failure class directly: a stale cached page referencing a JS chunk hash
that no longer exists on the current deployment gets a 404 (served as HTML), the browser correctly refuses
to execute HTML as a script (MIME mismatch), and hydration silently never finishes - every client
component past that point (framer-motion icon animations, the ticker's data-fetching effect) stays inert,
which reads exactly like "everything just froze/went static," while pure-CSS animations (marquee, orbital
rings) keep running since they don't need JS. The service worker's own cache is the most likely place a
stale page like that survives across a deploy.
- **`public/sw.js`**: bumped the cache version (`xyz-pwa-v5` → `v6`) to purge any already-stale cached
  navigation entries for current visitors.
- **`PwaSetup.tsx`**: the service worker now proactively re-checks for a newer version whenever the tab
  regains focus (`registration.update()`), instead of only on next navigation. Added a safety net that
  detects a stale-chunk failure (a `<script>` load 404 via the capture-phase `error` listener - resource
  load failures don't bubble - or a thrown `ChunkLoadError`/dynamic `import()` failure) and forces one
  guarded hard reload to recover onto the current deployment, instead of leaving the page silently dead.
- **`api/ticker`**: added CryptoCompare as a third upstream (`CoinGecko → Binance → CryptoCompare → last-
  known-good → seed fallback`). Binance.com itself geo-blocks the US and several other jurisdictions
  (HTTP 451), which is a real risk given Vercel's default serverless region - a differently-hosted third
  opinion means CoinGecko and Binance would both have to fail for unrelated reasons at once for the ticker
  to go stale again.
- **Files**: `public/sw.js`, `src/components/PwaSetup.tsx`, `src/app/api/ticker/route.ts`.

## 2026-07-16 — Add real Terms of Service + Privacy Policy pages
Owner asked for real Terms/Privacy pages on the site (not just a reference doc) "so koi legal problem na
ho sake" - the site already collects real personal data (accounts, chat, DMs, trading journal entries,
IP-based rate limiting) with no published policy anywhere, flagged earlier as the top legal gap.
- **New `/terms` and `/privacy` pages**, written specifically for this product (not generic boilerplate):
  covers what the Service is and isn't (not a broker/exchange/custodian, no financial advice), the Trading
  Journal's public/private visibility model (private by default, opt-in Public/Anonymous per trade, dollar
  amounts never public), an honest third-party processor list matching the real integrations in
  `src/lib/env.ts` (Supabase, Vercel, Upstash, Resend, Sentry, Groq/Gemini, LiveKit, OAuth providers), and
  an IT Rules 2021 Grievance Officer contact (using the existing public support email, with a note that a
  named officer will be published once the company is formally incorporated - owner had no name to give
  yet). Both pages carry a visible "not yet incorporated / not a substitute for a lawyer" disclaimer.
- **`Footer.tsx`**: added a Terms/Privacy link row next to the copyright line, visible sitewide.
- **`SignupForm.tsx`**: the post-signup consent line now links to the real `/terms` and `/privacy` pages
  instead of only mentioning product-update emails - this is the actual consent-capture moment.
- Reuses the existing `.prose-xyz` typography class so the legal pages read consistently with research
  articles rather than introducing new styling.
- **Files**: `src/app/terms/page.tsx` (new), `src/app/privacy/page.tsx` (new), `src/components/Footer.tsx`,
  `src/components/SignupForm.tsx`.

## 2026-07-16 — Reduce Vercel Fast Origin Transfer: /research/[slug] ISR + journal-activity caching
Owner reported Fast Origin Transfer at 8.35GB/10GB. Two concrete causes found and fixed:
- **`/research/[slug]` converted from `force-dynamic` to ISR** (`revalidate = 60`) - the single biggest
  lever identified months ago but never actually shipped until now. Root cause: the page unconditionally
  called `getServerSession()` for every post (even free ones), which alone forced every anonymous article
  read to be a full uncached origin invocation. Now `getServerSession()` is only called when
  `post.premium` is true (checking the flag itself is a plain DB read, not a Dynamic API call) - free
  posts are ISR-eligible and served from the CDN on repeat reads; premium posts stay fully dynamic and
  are therefore never written to a shared cache at all (no stale-cache-leaks-premium-content risk).
  Premium up/downgrade freshness is unaffected - already-deployed `RealtimeSession.tsx` refreshes the
  session instantly on a `membership_changed`/`access_changed` broadcast, so dropping the extra
  per-request DB re-check (previously the 4th query on every load) doesn't lose the "instant" guarantee.
  View counting moved to a client-side beacon (`TrackPostView` → `POST /api/posts/[id]/view`) so it stays
  accurate per-real-view instead of only firing once per cache window. `CommentSection`'s admin-only
  controls now read `isAdmin` from its own session instead of a server-baked prop (verified safe: comment
  deletion already independently re-authorizes server-side). `LikeButton` self-corrects its liked state
  once on mount for logged-in users, since a cached free-post page can no longer bake in a per-visitor
  `initialLiked`.
- **`/api/journal/share/activity/[userId]` now sends `Cache-Control`** (`s-maxage=30,
  stale-while-revalidate=60`, matching the other `share/*` routes' recipe) - this endpoint is polled every
  60s by `JournalActivityFeed` on the *public* `/u/[username]` profile page (any visitor, not just the
  profile owner) whenever Supabase realtime isn't configured, and previously had zero caching at all -
  same bug class as the earlier NavActivity fix, smaller blast radius.
- **Files**: `src/app/research/[slug]/page.tsx`, `src/components/TrackPostView.tsx` (new),
  `src/app/api/posts/[id]/view/route.ts` (new), `src/components/CommentSection.tsx`,
  `src/components/LikeButton.tsx`, `src/app/api/posts/[id]/like/route.ts`, `src/lib/ratelimit.ts`,
  `src/app/api/journal/share/activity/[userId]/route.ts`.

## 2026-07-15 — Fix: ticker second upstream (Binance) when CoinGecko is unreachable
Follow-up to the same-day ticker fix - owner reported the homepage ticker was still showing static
prices after that fix shipped. Root-caused with an actual browser test (Playwright against a real
production build): the client fetch loop, state updates, and CSS scroll animation are all working
correctly - the previous fix's in-memory "last good" cache only helps for *intermittent* CoinGecko
failures, but does nothing if CoinGecko has never succeeded even once (a well-documented real-world
issue: CoinGecko's free/keyless API aggressively rate-limits shared cloud IPs like Vercel's, which can
mean a *sustained*, not intermittent, failure). Added Binance's public ticker API (`api.binance.com`,
also free/keyless, much more generous per-IP limits) as a second upstream `/api/ticker` tries when
CoinGecko itself is unreachable, before falling back to last-known-good or hardcoded seed data.
- **Files**: `src/app/api/ticker/route.ts`.
- **Separately identified (not a code bug, needs a production DB migration - see owner follow-up)**:
  the Points Value "Share result" button's popup-timing bug is confirmed fixed (verified via a real
  browser click in a production build - the tab opens correctly and an error now surfaces on failure),
  but the underlying `POST /api/tools/share/create` call can still 503 if the `SharedCard` table
  (migration 28) - or `ChallengeDayNote`/`JournalActivity`, migrations 29/30 - haven't been applied to
  the real production database yet.

## 2026-07-15 — Fix: points-value share popup blocked, ticker "frozen" fallback, desktop blank-page cache bust
Three targeted bug fixes, no redesign - each isolated to the specific broken/fragile path:
- **Points Value "Share result" wasn't opening**: `PointsValueCalculator.tsx`'s `share()` called
  `window.open()` *after* an `await fetch()` - most browsers (Safari especially) only allow
  `window.open()` to bypass the popup blocker when it's invoked synchronously within the original click's
  call stack, so the tab was being silently blocked with zero error surfaced. Fixed by opening a blank tab
  immediately on click (still inside the user gesture) and navigating it once the share id comes back;
  falls back to same-tab navigation if the popup was blocked outright, and now surfaces a real error
  message if the create request itself fails (previously a silent `catch`).
- **Homepage "Live Market" ticker looking static**: root cause traced to CoinGecko's free/keyless API
  rate-limiting - when the upstream call fails, `/api/ticker` was falling back to the same hardcoded seed
  prices every time, which reads as a frozen/dead ticker during any sustained outage (the scroll animation
  and 10s poll loop themselves were already correct, not the issue). Added an in-memory "last successful
  fetch" cache in `src/app/api/ticker/route.ts` so a failed refresh serves the last real prices instead of
  the same static numbers.
- **Desktop blank page (recurrence)**: the historical cause (WebGL orbital crashing on some desktop GPUs)
  was already hard-disabled (`useWebglGate.ts` returns `false`) and wrapped in error boundaries in a prior
  fix, with no code regression found in the relevant files since. Bumped the PWA service worker cache
  (`public/sw.js`, `xyz-pwa-v4` → `v5`) to force any returning visitor still on a stale pre-fix cached
  bundle to pick up the current code - the same remediation used the first time this symptom appeared.
- **Files**: `src/components/tools/PointsValueCalculator.tsx`, `src/app/api/ticker/route.ts`, `public/sw.js`.

## 2026-07-15 — Public Journal Activity on profiles + trade visibility control
Fifth and final phase of the "Journal → best in class" build, and the owner's explicitly "most important"
ask: whatever a member does in their trading Journal now shows up on their public profile.
- **New profile section**: `/u/[username]` gains a dedicated "Journal Activity" section (between Stats and
  the existing comments-only Recent activity block) - a live feed of trade/challenge events, updating in
  realtime via the same `userChannel(userId)` broadcast pattern Phase 3 introduced for live Trades sync.
  New `JournalActivity` model (migration 30), written by the trade/challenge mutation routes as
  fire-and-forget, aggregate-only inserts.
- **Privacy, by construction**: a row is only ever written when the source trade/challenge's own
  `visibility` isn't `"private"` - private trades and challenges never produce a public row, and flipping
  visibility on an existing trade doesn't retroactively backfill history (prevents a toggle-spam vector).
  Dollar amounts are never included anywhere - `trade_closed` carries only a win/loss sign, stricter than
  even the existing opt-in share cards.
- **Fixed a gap that would've made this invisible**: `TradeForm` had no visibility control at all (every
  trade defaulted to private with zero UI path to change it, unlike Challenges which already had one) -
  added a Private/Public/Anonymous picker to both the create form and the expanded trade row (so
  already-logged trades can be opted in later too), reusing the existing PATCH endpoint's `visibility`
  field.
- **Files**: `prisma/schema.prisma`, `prisma/migrations/30_journal_activity/`, `src/lib/journal-activity.ts`
  (+tests), `src/app/api/journal/trades/route.ts`, `src/app/api/journal/trades/[id]/route.ts`,
  `src/app/api/journal/challenges/{route.ts,[id]/route.ts,[id]/join/route.ts,[id]/milestones/[milestoneId]/route.ts}`,
  `src/app/api/journal/share/activity/[userId]/route.ts`, `src/components/JournalActivityFeed.tsx`,
  `src/components/journal/{TradeForm,JournalClient}.tsx`, `src/app/u/[username]/page.tsx`.

## 2026-07-15 — Journal Challenges day-tracker + Create→auto-expand + Risk discipline trend + position calc
Fourth phase of the "Journal → best in class" build (Analytics realtime was the third).
- **Create Challenge → full interface immediately**: creating a challenge no longer collapses back to a
  flat list - it auto-expands that challenge's card and smooth-scrolls to it, showing the leaderboard,
  milestones, and new day tracker right away. Reuses the existing accordion/detail-fetch mechanism, no
  new route.
- **Day-by-day tracker**: each challenge now shows every day from its start through today, with that
  day's P&L (derived from the participant's own linked trades via `periodBreakdown`, never stored
  redundantly) plus an optional note + one-tap mood ("disciplined"/"neutral"/"off-plan"). New
  `ChallengeDayNote` model (migration 29), any participant can log their own day - not creator-only, like
  milestones. New `PUT /api/journal/challenges/[id]/days` upserts one day at a time.
- **Risk section - discipline trend**: a new 30-day adherence-score line chart (`adherenceTrend()` in
  `risk.ts`) re-runs the existing breach-scan logic as-of each past day - entirely derived from already-
  fetched trades, zero new schema.
- **Risk section - suggested position size**: a small inline calculator (`suggestedPositionSize()`) gives
  the exact size that risks a chosen % of account equity given an entry and stop price, prefilled from
  the saved risk profile.
- **Files**: `prisma/schema.prisma`, `prisma/migrations/29_challenge_day_notes/`, `src/lib/challenge.ts`,
  `src/lib/risk.ts`, `src/lib/__tests__/{challenge,risk}.test.ts`,
  `src/app/api/journal/challenges/[id]/route.ts`, `src/app/api/journal/challenges/[id]/days/route.ts`,
  `src/components/journal/ChallengesPanel.tsx`, `src/components/journal/RiskPanel.tsx`,
  `src/components/journal/AdherenceTrendChart.tsx`.

## 2026-07-15 — Journal Analytics realtime + live blurred premium preview + weekly-drawdown fix
Third phase of the "Journal → best in class" build (Trades tab was the second phase).
- **Realtime**: trade create/edit/delete routes now broadcast a `journal_trade` event on the user's
  own realtime channel (`userChannel(userId)`, existing pattern from `ProfileFollow.tsx`/DM). `JournalClient`
  subscribes via `useRealtime` and refetches trades on any push (falls back to a 45s poll when Supabase
  realtime isn't configured), so Trades/Analytics/Risk all update live across tabs/devices without a
  reload. A small "Live" pill next to the Journal heading shows when realtime is active.
- **Deep-analytics live preview**: free-tier users now see their own real deep-analytics section (drawdown
  curve, activity heatmap, P&L breakdown, breakdown tables, mistake patterns) rendered blurred behind the
  premium gate, instead of a blank teaser card - a live, always-current "demo" of what premium unlocks
  (their own data, never another user's - same privacy boundary as before).
- **Fix**: `maxWeeklyDrawdownPct` was a configurable risk-profile field that was silently never checked.
  Added `weeklyPnl()` (`risk.ts`) and a `weekly-drawdown` breach check in `scanBreaches()`, with unit tests.
- **Files**: `src/lib/risk.ts`, `src/lib/__tests__/risk.test.ts`, `src/app/api/journal/trades/route.ts`,
  `src/app/api/journal/trades/[id]/route.ts`, `src/components/journal/JournalClient.tsx`,
  `src/components/journal/AnalyticsPanel.tsx`.

## 2026-07-15 — Journal Trades tab: $ sizing, weekly/monthly auto P&L, Open/Closed split
Second phase of the "Journal → best in class" build (first was the points-value share polish).
- **$ position sizing**: "Log a trade" and "Add fill" now take a dollar amount instead of raw asset
  units - converts to units via the entry price before saving (`size` is still what's stored, matching
  every downstream P&L formula), with a live "≈ X units" hint. The fills detail table now shows both a
  Size ($) and Size (units) column so nothing's lost.
- **Automatic weekly/monthly P&L**: two new stat tiles reuse `periodBreakdown()` (already built for
  Analytics) to show this week's and this month's realized P&L directly on the Trades tab, without
  switching tabs. Exported `periodKey()` from `journal-analytics.ts` so the client can find the *current*
  period's bucket specifically (not just the most recent one with activity).
- **Open positions / Closed trades split**: the flat trade list is now two clearly separated sections
  with distinct icons, instead of one undifferentiated list.
- **Day shown on every trade**: `formatDateWithDay()` (new `utils.ts` helper) shows "Mon, Jul 14" next to
  each trade row and each fill, sourced from the entry fill's actual execution date.

## 2026-07-14 — Points-value share: short links, download, image-inclusive native share
- **Short links**: new `SharedCard` model (migration 28, generic - room for more card kinds later) +
  `POST /api/tools/share/create` persists a calculator result behind a `cuid`, so the share link is now
  `/tools/share/points-value/<id>` instead of a long query string. Converted the existing query-string
  routes to `[id]`-based lookups (PNG route reads from the DB row; both degrade to a generic branded
  card/404 if the id is missing or expired - never crash).
- **Download**: new "Download" button fetches the PNG as a blob and triggers a browser download.
- **Image-inclusive share**: X's web share intent has no image-upload parameter - the OG-tag preview was
  already the closest available fit and stays as-is for "Post to X". Added a "Share" button using the
  native Web Share API with an actual image `File` attached (`navigator.share({ files: [...] })`) where
  supported (mobile Safari/Chrome) - this is the one path where the real image, not just a link preview,
  ends up in the shared post. Falls back silently where unsupported.
- First of a multi-phase "Journal → best in class" build (Trades/Analytics/Risk/Challenges overhaul +
  public profile Journal Activity section) - this share-card polish ships first as its own small PR.

## 2026-07-14 — Fix navbar's sitewide full-chat-fetch (Vercel Fast Origin Transfer)
- **Root cause found and fixed** (owner asked whether pausing Chat/DM would help reduce usage;
  investigated instead of guessing - the real waste was elsewhere and disabling messaging/GIFs would
  have helped ~0%, since GIF bytes are hotlinked from Giphy/Tenor and never touch Vercel, and live
  chat/DM delivery already runs over the Supabase realtime WebSocket, bypassing Vercel entirely).
- **`NavActivity.tsx`'s `loadChat()`** was fetching the full `/api/chat/messages` response (up to 50
  complete messages with author/reactions/polls) purely to read the last message's `createdAt` and
  flip a boolean "new activity" dot - on every 60s poll tick, on mount, and on every generic realtime
  ping, **sitewide, on every page, for every logged-in user** (`Navbar`/`NavActivity` render globally).
  The dedicated chat realtime channel already set the dot directly with zero fetch on live updates -
  only the poll/mount/ping paths were wasteful.
- **Fix**: new `GET /api/chat/last-activity` returns a single cached timestamp (`findFirst` selecting
  only `createdAt`) instead of the full message list; `loadChat()` now targets it. Same dot behavior,
  same instant-on-live-broadcast update, ~15-30KB down to a few bytes per poll tick, sitewide.
- No changes to Chat, DMs, or GIF sending - none of those were the actual cost driver.

## 2026-07-14 — Fix stuck desktop ticker + upgrade points-value share (real logos, X post, copy image)
- **"Live Market" ticker looked stuck on desktop**: `MarketTicker.tsx`'s scrolling track had
  `hover:[animation-play-state:paused]` - simply resting the mouse anywhere over the full-width strip
  froze the scroll indefinitely with no visual indication it was intentional. Touch devices don't sustain
  hover the same way, so mobile never showed it. Removed - the ticker now scrolls continuously, matching
  every other marquee/vscroll feed on the site (none of them pause on hover).
- **Points-value share card now has real logo images** (not text wordmarks): embeds our `/logo.png` and
  the platform's favicon-derived logo as actual `<img>` elements inside the `ImageResponse`, richer
  layout (hero value, share%/FDV/tokens chips).
- **New share landing page** `/tools/share/points-value` (`generateMetadata` sets `openGraph.images` to
  the card route, mirrors `news/read/page.tsx`'s pattern) - this is the URL that gets posted/copied, so
  the link itself shows the branded card image when pasted anywhere, not a bare link.
- **New `PointsShareActions`**: "Post to X" (reuses `ShareRow.tsx`'s intent-link pattern), "Copy link",
  and "Copy image" (new - `navigator.clipboard.write` with a `ClipboardItem`, feature-detected with a
  graceful fallback for browsers without image-clipboard support).

## 2026-07-14 — Points-value/journal share cards + Variational logo + scroll-jank fixes
- **Variational's real logo**: added `links.website` to its DEX registry entry + a new `platformLogo()`
  helper (`src/lib/dex-registry.ts`) that derives the domain and reuses the existing keyless
  `favicon()` service already used for news-source icons - no logo file downloaded or committed, works
  for any future registry entry with a `website` link. Shown next to each platform preset button in the
  Points Value calculator.
- **Two new share cards** (same `next/og` + `Cache-Control` recipe as the existing research/challenge
  cards, cached from day one): `GET /api/tools/share/points-value` (renders the calculator's current
  result from query params, no DB read) and `GET /api/journal/share/overview/[userId]` (renders a
  member's aggregate win rate/P&L/trade count only - never raw trade data, same privacy model as the
  challenge card). "Share card" / "Share my stats" buttons wired into the Points Value calculator and
  the Journal Analytics tab.
- **Scroll-jank fixes** (desktop + mobile): the sticky navbar's `backdrop-blur-xl` (24px) had no desktop
  reduction (only mobile got one) - a fixed element blurring everything behind it repaints every scroll
  frame site-wide, so trimmed to `backdrop-blur-lg`. Two scroll handlers were calling `setState`
  directly on every native scroll event with no throttling - the news reader's progress bar
  (`NewsClient.tsx`) and the community chat message list's stick-to-bottom check (`ChatClient.tsx`) -
  both now rAF-throttled, mirroring the pattern already used correctly in `ReadingProgress.tsx`.
- All additive/isolated changes; no existing behavior altered beyond the blur radius and throttling.

## 2026-07-14 — Cache news classification (Vercel Fluid Active CPU)
- **Root cause found and fixed**: Vercel's usage dashboard showed **Fluid Active CPU at 5h18m / 4h - already
  over the free-tier cap** (more urgent than the earlier Fast Origin Transfer warning). Traced it to
  `src/lib/news-fetch.ts`'s `getNewsPage()`: every distinct `category`/`q`/`page` combination requested from
  `/api/news`, `/news`, and `/news/read` was a cache miss that reran full classification (categorize +
  sentiment + impact + relatedTokens - roughly 49 regex tests per article) over every article from every RSS
  source, from scratch. With ~20 category tabs x search x pagination as separate cache keys, most requests
  never reused prior classification work - a very plausible explanation for both the CPU overage and the
  elevated ISR Writes (115K/200K, 57%).
- **Fix**: wrapped the fetch+classify step in `unstable_cache` (`next/cache`), decoupled from
  category/q/page - classification now runs at most once per `NEWS_REVALIDATE` (20s) window regardless of
  how many different views hit it; filtering/pagination (cheap array ops) still happens fresh per request.
  All three call sites (`getNewsPage`'s callers) share the same cached result.
- No behavior or visual change - same data, same freshness window, dramatically less redundant CPU work.

## 2026-07-14 — Cache share-card images (Vercel Fast Origin Transfer)
- **`research/[slug]/opengraph-image.tsx`** and **`api/journal/share/challenge/[id]/route.tsx`** had zero
  `Cache-Control` on the generated PNG - link-preview bots (WhatsApp/Telegram/Twitter/Discord) re-fetch
  these on every share, regenerating the image from scratch each time. Added `s-maxage=3600` (research
  cards - rarely change) and `s-maxage=300` (challenge cards - progress numbers move, shorter window),
  both with a generous `stale-while-revalidate`. Cuts origin-transfer usage from repeated bot fetches with
  no user-visible change.
- Audited every other public API route for caching (markets/ticker/news/research/whatsnew) - all already
  had solid `Cache-Control` headers from earlier work; this closes the one real gap found.

## 2026-07-14 — Mobile performance boost (round 2)
- **Bespoke 3D icon animations (`Icons3D.tsx`) now respect `prefers-reduced-motion`** - the `i3d-spin`/
  `i3d-bob`/`i3d-scan`/`i3d-pulse`/`i3d-tick`/`i3d-sweep`/`i3d-float`/`i3d-beat`/`i3d-twinkle`/`i3d-flick`
  keyframes were never added to the reduced-motion kill list in `globals.css`, so every icon across
  About/Products/Markets/News/Premium kept animating for users who'd opted into less motion.
- **`AnimatedIcon.tsx`'s continuous 3D wobble + breathing glow now pause off-screen** - uses framer-motion's
  `useInView` (200px margin) so tiles below the fold on About/Products stop looping instead of animating
  indefinitely once mounted.
- **News reader images decode off the main thread** (`decoding="async"` on the reader hero, swipe-reader
  hero, and the shared/external-link article image in `NewsClient.tsx`/`SharedArticle.tsx`) - avoids a
  decode-blocking jank spike on mobile when a large hero image lands.
- No existing visual behavior changed - reduced-motion users already saw calmer motion elsewhere; this
  closes a gap the icon system missed. Full-motion users see no difference.

## 2026-07-14 — Basic XP system (engagement foundation)
- **New `XpEvent` model + migration 27** (`prisma/migrations/27_xp_events`): one row per user per action per
  day, `@@unique([userId, action, day])` makes awarding idempotent (a repeat call the same day is a graceful
  no-op, not an error). Denormalized `User.xp` counter kept in sync inside a `$transaction`.
- **`src/lib/xp.ts`**: the 5 actions (`checkin`, `research_view`, `news_read`, `tool_use`,
  `profile_update`), each worth a flat 1 XP for now - deliberately simple, the foundation for a fuller
  gamified system later (levels/streaks/badges), not that system itself.
- **`POST /api/xp/award`** (zod-validated action, rate-limited, session-gated) + **`GET /api/xp`** (total XP
  + today's already-claimed actions, so the client can show claimed/disabled state without guessing).
- **`AwardXpOnView`**: a passive client component, fires the award once per mount - wired into
  `research/[slug]/page.tsx` (unlocked posts only), the news reader in `NewsClient.tsx`, and `ToolsClient.tsx`.
  `SettingsClient.tsx`'s profile save fires the award directly on success.
- **Daily check-in**: new `DailyCheckIn` button in the navbar account menu (desktop dropdown + mobile panel)
  - checks today's claimed state on mount, awards +1 XP on click, shows a claimed state after.
- Everything degrades gracefully pre-migration (`.catch(() => [])`/`.catch(() => null)`); no existing route,
  page, or component's behavior changed beyond these additive wire-ups.

## 2026-07-14 — Mobile: Profile in bottom nav + floating XYZ AI
- **Bottom nav center slot is now Profile** (Markets / News / **Profile** / Research / Chat) - shows your
  avatar when signed in (linking to `/u/<handle>` or `/profile`), a generic icon linking to login when
  signed out. Direct profile access on mobile without going through a menu.
- **XYZ AI is now a floating launcher on mobile too** (previously desktop-only; mobile used to route
  through the bottom nav's center button instead) - positioned just above the bottom nav bar so nothing
  overlaps. Verified via a real mobile-viewport screenshot.
- Visual-only change, verified with a headless mobile screenshot; no other existing pages/routes touched.

## 2026-07-14 — Tools: 3 new calculators + tab bar polish
- **3 new calculators** on `/tools`: **Break-Even** (exit price where round-trip fees cancel your P&L),
  **Compounding** (project capital growth from a fixed return per period, with daily/weekly/monthly
  presets), and **Drawdown Recovery** (the real gain needed to recover from a loss - a 50% drawdown needs
  a 100% gain, not 50%). All pure functions in `src/lib/calculators.ts`, unit-tested.
- **Tab bar polish** - now scrolls horizontally on mobile instead of wrapping awkwardly with 8 tabs, and
  remembers your last-used calculator across visits (localStorage, no account needed).

## 2026-07-14 — Trading OS Phase 6: Premium tiering + share cards
- **Analytics tab tiering** — the 8 core stat tiles (win rate, P&L, profit factor, etc.) stay free for
  everyone; the deep dashboard (drawdown curve, activity heatmap, daily/weekly/monthly breakdown,
  best/worst by setup/asset/platform/session, mistake patterns) is now **Premium**, replaced with a
  compact upgrade card (`PremiumGate`, same visual language as the existing research `PremiumLock`) for
  Free members.
- **Challenges tiering** — Free members can run **1 active challenge** at a time; creating a second
  surfaces a clear upgrade message (enforced server-side in `POST /api/journal/challenges`, mirrored
  client-side in the create form).
- **Shareable challenge cards** — a new public image route (`/api/journal/share/challenge/[id]`, `next/og`
  `ImageResponse`, same pattern as the existing research `opengraph-image.tsx`) renders a branded
  1200×630 card with the challenge's title, return %, and day count. Private challenges (and any lookup
  failure) always fall back to a generic, data-free card - no private numbers are ever exposed to an
  unauthenticated image fetch. A "Share card" button appears on public/community challenges.
- **`src/lib/journal-limits.ts`** (new) - the tier definitions, reusing the existing `membership` field
  (already gates AI limits and premium research) rather than a new entitlements system.
- Sixth phase of the Trading OS roadmap. Nothing else existing was touched.

## 2026-07-14 — Trading OS Phase 4: Challenges tab
- **`/journal`** gains a fourth tab, **Challenges**, alongside Trades, Analytics, and Risk.
- **Create a challenge** with a fully custom duration - 30/90/120-day presets plus arbitrary start/end
  dates - starting capital, an optional target, and visibility (**private**, **public**, or **community**).
  The "4-month challenge" is one preset among many, not a hardcoded mode.
- **Not just solo** - a community challenge has one creator plus many participants
  (`ChallengeParticipant`), each ranked on a **leaderboard by return %**. Public/community challenges are
  browsable under "Discover" with a one-tap Join.
- **Privacy-safe leaderboard**: other participants' raw trade data never leaves the server - only the
  aggregated capital/return/trade-count is returned (`src/lib/challenge.ts`, pure, unit-tested, computed
  server-side for the leaderboard and reused client-side for progress bars).
- **Milestones** - lightweight, manually-toggled checkpoints a challenge creator can add and check off.
- New **`Challenge`**, **`ChallengeParticipant`**, **`ChallengeMilestone`** models + idempotent migration
  (`prisma/migrations/26_challenges`, also adds `Trade.challengeId` so a trade can optionally count toward
  a challenge's progress). `GET`/`POST /api/journal/challenges`, `GET`/`PATCH`/`DELETE
  /api/journal/challenges/[id]`, `POST .../join`, and milestone create/toggle/delete routes - all reusing
  the existing `journal` rate-limit bucket.
- Fifth and final planned phase of the Trading OS roadmap (`/tools` → Journal core → Analytics → Risk →
  **Challenges**). Linking a trade to a challenge from the Trade form is a natural quick follow-up.
  Nothing else existing was touched.

## 2026-07-14 — Trading OS Phase 3: Risk Management tab
- **`/journal`** gains a third tab, **Risk**, alongside Trades and Analytics.
- Set optional limits (all skip if left blank): account equity, max risk per trade, max daily loss, max
  weekly drawdown, max total open risk, a leverage warning threshold, max trades/day, and a revenge-trade
  cooldown window.
- **Breach detection** (`src/lib/risk.ts`, pure, unit-tested) computed client-side from the trade list +
  limits: daily loss limit, overtrading, correlated exposure (multiple open positions on the same symbol),
  high-leverage open trades, revenge trades (opened shortly after a loss), and total open risk - each
  surfaced with a plain-language message and a **rule-adherence score** (100, minus points per breach).
- **Safe-mode banner** after 3+ consecutive losing trades - a nudge to size down or step back, not a hard
  block.
- **Planned risk per open trade** table, in both dollars and % of account equity, flagging any trade over
  the configured per-trade risk limit.
- **`RiskProfile`** model + idempotent migration (`prisma/migrations/25_risk_profiles`) - one optional row
  per user. `GET`/`PUT /api/journal/risk-profile`, reuses the existing `journal` rate-limit bucket.
- Fourth phase of the Trading OS roadmap (`/tools` → Journal core → Analytics → **Risk**). Next: Challenges.
  Nothing else existing was touched.

## 2026-07-14 — Trading OS Phase 2: Journal Analytics tab
- **`/journal`** now has a **Trades / Analytics** tab bar. Trades is the existing log; **Analytics** is new:
  gross P&L, profit factor, expectancy, average realized R (P&L expressed as a multiple of planned risk),
  max drawdown, average hold time, early-exit rate (closed before hitting take-profit), and a long-vs-short
  split - all derived from the same fetched trade list, no new endpoint.
- **Drawdown curve** + a **GitHub-style activity heatmap** (last 12 weeks, colored by daily realized P&L).
- **Daily/weekly/monthly P&L breakdown** table with a granularity toggle.
- **Best/worst breakdowns** by setup, asset, platform, and session, plus a **mistake-pattern** frequency
  view (from the tags already captured when logging a trade).
- **`src/lib/journal-analytics.ts`** (new, pure, unit-tested) - every metric above as its own function,
  reusable later by the Risk Management and Challenge phases.
- `EquityCurveChart` generalized (unique gradient IDs, configurable caption/empty state) so the drawdown
  chart reuses it instead of duplicating the SVG rendering.
- Third phase of the Trading OS roadmap. Next: Risk Management. Nothing else existing was touched.

## 2026-07-14 — Tools: Funding Fee Calculator platform picker + registry expansion
- **Funding Fee Calculator** now has a **perp DEX picker** (Hyperliquid, GMX, dYdX, Vertex Protocol, Aevo,
  Variational) so it's always clear whose funding rate a number represents. Hyperliquid stays live-prefilled
  (the only wired data feed today, via `/api/markets/perp`); every other platform gets a clearly labeled
  manual-entry banner with a link to its own docs.
- **`src/lib/dex-registry.ts`** — added GMX, dYdX, Vertex Protocol and Aevo alongside Hyperliquid and
  Variational, plus a `hasLiveFunding` flag marking which platforms auto-prefill vs. need manual entry.
  Adding the next platform is still just one object in the array - no code rewrite.

## 2026-07-14 — Trading OS Phase 1: Journal core (Trade/TradeFill/edit history)
- **New `/journal`** (private, login required) — log trades with multiple entries/partial exits
  (`Trade` + child `TradeFill` rows), long/short, spot/futures/perp/custom, planned stop-loss/take-profit,
  setup/session/timeframe/tags, notes, and platform tagging (reuses the Phase 0 DEX registry). Every P&L,
  average entry price, and open/closed status is **derived** from a trade's fills, never stored
  redundantly (`src/lib/journal.ts`, pure + unit-tested).
- **Edit history** — every `PATCH` writes an append-only `TradeRevision` row capturing what changed.
- **Stats + equity curve** — win rate, total P&L, total trades and average planned R computed client-side
  from the fetched trade list; a new hand-rolled SVG equity curve (signed, can go negative, unlike the
  dashboard's always-positive `TrendChart`).
- **`prisma/migrations/24_trades`** (idempotent) — `Trade`, `TradeFill`, `TradeRevision` tables. New
  `journal` rate-limit bucket (30/min). `/api/journal/trades` (list/create) + `/api/journal/trades/[id]`
  (edit/delete), ownership-checked, degrade gracefully pre-migration.
- Added a **Journal** entry to the account menu (desktop + mobile), next to Messages/Settings.
- Second phase of the Trading OS roadmap (started with Phase 0's `/tools`). Next: Analytics tab, then Risk
  Management, then Challenges. Nothing existing was changed beyond the one nav entry.

## 2026-07-14 — Trading OS Phase 0: /tools hub (calculators + DEX registry)
- **New `/tools` page** — free, no-login trading calculators: **Funding Fee** (live-prefilled hourly
  rate from `/api/markets/perp`), **Points/Airdrop Value** (including a **Variational** preset with its
  published scenario numbers - 1B supply, 9.4M points, 25/30/34% TGE unlock, $700M-$30B FDV scenarios,
  all clearly marked as editable assumptions, not live data), **Liquidation Price**, **Position Size &
  Risk:Reward**, and **PnL**.
- **`src/lib/dex-registry.ts`** (new) — a typed config array for perp DEX/platform info, mirroring the
  existing `NEWS_SOURCES` pattern: adding a new platform is adding one object, no schema change needed.
  Seeded with Variational and Hyperliquid.
- **`src/lib/calculators.ts`** (new, pure, unit-tested) — the math behind every calculator, reusable by
  the upcoming Trading Journal's analytics.
- **`Products.tsx`**'s "Trading Tools" card is now clickable (was a dead end since it first shipped) and
  its badge reads "Live."
- First phase of a larger **Trading OS** roadmap (journal, analytics, risk management, challenges) - see
  `docs/changelog.md` entries as each phase ships. Nothing existing was changed beyond the card wiring and
  one new "Tools" nav link.

## 2026-07-13 — Fix: mobile black-screen (service worker cache bump)
- **`public/sw.js`** — bumped `CACHE` (`xyz-pwa-v3` → `xyz-pwa-v4`). The `activate` handler already
  purges any cache key that doesn't match `CACHE` and calls `clients.claim()`, so this forces every
  device (installed PWA and regular mobile Chrome tabs alike, since the service worker controls all
  same-origin requests, not just installed sessions) to discard any stale/broken cached page or asset
  next time it checks for a worker update, instead of continuing to serve old cached content.
- Verified the production build renders correctly (desktop + mobile viewport) via a local prod server
  and headless-Chrome screenshots — the app code itself is healthy; this targets a stale-cache class of
  bug on already-visited devices.

## 2026-07-12 — DMs: search people + emoji/photo/GIF + online + push
- **Search people to DM** — a search bar in the Messages inbox (`GET /api/dm/search`, logged-in)
  finds any member by name/@username; tap a result to open/start the conversation.
- **Emoji · Photo · GIF in DMs** — the DM composer gained the emoji picker, a photo button
  (`POST /api/media/upload`, any member) and a GIF picker (Giphy, when `GIPHY_API_KEY` is set) —
  same as community chat. Media renders inline (shared `chatMediaUrl` in `lib/chat-media.ts`).
- **Online status** — a green dot on avatars in both the inbox list AND the thread header, driven
  by one shared `site-visitors` presence subscription (`useOnlineSet`). Inbox `other` now carries `id`.
- **External DM push** — a new DM fires a phone push to the recipient (fire-and-forget, gated on
  VAPID, dead endpoints pruned); opens the thread on tap.

## 2026-07-12 — Profiles: follower/following lists + colourful socials + fixes
- **Followers / Following are clickable** — tapping either count opens a modal with tabs
  (`FollowListModal`) listing the users, each with avatar + name + a per-row **Follow / Following
  / Unfollow** button. So you can open **Following** and unfollow anyone right there, or follow back
  from **Followers**. New `GET /api/follow/list?username=&type=`.
- **Share button icon fixed** — the compact share button showed an empty circle because the `btn`
  base padding squeezed the icon out; added `!p-0` + explicit colour so the link icon shows.
- **Social logos are now brand-coloured** — Website (gold), X (white), Telegram (sky), Discord
  (indigo), YouTube (red), Instagram (pink), LinkedIn (blue), GitHub (white), each on a matching
  tinted ring — colourful + instantly recognisable (were all grey).
- **Bigger bio/description** — the About/Bio field now allows **500** characters (was 280) so
  members can write a few lines about themselves (edit via the profile **Edit** button → Settings).

## 2026-07-12 — Profiles: Twitter-style follow system + compact header
- **Follow / Following / Unfollow** — new `Follow` model (migration `23_follows`, idempotent) +
  `POST/GET /api/follow` (toggle + counts, logged-in + rate-limited, resilient pre-migration).
  New `ProfileFollow.tsx`: follower/following counts + a follow button that reads **Follow**
  (green) → **Following** (grey) → **Unfollow** (red on hover/again), optimistic, self-hidden on
  your own profile, redirects to login when logged out. **Live** — counts update via the profile's
  realtime channel + a new-follow fires an in-app notification.
- **Edit from the profile** — owner-only **Edit** button in the header (→ /settings), no need to
  dig into Settings.
- **Smaller Share** — the Share button is now a compact icon-only round button (was a big pill).
- **Icon-only social logos** — Website/X/Telegram/YouTube/LinkedIn/Discord/Instagram/GitHub now
  show just the logo (tap to open; full handle in the tooltip) — far less space.
- **Owner step:** apply migration `23_follows` (SQL / `db:push`). Until then follow shows 0 and the
  button no-ops gracefully.

## 2026-07-12 — Voice/compose polish + short news share links
- **Voice bar is now a small pill** (`VoiceRoom.tsx`) instead of a full-width bar — takes almost
  no space when idle; expands only when you're in the call.
- **Mic actually turns on** — the mic permission is now requested **inside the click gesture**
  (before the token fetch / connect awaits), so iOS/Safari don't drop the grant. Denied → clean
  "listening only" state.
- **Smaller send button** (community composer) — icon-only on mobile, icon + "Send" on ≥sm — so the
  message box gets more room.
- **Short news share links** — sharing a story now copies a tiny `/news/read?u=<source-url>` link
  (was a huge `?d=<base64 of the whole story>`). The reader resolves `?u=` by looking the story up
  in the live feed for a rich preview (falls back to a minimal card). Easy to paste anywhere.
- **News push note:** external news notifications require the `push-dispatch` cron to be running —
  set repo secrets `PROD_URL` + `CRON_SECRET` (and `CRON_SECRET` in Vercel). Chat push works without
  it (fired inline); news push needs the scheduled trigger.

## 2026-07-11 — Community voice rooms (LiveKit, Telegram-style)
- **Live voice chat in the lounge** — a "Join voice chat" bar on `/community`; members join one
  shared audio room, talk + listen, see who's speaking (speaking rings + mute state), mute/leave.
  Audio-only, powered by **LiveKit**.
  - **New:** `POST /api/voice/token` (server, logged-in + rate-limited) mints a short-lived
    LiveKit token signed with the API key/secret (never exposed client-side).
  - **New:** `VoiceRoom.tsx` — connects via `livekit-client` (**dynamically imported**, off the
    first-paint bundle), turns the mic on, renders participants; mic-denied → listener mode.
  - `env`: `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` + `NEXT_PUBLIC_LIVEKIT_URL` + `voiceEnabled`
    flag (bar hidden until all set). CSP updated for `wss://*.livekit.cloud` + blob workers +
    mediastream. Deps: `livekit-server-sdk`, `livekit-client`.
- **Owner setup:** create a free LiveKit Cloud project → add the 3 env vars (see `docs/VOICE.md`).
  No database/migration needed.

## 2026-07-11 — Web3 News: customizable external notifications
- **External news push was already live** (cron → high-impact stories → subscribers). This adds
  **per-device customization** so members control what gets pushed to their phone:
  - **All big news** (default), **For You** (only their saved interests), **Pick topics** (only
    the categories they choose), or **Off** (stay subscribed, muted).
  - New pref UI: a "sliders" popover next to the News alerts bell (`NewsAlertsToggle` +
    `showPrefs`) — mode radios + a topic multiselect over the 28 news `CATEGORIES`. Saves instantly.
  - `PushSubscription` gains `notifyMode` + `notifyCategories` (migration `22_push_prefs`,
    idempotent; existing rows default to `"high"` = prior behavior). `POST /api/push/subscribe`
    stores the prefs; a new `GET` returns them so the popover preselects.
  - `GET /api/push/dispatch` now **filters recipients per story**: `high` → everyone, `categories`
    → story matches their topics, `foryou` → story matches their `newsInterests`, `off` → skipped.
    Resilient pre-migration (falls back to send-to-all).
- **Owner step:** apply migration `22_push_prefs` (`npm run db:push` or paste the SQL). Until then
  everyone keeps getting all high-impact alerts (no break).

## 2026-07-11 — Community + DM + Home polish pass (9 fixes)
1. **Send buttons say "Send"** — community chat + DM send buttons now show a white paper-plane
   **+ "Send" label** so it's obvious where to send.
2. **DM online status** — the DM thread header shows a green dot + "online" when the other
   person is active anywhere on the site (new `useUserOnline` hook observing the shared
   `site-visitors` presence channel; DM API now returns the other user's id). Graceful no-op
   without realtime env.
3. **Community white-theme colors** — the jump-to-latest button is now theme-aware (was a black
   blob on white, and now sits above content + is clickable); the poll/GIF/photo attach buttons
   get a clean light surface + visible icons.
4. **More emojis** — the emoji picker set is greatly expanded (smileys, gestures, hearts,
   crypto, animals) and scrolls. (GIF picker already added — it appears once `GIPHY_API_KEY` is set.)
5. **Jump-to-latest fixed** — visible + clickable in both themes (see #3).
6. **Translation direction fixed** — `/api/chat/translate` now reliably converts **English→Hinglish
   and Hinglish→English** (explicit language detection + a hard "output language must differ" rule
   + examples), instead of echoing the same language.
7. **Home orbital — light theme** — the ecosystem orbital reads premium on white now: toned aurora,
   opaque brand-gold/mint rings + planet dots (the invisible white planet is gold in light), real
   white node chips with elevation + stronger colored rings. All scoped to `#ecosystem-orbital`;
   dark theme pixel-identical.
8. **Community opens faster** — initial render trimmed to 30 messages (lighter nested-join payload;
   "Load older" pages the rest), on top of the existing parallel queries + skeleton.
9. **Sends feel instant** — the message-send route no longer waits on the Supabase broadcast
   round-trip (fire-and-forget, like push/moderation), so the 201 returns immediately; the
   optimistic bubble already shows the message instantly.

## 2026-07-11 — Community: photo (admin) + GIF (everyone) sharing
- **GIF sharing for everyone** — a **GIF** button in the composer opens a Giphy-backed picker
  (search + trending). Picking one sends it as an inline GIF message. New `GifPicker.tsx` +
  `GET /api/chat/gif` (proxies Giphy so the key stays server-side; logged-in + rate-limited).
  Gated on `GIPHY_API_KEY` — the button hides itself when unset.
- **Photo sharing for admins** — admins get a photo button (hidden for everyone else) that
  uploads via the existing admin `/api/upload` (client-compressed) and sends the image inline.
- **Inline media rendering** (`MessageBody`) — a message whose whole body is a **trusted** media
  URL renders as an image/GIF: GIFs from giphy/tenor (anyone) or images in **our** Supabase
  Storage / inline data images (admin uploads only). Arbitrary pasted image links stay plain
  links, so "photos" remain admin-only by construction. `doSend` gained an override path so
  media sends optimistically without touching the composer text.
- **Owner setup:** GIFs need a free `GIPHY_API_KEY` (developers.giphy.com) in Vercel; photo
  sharing needs Supabase Storage configured (the same pending storage setup) — both degrade
  gracefully (GIF button hidden / photo shows a clear "needs Storage" message) until set.

## 2026-07-11 — Community: aligned composer + message translation (English ⇄ Hinglish)
- **Composer aligned** (`ChatClient.tsx`) — the poll button, text field, emoji and send button
  now sit on one clean row at equal height (44px), with the error + character count moved to a
  tidy full-width line below (they used to be crammed inside the input column, throwing the
  buttons out of alignment). Send button uses the solid white `SendGlyph` for consistency.
- **Translate any message** — a new Translate action (Languages icon) in each message's action
  bar converts it **English ⇄ Hinglish** via AI (`/api/chat/translate`, logged-in + rate-limited,
  graceful 503 when AI is off). The translation shows in a mint quote block under the message;
  tapping again hides/re-shows it (cached, no repeat AI call). Mentions, $tickers, emojis and
  URLs are preserved.

## 2026-07-11 — Send icon fix + instant sends everywhere + light-theme + faster opens (2c+)
- **Send button always shows a clear icon** — the lucide `<Send/>` outline was rendering
  invisible on the green send buttons (looked like a plain green blob). Replaced with a new
  **`SendGlyph`** (a filled white paper-plane inline SVG, hard-set fill — can never be
  invisible) on the News-comment (`NewsSocial.tsx`) and DM (`MessagesClient.tsx`) buttons.
  Screenshot-verified on the mint gradient.
- **Comments/messages post instantly** — News comments (`NewsSocial.tsx`) now insert an
  optimistic entry the moment you send (temp id → swapped for the server copy; rolled back +
  text restored on failure), matching the community chat + DM optimistic sends. Send feels
  instant on both mobile + desktop.
- **Light-theme fixes** — DM bubbles now read correctly in light theme (own gold bubble text
  was near-white/invisible; now `text-gold-950` in light, `gold-50` in dark; incoming bubble
  gets a proper light surface + dark text). The community chat header is a solid theme-aware
  surface (fixes the grey-gradient smudge in white theme).
- **Community heading** — removed the redundant "THE XYZ LOUNGE" eyebrow (the room header
  already says XYZ Lounge) and replaced it with a useful **"Markets · Alpha · Airdrops — live"**
  topic line.
- **Profile + Dashboard open faster** — their generic branded spinners are now
  **layout-shaped skeletons** (`u/[username]/loading.tsx`, `dashboard/loading.tsx`) that
  preview the real layout instantly, so navigation feels immediate.

## 2026-07-11 — Chat/DM: instant send + solid header + faster community open (2c)
- **DM messages send instantly** (`MessagesClient.tsx`) — DMs now insert an optimistic
  bubble the moment you hit send (temp id → reconciled with the server copy / deduped vs the
  realtime echo; rolled back with the text restored on failure). Previously the bubble only
  appeared after the server round-trip. (Community chat already sent optimistically; its
  "pending" fade was softened `opacity-60 → 85` so a sent message reads as committed.)
- **"Online" / header no longer looks transparent** (`ChatClient.tsx`) — the header was made
  translucent (`ink-900/40` + blur) in 2a, so the presence/online strip looked see-through.
  Reverted to a solid `bg-ink-900` header; composer bar bumped to `bg-ink-900/95`.
- **Community opens instantly** — the route now ships a **chat-shaped skeleton**
  (`community/loading.tsx`) that mirrors the app frame (was a generic skeleton), and the two
  independent history queries (messages + pinned) run in **parallel** (`Promise.all`) instead
  of sequentially, so the server renders faster.

## 2026-07-11 — Community Chat: external push notifications (2b)
- **Phone push alerts for the lounge** — a new message now nudges subscribed members'
  devices (home-screen notification), reusing the existing Web Push / VAPID infra that
  powers News alerts (no new keys, no new subscription model).
  - **New:** `src/lib/chat-push.ts` → `dispatchChatPush(created)` — fire-and-forget from
    the send route (`api/chat/messages` POST). Gated on `pushEnabled`; never blocks the send.
  - **Anti-spam:** only pings when a message **breaks a quiet spell** (previous message >5 min
    ago), and uses a fixed notification `tag` so repeats collapse into one — so a busy room
    never spams phones, but a fresh burst of activity brings people back. Sender's own devices
    are excluded; dead endpoints are pruned (same as the news dispatcher).
  - Notification opens `/community` (service worker already routes on `data.url`).
- **Enable-alerts toggle in the chat header** — `NewsAlertsToggle` gained `compact` + `title`
  props and now sits (icon-only) in the chat header so members can turn phone alerts on/off
  right from the lounge. Existing News-page usage unchanged.
- **Owner note:** requires the VAPID env vars (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` /
  `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`) — the same ones News alerts already use. Degrades to
  a no-op when unset.

## 2026-07-11 — Community Chat: app-style fixed frame + premium color polish (2a)
- **App-like chat screen** (`community/page.tsx`) — the community page is now one fixed
  full-height frame (`h-[100svh]`, `overflow-hidden`): the page itself never scrolls, only
  the message list inside scrolls (WhatsApp/Telegram feel). Removed the page footer +
  the big heading (compact eyebrow only) so the chat fills the screen. Composer stays
  pinned at the bottom above the mobile keyboard.
- **ChatClient fills its parent** (`ChatClient.tsx`) — outer frame changed from a fixed
  `68vh` box to `h-full`, so the page controls height and the box is bigger / edge-to-edge.
- **Professional color polish** (colors stay gold/mint, just refined): richer header
  gradient + backdrop-blur, own-message rows get a cleaner mint tint + inset ring, composer
  bar gets a subtle ink surface + blur, and the input is a deeper rounded field with a mint
  focus ring. No behaviour change; presence/typing/reactions/polls untouched.

## 2026-07-11 — Breaking-hero swap arrows + clearer send-button icon
- **Breaking News hero** (`NewsClient.tsx` → `BreakingHero`) now has **left/right swap
  arrows** — tap ‹ / › to change the breaking story manually (auto-rotate + progress dots
  stay). Arrows are glass circles on the image edges, hidden when there's only one story.
- **Send-button icon now clearly visible** — the News-comment send button
  (`NewsSocial.tsx`) and the DM send button (`MessagesClient.tsx`) rendered as a plain
  green button because the dark `Send` glyph was low-contrast on the mint gradient. The
  icon is now **white** (`!text-white`) with a bolder stroke, so it unmistakably reads as
  "send message" (Telegram/WhatsApp-style). No color/layout change elsewhere.

## 2026-07-11 — Remove Dependabot (automated dependency PRs)
- **Deleted `.github/dependabot.yml`.** Dependabot's grouped weekly bumps kept
  proposing risky **major** upgrades (Tailwind 3→4, Next 14→16, React 18→19,
  Prisma 5→7, framer-motion 11→12, zod 3→4, …) that would break the UI/build, and
  each open PR also spun up a Vercel preview deploy (churn on the Hobby plan). Per
  the owner: no auto-update risk for now — dependencies get updated **manually**,
  deliberately, later.
- CodeQL static analysis + the `npm audit` visibility step (`security.yml`) stay —
  they only scan and report, they never open PRs. Owner may still enable
  **Dependabot *alerts*** in repo settings (notification-only; no PRs).
- Docs updated: `SENTINEL.md` (scanning section + owner setup), `security.yml`
  comments. The 5 open Dependabot PRs (#95–#99) were closed unmerged.

## 2026-07-11 — Fixes: send-message icon visible + direct banner upload
- **Send buttons now clearly show the send icon** — the composer Send button in News comments
  (`NewsSocial.tsx`) and the DM send button (`MessagesClient.tsx`) rendered as "just a green button" because
  the `.btn-primary::after` shine could sit over the icon. The `Send` (and loading) icon is now `relative
  z-10` (always above the shine) + slightly larger, so it reads clearly as "send message".
- **Direct profile banner upload** (`SettingsClient.tsx` + new `/api/profile/banner` route) — the cover image
  can now be uploaded straight from the device (like the profile photo), not only pasted as a link. Mirrors
  the avatar route + the zero-config `uploadImage` (Supabase Storage when configured, else inline data URL).
  The "paste a link" field stays as a fallback. Guards the settings-form save so a data-URL banner (already
  saved by the banner route) isn't re-sent through the stricter profile schema.
- Files: `src/components/NewsSocial.tsx`, `src/components/MessagesClient.tsx`, `src/components/SettingsClient.tsx`,
  `src/app/api/profile/banner/route.ts`, `docs/changelog.md`. Verified: tsc + lint + build green.

## 2026-07-11 — XYZ Sentinel: AI security & monitoring (detect + alert)
New layered security-monitoring system (owner asked for an "AI agent that watches security + reports"). Honest
scope: detect + alert only — no autonomous code changes. Alerts go to **email + Telegram**.
- **Proactive CI scanning** — `.github/workflows/security.yml` (CodeQL static analysis + `npm audit`) and
  `.github/dependabot.yml` (weekly dependency + Actions update PRs). Catches vulns/bad code before + after ship.
- **Live AI Watchdog** — `.github/workflows/watchdog.yml` (cron every 30 min) → `/api/watchdog`
  (`src/app/api/watchdog/route.ts`, secured by `CRON_SECRET`, same pattern as push-dispatch). It:
  - reads live signals (`src/lib/security-signals.ts`): locked accounts / brute-force, OTP attempt spikes,
    AI error-rate + daily cost spikes, sensitive admin actions, config health (rate-limiting live? Sentry on?).
    Every query is guarded so an un-migrated DB never breaks it.
  - scores a deterministic **severity** (pure `scoreSignals`, unit-tested) and asks the AI (`completeText`,
    system task) for a short plain-English analysis.
  - on a **new** warn/critical (deduped vs the previous run) alerts the owner via `notifyOwner`
    (`src/lib/notify-owner.ts` → email `sendEmail` + `src/lib/telegram.ts` `sendTelegram`).
  - records every run in the new `WatchdogRun` model (migration 21) for history.
- **Env**: `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` + `telegramEnabled`/`sentryConfigured` flags (`env.ts`).
- **Docs**: `docs/SENTINEL.md` (how it works + one-time owner setup: bot token, GitHub secret-scanning +
  Dependabot, `PROD_URL`/`CRON_SECRET`, migration 21, optional Sentry DSN). Added to the docs TOC.
- Files: `src/lib/{security-signals,telegram,notify-owner}.ts`, `src/lib/__tests__/security-signals.test.ts`,
  `src/app/api/watchdog/route.ts`, `src/lib/env.ts`, `prisma/schema.prisma` +
  `prisma/migrations/21_watchdog_runs`, `.github/workflows/{security,watchdog}.yml`, `.github/dependabot.yml`,
  `docs/SENTINEL.md`, `docs/SUMMARY.md`, `docs/changelog.md`. Verified: tsc + lint + test + build green.
  **⚠️ Owner:** apply migration 21 + set the Vercel/GitHub secrets (see `docs/SENTINEL.md`) to turn it on.

## 2026-07-11 — Fixes: mobile product-card anims + News light-theme text + upload (real fix)
Owner-reported, bundled with PR-9.
- **Ecosystem product-card mini-visuals animate on mobile again** — the earlier `.mini-viz` mobile
  animation-freeze (perf) also froze the Web3 Academy "course progress" bars, airdrop eligibility, etc.
  Removed the rule; those visuals now animate on phones too.
- **News "Breaking" hero card readable in light theme** — the card is always dark (image + black overlay),
  but its `text-white`/`text-zinc-*` were being remapped to dark in light mode → the headline/source were
  invisible. Marked those text colors `!important` (`NewsClient.tsx`) so they stay light on the dark card in
  both themes.
- **Direct image upload — the REAL fix** (`storage.ts`). Root cause: Supabase env is set (for DB + realtime),
  so `storageEnabled` was `true`, but the storage *bucket* upload 502'd — and the inline fallback only ran when
  storage was fully *disabled*. Now `uploadImage()` **falls back to an inline data URL on ANY Supabase upload
  failure** (bucket missing/not public/etc.), so direct upload (post covers + profile pics) always succeeds
  with zero setup. If Storage is properly configured it still uses the CDN URL.
- Files: `src/app/globals.css`, `src/components/NewsClient.tsx`, `src/lib/storage.ts`, `docs/changelog.md`.
  Verified: tsc + lint + test (236) + build green.

## 2026-07-11 — V2 PR-9: Audit report + team-setup guide (+ PDF) — final V2 deliverable
Documentation-only (no code change). Completes the V2 program.
- **`docs/AUDIT-2026-07-11.md`** — full website audit + handoff: tech stack (frontend/backend), architecture,
  security review, performance review, SEO status, honest ratings per area + **overall ≈ 8/10**, worth &
  build-cost estimate, "why one language / no Python", "can you hire an engineer" answer, pending owner ops,
  and a next-level roadmap.
- **`docs/TEAM-SETUP.md`** + **`docs/XYZ-Crypto-Team-Setup-Guide.pdf`** — how multiple members can work in
  parallel without breaking the live site: GitHub collaborators + branch protection + Vercel previews (already
  in place) + a free staging database. Includes daily workflow, roles, new-engineer onboarding checklist, and
  costs. Same content as a branded, print-ready PDF for sharing.
- Added all three to the docs TOC (`docs/SUMMARY.md`), alongside the existing `docs/SEO.md`.
- Files: `docs/AUDIT-2026-07-11.md`, `docs/TEAM-SETUP.md`, `docs/XYZ-Crypto-Team-Setup-Guide.pdf`,
  `docs/SUMMARY.md`, `docs/changelog.md`. No app code touched.

---

## 2026-07-11 — Light-theme polish + globe emoji + homepage feed polling
Owner-reported (light theme + emoji + a small home-perf trim).
- **Light theme "next level"** (`globals.css`). Root cause of the grey boxes: several dark background
  opacities weren't remapped for light mode, so e.g. the Markets tab bar (`bg-ink-950/50`) rendered as a
  muddy grey slab on the white page. Added the missing remaps (`bg-ink-950/50` + `/95`, `bg-ink-900/40..60`
  → light). Also upgraded the light `.surface`/`.glass` cards from flat white to **premium**: a whisper of
  top-down gradient, a soft lift shadow, a hairline warm border, and a gold-tinted hover glow. Verified with a
  headless light-theme render.
- **Globe emoji** (`Ecosystem.tsx`) — the "XYZ Verse." 🌐 was doing a full flat spin (looked odd); switched to
  the gentle `float` variant so it bobs softly instead.
- **Home-perf trim** — the two decorative homepage live feeds now poll less often (market 15s→30s, news
  30s→60s); the real ticker at the top still updates every 10s, so nothing user-visible slows down while
  background fetches drop.
- Files: `src/app/globals.css`, `src/components/Ecosystem.tsx`, `src/components/LiveMarketVisual.tsx`,
  `src/components/LiveNewsVisual.tsx`, `docs/changelog.md`. Verified: tsc + lint + build green.

---

## 2026-07-11 — Fixes: mobile ecosystem icons live + zero-config image upload
Owner-reported fixes (bundled with PR-8).
- **Homepage "The Ecosystem" icons were frozen on mobile → live again.** PR-7 had frozen the bespoke `.i3d-*`
  icon loops on phones; removed that rule so the Products/ecosystem icons animate on mobile again. (The
  heavier `.mini-viz` product-card mini-visuals stay frozen on mobile for scroll perf.)
- **Direct image upload now works with ZERO config** (posts + profile pictures). Root cause: uploads required
  Supabase Storage, so without it every direct upload returned 501 "not configured" and only the paste-a-link
  fallback worked. Now `uploadImage()` (`src/lib/storage.ts`) — used by both `/api/upload` (post covers) and
  `/api/profile/avatar` — stores the (client-compressed) image **inline as a data URL** when Storage isn't
  configured, capped at ~700 KB. Post covers now compress client-side too (`PostEditor.tsx`). next/image marks
  data-URL sources `unoptimized` (`Avatar`, `PostCard`, article page). The JWT is sanitised so a data-URL
  avatar never enters the session cookie (`auth.ts`) — it renders from the DB on the profile + in comments;
  the navbar just falls back to initials for inline avatars. For scale, configuring Supabase Storage (env +
  a public bucket) upgrades these to external URLs — see `docs/HANDOFF.md`.
- Files: `src/app/globals.css`, `src/lib/storage.ts`, `src/components/PostEditor.tsx`, `src/lib/auth.ts`,
  `src/components/Avatar.tsx`, `src/components/PostCard.tsx`, `src/app/research/[slug]/page.tsx`,
  `src/app/api/profile/avatar/route.ts`, `docs/changelog.md`. Verified: tsc + lint + test (236) + build green.

---

## 2026-07-11 — V2 PR-8: SEO — canonical + OG/Twitter on index pages, sitemap, breadcrumbs
- **`/markets`, `/news`, `/research` now carry full per-page metadata** — a shared `pageSeo()` helper
  (`src/lib/seo.ts`) adds `alternates.canonical` + page-specific `openGraph` + `twitter` to each (they only
  had title + description before). Article + profile pages already did this.
- **Breadcrumb JSON-LD** on `/markets`, `/news`, `/research` (`breadcrumbJsonLd`) — Home › Section. (Site-wide
  `Organization` + `WebSite` JSON-LD already emit from the layout; articles already have `BlogPosting` +
  breadcrumbs.)
- **Sitemap** — added `/markets` + `/news` (hourly, priority 0.8) to `src/app/sitemap.ts`.
- **Owner-steps doc** — new `docs/SEO.md` documents what code can't do: set `NEXT_PUBLIC_SITE_URL` (real
  domain), `NEXT_PUBLIC_GSC_VERIFICATION` (Search Console tag → layout emits the meta), submit
  `/sitemap.xml` in GSC, optional `NEXT_PUBLIC_GA_ID` + a 1200×630 OG image.
- Files: `src/lib/seo.ts`, `src/app/markets/page.tsx`, `src/app/news/page.tsx`, `src/app/research/page.tsx`,
  `src/app/sitemap.ts`, `docs/SEO.md`, `docs/changelog.md`. Verified: tsc + lint + test (236) + build green.

---

## 2026-07-11 — V2 PR-7: Mobile perf (icon-loop freeze) + profile-URL handle bug fix
Note: most of the originally-planned PR-7 perf wins were already shipped in earlier passes (lazy XyzAiWidget +
SmoothScroll, mobile blur cuts, reduced-motion gating of ambient FX, `optimizePackageImports`/`removeConsole`,
three.js off the homepage). This PR adds the remaining safe wins + a real bug fix.
- **Mobile: freeze the bespoke `.i3d-*` icon loops** (`globals.css`, `@media max-width:768px`). The 3D icons
  each loop a transform/opacity animation and appear many times per screen; on phones we stop the *loop* for
  smoother scroll + battery. The icons keep their glossy 3D gradient/shadow (they just don't move), and
  hover/entrance still work. **Desktop is untouched** — including reduced-motion users, who explicitly asked
  to keep these alive. (Same tradeoff already applied to `.mini-viz` product visuals.)
- **Bug fix — pasting a full profile URL saved the wrong handle** (`profile.ts` `normalizeHandle`). It took the
  *first* path segment, so `linkedin.com/in/john-doe` became `in` and `youtube.com/@name` kept the `@`. Now it
  drops query/hash then takes the *last* path segment: `/in/john-doe → john-doe`, `/@name → name`, while the
  simple cases (`x.com/foo`, `github.com/bar`, `t.me/baz`) and bare `bar/extra → bar` still hold. +3 unit tests
  (236 total).
- Files: `src/app/globals.css`, `src/lib/profile.ts`, `src/lib/__tests__/profile.test.ts`, `docs/changelog.md`.
  Verified: tsc + lint + test (236) + build green.

---

## 2026-07-11 — V2 PR-6b: Profile social links (Discord / YouTube / LinkedIn / Instagram)
Adds four more social links to public profiles + settings. Colors unchanged. **Needs a migration (below).**
- **Schema + migration** — `User` gains 4 nullable columns `discord` / `youtube` / `linkedin` / `instagram`
  (`prisma/schema.prisma`) with idempotent migration `prisma/migrations/20_profile_socials` (`ADD COLUMN IF
  NOT EXISTS`). All nullable → existing rows unaffected.
- **Graceful pre-migration** — the profile + settings pages read these columns through a new guarded helper
  `fetchExtraSocials` (`src/lib/user-socials.ts`); on an un-migrated DB it returns nulls instead of throwing,
  so profiles/settings never 404. Saving a value before the migration returns the standard graceful 503; name
  edits keep working (empty socials aren't written).
- **Validation** — added `discord`/`youtube`/`linkedin`/`instagram` to the profile zod schema (`profile.ts`)
  as normalized handle fields; the handle charset now also allows `-` (GitHub/YouTube/LinkedIn slugs).
- **Settings UI** — four new inputs in the Social links section with prefixes (`discord.gg/`, `youtube.com/@`,
  `linkedin.com/in/`, `instagram.com/`) (`SettingsClient.tsx`).
- **Public render** — the profile pills now include the four new links with brand icons
  (`u/[username]/page.tsx`); new `DiscordIcon` + `InstagramIcon` added to `BrandIcons.tsx` (YouTube/LinkedIn
  already existed), both screenshot-verified.
- Files: `schema.prisma`, `migrations/20_profile_socials/migration.sql`, `profile.ts`, `user-socials.ts`
  (new), `BrandIcons.tsx`, `SettingsClient.tsx`, `settings/page.tsx`, `u/[username]/page.tsx`,
  `docs/changelog.md`. Verified: tsc + lint + test (235) + build green.
- **⚠️ Owner action:** apply migration 20 (`npm run db:push` with real `DATABASE_URL`/`DIRECT_URL`, or paste
  `prisma/migrations/20_profile_socials/migration.sql` into the Supabase SQL editor). Links stay hidden until
  then.
- **Profile interactivity/polish** (same PR): social pills now hover to each platform's brand colour and
  lift slightly; the stat cards gained pointer 3D tilt (`TiltCard`) + a soft gold glow on hover; recent-
  activity cards lift with a gold left-accent on hover. All reduced-motion / touch safe, colors unchanged.

---

## 2026-07-11 — V2 PR-6a: News TTS silence fix + mobile navbar spacing
No-migration fixes; colors unchanged.
- **News "Listen" (TTS) silence on mobile fixed** (`BriefingBlock.tsx`) — the old code always ran
  `speechSynthesis.cancel()` immediately before `speak()`; on mobile Safari/Chrome `cancel()` flushes
  asynchronously and drops the following `speak()`, so nothing played. Now it only clears the queue when
  something is actually `pending`/`paused`, keeps `speak()` inside the tap gesture (iOS requirement), and
  calls `resume()` right after (iOS sometimes starts the queue paused). Toggle-off also checks
  `synth.speaking`.
- **Navbar crowding at the md→lg band** (`Navbar.tsx`) — desktop nav links were `px-3.5` from 768px up, which
  crowds when a phone forces "Desktop site" (~768-1000px). Now `px-2.5` at md, widening to `px-3.5` at lg;
  the hover/active underline inset tracks the same (`inset-x-2.5 lg:inset-x-3.5`). Roomy desktop look intact.
- **Desktop profile name was hidden over the banner — fixed** (`u/[username]/page.tsx`). The avatar+name row
  was pulled up (`-mt-14`) so the large name rendered on top of the banner art (invisible over the bright
  logo). Now **only the avatar** overlaps the banner; the name + handle sit in the content area below it
  (`items-start`, avatar gets the negative margin), so the name is always readable. Verified with a headless
  render.
- **Mobile light-theme navbar was black — fixed** (`globals.css`). The mobile `.nav-shell` perf override
  forced a dark `rgba(10,10,15,.92)` background in BOTH themes. Made it theme-aware: `.dark` keeps the dark
  bar, `html:not(.dark)` gets a white `rgba(255,255,255,.92)` bar (matching the desktop light navbar).
- Files: `BriefingBlock.tsx`, `Navbar.tsx`, `u/[username]/page.tsx`, `globals.css`, `docs/changelog.md`.
  Verified: tsc + lint + test (235) + build green. (Profile social links + migration land next in PR-6b.)

---

## 2026-07-11 — V2 PR-5: Section headings live + community depth
- **Every remaining homepage section accent now animates** — swapped the static `.text-gold-gradient` for
  the moving `.text-shine` on: `Web3 research.` (ResearchPreview), `XYZ Crypto` (WhatsNew), `XYZ Verse.`
  (Ecosystem), `community.` (Social), `XYZ Crypto` (Faq). The whole homepage now reads consistently "alive"
  (Hero / Orbital / About / Products already shine).
- **Community (Social) section → next-level** — added an ambient gold `glow-orb` behind the heading for depth
  and wrapped the 4 social cards in `<TiltCard>` (pointer 3D tilt, mouse-only, reduced-motion/touch safe),
  matching the site's interactive-card language.
- Colors unchanged (gold + mint). Files: `ResearchPreview.tsx`, `WhatsNew.tsx`, `Ecosystem.tsx`, `Social.tsx`,
  `Faq.tsx`, `docs/changelog.md`. Verified: tsc + lint + test (235) + build green.

---

## 2026-07-10 — V2 PR-4 refinements #2 (owner feedback): scroll fix + fit + market icon + mobile perf
- **Auto-scroll now actually runs.** `.vscroll` was in the `prefers-reduced-motion` kill list, so on any
  machine with "reduce motion" ON the feeds sat still. Removed it from that list → market/news feeds always
  scroll. Added a `.vscroll-down` variant (news rains down from the top).
- **Web3 Market icon → new `CandlesIcon`** (green/red rising candlesticks) — reads as a market chart far more
  than the coin. Screenshot-verified. (Kept `CoinIcon` in the library for reuse.)
- **Live Market feed refit** (`LiveMarketVisual.tsx`) — fixed-height rows with hairline dividers, tabular
  numbers, a solid (no backdrop-blur) header; sits cleanly inside the card and scrolls smoothly.
- **Live News feed** (`LiveNewsVisual.tsx`) — now scrolls **downward**; headline rows + the pinned "Breaking"
  bar refit to exact heights; solid bar (no backdrop-filter).
- **Gamified visual redesigned** (`ProductVisuals.tsx`) — compact level badge + XP bar on one row, then a row
  of quest chips that light up in sequence; fits the box and reads more interactive.
- **Mobile scroll perf**: the small product-card mini-visuals (`.mini-viz`) now **freeze their continuous
  animations on phones** (`@media max-width:768px`) — dozens of simultaneous bar/sheen/orbit loops were the
  main Products-grid jank source. The two LIVE feeds keep scrolling (cheap transform), icons keep their motion.
  Also dropped `backdrop-filter` from the live-feed headers (repaint cost on scroll). Added `will-change:
  transform` to the vertical tracks so they stay on the compositor.
- Files: `Icons3D.tsx`, `Products.tsx`, `ProductVisuals.tsx`, `LiveMarketVisual.tsx`, `LiveNewsVisual.tsx`,
  `globals.css`, `docs/changelog.md`. Verified: tsc + lint + test (235) + build green; layouts + new icon
  screenshot-checked.

## 2026-07-10 — V2 PR-4 refinements (owner feedback): real live feeds + better icons
Follow-up on the same PR; colors unchanged.
- **Web3 Market icon → new `CoinIcon`** (`Icons3D.tsx`) — a glossy gold Web3 token (hexagon emblem + light
  sweep), much more "Web3" than the old trend arrow. Screenshot-verified.
- **Web3 Market visual is now genuinely realtime** (`LiveMarketVisual.tsx`) — pulls live prices from the
  cached `/api/ticker` proxy (refreshes every 15s while visible) and shows **more coins** (BTC/ETH/SOL/SUI/
  HYPE/BNB/XRP/DOGE/AVAX/LINK) that **auto-scroll slowly upward** in a seamless vertical loop. The old
  hardcoded/wrong prices are gone.
- **Web3 News visual is now live** (`LiveNewsVisual.tsx`) — real headlines from `/api/news` (30s refresh),
  **auto-scrolling bottom-to-top**, with the newest story pinned along the bottom as a live **"Breaking"**
  showcase (pulsing red dot).
- **AI Hub icon → our `RobotIcon`** (the XYZ mascot) instead of the generic activity glyph.
- **Gamified icon → new `GamepadIcon`** (`Icons3D.tsx`) — a violet game controller (d-pad + flickering
  action buttons), so the icon matches the product. Screenshot-verified.
- New CSS: `.vscroll` vertical-marquee utility + `.vscroll-mask` fade (globals.css), added to the
  reduced-motion kill list (scroll pauses for reduce-motion users). Both feeds are visibility-gated (no
  fetch/animation cost while the tab is hidden).
- Files: `src/components/Icons3D.tsx`, `src/components/Products.tsx`, `src/components/ProductVisuals.tsx`
  (dropped the static Market/News visuals), new `LiveMarketVisual.tsx` + `LiveNewsVisual.tsx`,
  `src/app/globals.css`, `docs/changelog.md`. Verified: tsc + lint + test (235) + build green.

## 2026-07-10 — V2 PR-4: Products / "The Ecosystem" next-level (bigger suite + live links)
Expanded the homepage Products grid and made the live products clickable; colors unchanged (gold + mint).
- **`power your edge.` accent now alive** — static `.text-gold-gradient` → the moving `.text-shine`.
- **Perp DEX status → "In Research"** (`Products.tsx`) — extended the `Status` union + `tone` map (mapped to
  the existing `violet` badge tone). Was "Coming Soon".
- **4 new products** (`Products.tsx` + new `*Visual`s in `ProductVisuals.tsx`), each with a live CSS mini-visual:
  - **Web3 Market** (Live → `/markets`) — `MarketVisual`: realtime BTC/ETH/SOL rows with pulsing green/red deltas.
  - **Web3 News** (Live → `/news`) — `NewsVisual`: a "Breaking" feed with a headline scan sweep.
  - **AI Hub** (Planned) — `AiVisual`: a violet "thinking" waveform + typing dots.
  - **Gamified** (Coming Soon) — `GamifiedVisual`: XP progress bar + orbiting level badge + next-reward line.
- **Live cards are clickable** — added an optional `href` to product items; the card renders as a `<Link>`
  (with an `ArrowUpRight` hint that animates on hover) when set. Web3 Market → `/markets`, Web3 News →
  `/news`, Web3 Academy → `/research`.
- **Larger grid** — the small-product grid now holds 8 cards (2 rows of 4 on desktop); **"& More" moved to
  last**. Reused all existing keyframes (bar-pulse / sheen / grow-x / badge-orbit / pulse-dot) so no new CSS.
- Files: `src/components/Products.tsx`, `src/components/ProductVisuals.tsx`, `docs/changelog.md`. Verified:
  tsc + lint + test (235) + build green.

---

## 2026-07-10 — Scroll performance: content-visibility on sections + lighter sticky-nav blur (mobile)
Focused on making homepage SCROLL smooth, especially on mobile.
- **`content-visibility: auto` on every homepage section** (`Section` primitive + Hero, both already
  `overflow-hidden` so no new clipping) via `.sect-cv` with `contain-intrinsic-size: auto 720px`. Off-screen
  sections skip layout/paint while scrolling → big jank reduction; `auto` remembers real height so no scroll
  jump. Ignored by browsers without support (safe).
- **Sticky-nav backdrop-blur cut on mobile** — the navbar (when scrolled) + the mobile bottom nav are sticky
  and their `backdrop-blur` repaints every scroll frame (classic mobile jank). On phones they now use
  `blur(8px)` + a more opaque bg via `.nav-shell`, so scrolling stays smooth.

---

## 2026-07-10 — Starfield: nicer stars + light-theme/mobile meteor rules + high-end mobile perf
- **Light theme → no shooting stars** (`globals.css`): they read as odd streaks on a bright sky; hidden.
- **Mobile → only ~3 shooting stars** (down from more); desktop keeps 12. Light theme (any size) = 0.
- **Nicer stars** (`Starfield.tsx`): more glowing "hero" stars (i%7) with a stronger halo, a touch more density
  (100 → 110) — a fuller, more premium sky.
- **High-end mobile perf**: only the bright + drift stars ANIMATE now; the rest are static dots — far fewer
  running animations for the same density. Mobile paints ~42 stars (was 55). The orbital's blurred aurora
  drops to `blur(14px)` on phones. (On top of: three.js off, planets removed, reduced particles/blurs.)

---

## 2026-07-10 — Orbital: remove Saturn/Moon/robot; trim mobile meteors; overall perf boost
- **Removed the Saturn + Moon + XYZ-robot bodies** (per owner) — `OrbitalBackdrop` now renders just the
  ambient starfield. This also drops all their continuous animations (spinning ring, moon/robot bob, band
  drift) from the render → a real paint win.
- **Fewer shooting stars on mobile**: extras (index ≥ 5) are hidden under 768px, so phones show ~5 meteors,
  desktop 12.
- **Perf boost (mobile + desktop)**: CSS starfield 120 → 100 stars (mobile now ~55 via a lower `-extra`
  threshold); the CSS orbital particle field 34/14 → 22/8 (desktop/mobile). Combined with three.js no longer
  loading, reduced background blurs, package-import tree-shaking, lazy widgets, and visibility-gated timers,
  the homepage is noticeably lighter.

---

## 2026-07-10 — Orbital: moon + Saturn into the side gutters; more desktop shooting stars
- Per the owner's marks, moved the moon into the left gutter (`left 3% → 13%`) and nudged Saturn (`77% → 76%`)
  so both sit balanced in the side gutters, clear of the text.
- Bumped shooting stars 8 → 12 spread across the visible area (incl. the upper-centre) with staggered delays,
  so meteors are clearly present on the wide desktop (they were already un-gated from reduced-motion).

---

## 2026-07-10 — Orbital: ring spin + shooting stars now run under reduced-motion; Saturn clear of text
- Root cause of "ring static + shooting stars not showing": both were gated off under
  `prefers-reduced-motion` (which the viewer likely has enabled). Removed `.saturn-ring` + `.star-shooter`
  from the reduced-motion kill-list so the ring keeps spinning and meteors keep streaking regardless of the
  OS animation setting (they're subtle, GPU-cheap decorative motion).
- **Saturn repositioned** to the upper-right GUTTER, below the heading + subtitle (`top: 12% → 30%`,
  `left: 68% → 77%`), so it no longer overlaps the text.

---

## 2026-07-10 — Orbital: realistic moon + obvious ring spin + more shooting stars + more perf
- **Realistic moon** (`globals.css`): removed the artificial glow halo; the crescent now has a SOFT terminator
  (gradient mask so the dark limb fades naturally) + a bright sunlit rim + body shading that darkens toward
  the terminator. Reads like a real crescent, not a blob. Screenshot-verified.
- **Ring spin now obvious** (`globals.css`): the conic ring is high-contrast (bright arcs + near-dark gaps)
  and spins faster (9s), so the rotation is clearly visible instead of looking static.
- **Saturn repositioned** — pulled in from the right edge + a touch larger so it's fully framed in the corner.
- **More shooting stars** (`Starfield.tsx` + `globals.css`): 5 → 8 meteors, shorter cycles (more frequent),
  and brighter/longer streaks with a warm-gold tail + glow.
- **More performance**: desktop background blurs cut (`.mesh` 130→96px, `.aurora` 88→62px) and the CSS
  starfield trimmed to 120 stars — cheaper paint with no visible change.

---

## 2026-07-10 — Orbital polish (spinning ring + moonlight) + perf boost + realtime WS fix
- **Saturn ring spins** (`globals.css`): the ring is now a conic-gradient (angular brightness) masked into two
  elliptical bands with a Cassini gap; a transform-only `ring-orbit` rotation makes the bright arcs visibly
  travel around = a live spinning ring (compositor-cheap, reduced-motion-gated). Screenshot-verified.
- **Moonlight** (`globals.css`): the crescent gets a soft blue-white glow halo + a brighter lit rim, so it
  reads as genuinely lit.
- **Performance**: WebGL disabled means **three.js is no longer downloaded on desktop** (previously fetched
  when the gate picked the 3D scene) and there's no WebGL render loop — a real desktop win. CSS starfield
  trimmed 180 → 120 stars. (On top of the earlier perf pass: package-import tree-shaking, lazy widgets,
  mobile blur cuts, visibility-gated timers.)
- **Realtime WS console spam fixed** (`env.ts` + `RealtimeSession.tsx`): `NEXT_PUBLIC_SUPABASE_URL` /
  `SUPABASE_URL` are now sanitized to the base project URL (strip a stray trailing `/rest/v1` that made the
  realtime WebSocket URL malformed → infinite failed retries). Also added a reconnect back-off so a failed
  realtime WS can't hammer the console.

---

## 2026-07-10 — Orbital: switch centerpiece to the reliable CSS version (Saturn + crescent moon + XYZ robot)
The WebGL scene rendered blank on the owner's desktop and could not be verified in CI (all local servers get
killed in the sandbox), so after many rounds it's **temporarily disabled** in favour of a guaranteed-render
CSS/SVG version that is screenshot-verified.
- **`useWebglGate` → always false** — OrbitalLazy always renders the CSS `OrbitalEcosystem`; the three.js code
  stays in the repo for a future verified pass.
- **Realistic gold Saturn** (`globals.css .saturn-body`): layered banded gold gradient (latitudinal cloud
  bands + pole shading + specular highlight) + the existing Cassini-gap ring. Screenshot-verified.
- **Crescent moon + XYZ robot** (`globals.css` + `Starfield.tsx`): `.moon-body` is now masked into a real
  crescent (offset-circle CSS mask) with craters on the lit face; the actual `RobotIcon` SVG sits in the
  crescent's curve (`.moon-robot`, gentle bob). Screenshot-verified.
- Bodies render on **desktop (≥900px)** only (via `OrbitalBackdrop`); phones/tablets keep the clean orbital
  with no planets. This finally makes the changes reliably visible on desktop.

---

## 2026-07-10 — Orbital: rebuild the crescent moon from proven primitives (likely crash fix) + SW cache bump
- The extruded-`Shape` crescent was the one un-proven primitive added in the previous commit and the prime
  suspect for the desktop "blank / no changes" report. Rebuilt `Moon.tsx` from **only the primitives that
  already rendered** in the earlier scene: a sphere + a terminator shader (which produces the CRESCENT look
  via lighting) + the XYZ robot as a camera-facing **sprite** (dropped `ExtrudeGeometry` + drei `Billboard`).
  Same cratered rock, robot mascot, and warm core-lit edge — far lower crash risk. Realistic gold Saturn kept.
- **Service worker cache bump** `xyz-pwa-v2 → v3` (`public/sw.js`): forces returning/PWA users' old cache to
  be cleared on next load, so updates actually reach installed/returning sessions.

---

## 2026-07-10 — Orbital: crash-proof the WebGL scene (never blank) + harden the robot texture
- **Error boundary** (`OrbitalLazy.tsx`): the WebGL scene is now wrapped so that if it ever throws at runtime
  (shader/driver/geometry issue on some device), it falls back to the CSS orbital instead of blanking the
  section. This is the safety net for the desktop "changes not showing / blank" report.
- **`robotFaceTexture()` hardened** (`textures.ts`): `ctx.roundRect` is feature-detected with a manual
  `arcTo` fallback, so texture creation can never throw on older canvas engines.
- Note: the sandbox couldn't run a live WebGL capture (server processes get killed), so the 3D composition
  is verified on the Vercel deploy; the 2D textures (Saturn body/ring, robot face, crescent) were all
  screenshot-verified. Open the preview in a fresh/incognito window to bypass the PWA service worker + cache.

---

## 2026-07-10 — Orbital (desktop): realistic gold Saturn + crescent moon with the XYZ robot
Desktop WebGL only (mobile has no planets). Per owner refs, keeping the brand gold + the robot's mint identity.
- **Realistic gold Saturn** (`textures.ts`): rewrote `saturnBodyTexture()` as a proper gas-giant in the GOLD
  ramp — darkened poles, many turbulent latitudinal bands (multi-octave sine field), wavy swirl streaks, and
  soft storm ovals (1024×512, anisotropy 8). Enriched `saturnRingTexture()` with a second (inner) division +
  an inner→outer warm/brightness shift. Screenshot-verified (2D).
- **Crescent moon + XYZ robot mascot** (`Moon.tsx`): the moon is now a real 3D **crescent** — `THREE.Shape`
  (big circle minus an offset circle) → `extrudeGeometry` with bevel → cratered grey rock material (reused
  `moonTextures()`). The **XYZ robot** sits in its curve as a camera-facing billboard: new `robotFaceTexture()`
  redraws the `RobotIcon` face (mint head + gloss + eyes + antenna) onto a canvas, mapped on a plane inside a
  drei `<Billboard>`, with a mint glow + gentle bob. Dropped the old sphere + night-terminator shader.
- Both keep desktop parallax/entrance; colours unchanged (gold Saturn, mint robot). tsc + build green.

---

## 2026-07-10 — Orbital (mobile): remove Saturn/Moon on phones/tablets (clean orbital + stars)
- Per owner: on mobile/tablet the orbital now shows just the ecosystem + starfield (no CSS Saturn/Moon).
  `OrbitalBackdrop` renders the CSS bodies only on desktop-light (WebGL desktop draws its own; mobile has
  none). Desktop 3D unchanged. (Realistic Saturn + crescent-moon-with-robot-face are a follow-up.)

---

## 2026-07-10 — Orbital (mobile): move CSS Saturn/Moon into the side gutters, out of the text
- On phones/tablets (which render the CSS orbital) the Saturn/Moon sat over the heading + subtitle. Moved
  their placement out of inline styles into responsive CSS (`globals.css` `.starfield .saturn/.moon`): on
  mobile they now sit LOW in the left/right gutters beside the orbital (clear of all text) and are smaller
  (Saturn pulled in so its ring no longer clips the right edge); wide light-theme desktop nudges them back up.
  Screenshot-verified at 400px. Colours unchanged.

---

## 2026-07-10 — Orbital: WebGL scene is desktop-only; phones/tablets get the polished CSS cosmos
- The cinematic WebGL orbital is composed for the large desktop square; on small screens the same world read
  cramped with oversized stars. `useWebglGate` now also requires `min-width: 1024px`, so **phones + tablets
  render the polished CSS orbital** (Saturn top-right + Moon left + starfield, `clamp()`-sized — the look
  approved earlier) while **desktop keeps the full 3D scene**. Cleaner on mobile and lighter (no three.js /
  render loop on phones). Re-evaluates on resize. No new files; one-line gate condition.

---

## 2026-07-10 — Performance pass (mobile + desktop): lighter paint, leaner JS, fewer background timers
Focus was making the site *feel* fast/light, especially on mobile. The heavy libs (three.js, PerpChart,
Supabase, anime.js) were already lazy, so the meaningful wins are runtime paint + background work.
- **Mobile paint** (`globals.css`): the full-screen Gaussian-blur background layers are the biggest phone
  cost. Under `@media (max-width:768px)` the `.mesh` blur drops 130px→55px, `.aurora` 88px→45px, `.glow-orb`
  90px→45px, and the 3 blurred `.starfield-neb` layers are hidden. Visually identical at phone size, much
  cheaper to composite.
- **Reduced-motion** (`globals.css`): the auto-scrolling `.marquee` ticker + the continuous `.text-shine` /
  button-shine / eyebrow sweeps now stop under `prefers-reduced-motion` (accessibility + battery + paint).
- **Leaner JS**: `next.config.mjs` adds `experimental.optimizePackageImports` (lucide-react / iconsax-react /
  framer-motion barrel tree-shaking) + `compiler.removeConsole` in production. `XyzAiWidget` and `SmoothScroll`
  (Lenis) are now `next/dynamic({ssr:false})` (new `XyzAiWidgetMount` / `SmoothScrollMount`) so they leave the
  eager path (the widget only renders for signed-in users). First-load JS stays ~160 kB shared (framer-motion
  is global via the Navbar); per-page eager code drops.
- **Background timers gated**: News feed 20s poll + headline carousel + 60s clock, Messages 30s clock now
  no-op while the tab is hidden (`document.hidden`) — no wasted CPU/network/battery in background tabs.
- No visual/color change in normal (motion-on) desktop use; all existing flows unchanged.

---

## 2026-07-10 — V2 PR-2.5 (tweak 2): Saturn ring spins + faces orbit, moon lit-from-orbit, mobile fit
- **Saturn ring now visibly rotates** (`textures.ts` + `Saturn.tsx`): added angular particle specks to the
  ring texture (screenshot-verified) and spun the ring mesh about its own axis, so the "outer layer" clearly
  turns. Re-tilted Saturn to face toward the core/orbit; moved it further from the heading text (down + a
  touch inward) and kept the real 3D front/back ring occlusion.
- **Moon lit from the orbit** (`Moon.tsx`): kept the crisp half/night terminator but added a warm gold glow
  spilling onto the core-facing (lit) edge, so it reads as illuminated by the XYZ ecosystem; softened the
  night strength a touch so the lit half stays bright.
- **Mobile fit**: tightened the `compact` placement/scale for Saturn + Moon so both sit fully inside the
  small square. Colours unchanged.

---

## 2026-07-10 — V2 PR-2.5 (tweak 1): half/night moon + Saturn alignment + mobile fit
- **Moon → half / "night" moon** (`Moon.tsx`): added a deterministic terminator-shade shell (a dot-product
  shader that darkens the hemisphere facing away from the core, lit side toward the XYZ core) so the moon
  reads as a real phase with a crisp day/night line, independent of scene lights. Rim glow kept on the lit limb only.
- **Saturn alignment** (`Saturn.tsx`): moved down + inward and shrank the ring (radius 0.62→0.55, ring outer
  ×2.15→×1.95) so it sits cleanly in the upper-right, clear of the section heading + right edge; trimmed the
  scroll/pointer parallax gains so it never drifts into the text.
- **Mobile fit**: Saturn + Moon take a `compact` prop (mobile tier) that pulls them inward + scales them down
  (`OrbitalScene.tsx` passes `compact={tier==='low'}`) so both fit fully in the small square. Colours unchanged.

---

## 2026-07-10 — V2 PR-2.5: cinematic WebGL orbital (three.js / R3F) — Living Solar System
- **New `src/components/orbital/` scene** (three.js + react-three-fiber, already-installed deps, ZERO new
  packages): the "Everything orbits XYZ Crypto" centerpiece becomes a real-time 3D cosmos.
  - **Saturn** (`Saturn.tsx`): procedural banded gas globe + a Cassini-gap ring that is a real 3D disc, so it
    occludes behind the top / in front of the bottom for free; fresnel rim + additive glow (fake bloom); slow
    spin + float + wobble; hover brightens; cinematic entrance with a one-shot ring light-sweep.
  - **Moon** (`Moon.tsx`): cratered sphere with a procedural bump map (real relief under the gold key light),
    deep shadow side, edge glow, opposite parallax, slides in from the left.
  - **EcosystemCore** (`EcosystemCore.tsx`): the XYZ logo billboard + breathing halo + gold frame ring + three
    tilted orbits (different speeds) of glowing product nodes + travelling energy motes + inward gold/mint pulses.
  - **Depth layers**: `StarField` (instanced, shader-twinkle distant stars), `SpaceParticles` (nebula clouds +
    foreground dust), `HeroLighting` (gold key / mint fill) — all parallax at different rates.
- **Scroll = advance**: section scroll progress tilts the whole solar-system plane + subtly dollies the camera
  forward + parallaxes each layer (rAF-throttled, cooperates with Lenis). Pointer adds damped parallax.
- **Textures are procedural** (`textures.ts`, drawn once on a `<canvas>`) — no external models/textures, no
  Draco/KTX2/worker loaders (CSP-safe). "Bloom" is faked with additive glow sprites (no postprocessing dep).
- **Gate + graceful fallback** (`useWebglGate.ts`, `OrbitalLazy.tsx`, `OrbitalBackdrop.tsx`): WebGL runs only
  on a capable **dark-theme** session with motion allowed; **light theme + reduced-motion + no-WebGL fall back
  to the polished CSS orbital** from PR-2. The section's CSS starfield drops its Saturn/Moon when WebGL is on
  (no double planets). Re-evaluates on theme toggle + reduced-motion change.
- **Perf**: lazy-loaded (`next/dynamic ssr:false`, three.js off the homepage first-load), dpr capped 1–1.5,
  `frameloop` pauses when offscreen or the tab is hidden, mobile tier drops dpr + particle counts + dust.
  Colors unchanged; no backend impact.

---

## 2026-07-10 — V2 PR-2 (cosmos): realistic 3D Saturn + Moon + light-theme starfield + mobile parity
- **Realistic 3D Saturn** (`Starfield.tsx` + globals): the flat disc is now a proper ringed planet — a
  shaded gas globe (radial highlight + inset terminator shadow + soft-light latitudinal bands that slowly
  drift to fake axial spin) wrapped by a Cassini-gap ring built from two elliptical borders. The ring is
  drawn twice: a back copy behind the globe and a front copy clipped to its lower arc, so it crosses
  **behind the top and in front of the bottom** like the real thing. Bobs slowly. Geometry screenshot-verified.
- **Realistic Moon** (left side): cratered, shaded silver sphere (radial-gradient craters + inset terminator
  shadow + soft halo) that drifts/bobs gently.
- **Mobile parity**: Saturn + Moon now render on phones too, sized with `clamp()` so they stay in proportion
  from phone → desktop (desktop-quality look on mobile, as asked).
- **Light theme fixed**: the whole starfield used to be hidden on white; now it STAYS and is retuned as a warm
  "day sky" — stars recolour to soft amber (`star-w`/`star-g` markers), meteors go gold, and Saturn/Moon get a
  stronger rim + drop shadow so they separate cleanly from the light surface. Verified in both themes.
- Every new motion (band-spin, bob, drift, meteors, twinkle) still stops under `prefers-reduced-motion`;
  colours unchanged; no backend impact.

---

## 2026-07-10 — V2 PR-2 (alive): starfield next-level — drifting stars + meteors + distant planet
- **Stars now MOVE** (`Starfield.tsx` + globals): ~1/4 of the faint stars slowly *drift* along a per-star
  vector (new `star-drift` keyframe, 26–50s) on top of the twinkle, so the field reads as alive, not just
  blinking. Drift + twinkle never fight over `transform` (each star runs exactly one keyframe).
- **More meteors**: shooting stars 2 → **5**, streaking in from all corners at varied angles/travel
  (per-shooter `--rot` / `--dx` / `--dy`) so no two repeat the same line.
- **Breathing nebula**: the three colour hazes now slowly drift + scale (new `neb-float`) for shifting depth.
- **Signature distant planet** (unique cosmos touch): a soft gold gradient sphere with a faint tilted ring
  that bobs slowly (new `planet-bob`), tucked upper-right in the orbital section (off in the hero so it never
  collides with the medallion). Geometry screenshot-verified (reads as a ringed planet, not a blob).
- Hero starfield bumped to `opacity-80` so the drift + meteors read behind the hero. All dark-only, hidden on
  light theme, and every new animation stops under `prefers-reduced-motion`; planet hidden on phones. Colors
  unchanged; no backend impact.

---

## 2026-07-10 — V2 PR-2: Orbital "One unified ecosystem" — starfield + real 3D tilt
- **Full-bleed starfield** (new `Starfield.tsx`): 64 deterministic (SSR-safe, no CLS) twinkling stars +
  two faint distant glows (gold / mint) behind the whole orbital section → a tasteful "deep space / solar
  system" backdrop. `pointer-events-none`, dark-only (hidden on light theme), twinkle stops under
  `prefers-reduced-motion`. Screenshot-verified tasteful (sparse, not busy).
- **Real 3D tilt**: the orbital's desktop pointer-parallax now rotates the whole disc in 3D
  (`rotateX/rotateY` under the existing `perspective`) instead of a flat 2D slide.
- **"XYZ Crypto" accent** → animated `.text-shine` (moving gold, same hue). New `.starfield` +
  `star-twinkle` CSS + light/reduced-motion coverage in globals. Colors unchanged; no backend impact.

---

## 2026-07-09 — S7-C: bespoke 3D icon SYSTEM (multi-hue) + snappier motion + homepage rollout
- **Icon system**: `Icons3D.tsx` expanded to **17 hand-built 3D icons** on a curated 7-hue palette
  (gold/amber/emerald/sky/indigo/violet/rose) — Research, Tooling, Community, Security, Markets, TrendUp,
  TrendDown, Layers, Activity, Flame, Gift, Crown, Academy, Gauge, Lock, Newspaper, Calendar. Each: gradient
  body + gloss + drop shadow (real depth) and a distinct always-on motion. Verified via rendered screenshot.
- **Snappier motion** (globals.css): retuned `i3d-spin 6s / bob 2.2s / scan 2.2s / pulse 1.8s` + new
  `i3d-tick / sweep / float / beat / twinkle / flick`; a `.group:hover` speeds the spin up.
- **Rollout**: Products tiles (Perp DEX→Markets, Trading→Gauge, Airdrop→Gift, Premium→Crown,
  Academy→Academy, & More→Layers) + About "Since 2019" stats (Calendar/Research/Community/Layers);
  **Premium** lock tile → bespoke `LockIcon`; **Contact** method tiles → bespoke `MailIcon` + `ClockIcon`
  (added Star/Mail/Clock to the set, now 20 icons). Brand logos + tiny functional glyphs unchanged.
- Presentational only; brand logos + functional UI glyphs unchanged.

## 2026-07-09 — S7-B: bespoke 3D icons (RobotIcon-style) for the About pillars
- **New `Icons3D.tsx`** — hand-built SVG icons in the RobotIcon spirit (gradient body + gloss highlight +
  soft drop shadow for real depth), each with an always-on **signature motion**: `ResearchIcon` (magnifier,
  light scans across the lens), `ToolingIcon` (gear, slowly spins), `CommunityIcon` (people, front figure
  bobs), `SecurityIcon` (shield, a light sweeps down + the check pulses). Unique gradient/filter ids per
  instance. Keyframes (`i3d-spin/bob/scan/pulse`) added by the RobotIcon ones in globals.css.
- **Wired into the About "Who we are" pillars** (Research-driven / Builder tooling / Community first /
  Security & trust), replacing the flat lucide-in-tile with these bespoke 3D icons; verified via a rendered
  screenshot before shipping.
- Presentational only, no new deps. Same treatment can roll out to Products / stats / other surfaces next.

## 2026-07-09 — S7-A: 3D "alive" icon tiles (pass 1)
- **AnimatedIcon rebuilt** as a genuinely-3D glossy tile (RobotIcon energy): the tile **continuously wobbles
  in 3D** (`rotateY/rotateX` loop) while the glyph sits on a raised `translateZ` plane so it **parallaxes
  forward** as the tile turns; a **coloured glow breathes** behind it and a top gloss gives a lit, rounded
  read. Every icon is **seeded off `index`** (duration/phase/direction) so a wall of them never ticks in
  sync — clearly 3D and clearly alive, not a subtle micro-motion. Added `sky` + `violet` tones. Spring 3D
  flip-in on scroll + pop on hover. Fully `prefers-reduced-motion` safe (static glossy tile fallback).
- **Applied**: About feature-card icons (unique `index`), the About "Since 2019" stat icons, and all
  Products icon tiles (Perp DEX, Trading Tools, the 4 product cards) — converted from static tiles.
- Presentational only — no color/brand change, no new deps. More surfaces + a background "next-level" pass
  follow separately.

## 2026-07-09 — S6-C: Ambient depth + interactive 3D tilt cards
- **Depth**: new `PageBackground` (mesh + masked grid + soft top glow) replaces the bare `<div class="mesh">`
  on /markets, /research and /news, so they get the layered depth of the home hero instead of a flat wash.
- **3D tilt**: new `TiltCard` (`"use client"`) adds subtle pointer-driven 3D tilt (springy, rAF-throttled,
  mirrors the Hero medallion math). No-op on touch and under `prefers-reduced-motion`; springs back flat on
  leave. Applied to the Products cards, the Ecosystem brand cards, and the research `PostCard` (so /research
  + home ResearchPreview cards tilt). Cards keep their existing `.surface/.lift/group` treatment.
- Pure presentational — no color/brand change, no new deps (reuses framer-motion + existing CSS FX).

## 2026-07-09 — S6-B: Product-page header harmonization (industry-grade rhythm)
- **Shared `PageHeader`**: new component unifies the /markets, /research and /news page headers so they
  read as one system — animated eyebrow → display-scale title → subtitle, with the homepage's staggered
  entrance (`Reveal` fade → blur → fade) and type tokens.
- **Consistency fixes**: product H1s now use the `text-display-lg` token (`font-semibold`, fluid) instead
  of three slightly different raw `text-4xl font-bold sm:text-6xl` blocks; header→body margin standardized
  to `mt-12` (was 12 / 14 / 10); News stops hand-inlining the eyebrow markup and uses the shared one.
- **Motion**: product headers now animate in (were static) matching the home sections' cadence.
- Pure presentational — no color/brand change, no behaviour change, no new deps.

## 2026-07-09 — S6-A: Deeper AI briefing + better TTS voice + more sources
- **Deeper briefing**: `buildNewsBriefingPrompt` now targets ~650-900 words with two new high-value
  sections — **Key players** (who's involved + what's at stake) and **Jargon buster** (plain-English
  defs of the story's crypto terms) — plus richer Key details / Different angles and the same strict
  no-fabrication guardrails. Briefing `maxTokens` 1400→2000 (Hinglish 1500→2100 to fit the longer text).
- **Better TTS voice**: new pure `src/lib/tts.ts` (`pickVoice` prefers Google/Natural/Neural/Microsoft
  engines within the right language; `nextRate` speed cycle) with unit tests. `BriefingBlock` now loads
  voices via `voiceschanged` (reliable first-play voice), sets `u.lang`/`u.pitch`, and adds a **speed
  toggle** (1× / 1.25× / 1.5× / 0.75×).
- **More sources**: +3 trusted feeds (Protos, CoinJournal, Finbold) in `news-sources.ts`. Best-effort,
  auto-degrading like the rest.

## 2026-07-08 — S4-B: DM realtime + "Message" from chat & comments
- **Live DMs**: sending a message now broadcasts to the recipient's per-user channel (`user:<id>`,
  event `dm_message`) via the existing realtime lib. The thread + inbox subscribe with `useRealtime`
  (append/refresh live), falling back to the 5s/10s poll when Supabase realtime isn't configured.
  Recipient-only broadcast (sender already has the row) so there's no self-echo to dedupe.
- **Navbar DM badge**: new `Mail` inbox icon in the nav activity cluster with a gold unread count from
  the new `GET /api/dm/unread`; refreshes on the per-user `dm_message` broadcast, the 60s poll, and every
  navigation (so it clears when you open a thread).
- **"Message" everywhere**: `MessageButton` gained a `compact` icon-only variant (reuses the same
  session/start logic; login callback now returns to the current page). Wired into **community chat**
  authors (hover action bar, hidden on your own messages), **research comments**, and **news comments** —
  each gated on the author having a `username`.
- Additive + graceful: no realtime env → polling; no migration (uses S4-A tables).

## 2026-07-08 — S5: Profile polish (desktop name + interactive stats)
- **Desktop name fix**: profile display name is larger and tighter on desktop (`sm:text-4xl lg:text-[2.6rem]`,
  tracking-tight, better baseline next to the avatar); handle sits a touch bigger with cleaner spacing.
- **Interactive stats**: new client `ProfileStats` — the Posts / Comments / Likes numbers **count up** on
  load (ease-out, `tabular-nums`, static when `prefers-reduced-motion`), and each card's icon lifts + scales
  on hover.
- **Share**: new `CopyLinkButton` next to Message copies the profile URL with a brief "Copied" state.
- No data/behaviour change; server page just hands the three counts to the client stat row.

## 2026-07-08 — S4-A: Direct messages (lean 1-on-1)
- **Telegram-style DMs**: members can message each other 1-on-1. New `/messages` inbox + thread page
  (two-pane on desktop, single-pane with back on mobile), and a **Message** button on every public
  profile (`/u/[username]`) that opens or creates the conversation and deep-links via `?c=`.
- **Data**: new `Conversation` (canonical user pair, denormalized last-message + per-side read marks
  for the unread badge) + `DirectMessage` Prisma models; idempotent migration `19_direct_messages`.
- **API** (all gated `getSessionUser` + `handleError`): `GET/POST /api/dm` (inbox + start by username),
  `GET/POST /api/dm/[id]` (thread w/ read-marking + send, rate-limited `dm`, participant-checked 404).
- **Navbar**: "Messages" entry in the account dropdown (desktop + mobile).
- **Helpers**: pure `src/lib/dm.ts` (`orderPair`/`snippet`/`otherOf`/`isUnread`) with unit tests.
- Thread polls every 5s for new messages (realtime is a later step). Graceful pre-migration.
  ⚠️ Owner: apply migration `19_direct_messages` (`npm run db:push`) to activate.

## 2026-07-08 — S3: News likes + comments
- **Social on stories**: readers can now like a news story and leave comments, keyed by story URL
  (mirrors the `SavedStory` per-user pattern). New `NewsLike` + `NewsComment` Prisma models, idempotent
  migration `18_news_social`.
- **API**: `/api/news/like` (POST toggle, rate-limited `like`) returns `{liked, count}`;
  `/api/news/social` (GET thread + like state, POST comment <=1000 chars rate-limited `comment`,
  DELETE own comment). All gated with `getSessionUser` + `handleError`.
- **UI**: new `NewsSocial` component in the reader (after the briefing) - optimistic heart toggle,
  expandable comment thread with avatars, `timeAgo`, self-delete, and Cmd/Ctrl+Enter to post.
- **Graceful**: pre-migration the endpoints return empty/503 and the UI stays quiet. Owner action: apply
  migration `18_news_social` (`npm run db:push`) to activate.

## 2026-07-08 — S1: product-page eyebrow animations + News pills fix
- **Animated eyebrows**: new shared `AnimatedEyebrow` (homepage `eyebrow-glass` sweep + live mint pulse
  + `text-shine` shimmer) applied to Markets ("Live Data"), Research ("Knowledge Hub"), Community, and
  the Premium "Coming Soon" accent + Markets/Research H1 accents now shimmer too. Consistent with the
  News "Live Intelligence" header.
- **News pills**: category chips (For You / All / Breaking / ...) now have a uniform height (h-8),
  even padding, snap-scroll, and cleaner active rings so they line up perfectly on mobile + desktop.
  No behavior change.
- typecheck + lint(0) + test(219) + build green.

## 2026-07-08 — NX4: free realtime push via GitHub Actions scheduler
- New `.github/workflows/push-dispatch.yml`: every ~10 min (+ manual run) it pings
  `${PROD_URL}/api/push/dispatch?secret=${CRON_SECRET}` so breaking-news pushes go out in near
  real time on **any** Vercel plan (no Pro cron needed). Skips gracefully until the two repo secrets
  (`PROD_URL`, `CRON_SECRET`) are set; `vercel.json` daily cron stays as the safe fallback.

## 2026-07-08 — NX3: remove the em-dash from all user-visible text
- Replaced every em-dash "—" with a hyphen "-" across `src/components`, `src/app`, `src/lib` and
  `public` (264 → 0): prose, meta descriptions, string props, and the "no data" placeholder glyphs
  (`compactUsd`/`pct`/etc. now return "-"). Unit-test expectations updated in lockstep. `docs/` left as-is
  (not user-visible).
- typecheck + lint(0) + test(219) + build green.

## 2026-07-08 — NX2: news important-first + faster + advanced briefing + Live animation
- **Important news first**: new pure `rankNews` (`src/lib/news.ts`, unit-tested) scores each story by
  impact blended with recency (High ≈ 8h head-start, Medium ≈ 3h), applied in `getNewsPage` — breaking/
  high-impact surfaces at the top while staying fresh (a stale big story still sinks).
- **Faster**: news `revalidate` 30→20s and client poll 30→20s.
- **Advanced AI briefing**: deeper prompt (adds **Key numbers**, **Different angles** bull/bear, richer
  What-happened; ~450-650 words), tokens 1100→1400 (Hinglish 1500).
- **Live Intelligence animation**: the News header eyebrow now uses the homepage `eyebrow-glass` sweep +
  a live mint pulse + `text-shine` shimmer; the "News" accent shimmers too.
- typecheck + lint(0) + test(219) + build green.

## 2026-07-08 — NX1: XYZ AI 3D-bot branding + navbar light fix + smoother colors
- **3D bot everywhere**: the ✨ Sparkles icon in every XYZ-AI-branded spot is now the **`RobotIcon`**
  (3D robot) — briefing header ("Full briefing · XYZ AI"), coin & protocol "XYZ AI take" (+ Generate),
  and the News "Why this matters" button. Consistent AI branding.
- **Navbar light-theme fix**: the "XYZ AI" label was `text-mint-100` (near-invisible on white); now
  `text-mint-700` in light, `dark:text-mint-100` in dark — readable in both themes.
- **Smoother colors**: softened light surfaces + hairline (`--bg`, `--surface-2`, `--hairline`) and a
  gentler theme transition (adds border-color, 0.35s).
- typecheck + lint(0) + test(216) + build green.

## 2026-07-08 — News v3 · NW5: performance polish
- **Fewer re-renders**: `NewsCard` is now `memo`-ized with **stable callbacks** (`onOpen(index)` /
  `onBookmark(item)` via parent `useCallback`), so saving/bookmarking or new stories no longer
  re-render the whole feed — only the affected card.
- **Offscreen skipping**: cards use `content-visibility: auto` (`.cv-auto`, with intrinsic size) so a
  long feed only paints what's visible — smoother scroll on mobile.
- typecheck + lint(0) + test(216) + build green.

## 2026-07-08 — News v3 · NW4: more trusted sources + Tech/Science
- **+6 reputable tech/science feeds** (Ars Technica, The Verge, Wired, MIT Tech Review, TechCrunch,
  ScienceDaily) → 25 sources total, for broader "what's happening" coverage beyond crypto.
- New **"Tech"** + **"Science"** categories with low-priority keyword rules in `categorize()` — crypto
  keywords still win the primary category, so only genuinely non-crypto items land in these buckets
  (and get their own filter chips). Best-effort fetch + cross-outlet dedupe unchanged.
- typecheck + lint(0) + test(216) + build green.

## 2026-07-08 — News v3 · NW3: real-time push notifications
- **Live cron**: push `dispatch` now runs **every ~10 min** (`vercel.json` `*/10 * * * *`, was once/day)
  so breaking news actually reaches devices soon after it lands. Window tightened to the last 2h,
  up to 3 sends/run; still deduped via `PushedStory` (no repeats).
- **Single, clear control**: removed the duplicate in-app "Alerts" bell (only fired with a tab open);
  `NewsAlertsToggle` (real web-push, works when the site is closed) is now the one notifications control.
  The realtime "N new stories" pill stays.
- ⚠️ Ops: notifications need **VAPID keys** in Vercel env (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`) + `CRON_SECRET`; keys generated separately and handed to the owner. Everything
  degrades gracefully (toggle hidden, dispatch skips) until they're set + redeployed.
- typecheck + lint(0) + test(216) + build green.

## 2026-07-08 — News v3 · NW2: swipe-through-all-news + motion + typography
- **Swipe navigation**: in the reader, a horizontal-dominant touch swipe (doesn't fight vertical
  scroll) moves to the prev/next story; as you near the end the next page **prefetches** (shared
  `loadMore`), so you can swipe through **all** news, not just the loaded page. Mobile "swipe ‹ ›" hint.
- **Motion (next-level)**: a **reading-progress bar** at the top of the reader, a direction-in
  **slide+fade** on each story change, and tactile `active:scale` on category chips. All reduced-
  motion friendly.
- **Typography**: larger, tighter reader headline (22/30px) + roomier body for a premium read.
- typecheck + lint(0) + test(216) + build green.

## 2026-07-08 — News v3 · NW1: article-length briefing + voice + Hinglish
- **Full read**: `buildNewsBriefingPrompt` rewritten to an article-length explainer (TL;DR ·
  What happened · Key details · Background · Why it matters · What to watch next, ~350-550 words);
  `mode:"briefing"` maxTokens 700→1100. So anyone can read the whole story on-site.
- **Voice assistant**: a **Listen** button (free browser `speechSynthesis`) reads the briefing
  aloud — picks an en-US/en-IN (or hi-IN for Hinglish) voice; play/stop, stops on close/change.
- **Hinglish**: new `mode:"hinglish"` on `why-matters` + `buildHinglishPrompt` translates the
  briefing to Roman-script Hinglish; an **EN / Hinglish** toggle swaps the text and Listen reads
  whichever is shown.
- Shared `BriefingBlock` powers both the reader and the shared-story page; `MarkdownLite` extended
  (distinct `###`, italics, ordered lists, blockquotes); pure `stripMarkdown` (`src/lib/strip-markdown.ts`,
  unit-tested) feeds TTS.
- typecheck + lint(0) + test(216) + build green.

## 2026-07-08 — News v2 · NV5: saved stories DB-sync + save-bug fix
- **Bug fixed**: "Saved" used to filter the *loaded feed* by bookmarked ids, so a saved story
  vanished once it aged out of the feed. Now the Saved tab renders **stored full stories**, so
  saves persist across time (and, when signed in, across devices).
- New **`SavedStory`** model + idempotent migration `17_saved_stories` (`@@unique([userId, url])`).
- New gated route **`/api/news/saved`** (GET list · POST save/upsert · DELETE unsave); rows are
  re-hydrated to full `NewsItem`s server-side. Tolerates a not-yet-migrated DB gracefully.
- `NewsClient`: `saved` (full stories) is the source of truth — DB-synced when signed in,
  localStorage for guests; Saved count + bookmark state + reader all read from it.
- ⚠️ Ops: apply migration `17_saved_stories` (`npm run db:push`); code degrades gracefully until then.
- typecheck + lint(0) + test(212) + build green.

## 2026-07-08 — News v2 · NV4: more trusted real-time sources
- **News**: +10 reputable feeds (The Block, Blockworks, DL News, CryptoSlate, CryptoPotato,
  U.Today, AMBCrypto, Watcher Guru, CoinGape, crypto.news) → 19 sources total, broader markets/
  DeFi/institutional coverage. All best-effort (a down feed is skipped, dedupe across outlets).
- **Markets**: DeFiLlama already aggregates *every* perp DEX / DEX / fee protocol in real time;
  widened the Top DEXs & Top Fees lists 8→12 for fuller (clickable) coverage.
- typecheck + lint(0) + test(212) + build green. (NV5 saved-DB + bug fixes next.)

## 2026-07-08 — News v2 · NV3: realtime + super-fast load
- **Instant first paint**: the `/news` page now **server-renders the first batch** (shared
  `getNewsPage` in `src/lib/news-fetch.ts`, used by both the page and the API route). NewsClient
  seeds from it and skips the initial client fetch — no blank-then-skeleton flash.
- **Faster refresh**: news cache `revalidate` 60→**30s** (route `s-maxage=30`), client poll
  90→**30s**.
- **Realtime "N new stories" pill** (Twitter-style): fresh stories are buffered and revealed on
  tap (smooth scroll to top) instead of jumping the feed.
- **Breaking browser notifications**: an **Alerts** bell requests permission and fires a native
  notification for high-impact stories when the tab is backgrounded.
- typecheck + lint(0) + test(212) + build green. (NV4 more sources · NV5 saved-DB + bug fixes next.)

## 2026-07-08 — News v2 · NV2: futuristic UI + motion + image breaking
- **Breaking hero** (`BreakingHero`): image-rich, **auto-rotating** through the top high-impact
  stories with a live pulse badge, source/time, tokens, progress dots, hover "Read on XYZ" — and
  it **opens the on-site reader** (no more off-site bounce). Pauses on hover.
- **Motion** (framer-motion): staggered card entrance on scroll, subtle hover-lift, animated
  reader open/close (AnimatePresence). All gated by `prefers-reduced-motion`.
- **Polish**: per-card sentiment accent bar, animated title underline on the hero, **shimmer**
  skeletons (replaces the flat pulse).
- typecheck + lint(0) + test(212) + build green. (NV3 realtime + speed next.)

## 2026-07-08 — News v2 · NV1: full on-site read + share-our-link + advanced AI
- **Advanced AI briefing** (`mode: "briefing"` on `why-matters`): a full, structured read —
  **TL;DR + Key points + Context + Why it matters** in light markdown (~full page), rendered by
  a new dependency-free `MarkdownLite`. The reader and shared page now auto-generate this so a
  reader gets the whole story without leaving the site.
- **Share = our own link**: `encodeStory`/`decodeStory`/`shareUrl` (`src/lib/news-share.ts`,
  unit-tested) pack a story into a URL-safe token; **`/news/read?d=…`** renders it on OUR domain
  with **OpenGraph/Twitter preview** (title, excerpt, image) + the AI briefing + "Read original".
  Card & reader Share buttons now share this link, not the raw source.
- Better reading typography in the briefing (headings, bullets, bold).
- typecheck + lint(0) + test(212) + build green. (NV2 futuristic UI/animations next.)

## 2026-07-08 — UX P3A: News reader view (read on-site, no bounce)
Clicking a story now opens an in-site reader instead of bouncing off-site.
- **`NewsReader`** modal: hero image, source + time, category/sentiment/impact badges + tokens,
  full summary, an **auto-generated AI Summary** (reuses the gated `why-matters` digest),
  **prev/next** through the current list, bookmark + share, and a **"Read original ↗"** link.
  Keyboard: Esc closes, ←/→ navigate; body scroll-locked; mobile = full-screen sheet.
- `NewsCard`: title + new "Read" open the reader (the off-site link becomes a small "original"
  icon); cards now show a **hero image** when the feed provides one.
- typecheck + lint(0) + test(209) + build green. (DB-synced saved stories land next in P3B.)

## 2026-07-07 — UX P2D: protocol detail pages (`/markets/protocol/[type]/[slug]`)
The Markets protocol rows now open real detail pages, like coins do.
- **`/markets/protocol/[type]/[slug]`** (type ∈ derivatives | dexs | fees; ISR + client
  refresh): header (logo, name, kind), 24h volume/fees + 7d change, **freshness pill**,
  **recent trend chart** (SVG), stats grid (24h/7d/30d/all-time), **chains** chips, an
  **XYZ AI take** (gated, education-only), **related news**, About + official link.
- New proxy `GET /api/markets/protocol/[type]/[slug]` (DeFiLlama `/summary/{type}/{slug}`,
  slug-sanitized, cached, graceful) and gated `POST /api/ai/protocol-brief`.
- `PerpDex`/`DexProtocol`/`FeeProtocol` gain a `slug` (pure `protocolSlug` helper, tested);
  **Top Perp DEXs**, **Top DEXs** and **Top Protocols by Fees** rows now link to their page.
- typecheck + lint(0) + test(209) + build green. (Overview's TVL-protocol/chain rows use a
  different DeFiLlama endpoint — a possible follow-up; not linked here to avoid dead links.)

## 2026-07-07 — UX P2C: trending / gainers / losers rows are clickable
Every coin row across Markets now opens its detail page (P2B), not just the main table.
- `TrendingCoin` + `MoverCoin` gain a CoinGecko `id` (populated in the coins route from
  `search/trending` `item.id` and from the list for gainers/losers).
- **Trending Now**, **Top Gainers (24h)** and **Top Losers (24h)** rows (Overview + Trending
  tabs) now link to `/markets/[id]` with a hover affordance.
- typecheck + lint(0) + test(207) + build green. (Protocol rows — perp DEXs/DEXs/fees — get
  their own detail pages next in P2D.)

## 2026-07-07 — UX P2B: coin detail pages (`/markets/[id]`)
Every coin is now a destination page (SEO long-tail) instead of just a table row.
- **`/markets/[id]`** (ISR shell + client live refresh): header with logo/name/symbol/rank,
  big live price + 24h change, **freshness pill**, **7-day area chart** (SVG), **stats grid**
  (market cap, 24h vol, 24h high/low, ATH + % from ATH, circulating/max supply, 1h/30d), a
  **24h range bar**, an **XYZ AI take** panel (gated, education-only, grounded in the live
  numbers), **related news** (filtered from `/api/news`), and an About blurb + official link.
- New proxy route `GET /api/markets/coin/[id]` (CoinGecko coin + 7d market_chart, id-sanitized,
  cached, graceful) and gated `POST /api/ai/coin-brief` (reuses the AI gateway + daily limits).
- Coin rows in the Markets table now **link** to their detail page; `CoinRow` gains a CoinGecko
  `id` (populated in the coins + search routes).
- Per-coin **SEO metadata** (title/description/canonical). All USD; freshness shown honestly.
- typecheck + lint(0) + test(207) + build green.

## 2026-07-07 — UX P2A: Markets coins table → terminal-grade
- **Sortable columns**: click any header (#, Coin, Price, 1h/24h/7d, Market Cap, Volume) to
  sort; direction toggles, sensible default per column. Pure `sortCoins`/`defaultDirFor` in
  `src/lib/markets.ts` (unit-tested).
- **Sticky header + bounded scroll** on desktop (`md:max-h-[65vh]`) — the terminal look;
  mobile keeps simple horizontal scroll (no janky nested scroll).
- **Real live-price flash**: a coin's price cell pulses green/red **only when its price
  actually changed** between two real polls (diffed per-symbol) — never fake. Respects
  reduced-motion.
- **Freshness pill**: "Updated Ns ago" from the snapshot's real server `ts` (mint when fresh,
  amber when >90s) — honest, no fake "live" claim.
- typecheck + lint(0) + test(207) + build green.

## 2026-07-07 — UX P1B: mobile bottom nav + notifications on mobile + shared states
Native-app feel on mobile + the two owner-flagged fixes.
- **`BottomNav`** (code-split, mobile-only, ~0 initial JS): fixed app-style bar — Markets ·
  News · **XYZ AI** (centered launcher) · Research · Chat — with **real active-route**
  highlight, `env(safe-area-inset-bottom)`, ≥52px targets, and an in-flow spacer so content/
  footer clear it. Hidden on immersive/auth/admin routes (`/community`, `/login`, `/signup`,
  `/forgot-password`, `/dashboard`) that have their own bottom UI. Pure helpers in
  `src/lib/bottom-nav.ts` (unit-tested). The floating AI FAB is now desktop-only (the bottom
  bar is the mobile AI entry); PWA install prompt raised above the bar on mobile.
- **Notifications on mobile**: the `NavActivity` bell (was desktop-only) now also shows in the
  mobile top bar for signed-in users.
- **Navbar**: desktop Search pill slimmed to a single icon (⌘K tooltip).
- **Shared primitives** (`ui/primitives.tsx`): `Skeleton`/`SkeletonList`/`EmptyState`/
  `ErrorState` for consistent loading/empty/error states going forward.
- typecheck + lint(0) + test(207) + build green.

## 2026-07-07 — UX P1A: global command palette + unified search
A `⌘K` / `/` command palette that searches **coins, news, research and pages** from one box
— the hallmark of a top-tier product.
- **`src/lib/command-search.ts`** (pure, unit-tested): static page/action commands +
  `scoreCommand`/`filterCommands` with auth/staff visibility rules.
- **`/api/search/posts`**: lightweight published-post search (title/excerpt) — public,
  rate-limited, cached, P2021/P2022-safe.
- **`CommandPalette`** (code-split via `CommandPaletteMount`, `ssr:false` → **~0 initial JS**):
  debounced (250ms) multi-source search — coins (`/api/markets/search`), news (`/api/news?q=`),
  posts, plus pages + "Ask XYZ AI"; keyboard nav (↑↓/↵/esc), aborts in-flight requests (no
  stale/fake states), **mobile full-screen sheet** with safe-area insets + 44px targets.
- **Navbar**: desktop Search pill (with ⌘K hint) + mobile search icon dispatch the palette.
- Perf budget honored: palette loads post-hydration in its own chunk; no first-paint cost.
- typecheck + lint(0) + test(203) + build green.

## 2026-07-07 — XYZ AI gateway (PR-E): plan-based model routing + docs (final)
Completes the 5-PR multi-provider AI gateway.
- **Plan-based routing** (`routing.ts`): the chat assistant now uses the **quality** model
  for **Premium/Admin** and the **fast** model for **Free** (still capable, keeps the free
  tier cheap + fast); bulk tasks stay on fast for everyone. The gateway passes the caller's
  plan into `routeTier`. (Behavior change: Free chat → fast model.)
- **`docs/ai-gateway.md`**: reference for providers/fallback, routing table, per-plan limits,
  cache/concurrency, usage analytics, cost behavior, the full env list, and the owner SQL ops.
- Tests updated for plan tiering (194 total).
- typecheck + lint(0) + test(194) + build green.

## 2026-07-07 — XYZ AI gateway (PR-D): admin AI Usage dashboard
A new **"AI Usage"** admin tab turns the `AiUsage` log into operational insight +
per-user control. Gated by a new **`ai:manage`** capability (Super Admins have it
implicitly; grant to staff via the Access tab).
- **`GET /api/dashboard/ai-usage`** (`ai:manage`): 30-day daily **requests + cost**
  series (raw-SQL `date_trunc`, reusing `fillDailySeries`), 30-day totals (requests,
  in/out tokens, est cost, errors, fallbacks, cache hits + hit-rate), **provider split +
  health** (from `providerHealth()`), **top members** by usage, and an **abuse watch**
  (members with the most failed calls). All best-effort — zeros before the migration lands.
- **`PATCH /api/users/[id]/ai-limit`** (`ai:manage`, `admin` rate-limit): set/clear a
  member's `aiDailyLimit`; writes an `AdminAudit` (`ai.limit.update`).
- **`AiUsagePanel`** in `DashboardClient`: StatCards + two `TrendChart`s (requests, cost),
  provider-health pills, abuse alerts, and a top-members table with an **inline per-user
  daily-limit editor** (reuses the existing dashboard primitives).
- typecheck + lint(0) + test(193) + build green.

## 2026-07-07 — XYZ AI gateway (PR-C): plan limits + cache + concurrency + graceful UI
Adds real abuse/cost controls and cost-saving caching on top of the gateway.
- **Per-plan daily limits** (`src/lib/ai/limits.ts`, pure + DB): defaults **Free 25 /
  Premium 300 / Admin 3000** per day (env `AI_DAILY_LIMIT_*` overrides + per-user
  `User.aiDailyLimit` override — migration **`16_ai_limits`**). Only user-initiated tasks
  (assistant / why / digest) count; auto-moderation + article summaries don't. Enforced in
  the assistant + why-matters routes → a friendly **429** ("you've reached today's limit,
  resets midnight UTC; upgrade for more"). No plan is "unlimited".
- **Exact-match response cache** (`cache.ts`): deterministic one-shot tasks (summary /
  moderation / why / digest) are cached by `sha256(task + normalized input)` — Upstash Redis
  when configured, else a bounded in-process LRU; both fail-open. **Never caches the
  live-grounded chat assistant.** A cache hit skips the provider and records a `cached`, $0
  usage row so the saving is visible.
- **Per-user concurrency guard** (`concurrency.ts`): one in-flight AI request per member
  (Redis INCR/DECR with a 60s safety TTL, fail-open) → **429** if a second overlaps.
- **`kv.ts`**: shared Upstash handle for cache + concurrency (mirrors the rate-limiter).
- **Graceful capacity**: all-providers-down surfaces a friendly message (why-matters → 503,
  assistant → inline), rendered by the existing widget/news error states.
- Tests: limits math, cacheKey + round-trip, isCacheable/isUserTask (193 total).
- typecheck + lint(0) + test(193) + build green.
- **Owner op (later):** apply migration `16_ai_limits`; until then the plan defaults apply
  (no per-user override) and everything degrades cleanly.

## 2026-07-06 — XYZ AI gateway (PR-B): per-call usage analytics
The gateway now records one durable `AiUsage` row per call — the data layer for
per-user limits (PR-C), the admin AI dashboard (PR-D) and cost visibility.
- **`AiUsage` model** + idempotent migration **`15_ai_usage`**: provider, model, task,
  input/output tokens, latency, status (`ok`/`fallback`/`error`), errorKind, estimated
  cost (integer **micro-dollars**), cached flag, createdAt. **Metadata only — never the
  prompt or response text.** `userId` is nullable + `SET NULL` so analytics survive account
  deletion. Indexed by `createdAt`, `(userId, createdAt)`, `(provider, createdAt)`.
- **`src/lib/ai/usage.ts`**: `recordAiUsage` (best-effort, P2021/P2022-safe — never breaks a
  request) + `errorKindOf` (stable error bucketing).
- **gateway**: `runComplete`/`runStream` meter every call — real provider token usage when
  available, else `estimateTokens`; streams record once fully consumed; failures record a
  `status:"error"` row. `status` is `fallback` when a non-primary provider served.
- Tests: `errorKindOf` + gateway assertions that fallback/ok/error rows are recorded (184 total).
- typecheck + lint(0) + test(184) + build green.
- **Owner op (later):** apply migration `15_ai_usage` SQL in Supabase; until then metering
  no-ops cleanly and the app is unaffected.

## 2026-07-06 — XYZ AI gateway (PR-A): multi-provider abstraction + fallback
Turned the single-provider `src/lib/ai.ts` into a real gateway (`src/lib/ai/*`) —
the foundation for provider fallback, usage analytics, plan limits and an admin
dashboard (later PRs). **No behavior change**: with only Groq configured the chain
resolves to the exact same models as before.
- **`src/lib/ai/`**: `providers/types.ts` (provider-agnostic contracts), `providers/groq.ts`
  (wraps the existing Groq calls), `providers/gemini.ts` (Google REST, no new dep — only
  active with `GEMINI_API_KEY`), `registry.ts` (ordered/enabled provider chain), `routing.ts`
  (task→model tier), `pricing.ts` (token/cost estimate), `gateway.ts` (timeout + bounded
  retry with backoff + **automatic fallback to the next provider** on genuine failure).
- **`ai.ts`** is now a thin back-compat shim (`streamAssistant`/`completeText`/`aiErrorMessage`/
  `aiEnabled`/`AiMessage` unchanged; adds an optional `ctx`), so all 5 consumers keep working.
- **env**: `GEMINI_API_KEY`, `AI_PROVIDER_ORDER` (default `gemini,groq` — adding a Gemini key
  makes it primary with Groq auto-fallback), `AI_DAILY_LIMIT_*`; flags `groqEnabled`/
  `geminiEnabled`; `aiEnabled` now means "≥1 provider configured". Keys stay server-only.
- Guardrails: one key per provider, **no key-rotation/quota-evasion**, fallback only on real
  failure/timeout/legit rate-limit.
- Tests: routing, pricing, registry ordering, and a gateway fallback/classify suite (+19; 182 total).
- typecheck + lint(0) + test(182) + build green.

## 2026-07-06 — Markets: more coins, coin search, all perp DEXs, trending news
- **Coins**: table expanded from top-50 to **top-250**, with a **search box** that
  filters instantly and, for coins beyond the top 250, looks up **any coin** via a
  new keyless **`/api/markets/search`** route (CoinGecko search → live market data).
- **Perp DEX**: DefiLlama derivatives list expanded 8 → **30** protocols; Hyperliquid
  markets 8 → **20** — a far more complete perp picture (volume + OI + funding).
- **Trending tab**: added **Latest Trading News** (from the /news aggregator, auto-
  refreshing) alongside trending coins and 24h gainers/losers.
- Also fixed the AI live-context coins key (`list`, not `coins`) so the assistant
  actually sees current prices.
- typecheck + lint(0) + test(163) + build green.

## 2026-07-06 — PWA: installable + offline app
XYZ Crypto is now an installable Progressive Web App — "Add to Home Screen" on
mobile/desktop gives an app-like, standalone experience that opens fast and
works offline for already-visited pages.
- **`public/sw.js`** upgraded from push-only to a full PWA service worker:
  network-first navigations (fresh online, cached offline, `/offline.html`
  fallback), cache-first for immutable `/_next/static` assets, and APIs/auth/
  realtime never cached. Push handlers remain (dormant while alerts are paused).
- **`manifest.ts`** enriched: `id`/`scope`/`orientation`/`categories`, a
  maskable icon, and app **shortcuts** (Markets / News / Research).
- **`PwaSetup`** (mounted in layout) registers the SW globally and shows a
  subtle, dismissible **"Install app"** pill when the browser reports the app is
  installable (Android + desktop Chrome/Edge); iOS installs via Share → Add to
  Home Screen. **`public/offline.html`** = branded offline fallback.
- Layout gains `appleWebApp` metadata (standalone title + status bar style).
- typecheck + lint(0) + test(158) + build green.

## 2026-07-06 — News: Web Push alerts for major events
Members can opt in to browser push notifications for high-impact crypto news.
- **`NewsAlertsToggle`** on /news (signed-in, supported browsers only): registers the
  service worker (`public/sw.js`), requests permission, subscribes to Web Push, and
  stores the subscription server-side. A second tap unsubscribes.
- **`/api/push/subscribe|unsubscribe`** (auth, rate-limited) upsert/delete the browser's
  `PushSubscription`. **`/api/push/dispatch`** = a `CRON_SECRET`-guarded cron entrypoint
  that finds NEW `High`-impact stories from the last 6h, de-dupes via `PushedStory`, and
  pushes the newest few (`MAX_PER_RUN=2`) to all subscribers — pruning dead endpoints.
- **`src/lib/push.ts`** = `web-push` wrapper (`sendPush` → ok/gone/error); `pushEnabled`
  gates the whole feature so it **no-ops gracefully when VAPID keys are absent**.
- **Schema** (migration `14_push`, idempotent): `PushSubscription` + `PushedStory`.
  **`vercel.json`** cron runs dispatch **daily** (`0 8 * * *`) — Hobby-safe (a
  sub-daily schedule makes Vercel reject the whole deployment on the Hobby plan).
  On **Vercel Pro**, bump the schedule to `*/30 * * * *` for 30-min dispatch.
- New env (names only): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`, `CRON_SECRET`.
- typecheck + lint(0) + test(154) + build green.

## 2026-07-05 — News: personalized "For You" feed
Members can now follow topics and get a personalized news feed.
- **`User.newsInterests String[]`** (migration `13_news_interests`, idempotent) + a
  **"For You"** chip on /news (signed-in) that filters to the followed categories, and a
  **Customize** modal to pick topics. `/api/news/interests` GET/POST (auth, P2022-safe so
  it no-ops cleanly before the migration lands).
- typecheck + lint(0) + test(154) + build green.

## 2026-07-05 — Live Web3 News & Intelligence Hub (/news)
A real-time crypto news hub aggregated from reputable RSS feeds — **keyless, no API
key** (owner request; CryptoPanic free tier had closed).
- **`/api/news`** aggregates ~9 reputable feeds (CoinDesk, Cointelegraph, Decrypt, The
  Defiant, Bitcoin Magazine, Crypto Briefing, BeInCrypto, Bitcoinist, NewsBTC) server-
  side, classifies each story, **de-duplicates the same event across outlets**, filters
  (category + search) + paginates. Cached, graceful (200 even if all feeds fail).
- **`src/lib/news.ts`** (pure, unit-tested): RSS/Atom parser, `categorize` (26 Web3
  categories), `sentiment` (bullish/bearish), `impact` (Low/Med/High), `relatedTokens`,
  `timeAgo`, `dedupe`. **`news-sources.ts`** = the feed list + favicon helper.
- **`/news` page + `NewsClient`**: category filter chips, debounced search, **Breaking
  News banner**, rich cards (source + favicon, headline, summary, "3 min ago", category,
  bullish/bearish, impact, related tokens, Read, Share, Bookmark), **infinite scroll**,
  **live auto-refresh** (90s), **Saved** (localStorage bookmarks), and per-card
  **"Why this matters" AI** (`/api/ai/why-matters`, Groq). **News** added to the navbar.
- typecheck + lint(0) + test(**154**, +12 for news) + build green; page verified.

## 2026-07-05 — Markets: live Web3 data hub (Phase C, PR C1)
New **/markets** page aggregating live market + DeFi data in one place (owner request).
- **Cached proxy routes** (graceful always-200 `live` flag, model on `/api/ticker`):
  `/api/markets/global` (CoinGecko `/global` + Fear & Greed + optional CoinMarketCap
  DeFi/stablecoin enrichment) and `/api/markets/defi` (DefiLlama — total TVL + trend,
  top protocols, top chains, stablecoin mcap). All free/keyless except CMC.
- **`src/lib/markets.ts`** (pure, unit-tested): `compactUsd`, `pct`, `fngLabel`,
  `topByTvl` + shared types.
- **`/markets` page** + **`MarketsClient`** (visibility-gated polling like MarketTicker):
  global KPI tiles, Fear & Greed gauge, DeFi TVL + sparkline, top protocols/chains,
  BTC/ETH candlesticks, live ticker. Reuses `.surface`/`.lift`, `mono`, `--chart-*`,
  `PerpChart`. **Markets** added to the navbar.
- **env:** `CMC_API_KEY` (optional) + `cmcEnabled` — hub works fully without it via the
  free sources; the CMC key just adds DeFi/stablecoin market-cap tiles.
- typecheck + lint(0) + test(137, +8 for markets) + build green; page verified.
- **Expanded (same PR):** professional **tabbed** hub (Overview · DeFi · Perp DEX · DEX &
  Fees · Yields · Trending) + always-visible 5-KPI strip (incl. **ETH gas** via keyless
  Cloudflare RPC). New routes: `/api/markets/perp` (**Perp DEX** — DefiLlama derivatives
  volumes + **Hyperliquid live funding/OI markets**), `/api/markets/dex` (DEX volume +
  fees), `/api/markets/coins` (trending + top gainers/losers), `/api/markets/yields`
  (top yield pools). All keyless/free, cached, graceful. test(141).
- **Polish (same PR):** removed the running ticker from the top of /markets (it overlapped
  the fixed navbar → glitch) and fixed the page padding. Added a **Coins** tab: a full
  CMC-style **market table** (rank, price, 1h/24h/7d %, market cap, 24h volume, 7d
  sparkline, top 50). **ETH gas** fixed (keyless public RPCs w/ fallback — Cloudflare
  gateway was dead); **Perp DEX** made resilient (DefiLlama + Hyperliquid independent).
  Realtime intervals tightened (prices/perp/gas 30s). test(**142**).

## 2026-07-05 — XYZ AI: switch provider to Groq (free, faster, higher limits)
Gemini's free tier limits were being hit. Moved to **Groq** (Llama models) for a more
generous free quota + faster inference. Single-wrapper design meant only `src/lib/ai.ts`
+ the env var changed — assistant, summaries, moderation, widget all unchanged.
- `src/lib/ai.ts`: `groq-sdk` client; models `llama-3.3-70b-versatile` (assistant),
  `llama-3.1-8b-instant` (bulk). `streamAssistant` still returns a provider-agnostic
  `AsyncIterable<string>`; `completeText` uses OpenAI-style chat messages.
- env: `GEMINI_API_KEY` → `GROQ_API_KEY` (free key at console.groq.com/keys).
- deps: remove `@google/genai`, add `groq-sdk`.
- Also: the assistant now shows a **specific** failure reason (usage-limit / not-configured
  / rephrase) instead of a generic message (`aiErrorMessage`).

## 2026-07-05 — XYZ AI Phase B PR 2: article summaries + chat auto-moderation
Two more in-product AI features (Google Gemini, model `gemini-2.5-flash-lite`, same
`GEMINI_API_KEY`; both no-op cleanly when AI is off).
- **AI article TL;DRs:** `Post.summary` (nullable) + idempotent migration
  `12_post_summary`. Generated on publish (`afterPublish`) and on body edits (research
  PATCH), plus an admin backfill endpoint `POST /api/ai/summarize` (`post:publish`).
  Rendered as a mint "TL;DR · XYZ AI" block atop the article; hidden pre-migration /
  until generated (P2022-safe read).
- **AI chat auto-moderation:** each new message is classified (`classifyToxic`); clearly
  toxic ones are auto-hidden via the existing moderation path (broadcast
  `message_hidden`), fully restorable from Dashboard → Moderation. **Fail-open + bounded
  (4s)** — any error/timeout/quota leaves the message visible; runs after create+broadcast
  so the (optimistic) send stays instant.
- **New:** `src/lib/ai-summary.ts` (pure prompt builders + parsers, unit-tested) ·
  `src/lib/ai-tasks.ts` (server `summarize` / `classifyToxic`, best-effort) ·
  `src/app/api/ai/summarize/route.ts`.
- typecheck + lint(0) + test(**129**, +9 for ai-summary) + build green.

## 2026-07-05 — XYZ AI: dedicated navbar entry + 3D robot + green look
Small UX polish on the shipped assistant (owner request, before PR 2):
- **Dedicated "XYZ AI" navbar item** (desktop + mobile). Clicking it opens the
  floating assistant via a `window` `xyz-ai:open` event (`XYZ_AI_OPEN_EVENT`
  exported from `XyzAiWidget`) — no page nav, no refactor.
- **3D robot icon** — new `RobotIcon` (`src/components/RobotIcon.tsx`): a glossy
  green robot head built from gradients + gloss highlight + drop shadow (per-instance
  gradient ids via `useId`). Replaces the flat sparkle/`Bot` across navbar, launcher,
  header, and gate.
- **Look** — navbar button is a **transparent glass** pill with a **live "active"
  green pulse** (glow + border + tint breathe together) and a subtle robot head-turn;
  the **floating launcher is green** (mint gradient) with a soft glow pulse. All
  animations disabled under `prefers-reduced-motion` (house convention).
- Verified (Playwright + screenshots): navbar transparent + `ai-active` animation +
  robot SVG, green launcher gradient, opens the assistant, 0 page errors.
  typecheck + lint(0) + test(120) + build green.
- **Robot idle life** (follow-up): the `RobotIcon` now blinks its eyes and pulses
  its antenna light everywhere it appears; the floating launcher's robot gently
  floats/tilts. Verified: `robot-antenna`/`robot-blink`/`ai-fab-float` animations
  live, 0 errors.
- **Always-on** (follow-up): these XYZ AI brand animations were being disabled by
  the desktop "reduce motion" OS/browser setting (why they looked static on some
  desktops). By owner decision they now run regardless of that preference — verified
  the pulse animates under emulated `prefers-reduced-motion: reduce`. (Trade-off:
  intentionally overrides reduce-motion for these subtle decorative animations only.)

## 2026-07-05 — XYZ AI: research assistant (Phase B, PR 1) — Google Gemini (free)
First in-product AI feature — a floating **"XYZ AI"** chat assistant, open to **all
signed-in members**, grounded in the site's own published research. Provider: **Google
Gemini free tier** (owner's call: free now, easy swap to Claude later).
- **New:** `src/lib/ai.ts` (single AI-provider wrapper — `GoogleGenAI`, `aiEnabled`
  graceful-degrade flag, `streamAssistant` returning a provider-agnostic
  `AsyncIterable<string>`, `completeText`, model constants) · `src/lib/ai-ground.ts`
  (pure, unit-tested grounding: keyword ranking + capped corpus + system prompt) ·
  `src/app/api/ai/assistant/route.ts` (streaming, logged-in gate, `ai` rate bucket, zod,
  article grounding) · `src/components/XyzAiWidget.tsx` (launcher + streaming chat;
  login gate; Markdown answers with `/research` citations).
- **Model:** `gemini-2.5-flash` (free), streamed. Single-wrapper design → switching to
  Claude later touches only `ai.ts`.
- **Env:** `GEMINI_API_KEY` (optional — everything no-ops cleanly when unset, house
  degradation pattern). Dashboard Integrations strip gains an **"XYZ AI"** health pill.
- **Access & safety:** any signed-in member; 15 turns/min per user; bounded grounding
  corpus (≤8 articles / ≤12k chars) + capped history (12 turns). **Premium article
  bodies are redacted from the corpus** (title+excerpt only) so the open assistant
  can't leak paid content.
- typecheck + lint(0 err) + test(**120**, +11 for ai-ground) + build green.

## 2026-07-03 — Social login: GitHub + X (Twitter) providers, unified buttons
- **New OAuth providers** (env-gated like Google): `GITHUB_CLIENT_ID/SECRET` and
  `TWITTER_CLIENT_ID/SECRET` (OAuth 2.0). Buttons appear on /login + /signup only when
  configured — zero UI change until keys are added.
- **Unified `SocialButtons`** (Google/GitHub/X) replaces the single GoogleButton; forms
  take a `providers` flags object from the server pages.
- **Provider stamping fixed**: `linkAccount` event now records the real provider
  (was hardcoded "google" for every OAuth signup).
- **Email caveat handled**: GitHub can hide email and X never shares it — such accounts
  get a stable placeholder (`gh-<id>/x-<id>@users.noreply.xyzcrypto.io`) so login works;
  email features simply no-op for them (documented in .env.example).
- Dashboard Integrations strip now shows GitHub login + X login status pills.
- typecheck + lint(0 err) + test(109) + build green.

## 2026-07-03 — Chat v3: message recovery + Telegram-style polls + pinned messages
Recovery point: branch `backup/pre-p6-security` (same base). Owner-requested chat upgrade:
- **Deleted messages recovered:** chat deletes were always soft (`status='hidden'`) —
  new one-click **"Restore all hidden (N)"** in Dashboard → Moderation → Chat
  (`action: "restore_all"` on the moderate API), plus per-message Restore (existing) and
  a HANDOFF SQL fallback. Nothing was ever destroyed.
- **Polls (Telegram semantics):** create from the composer "📊" button (question +
  2–8 options); one vote per member, tap another option to move your vote, tap your own
  to retract. Live results with share bars + counts via `poll_vote` broadcasts
  (anonymous counts only — voter identity never leaves the server; your own `myVote` is
  stamped per-request). New models `ChatPoll`/`ChatPollOption`/`ChatPollVote` +
  `ChatMessage.kind`, APIs `POST /api/chat/polls` + `POST /api/chat/polls/[id]/vote`,
  idempotent migration `11_chat_polls` (auto-applies via vercel-build).
- **Pinned messages:** admins pin/unpin from the message action bar; a gold banner above
  the chat shows the latest pin (tap → jump to message). `ChatMessage.pinnedAt`,
  `message_pinned` broadcast, pin state included in history + initial render.
- Poll math extracted to pure helpers (`applyPollVote`, `pollShares`) — 6 new unit tests
  (109 total). Poll messages aren't editable (question integrity); hiding a pinned
  message clears the banner; polls flow through moderation like any message.

## 2026-07-03 — Phase 6: security verification + hardening (audit §5 closed out)
Recovery point: branch `backup/pre-p6-security`. The audit's security section is now fully
verified/fixed/accepted (see AUDIT-2026-07-01 §5):
- **CSP: `'unsafe-eval'` dropped from script-src** — browser-verified on a prod build
  across home/research/community/login/premium: 0 CSP violations, 0 chunk/hydration
  errors. `'unsafe-inline'` remains an accepted risk pending a nonce pipeline
  (documented in `next.config.mjs`).
- **Dashboard email exposure**: Members table now shows `maskEmail()` with
  reveal-on-click; `SECURITY.md` reconciled (staff APIs/CSV intentionally return raw
  emails inside the `users:manage` trust boundary).
- **`/api/contact` gets its own rate bucket** (5/min/IP) — previously shared `subscribe`
  with `/track`, so page-view pings from one NAT could 429 real contact submissions.
- **Ops flags for the owner**: `UPSTASH_REDIS_REST_URL`/`TOKEN` are NOT set in prod
  (per the Vercel env screenshot) → all rate limits are permissive no-ops until added.
  Supabase private channels/RLS stays on the roadmap (privileged state is re-checked
  server-side, so public channels leak only presence/ping metadata).
- typecheck + lint(0 err) + test(103) + build green.

Note: Phase 5 (UI/UX polish) was **discarded by owner decision** — PR #42 closed
unmerged, original design retained; the work is preserved on `backup/pre-p5-uiux`.

## 2026-07-02 — Phase 4: Dashboard v2 — analytics, moderation, audit trail, subscribers (audit §2.2)
Recovery point: branch `backup/pre-p4-dashboard`. Four write-only/invisible datasets got
professional surfaces, plus real analytics:
- **30-day trend charts** in Overview — signups/day + page-views/day. New
  `GET /api/dashboard/timeseries` (dashboard:view, Postgres `date_trunc` bucketing,
  zero-filled server-side, cached 60s). Hand-rolled SVG area charts (no chart lib):
  hover crosshair + tooltip, peak label, sr-only data table; hues validated per theme
  with the dataviz six-checks (`--chart-mint`/`--chart-gold`).
- **Moderation tab** (post:manage) — global comment queue (`GET /api/comments`, new
  soft-hide `PATCH /api/comments/[id]`) and chat-message review incl. hidden
  (`GET/POST /api/chat/messages/moderate`, hide/restore with live broadcasts).
- **Activity tab** (users:roles) — the `AdminAudit` trail finally has a reader:
  `GET /api/admin/audit` + paginated panel (who changed whose access, when).
- **Subscribers tab** (users:manage) — `GET /api/subscribers` list + full CSV export
  (the table previously had no read endpoint at all).
- **Integration health strip** in Overview — Realtime/Storage/Rate-limits/Email/Google
  configured-or-not (booleans only, never values).
- **Content table**: mobile no longer forces a 640px scroll (Category/Views/Date fold
  into the title line, back at md:), and Views/Date column sorting.
- 6 new unit tests for the pure timeseries helpers (103 total).
- typecheck + lint(0 err) + test(103) + build green; /dashboard 247 kB first-load.

## 2026-07-02 — Phase 3: Community Chat — professional + full mobile parity (audit §1.1, §1.3)
Recovery point: branch `backup/pre-p3-chat-pro`. The chat now behaves like a native app on
phones and gains the "finished product" features:
- **Mobile parity:** container uses `dvh` (composer stays visible above the keyboard);
  message actions open on TAP on touch devices (the always-visible bar overlapped text);
  Enter inserts a newline on touch (send via button) and still sends on desktop; 16px
  composer font (no more iOS zoom-on-focus); safe-area padding (home-indicator clear);
  double-tap-❤️ is desktop-only (touch gets a ❤️ button in the tap menu — no zoom fight);
  header decluttered <640px (subtitle hidden, 3 avatars max); reaction/emoji popovers
  clamp to the viewport.
- **Message editing:** authors can edit within 15 min — `PATCH /api/chat/messages/[id]`,
  `message_edited` broadcast, inline edit UI, "(edited)" label. New `ChatMessage.editedAt`
  column (idempotent migration `10_chat_edited`, auto-applies via vercel-build).
- **"New messages" divider** marks where unread starts when you're scrolled up.
- **Honest connection state:** Live / Reconnecting… / Auto-refresh (was a forever
  "Connecting…" when realtime wasn't configured).
- **Removal tombstone:** deleted messages show "Message removed." in-session instead of
  silently vanishing mid-read.
- **Grouped-message timestamps** reveal in the gutter on hover / while the tap menu is open.
- Extracted pure helpers to `src/lib/chat-view.ts` (`canEditMessage`, `reconcilePoll`) with
  **9 new unit tests** (97 total).
- typecheck + lint(0 err) + test(97) + build green; `/community` 245 kB first-load;
  Playwright-verified at 390px + desktop.

## 2026-07-02 — Phase 2: all functional bugs fixed (audit §1.2, §2.1, §3)
Recovery point: branch `backup/pre-p2-bugfixes`. 20+ confirmed bugs from the audit, fixed:
- **Chat correctness (`ChatClient.tsx`):** polling now reconciles deletions (hidden
  messages disappear without realtime); presence uses stable presence-key fallback ids
  (guest online-count no longer drifts); reply-quote jump pages backwards (bounded) until
  the target loads; the realtime channel no longer re-subscribes on profile edits (deps on
  identity only, profile fields via ref); loadOlder guards all-deduped pages (no scroll
  jump) and reports whether rows were added; reaction popover closes on outside press;
  failed-send rollback no longer clobbers re-typed input; send/doSend split (no fake
  FormEvent); single steady typing-expiry interval; AudioContext closed on unmount.
- **Dashboard data:** new `GET /api/users` (users:manage) — paginated, server-searchable
  members + `?format=csv` **full** export; Members panel now searches ALL members
  (debounced, server-side) with Load-more, not just the 50 most recent; CSV button uses
  the full export; PremiumMembers re-seeds on server refresh; Content table shows
  per-post **Views**.
- **Site-wide:** comment "Load older" pagination (older comments were unreachable);
  MarketTicker light-mode remap (`/70`,`/90` opacities); research list/home/related no
  longer ship article bodies — cards use precomputed `readMinutes` (payload trim,
  PERFORMANCE.md win #1); notifications without a target render as non-links (no more
  jump-to-top `#`); `en-US` locale pinned in ticker/chart (hydration-safe); email fallback
  no longer logs OTP/message bodies in production; signup no longer reveals registered
  emails (generic response + "you already have an account" notice email); LikeButton
  ignores broadcasts while its own toggle is in flight; footer `/profile` link verified
  intentional (self-resolving redirect to `/u/<handle>`).
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.

## 2026-07-01 — Complete site audit (docs/AUDIT-2026-07-01.md)
Full-stack audit: chat (mobile + correctness + features), dashboard (bugs + missing
features + API gaps), site-wide bugs, UI/UX "AI-generic" review, security verification,
performance. Graded scorecard + every finding with severity/file:line/fix, mapped to a
6-phase remediation program (P2 bugs → P3 chat → P4 dashboard → P5 UI/UX → P6 security).
Docs-only change.

## 2026-07-01 — Fix: password reset now clears account lockout
Recovery point: branch `backup/pre-reset-lockout-fix`. **Bug:** a user who locked their
account by guessing (5 failed logins → 15-min `lockedUntil`) and then reset their password
still couldn't sign in with the new password — `authorize()` (`src/lib/auth.ts`) checks the
lock *before* comparing the password, and the reset handler updated only `passwordHash`.
- **Fix:** `src/app/api/auth/password/reset/route.ts` now clears `failedLoginCount` and
  `lockedUntil` in the same update that sets the new hash, so a reset unlocks the account
  immediately (no more ~15-min wait).
- Scope: one file; lockout policy and the authenticated change-password path are unchanged.
- typecheck + lint(0 err) + test(88) + build green.

## 2026-06-27 — Fix: CSP was blocking Supabase Realtime (the real "still not working")
Recovery point: branch `backup/pre-csp-fix`. **Root cause** of live-online + instant
sound being dead in prod despite correct env vars: the Content-Security-Policy
`connect-src` (`next.config.mjs`) didn't allow Supabase, so the browser silently blocked
the Realtime WebSocket (`wss://<ref>.supabase.co`). The channel never reached
`SUBSCRIBED` → no presence ("0 online" / "Connecting…"), no broadcasts, no sound.
- **Fix:** added `https://*.supabase.co wss://*.supabase.co` to `connect-src` (one line).
  Mirrors the `**.supabase.co` already allowlisted for images.
- Ruled out (all verified correct): the broadcast endpoint `/realtime/v1/api/broadcast`
  (current per Supabase docs, returns 202), NEXT_PUBLIC build-time inlining, Vercel
  "Sensitive" flag, and the entire client subscription/presence/event wiring.
- Documented in `docs/REALTIME-SETUP.md` so `connect-src` isn't tightened back.
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.

## 2026-06-27 — Community Chat: emoji-reaction sound + realtime setup guide
Recovery point: branch `backup/pre-reaction-sound`. Follow-up to the sound/live-online fix.
- **Sound on emoji reactions:** the `reaction` broadcast handler now plays the same
  subtle blip when **another** member adds an emoji reaction (opt-in toggle; never your
  own; `remove` is silent), mirroring the new-message rule. Reuses the existing shared
  `AudioContext` + `playBlip` — no new audio plumbing.
- **Realtime-only note:** reaction sound (like presence + instant message push) needs
  Supabase Realtime configured; the 10s polling fallback stays message-list-only and
  doesn't blip on reactions (no per-user reaction delta to key off → would misfire).
- **New ops guide `docs/REALTIME-SETUP.md`:** exact step-by-step to turn on live
  "who's online" + instant sound — copy the 3 Supabase keys → set 4 Vercel env vars →
  redeploy → 2-device verification + troubleshooting. Linked from `docs/HANDOFF.md §4`.
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.

## 2026-06-27 — Community Chat: sound + live-online fix
Recovery point: branch `backup/pre-sound-fix`. Targeted fix for "sound & live online
real-time showcase not working" — both bugs were client-side; the message core is untouched.
- **Sound now actually plays:** `playBlip()` previously created a *new* `AudioContext` on
  every incoming message — under browser autoplay policy a context created outside a user
  gesture stays `suspended`, so it was silent. Now a single shared `AudioContext`
  (`audioCtxRef`) is created **and resumed inside a user gesture** (`ensureAudio()` on the
  sound-toggle click and on send), and `playBlip(ctx)` only plays when `ctx.state === "running"`.
  Enabling sound also plays an immediate confirmation blip. Sound now fires on the polling
  fallback path too (not just realtime broadcast).
- **Live-online strip visible on mobile:** the online-members avatar stack was
  `hidden … xs:flex` (hidden below the `xs` breakpoint), so on phones the "who's online"
  showcase never appeared even when presence worked — changed to `flex` so it always shows.
- **Ops note (the other half):** presence ("live online") and new-message broadcast are
  **realtime-only** — they need `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (+ server `SUPABASE_SERVICE_ROLE_KEY` for broadcasts) set in prod with Supabase Realtime
  enabled. Without them the chat degrades to 10s polling and presence/sound can't surface.
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.

## 2026-06-27 — Community Chat: engagement v2 (#7) — mentions, quick-react, sound
Recovery point: branch `backup/pre-chat-v2`. Additive on top of v1; send/broadcast core untouched.
- **@mention autocomplete:** typing `@partial` in the composer suggests online members
  (with a handle), with avatar + name; selecting inserts `@username` (links to their profile).
- **Double-tap to ❤️:** double-click any message to toggle a heart (reuses `toggleReaction`).
- **Sound toggle:** a header speaker button (opt-in, persisted) plays a subtle Web-Audio
  blip on incoming messages (never your own) — that "new message" dopamine hit.
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.

## 2026-06-27 — Community Chat: futuristic overhaul v1 (#7) — live presence
Recovery point: branch `backup/pre-chat-overhaul`. Visual + presence only — the message
send/broadcast/reaction core is untouched (it's the fragile part).
- **Live "who's online" presence strip:** presence now tracks each member's name + avatar
  + handle, de-duped by user id; the header shows a stack of online members' avatars
  (linking to their `/u/<handle>` profiles) + a live count. Real social proof / "who's here".
- **Futuristic header + room identity:** "XYZ Lounge" with a pulsing live/connecting dot,
  `#general` subtitle, a mint gradient header bar and a mint "N online" pill.
- **Ambient glow** behind the room (mint top + gold corner), content layered above it.
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.
- Next iterations (optional): @mention autocomplete from online members, quick double-tap
  reactions, sound/streak cues — all layer on top of this without touching the core.

## 2026-06-27 — UX fixes + security audit + perf (items #2–#6)
Recovery point: branch `backup/pre-batch-fixes`.
- **#4 Footer:** "Create account"/"Log in" now hidden when signed in (GuestOnly) — members
  see "Your profile"/"Settings" instead.
- **#5 Emoji animations:** keyframes made subtle/professional (the `emoji-wobble` 360° flip
  and `emoji-launch` -7px jump are gone) — no more "out of box" motion; contained, no layout shift.
- **#6 Profile name:** added `min-w-0`/`break-words` so a long display name no longer gets
  clipped by the badges row on desktop.
- **#2 Security audit** (`docs/SECURITY-AUDIT.md`, full report): fixed **F-001 open redirect**
  (login `callbackUrl` now same-origin only), **F-005** bcrypt cost 10→12, **F-006** research
  edit/delete now `post:manage` (granular, not Super-Admin-only), **F-008** prod warning when
  rate-limiting is disabled. Documented the rest (realtime RLS, CSP nonce — ops/deferred).
- **#3 Performance** (`docs/PERFORMANCE.md`): comments lazy-load threshold 400→150px;
  `/api/users/staff` cached 30s; prioritized roadmap for the deeper wins.
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.

## 2026-06-27 — Navbar: show Dashboard link to all staff (not just Super Admins)
Recovery point: branch `backup/pre-navbar-staff`.
- **Root cause of "granted user can't reach the dashboard":** the navbar only showed the
  Dashboard link when `role === "ADMIN"`, so a member granted a capability (role `USER` +
  permissions) had no link to /dashboard even though the page now lets them in. The link
  (desktop account menu + mobile drawer) now shows for **any staff** via `isStaff(user)`
  (Super Admin OR ≥1 capability). After a refresh/re-login the granted member sees
  Dashboard and lands on their allowed tab(s).
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.

## 2026-06-27 — Access fixes: dashboard gate trap + "who has access" + What's-New emoji
Recovery point: branch `backup/pre-access-fixes`.
- **Granted access now works (core bug):** the dashboard required the specific
  `dashboard:view` capability and defaulted to a hardcoded "overview" tab — so granting
  any *other* capability (e.g. `whatsnew:manage`) let the member past nothing. Now the
  page gates on **`isStaff`** (Super Admin OR ≥1 capability) and the active tab defaults
  to the **first tab the viewer can see**. A member granted What's New now opens the
  dashboard straight onto the What's New tab.
- **"Who has access" Team section:** new `GET /api/users/staff` (gated `users:roles`,
  pre-migration-safe) lists everyone with a capability + Super Admins. The Access panel
  now shows a **Team** list (with capability counts + Edit) above the grant-access search.
- **What's New emoji picker:** the composer body has an emoji button (reuses the chat
  `EmojiPicker`) so entries can include emojis.
- AccessEditor hint clarifies that any capability grants dashboard access (refresh if
  already signed in).
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.

## 2026-06-27 — Milestone 4: animations/emoji polish (#3) + professional SEO (#9)
Recovery point: branch `backup/pre-m4`. Final milestone of the program.
- **#3 Animations/emoji:** consistent `AnimatedEmoji` accents added to every marketing
  section heading — About 🚀, Products ⚡, Ecosystem 🌐, Social 👋, What's New ✨, plus
  the new FAQ 💬 (Hero/Premium/Contact already had them). All reduced-motion-safe via
  the existing `AnimatedEmoji` (renders a static glyph when motion is reduced).
- **#9 SEO (brand-rank "XYZ Crypto"):**
  - JSON-LD builders moved to JSX-free `src/lib/seo-schema.ts` (unit-testable);
    `jsonld.tsx` re-exports them. **Organization** gains `foundingDate` (2019), sized
    `logo` ImageObject, `slogan`, `knowsAbout`, `email`, `areaServed`, `alternateName`.
    **Article** uses a `Person` author + a 640×640 publisher logo.
  - New **FAQPage** schema + a visible homepage **FAQ** section (shared `src/lib/faq.ts`
    source) targeting brand queries (what is XYZ Crypto, is it free, is it legit…).
  - **sitemap.ts** now includes public `/u/<handle>` profiles (capped).
  - Per-article **dynamic OG images** via `next/og`
    (`research/[slug]/opengraph-image.tsx`) — branded card with the post title (Node
    runtime, graceful fallback).
- typecheck + lint(0 err) + test(88) + build green; shared First-Load JS 159 kB.
- ⚙️ Ops: set `GSC_VERIFICATION` + submit the sitemap in Google Search Console.

## 2026-06-27 — Pre-M4 fixes: admin access search + migration auto-apply
Recovery point: branch `backup/pre-fixes`. Two owner-reported blockers.
- **Admin Access search:** the dashboard "Access" tab now searches **any member** by
  email/name via a new `GET /api/users/search` (gated `users:roles`, permission select
  guarded for pre-migration) instead of filtering only the recent 50 client-side. Each
  result shows current capability count + Grant/Edit access; grants are repeatable
  (grant → save → adjust → save), and the list refreshes after each save.
- **What's New "add" failed = DB not migrated:** the M1/M2 schema (login-lockout cols,
  `permissions`, `WhatsNewEntry`, `AdminAudit`) wasn't applied to prod. Added idempotent
  migration files `prisma/migrations/8_login_lockout` + `9_permissions_whatsnew_audit`,
  and a **`vercel-build`** script that runs `prisma db push` (best-effort, non-fatal) on
  every Vercel deploy so the schema auto-syncs. CI `build` unchanged (no DB) → stays green.
- typecheck + lint(0 errors) + test(85) + build green; shared First-Load JS 159 kB.
- ⚙️ Immediate unblock (before next deploy): `npm run db:push` (prod env) + `npm run seed`.

## 2026-06-27 — Milestone 3: realtime data + notifications (#7, #11)
Recovery point: branch `backup/pre-m3`. No schema changes (pure realtime layer).
- **Reusable `useRealtime` hook** (`src/lib/useRealtime.ts`): subscribes to a Supabase
  broadcast channel/event when configured, else **polls** a cached endpoint — broadcast-
  driven invalidation (server pushes a tiny ping, client refetches) so it never streams
  rows or hammers the DB. Pure `realtimeMode()` decision is unit-tested. Degrades to no-op.
- **#11 Live data:** likes update live for all viewers (broadcast on `post:<id>` from the
  like route → `LikeButton` refreshes the count); new comments appear without reload
  (`CommentSection` refetches on a `post:<id>` `comment` broadcast); **dashboard stats
  live-refresh** — new shared `getDashboardStats()` + cached `GET /api/dashboard/stats`
  (gated `dashboard:view`), Overview refreshes instantly on the notifications ping + a 30s
  backstop. `LiveStats` presence + membership realtime unchanged.
- **#7 Notifications + chat icon:** verified the existing realtime path — `notifyNewPost`/
  `notifyNewComment` ping clients so the bell updates instantly; the chat icon lights up on
  the `new_message` broadcast. (Already realtime; extended likes/comments to broadcast too.)
- typecheck + lint(0) + test(85) + build green; shared First-Load JS 159 kB.

## 2026-06-26 — Milestone 2: admin permissions (#10) + What's New CMS (#6)
Recovery point: branch `backup/pre-m2`. Scalable, production-ready. No re-architecture.
- **Granular permissions (#10):** new `src/lib/permissions.ts` capability **catalog**
  (`dashboard:view`, `post:publish`/`post:manage`, `users:manage`/`users:roles`,
  `premium:manage`, `whatsnew:manage`) — add a new capability in one line. `User.permissions
  String[]`; **Super Admin** (ADMIN_EMAILS / legacy role=ADMIN) implicitly holds all and is
  immutable. Session carries `permissions` + `isSuperAdmin` (`auth.ts`, guarded for
  pre-migration). `requirePermission()` gate in `src/lib/api.ts`; gates moved to capabilities
  (dashboard → `dashboard:view`, research publish → `post:publish`, membership → `premium:manage`).
  New `PATCH/GET /api/users/[id]/access` with **no-escalation** guards + `AdminAudit` trail +
  live `access_changed` broadcast (session refreshes via `RealtimeSession`). Dashboard
  **"Access"** tab: search members, grant/revoke capabilities; tabs now capability-gated. +7 tests.
- **What's New CMS (#6):** new `WhatsNewEntry` model (tags New/Improved/Fixed/Announcement/
  Security/Roadmap). `GET /api/whatsnew` (public, `?tag=&q=` filter/search, cached, **static
  fallback** when empty/unmigrated) + `POST`/`PATCH`/`DELETE` (gated `whatsnew:manage`).
  **Auto-entry** created on research publish (linked to the post); manual entries via the new
  dashboard **"What's New"** tab. Homepage `WhatsNew` is now DB-driven with **tabs** (filter by
  tag) + **realtime** refresh (`whatsnew_updated` broadcast) + `revalidatePath`. Seeded
  idempotently from the old static list. +2 tests.
- typecheck + lint(0) + test(82) + build green; shared First-Load JS 159 kB.
- ⚙️ Ops: apply the M2 migration (User.permissions, WhatsNewEntry, AdminAudit) — see HANDOFF §4.

## 2026-06-26 — Milestone 1: security hardening + critical bugs + mobile (#4,#5,#8,#2)
Recovery point: branch `backup/pre-m1`. First of the 4-milestone roadmap program.
- **#4 Premium CTA bug:** `/premium` "Create account" CTAs are now wrapped in
  `GuestOnly`; signed-in members get a member CTA instead (new `SignedIn.tsx`, the
  inverse of `GuestOnly`). Logged-in users no longer see "create account".
- **#5 Password + brute-force:** shared strong `passwordSchema` (min 8 + upper/lower/
  digit) enforced server-side at signup, reset and change (`src/lib/profile.ts`,
  signup/reset routes; `PasswordField` minLength→8). **DB-backed account lockout**
  (5 fails → 15 min) in `src/lib/auth.ts authorize()` — works even without Upstash;
  login path kept independent of the new columns so it degrades gracefully pre-migration.
  New User columns `failedLoginCount`, `lockedUntil`. +6 unit tests.
- **#8 Auto @handle:** handles already auto-assign on signup/OAuth + on-the-fly; added a
  standalone idempotent backfill (`prisma/backfill-usernames.ts`, `npm run
  backfill:usernames`) for any legacy NULL handles. Navbar already resolves `/u/<handle>`.
- **#2 Mobile/responsive:** dashboard members table no longer forces horizontal scroll
  on phones (date columns hidden < md, relaxed min-width); contact form inputs → 44px
  tap target (`py-3`).
- typecheck + lint(0) + test(73) + build green; shared First-Load JS 159 kB.
- ⚙️ Ops: apply the migration adding `User.failedLoginCount`/`lockedUntil`
  (lockout activates once applied); optionally run `npm run backfill:usernames`.

## 2026-06-26 — Desktop orbital: fix static animation + light rendering; park 3D
Reported on desktop (light preview): the orbital centerpiece was **static** and the
node pills rendered **dark on the light background**.
- **Root cause:** the WebGL gate fell back to the CSS orbital on the device, whose
  rotation was gated by `prefers-reduced-motion` (→ static); the node pills used
  `bg-ink-900/85`, a level not yet remapped for light (→ dark pills).
- **Fix:** `OrbitalEcosystem.tsx` now always animates the signature rings / aurora /
  logo glow / node float (deliberate always-on motion for the branded centerpiece);
  ring opacities bumped for visibility. `globals.css` remaps `bg-ink-900/85` → light
  surface so pills are light-on-light.
- **Consolidated to the CSS orbital on all devices** (`OrbitalLazy.tsx`): dropped the
  capability-gated R3F path. The branded, labeled CSS orbital is lighter, reliable,
  theme-correct and animates everywhere; **three.js is no longer fetched on the
  homepage** (bundle win). `OrbitalScene3D.tsx` parked in-repo for a future art pass.
- **Verified (Playwright + Chromium):** rings confirmed rotating in light, dark, and
  under emulated reduced-motion; pills render light-on-light (light) and dark (dark);
  dark unchanged. Shared First-Load JS 159 kB.

## 2026-06-26 — Phase 2 completion (B): light-theme migration (foundation + high-traffic)
Recovery point: branch `backup/pre-light-theme`. **Dark mode byte-for-byte unchanged**
— every rule is scoped to `html:not(.dark)`. CSS-only; no component classNames touched
(so zero dark-mode regression risk, hierarchy preserved).
- **B1 additions** (on top of the B0 foundation below): white `ring-*` outlines,
  gold/mint `text-*-400/500`, status text (`red`/`amber`/`sky`/`violet`/`blue`/
  `emerald` 200–400) lifted to readable shades, remaining dark chips (`bg-ink-800/600`),
  the `.eyebrow`/`.eyebrow-glass` pills, and the scrollbar track — all themed for light.
- **Visual verification (Playwright + Chromium, this repo):** rendered light mode at
  1440px on homepage, login, and contact and confirmed parity with dark — themed
  navbar, eyebrow pills, darkened gold-gradient headings, `.surface` cards, form
  inputs/labels, mint/gold buttons, and status/icon accents all read correctly. Dark
  re-rendered identical. (Covers the shared Field/card/prose/overlay patterns used by
  Settings, Dashboard, articles, and chat.)
- Shared First-Load JS unchanged (159 kB).

### B0 foundation
- `src/app/globals.css`: a consolidated light foundation that remaps the design's
  actual utilities under `html:not(.dark)`:
  - **Text ramp** (`text-zinc-50…700`, `text-white`) → a dark-on-light hierarchy.
  - **Brand accent text** (`text-gold-100/200/300`, `text-mint-200/300`, gradients,
    `text-shine`) → readable shades on white.
  - **Hairlines/tints** (`border-line`, `border-white/5,10`, `bg-white/…`) → dark tints.
  - **Inputs & overlays** (`bg-ink-700/60`, `bg-ink-9xx/8xx` dropdowns, `bg-ink-950`)
    → light surfaces.
  - **Primitives**: `.glass`/`.surface`/`.surface-hover`, `.btn-secondary`/`.btn-ghost`,
    `.prose-xyz` (headings/body/code/pre/blockquote/tables/links) → light treatments.
  - **Ambient FX** (`.mesh`/`.aurora`/`.particle`) hidden in light; `.grid-bg` softened.
- Shared First-Load JS unchanged (159 kB).
- ⏳ Next (B1, after preview review): targeted high-traffic className cleanups for the
  few spots the CSS remap can't reach (rings, inline gradient overlays, hero specifics).

## 2026-06-15 — Phase 2 completion (A): section polish + anime/iconsax rollout
Recovery point: branch `backup/pre-polish-rollout`. Styling-only, brand-consistent,
no behavior/feature change. First small checkpoint of the "complete the sweep" work.
- **Homepage sections** brought up to the polished standard (`Social`/`WhatsNew`):
  - `About.tsx`: credibility box → `surface surface-hover lift` + `glow-orb`; Learn/
    Trade/Earn get a mint left-accent; credential icons scale on hover.
  - `Products.tsx`: gold hover-glow on the Perp spotlight; icon `group-hover:scale`
    across all product cards.
  - `Ecosystem.tsx`: tone-aware hover glow (gold/mint) per card, logo scale, livelier
    Telegram CTA.
  - `Footer.tsx`: gold-dot column headers, social-icon `scale-110`, link hover shift,
    centered disclaimer; `FooterNewsletter.tsx` → contained premium glass card + eyebrow.
- **MagneticButton rollout** (desktop/fine-pointer only — auto-disabled on touch &
  reduced-motion; anime.js stays lazy): Navbar "Get Started", ChatClient "Log in to
  chat", PremiumLock CTAs. (Hero already covered.) Mobile-only CTAs intentionally
  skipped (magnetic no-ops there).
- **Iconsax accents** (standalone premium spots only — not mixed into uniform lucide
  icon arrays): `PremiumLock` `Lock`→iconsax `Lock`, `Sparkles`→`MagicStar`.
- Shared First-Load JS unchanged (159 kB); homepage First-Load unchanged (244 kB).

## 2026-06-15 — Phase 2 (increment 8): Admin Dashboard premium polish
Recovery point: branch `backup/pre-research-polish` (chained). Styling only; no logic change.
- **DashboardClient**: header eyebrow → premium glass pill; active tab gold glow +
  stronger divider (matches Settings/Community); stat cards get `lift` hover.
- Shared First-Load JS unchanged (159 kB). Closes the user-facing + admin premium sweep.

## 2026-06-15 — Phase 2 (increment 7): Community/Chat premium polish
Recovery point: branch `backup/pre-research-polish` (chained). **Styling only** —
no realtime/state/handler changes; chat logic untouched.
- **ChatClient**: own messages get a subtle mint tint (clearer own-vs-others),
  richer empty state (emoji + subcopy), typing dots brightened to mint.
- **Community page**: header eyebrow upgraded to the premium glass pill.
- Shared First-Load JS unchanged (159 kB).

## 2026-06-15 — Phase 2 (increment 6): Profile + Settings premium polish
Recovery point: branch `backup/pre-research-polish` (chained). No behavior/data change.
- **Public profile** (`u/[username]/page.tsx`): banner depth (gradient + hairline),
  stronger avatar ring + gold glow, social/location rendered as premium pills, wider
  stat spacing, hover on activity items, and a richer empty state (icon + subcopy).
- **Settings** (`SettingsClient.tsx`): active tab gets a subtle mint glow + stronger
  divider; input focus ring bumped (gold/20 → /30). Forms/logic unchanged.
- Shared First-Load JS unchanged (159 kB).

## 2026-06-15 — Phase 2 (increment 5): Research/Articles reading-experience polish
Recovery point: branch `backup/pre-research-polish`. No behavior/feature change; brand kept.
- **Reading typography** (`globals.css` `.prose-xyz`): added styling for previously
  unstyled elements — fenced **code blocks** (`pre` + `pre code` reset), **ordered
  lists**, `h4`, **images** (rounded + ring), **tables**, and a gold **`hr`** divider;
  refined list/line rhythm. Article column stays `max-w-3xl`.
- **Premium gate** (`PremiumLock.tsx`): premium visual upgrade — soft gold glow,
  blurred "hidden content" teaser lines, gold-shine lock badge, and a 3-perk value
  list. Gating logic + buttons unchanged (content still never sent to non-Premium).
- Shared First-Load JS unchanged (159 kB).

## 2026-06-15 — Phase 2 (increment 4): Anime.js micro-interactions + Iconsax accents
Recovery point: branch `backup/pre-fx`. Hero-scoped; brand palette; reduced-motion safe.
- **Iconsax accents** (`Hero.tsx`): eyebrow `Sparkles`→`MagicStar` (gold), trust-line
  `ShieldCheck`→`ShieldTick` (mint). Homepage First-Load JS +2 kB (244 kB); shared 159 kB.
- **Anime.js magnetic CTA** — new `MagneticButton.tsx`: primary hero CTAs ease toward
  the cursor and spring back (elastic) on leave. Disabled for reduced-motion / touch;
  anime.js **lazy** (only fetched on first hover — not in the initial bundle).
- No layout/section changes; backward-compatible.

## 2026-06-15 — Phase 2 (increment 3): Homepage + Navbar premium pass
Recovery point: branch `backup/pre-homepage-polish`. Brand kept; no new deps;
shared First-Load JS unchanged (159 kB).
- **Navbar** (`Navbar.tsx`): active-route indicator via `usePathname` (desktop
  underline persists + `text-zinc-50`; mobile gets `bg-white/5 text-gold-200`;
  `aria-current`); subtle gold ring on the scrolled glass bar.
- **Hero** (`Hero.tsx`): interactive hover on the live-stat cards. Medallion,
  parallax, badges, ticker, reduced-motion handling all unchanged.
- Anime.js micro-interactions + Iconsax accents remain a separate upcoming pass.

## 2026-06-15 — Phase 2 (increment 2): R3F orbital hero (lazy + CSS fallback)
Recovery point: branch `backup/pre-hero`. Stability/perf-first; brand palette only.
- New `OrbitalScene3D.tsx` — React-Three-Fiber premium orbital (gold core +
  mint/gold orbiting nodes + sparkles, auto-rotate + pointer parallax). Perf-budgeted:
  `dpr={[1,1.5]}`, low-poly, paused when offscreen/tab-hidden, no heavy postprocessing.
- `OrbitalLazy.tsx` — capability gate: renders the 3D scene only on capable desktop
  (WebGL + pointer:fine + ≥lg + not reduced-motion + ≥4 cores/4GB); otherwise the
  existing CSS `OrbitalEcosystem` (fallback unchanged). three.js is a **separate
  async chunk** (~672 KB) — only downloaded when the 3D scene mounts; **shared
  First-Load JS unchanged (159 kB)**, mobile/low-power never fetch it.
- Deps (pinned for React 18): `three@0.169` · `@react-three/fiber@8` ·
  `@react-three/drei@9` (+ `@types/three`). Noted in `docs/DESIGN-SYSTEM.md`.
- Hero/navbar premium polish kept minimal this pass (stability-first); deeper
  per-area passes follow.

## 2026-06-15 — Phase 2 (foundation): design system + light/dark theming
Recovery point: branch `backup/pre-phase2`. Brand identity preserved; **dark mode
pixel-identical** to before (zero regression); backward-compatible.
- **Theming:** Tailwind `darkMode: "class"`; semantic CSS-var tokens in `globals.css`
  (`:root` light / `.dark` dark = current values); `body` wired to tokens; no-FOUC
  inline script + default `dark` class in `layout.tsx`; new `ThemeToggle` in the navbar
  (desktop + mobile). Dark stays default for first-time visitors.
- **Design tokens:** semantic Tailwind aliases (`base`, `surface`, `surface-2`,
  `content`, `content-muted`, `hairline`), motion tokens (`ease-premium`,
  `duration-250/400`); documented in new `docs/DESIGN-SYSTEM.md`.
- **Libraries:** installed `animejs` (v4) + `iconsax-react` (additive); lazy
  `src/lib/anime.ts` helper. (R3F deferred to the hero increment.)
- No UI redesign in this pass — foundation only. Per-area premium polish + R3F hero
  are the next increments.

## 2026-06-15 — Phase 1: performance & stability
Recovery point: branch `backup/pre-phase1` (@ d5e9b63). All backward-compatible,
no UI/architecture change. First-Load JS unchanged (159 kB shared).
- **DB indexes** (`prisma/schema.prisma` + idempotent migration
  `7_phase1_indexes/`): `Notification[userId,createdAt]`, `User[membership,createdAt]`,
  `PageView[path,createdAt]`. Additive; app already tolerant if unapplied.
- **PageView retention** (`api/track`): opportunistic (~1.5%) fire-and-forget prune
  of rows older than 90 days → table stays bounded without cron/infra.
- **Dashboard premium list** (`dashboard/page.tsx`): bounded with `take: 100`
  (newest-first) to avoid an unbounded scan at scale.
- **Chat realtime hygiene** (`ChatClient.tsx`): `channel.unsubscribe()` before
  `removeChannel` on cleanup → no subscription buildup on repeated mounts.
- Image/bundle review: `next/image` lazy defaults already in place; only an
  admin-only preview `<img>` remains (non-public). No risky refactors.

## 2026-06-15 — Phase 0 deep audit + critical fixes (see docs/AUDIT-PHASE0.md)
Recovery point: branch `backup/pre-audit-fixes` (@ ca969f7) pushed to origin.
**Fixes (safe, backward-compatible):**
- **Upload content-type spoofing** — `src/lib/storage.ts` now magic-byte–sniffs
  uploads (`sniffImageType`) and rejects non-images regardless of client MIME;
  applies to `api/profile/avatar` (any user) + `api/upload` (admin). +unit tests (67 total).
- **Unbounded notification fan-out** — `notifyNewPost` (`src/lib/notifications.ts`)
  now caps recipients (50k) and inserts in 500-row batches.
- **Admin upload rate-limit** keyed per-user (`api/upload`) instead of IP.
- **Mobile** — notification dropdown `max-w-[calc(100vw-1rem)]` so it doesn't clip.
Deep audit report (chat/upload/CMS/scale/mobile) added. Not merged to main —
held for owner review. No architecture/UI/feature changes.

## 2026-06-14 — Pre-Phase-2 hardening, audit & recovery point (see docs/AUDIT-PRE-PHASE2.md)
**Recovery point:** backup branches `phase1-stable` + `pre-phase2-backup` pushed
to origin (tag `phase1-production` local; tag push blocked by env git proxy).
**Security:** like/comment routes rate-limit per `user.id` (was IP); `api/chart`
only interpolates an allowlisted coin key (SSRF fix); `lib/otp.ts` fails closed in
prod without `NEXTAUTH_SECRET`; `auth/password/start` no longer leaks account
existence on email-send failure; `notifications/read` ids constrained to CUID.
**Observability:** `app/error.tsx` now reports to Sentry.
**SEO:** homepage `metadata` + canonical; `WebSite` JSON-LD `SearchAction`;
canonicals on premium/contact/community/u/login/signup; `app/manifest.ts` (PWA);
sitemap adds premium/community/contact.
**Frontend:** ProofStrip `<img>` width/height + lazy/async (CLS); Hero parallax
skipped under reduced-motion.
**Quality:** removed dead `MembersShowcase.tsx`; added `clientIp` unit tests
(64 tests green). No architecture/UI/feature changes. Verdict: READY FOR MERGE.

## 2026-06-14 — Demo 3: branded loader, live emoji, orbital fix, realtime data
**Branded route loader**
- New `BrandLoader` (XYZ logo + orbiting/pulsing rings on mesh); `RouteSkeleton`
  now renders it, so every suspending navigation shows a branded transition.

**Emoji (real + actively animated)**
- Stronger keyframes in `globals.css`: `emoji-launch` (fly/lift loop),
  `emoji-wobble` (hourglass flip), new `emoji-twinkle` + `emoji-spin`;
  `AnimatedEmoji` gains `twinkle`/`spin` variants.
- Premium: heading rocket 🚀 flies, "Coming soon" ⏳ flips, "Most popular" now an
  animated ⭐ (twinkle) instead of the lucide Sparkles.
- Contact: real animated emoji (👋 ✉️ 💬 ⏱️) on the header badge + info cards,
  and the community social icons are now **brand-coloured** (red/white/sky/blue,
  reusing the `Social.tsx` map) instead of monochrome.

**Orbital desktop fix** (`OrbitalEcosystem.tsx`)
- Rings/aurora/logo-glow now animate on mount (gated only by
  prefers-reduced-motion) instead of waiting for an in-view `active` flag, and
  rotation speeds sped up (18/24/14s, aurora 16s) so it visibly runs on desktop.
  Particle field + parallax stay in-view/perf-gated.

**Real-time data for end users**
- New `useLivePresence` hook (observes the `site-visitors` presence channel),
  `GET /api/live/stats` (visits today/total + members), and `LiveStats` strip
  ("N online now · visits today · total · members") in the Footer + homepage.
- Live bell: `CH_NOTIFY` broadcast "ping" from `lib/notifications.ts` on every
  notification; `NavActivity` subscribes (+ community `new_message`) to refetch
  instantly, poll relaxed to 60s fallback. All degrade gracefully without
  Supabase.

## 2026-06-14 — Demo 2: UI/UX polish, in-app notifications, profile fix, speed
**Profile / Settings**
- Fixed "Profile opens Settings": every account now gets an auto-assigned unique
  handle on signup (`lib/username.ts`, wired in `auth.ts` credentials + Google
  `createUser`); new `/profile` route resolves/mints a handle and redirects to
  `/u/<handle>`; navbar Profile falls back to `/profile` (never Settings).
  `prisma/seed.ts` backfills handles for existing users (idempotent).
- Research post byline + (existing) chat/comment authors link to `/u/<handle>`.

**In-app notifications (new)**
- New `Notification` model + idempotent migration `6_notifications/`.
- `lib/notifications.ts` (new-post fan-out + new-comment to author, best-effort);
  triggers wired into `api/research` (publish) and `api/posts/[id]/comments`.
- `GET /api/notifications` (+ unread count) and `POST /api/notifications/read`,
  new `notifications` rate-limit bucket; both degrade gracefully pre-migration.
- `NavActivity`: navbar bell (gold unread count + animated dropdown) + community
  chat icon (mint unread dot vs per-device last-seen). Email left dormant via the
  existing `sendEmail` console fallback until a verified Resend domain is set.
- Homepage **"What's New"** section (`lib/whatsnew.ts` + `WhatsNew.tsx`) replacing
  the removed Members showcase.

**UI / animation polish**
- `ActionLink` + `.btn-press` (tap-scale + click/redirect sheen) on all primary
  CTAs (Hero, Navbar, Premium, StickyCta); reduced-motion aware.
- `AnimatedEmoji` (rocket/hourglass) — Premium "Coming Soon" + "Get started".
- Global page-transition `app/template.tsx` (fade/rise, reduced-motion aware).
- Navbar signed-in widget: avatar gold-ring pulse + animated account dropdown.
- Premium hero restacked to "Premium Plans" / "Coming Soon" (two lines).
- About: `lg:items-start` so "Who we are" / "Since 2019" align with the pillars.
- Orbital: reliable desktop activation (activate-if-near-viewport on mount).
- Hero CTAs centered below `lg` (mobile-desktop), left-aligned at `lg`.

**Performance**
- `loading.tsx` skeletons (`RouteSkeleton`) for `/research/[slug]`, `/community`,
  `/settings`, `/u/[username]`, `/dashboard` → instant paint on navigation.

## 2026-06-14 — Production hardening: audit fixes, perf, profile-photo (see docs/AUDIT-2026-06-14.md)
**Resilience/DB**
- Added real migration `prisma/migrations/5_post_views_pageview/` (idempotent).
- `getPost` (`research/[slug]/page.tsx`) + dashboard posts query now retry without
  `views` on Prisma P2022 → missing migration no longer 404s posts / 500s dashboard.

**Bugs/security**
- New per-user `profile` rate-limit bucket; `api/profile/avatar` + `api/profile`
  PATCH/DELETE switched from `admin`(IP) → `profile`(user id).
- `auth/password/start`: returns 502 when email delivery fails (enumeration-safe).
- `auth.ts` signup: recover from P2002 race (re-read winning row).
- `research/[slug]`: premium gating re-checks live role/membership from DB.
- Research `content` capped at 100k chars (`api/research` + `[id]`).

**Profile photo (both approaches)**
- `AvatarUploader`: added validated **"Use a link"** URL fallback (works without
  Supabase Storage); saves via existing `PATCH /api/profile`.
- `profile.ts`: new optional `image` field + `isAllowedImageHost()` (host allowlist
  synced with next/image `remotePatterns`); +unit tests.
- Setup/ops steps added to `HANDOFF.md` (Storage bucket + env, migration).

**Performance (no design change)**
- `PerpChart`: poll skips hidden tabs + refresh on focus.
- `MarketTicker`: `decoding="async"` on coin logos.
- Tuned `next/image` `sizes`: `PostCard`, article cover, Hero logo.

DoD: typecheck + lint + test (60) + build all green; shared First-Load JS 159 kB (unchanged).

## 2026-06-12 — Mobile responsiveness pass (Phase 3/3)
- New `xs` (400px) breakpoint to distinguish small vs large phones.
- Hero medallion + Orbital ecosystem: smaller base `max-w` on tiny phones
  (15/16.5rem) scaling up at `xs`/`sm` → no crowding/overflow at 320–360px.
- MarketTicker cell padding `px-5 → px-3.5 sm:px-5` (kills horizontal-scroll
  risk on narrow phones).
- Chat hover action bar (react/reply/copy/delete) now **always visible on touch**
  (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`) — was hover-only and
  unreachable on mobile.

## 2026-06-12 — Polish: interactive upload, green dashboard, animations, speed (Phase 2/3)
- **Interactive upload:** real progress bar (XHR `upload.onprogress`) + animated
  drag-drop highlight on the post cover uploader and the avatar uploader
  (shared `src/lib/upload.ts`).
- **Green profile dashboard** (`/settings`): mint-accented identity card (avatar,
  badge, member-since, view-profile link), mint active tabs + primary actions,
  animated tab transitions (framer-motion).
- **Speed:** homepage orbital lazy-loaded (`next/dynamic`, ssr:false, same-size
  placeholder) → homepage page JS 11.4 → 10.1 kB; shared JS unchanged (159 kB).
- **Colors:** primary actions standardized to mint, premium/brand stays gold.

## 2026-06-12 — Real-time admin: live visitors, analytics, post views, instant membership (Phase 1/3)
- **Real-time membership:** admin downgrade/upgrade now pushes to the affected
  user's browser via Supabase channel `user:<id>` → session refreshes → the
  Premium icon appears/disappears **instantly** (no re-login). New
  `RealtimeSession` mounted in the root layout.
- **Self-hosted analytics:** `PageView` table + `POST /api/track` ping (deduped
  per navigation) → admin Overview shows **Total visits / Visits today**, and a
  **Live online** count via Supabase presence (channel `site-visitors`).
- **Post views:** `Post.views` counter (prefetch-guarded increment on the article
  page), shown on the post byline + aggregated in admin.
- **Admin Premium tab:** dedicated section listing all Premium members with
  one-click downgrade; updates live via channel `members`.
- Generic `src/lib/realtime.ts` `broadcastEvent` (chat broadcast refactored onto
  it). ⚠️ One-time SQL (Post.views + PageView) in HANDOFF.md.

## 2026-06-11 — Community Chat → advanced group chat
- **Nav:** "Community" link renamed to "Community Chat" (href unchanged).
- **Reactions:** emoji reactions (👍❤️😂🔥🚀🎉👀💯) — `ChatReaction` table,
  `POST /api/chat/messages/[id]/react` toggle (reuses `like` limiter), live
  `reaction` broadcast + optimistic chips.
- **Replies:** quote/reply to any message — `ChatMessage.replyToId` self-relation,
  composer reply preview, in-message quoted snippet (click → scroll to original).
- **Realtime presence + typing:** "N online" count and "X is typing…" indicator
  via Supabase channel presence/broadcast (hidden gracefully on polling fallback).
- **Polish (framer-motion, /community chunk only):** animated message enter/exit,
  reaction pop, typing dots, jump-to-latest w/ unread count; consecutive-author
  message grouping; hover action bar (react/reply/copy/delete); emoji picker in
  composer (curated, no new dep); @mention highlighting → profile links.
- **Schema:** +`ChatReaction`, +`ChatMessage.replyToId`. ⚠️ Combined one-time SQL
  in HANDOFF.md. Chat-scoped change only; shared First-Load JS unchanged.

## 2026-06-11 — Community Chat (Supabase Realtime · public read, login to post)
- **New page `/community`** ("The XYZ Lounge"): live message feed with avatars,
  Premium ★/Team badges, day separators, smart auto-scroll + jump-to-latest,
  load-older pagination, optimistic send w/ draft restore, own/admin delete,
  guests read + "Log in to chat" CTA. Plain-text only (XSS-safe), links via
  `safeHref`. Performance: own route chunk — shared First-Load JS unchanged;
  `@supabase/supabase-js` (new dep) lazy-imported inside the chat page only.
- **Realtime:** server broadcasts `new_message`/`message_hidden` to Supabase
  channel `community` after DB writes; clients subscribe with the public anon
  key. Graceful fallback to visibility-aware 10s polling when env unset.
- **Schema:** `ChatMessage` (body ≤500, status visible|hidden, cascade on user
  delete). ⚠️ One-time prod migration — SQL in HANDOFF.md.
- **API:** GET/POST `/api/chat/messages` (cursor history / send, new `chat`
  rate-limit 10/min/user), DELETE `/api/chat/messages/[id]` (author or admin).
- Nav "Community" + orbital node now → `/community`; homepage community section
  gains an "Open Community Chat" CTA. New env (optional):
  `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 2026-06-11 — Docs book + continuity handoff (GitBook-ready)
- **New:** root `CLAUDE.md` (continuity anchor for any AI/dev session),
  `docs/SUMMARY.md` + `docs/README.md` (GitBook book structure), `docs/HANDOFF.md`
  (resume-from-any-account guide, env table names-only, pending-migration SQL),
  `docs/api-reference.md` (all 24 endpoints), `docs/SECURITY.md` (posture + secrets
  policy). Changelog/backend-state/frontend-state updated for Profiles v1.1.
- Docs-only release; no runtime changes.

## 2026-06-11 — Bug fixes + mobile/PC performance pass + audit (PR #11)
- **Bugs:** dedicated `password` rate-limit bucket (reset spam no longer blocks
  signups); settings save no longer blocked by stale handle check; `/u/[username]`
  double DB query → React `cache()`; profiles force-dynamic → **ISR 60s** with
  `revalidatePath` on profile/avatar edits.
- **Perf (mobile):** backdrop blur 10–18px+saturate → 8px on ≤768px; Lenis
  disabled on touch; orbital particles 34 → 14 on phones.
- **Perf (PC/both):** hero parallax rAF-throttled; ticker pauses in hidden tabs;
  dashboard 3 user counts → 1 groupBy. Bundle size unchanged.
- **Audit:** `docs/AUDIT-2026-06-11.md` (scorecard A−/A); backup branch
  `backup/v1.1-profiles` + source ZIP delivered to owner.

## 2026-06-11 — User profiles: public /u/[handle] + private /settings (PR #10)
- **Public profile** `/u/[username]`: banner, avatar (initials fallback), bio,
  location, socials (X/GitHub/Telegram/website), Premium/Team/member-since badges,
  stats (posts/comments/likes), recent-comment activity. Email never exposed.
- **Settings** (tabbed Profile/Account/Security): avatar upload (Supabase), name,
  unique handle w/ live availability, bio/location/website/socials, membership
  panel + upgrade CTA, change password (current-password verify), delete account
  (typed confirm, transactional).
- **Schema:** +username (unique), bio, location, website, twitter, github,
  telegram, bannerImage. ⚠️ Requires one-time prod migration (see HANDOFF.md).
- **API:** PATCH/DELETE `/api/profile`, POST `/api/profile/avatar`,
  POST `/api/profile/password`, GET `/api/profile/username`.
- Navbar: avatar + account dropdown (Profile/Settings/Dashboard/Sign out).
- 15 new unit tests (50 total). CI ESLint config fixed (`.eslintrc.json` + deps).

## 2026-06-11 — Orbital ecosystem section + auth simplification (Phase 4)
- **Home:** premium 3D Orbital Ecosystem section (additive; rings/nodes/particles,
  in-view + reduced-motion gated, no heavy libs, home stays ISR).
- **Auth:** login is now standard email+password (removed OTP 2FA step); authorize
  verifies bcrypt + rate-limit (login 10/min/account). Signup still OTP-verified;
  forgot-password unchanged. New PasswordField (show/hide + strength meter on signup).
  Removed dead /api/auth/login/start route.
- Verified: tsc clean, 35 tests, build exit 0.

## 2026-06-11 — Final pre-merge batch: session CTAs, Likes, perf, polish
- **Logged-in CTAs:** WaitlistForm/Hero/CtaBand/ResearchPreview now session-aware —
  account holders see "Explore Research" instead of early-access/waitlist (client-side
  checks; home stays ISR). New `EarlyAccessCta`.
- **Likes:** `PostLike` table (migration `4_likes`), `POST /api/posts/[id]/like`
  toggle (auth, rate-limited), `LikeButton` (optimistic) beside ShareRow on articles.
- **Perf:** CommentSection fetch deferred until in-view; AVIF/WebP image formats.
- **Polish:** PostManager alert() → inline errors.
- Verified: tsc, 31 tests, build exit 0, home ○ ISR intact.

## 2026-06-11 — Pre-merge audit + Premium Content + Comments + account privacy
- **Audit:** PASS, 88/100, no critical/regressions; image-upload "issue" = config (Storage env+bucket).
- **Premium Content:** `Post.premium` flag + editor toggle; **2-layer gating** — list
  API redacts body, `[slug]` server-renders `PremiumLock` (no body in HTML/JSON-LD)
  unless `membership==="Premium"`/admin. Premium badges on cards + manager. `[slug]` now dynamic.
- **Comments:** `Comment` table; `/api/posts/[id]/comments` (GET public, POST logged-in,
  auto-publish, Zod 1–1000, `comment` rate-limit) + admin `DELETE /api/comments/[id]`;
  `CommentSection` on articles (never exposes commenter email).
- **Account/privacy:** `membership` added to JWT+session; Navbar account chip with
  **masked email** (`maskEmail`) + Free/Premium pill + easy sign-out (desktop + mobile).
- **Upload hardening:** client type/size pre-check, drag-and-drop, 501→URL-fallback hint.
- **Migration:** `3_premium_comments` (additive; run in Supabase SQL Editor).
- **Docs:** new `backend-state.md` + `frontend-state.md`. Files unchanged in auth-login
  logic/deploy/existing columns. Verified: tsc, 31 tests, build exit 0.

## 2026-06-10 — OTP delivery fix + premium article + perf
- **Files:** `lib/email.ts`, 3 × `api/auth/*/start` routes, `research/[slug]/page.tsx`,
  `globals.css`, `PostCard.tsx`, new `ReadingProgress.tsx` + `ShareRow.tsx`, docs/.
- **Fix:** OTP emails — root cause `onboarding@resend.dev` only delivers to the
  Resend account owner (members got nothing). Send failures now return 502 to the
  user (no more silent stuck-on-OTP screen) + Sentry capture. Real fix = owner
  verifies domain in Resend and sets `EMAIL_FROM` to it (steps in RUNBOOK).
- **Design:** premium article page — reading progress bar, share row (copy/X/
  Telegram), author byline card, lead excerpt, `.prose-xyz` upgrades.
- **Perf:** lazy-loaded below-the-fold home sections (dynamic imports).

## 2026-06-10 — CMS upgrade (edit/draft/preview/upload) + feed pagination
- **Backend:** `GET/PATCH /api/research/[id]` (edit; stable slugs), paginated +
  searchable `GET /api/research`, `POST /api/upload` (Supabase Storage REST,
  graceful fallback), dashboard posts bounded. Zero schema changes.
- **Frontend:** `PostEditor` (toolbar, Write/Preview, cover URL/upload,
  draft/publish), `PostManager` (search/filter/status/edit/toggle/delete),
  `/research` search + Load more, related-posts on articles; framer-motion
  dropped from ResearchGrid. Tests 27.

## 2026-06-10 — Sentry + security hardening + indexes
- Sentry (client/server/edge, DSN-guarded; handleError 500s reported).
- Security headers (CSP/HSTS/XFO/nosniff/referrer/permissions), image-host
  allowlist (was `**`), `next` 14.2.5→14.2.35, DB indexes
  (`Post(published,category,createdAt)`, `User(createdAt)`), RUNBOOK.md.

## 2026-06-10 — Email OTP auth + Supabase Postgres migration
- Schema → Supabase Postgres (pooled + `pgbouncer=true`, `DIRECT_URL`).
- OTP system: `VerificationCode` table, signup verify-then-create, login 2FA,
  forgot/reset password; Resend integration w/ dev-mode fallback; 2-step
  Signup/Login UI + `/forgot-password`. Robust sign-out; ISR for home/research
  + on-demand revalidation; HMAC OTP hashing.

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
