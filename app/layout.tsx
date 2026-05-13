import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Cursorvers Capture",
  description:
    "モバイルでレシートを撮影し、Google Drive のフォルダへ保存する Cursorvers の実験的 PWA。",
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
import { Footer } from "./components/Footer";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="flex min-h-screen flex-col bg-navy-900 antialiased text-gray-100">
        <SWRegistry />
        <Header />
        <main className="flex-grow">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
