import type { NextConfig } from "next";
import { withEve } from "eve/next";

// Conservative security headers. (HSTS is added by Vercel. A Content-Security-Policy needs per-site tuning for
// Next's inline scripts and is intentionally not set here yet.)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Skip repeating codegen-time typechecking on every deployment build.
  typescript: { ignoreBuildErrors: true },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withEve(nextConfig);
