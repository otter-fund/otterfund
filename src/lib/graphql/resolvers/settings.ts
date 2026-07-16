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
import { plaid } from "@/lib/plaid/client";
import { decryptToken } from "@/lib/crypto";
import { safePlaidErr } from "@/lib/plaid/sync";
import { stripe } from "@/lib/stripe/client";

const SettingsUpdateInput = builder.inputType("SettingsUpdateInput", {
  fields: (t) => ({
    name: t.string(),
    monthlyIncome: t.float(),
    currency: t.string(),
    budgetTarget: t.float(),
    accent: t.string(),
    appearance: t.string(),
  }),
});

const APPEARANCE_MODES = ["light", "dark", "system"] as const;

builder.mutationField("updateSettings", (t) =>
  t.field({
    type: MutationResultRef,
    args: { input: t.arg({ type: SettingsUpdateInput, required: true }) },
    resolve: async (_root, { input }, ctx) => {
      const userId = requireUser(ctx);
      if (!okString(input.name, LIMITS.NAME)) badRequest("Name is too long.");
      if (!okString(input.accent, 80)) badRequest("Invalid accent.");
      if (!okEnum(input.appearance, APPEARANCE_MODES)) badRequest("Invalid appearance.");
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
          ...(input.appearance != null && { appearance: input.appearance }),
        },
      });
      return { ok: true, id: userId };
    },
  }),
);

// Mark the first-run product tour as seen. Called by the dashboard when the
// user finishes OR skips the tour, so it never auto-starts again. Idempotent —
// stamps `tourCompletedAt` once and leaves it (replays from the profile menu
// don't clear it, so a replay never re-arms the auto-start on next load).
builder.mutationField("completeTour", (t) =>
  t.field({
    type: MutationResultRef,
    resolve: async (_root, _args, ctx) => {
      const userId = requireUser(ctx);
      await prisma.user.updateMany({
        // updateMany + the null guard keeps this a single idempotent write:
        // the first finish/skip stamps the time, later calls no-op.
        where: { id: userId, tourCompletedAt: null },
        data: { tourCompletedAt: new Date() },
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

// Full account erasure. Wipes every trace of the user across all systems:
//
//   1. Plaid  — call itemRemove for each linked Item so the bank access tokens
//               are revoked at Plaid (stops Plaid billing + de-authorizes the
//               connection). MUST run before the DB delete: the tokens live on
//               PlaidItem rows that the User cascade is about to destroy.
//   2. Stripe — cancel the active subscription and delete the customer, so the
//               user stops being billed and their PII/payment methods are purged
//               from Stripe. Same ordering reason: ids come off the User row.
//   3. Postgres — prisma.user.delete cascades every owned table via ON DELETE
//               CASCADE FKs (accounts, transactions, categories, goals + their
//               allocations, subscriptions, investments, bills, budgets,
//               insights, bank statements, plaid items + link events, advisor
//               chats + messages, ai usage). StripeEvent has a userId column but
//               NO FK relation, so it isn't cascaded — delete it explicitly.
//   4. Supabase — remove the auth identity so the login can never come back.
//
// Steps 1–2 are best-effort: an external failure (already-removed item, Stripe
// outage) is logged but must not block the user from erasing their data. The
// DB + auth deletes are the authoritative wipe.
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

      // Grab the external refs BEFORE the cascade destroys the rows they live on.
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          plaidItems: { select: { itemId: true, accessToken: true } },
        },
      });
      if (!user) badRequest("Account not found.");

      // 1. Revoke every Plaid Item (per-item, best-effort).
      let plaidRemoved = 0;
      for (const item of user!.plaidItems) {
        try {
          await plaid.itemRemove({ access_token: decryptToken(item.accessToken) });
          plaidRemoved++;
        } catch (err) {
          // Already removed / Plaid down — still proceed with local erasure.
          console.error("account.delete plaid itemRemove failed:", safePlaidErr(err));
        }
      }

      // 2. Cancel the subscription and delete the Stripe customer (best-effort).
      //    Deleting the customer also cancels any lingering subscriptions and
      //    detaches payment methods; we cancel first so billing stops even if the
      //    customer delete later fails.
      let stripeCleaned = false;
      if (stripe) {
        if (user!.stripeSubscriptionId) {
          try {
            await stripe.subscriptions.cancel(user!.stripeSubscriptionId);
          } catch (err) {
            console.error("account.delete stripe subscription cancel failed:", err);
          }
        }
        if (user!.stripeCustomerId) {
          try {
            await stripe.customers.del(user!.stripeCustomerId);
            stripeCleaned = true;
          } catch (err) {
            console.error("account.delete stripe customer delete failed:", err);
          }
        }
      }

      // 3. Erase all Postgres data: the un-related StripeEvent audit rows, then
      //    the profile row (cascades every owned table).
      await prisma.$transaction([
        prisma.stripeEvent.deleteMany({ where: { userId } }),
        prisma.user.delete({ where: { id: userId } }),
      ]);

      // 4. Remove the Supabase auth identity. Data is already gone at this point;
      //    if this fails the orphaned login just bounces at requireUser (no
      //    profile → redirect to /login), so log it for a manual sweep rather
      //    than failing the whole request.
      try {
        const { error } = await createAdminClient().auth.admin.deleteUser(userId);
        if (error) throw error;
      } catch (err) {
        console.error("account.delete supabase auth deleteUser failed:", err);
      }

      logSecurityEvent("account.deleted", {
        userId,
        plaidRemoved,
        stripeCleaned,
      });
      return { ok: true, id: userId };
    },
  }),
);
