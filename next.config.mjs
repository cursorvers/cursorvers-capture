/** @type {import('next').NextConfig} */
const csp =
  "default-src 'self'; connect-src 'self' https://*.googleapis.com https://accounts.google.com; img-src 'self' blob: data:; script-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline'";

const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
