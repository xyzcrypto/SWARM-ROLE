import type { Config } from "tailwindcss";

const config: Config = {
  // ONE glob over all of src, deliberately - not a list of directories.
  //
  // This was `./src/app/**` + `./src/components/**` only. When the module
  // refactor moved 223 files into src/modules, src/core and src/shared, Tailwind
  // stopped seeing the JSX that uses the classes: src/components still matched,
  // but those files had become two-line re-export shims containing no class
  // names at all. So the utilities were simply never generated - `fixed`,
  // `grid-cols-6` and `inset-x-0` had ZERO occurrences in the built CSS - and
  // every moved component silently lost its layout. The bottom nav collapsed
  // out of its fixed bar and stacked down the middle of the page.
  //
  // Nothing failed: typecheck, lint, tests, build and the route table were all
  // green, because none of them look at generated CSS. Enumerating directories
  // here means any future move re-breaks this the same silent way, so don't.
  //
  // ⚠️ Test files are EXCLUDED, and must stay excluded. Tailwind's scanner
  // reads every file here as plain text and turns anything that looks like a
  // class into CSS - including regex literals in tests. A test asserting
  // `/\[@media\(hover:none\)\]:h-11/` produced the "class"
  // `[@media\(hover:none\)\]:h-11`, which Tailwind compiled into the invalid
  // at-rule `@media\(hover:none\)\undefined { ... }`. That printed
  // "Parsing CSS source code failed" on every build from #363 onward. Tests are
  // never rendered, so nothing a page uses can live only in one.
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "!./src/**/__tests__/**",
    "!./src/**/*.test.{js,ts,jsx,tsx}",
  ],
  future: {
    // Wraps every `hover:` utility in `@media (hover: hover)`, so hover styles
    // apply only where a pointer can actually hover.
    //
    // Without it, a tap on a phone applies `:hover` and LEAVES IT APPLIED until
    // you tap something else - so one card sits lifted and lit up while you read
    // the page, which reads as a rendering glitch rather than a hover state.
    // globals.css already hand-scoped `.surface-hover` and `.lift` for exactly
    // this reason; the ~200 Tailwind `hover:` utilities were never covered, and
    // the built CSS contained precisely one `@media (hover: hover)` - the
    // hand-written one.
    //
    // The other half of the fix is `active:` twins: with this flag a touch
    // device gets NO hover feedback at all, so anything that said "you picked
    // this one" through hover alone needs a press equivalent. Those were added
    // alongside this change - see touch-parity.test.ts, which holds the two
    // halves together.
    //
    // ⚠️ Before turning this on, every `hover:` that gates VISIBILITY or
    // REACHABILITY has to have a touch path, or the flag hides a feature from
    // phones instead of fixing one. All ten were audited; the only genuine gap
    // was the conversation options button in MessagesClient, fixed in the same
    // pass. Check that list again before adding a new `group-hover:opacity-100`.
    hoverOnlyWhenSupported: true,
  },
  // Class-based theming (light/dark). Dark is the default (see <html class="dark">).
  darkMode: "class",
  theme: {
    extend: {
      // Extra breakpoint for small/large phone distinction (default sm = 640px).
      screens: {
        xs: "400px",
      },
      colors: {
        // Base surfaces — near-black with cool depth (Vercel/Hyperliquid)
        // Dark elevation ladder. This scale is what real components reach for -
        // `bg-ink-900` (42 usages), `bg-ink-950` (49), `bg-ink-800` (11) - and it
        // is DARK-ONLY in effect, because the light theme already remaps every
        // `bg-ink-*` class onto its semantic surface tokens.
        //
        // The low end was compressed almost flat against the #08080a page, which
        // is why dark cards looked as undefined as light ones did. Measured from
        // rendered pixels, the homepage stat card (`bg-ink-900/90`) sat just
        // +0.82 L* above the ground - below the ~1 threshold where the eye can
        // separate two surfaces at all. Fixing `.surface`/`.glass` did nothing
        // for it, because that card never touches those primitives.
        //
        //   ink-900  +0.57 -> +2.60 L*   (the common card)
        //   ink-800  +1.84 -> +5.75 L*   (raised card / hover)
        //   ink-700  +4.77 -> +9.80 L*   (popovers, menus)
        //
        // Each step is now clearly above the one below it instead of three of
        // them crowding into the first 2 L*. Still very dark greys - the brand
        // stays dark luxe - they are just distinguishable now.
        // Second raise. The first one took ink-900 from +0.57 to +2.60 L* above
        // the page, which moved it from "invisible" to "subtle" but left dark at
        // roughly half the separation the light theme got (+5.28). Subtle was
        // still being read as "nothing changed", and on a default-dark site that
        // is the only impression most visitors form. Matching the bands:
        //
        //   ink-900  +0.57 -> +4.73 L*   (the common card, 42 usages)
        //   ink-800  +1.84 -> +8.77 L*   (raised card / hover, 11)
        //   ink-700  +4.77 -> +12.7 L*   (popovers, menus)
        //
        // These are still very dark greys - #15151a is not a light surface - so
        // the dark-luxe direction holds. What changes is that a card now has an
        // edge you can see without hunting for its border.
        ink: {
          DEFAULT: "#08080a",
          950: "#050507",
          900: "#15151a",
          800: "#1d1d23",
          700: "#25252c",
          600: "#2e2e37",
          500: "#3a3a44",
        },
        // Brand gold — premium / identity
        gold: {
          50: "#fdf7e7",
          100: "#faecc4",
          200: "#f3d488",
          300: "#ebbd52",
          400: "#e2a72f",
          500: "#d18f1b",
          600: "#ad6f10",
          700: "#824f0e",
          800: "#56340b",
        },
        // Mint — primary action accent (from the TradeKaroVerse bull)
        mint: {
          50: "#e9fdf4",
          100: "#c8fbe3",
          200: "#92f5cb",
          300: "#54e8ad",
          400: "#22d692",
          500: "#0bbb7c",
          600: "#039567",
          700: "#057653",
          800: "#085d43",
        },
        line: {
          DEFAULT: "rgba(255,255,255,0.08)",
          soft: "rgba(255,255,255,0.05)",
          strong: "rgba(255,255,255,0.14)",
          gold: "rgba(226,167,47,0.22)",
        },
        // Semantic, theme-aware tokens (resolve via CSS vars per light/dark).
        // Components adopt these incrementally; brand gold/mint stay constant.
        base: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        content: "var(--content)",
        "content-muted": "var(--content-muted)",
        // Third text tier for 9-12px labels, legal lines and timestamps. Prefer
        // this over reaching further down the zinc ramp: zinc-600/700 were the
        // classes carrying that copy, and they measured under AA in BOTH themes.
        "content-subtle": "var(--content-subtle)",
        hairline: "var(--hairline)",
        // Market direction, theme-aware because no single step of either scale
        // clears AA on both grounds (mint-400 is 1.78:1 on light; red-600 is
        // 4.14:1 on dark). Use these for up/down numbers rather than
        // text-mint-*/text-red-* so new UI is readable in both themes.
        "data-up": "var(--data-up)",
        "data-down": "var(--data-down)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Refined display ramp
        "display-xl": ["clamp(1.95rem,6.2vw,6rem)", { lineHeight: "1.06", letterSpacing: "-0.03em" }],
        "display-lg": ["clamp(1.85rem,6vw,3.75rem)", { lineHeight: "1.08", letterSpacing: "-0.025em" }],
        "display-md": ["clamp(1.6rem,4.5vw,2.6rem)", { lineHeight: "1.12", letterSpacing: "-0.02em" }],
      },
      maxWidth: {
        container: "1200px",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      // Shared motion tokens (design system) - additive.
      //
      // DEFAULT is the one that changes the site: Tailwind's own default for a
      // bare `transition-*` is `cubic-bezier(0.4, 0, 0.2, 1)` (ease-in-out),
      // which accelerates INTO the change and reads as slightly sluggish on a
      // hover. Every hand-written easing in this codebase already converged on
      // the decelerating `0.22, 1, 0.36, 1` curve (12 uses in globals.css, 6 in
      // framer variants), so pointing DEFAULT at it makes the ~40 bare
      // `transition-colors` / `transition-all` utilities agree with the
      // primitives instead of quietly disagreeing with them. Durations are
      // untouched - this is a curve change only.
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.22, 1, 0.36, 1)",
        premium: "cubic-bezier(0.22, 1, 0.36, 1)",
        "premium-in": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        "250": "250ms",
        "400": "400ms",
      },
      backgroundImage: {
        "gold-shine":
          "linear-gradient(135deg,#824f0e 0%,#d18f1b 28%,#f3d488 52%,#fdf7e7 62%,#e2a72f 80%,#ad6f10 100%)",
        "mint-shine": "linear-gradient(135deg,#0bbb7c 0%,#22d692 50%,#54e8ad 100%)",
      },
      boxShadow: {
        gold: "0 0 0 1px rgba(226,167,47,0.2), 0 24px 70px -24px rgba(226,167,47,0.4)",
        "gold-sm": "0 10px 34px -14px rgba(226,167,47,0.5)",
        mint: "0 10px 34px -12px rgba(11,187,124,0.45)",
        elevate: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -28px rgba(0,0,0,0.8)",
      },
      keyframes: {
        "spin-slow": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-12px)" } },
        shine: { to: { backgroundPosition: "200% center" } },
        "fade-up": { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "border-beam": { "100%": { "offset-distance": "100%" } },
        "pulse-dot": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.35" } },

        /**
         * The strong set - deliberately further than `fade-up`.
         *
         * `fade-up` is 16px and a fade, which reads as "the page settled". The
         * brief asked for motion a reader actually FEELS, so `rise-in` carries a
         * scale as well as a longer travel: the card grows into place instead of
         * sliding. Scale is what makes an entrance feel physical, and it is also
         * why this is not simply `fade-up` with a bigger number.
         *
         * ⚠️ Motion, not glow. The design system's warning is that this palette
         * drifts from restrained to cheap through stacked `blur-3xl` orbs, so
         * the strength here is bought with movement and timing - none of these
         * add a light source.
         */
        "rise-in": {
          from: { opacity: "0", transform: "translateY(28px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        /** For a number or badge that should land rather than appear. */
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.82)" },
          "60%": { opacity: "1", transform: "scale(1.04)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        /** A single sheen crossing a surface - one pass, on demand, not a loop. */
        "sweep-x": {
          from: { transform: "translateX(-120%)" },
          to: { transform: "translateX(220%)" },
        },
        /** A breathing ring for anything genuinely live. */
        "glow-breathe": {
          "0%,100%": { opacity: "0.45", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.08)" },
        },
      },
      animation: {
        "spin-slow": "spin-slow 28s linear infinite",
        "spin-rev": "spin-slow 40s linear infinite reverse",
        float: "float 7s ease-in-out infinite",
        shine: "shine 5s linear infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.22,1,0.36,1) both",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "rise-in": "rise-in 0.62s cubic-bezier(0.16,1,0.3,1) both",
        "pop-in": "pop-in 0.42s cubic-bezier(0.34,1.56,0.64,1) both",
        "sweep-x": "sweep-x 1.1s cubic-bezier(0.22,1,0.36,1)",
        "glow-breathe": "glow-breathe 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
