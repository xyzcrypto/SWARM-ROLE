// Shared by /feedback and the giveaway form: shrink a screenshot in the
// browser before it is sent as a data URL (the API caps it at ~1.4 MB).

/** Downscale to <= 1600px and re-encode as JPEG (about 150-500 KB). */
export async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(img, 0, 0, w, h);
    let q = 0.82;
    let out = canvas.toDataURL("image/jpeg", q);
    while (out.length > 900_000 && q > 0.45) {
      q -= 0.12;
      out = canvas.toDataURL("image/jpeg", q);
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
