import { cn } from "@/lib/cn";

type Tone = "error" | "success" | "info";

const tones: Record<Tone, string> = {
  error: "border-danger/40 bg-danger-bg text-danger",
  success: "border-success/40 bg-success-bg text-success",
  info: "border-mist bg-white text-slate",
};

// role="alert" so screen readers announce form-level errors on submit.
export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded border px-4 py-3 text-sm", tones[tone], className)}
    >
      {children}
    </div>
  );
}
