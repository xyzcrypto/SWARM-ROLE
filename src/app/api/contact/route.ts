import { z } from "zod";
import { ok, fail, handleError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { sendEmail } from "@/lib/email";
import { site } from "@/lib/site";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  message: z.string().trim().min(10, "Message is a little short").max(2000, "Message is too long"),
});

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// POST /api/contact - public contact form. Emails the site owner via Resend
// (logs to console when email isn't configured). Own rate bucket: sharing with
// subscribe meant /track pings from the same NAT could 429 real submissions.
export async function POST(req: Request) {
  try {
    const { success } = await rateLimit("contact", clientIp(req));
    if (!success) return fail("Too many attempts. Please try again shortly.", 429);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const { name, email, message } = parsed.data;

    const subject = `New contact message from ${name}`;
    const text = `From: ${name} <${email}>\n\n${message}`;
    const html = `<!doctype html><html><body style="margin:0;background:#0a0a0b;font-family:Arial,Helvetica,sans-serif;color:#e4e4e7;padding:24px">
      <div style="max-width:520px;margin:0 auto;background:#141417;border:1px solid #26262b;border-radius:16px;padding:24px 28px">
        <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:14px">XYZ <span style="color:#e0b341">Crypto</span> · Contact</div>
        <p style="font-size:13px;color:#a1a1aa;margin:0 0 4px"><b style="color:#e4e4e7">From:</b> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
        <p style="font-size:14px;color:#e4e4e7;white-space:pre-wrap;line-height:1.6;margin:14px 0 0">${escapeHtml(message)}</p>
      </div>
    </body></html>`;

    const sent = await sendEmail(site.email, subject, html, text);
    if (!sent.ok) return fail("Could not send your message right now. Please try again.", 502);

    return ok({ ok: true });
  } catch (err) {
    return handleError(err, "contact");
  }
}
