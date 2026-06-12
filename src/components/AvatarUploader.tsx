"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Avatar } from "./Avatar";
import { uploadFileWithProgress } from "@/lib/upload";

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
  const [progress, setProgress] = useState(0);
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
    setProgress(0);
    try {
      const { ok, data } = await uploadFileWithProgress("/api/profile/avatar", file, setProgress);
      if (!ok) {
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
          {busy ? `Uploading… ${progress}%` : "Change photo"}
        </button>
        {busy && (
          <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-mint-shine transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
        )}
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
