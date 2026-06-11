"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Avatar } from "./Avatar";

// Uploads a profile picture to /api/profile/avatar and reports the new URL up.
export function AvatarUploader({
  name,
  image,
  onUploaded,
}: {
  name?: string | null;
  image?: string | null;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image is too large (max 5 MB).");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Upload failed.");
        return;
      }
      onUploaded(data.url);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="group relative rounded-full"
        aria-label="Change profile picture"
      >
        <Avatar name={name} image={image} size="xl" />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink-950/60 opacity-0 transition-opacity group-hover:opacity-100">
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-zinc-100" />
          ) : (
            <Camera className="h-5 w-5 text-zinc-100" />
          )}
        </span>
      </button>
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn-secondary !py-2 text-[13px] disabled:opacity-60"
        >
          {busy ? "Uploading…" : "Change photo"}
        </button>
        <p className="mt-1.5 text-[11px] text-zinc-600">JPG, PNG, WebP or GIF · max 5 MB.</p>
        {error && <p className="mt-1 text-[11px] text-red-300">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        onChange={onPick}
        className="hidden"
      />
    </div>
  );
}
