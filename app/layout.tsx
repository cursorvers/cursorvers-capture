import type { Metadata, Viewport } from "next";


export const metadata: Metadata = {
  title: "Cursorvers Receipt — レシート共有 PWA",
  description:
    "Cursorvers 顧問先専用、税理士と Google Drive でレシートをシェア",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
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
      <body className="antialiased min-h-screen flex flex-col">
        <SWRegistry />
        <Header />
        <main className="flex-grow">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
