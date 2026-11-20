import { fail } from "@/lib/api";
import { certificatePdf, getCertificate } from "@modules/academy/lib/certificate";
import { academyError } from "@modules/academy/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/academy/certificates/:code/pdf - the certificate as an A4 PDF.
// Public like the verification page (the certificate is meant to be shared).
// Cached at the edge for an hour; a revoked certificate's PDF says REVOKED.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const c = await getCertificate(code);
    if (!c) return fail("Certificate not found.", 404);
    const bytes = await certificatePdf(c);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="XYZ-Crypto-Certificate-${c.code}.pdf"`,
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    return academyError(err, "academy:certificate:pdf");
  }
}
