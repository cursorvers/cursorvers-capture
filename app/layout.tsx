import "./globals.css";

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Cursorvers Capture",
  description:
    "撮影した写真を Google Drive のフォルダに直接保存する Cursorvers の実験的 PWA。",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0a1a4a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

import { SWRegistry } from "./components/SWRegistry";
import { Header } from "./components/Header";
import { OnlineStatusBanner } from "./components/OnlineStatusBanner";
import { Footer } from "./components/Footer";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="flex min-h-screen flex-col bg-ink-900 font-sans text-ink-100 antialiased">
        <SWRegistry />
        <Header />
        <OnlineStatusBanner />
        <main className="flex-grow">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
