import { cn } from "@/lib/cn";

/*
 * Braidr loading states. Approved component library, Section I.
 *
 * Layout holds, content pulses — 1.5s ease-in-out. A skeleton keeps the
 * shape of what is coming so nothing jumps when it lands. The pulse is
 * switched off under prefers-reduced-motion (app/globals.css).
 */

export function BrSkeleton({
  circle,
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { circle?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn("br-skel", circle && "br-skel-circle", className)}
      style={style}
      {...props}
    />
  );
}

/** Matches BrBraiderCard's shape so search results do not reflow on load. */
export function BrBraiderCardSkeleton() {
  return (
    <div className="br-card">
      <BrSkeleton className="rounded-none" style={{ aspectRatio: "4 / 3" }} />
      <div className="p-4">
        <BrSkeleton className="h-5 w-3/5" />
        <BrSkeleton className="mt-2.5 h-3.5 w-[45%]" />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <BrSkeleton className="h-6 w-[76px] rounded-full" />
          <BrSkeleton className="h-6 w-16 rounded-full" />
        </div>
        <BrSkeleton className="mt-4 h-10 w-full rounded-full" />
      </div>
    </div>
  );
}

/** Three-line text block — heading, full line, short line. */
export function BrTextSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <BrSkeleton className="h-7 w-4/5" />
      <BrSkeleton className="mt-3 h-[18px] w-full" />
      <BrSkeleton className="mt-3 h-3.5 w-[65%]" />
    </div>
  );
}

export function BrAvatarSkeleton({ size = 52 }: { size?: number }) {
  return <BrSkeleton circle style={{ width: size, height: size }} />;
}
