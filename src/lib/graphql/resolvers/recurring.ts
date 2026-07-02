import { builder } from "../builder";
import { requireUser, rateLimited, badRequest } from "../errors";
import { MutationResultRef } from "../types/results";
import { prisma } from "@/lib/db/prisma";
import { detectRecurringExpenses } from "@/lib/ai/detect-recurring";
import { resolveMerchant } from "@/lib/merchant/resolve";
import { rateLimit, MINUTE, HOUR } from "@/lib/rate-limit";
import { okString, okMoney, okEnum, LIMITS } from "@/lib/validate";

builder.mutationField("detectRecurring", (t) =>
  t.field({
    type: "JSON",
    resolve: async (_root, _args, ctx) => {
      const userId = requireUser(ctx);
      const limit = rateLimit(`ai:recurring:${userId}`, [
        { limit: 5, windowMs: 5 * MINUTE },
        { limit: 30, windowMs: HOUR },
      ]);
      if (!limit.ok) rateLimited(limit.retryAfterSec);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const transactions = await prisma.transaction.findMany({
        where: { userId, date: { gte: sixMonthsAgo }, amount: { lt: 0 } },
        orderBy: { date: "asc" },
        select: { id: true, name: true, amount: true, date: true },
      });

      const suggestions = await detectRecurringExpenses(
        transactions.map((tx) => ({
          id: tx.id,
          name: tx.name,
          amount: tx.amount,
          date: tx.date.toISOString().split("T")[0],
        })),
      );
      return { suggestions };
    },
  }),
);

const RecurringConfirmInput = builder.inputType("RecurringConfirmInput", {
  fields: (t) => ({
    transactionIds: t.idList({ required: true }),
    action: t.string({ required: true }), // "confirm" | "reject"
    merchantName: t.string(),
    amount: t.float(),
    frequency: t.string(),
  }),
});

builder.mutationField("confirmRecurring", (t) =>
  t.field({
    type: MutationResultRef,
    args: { input: t.arg({ type: RecurringConfirmInput, required: true }) },
    resolve: async (_root, { input }, ctx) => {
      const userId = requireUser(ctx);
      if (!okEnum(input.action, ["confirm", "reject"])) badRequest("Invalid action.");
      if (!okString(input.merchantName, LIMITS.NAME)) badRequest("Name is too long.");
      if (!okMoney(input.amount)) badRequest("Amount is out of range.");
      if (input.transactionIds.length > 500) badRequest("Too many transactions.");
      await prisma.transaction.updateMany({
        where: { id: { in: input.transactionIds }, userId },
        data: {
          isRecurring: input.action === "confirm",
          recurringFlag: input.action === "confirm" ? "confirmed" : "rejected",
        },
      });

      if (input.action === "confirm" && input.merchantName && input.amount) {
        // Resolve the logo domain (dictionary/cache → Claude on a miss) so
        // auto-detected subscriptions get a logo too, same as the manual path.
        const merchant = await resolveMerchant(input.merchantName);
        await prisma.subscription.create({
          data: {
            userId,
            name: input.merchantName,
            amount: Math.abs(input.amount),
            cycle: input.frequency || "Monthly",
            domain: merchant.domain,
            confirmedByUser: true,
          },
        });
      }
      return { ok: true };
    },
  }),
);
