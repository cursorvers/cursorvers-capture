import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SWRegistry } from "./components/SWRegistry";

export const metadata: Metadata = {
  title: "Gdrive Uploader",
  description:
    "Auto-upload smartphone photos to a specified Google Drive folder",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased bg-neutral-950 text-neutral-50 min-h-screen">
        <SWRegistry />
        {children}
      </body>
    </html>
  );
}
