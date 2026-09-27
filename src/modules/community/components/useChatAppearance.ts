"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHAT_BG_KEY,
  CHAT_BG_PHOTO_KEY,
  isChatBackgroundId,
  type ChatBackgroundId,
} from "@modules/community/lib/chat-backgrounds";
import {
  DIM_MAX,
  WallpaperError,
  deleteWallpaper,
  loadWallpaper,
  prepareWallpaper,
  saveWallpaper,
  type Rgb,
} from "@modules/community/lib/chat-wallpaper";

/** What the room is showing: a preset, or the member's own photo. */
export type ChatChoice = ChatBackgroundId | "photo";

export type ChatPhoto = {
  /** A `blob:` URL for the stored photo. Owned and revoked by this hook. */
  url: string;
  bright: Rgb;
  dark: Rgb;
  width: number;
  height: number;
};

export type PhotoSettings = {
  /** The member's chosen dim, 0-1. Applied as max(this, readability floor). */
  dim: number;
  blur: boolean;
};

/**
 * A comfortable starting dim for a fresh photo: enough to sit the photo back
 * behind the conversation, not so much that it reads as a black rectangle.
 * The readability floor still wins whenever a photo needs more.
 */
export const DEFAULT_DIM = 0.45;

const DEFAULT_SETTINGS: PhotoSettings = { dim: DEFAULT_DIM, blur: false };

function readSettings(): PhotoSettings {
  try {
    const raw = localStorage.getItem(CHAT_BG_PHOTO_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const j = JSON.parse(raw) as Partial<PhotoSettings>;
    const dim = typeof j.dim === "number" && Number.isFinite(j.dim) ? Math.min(DIM_MAX, Math.max(0, j.dim)) : DEFAULT_DIM;
    return { dim, blur: j.blur === true };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not persisting is survivable; not applying it would not be.
  }
}

/**
 * The room's appearance: which background, the member's photo, and its dim and
 * blur - loaded, persisted, and cleaned up.
 *
 * ## Where things live
 *
 * - The CHOICE (a preset id or "photo") and the photo SETTINGS are small
 *   strings in `localStorage`, alongside the theme.
 * - The PHOTO is a Blob in IndexedDB (see `chat-wallpaper.ts` for why not
 *   localStorage, and why it is never uploaded).
 *
 * ## Why every read is in an effect
 *
 * ⚠️ Neither store exists on the server. Reading either during render makes the
 * first client render disagree with the server's, which is React #418 - the
 * failure that once blanked every page on this site. State starts at the
 * defaults the server assumed, and the stored choice arrives one commit later;
 * the wallpaper layer cross-fades so that arrival is not a flash.
 *
 * ## The object URL
 *
 * A `blob:` URL keeps its Blob alive until it is revoked. Replacing a photo, or
 * leaving the room, without revoking the old one would leak a whole image per
 * swap for the life of the tab. `urlRef` tracks the live one and every path
 * that replaces or drops it revokes it.
 */
export function useChatAppearance() {
  const [choice, setChoice] = useState<ChatChoice>("default");
  const [settings, setSettings] = useState<PhotoSettings>(DEFAULT_SETTINGS);
  const [photo, setPhoto] = useState<ChatPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const adoptUrl = useCallback((next: string | null) => {
    if (urlRef.current && urlRef.current !== next) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next;
  }, []);

  // Load once, after mount.
  useEffect(() => {
    let alive = true;
    const stored = (() => {
      try {
        return localStorage.getItem(CHAT_BG_KEY);
      } catch {
        return null;
      }
    })();
    // Deferred to a task so none of these setStates run synchronously inside
    // the effect body - the React compiler's cascading-render rule - while
    // still landing before the first paint that matters.
    void Promise.resolve().then(async () => {
      if (!alive) return;
      setSettings(readSettings());
      if (isChatBackgroundId(stored)) setChoice(stored);
      if (stored === "photo") {
        const rec = await loadWallpaper();
        if (!alive) return;
        if (rec) {
          const url = URL.createObjectURL(rec.blob);
          adoptUrl(url);
          setPhoto({ url, bright: rec.bright, dark: rec.dark, width: rec.width, height: rec.height });
          setChoice("photo");
        } else {
          // The choice says "photo" but this device has none - storage was
          // cleared, or it was chosen in another browser. Fall back quietly
          // rather than painting an empty room.
          setChoice("default");
          write(CHAT_BG_KEY, "default");
        }
      } else {
        // Load the photo anyway if one exists, so the sheet can offer it back
        // without asking the member to upload it again.
        const rec = await loadWallpaper();
        if (!alive || !rec) return;
        const url = URL.createObjectURL(rec.blob);
        adoptUrl(url);
        setPhoto({ url, bright: rec.bright, dark: rec.dark, width: rec.width, height: rec.height });
      }
    });
    return () => {
      alive = false;
    };
  }, [adoptUrl]);

  // Revoke on unmount.
  useEffect(() => () => adoptUrl(null), [adoptUrl]);

  const choosePreset = useCallback((id: ChatBackgroundId) => {
    setChoice(id);
    setError(null);
    write(CHAT_BG_KEY, id);
  }, []);

  const choosePhoto = useCallback(() => {
    if (!urlRef.current) return;
    setChoice("photo");
    setError(null);
    write(CHAT_BG_KEY, "photo");
  }, []);

  const uploadPhoto = useCallback(
    async (file: File) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const prepared = await prepareWallpaper(file);
        await saveWallpaper(prepared);
        const url = URL.createObjectURL(prepared.blob);
        adoptUrl(url);
        setPhoto({
          url,
          bright: prepared.bright,
          dark: prepared.dark,
          width: prepared.width,
          height: prepared.height,
        });
        setChoice("photo");
        write(CHAT_BG_KEY, "photo");
      } catch (err) {
        setError(
          err instanceof WallpaperError ? err.message : "Couldn't use that photo. Please try another one."
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, adoptUrl]
  );

  const removePhoto = useCallback(async () => {
    await deleteWallpaper();
    adoptUrl(null);
    setPhoto(null);
    setChoice((c) => {
      if (c !== "photo") return c;
      write(CHAT_BG_KEY, "default");
      return "default";
    });
  }, [adoptUrl]);

  const updateSettings = useCallback((patch: Partial<PhotoSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      write(CHAT_BG_PHOTO_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    choice,
    settings,
    photo,
    busy,
    error,
    choosePreset,
    choosePhoto,
    uploadPhoto,
    removePhoto,
    updateSettings,
    clearError: () => setError(null),
  };
}

export type ChatAppearance = ReturnType<typeof useChatAppearance>;
