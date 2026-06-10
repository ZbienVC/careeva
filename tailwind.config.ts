import type { Config } from "tailwindcss";

// ─── "Kiln" theme ─────────────────────────────────────────────────────────────
// Warm editorial palette: paper backgrounds, ink text, terracotta/brick primary,
// ochre + russet support, olive for success. The standard Tailwind color names
// are REMAPPED so the whole app (built on slate/blue/violet/cyan/emerald
// utilities) re-themes from this single token layer:
//   white  -> ink           (headings/overlays designed for dark bg flip to ink)
//   slate  -> warm browns   (inverted: 50 darkest text ... 950 paper surface)
//   blue   -> terracotta    (primary)
//   cyan   -> ochre         (gradient support)
//   violet -> russet clay   (secondary accent)
//   emerald-> olive         (success)
// Use `paper` for light text on colored fills (never `white`, which is now ink).

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        paper: "#faf5eb",
        ink: "#261c10",
        white: "#261c10",
        slate: {
          50: "#2b2114",
          100: "#382c1c",
          200: "#4a3b26",
          300: "#5a4a33",
          400: "#74614a",
          500: "#8d7a63",
          600: "#a89580",
          700: "#c2b29c",
          800: "#ddd0b9",
          900: "#ece2cf",
          950: "#f8f3e7",
        },
        blue: {
          50: "#fcf0e8",
          100: "#8a3210",
          200: "#7f2f10",
          300: "#b04a1e",
          400: "#c25c2a",
          500: "#c0501f",
          600: "#a63d17",
          700: "#8a3212",
          800: "#6e2810",
          900: "#511d0a",
          950: "#2f1106",
        },
        cyan: {
          50: "#fdf6e7",
          100: "#7c5a14",
          200: "#8a6517",
          300: "#c2891f",
          400: "#d99a3d",
          500: "#c8862a",
          600: "#a96f1f",
          700: "#8a5a18",
          800: "#6b4512",
          900: "#4c300c",
          950: "#2a1a06",
        },
        violet: {
          50: "#fbf1ea",
          100: "#7e3c14",
          200: "#743816",
          300: "#9c5024",
          400: "#a85a2e",
          500: "#91471d",
          600: "#7d3b17",
          700: "#683012",
          800: "#53250e",
          900: "#3d1b0a",
          950: "#241006",
        },
        emerald: {
          50: "#f3f6ea",
          100: "#3c5a2f",
          200: "#41622f",
          300: "#4e7338",
          400: "#557d3e",
          500: "#5f8a45",
          600: "#4f7539",
          700: "#41602f",
          800: "#334b25",
          900: "#25371b",
          950: "#16240f",
        },
        amber: {
          50: "#fdf7e6",
          100: "#6d4d10",
          200: "#7a5512",
          300: "#8f6314",
          400: "#a87413",
          500: "#b97f24",
          600: "#9a6a1e",
          700: "#7d5618",
          800: "#604212",
          900: "#442e0c",
          950: "#261a04",
        },
        red: {
          50: "#fcefec",
          100: "#8c2c1a",
          200: "#8c2f1d",
          300: "#a13422",
          400: "#b54231",
          500: "#c14a36",
          600: "#a93826",
          700: "#8c2d1e",
          800: "#6e2216",
          900: "#50180f",
          950: "#2b0c06",
        },
      },
      animation: {
        "fade-up": "fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        drift: "drift 18s ease-in-out infinite alternate",
        "drift-slow": "drift 26s ease-in-out infinite alternate-reverse",
        float: "float 6s ease-in-out infinite",
        marquee: "marquee 36s linear infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        drift: {
          from: { transform: "translate(0, 0) scale(1)" },
          to: { transform: "translate(60px, -40px) scale(1.15)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
