import "server-only";
import { env, telegramEnabled } from "@/lib/env";

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
    });
    if (!res.ok) {
      console.error("[telegram] sendMessage failed", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[telegram] send error", err);
    return false;
  }
}
