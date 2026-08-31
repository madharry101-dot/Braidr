import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { CookieBanner } from "@/components/legal/cookie-banner";
import { CspReporter } from "@/components/security/csp-reporter";

// Brand typefaces. Loaded through next/font/google rather than a <link> to
// fonts.googleapis.com so they are self-hosted at build time — no
// render-blocking third-party request and no layout shift. Same two
// families and weights the design system specifies.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

// Hero headlines and major section titles ONLY, via .br-display. Never on
// buttons, labels, badges, nav items or form fields — the two faces stay
// legible as distinct roles precisely because this rule holds.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-playfair",
  display: "swap",
});

// Geist ships in the repo already (app/fonts). Retained as the body-copy
// fallback for the screens not yet migrated to the brand system.
const sans = localFont({
  src: [{ path: "./fonts/GeistVF.woff", weight: "100 900", style: "normal" }],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://braidr.co.uk"),
  title: {
    default: "Braidr — professional infrastructure for UK hair braiding",
    template: "%s · Braidr",
  },
  description:
    "Find and book a trusted braider, monitor your scalp health between appointments, and build a professional braiding business — all in one place.",
  openGraph: {
    title: "Braidr",
    description: "Professional infrastructure for the UK hair braiding industry.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1c1108", // --brand-deep
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${inter.variable} ${playfair.variable} ${sans.variable}`}>
      {/* Background and text colour come from the `body` rule in globals.css
          (--brand-cream / --text-primary) rather than utility classes, so the
          design system owns them in one place. */}
      <body className="min-h-screen">
        <Providers>{children}</Providers>
        <CookieBanner />
        {/* Reports this page's CSP violations to /api/csp-report, because
            Chrome queues them but does not deliver them out-of-band (see the
            component). Renders nothing; must be inside <body> so it mounts on
            every page, including the statically prerendered ones. */}
        <CspReporter />
      </body>
    </html>
  );
}
