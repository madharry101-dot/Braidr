import { cn } from "@/lib/cn";

// Accessible star rating. Rounds to the nearest half for display; the exact
// value goes in the aria-label and the visible numeric.
export function StarRating({
  rating,
  count,
  className,
}: {
  rating: number | null;
  count?: number;
  className?: string;
}) {
  if (rating === null || rating === undefined) {
    return <span className={cn("text-sm text-slate", className)}>No reviews yet</span>;
  }

  const rounded = Math.round(rating * 2) / 2;

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-sm", className)}
      aria-label={`Rated ${rating.toFixed(1)} out of 5${count != null ? ` from ${count} reviews` : ""}`}
    >
      <span aria-hidden className="text-gold-deep">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n}>{rounded >= n ? "★" : rounded >= n - 0.5 ? "⯨" : "☆"}</span>
        ))}
      </span>
      <span className="font-medium text-plum">{rating.toFixed(1)}</span>
      {count != null && <span className="text-slate">({count})</span>}
    </span>
  );
}
