import { ok, fail, handleError, getSessionUser } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { env, gifEnabled } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Gif = { id: string; url: string; preview: string; width: number; height: number };

// GET /api/chat/gif?q=<query> - GIF search for the community composer (everyone).
// Proxies Giphy so the API key stays server-side. Empty query -> trending.
// Graceful: 503 when no GIPHY_API_KEY is configured (the picker hides itself).
export async function GET(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me) return fail("Please log in.", 401);
    if (!gifEnabled) return fail("GIFs are not available right now.", 503);

    const { success } = await rateLimit("chat", me.id);
    if (!success) return fail("Slow down a moment.", 429);

    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    const base = q
      ? `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(q)}&limit=24&rating=pg-13&bundle=messaging_non_clips`
      : `https://api.giphy.com/v1/gifs/trending?limit=24&rating=pg-13&bundle=messaging_non_clips`;
    const url = `${base}&api_key=${env.GIPHY_API_KEY}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return fail("Couldn't load GIFs. Try again.", 502);
    const json = (await res.json().catch(() => null)) as any;
    const data: any[] = Array.isArray(json?.data) ? json.data : [];

    const gifs: Gif[] = data
      .map((g) => {
        const full = g?.images?.downsized_medium ?? g?.images?.downsized ?? g?.images?.original;
        const prev = g?.images?.fixed_width_small ?? g?.images?.preview_gif ?? full;
        if (!full?.url || !prev?.url) return null;
        return {
          id: String(g.id),
          url: String(full.url),
          preview: String(prev.url),
          width: Number(full.width) || 0,
          height: Number(full.height) || 0,
        };
      })
      .filter(Boolean) as Gif[];

    return ok({ gifs });
  } catch (err) {
    return handleError(err, "chat:gif");
  }
}
