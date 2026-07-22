import { createHmac, timingSafeEqual } from "node:crypto";
import type { InboundMessage, MessagingAdapter } from "./types";
import { whatsappChunks } from "./format";

// WhatsApp Cloud API (Meta Graph API) adapter. Requires a Meta Business +
// WhatsApp app: WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN to send,
// WHATSAPP_APP_SECRET to verify inbound signatures, WHATSAPP_BUSINESS_NUMBER for
// the wa.me connect link. The GET verification challenge (WHATSAPP_VERIFY_TOKEN)
// is handled in the webhook route, not here.

const GRAPH = "https://graph.facebook.com/v21.0";

const phoneNumberId = () => process.env.WHATSAPP_PHONE_NUMBER_ID;
const accessToken = () => process.env.WHATSAPP_ACCESS_TOKEN;

interface WaPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string; // sender wa_id (reply target)
          id?: string; // message id (idempotency)
          type?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
}

export const whatsappAdapter: MessagingAdapter = {
  provider: "whatsapp",

  isConfigured() {
    return (
      !!process.env.WHATSAPP_PHONE_NUMBER_ID &&
      !!process.env.WHATSAPP_ACCESS_TOKEN &&
      !!process.env.WHATSAPP_APP_SECRET &&
      !!process.env.WHATSAPP_BUSINESS_NUMBER
    );
  },

  verify(request, rawBody) {
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!secret) return false;
    const header = request.headers.get("x-hub-signature-256") ?? "";
    // Meta signs the RAW request body with the app secret (HMAC-SHA256).
    const expected = "sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  },

  parse(rawBody) {
    let payload: WaPayload;
    try {
      payload = JSON.parse(rawBody) as WaPayload;
    } catch {
      return [];
    }
    const out: InboundMessage[] = [];
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const m of change.value?.messages ?? []) {
          if (m.type === "text" && m.text?.body && m.from && m.id) {
            out.push({ providerChatId: m.from, text: m.text.body, eventId: m.id });
          }
        }
      }
    }
    return out;
  },

  async send(chatId, text) {
    const id = phoneNumberId();
    const tok = accessToken();
    if (!id || !tok) return;
    for (const chunk of whatsappChunks(text)) {
      await fetch(`${GRAPH}/${id}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: chatId,
          type: "text",
          text: { body: chunk, preview_url: false },
        }),
      }).catch(() => {});
    }
  },

  deepLink(token) {
    const number = (process.env.WHATSAPP_BUSINESS_NUMBER ?? "").replace(/[^\d]/g, "");
    return `https://wa.me/${number}?text=${encodeURIComponent(`otterfund link ${token}`)}`;
  },
};
