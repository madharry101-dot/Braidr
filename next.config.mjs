// R-04 — security headers.
//
// The CSP ships in REPORT-ONLY mode. Nothing is blocked; browsers on real
// traffic post what *would* have been blocked to /api/csp-report, and the
// enforcing policy gets built from what actually fires. The alternative —
// writing an allowlist from what we believe loads and enforcing it — breaks
// production in ways that only show up for some users on some pages.
//
// `script-src` deliberately keeps 'unsafe-inline' during this phase. Next's
// App Router streams the RSC payload as ~15 inline <script> blocks per page,
// so omitting it would bury every report under violations we already
// understand and could not act on, and the external-origin signal we turned
// this on to collect would be lost in the noise. Tightening script-src is the
// decision that follows the data, not one to pre-empt here — and it is not
// free: Next requires a page to be dynamically rendered to carry a nonce, and
// Braidr currently prerenders 42 pages.
//
// The remaining headers have no report-only equivalent, so they enforce now.
// Each is safe for this app specifically: nothing frames Braidr, nothing calls
// getUserMedia (BraidCare's capture uses <input type="file" capture>, which is
// an OS file picker and NOT governed by Permissions-Policy), and the site is
// already HTTPS-only behind Netlify.
//
// HSTS deliberately omits `preload`. Submitting to the browser preload list
// is effectively irreversible and would bind every future subdomain to HTTPS;
// that is a decision to take on purpose, not a side effect of adding headers.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Supabase Storage serves avatars and portfolio photos; next/image emits
  // blob:/data: during optimisation.
  "img-src 'self' data: blob: https://*.supabase.co",
  // next/font/google self-hosts Inter and Playfair at build time, so there is
  // no external font origin to allow.
  "font-src 'self'",
  // React sets element style attributes (~90 per page); there are no <style>
  // blocks. 'unsafe-inline' here is far weaker a concession than in script-src.
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  // The browser Supabase client talks to REST/Auth/Storage over https. No
  // realtime subscription exists anywhere in the app, so no wss: is needed.
  "connect-src 'self' https://*.supabase.co",
  "report-uri /api/csp-report",
  "report-to csp",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
  // Names the group that `report-to csp` above refers to, for browsers on the
  // Reporting API rather than the legacy report-uri.
  {
    key: "Reporting-Endpoints",
    value: 'csp="/api/csp-report"',
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // Health-adjacent URLs (a BraidCare session id in a path) must not travel to
  // third parties in a Referer header.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // PRD v2.0 §4.11 lists short URLs for a few screens that live under
  // deeper paths (plan Q6). Keep the canonical routes where they are and
  // redirect the short forms.
  async redirects() {
    return [
      { source: "/pro", destination: "/dashboard/braider/pro", permanent: false },
      { source: "/income", destination: "/dashboard/braider/pro/income", permanent: false },
      { source: "/book/:braiderId", destination: "/braiders/:braiderId/book", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        // Public Supabase Storage buckets (avatars, portfolio-photos).
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
