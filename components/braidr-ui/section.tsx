import { cn } from "@/lib/cn";
import { BrEyebrow } from "./badge";

/*
 * Braidr section anatomy. Approved component library, Section F.
 *
 * Label pill, Playfair heading, Inter sub-heading. 96px of vertical
 * padding on desktop, 64px on mobile (.br-sec). Every landing page
 * section is built from this skeleton — the light variant on cream, the
 * dark variant on brand-deep.
 */

export function BrSectionHead({
  label,
  heading,
  sub,
  dark = false,
  align = "left",
  maxWidth = 640,
  className,
  headingClassName,
}: {
  label?: string;
  heading: React.ReactNode;
  sub?: React.ReactNode;
  dark?: boolean;
  align?: "left" | "center";
  maxWidth?: number;
  className?: string;
  headingClassName?: string;
}) {
  const centred = align === "center";
  return (
    <div
      className={cn("mb-12", centred ? "text-center" : "text-left", className)}
      style={{
        maxWidth,
        marginLeft: centred ? "auto" : 0,
        marginRight: centred ? "auto" : 0,
      }}
    >
      {label && <BrEyebrow dark={dark}>{label}</BrEyebrow>}
      <h2
        className={cn("br-h2 br-display mt-5", headingClassName)}
        style={{ color: dark ? "var(--text-inverse)" : "var(--text-primary)" }}
      >
        {heading}
      </h2>
      {sub && (
        <p
          className="br-lead mt-4"
          style={{ color: dark ? "rgba(249,244,237,.75)" : "var(--text-muted)" }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
