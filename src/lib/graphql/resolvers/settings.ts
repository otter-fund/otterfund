import { builder } from "../builder";
import { requireUser, badRequest, rateLimited } from "../errors";
import { MutationResultRef } from "../types/results";
import { prisma } from "@/lib/db/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { okString, okMoney, okEnum, LIMITS } from "@/lib/validate";
import { isPremiumAccent } from "@/components/otterfund/theme";
import { CURRENCIES, getBudgetPlan } from "@/lib/constants";
import { budgetAmountsForPlan } from "@/lib/db/seed-categories";
import { logSecurityEvent } from "@/lib/log";
import { rateLimit, MINUTE, HOUR } from "@/lib/rate-limit";

const SettingsUpdateInput = builder.inputType("SettingsUpdateInput", {
  fields: (t) => ({
    name: t.string(),
    monthlyIncome: t.float(),
    currency: t.string(),
    budgetTarget: t.float(),
    accent: t.string(),
  }),
});

builder.mutationField("updateSettings", (t) =>
  t.field({
    type: MutationResultRef,
    args: { input: t.arg({ type: SettingsUpdateInput, required: true }) },
    resolve: async (_root, { input }, ctx) => {
      const userId = requireUser(ctx);
      if (!okString(input.name, LIMITS.NAME)) badRequest("Name is too long.");
      if (!okString(input.accent, 80)) badRequest("Invalid accent.");
      // Premium accents are a paid perk (Standard + Pro) — the picker hides them
      // from Free, but a mutation is a public endpoint, so re-check before saving.
      if (input.accent != null && isPremiumAccent(input.accent)) {
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
        if (u?.plan === "free") badRequest("That accent is available on a paid plan.");
      }
      if (!okEnum(input.currency, CURRENCIES)) badRequest("Unsupported currency.");
      if (!okMoney(input.monthlyIncome) || (input.monthlyIncome != null && input.monthlyIncome < 0)) {
        badRequest("Monthly income is out of range.");
      }
      if (!okMoney(input.budgetTarget) || (input.budgetTarget != null && input.budgetTarget < 0)) {
        badRequest("Budget target is out of range.");
      }
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(input.name != null && { name: input.name }),
          ...(input.monthlyIncome != null && { monthlyIncome: input.monthlyIncome }),
          ...(input.currency != null && { currency: input.currency }),
          ...(input.budgetTarget != null && { budgetTarget: input.budgetTarget }),
          ...(input.accent !== undefined && { accent: input.accent }),
        },
      });
      return { ok: true, id: userId };
    },
  }),
);

// Switch the user's budget plan. The plan drives the spend allowance and the
// per-category budgets for the current month, so both are recomputed here in
// one transaction — keeping the Spending page, Overview, and Settings coherent.
builder.mutationField("updateBudgetPlan", (t) =>
  t.field({
    type: MutationResultRef,
    args: { planId: t.arg.string({ required: true }) },
    resolve: async (_root, { planId }, ctx) => {
      const userId = requireUser(ctx);
      const plan = getBudgetPlan(planId);
      if (plan.id !== planId) badRequest("Unknown budget plan.");

      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { monthlyIncome: true },
        });
        const income = user?.monthlyIncome ?? 0;
        const budgetTarget = Math.round((income * (plan.needs + plan.wants)) / 100);

        await tx.user.update({
          where: { id: userId },
          data: { budgetPlan: plan.id, budgetTarget },
        });

        const amounts = budgetAmountsForPlan(plan, income);
        const cats = await tx.category.findMany({
          where: { userId },
          select: { id: true, name: true },
        });
        const idByName = new Map(cats.map((c) => [c.name, c.id]));

        for (const [name, amount] of Object.entries(amounts)) {
          const categoryId = idByName.get(name);
          if (!categoryId) continue;
          await tx.budget.upsert({
            where: { userId_categoryId_month_year: { userId, categoryId, month, year } },
            create: { userId, categoryId, amount, month, year },
            update: { amount },
          });
        }
      });

      return { ok: true, id: userId };
    },
  }),
);

builder.mutationField("deleteMyAccount", (t) =>
  t.field({
    type: MutationResultRef,
    resolve: async (_root, _args, ctx) => {
      const userId = requireUser(ctx);
      // Throttle this irreversible, cascading action (also blunts double-submits).
      const limit = rateLimit(`account:delete:${userId}`, [
        { limit: 3, windowMs: MINUTE },
        { limit: 5, windowMs: HOUR },
      ]);
      if (!limit.ok) rateLimited(limit.retryAfterSec);
      // Delete the profile row (cascades all data), then the Supabase auth user.
      await prisma.user.delete({ where: { id: userId } });
      await createAdminClient().auth.admin.deleteUser(userId);
      logSecurityEvent("account.deleted", { userId });
      return { ok: true, id: userId };
    },
  }),
);
