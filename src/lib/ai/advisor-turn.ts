import { askAdvisor, generateAdvisorTitle, type AdvisorTurn } from "./advisor";
import type { TokenUsage } from "./usage";
import {
  getAdvisorHistory,
  createAdvisorConversation,
  appendAdvisorTurns,
  type AdvisorTurnInput,
} from "@/lib/db/advisor";
import { recordAiUsage, countAdvisorTurnsSince, type AiUsageInput } from "@/lib/db/ai-usage";
import { rateLimit, MINUTE, HOUR } from "@/lib/rate-limit";
import { startOfMonth, secondsUntilNextMonth, nextMonthLabel } from "@/lib/graphql/entitlements";
import type { AdvisorSource } from "@/lib/types";

// ── Shared advisor-turn orchestration ────────────────────────────────────────
// The ONE place a single advisor question is run, end to end: burst + monthly
// rate limits, message validation, history load, the grounded answer
// (lib/ai/advisor.askAdvisor), persistence, and usage/cost accounting. Both
// transports call this so their guarantees are IDENTICAL:
//   • the in-app GraphQL resolver (resolvers/advisor.askAdvisor), and
//   • the Telegram/WhatsApp inbound webhook (lib/messaging/handler).
// The feature gate itself lives in the CALLER (the resolver gates "advisor";
// the webhook gates "messaging") — this service only runs the turn + the shared
// cost controls. Errors are returned as a typed result, never thrown, so each
// caller can translate them into its own shape (GraphQL error vs. a text reply).

const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_TURNS = 20; // prior turns fed to the model — bounds tokens/cost

export interface RunAdvisorTurnInput {
  userId: string;
  message: string;
  /** Existing conversation to continue, or null/undefined to start a fresh one. */
  conversationId?: string | null;
  /** Durable per-user monthly message cap (plan entitlement aiMonthlyMessages).
      `null` = unlimited (Pro) — the cap check is skipped. The burst limits still
      apply either way. */
  monthlyLimit: number | null;
  /** Fixed title for a newly-created conversation (e.g. "Telegram"). When omitted,
      an AI title is generated from the first message — the in-app default. */
  newConversationTitle?: string;
}

export type AdvisorTurnResult =
  | { ok: true; answer: string; sources: AdvisorSource[]; conversationId: string }
  | {
      ok: false;
      kind: "empty" | "too_long" | "rate_limited" | "monthly_cap" | "not_found";
      /** User-facing sentence the caller can surface verbatim. */
      userMessage: string;
      retryAfterSec?: number;
    };

export async function runAdvisorTurn(input: RunAdvisorTurnInput): Promise<AdvisorTurnResult> {
  const { userId, monthlyLimit } = input;

  // Per-user burst limits — shared across every transport for this user.
  const limit = rateLimit(`ai:advisor:${userId}`, [
    { limit: 10, windowMs: MINUTE },
    { limit: 120, windowMs: HOUR },
  ]);
  if (!limit.ok) {
    return {
      ok: false,
      kind: "rate_limited",
      retryAfterSec: limit.retryAfterSec,
      userMessage: "You're sending messages a little fast. Give it a moment, then try again.",
    };
  }

  const message = input.message.trim();
  if (!message) return { ok: false, kind: "empty", userMessage: "Ask a question about your finances." };
  if (message.length > MAX_MESSAGE_CHARS) {
    return {
      ok: false,
      kind: "too_long",
      userMessage: `Keep your question under ${MAX_MESSAGE_CHARS} characters.`,
    };
  }

  // Durable monthly cap (per-plan): bounds cost/abuse across restarts, counted
  // from the DB over the current calendar month. null = unlimited (Pro) — skip.
  if (monthlyLimit != null) {
    const monthStart = startOfMonth();
    const monthlyCount = await countAdvisorTurnsSince(userId, monthStart);
    if (monthlyCount >= monthlyLimit) {
      return {
        ok: false,
        kind: "monthly_cap",
        retryAfterSec: secondsUntilNextMonth(monthStart),
        userMessage: `You've reached your plan's limit of ${monthlyLimit} AI messages this month. It resets on ${nextMonthLabel(monthStart)}.`,
      };
    }
  }

  const conversationId = input.conversationId ?? null;

  // Load prior turns from the DB (ownership-checked). A missing/foreign id is a
  // not_found — the model never sees another user's conversation.
  let history: AdvisorTurn[] = [];
  if (conversationId) {
    const h = await getAdvisorHistory(userId, conversationId, MAX_HISTORY_TURNS);
    if (h === null) return { ok: false, kind: "not_found", userMessage: "Conversation not found." };
    history = h;
  }

  const { answer, sources, usage, model } = await askAdvisor(userId, message, history);

  // Persist only after a successful answer, so a failed call leaves no empty
  // conversation behind.
  const turns: AdvisorTurnInput[] = [
    { role: "user", content: message },
    { role: "assistant", content: answer, sources },
  ];

  const usageEvents: AiUsageInput[] = [];
  let convId = conversationId;
  if (convId) {
    const ok = await appendAdvisorTurns(userId, convId, turns);
    if (!ok) return { ok: false, kind: "not_found", userMessage: "Conversation not found." };
  } else {
    let title = input.newConversationTitle;
    let titleUsage: TokenUsage | null = null;
    let titleModel = "";
    if (!title) {
      const t = await generateAdvisorTitle(message);
      title = t.title;
      titleUsage = t.usage;
      titleModel = t.model;
    }
    convId = await createAdvisorConversation(userId, title, turns);
    if (titleUsage) {
      usageEvents.push({ userId, kind: "advisor_title", model: titleModel, usage: titleUsage, conversationId: convId });
    }
  }

  // Track token usage + cost for this turn (best-effort; never blocks the reply).
  usageEvents.push({ userId, kind: "advisor", model, usage, conversationId: convId });
  await recordAiUsage(usageEvents);

  return { ok: true, answer, sources, conversationId: convId };
}
