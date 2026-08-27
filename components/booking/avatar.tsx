import Image from "next/image";
import { publicStorageUrl } from "@/lib/storage";
import { cn } from "@/lib/cn";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const sizes = { sm: 40, md: 56, lg: 88 } as const;

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const px = sizes[size];
  const url = src ? publicStorageUrl("avatars", src) : null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-mist font-display text-plum",
        className
      )}
      style={{ width: px, height: px, fontSize: px / 2.6 }}
    >
      {url ? (
        <Image src={url} alt={name} width={px} height={px} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  );
}
