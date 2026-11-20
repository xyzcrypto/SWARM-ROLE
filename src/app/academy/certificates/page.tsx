import type { Metadata } from "next";
import { MyCertificates } from "@modules/academy/components/MyCertificates";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Certificates | XYZ Crypto Academy",
  description: "Official XYZ Crypto certificates for daily, weekly and monthly champions and live quiz winners. Every certificate can be verified publicly.",
  path: "/academy/certificates",
});

export default function CertificatesPage() {
  return <MyCertificates />;
}
