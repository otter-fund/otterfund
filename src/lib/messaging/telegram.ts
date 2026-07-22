import { timingSafeEqual } from "node:crypto";
import type { MessagingAdapter } from "./types";
import { telegramChunks, stripTelegramHtml } from "./format";

// Telegram Bot API adapter. Set up a bot via @BotFather → TELEGRAM_BOT_TOKEN +
// TELEGRAM_BOT_USERNAME. On every update Telegram sends the secret we registered
// with setWebhook in the X-Telegram-Bot-API-Secret-Token header, which is how we
// authenticate the webhook (no per-request signing).

const API = "https://api.telegram.org";

const botToken = () => process.env.TELEGRAM_BOT_TOKEN;

async function call(method: string, body: unknown): Promise<Response | null> {
  const t = botToken();
  if (!t) return null;
  return fetch(`${API}/bot${t}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

interface TgUpdate {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: string;
    chat?: { id?: number | string };
  };
}

export const telegramAdapter: MessagingAdapter = {
  provider: "telegram",

  isConfigured() {
    return !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_BOT_USERNAME;
  },

  verify(request) {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret) return false; // not configured → never process unsigned traffic
    const header = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
    return safeEqual(header, secret);
  },

  parse(rawBody) {
    let update: TgUpdate;
    try {
      update = JSON.parse(rawBody) as TgUpdate;
    } catch {
      return [];
    }
    const m = update.message;
    const chatId = m?.chat?.id;
    if (!m || typeof m.text !== "string" || chatId == null) return []; // ignore non-text updates
    return [
      {
        providerChatId: String(chatId),
        text: m.text,
        eventId: String(update.update_id ?? `${chatId}:${m.message_id}`),
      },
    ];
  },

  async send(chatId, text) {
    for (const chunk of telegramChunks(text)) {
      const res = await call("sendMessage", {
        chat_id: chatId,
        text: chunk,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      // If Telegram rejects our HTML (some edge-case tag), resend as plain text so
      // the user still gets the answer rather than nothing.
      if (res && !res.ok) {
        await call("sendMessage", {
          chat_id: chatId,
          text: stripTelegramHtml(chunk),
          disable_web_page_preview: true,
        });
      }
    }
  },

  async typing(chatId) {
    await call("sendChatAction", { chat_id: chatId, action: "typing" });
  },

  deepLink(token) {
    const bot = process.env.TELEGRAM_BOT_USERNAME ?? "";
    return `https://t.me/${bot}?start=${token}`;
  },
};

/**
 * One-time (idempotent) webhook registration: point Telegram at our receiver and
 * hand it the secret it must echo back. Called from the admin dev route. Safe to
 * re-run — setWebhook just overwrites the current registration.
 */
export async function registerTelegramWebhook(): Promise<{ ok: boolean; description?: string }> {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!botToken() || !site || !secret) {
    return { ok: false, description: "Set TELEGRAM_BOT_TOKEN, NEXT_PUBLIC_SITE_URL, and TELEGRAM_WEBHOOK_SECRET first." };
  }
  const res = await call("setWebhook", {
    url: `${site.replace(/\/$/, "")}/api/webhooks/telegram`,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
  if (!res) return { ok: false, description: "Telegram is not configured." };
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  return { ok: !!data.ok, description: data.description };
}
