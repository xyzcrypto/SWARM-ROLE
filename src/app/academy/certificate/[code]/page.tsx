import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { achievementLine, getCertificate, ISSUER, qrSvg, verifyUrl } from "@modules/academy/lib/certificate";
import { CertificateView } from "@modules/academy/components/CertificateView";

// Public verification page. Cached for an hour; issuing, approving or revoking
// a certificate revalidates its path, so the status shown is current.
export const revalidate = 3600;

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const c = await getCertificate(code).catch(() => null);
  if (!c) return { title: "Certificate not found", robots: { index: false } };
  const title = `${c.displayName}: ${c.title} | XYZ Crypto Academy`;
  const description = `Verified XYZ Crypto Academy certificate ${c.code}. ${achievementLine(c)}.`;
  return { title, description, openGraph: { title, description, url: verifyUrl(c.code) }, twitter: { title, description }, robots: { index: false } };
}

export default async function CertificatePage({ params }: Props) {
  const { code } = await params;
  const c = await getCertificate(code.toUpperCase());
  if (!c) notFound();
  return (
    <CertificateView
      cert={{
        code: c.code,
        kind: c.kind,
        title: c.title,
        displayName: c.displayName,
        rank: c.rank,
        score: c.score,
        status: c.status,
        issuedAt: c.issuedAt.toISOString(),
        line: achievementLine(c),
        username: c.user.username,
      }}
      issuer={ISSUER}
      url={verifyUrl(c.code)}
      qr={await qrSvg(c.code)}
    />
  );
}
