import { cn } from "@/lib/cn";

/*
 * Braidr image containers. Approved component library, Section H.
 *
 * Three ratios, three jobs. Until real photography lands, each container
 * renders the note describing the photograph that belongs there — the
 * brief for the shoot is written into the design rather than decided
 * later. Pass `media` to swap the placeholder for the real image.
 */

export type BrImageRatio = "3 / 4" | "1 / 1" | "16 / 9" | "4 / 3";

const RADIUS = {
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  none: "0",
} as const;

export function BrImage({
  ratio = "4 / 3",
  radius = "lg",
  note,
  media,
  className,
  style,
}: {
  ratio?: BrImageRatio;
  radius?: keyof typeof RADIUS;
  /** Shoot direction shown while this container has no real image. */
  note?: string;
  /** The real image element, once there is one. */
  media?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn("br-img", className)}
      style={{ aspectRatio: ratio, borderRadius: RADIUS[radius], padding: media ? 0 : 20, ...style }}
    >
      {media ?? (note && <span className="br-img-note">{note}</span>)}
    </div>
  );
}
