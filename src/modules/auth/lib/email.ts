import * as Sentry from "@sentry/nextjs";
import { env, emailEnabled } from "@/lib/env";

type SendResult = { ok: boolean; dev?: boolean };

/**
 * Send a transactional email via Resend. If RESEND_API_KEY is not configured,
 * the email is logged to the server console instead (so OTP flows still work
 * for local/testing) and we report success.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<SendResult> {
  if (!emailEnabled) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[email:dev] to=${to}\n[email:dev] subject=${subject}\n[email:dev] ${text}\n`);
    } else {
      // Never dump message bodies (OTP codes, contact messages) into prod logs.
      console.warn(`[email] RESEND_API_KEY not set - email to ${to} ("${subject}") was NOT sent.`);
    }
    return { ok: true, dev: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // Most common cause: EMAIL_FROM is the Resend test sender
      // (onboarding@resend.dev), which only delivers to the account owner.
      // Verify your domain in Resend and set EMAIL_FROM to it.
      const recipientDomain = to.split("@")[1] ?? "unknown";
      console.error(
        `[email] Resend send failed status=${res.status} from=${env.EMAIL_FROM} toDomain=${recipientDomain}: ${body}`
      );
      Sentry.captureMessage(`Resend send failed (${res.status})`, {
        level: "error",
        tags: { area: "email", status: String(res.status), recipientDomain },
        extra: { body, from: env.EMAIL_FROM },
      });
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] Resend request error", err);
    Sentry.captureException(err, { tags: { area: "email" } });
    return { ok: false };
  }
}

/** Branded one-time-code email. */
export function otpEmail(code: string, purpose: "signup" | "login" | "reset") {
  const action =
    purpose === "reset"
      ? "reset your password"
      : purpose === "signup"
        ? "verify your email"
        : "sign in";
  const subject = `${code} is your XYZ Crypto verification code`;
  const text = `Your XYZ Crypto code to ${action} is ${code}. It expires in 10 minutes. If you didn't request this, you can safely ignore this email.`;
  const html = `<!doctype html><html><body style="margin:0;background:#0a0a0b;font-family:Arial,Helvetica,sans-serif;color:#e4e4e7">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="background:#141417;border:1px solid #26262b;border-radius:16px;overflow:hidden">
        <tr><td style="padding:28px 32px 8px">
          <div style="font-size:18px;font-weight:700;color:#fff">XYZ <span style="color:#e0b341">Crypto</span></div>
        </td></tr>
        <tr><td style="padding:8px 32px 0">
          <p style="font-size:15px;color:#a1a1aa;margin:0 0 18px">Use this code to ${action}:</p>
          <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#fff;background:#0f0f11;border:1px solid #2b2b31;border-radius:12px;padding:18px 0;text-align:center">${code}</div>
          <p style="font-size:13px;color:#71717a;margin:18px 0 0">This code expires in <b style="color:#a1a1aa">10 minutes</b>. If you didn't request it, ignore this email.</p>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #26262b;margin-top:20px">
          <p style="font-size:11px;color:#52525b;margin:0">© XYZ Crypto - Built for the Next Generation of Web3</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
  return { subject, html, text };
}
