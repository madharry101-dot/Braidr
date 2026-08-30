import Link from "next/link";
import { BrWordmark } from "@/components/braidr-ui/nav";

/*
 * Auth shell — brand design system.
 *
 * Visual layer only. The card, wordmark and background move to the brand
 * tokens; the Terms/Privacy line is unchanged, because it is a consent
 * disclosure rather than decoration.
 *
 * This layout is shared by /login, /register, /forgot-password,
 * /reset-password, /verify-email and the OAuth completion step.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-4 py-5 lg:px-8">
        <BrWordmark className="br-wordmark-ink" />
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="br-card p-6 sm:p-8">{children}</div>
          <p className="mt-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
            By continuing you agree to Braidr&rsquo;s{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
