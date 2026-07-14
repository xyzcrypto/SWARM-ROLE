"use client";

import { useState } from "react";
import { Link2, Check, ImageDown, Download, Share2 } from "lucide-react";

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Post to X + copy link + copy image + download + native share, for a shared
// calculator result. Mirrors ShareRow.tsx's X-intent/copy-link pattern (used
// on research posts). Copy-image and download use the Clipboard/anchor
// download APIs directly; native share attaches the actual image file where
// supported (mobile share sheets) - X's web intent has no image-upload param,
// so this is the only path that gets the image itself (not just a link
// preview) into a share.
export function PointsShareActions({ imageUrl, platform, usd }: { imageUrl: string; platform: string; usd: number }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState<"idle" | "copied" | "unsupported">("idle");
  const [nativeShareSupported] = useState(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof navigator.canShare === "function"
  );

  function pageUrl() {
    return typeof window !== "undefined" ? window.location.href : "";
  }

  function shareText() {
    return `My ${platform} points are estimated at $${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })} on XYZ Crypto`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pageUrl());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function copyImage() {
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        setCopiedImage("unsupported");
        setTimeout(() => setCopiedImage("idle"), 2200);
        return;
      }
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setCopiedImage("copied");
      setTimeout(() => setCopiedImage("idle"), 1800);
    } catch {
      setCopiedImage("unsupported");
      setTimeout(() => setCopiedImage("idle"), 2200);
    }
  }

  async function downloadImage() {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "xyz-crypto-points-value.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* best-effort */
    }
  }

  // Native share sheet WITH the image file attached (not just a link) -
  // the only way to get the actual image into the share on platforms that
  // support it (mobile Safari/Chrome). Falls back silently if unsupported.
  async function shareNative() {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], "xyz-crypto-points-value.png", { type: blob.type || "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: shareText(), text: shareText(), url: pageUrl() });
      } else {
        await navigator.share({ title: shareText(), text: shareText(), url: pageUrl() });
      }
    } catch {
      /* user cancelled or unsupported - no-op */
    }
  }

  const btn =
    "inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 text-xs font-medium text-zinc-300 transition-all hover:border-gold-500/40 hover:text-gold-100";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {nativeShareSupported && (
        <button type="button" onClick={shareNative} className={btn} aria-label="Share">
          <Share2 className="h-3.5 w-3.5" />
          Share
        </button>
      )}
      <a
        href="#"
        target="_blank"
        rel="noopener noreferrer"
        className={btn}
        aria-label="Post to X"
        onClick={(e) => {
          e.currentTarget.href = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(pageUrl())}`;
        }}
      >
        <XIcon className="h-3.5 w-3.5" />
        Post to X
      </a>
      <button type="button" onClick={copyLink} className={btn} aria-label="Copy link">
        {copiedLink ? <Check className="h-3.5 w-3.5 text-mint-300" /> : <Link2 className="h-3.5 w-3.5" />}
        {copiedLink ? "Copied" : "Copy link"}
      </button>
      <button type="button" onClick={copyImage} className={btn} aria-label="Copy image">
        {copiedImage === "copied" ? <Check className="h-3.5 w-3.5 text-mint-300" /> : <ImageDown className="h-3.5 w-3.5" />}
        {copiedImage === "copied" ? "Copied" : copiedImage === "unsupported" ? "Open image below" : "Copy image"}
      </button>
      <button type="button" onClick={downloadImage} className={btn} aria-label="Download image">
        <Download className="h-3.5 w-3.5" />
        Download
      </button>
    </div>
  );
}
