// R-04 — security headers.
//
// The CSP is ENFORCING as of 2026-09-03. It ran in Report-Only first and the
// policy is going live UNCHANGED — nothing that was exercised needed any
// directive widened.
//
// WHAT THE EVIDENCE ACTUALLY WAS, because the headline number is misleading.
// The report-only table was empty after 69 hours, but traffic in that period
// was two sign-ins and nothing else, so zero violations from ~zero visitors
// proved nothing. The reporter was confirmed alive (a probe landed a row
// instantly), and the window was then replaced with a deliberate crawl: 32
// page loads across public, client, braider and admin surfaces on production,
// zero violations. `img-src` was exercised separately by seeding a portfolio
// photo — it had never been tested because storage had always been empty —
// and served fine through /_next/image.
//
// WHY ENFORCE BEFORE THE BLOG HAS CONTENT (founder's call, on record):
// /blog/[slug] has never rendered, since blog_posts is empty. But the thing
// we were worried about there — the inline <style> in the category filter —
// is already covered by style-src 'unsafe-inline', so the blog cannot break
// on that directive. What is untested is whether a blog page fires something
// *else*: a small unknown, on pages with zero visitors, weighed against weeks
// of no CSP protection at all while waiting for content that is not scheduled.
// When the first post publishes, THAT page load is the remaining verification
// — check csp_violation_reports immediately after.
//
// The reporter (components/security/csp-reporter.tsx) stays running. Its
// meaning changes with this switch: in report-only a row was a sample, in
// enforce mode a row means something was actually BLOCKED for a real user.
// Rows are now an alerting signal, not data collection.
//
// `script-src` still keeps 'unsafe-inline'. Next's App Router streams the RSC
// payload as ~15 inline <script> blocks per page, so removing it needs a
// nonce — and Next requires a page to be dynamically rendered to carry one,
// which would convert Braidr's ~42 prerendered pages into per-request
// function invocations. That is a separate decision with a real cost.
//
// The other headers were already enforcing. Each is safe for this app
// specifically: nothing frames Braidr, nothing calls getUserMedia (BraidCare's
// capture uses <input type="file" capture>, an OS file picker NOT governed by
// Permissions-Policy), and the site is HTTPS-only behind Netlify.
//
// HSTS deliberately omits `preload`. Submitting to the browser preload list is
// effectively irreversible and would bind every future subdomain to HTTPS;
// that is a decision to take on purpose, not a side effect of adding headers.
// Netlify injects its own HSTS *with* preload regardless, so this is not
// actually ours to control until Braidr is on its own domain.
//
// RESIDUAL, not covered by any of the above: every observation came from one
// embedded Chromium. Safari and Firefox differ on CSP handling — notably
// neither implements ReportingObserver, so they fall back to the
// securitypolicyviolation listener, and their directive support is not
// identical. Treat non-Chromium browsers as untested.
const CSP = [
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
  //
  // ⚠️ DO NOT DROP 'unsafe-inline' HERE WITHOUT READING
  // components/blog/category-filter.tsx FIRST. It injects a real inline
  // <style> element after hydration to hide non-matching posts. Because it
  // renders in the browser rather than on the server, it is absent from the
  // prerendered HTML, no static scan of the markup will find it, and a nonce
  // cannot cover it. Removing this keyword does not error — the rule stops
  // applying and the blog filter shows every post while highlighting one
  // category, which looks like a working page. That component carries the
  // full note, including the cheap fix (static per-category rules, since
  // BLOG_CATEGORIES is a fixed build-time enum).
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  // The browser Supabase client talks to REST/Auth/Storage over https. No
  // realtime subscription exists anywhere in the app, so no wss: is needed.
  "connect-src 'self' https://*.supabase.co",
  "report-uri /api/csp-report",
  "report-to csp",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
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
