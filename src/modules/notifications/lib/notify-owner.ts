import "server-only";
import { sendEmail } from "@/lib/email";
import { sendTelegram } from "@/lib/telegram";
import { site } from "@/lib/site";

// Fan an operational/security alert out to the owner over every configured
// channel (email via Resend + Telegram bot). Best-effort: each channel is
// independent, failures are swallowed, and it never throws - alerting must never
// take down the caller (e.g. the Sentinel watchdog). Returns which channels
// actually accepted the message.
export async function notifyOwner(opts: {
  subject: string;
  text: string;
  html?: string;
}): Promise<{ email: boolean; telegram: boolean }> {
  const html = opts.html ?? `<p>${escapeHtml(opts.text).replace(/\n/g, "<br>")}</p>`;
  const tgText = `<b>${escapeHtml(opts.subject)}</b>\n${escapeHtml(opts.text)}`;

  const [email, telegram] = await Promise.all([
    sendEmail(site.email, opts.subject, html, opts.text)
      .then((r) => Boolean(r?.ok))
      .catch(() => false),
    sendTelegram(tgText).catch(() => false),
  ]);
  return { email, telegram };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
