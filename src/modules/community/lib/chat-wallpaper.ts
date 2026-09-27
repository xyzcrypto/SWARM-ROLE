/**
 * Custom chat wallpaper: the readability maths, the encoder, and the on-device
 * store.
 *
 * ## Why this needs maths at all
 *
 * ⚠️ In the Community room, other people's messages have NO bubble. Their text
 * (`text-zinc-200` in dark, `#26262c` in light) sits directly on whatever is
 * behind the list. The built-in presets are faint washes, so that has never
 * mattered. A member's own photo can be anything - a white beach, a bright
 * screenshot - and "the message text must always remain readable" cannot be
 * met by picking a dim level and hoping.
 *
 * So readability is COMPUTED. When a photo is added, its brightest and darkest
 * regions are measured once. At render time, `minScrimAlpha` finds the least
 * amount of scrim (the room's own base colour laid over the photo) that keeps
 * body text at WCAG AA - 4.5:1 - over the worst region for the current theme.
 * The member's dim slider can go darker than that, never lighter.
 *
 * The functions in this first section are pure and are unit-tested, including
 * a property test over thousands of random photos.
 *
 * ## Why the photo never leaves the device
 *
 * It is stored in this browser's IndexedDB and nowhere else. Uploading it would
 * mean opening the storage bucket to every member (it is admin/editor-only
 * today), a public URL for every personal photo, a moderation surface for
 * images only one person ever sees, and a round trip before the room can paint.
 * A wallpaper is a per-device display preference - the same reasoning that
 * keeps the theme in localStorage - and "never uploaded" is also simply the
 * better promise to make about someone's personal photo.
 */

/** An sRGB colour, each channel 0-255. */
export type Rgb = readonly [number, number, number];

export type WallpaperTheme = "dark" | "light";

/**
 * What the scrim is painted with, and what the text it must protect looks
 * like, per theme. These are the room's real values:
 *
 * - dark scrim  = `ink` #08080a, the site's near-black base
 * - dark text   = `text-zinc-200` #e4e4e7, what `MessageBody` renders
 * - light scrim = #eef1f6, the light page colour
 * - light text  = #26262c, the light-theme override of `.text-zinc-200`
 *                 in globals.css
 *
 * If either text colour changes, these must change with it - the test pins
 * them against the stylesheet for exactly that reason.
 */
export const WALLPAPER_THEME: Record<WallpaperTheme, { scrim: Rgb; text: Rgb }> = {
  dark: { scrim: [8, 8, 10], text: [228, 228, 231] },
  light: { scrim: [238, 241, 246], text: [38, 38, 44] },
};

/** WCAG AA for body text. */
export const TARGET_CONTRAST = 4.5;

/** The darkest a member may dim their photo. Past this it is just the base. */
export const DIM_MAX = 0.9;

/** sRGB channel (0-255) to linear light (0-1). */
export function channelToLinear(c255: number): number {
  const c = c255 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * channelToLinear(rgb[0]) +
    0.7152 * channelToLinear(rgb[1]) +
    0.0722 * channelToLinear(rgb[2])
  );
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * A scrim of `alpha` laid over `under`.
 *
 * Per channel in sRGB space, because that is how a browser blends an rgba()
 * layer over an image by default - not in linear light. Computing it in linear
 * space would predict a brighter result than the screen shows and let a floor
 * through that is too low.
 */
export function composite(under: Rgb, scrim: Rgb, alpha: number): Rgb {
  const a = Math.min(1, Math.max(0, alpha));
  return [
    a * scrim[0] + (1 - a) * under[0],
    a * scrim[1] + (1 - a) * under[1],
    a * scrim[2] + (1 - a) * under[2],
  ];
}

/**
 * The least scrim that keeps text readable over `worst`.
 *
 * `worst` is the photo region that threatens this theme's text most: the
 * BRIGHTEST region for light text in dark mode, the DARKEST for dark text in
 * light mode. Contrast is monotonic in alpha along that line, so a binary
 * search is exact to far below a pixel's worth of difference.
 *
 * ⚠️ Rounded UP to the next hundredth. The value is shown on a slider and
 * stored at two decimals; rounding to nearest could land a hair under the true
 * floor, and "a hair under AA" is still under AA.
 */
export function minScrimAlpha(worst: Rgb, theme: WallpaperTheme): number {
  const { scrim, text } = WALLPAPER_THEME[theme];
  if (contrastRatio(text, worst) >= TARGET_CONTRAST) return 0;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (contrastRatio(text, composite(worst, scrim, mid)) >= TARGET_CONTRAST) hi = mid;
    else lo = mid;
  }
  return Math.min(1, Math.ceil(hi * 100) / 100);
}

/** Which measured region a theme has to defend against. */
export function worstRegionFor(theme: WallpaperTheme, regions: { bright: Rgb; dark: Rgb }): Rgb {
  return theme === "dark" ? regions.bright : regions.dark;
}

/**
 * The dim actually applied: the member's choice, but never under the floor.
 *
 * Their preference is kept as they set it rather than being overwritten by the
 * floor, so switching theme and back does not silently lose it.
 */
export function effectiveDim(userDim: number, floor: number): number {
  const want = Number.isFinite(userDim) ? userDim : floor;
  return Math.min(DIM_MAX, Math.max(floor, want));
}

/**
 * Everything the room and the sheet need about a photo's readability, from one
 * calculation - so the slider's floor, the dim actually applied and the
 * contrast shown to the member can never disagree with each other.
 */
export function photoReadability(
  regions: { bright: Rgb; dark: Rgb },
  userDim: number,
  theme: WallpaperTheme
): { floor: number; dim: number; contrast: number } {
  const worst = worstRegionFor(theme, regions);
  const floor = minScrimAlpha(worst, theme);
  const dim = effectiveDim(userDim, floor);
  const { scrim, text } = WALLPAPER_THEME[theme];
  return { floor, dim, contrast: contrastRatio(text, composite(worst, scrim, dim)) };
}

// ────────────────────────────────────────────────────────────────────────────
// Encoding (browser only)
// ────────────────────────────────────────────────────────────────────────────

/** Longest edge the stored photo keeps. ~2x a desktop chat column. */
export const WALLPAPER_MAX_EDGE = 1600;

/** Refuse anything larger before even trying to decode it. */
export const WALLPAPER_MAX_INPUT_BYTES = 20 * 1024 * 1024;

export type PreparedWallpaper = {
  blob: Blob;
  bright: Rgb;
  dark: Rgb;
  width: number;
  height: number;
};

/** A message a member can act on, rather than an exception name. */
export class WallpaperError extends Error {}

/**
 * Turn a picked file into a wallpaper.
 *
 * ## Why not `compressImage`
 *
 * ⚠️ The site's existing `compressImage` is built for uploads, and two of its
 * choices are wrong here:
 *
 * - it passes **GIFs through untouched** - an animated wallpaper repaints
 *   behind a scrolling list on every frame;
 * - on any failure it **returns the original file** - fine when the server
 *   caps the size, but here that would store a raw 20 MB photo in the browser.
 *
 * So this always decodes, always draws ONE frame (which flattens a GIF), always
 * re-encodes, and refuses rather than falling back.
 *
 * Transparent PNGs are flattened onto the dark base first, so what gets
 * measured is what actually shows.
 */
export async function prepareWallpaper(file: File): Promise<PreparedWallpaper> {
  if (!file.type.startsWith("image/")) {
    throw new WallpaperError("That file is not an image.");
  }
  if (file.size > WALLPAPER_MAX_INPUT_BYTES) {
    throw new WallpaperError("That photo is over 20 MB. Please pick a smaller one.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Most often HEIC in a browser that cannot decode it.
    throw new WallpaperError("This browser can't open that photo. Try a JPG or PNG.");
  }

  const scale = Math.min(1, WALLPAPER_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    throw new WallpaperError("Couldn't prepare that photo. Please try again.");
  }
  const [r, g, b] = WALLPAPER_THEME.dark.scrim;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const regions = measureRegions(canvas);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new WallpaperError("Couldn't prepare that photo. Please try again.");

  return { blob, ...regions, width: w, height: h };
}

/**
 * The brightest and darkest REGIONS of the image.
 *
 * Downsampled to a 64x64 grid. Measuring single pixels would let one specular
 * highlight force a heavy dim over an otherwise dark photo; measuring the
 * whole-image average would miss the bright sky a line of text lands on. The
 * region is the unit text actually sits on.
 *
 * ⚠️ 64, not 32, and the reason is `object-cover`. A 1600px landscape photo
 * shown in a portrait phone chat is scaled UP to fill the height and cropped,
 * so each grid cell covers more screen than the grid suggests. At 32 a cell
 * displayed at ~40px - two lines of text - and a bright patch smaller than
 * that could sit under one line unmeasured. At 64 a cell displays at ~20px on
 * both phone and desktop, which is one line of text.
 *
 * Measured with blur OFF: blurring only averages neighbours, which can make a
 * region less extreme but never more, so the unblurred floor stays valid when
 * the member turns blur on.
 */
function measureRegions(source: HTMLCanvasElement): { bright: Rgb; dark: Rgb } {
  const n = 64;
  const small = document.createElement("canvas");
  small.width = n;
  small.height = n;
  const sctx = small.getContext("2d");
  if (!sctx) {
    // Unknown means assume the worst for both themes.
    return { bright: [255, 255, 255], dark: [0, 0, 0] };
  }
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(source, 0, 0, n, n);
  const { data } = sctx.getImageData(0, 0, n, n);

  let bright: Rgb = [0, 0, 0];
  let dark: Rgb = [255, 255, 255];
  let bl = -1;
  let dl = 2;
  for (let i = 0; i < data.length; i += 4) {
    const px: Rgb = [data[i]!, data[i + 1]!, data[i + 2]!];
    const l = relativeLuminance(px);
    if (l > bl) {
      bl = l;
      bright = px;
    }
    if (l < dl) {
      dl = l;
      dark = px;
    }
  }
  return { bright, dark };
}

// ────────────────────────────────────────────────────────────────────────────
// The on-device store (IndexedDB)
// ────────────────────────────────────────────────────────────────────────────

const DB_NAME = "xyz-chat";
const DB_VERSION = 1;
const STORE = "wallpaper";
const KEY = "custom";

export type StoredWallpaper = {
  blob: Blob;
  bright: Rgb;
  dark: Rgb;
  width: number;
  height: number;
  savedAt: number;
};

/**
 * IndexedDB, not localStorage. A photo is a Blob of a few hundred KB;
 * localStorage holds strings, is capped around 5 MB for the whole origin, and
 * is synchronous - base64-encoding a photo into it would block the main thread
 * on every page load that reads it.
 */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new WallpaperError("This browser can't store a photo for the chat."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    // Private browsing in some engines refuses IndexedDB outright.
    req.onerror = () =>
      reject(new WallpaperError("This browser won't let the page keep a photo (private browsing?)."));
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new WallpaperError("Couldn't save that photo."));
      t.onabort = () => reject(t.error ?? new WallpaperError("Couldn't save that photo."));
    });
  } finally {
    db.close();
  }
}

export async function saveWallpaper(w: PreparedWallpaper): Promise<void> {
  const record: StoredWallpaper = { ...w, savedAt: Date.now() };
  try {
    await tx("readwrite", (s) => s.put(record, KEY));
  } catch (err) {
    // Quota exceeded is the realistic failure; say so plainly.
    if (err instanceof WallpaperError) throw err;
    throw new WallpaperError("There isn't room to keep that photo in this browser.");
  }
}

export async function loadWallpaper(): Promise<StoredWallpaper | null> {
  try {
    const rec = await tx<StoredWallpaper | undefined>("readonly", (s) => s.get(KEY));
    if (!rec || !(rec.blob instanceof Blob)) return null;
    return rec;
  } catch {
    // Unavailable storage reads as "no photo", which is true for this device.
    return null;
  }
}

export async function deleteWallpaper(): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(KEY));
  } catch {
    // Nothing stored, or nothing storable: either way there is no photo.
  }
}
