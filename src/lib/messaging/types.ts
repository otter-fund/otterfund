// Provider-agnostic contract for the "text your advisor" channels. A concrete
// adapter (lib/messaging/telegram, lib/messaging/whatsapp) implements this, and
// the inbound webhook handler (lib/messaging/handler) is written against the
// interface — so adding a provider is a new adapter, not new handler logic.

export const MESSAGING_PROVIDERS = ["telegram", "whatsapp"] as const;
export type MessagingProvider = (typeof MESSAGING_PROVIDERS)[number];

export function isMessagingProvider(v: unknown): v is MessagingProvider {
  return typeof v === "string" && (MESSAGING_PROVIDERS as readonly string[]).includes(v);
}

/** A single inbound text message, normalized across providers. */
export interface InboundMessage {
  /** Who sent it — also the reply target (Telegram chat id / WhatsApp wa_id). */
  providerChatId: string;
  /** The message body. Non-text messages (stickers, media) are dropped in parse. */
  text: string;
  /** Provider-unique id for idempotency (Telegram update_id / WhatsApp message id). */
  eventId: string;
}

export interface MessagingAdapter {
  provider: MessagingProvider;
  /** Whether the app is configured for this provider (tokens/secrets present). */
  isConfigured(): boolean;
  /** Verify the request genuinely came from the provider (secret header / HMAC). */
  verify(request: Request, rawBody: string): boolean;
  /** Extract inbound text messages from a verified payload (non-text ignored). */
  parse(rawBody: string): InboundMessage[];
  /** Send a text reply to a chat — formats markdown + chunks to the provider limit. */
  send(chatId: string, text: string): Promise<void>;
  /** Optional "typing…" indicator while the AI thinks. Best-effort. */
  typing?(chatId: string): Promise<void>;
  /** Build the connect deep link that carries the one-time link token. */
  deepLink(token: string): string;
}
