import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

// News, the bug pass. The theme here is the opposite of the markets one: not
// "the page shows something wrong", but "the page says it did something it did
// not do" - a bookmark that was refused, topics that never saved, a tap that
// promised to scroll and didn't, a swipe that promised the next story and
// stayed where it was.
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203, so reading one matches nothing and passes while
// verifying nothing.
const strip = (s: string) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");
const read = (p: string) => strip(readFileSync(p, "utf8"));
const N = read("src/modules/news/components/NewsClient.tsx");
const lock = read("src/shared/hooks/useScrollLock.ts");
const smooth = read("src/shared/components/SmoothScroll.tsx");

describe("a bookmark that failed does not stay filled in", () => {
  it("checks the response instead of discarding it", () => {
    // Was `.catch(() => {})` on both halves and no `res.ok` check at all, so a
    // save the server REFUSED looked exactly like one it accepted: the icon
    // filled in and stayed filled until the next reload, when the story was
    // simply gone. Refusal is not exotic - /api/news/saved shares the `like`
    // rate-limit bucket, so bookmarking a few stories quickly returns a 429
    // with a message, which the client threw away.
    expect(N).toMatch(/if \(!res\.ok\) \{[\s\S]{0,200}rollback\(/);
    expect(N).not.toMatch(/method: "DELETE" \}\)\.catch\(\(\) => \{\}\)/);
  });

  it("undoes only the story it touched", () => {
    // Restoring the whole array would let two toggles in flight clobber each
    // other: the slower one's rollback would erase the faster one's result.
    expect(N).toMatch(/const rollback = \(msg: string\) => \{/);
    expect(N).toMatch(/cur\.filter\(\(s\) => s\.id !== item\.id\)/);
  });

  it("says why", () => {
    expect(N).toMatch(/rollback\(j\?\.error \?\? \(exists \? "Couldn't remove that story\." : "Couldn't save that story\."\)\)/);
    expect(N).toMatch(/rollback\("You appear to be offline — nothing was saved\."\)/);
    // A state nobody renders is the same silence somewhere else.
    expect(N).toMatch(/\{saveErr && \(/);
  });

  it("rolls back a blocked localStorage write for guests too", () => {
    // Private mode / full quota. Keeping it on screen promises a bookmark that
    // is gone the moment the tab closes.
    expect(N).toMatch(/rollback\("Couldn't save on this device — storage is blocked or full\."\)/);
  });

  it("does not run the request inside a setState updater", () => {
    // A state updater must be pure - React is free to call it more than once
    // for a single update - and the POST, the DELETE and the localStorage write
    // were all inside one.
    expect(N).not.toMatch(/setSaved\(\(prev\) => \{[\s\S]{0,600}fetch\(/);
  });

  it("keeps the callback stable, so memoised cards do not all re-render", () => {
    // Reading `saved` from the closure instead would put it in the dep array,
    // giving `toggleSave` a new identity on every save - and it is passed to a
    // `memo`'d NewsCard for every story on screen.
    expect(N).toMatch(/const savedRef = useRef\(saved\)/);
    expect(N).toMatch(/\}, \[loggedIn\]\);/);
  });
});

describe("topics that failed to save do not look saved", () => {
  it("reverts and reports", () => {
    // Same shape: optimistic, `catch { /* best-effort */ }`, sheet closes. The
    // member's topics silently reverted on the next load.
    expect(N).toMatch(/setInterests\(before\);\s*setSaveErr\(j\?\.error \?\? "Couldn't save your topics — they're unchanged\."\)/);
    expect(N).toMatch(/setSaveErr\("You appear to be offline — your topics are unchanged\."\)/);
  });
});

describe("a scroll the reader asked for actually happens", () => {
  it("goes through the smooth-scroll engine, not window.scrollTo", () => {
    // Lenis owns the scroll position and rewrites it on its own rAF tick, so a
    // native scroll it did not initiate is undone a frame later. Both news call
    // sites - the "N new stories" pill and the token/source chips - were plain
    // `window.scrollTo({ behavior: "smooth" })`, so on desktop the one thing
    // each of them promised did not happen.
    expect(N).not.toMatch(/window\.scrollTo\(/);
    expect(N).toMatch(/scrollPageToSmooth\(0\)/);
  });

  it("does not run two eased scrolls at once", () => {
    // The instant helper can safely do both halves; an eased native scroll and
    // an eased Lenis scroll are two animations racing for one property.
    expect(lock).toMatch(/if \(smooth\) smooth\.smoothTo\(y\);\s*else window\.scrollTo\(\{ top: y, behavior: "smooth" \}\)/);
  });

  it("has no JS scroll engine to race with", () => {
    // Lenis was removed: with nothing registered, scrollPageToSmooth is a
    // native smooth scroll, the only scroller left.
    expect(smooth).not.toMatch(/new Lenis\(/);
  });
});

describe("swiping past the last story goes to the next one", () => {
  it("awaits the page and lands on it", () => {
    // It called `loadMore()` and returned the SAME id, so at every page
    // boundary the swipe (and the enabled chevron) landed on the story you were
    // already reading. You had to swipe again, after the page had quietly
    // arrived. The comment claimed "swipe traverses ALL news".
    expect(N).toMatch(/const next = \(await loadMore\(\)\)\.find\(inFeed\)/);
    expect(N).toMatch(/if \(next\) setReaderId\(next\.id\)/);
  });

  it("filters the new page by the feed's own rule", () => {
    // On "For You" a freshly loaded story may not be in this feed at all, and
    // navigating to one that is not on screen closes the reader.
    expect(N).toMatch(/const inFeed = useCallback\(/);
    expect(N).toMatch(/return items\.filter\(inFeed\)/);
  });

  it("loadMore reports what it appended, purely", () => {
    // Assigning to an outer variable from inside the updater would be both
    // impure and unreliable - the updater is not guaranteed to have run by the
    // time the function returns.
    expect(N).toMatch(/const loadMore = useCallback\(async \(\): Promise<NewsItem\[\]> =>/);
    expect(N).toMatch(/const seen = new Set\(itemsRef\.current\.map\(\(i\) => i\.id\)\)/);
    expect(N).not.toMatch(/setItems\(\(prev\) => \{[\s\S]{0,200}added = /);
  });

  it("says it is fetching, rather than doing nothing visible", () => {
    expect(N).toMatch(/disabled=\{!hasNext \|\| loadingNext\}/);
    expect(N).toMatch(/loadingNext \? <Loader2/);
  });

  it("is busy only when the READER is waiting, not on any background prefetch", () => {
    // Caught in the browser, not by reading: `loadingNext={loadingMore}` greys
    // out the chevron during every prefetch the infinite-scroll sentinel fires
    // - which is most of the time on a short list - so a next tap that could
    // have moved inside the already-loaded list did nothing at all. That is the
    // same bug this section is about, reintroduced by its own fix.
    expect(N).toMatch(/loadingNext=\{loadingMore && readerAt >= visible\.length - 1\}/);
    expect(N).not.toMatch(/loadingNext=\{loadingMore\}/);
  });
});

describe("a failed image is handled by React, not behind its back", () => {
  it("has no style mutations left in an error handler", () => {
    // Six of them, including one that hid `e.currentTarget.parentElement` - a
    // wrapper React owns and renders. Styles React does not know about can be
    // undone by the next render it does control.
    expect(N).not.toMatch(/onError=\{\(e\) =>/);
    expect(N).not.toMatch(/style\.display = "none"/);
  });

  it("uses state instead", () => {
    expect(N).toMatch(/function SafeImg\(/);
    // 0 = resized copy, 1 = original, 2 = gone: all in state.
    expect(N).toMatch(/if \(!src \|\| stage > 1\) return null/);
    // The card's hero has to take its wrapper with it - the wrapper carries the
    // negative margins that bleed the image to the card edge.
    expect(N).toMatch(/\{item\.image && !heroFailed &&/);
  });

  it("falls through to the gradient on the breaking hero", () => {
    // Hiding the <img> alone left a black rectangle where the no-image gradient
    // should have been.
    expect(N).toMatch(/function BreakingImage\(/);
    expect(N).toMatch(/if \(!src \|\| stage > 1\) return <div className="h-full w-full bg-gradient-to-br/);
  });
});

describe("returning to the tab costs one request, not two", () => {
  it("collapses visibilitychange and focus", () => {
    // Both fire when a tab comes forward, and both called `refresh()`. On a
    // phone, switching apps fires both every time. The 3s floor is the whole
    // gate here - news genuinely wants to refresh eagerly on return, so it
    // passes no minimum age.
    expect(N).toMatch(/wakeIsDue\(Date\.now\(\), lastRefreshAt\.current\)\) void refresh\(\)/);
    expect(N).toMatch(/lastRefreshAt\.current = Date\.now\(\)/);
  });
});

describe("the navbar badges do not leak an unhandled rejection", () => {
  // Found while browser-testing the news save above: the console carried an
  // uncaught `Error: dm unread 500`. Nothing to do with news - `NavActivity`'s
  // three loaders were changed to THROW rather than swallow (which is right,
  // it is how useLiveData knows to retry), and two call shapes around them were
  // never updated to match.
  const A = read("src/modules/notifications/components/NavActivity.tsx");

  it("waits for every loader instead of orphaning the losers", () => {
    // `Promise.all` settles on the FIRST rejection; the other rejected promises
    // have nobody to catch them. Reproduced with /api/notifications and
    // /api/dm/unread both returning 500 - which is what happens together when
    // the database is unreachable.
    expect(A).toMatch(/const results = await Promise\.allSettled\(jobs\)/);
    expect(A).toMatch(/if \(failed\) throw \(failed as PromiseRejectedResult\)\.reason/);
    expect(A).not.toMatch(/await Promise\.all\(\[load/);
  });

  it("does not fire a rejecting loader as a floating promise", () => {
    // `void loadNotes()` in a realtime broadcast handler is an uncaught error
    // the moment that loader throws, and there is no retry either. Routing
    // through useLiveData's `refresh` gets both.
    expect(A).not.toMatch(/void load(Notes|Chat|Dm)\(\)/);
    expect(A).not.toMatch(/useEffect\(\(\) => \{ loadDm\(\); \}/);
    expect(A).toMatch(/ch\.onBroadcast\("ping", \(\) => refreshAll\(\)\)/);
    expect(A).toMatch(/dm\.onBroadcast\("dm_message", \(\) => refreshBadges\(\)\)/);
  });
});

describe("dead weight", () => {
  it("does not import an icon it never renders", () => {
    expect(N).not.toMatch(/\bZap\b/);
  });

  it("CommunityPreview lives in the community module it belongs to", () => {
    // It renders only on /community and was filed under news/. A component in
    // the wrong module is how a module map stops being usable for finding
    // things.
    expect(existsSync("src/modules/community/components/CommunityPreview.tsx")).toBe(true);
    expect(existsSync("src/modules/news/components/CommunityPreview.tsx")).toBe(false);
    expect(readFileSync("src/components/CommunityPreview.tsx", "utf8"))
      .toMatch(/@modules\/community\/components\/CommunityPreview/);
  });
});
