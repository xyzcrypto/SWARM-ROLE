/**
 * Right-sized images for third-party URLs, at zero Vercel cost.
 *
 * Measured on a throttled phone (2026-11-28): /markets downloaded 943 KB of
 * images, /news a single 1.5 MB publisher photo for one card thumbnail, and
 * /points a 626 KB Sanity cover. On a 1.6 Mbps connection that is seconds of
 * bandwidth for pixels nobody sees. `next/image` would fix the size but routes
 * every image through Vercel (Fast Origin Transfer + optimisation quota; see
 * the cost-check skill, trap 3), so this asks each source for a smaller file
 * instead, and the browser still fetches it straight from that source.
 */

/** CoinGecko and DefiLlama icons shown at ~16-48px. */
export function iconSrc(url: string | null | undefined, px = 48): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // CoinGecko: /large/ is 250x250 (~21 KB), /small/ 50x50 (~2 KB).
    if (/(^|\.)coingecko\.com$/.test(u.hostname) && u.pathname.includes("/large/")) {
      u.pathname = u.pathname.replace("/large/", "/small/");
      return u.toString();
    }
    // DefiLlama's icon CDN resizes on request: 64 KB -> 2.4 KB at 48px.
    if (u.hostname === "icons.llamao.fi" && !u.searchParams.has("w")) {
      const size = String(Math.max(24, Math.min(128, Math.round(px))));
      u.searchParams.set("w", size);
      u.searchParams.set("h", size);
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

/** Free, cached image resizer (images.weserv.nl). Used only for photos from hosts that cannot resize themselves. */
const RESIZER = "https://wsrv.nl/";

/**
 * A photo from anywhere, resized to `width` CSS-ish pixels (already including
 * the 2x for retina at the caller). Relative and data URLs, SVGs and GIFs are
 * returned untouched. Sanity's CDN resizes itself; everything else goes through
 * the resizer as WebP. Callers must fall back to the original on error (see
 * usePhoto), so a resizer outage only costs bytes, never a missing picture.
 */
export function photoSrc(url: string | null | undefined, width: number): string | null {
  if (!url) return null;
  // Some feeds hand over HTML-escaped URLs ("&amp;"), which silently drops
  // every parameter after the first. Seen on a Sanity cover in /points.
  const clean = url.replace(/&amp;/g, "&");
  if (!/^https?:\/\//i.test(clean)) return clean;
  let u: URL;
  try {
    u = new URL(clean);
  } catch {
    return clean;
  }
  if (/\.(svg|gif)$/i.test(u.pathname)) return clean;
  const w = String(Math.max(80, Math.min(1600, Math.round(width))));
  if (u.hostname === "cdn.sanity.io") {
    u.searchParams.set("w", w);
    u.searchParams.set("fit", "max");
    u.searchParams.set("auto", "format");
    u.searchParams.set("q", "72");
    u.searchParams.delete("fm");
    return u.toString();
  }
  if (u.hostname === "wsrv.nl" || u.hostname === "images.weserv.nl") return clean;
  return `${RESIZER}?url=${encodeURIComponent(clean)}&w=${w}&output=webp&q=72&we`;
}

/**
 * onError for a plain <img> showing photoSrc(): the first failure retries the
 * original URL (kept in data-orig), the second calls `gone` (hide it).
 */
export function photoFallback(gone: (img: HTMLImageElement) => void) {
  return (e: { currentTarget: HTMLImageElement }) => {
    const img = e.currentTarget;
    const orig = img.dataset.orig;
    if (orig && img.dataset.tried !== "1" && img.src !== orig) {
      img.dataset.tried = "1";
      img.src = orig;
      return;
    }
    gone(img);
  };
}
