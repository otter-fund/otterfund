import { builder } from "../builder";
import { requireUser, rateLimited, badRequest, notFound } from "../errors";
import { requireEntitlementDetail } from "../entitlements";
import { runAdvisorTurn } from "@/lib/ai/advisor-turn";
import {
  listAdvisorConversations,
  getAdvisorConversation,
  deleteAdvisorConversation,
} from "@/lib/db/advisor";

// Ask the budget advisor a question within a persisted conversation. The whole
// turn — burst/monthly rate limits, history load (never trusted from the client),
// the read-only user-scoped tool loop, persistence, and usage accounting — runs
// through the shared runAdvisorTurn service (lib/ai/advisor-turn), which the
// Telegram/WhatsApp webhook also uses, so both transports behave identically.
// Returns { answer, sources, conversationId } — the id lets a brand-new chat keep
// appending.
builder.mutationField("askAdvisor", (t) =>
  t.field({
    type: "JSON",
    args: {
      message: t.arg.string({ required: true }),
      conversationId: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      // The AI advisor is a Standard+ feature — hard-gate before any model call.
      const { userId, entitlements } = await requireEntitlementDetail(ctx, "advisor");

      const result = await runAdvisorTurn({
        userId,
        message: args.message,
        conversationId: args.conversationId ?? null,
        monthlyLimit: entitlements.aiMonthlyMessages,
      });

      // Translate the typed failure into this transport's error shape. Each of
      // these throwers returns `never`, so past this block `result` is the ok
      // variant.
      if (!result.ok) {
        if (result.kind === "rate_limited" || result.kind === "monthly_cap") {
          rateLimited(result.retryAfterSec, result.userMessage);
        }
        if (result.kind === "not_found") notFound(result.userMessage);
        badRequest(result.userMessage); // empty | too_long
      }

      return { answer: result.answer, sources: result.sources, conversationId: result.conversationId };
    },
  }),
);

// Sidebar list of the user's saved chats (most-recently-active first).
builder.queryField("advisorConversations", (t) =>
  t.field({
    type: "JSON",
    resolve: (_root, _args, ctx) => listAdvisorConversations(requireUser(ctx)),
  }),
);

// Full thread for reopening a past chat. 404 if not the user's.
builder.queryField("advisorConversation", (t) =>
  t.field({
    type: "JSON",
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const convo = await getAdvisorConversation(requireUser(ctx), args.id);
      if (!convo) notFound("Conversation not found.");
      return convo;
    },
  }),
);

// Delete a saved chat (messages cascade).
builder.mutationField("deleteAdvisorConversation", (t) =>
  t.field({
    type: "JSON",
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const ok = await deleteAdvisorConversation(requireUser(ctx), args.id);
      return { ok };
    },
  }),
);
