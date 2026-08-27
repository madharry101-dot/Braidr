import { BRAIDCARE_DISCLAIMER } from "@/lib/types/braidcare";
import { cn } from "@/lib/cn";

export function BraidcareDisclaimer({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "rounded border border-mist bg-white/70 px-3 py-2 text-xs leading-relaxed text-slate",
        className
      )}
    >
      {BRAIDCARE_DISCLAIMER}
    </p>
  );
}
