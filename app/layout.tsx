import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";
import { CookieBanner } from "@/components/legal/cookie-banner";

// Geist ships in the repo already (app/fonts). Body copy only — display
// headings use the CSS serif stack (--font-display, Georgia) defined in
// tailwind.config.ts, which needs no network fetch.
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
  themeColor: "#2d1b35",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={sans.variable}>
      <body className="min-h-screen bg-cream text-plum">
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}
