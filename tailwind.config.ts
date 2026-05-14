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
        // Cursorvers brand navy palette. navy-900 mirrors the viewport
        // themeColor in app/layout.tsx (#0a1a4a). Earlier scaffold shipped
        // without these so bg-navy-* classes were silently no-ops.
        navy: {
          950: "#050d29",
          900: "#0a1a4a",
          800: "#15265c",
          700: "#1f3370",
          600: "#2a4185",
        },
      },
    },
  },
  plugins: [],
};
export default config;
