// Shared media-URL detection for chat + DMs. A message is rendered as an inline
// image/GIF ONLY when its whole body is a single trusted media URL: a GIF from
// giphy/tenor (the GIF picker) or an image in OUR Supabase Storage / an inline
// data image (uploads). Arbitrary pasted image links stay plain links.
const GIF_HOSTS = /^https?:\/\/(media\d*\.giphy\.com|i\.giphy\.com|media\.tenor\.com|c\.tenor\.com|tenor\.com)\//i;

export function chatMediaUrl(text: string): string | null {
  const t = text.trim();
  if (/\s/.test(t)) return null; // must be a lone URL, no other text
  if (/^data:image\//.test(t)) return t;
  if (!/^https?:\/\//.test(t)) return null;
  if (GIF_HOSTS.test(t)) return t;
  if (t.includes("/storage/v1/object/public/")) return t;
  return null;
}
