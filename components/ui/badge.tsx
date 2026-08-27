import { cn } from "@/lib/cn";

type Tone = "neutral" | "verified" | "braidcare" | "plum";

const tones: Record<Tone, string> = {
  neutral: "bg-mist/60 text-slate",
  verified: "bg-teal/10 text-teal-deep",
  braidcare: "bg-success-bg text-success",
  plum: "bg-plum text-white",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
