import { redirect, notFound } from "next/navigation";
import { DEX_REGISTRY } from "@modules/markets/lib/dex-registry";

/**
 * A short, shareable address for one programme: `/points/Variational`.
 *
 * ⚠️ It REDIRECTS rather than rendering its own page, and that is the point.
 * The programme already has a section on `/points` with its live comparables,
 * its cost panel and its outcome grid; a second page would be a second thing to
 * keep correct and would show a reader less than the first one does.
 *
 * So this is an address, not a destination: `/points/Variational` lands on
 * `/points#programme-variational`, which is exactly where the calculator is.
 *
 * Matching is case-insensitive and punctuation-insensitive, because a URL typed
 * or pasted by a human will not respect either - `/points/risex`,
 * `/points/RiseX` and `/points/Rise-X` all have to work.
 */
export function generateStaticParams() {
  // Prerendered, so the redirect is static rather than a function invocation per
  // share click. One entry per programme; the list is a TypeScript array, not a
  // query, so this costs nothing at build time.
  return DEX_REGISTRY.map((p) => ({ venue: p.id }));
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export default async function PointsVenuePage(props: { params: Promise<{ venue: string }> }) {
  const { venue } = await props.params;
  const wanted = key(decodeURIComponent(venue));
  if (!wanted) notFound();

  const hit = DEX_REGISTRY.find((p) => key(p.id) === wanted || key(p.name) === wanted);

  // ⚠️ An unknown venue goes to `/points`, not to a 404. These links are
  // SHARED - they outlive the registry entry they were made from - and dropping
  // someone on an error page because a programme was renamed is a worse answer
  // than the page they were trying to reach.
  if (!hit) redirect("/points");

  redirect(`/points#programme-${hit.id}`);
}
