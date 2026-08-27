import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/types/database";

const LABELS: Record<
  BookingStatus,
  { label: string; tone: "neutral" | "verified" | "braidcare" | "plum" }
> = {
  pending: { label: "Awaiting payment", tone: "neutral" },
  confirmed: { label: "Confirmed", tone: "braidcare" },
  completed: { label: "Completed", tone: "verified" },
  cancelled_client: { label: "Cancelled", tone: "neutral" },
  cancelled_braider: { label: "Cancelled by braider", tone: "neutral" },
  disputed: { label: "In dispute", tone: "plum" },
  refunded: { label: "Refunded", tone: "neutral" },
  payment_failed: { label: "Payment failed", tone: "neutral" },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { label, tone } = LABELS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
