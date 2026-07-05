import "./globals.css";

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Cursorvers Capture",
  description:
    "撮影した写真を Google Drive のフォルダに直接保存する Cursorvers の実験的 PWA。",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

import { SWRegistry } from "./components/SWRegistry";
import { RootErrorBoundary } from "./components/RootErrorBoundary";
import { Header } from "./components/Header";
import { OnlineStatusBanner } from "./components/OnlineStatusBanner";
import { Footer } from "./components/Footer";
import { TrialExpiryBanner } from "./components/TrialExpiryBanner";

const preferenceScript = `
(function () {
  try {
    var themeKey = "cursorvers_theme";
    var textSizeKey = "cursorvers_text_size";
    var themePref = localStorage.getItem(themeKey) || "dark";
    if (themePref !== "dark" && themePref !== "light" && themePref !== "system") themePref = "dark";
    var systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = themePref === "system" ? (systemDark ? "dark" : "light") : themePref;
    var root = document.documentElement;
    root.classList.remove("theme-dark", "theme-light");
    root.classList.add("theme-" + theme);
    root.dataset.theme = theme;
    root.dataset.themePreference = themePref;
    var textSize = localStorage.getItem(textSizeKey) || "standard";
    var sizes = { standard: "100%", large: "120%", xlarge: "140%" };
    root.style.fontSize = sizes[textSize] || sizes.standard;
    root.dataset.textSize = sizes[textSize] ? textSize : "standard";
    var themeColor = theme === "dark" ? "#0b0d12" : "#f6f7fb";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", themeColor);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="theme-dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: preferenceScript }}
        />
        {/*
          Google Identity Services preload. Loading the script here rather
          than lazily inside gis.loadGisScript() removes the await chain
          between the user's click and the OAuth popup — iOS Safari treats
          a popup that arrives after async hops as non-user-initiated and
          blocks it.
        */}
        <script async src="https://accounts.google.com/gsi/client" />
      </head>
      <body className="flex min-h-screen flex-col bg-ink-900 font-sans text-ink-100 antialiased">
        <RootErrorBoundary>
          <SWRegistry />
          <Header />
          <OnlineStatusBanner />
          <TrialExpiryBanner />
          <main className="flex-grow">{children}</main>
          <Footer />
        </RootErrorBoundary>
      </body>
    </html>
  );
}
