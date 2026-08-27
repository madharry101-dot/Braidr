import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-4 py-5 lg:px-8">
        <Logo />
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-mist bg-surface p-6 shadow-card sm:p-8">
            {children}
          </div>
          <p className="mt-6 text-center text-xs text-slate">
            By continuing you agree to Braidr&rsquo;s{" "}
            <Link href="/terms" className="underline hover:text-plum">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-plum">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
