import Image from "next/image";
import { cn } from "@/lib/utils";

/** First letters of a name (or email local part) for the fallback avatar. */
export function initialsFrom(name?: string | null, email?: string | null): string {
  const base = (name?.trim() || email?.split("@")[0] || "?").trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0]![0]! + parts[1]![0]! : base.slice(0, 2);
  return letters.toUpperCase();
}

const SIZES = {
  sm: { box: "h-8 w-8", text: "text-[11px]", px: 32 },
  md: { box: "h-10 w-10", text: "text-sm", px: 40 },
  lg: { box: "h-16 w-16", text: "text-lg", px: 64 },
  xl: { box: "h-24 w-24", text: "text-3xl", px: 96 },
} as const;

export function Avatar({
  name,
  image,
  email,
  size = "md",
  className,
  ring = true,
}: {
  name?: string | null;
  image?: string | null;
  email?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
}) {
  const s = SIZES[size];
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        s.box,
        ring && "ring-1 ring-gold-500/40",
        className
      )}
    >
      {image ? (
        <Image
          src={image}
          alt={name || "Avatar"}
          fill
          sizes={`${s.px}px`}
          className="object-cover"
          unoptimized={image.startsWith("data:")}
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "flex h-full w-full items-center justify-center bg-gold-shine font-display font-semibold text-ink",
            s.text
          )}
        >
          {initialsFrom(name, email)}
        </span>
      )}
    </span>
  );
}
