import type { NextConfig } from "next";

/**
 * Security headers on every response.
 * - Referrer-Policy no-referrer: report links carry a token in the URL, so no
 *   page ever passes its address on to another site.
 * - frame-ancestors none and X-Frame-Options: no one can frame the portal to
 *   trick a patient into tapping something.
 * - nosniff, a strict permissions policy, and HSTS in production.
 */
const securityHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Do not tell visitors which framework serves the site.
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Report pages and links are private: never stored by a shared cache.
      {
        source: "/(file|r|desk|me)/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
