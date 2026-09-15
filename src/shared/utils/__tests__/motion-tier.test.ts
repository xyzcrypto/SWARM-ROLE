import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// The lite motion tier is a performance contract, and the kind that rots
// quietly: nothing breaks if a new ambient loop is added outside the gate, or
// if someone widens the gate until the brand identity disappears on half the
// phones that visit. Both failure modes look fine in review and only show up on
// a device nobody testing it owns.
//
// The measurement it exists for (homepage, 393x851, production build, median
// of five 2.5s samples):
//
//                                        @4x CPU     @6x CPU   on screen
//     no tier at all .................. 30.6 fps ... 19.1 fps ... 55
//     lite tier, Icons3D suppressed ... 55.5 fps ... 33.7 fps ... 17
//     lite tier as it stands now ...... 41.9 fps ... 26.0 fps ... 27
//
// The middle row is what the tier used to do. It is the fastest of the three
// and it is NOT what ships, because it bought those frames by switching off
// the `.i3d-*` system - which CLAUDE.md names as core brand identity and
// exempts from `prefers-reduced-motion` for that reason. Two motion policies
// contradicted each other and this one won silently, on every phone. See the
// "What stays" note in the lite-motion block in globals.css.
//
// Real source paths on purpose. `src/components/*` and `src/lib/*` are one-line
// re-export shims after the #203 reorganisation, so a test that READS one of
// those files matches nothing and passes while verifying nothing.
const css = readFileSync("src/app/globals.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const reveal = readFileSync("src/shared/components/Reveal.tsx", "utf8");

/** Comments out. Every file here documents itself heavily enough that leaving
 *  them in makes a test pass on its own prose - which is worse than no test. */
const strip = (s: string) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1 ").replace(/^\s*\/\/.*$/gm, " ");

/** Every flat `selector { body }` rule in the stylesheet.
 *
 *  Written as a scan rather than one regex on purpose: a global regex consumes
 *  the `}` that ends one rule, so the next rule loses the delimiter the pattern
 *  needs and is skipped. That silently dropped two of this file's four rules on
 *  the first attempt - and a contract test that quietly checks less than it
 *  claims is the only kind worse than none. */
function rules(source: string): { selectors: string; body: string }[] {
  const out: { selectors: string; body: string }[] = [];
  let cut = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "{") {
      const end = source.indexOf("}", i);
      if (end === -1) break;
      out.push({ selectors: source.slice(cut, i).trim(), body: source.slice(i + 1, end) });
      cut = end + 1;
      i = end;
    } else if (source[i] === "}") {
      cut = i + 1;
    }
  }
  return out;
}

/** Everything the `html.lite-motion` rules in globals.css mention. */
const liteRules = rules(strip(css)).filter((r) => r.selectors.includes("html.lite-motion"));

describe("the lite motion tier drops the ambient load", () => {
  it("gates every always-running ambient layer measured as costly", () => {
    const gated = liteRules
      .filter((r) => /animation\s*:\s*none/.test(r.body))
      .map((r) => r.selectors)
      .join("\n");
    // The mesh, the aurora, the particle drift, the starfield's animated stars,
    // the nebula haze, the celestial bodies and the assistant launcher's glow -
    // the always-running full-screen wash. This set is worth ~21 fps on the
    // measured device and is the whole reason the tier exists.
    for (const sel of [
      ".mesh::before",
      ".mesh::after",
      ".aurora",
      ".particle",
      ".starfield span.star-anim",
      ".starfield-neb",
      ".saturn",
      ".moon",
      ".hero-cta-halo",
      ".ai-fab",
      ".ai-fab-bot",
      ".mini-viz *",
      ".motion-decor",
    ]) {
      expect(gated, `${sel} is not in the lite-motion gate`).toContain(sel);
    }
  });

  it("keeps the brand motion a reader would name", () => {
    // The other half of the contract. These are identity, not decoration, and
    // the bisect priced them at roughly a frame per second between them - so
    // there is no performance argument for taking them, only a tidiness one.
    // The ticker is data that is moving, the shimmer and spinner are feedback,
    // and the shooting stars and the medallion's rings are the look itself.
    //
    // The `.i3d-*` entries moved into THIS list, from the gated one above. They
    // sit on the product and feature cards, so gating them is what "mobile me
    // product wala layout ka animation nahi hai" actually was - and CLAUDE.md
    // already classes the Icons3D system as identity rather than decoration.
    // It is not free: restoring them costs 13.6 fps at 4x CPU. It is bought
    // knowingly, and the reason it is affordable is that a large share of
    // phones were never on this tier at all (30.6 fps, top of file).
    const gated = liteRules.map((r) => r.selectors).join("\n");
    for (const sel of [
      ".marquee",
      ".text-shine",
      ".text-shimmer",
      ".star-shooter",
      ".shimmer",
      ".robot-eye",
      ".robot-antenna",
      ".i3d-bob",
      ".i3d-scan",
      ".i3d-pulse",
      ".i3d-tick",
      ".i3d-float",
      ".i3d-twinkle",
    ]) {
      expect(gated, `${sel} must not be gated by the lite motion tier`).not.toContain(sel);
    }
  });

  it("uses `!important`, because several of these carry an inline animation", () => {
    // The product visuals build `animation` from a loop index, so it lands in
    // the style attribute. An author `!important` declaration is the only thing
    // in the cascade that outranks an inline one - without it this whole block
    // is a no-op for `.mini-viz` and `.motion-decor`.
    const kills = liteRules.filter((r) => /animation\s*:\s*none/.test(r.body));
    expect(kills.length).toBeGreaterThan(0);
    for (const r of kills) expect(r.body).toMatch(/animation\s*:\s*none\s*!important/);
  });

  it("drops `will-change` on the layers it stopped", () => {
    // `will-change` holds a compositor layer alive. That is a good trade for
    // something moving every frame and pure memory for something that stopped -
    // and memory is exactly what the devices in this tier are short of.
    const released = liteRules.filter((r) => /will-change\s*:\s*auto/.test(r.body)).map((r) => r.selectors).join("\n");
    expect(released).toContain(".starfield span.star-anim");
    expect(released).toContain(".ai-fab");
  });
});

describe("the tier is decided before paint, from device capability", () => {
  it("sets the class in the same pre-paint script as the theme", () => {
    // A class on <html> written before paint is not a render input, so it can
    // never disagree with what the server sent. Deciding this in a component
    // instead is the React #418 hydration trap documented in CLAUDE.md.
    expect(layout).toMatch(/dangerouslySetInnerHTML/);
    expect(layout).toContain("lite-motion");
    expect(layout).toContain("saveData");
    // Device CLASS, not `deviceMemory` - see motion-detection.test.ts, which
    // owns that decision and the measurements behind it.
    expect(layout).toContain("Math.min(w,h)<600");
  });

  it("is NOT keyed on prefers-reduced-motion", () => {
    // Deliberate, and the single most likely thing for a later change to get
    // wrong. This project exempts its brand motion from that preference on
    // purpose; capability is a separate axis, and conflating them would undo
    // the exemption for everyone who has the preference set. Checked against
    // the emitted script rather than the file, whose comment explains the
    // decision and therefore names the very string being ruled out.
    expect(strip(layout)).not.toContain("prefers-reduced-motion");
    // And on the CSS side: no lite-tier rule may live INSIDE a reduced-motion
    // media block. Proximity in the file is fine and in fact deliberate - the
    // two motion policies are meant to be read together - so this walks the
    // at-rule's braces rather than measuring distance.
    const clean = strip(css);
    for (const at of [...clean.matchAll(/@media\s*\([^)]*prefers-reduced-motion[^)]*\)\s*\{/g)]) {
      let depth = 1;
      let i = at.index! + at[0].length;
      for (; i < clean.length && depth > 0; i++) {
        if (clean[i] === "{") depth++;
        else if (clean[i] === "}") depth--;
      }
      expect(clean.slice(at.index!, i)).not.toContain("lite-motion");
    }
  });

  it("honours a manual override, so the tier can be tested on a real device", () => {
    expect(layout).toMatch(/localStorage\.getItem\(['"]motion['"]\)/);
    expect(layout).toContain("'lite'");
    expect(layout).toContain("'full'");
  });
});

describe("the entrance system speaks one motion language", () => {
  it("defines exactly one spring, one tween and one stagger step", () => {
    // Reveal is used ~40 times across 19 files, so its presets ARE the site's
    // motion language. They used to carry five springs, two tweens, six travel
    // distances and three stagger steps between them.
    expect([...reveal.matchAll(/stiffness:/g)]).toHaveLength(1);
    expect([...reveal.matchAll(/duration:/g)]).toHaveLength(1);
    expect([...reveal.matchAll(/const STEP =/g)]).toHaveLength(1);
  });

  it("settles without bouncing", () => {
    // Damping ratio = damping / (2 * sqrt(stiffness * mass)). Below ~0.8 the
    // overshoot is visible as a bounce, which the brief for this pass ruled out
    // explicitly - the old `pop` preset sat at 0.61.
    const stiffness = Number(/stiffness:\s*(\d+)/.exec(reveal)?.[1]);
    const damping = Number(/damping:\s*(\d+)/.exec(reveal)?.[1]);
    const mass = Number(/mass:\s*([\d.]+)/.exec(reveal)?.[1]);
    const ratio = damping / (2 * Math.sqrt(stiffness * mass));
    expect(ratio).toBeGreaterThanOrEqual(0.85);
    expect(ratio).toBeLessThan(1.05);
  });

  it("keeps travel on a short ladder", () => {
    // 56px of travel on a 390px phone is a sixth of the screen, which reads as
    // sliding rather than settling. Nothing may travel further than 28px.
    const travel = [...reveal.matchAll(/[xy]:\s*-?(\d+)/g)].map((m) => Number(m[1]));
    expect(travel.length).toBeGreaterThan(0);
    expect(Math.max(...travel)).toBeLessThanOrEqual(28);
  });

  it("does not gate itself on framer-motion's useReducedMotion", () => {
    // It returns `null` on the server and the real media query on the client's
    // first render. That mismatch threw React #418 across every page of this
    // site once already; see CLAUDE.md. Comments stripped first - the file
    // documents the trap, so the raw text names the hook it must not call.
    expect(strip(reveal)).not.toContain("useReducedMotion");
  });
});
