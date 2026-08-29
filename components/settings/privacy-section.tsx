"use client";

import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { CookiePreferencesLink } from "@/components/legal/cookie-preferences-link";

export function PrivacySection() {
  return (
    <Card>
      <CardTitle>Privacy</CardTitle>
      <div className="mt-3 flex flex-col gap-3 text-sm">
        <div>
          <p className="font-medium text-plum">Cookies</p>
          <CookiePreferencesLink className="text-teal-deep underline hover:text-plum" />
        </div>
        <div>
          <p className="font-medium text-plum">Your data</p>
          <p className="text-slate">
            Read the{" "}
            <Link href="/privacy" className="text-teal-deep underline hover:text-plum">
              Privacy Policy
            </Link>
            . To request a copy of your data, email{" "}
            <a href="mailto:privacy@braidr.app" className="underline hover:text-plum">
              privacy@braidr.app
            </a>
            . Self-service export is coming soon.
          </p>
        </div>
      </div>
    </Card>
  );
}
