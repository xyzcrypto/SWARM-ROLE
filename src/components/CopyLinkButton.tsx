"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Copy the current profile URL to the clipboard with a brief "Copied" state.
export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — no-op */ }
  };

  return (
    <button
      onClick={copy}
      aria-label="Copy profile link"
      className={cn(
        "btn-ghost inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-colors",
        copied && "text-mint-300"
      )}
    >
      {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}
