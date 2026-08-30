import { Badge } from "@/components/ui/badge";
import { TextureIcon } from "@/components/hair/texture-icon";
import { TEXTURE_META, type HairTexture } from "@/lib/hair/textures";

// Verified texture specialisations, shown on braider cards and profiles.
// These are ONLY ever rendered from verified data — the API never sends
// unverified specialisations to a client, so there is no "pending" variant
// here by design.

export function TextureBadges({
  textures,
  className,
}: {
  textures: HairTexture[];
  className?: string;
}) {
  if (textures.length === 0) return null;
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate">Verified for</span>
        {textures.map((t) => (
          <Badge key={t} tone="verified">
            <TextureIcon texture={t} className="h-3 w-3" />
            {TEXTURE_META[t].label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
