/** @type {import('next').NextConfig} */
// Google Identity Services (popup flow) needs:
//   - script-src:  https://accounts.google.com + 'unsafe-eval'
//     (GIS internals eval(); without it the button silently fails)
//   - connect-src: https://*.googleapis.com (Drive/userinfo) +
//                  https://accounts.google.com (token endpoints) +
//                  https://oauth2.googleapis.com (token exchange)
//   - frame-src:   https://accounts.google.com (GIS internal iframe)
//   - form-action: https://accounts.google.com (OAuth consent submit)
//   - img-src:     https://*.googleusercontent.com (user avatar in consent)
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
  "connect-src 'self' https://*.googleapis.com https://accounts.google.com https://oauth2.googleapis.com",
  "img-src 'self' blob: data: https://*.googleusercontent.com",
  "style-src 'self' 'unsafe-inline'",
  "frame-src 'self' https://accounts.google.com",
  "form-action 'self' https://accounts.google.com",
  "base-uri 'self'",
].join("; ");

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
