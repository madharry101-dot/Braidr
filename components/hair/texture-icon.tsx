import type { HairTexture } from "@/lib/hair/textures";

// Line-art "swatch" for each texture. SVG rather than photographic swatches
// for now (founder decision) — trivially swappable for imagery later since
// every call site goes through this component.

const PATHS: Record<HairTexture, string> = {
  straight: "M12 2v20",
  wavy: "M12 2c-3 3 3 4 0 7s3 4 0 7 3 4 0 6",
  curly: "M12 2c-4 1-4 4 0 5s4 4 0 5 -4 4 0 5 4 3 0 5",
  coily: "M12 2c-3 0-3 2 0 2s3 2 0 2 -3 2 0 2 3 2 0 2 -3 2 0 2 3 2 0 2",
};

export function TextureIcon({
  texture,
  className = "h-7 w-7",
  title,
}: {
  texture: HairTexture;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[texture]} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}
