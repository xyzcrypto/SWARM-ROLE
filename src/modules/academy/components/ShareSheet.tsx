"use client";

import { useState } from "react";
import { Check, Download, Link2, Send, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { sfx, unlock } from "../client/audio";

/**
 * One row of share actions used by certificates, quiz results and ranks:
 * the phone's own share sheet (with the card image attached when the browser
 * can), X, WhatsApp, Telegram, copy link and download the card.
 */
export function ShareSheet({ url, image, text, fileName = "xyz-crypto-academy.png", className }: { url: string; image: string; text: string; fileName?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const enc = encodeURIComponent;

  const native = async () => {
    unlock();
    sfx("click");
    setBusy(true);
    try {
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      let files: File[] | undefined;
      try {
        const blob = await fetch(image).then((r) => r.blob());
        const f = new File([blob], fileName, { type: "image/png" });
        if (nav.canShare?.({ files: [f] })) files = [f];
      } catch {
        /* share without the image */
      }
      if (nav.share) await nav.share({ title: "XYZ Crypto Academy", text, url, ...(files ? { files } : {}) });
      else await copy();
    } catch {
      /* dismissed */
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      sfx("pop");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };
  const open = (href: string) => {
    sfx("click");
    window.open(href, "_blank", "noopener,noreferrer");
  };
  const btn = "inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-white/[0.03] px-3.5 text-[13px] font-semibold text-content transition-colors hover:border-gold-400/50 active:border-gold-400/50";
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <button type="button" onClick={native} disabled={busy} className="btn-gold h-10 px-4 text-[13px]">
        <Share2 className="h-4 w-4" /> Share
      </button>
      <button type="button" onClick={() => open(`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`)} className={btn} aria-label="Share on X">
        <span className="font-black">𝕏</span> Post
      </button>
      <button type="button" onClick={() => open(`https://wa.me/?text=${enc(`${text} ${url}`)}`)} className={btn} aria-label="Share on WhatsApp">
        <Send className="h-4 w-4 text-mint-400" /> WhatsApp
      </button>
      <button type="button" onClick={() => open(`https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`)} className={btn} aria-label="Share on Telegram">
        <Send className="h-4 w-4 -rotate-12 text-sky-400" /> Telegram
      </button>
      <button type="button" onClick={copy} className={btn}>
        {copied ? <Check className="h-4 w-4 text-mint-400" /> : <Link2 className="h-4 w-4" />} {copied ? "Copied" : "Copy link"}
      </button>
      <a href={image} download={fileName} onClick={() => sfx("click")} className={btn}>
        <Download className="h-4 w-4" /> Card
      </a>
    </div>
  );
}
