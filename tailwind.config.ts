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
          DEFAULT: "#05060a",
          800: "#0a0c12",
          700: "#10131c",
          600: "#171b27",
        },
        gold: {
          50: "#fdf6e3",
          100: "#f9e9c0",
          200: "#f2d488",
          300: "#e9bd54",
          400: "#e0a82f",
          500: "#d4901c",
          600: "#b5740f",
          700: "#8a560d",
          800: "#5e3a0c",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      backgroundImage: {
        "gold-shine":
          "linear-gradient(135deg,#5e3a0c 0%,#d4901c 25%,#f2d488 50%,#fdf6e3 60%,#e0a82f 78%,#8a560d 100%)",
        "radial-fade":
          "radial-gradient(60% 60% at 50% 0%, rgba(224,168,47,0.18) 0%, rgba(5,6,10,0) 70%)",
      },
      boxShadow: {
        gold: "0 0 0 1px rgba(224,168,47,0.25), 0 20px 60px -20px rgba(224,168,47,0.35)",
        "gold-sm": "0 8px 30px -12px rgba(224,168,47,0.5)",
      },
      keyframes: {
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.6" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
      },
      animation: {
        "spin-slow": "spin-slow 26s linear infinite",
        "spin-rev": "spin-slow 34s linear infinite reverse",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite",
        "pulse-ring": "pulse-ring 3s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
