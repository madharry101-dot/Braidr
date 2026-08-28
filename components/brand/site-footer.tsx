import Link from "next/link";
import { CookiePreferencesLink } from "@/components/legal/cookie-preferences-link";

export function SiteFooter() {
  return (
    <footer className="border-t border-mist bg-white">
      <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-8 text-sm text-slate sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <p>© {new Date().getFullYear()} Braidr Ltd</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/terms" className="hover:text-plum">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-plum">
            Privacy
          </Link>
          <CookiePreferencesLink className="hover:text-plum" />
          <Link href="/login" className="hover:text-plum">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
