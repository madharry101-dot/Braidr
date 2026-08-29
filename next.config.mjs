/** @type {import('next').NextConfig} */
const nextConfig = {
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
