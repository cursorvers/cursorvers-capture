/** @type {import('next').NextConfig} */
// Cloudflare Pages static export. Security headers live in public/_headers
// (CF Pages reads that file). Image optimization is disabled because the
// 'export' output mode does not run the Next.js image server.
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
