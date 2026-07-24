"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ImageLightbox } from "./ImageLightbox";

/**
 * Renders the profile hero banner. The server passes the ISR-safe (possibly
 * stripped) bannerImage; when the viewer is the profile owner, this rehydrates
 * with the real image via a private self-only fetch, since /u/[username] is
 * public+cached and can't serve the raw inline data: URL to every visitor.
 */
export function ProfileBannerImage({
  profileId,
  bannerImage,
}: {
  profileId: string;
  bannerImage: string | null;
}) {
  const { data: session } = useSession();
  const [src, setSrc] = useState(bannerImage);
  const isOwner = (session?.user as { id?: string } | undefined)?.id === profileId;

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    fetch("/api/profile", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.user?.bannerImage) setSrc(data.user.bannerImage);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  // Clicking opens the full, uncropped banner (like X) - only when there's a
  // real image to show; the plain gradient fallback isn't clickable.
  if (!src) return <div className="absolute inset-0 bg-gold-shine" />;

  return (
    <ImageLightbox src={src} alt="Profile banner" className="absolute inset-0 block h-full w-full cursor-zoom-in">
      <div
        className="h-full w-full bg-gold-shine"
        style={{ backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
    </ImageLightbox>
  );
}
