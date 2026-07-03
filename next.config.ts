import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Applied to every response by headers() below. The dead `env:{AUTH_SECRET,...}`
// block was removed — it force-inlined those values into the client bundle, and
// NextAuth is gone (nothing reads them).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Pin HTTPS in production only (don't HSTS-pin localhost).
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
  // CSP starts in Report-Only so a wrong host can't break Plaid Link / Supabase
  // in production. After confirming no violations, rename the key to
  // "Content-Security-Policy" to enforce.
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plaid.com",
      "style-src 'self' 'unsafe-inline'",
      // Merchant/subscription logos come from Google's favicon service, which
      // serves from www.google.com and *.gstatic.com.
      "img-src 'self' data: blob: https://*.plaid.com https://www.google.com https://*.gstatic.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://*.plaid.com",
      "frame-src https://*.plaid.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  experimental: {
    // Client-cache dynamic page segments for 30s, so hopping back and forth in
    // the sidebar reuses the last render instead of a new server round-trip.
    // Mutations still show fresh data: the modals call router.refresh() on
    // success, which purges this cache.
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
