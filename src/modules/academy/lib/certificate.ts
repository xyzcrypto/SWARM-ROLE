import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { CERT_CODE_RE, ordinal } from "./engine";

export const ISSUER = {
  name: "XYZ Crypto",
  unit: "XYZ Crypto Academy",
  signatory: "XYZ Crypto Academy Board",
  contact: "hi@xyzcrypto.io",
  site: "xyzcrypto.io",
};

export const verifyUrl = (code: string) => `${SITE_URL}/academy/certificate/${code}`;

export async function getCertificate(code: string) {
  if (!CERT_CODE_RE.test(code)) return null;
  const c = await prisma.academyCertificate.findUnique({
    where: { code },
    select: { code: true, kind: true, periodKey: true, title: true, displayName: true, rank: true, score: true, status: true, issuedAt: true, template: true, user: { select: { username: true } } },
  });
  return c;
}

export type CertificateView = NonNullable<Awaited<ReturnType<typeof getCertificate>>>;

/** "Weekly Quiz Champion, week 2026-W47" style subtitle. */
export function achievementLine(c: { kind: string; periodKey: string; rank: number }) {
  const place = `${ordinal(c.rank)} place`;
  switch (c.kind) {
    case "daily":
      return `${place} on the daily leaderboard of ${c.periodKey} (UTC)`;
    case "weekly":
      return `${place} on the weekly leaderboard, week ${c.periodKey.replace("-W", ", week ")}`.replace(/week (\d{4}), week/, "$1, week");
    case "monthly":
      return `${place} on the monthly leaderboard of ${new Date(`${c.periodKey}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`;
    case "live":
      return `${place} in an XYZ Crypto Academy live quiz`;
    default:
      return c.rank > 0 ? `${place}, ${c.periodKey.replace(/^event:/, "")}` : c.periodKey.replace(/^event:/, "");
  }
}

export async function qrSvg(code: string) {
  return QRCode.toString(verifyUrl(code), { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#f3d488", light: "#00000000" } });
}

// ------------------------------------------------------------------ PDF

const GOLD = rgb(0.886, 0.655, 0.184);
const GOLD_LIGHT = rgb(0.953, 0.831, 0.533);
const INK = rgb(0.031, 0.031, 0.039);
const INK2 = rgb(0.082, 0.082, 0.102);
const MUTED = rgb(0.62, 0.62, 0.66);
const WHITE = rgb(0.96, 0.96, 0.97);

function centered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = WHITE) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - w) / 2, y, size, font, color });
}

function fit(text: string, font: PDFFont, max: number, size: number) {
  let s = size;
  while (s > 14 && font.widthOfTextAtSize(text, s) > max) s -= 1;
  return s;
}

/** A4 landscape, vector text, embedded QR. Dark luxe to match the site. */
export async function certificatePdf(c: CertificateView): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${c.title} - ${c.displayName}`);
  pdf.setAuthor(ISSUER.unit);
  pdf.setSubject(`Certificate ${c.code}`);
  pdf.setCreator(ISSUER.site);
  const page = pdf.addPage([842, 595]);
  const W = page.getWidth();
  const H = page.getHeight();
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanBoldItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: INK });
  // soft vignette bands
  for (let i = 0; i < 18; i++) {
    page.drawRectangle({ x: 0, y: H - 140 + i * 8, width: W, height: 8, color: GOLD, opacity: 0.006 * (18 - i) });
  }
  // frames
  page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, borderColor: GOLD, borderWidth: 1.4, opacity: 0 });
  page.drawRectangle({ x: 30, y: 30, width: W - 60, height: H - 60, borderColor: GOLD, borderWidth: 0.5, borderOpacity: 0.55, opacity: 0 });
  page.drawRectangle({ x: 30, y: 30, width: W - 60, height: H - 60, color: INK2, opacity: 0.35 });
  // corner marks
  for (const [x, y, dx, dy] of [
    [38, H - 38, 1, -1],
    [W - 38, H - 38, -1, -1],
    [38, 38, 1, 1],
    [W - 38, 38, -1, 1],
  ] as const) {
    page.drawLine({ start: { x, y }, end: { x: x + 34 * dx, y }, thickness: 1.6, color: GOLD_LIGHT });
    page.drawLine({ start: { x, y }, end: { x, y: y + 34 * dy }, thickness: 1.6, color: GOLD_LIGHT });
  }

  // logo
  try {
    // public/ is not always traced into the serverless bundle; fall back to the CDN copy.
    const png = await readFile(join(process.cwd(), "public", "logo.png")).catch(async () => {
      const r = await fetch(`${SITE_URL}/logo.png`, { signal: AbortSignal.timeout(3000) });
      if (!r.ok) throw new Error("logo");
      return Buffer.from(await r.arrayBuffer());
    });
    const img = await pdf.embedPng(png);
    const s = 46 / img.height;
    page.drawImage(img, { x: W / 2 - (img.width * s) / 2, y: H - 108, width: img.width * s, height: 46 });
  } catch {
    /* logo missing: the wordmark below still identifies the issuer */
  }
  centered(page, "XYZ CRYPTO ACADEMY", H - 128, sansBold, 10, GOLD);

  centered(page, "CERTIFICATE OF ACHIEVEMENT", H - 176, serif, 30, GOLD_LIGHT);
  page.drawLine({ start: { x: W / 2 - 70, y: H - 190 }, end: { x: W / 2 + 70, y: H - 190 }, thickness: 0.8, color: GOLD });
  centered(page, "This certifies that", H - 222, sans, 12, MUTED);
  const nameSize = fit(c.displayName, serifItalic, W - 220, 46);
  centered(page, c.displayName, H - 272, serifItalic, nameSize, WHITE);
  page.drawLine({ start: { x: W / 2 - 200, y: H - 286 }, end: { x: W / 2 + 200, y: H - 286 }, thickness: 0.5, color: GOLD, opacity: 0.6 });
  centered(page, "has been awarded the title of", H - 314, sans, 12, MUTED);
  centered(page, c.title.toUpperCase(), H - 346, serif, fit(c.title.toUpperCase(), serif, W - 200, 26), GOLD_LIGHT);
  centered(page, achievementLine(c), H - 372, sans, 11.5, WHITE);
  centered(page, `Final rank: #${c.rank}     Score: ${c.score.toLocaleString("en-US")}`, H - 394, sans, 11, MUTED);

  // footer: issue date | signature | QR
  const issued = c.issuedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  page.drawText("ISSUED", { x: 80, y: 120, size: 8, font: sansBold, color: GOLD });
  page.drawText(issued, { x: 80, y: 103, size: 12, font: sans, color: WHITE });
  page.drawText("CERTIFICATE ID", { x: 80, y: 80, size: 8, font: sansBold, color: GOLD });
  page.drawText(c.code, { x: 80, y: 64, size: 12, font: mono, color: WHITE });

  page.drawLine({ start: { x: W / 2 - 95, y: 104 }, end: { x: W / 2 + 95, y: 104 }, thickness: 0.6, color: GOLD });
  centered(page, ISSUER.signatory, 88, serifItalic, 13, WHITE);
  centered(page, `Issued by ${ISSUER.name}  ·  ${ISSUER.site}`, 72, sans, 8.5, MUTED);

  const qr = await QRCode.toBuffer(verifyUrl(c.code), { type: "png", margin: 1, width: 300, errorCorrectionLevel: "M", color: { dark: "#08080aff", light: "#f3d488ff" } });
  const qrImg = await pdf.embedPng(qr);
  page.drawImage(qrImg, { x: W - 80 - 78, y: 58, width: 78, height: 78 });
  page.drawText("Scan to verify", { x: W - 80 - 78, y: 46, size: 7.5, font: sans, color: MUTED });
  const url = verifyUrl(c.code).replace(/^https?:\/\//, "");
  const us = fit(url, sans, 220, 7);
  page.drawText(url, { x: W - 80 - sans.widthOfTextAtSize(url, us), y: 36, size: us, font: sans, color: MUTED });

  if (c.status !== "issued") {
    centered(page, c.status === "revoked" ? "REVOKED" : "PENDING APPROVAL", H / 2 - 20, sansBold, 64, rgb(0.97, 0.44, 0.44));
  }
  return pdf.save();
}
