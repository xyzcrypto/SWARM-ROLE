import "server-only";
import { env, telegramEnabled } from "@/lib/env";

function redactBotToken(str: string): string {
  if (!env.TELEGRAM_BOT_TOKEN) return str;
  return str.split(env.TELEGRAM_BOT_TOKEN).join("[REDACTED]");
}

// Minimal Telegram Bot API sender for XYZ Sentinel owner alerts. No SDK - a
// single fetch to the Bot API. No-op (returns false) when the bot token / chat
// id aren't configured, so the caller never has to guard. Never throws.
export async function sendTelegram(text: string): Promise<boolean> {
  if (!telegramEnabled) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[telegram] sendMessage failed", res.status, redactBotToken(detail));
      return false;
    }
    return true;
  } catch (err) {
    const msg = (err as Error)?.message ? redactBotToken((err as Error).message) : "unknown error";
    console.error("[telegram] send error:", msg);
    return false;
  }
}

