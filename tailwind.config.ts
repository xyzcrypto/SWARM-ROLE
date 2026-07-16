import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
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
        ink: {
          DEFAULT: "#08080a",
          950: "#050507",
          900: "#0a0a0d",
          800: "#0e0e12",
          700: "#15151b",
          600: "#1c1c24",
          500: "#26262f",
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
        hairline: "var(--hairline)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
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
      transitionTimingFunction: {
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
      },
      animation: {
        "spin-slow": "spin-slow 28s linear infinite",
        "spin-rev": "spin-slow 40s linear infinite reverse",
        float: "float 7s ease-in-out infinite",
        shine: "shine 5s linear infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.22,1,0.36,1) both",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
