import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <h1 className="font-display text-3xl text-plum">Page not found</h1>
      <p className="text-slate">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
      </p>
      <Link href="/" className="font-medium text-teal-deep underline hover:text-plum">
        Back to home
      </Link>
    </div>
  );
}
