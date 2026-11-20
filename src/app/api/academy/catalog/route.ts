import { getCatalog } from "@modules/academy/lib/store";
import { academyError, json, PUBLIC } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/academy/catalog - every published topic with its lessons. Identical
// for every visitor and edited rarely (admin edits do not need to show within
// seconds), so the edge holds it for 5 minutes. Not polled.
export async function GET() {
  try {
    return json({ categories: await getCatalog() }, PUBLIC(300, 3600));
  } catch (err) {
    return academyError(err, "academy:catalog");
  }
}
