/** @type {import('next').NextConfig} */
const csp =
  "default-src 'self'; connect-src 'self' https://*.googleapis.com https://accounts.google.com; img-src 'self' blob: data:; script-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline'";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: csp,
  },
  {
    // HSTS: force HTTPS for 2 years across subdomains; eligible for preload list
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Prevent MIME-type sniffing attacks on uploaded blobs and chunked responses
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Defense-in-depth against clickjacking; CSP frame-ancestors not used here
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Trim Referer header for cross-origin navigation (e.g. away from /privacy)
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Camera + microphone limited to same-origin (PWA capture + audio memo);
    // geolocation and payment explicitly denied so Permissions-Policy is
    // emitted rather than relying on browser defaults.
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), payment=()",
  },
];

const nextConfig = {
  output: 'standalone', // Added this line
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
