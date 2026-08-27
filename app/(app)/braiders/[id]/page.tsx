"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Avatar } from "@/components/booking/avatar";
import { StarRating } from "@/components/booking/star-rating";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { useBraider } from "@/lib/hooks/braidmatch";
import { publicStorageUrl } from "@/lib/storage";
import { formatMoney, formatDuration, formatDate } from "@/lib/format";

export default function BraiderProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error } = useBraider(id);

  if (isLoading) return <LoadingBlock label="Loading profile" />;
  if (isError || !data) {
    return (
      <Alert tone="error">{error?.message ?? "This braider profile could not be found."}</Alert>
    );
  }

  const { braider, services, reviews } = data;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/braiders" className="text-sm text-teal-deep hover:text-plum">
          ← Back to search
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar name={braider.name} src={braider.avatar_url} size="lg" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl text-plum sm:text-3xl">{braider.name}</h1>
            {braider.is_verified && <Badge tone="verified">✓ Verified</Badge>}
            {braider.braidcare_badge_active && <Badge tone="braidcare">BraidCare</Badge>}
          </div>
          <p className="mt-1 text-slate">
            {braider.area ? `${braider.area}, ` : ""}
            {braider.city}
            {braider.years_experience != null && ` · ${braider.years_experience} yrs experience`}
          </p>
          <div className="mt-2">
            <StarRating rating={braider.avg_rating} count={braider.total_reviews} />
          </div>
        </div>
      </div>

      {braider.bio && <p className="max-w-2xl text-slate">{braider.bio}</p>}

      {braider.specialisations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {braider.specialisations.map((s) => (
            <Badge key={s}>{s}</Badge>
          ))}
        </div>
      )}

      {/* Portfolio */}
      {braider.portfolio_photos && braider.portfolio_photos.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-plum">Portfolio</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {braider.portfolio_photos.map((path) => (
              <div key={path} className="relative aspect-square overflow-hidden rounded-lg bg-mist">
                <Image
                  src={publicStorageUrl("portfolio-photos", path)}
                  alt={`${braider.name} portfolio`}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Services */}
      <section>
        <h2 className="font-display text-xl text-plum">Services</h2>
        {services.length === 0 ? (
          <p className="mt-2 text-sm text-slate">
            This braider hasn&rsquo;t listed any services yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {services.map((s) => (
              <li key={s.id}>
                <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-plum">{s.name}</h3>
                      <Badge>{s.category}</Badge>
                    </div>
                    {s.description && <p className="mt-1 text-sm text-slate">{s.description}</p>}
                    <p className="mt-1 text-sm text-slate">
                      {formatDuration(s.duration_mins)} · from{" "}
                      <span className="font-semibold text-plum">{formatMoney(s.price_from)}</span>
                      {s.price_to && ` – ${formatMoney(s.price_to)}`}
                    </p>
                  </div>
                  <LinkButton
                    href={`/braiders/${braider.id}/book?service=${s.id}`}
                    size="sm"
                    className="sm:!w-auto"
                  >
                    Book
                  </LinkButton>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Reviews */}
      <section>
        <h2 className="font-display text-xl text-plum">
          Reviews {braider.total_reviews > 0 && `(${braider.total_reviews})`}
        </h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-sm text-slate">No reviews yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {reviews.map((r) => (
              <li key={r.id} className="border-b border-mist pb-4 last:border-0">
                <div className="flex items-center justify-between">
                  <StarRating rating={r.rating} />
                  <span className="text-xs text-slate">{formatDate(r.created_at)}</span>
                </div>
                {r.comment && <p className="mt-1 text-sm text-slate">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
