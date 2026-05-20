import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Cursorvers brand navy — kept for accent surfaces and theme-color.
        navy: {
          950: "#050d29",
          900: "#0a1a4a",
          800: "#15265c",
          700: "#1f3370",
          600: "#2a4185",
        },
        // Near-black neutral scale used as the base canvas (Linear/Vercel style).
        ink: {
          50: "#f5f6f8",
          100: "#e6e8ee",
          200: "#c5cad6",
          300: "#9ba2b3",
          400: "#737a8c",
          500: "#525868",
          600: "#363b48",
          700: "#23262e",
          800: "#14161b",
          900: "#0b0d12",
          950: "#06070a",
        },
        accent: {
          DEFAULT: "#f97316",
          soft: "#fb923c",
          dim: "#c2410c",
        },
      },
      boxShadow: {
        ambient:
          "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 8px 24px -8px rgba(0,0,0,0.6)",
        glow: "0 0 32px -4px rgba(249,115,22,0.4)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.5)",
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(10,26,74,0.55) 0%, transparent 60%)",
        "accent-grad":
          "linear-gradient(180deg, #fb923c 0%, #f97316 40%, #ea580c 100%)",
      },
      fontFamily: {
        display: [
          '"SF Pro Display"',
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        sans: [
          '"SF Pro Text"',
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
    },
  },
  plugins: [],
};
export default config;
