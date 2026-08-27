import Link from "next/link";
import { cn } from "@/lib/cn";

// Wordmark only for v1 — no bitmap asset yet. The interlocking "id" is set
// in gold to hint at the braid/weave idea without a custom glyph.
export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn("font-display text-2xl font-semibold tracking-tight text-plum", className)}
      aria-label="Braidr home"
    >
      bra<span className="text-gold-deep">id</span>r
    </Link>
  );
}
