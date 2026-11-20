import type { Metadata } from "next";
import { LiveArena } from "@modules/academy/components/LiveArena";

export const metadata: Metadata = { title: "Live Quiz | XYZ Crypto Academy", robots: { index: false } };

// The arena is entirely client-driven from /api/academy/live/:id, so this page
// reads nothing on the server.
export default async function LiveArenaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveArena id={id} />;
}
