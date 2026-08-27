import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-mist bg-white">
      <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-8 text-sm text-slate sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <p>© {new Date().getFullYear()} Braidr Ltd</p>
        <nav className="flex gap-5">
          <Link href="/terms" className="hover:text-plum">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-plum">
            Privacy
          </Link>
          <Link href="/login" className="hover:text-plum">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
