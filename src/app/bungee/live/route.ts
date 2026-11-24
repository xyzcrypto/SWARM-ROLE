import { NextResponse } from "next/server";
import { currentBungeeLiveId } from "@modules/giveaway/lib/entry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// xyzcrypto.io/bungee/live - the one link to share for Bungee live quizzes.
// Sends people to the Bungee quiz that is live now, else the next scheduled
// one, else the latest finished one (its results), else the live list.
// A 30s edge window: everyone clicking a shared link in the same minute costs
// one lookup, and a quiz going live is picked up within half a minute.
export async function GET(req: Request) {
  let path = "/academy/live";
  try {
    const id = await currentBungeeLiveId();
    if (id) path = `/academy/live/${id}`;
  } catch {
    /* fall back to the list */
  }
  const res = NextResponse.redirect(new URL(path, req.url), 307);
  res.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=30");
  return res;
}
