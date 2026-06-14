"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Link2 } from "lucide-react";
import { Avatar } from "./Avatar";
import { uploadFileWithProgress } from "@/lib/upload";
import { compressImage } from "@/lib/image";

// Sets a profile picture two ways and reports the new URL up:
//  1) Upload a file to /api/profile/avatar (Supabase Storage) — shows progress.
//  2) Paste an image URL (fallback that works even when Storage isn't configured)
//     — saved via PATCH /api/profile, validated server-side against allowed hosts.
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

  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setError("");
    setBusy(true);
    setProgress(0);
    try {
      // Downscale/re-encode large photos client-side so the upload is small and
      // reliably under the 5 MB cap (no-op for GIFs / already-small images).
      const upload = await compressImage(file);
      if (upload.size > 5 * 1024 * 1024) {
        setError("Image is too large (max 5 MB).");
        return;
      }
      const { ok, status, data } = await uploadFileWithProgress("/api/profile/avatar", upload, setProgress);
      if (!ok) {
        // 501 = Supabase Storage not configured → nudge toward the URL fallback.
        const hint = status === 501 ? " You can paste an image URL instead." : "";
        setError((data.error || "Upload failed.") + hint);
        if (status === 501) setUrlOpen(true);
        return;
      }
      onUploaded(data.url);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveUrl() {
    const value = url.trim();
    if (!value) return;
    setError("");
    setSavingUrl(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save that image URL.");
        return;
      }
      onUploaded(value);
      setUrl("");
      setUrlOpen(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSavingUrl(false);
    }
  }

  return (
    <div className="space-y-3">
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="btn-secondary !py-2 text-[13px] disabled:opacity-60"
            >
              {busy ? `Uploading… ${progress}%` : "Change photo"}
            </button>
            <button
              type="button"
              onClick={() => setUrlOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[13px] text-zinc-400 transition-colors hover:text-mint-200"
            >
              <Link2 className="h-3.5 w-3.5" /> Use a link
            </button>
          </div>
          {busy && (
            <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-mint-shine transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
          )}
          <p className="mt-1.5 text-[11px] text-zinc-600">JPG, PNG, WebP or GIF · max 5 MB.</p>
          {error && <p className="mt-1 text-[11px] text-red-300">{error}</p>}
        </div>
      </div>

      {urlOpen && (
        <div className="rounded-xl border border-white/10 bg-ink-700/40 p-3">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Image URL
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveUrl();
                }
              }}
              placeholder="https://…"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-lg border border-white/10 bg-ink-700/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-mint-500/50"
            />
            <button
              type="button"
              onClick={saveUrl}
              disabled={savingUrl || !url.trim()}
              className="btn-primary shrink-0 !py-2 text-[13px] disabled:opacity-60"
            >
              {savingUrl ? "Saving…" : "Use URL"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-600">
            Direct https image link from Unsplash, Cloudinary, GitHub, Google or Supabase.
          </p>
        </div>
      )}

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
