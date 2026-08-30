import Link from "next/link";
import { Avatar } from "@/components/booking/avatar";
import { StarRating } from "@/components/booking/star-rating";
import { Badge } from "@/components/ui/badge";
import { TextureBadges } from "@/components/hair/texture-badges";
import { formatMoney } from "@/lib/format";
import type { BraiderCard as BraiderCardData } from "@/lib/types/braidmatch";

export function BraiderCard({ braider }: { braider: BraiderCardData }) {
  return (
    <Link
      href={`/braiders/${braider.id}`}
      className="flex flex-col gap-3 rounded-lg border border-mist bg-surface p-5 shadow-card transition-shadow hover:shadow-[0_2px_4px_rgba(45,27,53,0.1),0_8px_24px_rgba(45,27,53,0.1)]"
    >
      <div className="flex items-start gap-3">
        <Avatar name={braider.name} src={braider.avatar_url} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-lg text-plum">{braider.name}</h3>
            {braider.is_verified && <Badge tone="verified">✓ Verified</Badge>}
          </div>
          <p className="text-sm text-slate">
            {braider.area ? `${braider.area}, ` : ""}
            {braider.city}
          </p>
          <div className="mt-1">
            <StarRating rating={braider.avg_rating} count={braider.total_reviews} />
          </div>
        </div>
      </div>

      {braider.specialisations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {braider.specialisations.slice(0, 4).map((s) => (
            <Badge key={s}>{s}</Badge>
          ))}
          {braider.specialisations.length > 4 && (
            <Badge>+{braider.specialisations.length - 4}</Badge>
          )}
        </div>
      )}

      <TextureBadges textures={braider.verified_textures ?? []} />

      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="text-sm text-slate">
          {braider.price_from_pence != null ? (
            <>
              from{" "}
              <span className="font-semibold text-plum">
                {formatMoney(braider.price_from_pence)}
              </span>
            </>
          ) : (
            "Prices on profile"
          )}
        </span>
        {braider.braidcare_badge_active && <Badge tone="braidcare">BraidCare</Badge>}
      </div>
    </Link>
  );
}
