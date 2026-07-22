import type { InboundMessage, MessagingAdapter, MessagingProvider } from "./types";
import {
  recordMessagingEvent,
  activateConnectionByToken,
  getActiveConnectionByChatId,
  setConnectionConversation,
} from "@/lib/db/messaging";
import { runAdvisorTurn } from "@/lib/ai/advisor-turn";
import { planForUser } from "@/lib/graphql/entitlements";
import { canUse, entitlementsFor } from "@/lib/plans";

// The provider-agnostic brain of the inbound flow. A webhook route verifies the
// signature, parses messages, and hands each one here (inside `after()`, so the
// slow AI work never blocks the webhook's 200). Everything below is identical
// across providers — only the adapter differs.

// Plain-text replies (these go to Telegram/WhatsApp, where the <Wordmark/>
// component can't reach — like emails, the literal brand name is fine here). No
// em-dashes, per house style.
const WELCOME = `You're connected to otterfund. Ask me anything about your money, like "What can I cut this month?" or "How much did I spend on dining?"`;
const LINK_INVALID = `That connection link has expired or isn't valid. Open otterfund, go to Settings, then Connections, and tap Connect again to get a fresh link.`;
const NOT_LINKED = `This chat isn't linked to an otterfund account yet. Open otterfund, go to Settings, then Connections, and connect this app to start asking about your money.`;
const PLAN_LAPSED = `Texting your advisor is a Pro feature, and Pro isn't active on your account right now. Reactivate Pro in otterfund to pick this back up.`;

const PROVIDER_TITLE: Record<MessagingProvider, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
};

// The account-linking payload each provider carries in the first message:
//   Telegram deep link t.me/<bot>?start=<token>  →  "/start <token>"
//   WhatsApp wa.me link with prefilled text       →  "otterfund link <token>"
function extractLinkToken(provider: MessagingProvider, text: string): string | null {
  if (provider === "telegram") {
    const m = text.match(/^\/start\s+(\S+)/);
    return m ? m[1] : null;
  }
  const m = text.match(/^otterfund\s+link\s+(\S+)/i);
  return m ? m[1] : null;
}

export async function handleInbound(adapter: MessagingAdapter, msg: InboundMessage): Promise<void> {
  const { provider } = adapter;

  // Idempotency: at-least-once delivery means the same update can arrive twice.
  // Record it BEFORE any (billable) AI work so a duplicate can't double-answer.
  const fresh = await recordMessagingEvent(`${provider}:${msg.eventId}`, provider);
  if (!fresh) return;

  const text = msg.text.trim();
  if (!text) return;

  // 1) Account linking — bind this chat to the account that owns the token.
  const token = extractLinkToken(provider, text);
  if (token) {
    const conn = await activateConnectionByToken(provider, token, msg.providerChatId);
    await adapter.send(msg.providerChatId, conn ? WELCOME : LINK_INVALID);
    return;
  }

  // 2) Only an active, linked chat gets answers.
  const conn = await getActiveConnectionByChatId(provider, msg.providerChatId);
  if (!conn) {
    await adapter.send(msg.providerChatId, NOT_LINKED);
    return;
  }

  // 3) Pro gate — defense in depth. The connection only gets created for Pro, but
  // a plan can lapse afterward, so re-check on every message and stop if it has.
  const plan = await planForUser(conn.userId);
  if (!canUse(plan, "messaging")) {
    await adapter.send(msg.providerChatId, PLAN_LAPSED);
    return;
  }

  // 4) Answer. Show "typing…" while the tool loop runs (best-effort, ignore fail).
  await adapter.typing?.(msg.providerChatId).catch(() => {});

  const result = await runAdvisorTurn({
    userId: conn.userId,
    message: text,
    conversationId: conn.conversationId,
    monthlyLimit: entitlementsFor(plan).aiMonthlyMessages,
    // First texted turn opens a rolling conversation titled by channel, so the
    // thread is recognizable in the in-app advisor sidebar (unified history).
    newConversationTitle: conn.conversationId ? undefined : PROVIDER_TITLE[provider],
  });

  // 5) Remember the conversation id after the first turn so the whole channel
  // stays in one thread.
  if (result.ok && !conn.conversationId) {
    await setConnectionConversation(conn.id, result.conversationId);
  }

  await adapter.send(msg.providerChatId, result.ok ? result.answer : result.userMessage);
}
