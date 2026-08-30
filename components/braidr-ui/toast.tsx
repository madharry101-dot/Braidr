import { AlertCircle, Check, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { type BrChipTone } from "./badge";

/*
 * Braidr toasts. Approved component library, Section G.
 *
 * Radius-full, 12px/20px padding, Inter 500, dismissed after 4 seconds.
 * Every toast names the exact thing that happened — the button that said
 * "Confirm booking" produces the toast that says "Booking confirmed."
 */

export type BrToastTone = "success" | "error" | "info";

const TONE: Record<
  BrToastTone,
  { chip: BrChipTone; icon: React.ReactNode; role: "status" | "alert" }
> = {
  success: {
    chip: "deep",
    icon: <Check size={16} aria-hidden="true" />,
    role: "status",
  },
  error: {
    chip: "rust",
    icon: <AlertCircle size={16} aria-hidden="true" />,
    role: "alert",
  },
  info: {
    chip: "sand",
    icon: <Info size={16} aria-hidden="true" />,
    role: "status",
  },
};

const CHIP_CLASS: Record<BrChipTone, string> = {
  gold: "br-chip-gold",
  sage: "br-chip-sage",
  sand: "br-chip-sand",
  rust: "br-chip-rust",
  deep: "br-chip-deep",
  price: "br-chip-price",
};

export function BrToast({
  tone = "success",
  children,
  className,
}: {
  tone?: BrToastTone;
  children: React.ReactNode;
  className?: string;
}) {
  const { chip, icon, role } = TONE[tone];
  return (
    <div
      role={role}
      className={cn("br-chip", CHIP_CLASS[chip], "px-5 py-3 text-[0.9375rem]", className)}
      style={{ boxShadow: "var(--shadow-lg)" }}
    >
      {icon}
      {children}
    </div>
  );
}
