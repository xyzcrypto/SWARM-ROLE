import { achievementLine, getCertificate } from "@modules/academy/lib/certificate";
import { CARD_SIZE, shareCard } from "@modules/academy/lib/share-card";

// The link preview for a shared certificate (X, WhatsApp, Telegram, LinkedIn).
export const size = CARD_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;
export const alt = "XYZ Crypto Academy certificate";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const c = await getCertificate(code.toUpperCase()).catch(() => null);
  if (!c) return shareCard({ eyebrow: "CERTIFICATE", title: "Verified certificates", name: "XYZ Crypto Academy", stats: [{ label: "Issued for", value: "Top ranks" }, { label: "Verify", value: "By QR" }, { label: "Price", value: "Free" }] }, "public, s-maxage=60");
  const valid = c.status === "issued";
  return shareCard(
    {
      eyebrow: valid ? "VERIFIED CERTIFICATE" : c.status === "revoked" ? "REVOKED CERTIFICATE" : "PENDING CERTIFICATE",
      title: c.title,
      name: c.displayName,
      subtitle: achievementLine(c),
      badge: `#${c.rank}`,
      stats: [
        { label: "Final rank", value: `#${c.rank}` },
        { label: "Score", value: c.score.toLocaleString("en-US") },
        { label: "ID", value: c.code },
      ],
      footer: `xyzcrypto.io/academy/certificate/${c.code}`,
    },
    "public, s-maxage=3600, stale-while-revalidate=86400"
  );
}
