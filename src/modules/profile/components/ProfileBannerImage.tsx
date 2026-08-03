"use client";

import { ImageLightbox } from "@/components/ImageLightbox";

/**
 * Renders the profile hero banner.
 *
 * This used to carry an owner-only re-fetch of `/api/profile` to "rehydrate"
 * the real image, because the public page stripped an inline `data:` banner to
 * null before caching. That was a half fix on both counts: the owner saw their
 * banner and **nobody else did**, and the owner's copy pulled the entire base64
 * blob down on every visit to their own profile.
 *
 * The server now hands over a real `/api/media/banner/...` URL that works for
 * every viewer (see `publicImageUrl`), so there is nothing left to rehydrate -
 * the component is back to rendering what it is given.
 */
export function ProfileBannerImage({ bannerImage }: { bannerImage: string | null }) {
  // Clicking opens the full, uncropped banner (like X) - only when there's a
  // real image to show; the plain gradient fallback isn't clickable.
  if (!bannerImage) return <div className="absolute inset-0 bg-gold-shine" />;

  return (
    <ImageLightbox src={bannerImage} alt="Profile banner" className="absolute inset-0 block h-full w-full cursor-zoom-in">
      <div
        className="h-full w-full bg-gold-shine"
        style={{ backgroundImage: `url(${bannerImage})`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
    </ImageLightbox>
  );
}
