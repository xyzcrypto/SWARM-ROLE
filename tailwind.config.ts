import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#030408",
          950:     "#000000",
          900:     "#030408",
          800:     "#07080f",
          700:     "#0e1018",
          600:     "#151822",
        },
        gold: {
          50:  "#fdf6e3",
          100: "#f9e0a8",
          200: "#f7c948",
          300: "#e9bd54",
          400: "#e9a020",
          500: "#c97f10",
          600: "#a06210",
          700: "#7a480c",
          800: "#5e3a0c",
        },
      },
      fontFamily: {
        sans:    ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono:    ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "gold-shine":
          "linear-gradient(135deg,#5e3a0c 0%,#c97f10 25%,#f7c948 50%,#fdf6e3 60%,#e9a020 78%,#7a480c 100%)",
        "radial-fade":
          "radial-gradient(70% 65% at 50% 0%, rgba(233,160,32,0.18) 0%, rgba(0,0,0,0) 75%)",
        "radial-fade-mid":
          "radial-gradient(55% 55% at 50% 50%, rgba(233,160,32,0.10) 0%, rgba(0,0,0,0) 100%)",
      },
      boxShadow: {
        gold:      "0 0 0 1px rgba(233,160,32,0.20), 0 20px 60px -20px rgba(233,160,32,0.40)",
        "gold-sm": "0 8px 32px -12px rgba(233,160,32,0.55)",
        "gold-lg": "0 32px 80px -24px rgba(233,160,32,0.48)",
        "gold-xl": "0 48px 120px -32px rgba(233,160,32,0.55)",
      },
      keyframes: {
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to:   { transform: "rotate(360deg)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%":     { transform: "translateY(-16px)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition:  "200% 0" },
        },
        "pulse-ring": {
          "0%":   { transform: "scale(0.88)", opacity: "0.7" },
          "100%": { transform: "scale(1.72)", opacity: "0" },
        },
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "glow-pulse": {
          "0%,100%": { boxShadow: "0 0 20px -8px rgba(233,160,32,0.35), 0 0 0 1px rgba(233,160,32,0.28)" },
          "50%":     { boxShadow: "0 0 50px -8px rgba(233,160,32,0.75), 0 0 0 1px rgba(233,160,32,0.65)" },
        },
        "scan-line": {
          "0%":   { backgroundPosition: "-100% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "float-particle": {
          "0%,100%": { transform: "translateY(0px) translateX(0px)", opacity: "0.5" },
          "33%":     { transform: "translateY(-12px) translateX(6px)", opacity: "0.8" },
          "66%":     { transform: "translateY(-6px) translateX(-8px)", opacity: "0.4" },
        },
        "border-flow": {
          "0%":   { backgroundPosition: "0% 50%" },
          "50%":  { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "text-reveal": {
          "0%":   { transform: "translateY(110%)" },
          "100%": { transform: "translateY(0%)" },
        },
      },
      animation: {
        "spin-slow":      "spin-slow 30s linear infinite",
        "spin-rev":       "spin-slow 40s linear infinite reverse",
        float:            "float 8s ease-in-out infinite",
        shimmer:          "shimmer 6s linear infinite",
        "pulse-ring":     "pulse-ring 3.5s ease-out infinite",
        "fade-up":        "fade-up 0.65s ease forwards",
        "fade-in":        "fade-in 0.5s ease forwards",
        "glow-pulse":     "glow-pulse 3s ease-in-out infinite",
        "scan-line":      "scan-line 4s linear infinite",
        "float-particle": "float-particle 6s ease-in-out infinite",
        "border-flow":    "border-flow 5s ease infinite",
      },
    },
  },
  plugins: [],
};

export default config;
