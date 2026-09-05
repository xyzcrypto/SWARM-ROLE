import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Two things in the news reader.
//
// 1. **The open story could change under you mid-read.** It was tracked as an
//    INDEX into `visible`, and the 90s poll PREPENDS fresh stories whenever the
//    reader is near the top of the feed. Every index shifts by however many
//    arrived - so a reader with story 5 open was silently moved to a different
//    article, and `onBookmark`, which read `visible[readerIndex]`, saved the
//    wrong story.
//
// 2. **The swipe gesture was undiscoverable and gave no feedback.** touchstart
//    plus touchend and nothing in between: the story did not follow your
//    finger, there was no rubber-band, no way to change your mind mid-gesture.
//    The only affordance was `swipe ‹ ›` at 10px in `text-zinc-600` on a
//    near-black panel - in the DOM, invisible in practice.
//
// Verified in a browser at 390x844 with the feed stubbed (RSS is unreachable
// from CI):
//
//     card opened -> hint visible, 2 arrows animating, counter "3 / 8"
//     swipe left  -> "Story number 3", counter "4 / 8", hint gone, flag stored
//
// Real source paths on purpose: `src/components/*` and `src/lib/*` are
// re-export shims after #203.
const news = readFileSync("src/modules/news/components/NewsClient.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const N = strip(news);

describe("the open story cannot change under the reader", () => {
  it("tracks the story by id, never by index", () => {
    expect(N).toMatch(/const \[readerId, setReaderId\] = useState<string \| null>\(null\)/);
    expect(N).not.toContain("setReaderIndex");
    expect(N).not.toMatch(/visible\[readerIndex\]/);
  });

  it("derives the position from the current list", () => {
    expect(N).toMatch(/const readerAt = readerId \? visible\.findIndex\(\(v\) => v\.id === readerId\) : -1/);
    expect(N).toMatch(/const readerItem = readerAt >= 0 \? visible\[readerAt\] : null/);
  });

  it("bookmarks the story that is actually open", () => {
    // This is the half that silently saved the wrong article.
    expect(N).toMatch(/onBookmark=\{\(\) => toggleSave\(readerItem\)\}/);
    expect(N).toMatch(/bookmarked=\{savedUrls\.has\(readerItem\.id\)\}/);
  });

  it("resolves prev/next from the list at the moment of the tap", () => {
    expect(N).toMatch(/onPrev=\{\(\) => setReaderId\(\(id\) => \{[\s\S]{0,200}visible\.findIndex/);
    expect(N).toMatch(/onNext=\{\(\) => setReaderId\(\(id\) => \{[\s\S]{0,320}visible\.findIndex/);
  });

  it("opens by id from both the grid and the hero", () => {
    // One callback for both, because a card already knows which story it is -
    // passing an index would need the current list to resolve it, which is the
    // bug above in another shape.
    expect(N).toMatch(/const openReader = useCallback\(\(id: string\) => setReaderId\(id\), \[\]\)/);
    expect(N).toMatch(/onOpen: \(id: string\) => void/);
    expect(N).not.toContain("openById");
  });
});

describe("the swipe follows your finger and says it exists", () => {
  it("tracks the drag live", () => {
    expect(N).toContain("onTouchMove={onTouchMove}");
    expect(N).toMatch(/const onTouchMove = \(e: ReactTouchEvent\)/);
    expect(N).toMatch(/transform: drag \? `translateX\(\$\{drag\}px\)`/);
  });

  it("claims the gesture only once it is clearly horizontal, then keeps it", () => {
    // Otherwise a normal vertical read gets hijacked, and a slightly diagonal
    // swipe flickers between scrolling and dragging.
    expect(N).toMatch(/if \(Math\.abs\(dx\) < 12 \|\| Math\.abs\(dx\) < Math\.abs\(dy\) \* 1\.2\) return;/);
    expect(N).toMatch(/dragging\.current = true;/);
  });

  it("resists at the ends instead of moving freely", () => {
    // It moves, so the gesture is acknowledged; it moves badly, which is how a
    // phone says there is nothing that way.
    expect(N).toMatch(/const blocked = \(dx < 0 && !hasNext\) \|\| \(dx > 0 && !hasPrev\)/);
    expect(N).toMatch(/setDrag\(blocked \? dx \* 0\.25 : dx\)/);
  });

  it("replaces the invisible label with something readable", () => {
    expect(N).not.toContain("swipe ‹ ›");
    expect(N).toMatch(/\{position\} \/ \{total\}/);
  });

  it("shows an animated coach mark, once", () => {
    expect(N).toContain("news-swipe-hint");
    expect(css).toMatch(/@keyframes news-swipe-left/);
    expect(css).toMatch(/@keyframes news-swipe-right/);
    // Compositor-only, so it costs nothing on the phones it exists for.
    const block = /@keyframes news-swipe-left \{[\s\S]*?\n\}/.exec(css)?.[0] ?? "";
    expect(block).not.toBe("");
    expect(block).not.toMatch(/box-shadow|filter|background|width|height/);
  });

  it("dismisses the hint when the gesture STARTS, not when it commits", () => {
    // A cancelled swipe still proves the reader knows the gesture is there.
    expect(N).toMatch(/dragging\.current = true;[\s\S]{0,160}if \(showSwipeHint\) dismissSwipeHint\(\)/);
    expect(N).toMatch(/localStorage\.setItem\(SWIPE_HINT_KEY, "1"\)/);
  });

  it("reads the dismissal flag without a hydration mismatch", () => {
    // Safe as a lazy initialiser HERE because the reader only mounts on a tap,
    // i.e. always after hydration. In a server-rendered component this exact
    // pattern is the React #418 trap in CLAUDE.md.
    expect(N).toMatch(/useState\(\(\) => \{[\s\S]{0,400}typeof window === "undefined"\) return false;/);
  });

  it("gives up the hint quietly when storage is unavailable", () => {
    expect(N).toMatch(/catch \{[\s\S]{0,120}return false;/);
  });
});

describe("token chips do something", () => {
  it("are buttons that search, not inert spans", () => {
    expect(N).toMatch(/onClick=\{\(e\) => \{ e\.stopPropagation\(\); onToken\(t\); \}\}/);
    expect(N).toMatch(/const searchToken = useCallback\(\(t: string\) => \{[\s\S]{0,200}setRawQuery\(t\)/);
  });

  it("reuses the search box rather than adding a hidden filter", () => {
    // The search box already shows what the feed is narrowed by and can be
    // cleared; a separate token filter would be a state with no visible undo.
    expect(N).toMatch(/searchToken[\s\S]{0,200}setCategory\("All"\)/);
  });
});
