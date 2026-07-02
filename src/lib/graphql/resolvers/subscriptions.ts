import { builder } from "../builder";
import { requireUser, notFound, badRequest } from "../errors";
import { SubscriptionRef } from "../types/views";
import { MutationResultRef } from "../types/results";
import { getSubscriptions } from "@/lib/db/queries";
import { prisma } from "@/lib/db/prisma";
import { okMoney, okString, okEnum, LIMITS } from "@/lib/validate";
import { SUBSCRIPTION_CYCLES } from "@/lib/constants";
import { resolveMerchant } from "@/lib/merchant/resolve";

builder.queryField("subscriptions", (t) =>
  t.field({
    type: [SubscriptionRef],
    resolve: (_root, _args, ctx) => getSubscriptions(requireUser(ctx)),
  }),
);

const SubscriptionCreateInput = builder.inputType("SubscriptionCreateInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    amount: t.float({ required: true }),
    cycle: t.string({ required: true }),
    categoryId: t.id(),
  }),
});

builder.mutationField("createSubscription", (t) =>
  t.field({
    type: MutationResultRef,
    args: { input: t.arg({ type: SubscriptionCreateInput, required: true }) },
    resolve: async (_root, { input }, ctx) => {
      const userId = requireUser(ctx);
      if (!okString(input.name, LIMITS.NAME) || !input.name.trim()) {
        badRequest("Give the subscription a name.");
      }
      if (!okMoney(input.amount) || input.amount <= 0) {
        badRequest("Enter an amount greater than zero.");
      }
      if (!okEnum(input.cycle, SUBSCRIPTION_CYCLES)) {
        badRequest("Pick a billing cycle.");
      }
      // A client-supplied categoryId must belong to the caller (BOLA guard).
      if (input.categoryId) {
        const cat = await prisma.category.findFirst({
          where: { id: input.categoryId, userId },
        });
        if (!cat) notFound("Category not found.");
      }
      if ((await prisma.subscription.count({ where: { userId } })) >= 200) {
        badRequest("Subscription limit reached.");
      }

      const name = input.name.trim();
      // Resolve the merchant → domain for the logo. Cached in the Merchant table,
      // so this is a single DB read for known merchants; failures degrade to no
      // logo (null domain) rather than blocking the create.
      const merchant = await resolveMerchant(name);

      const sub = await prisma.subscription.create({
        data: {
          userId,
          name,
          amount: Math.abs(input.amount),
          cycle: input.cycle,
          categoryId: input.categoryId || undefined,
          domain: merchant.domain,
          // Manually added → the user has confirmed it exists. Anchor the
          // last-seen date to now so the "no recent charge" detector doesn't
          // immediately flag a brand-new manual entry.
          confirmedByUser: true,
          lastTransactionDate: new Date(),
        },
      });
      return { ok: true, id: sub.id };
    },
  }),
);

builder.mutationField("updateSubscription", (t) =>
  t.field({
    type: MutationResultRef,
    args: {
      id: t.arg.id({ required: true }),
      name: t.arg.string(),
      cycle: t.arg.string(),
      categoryId: t.arg.id(),
      amount: t.arg.float(),
    },
    resolve: async (_root, { id, name, cycle, categoryId, amount }, ctx) => {
      const userId = requireUser(ctx);
      if (name != null && (!okString(name, LIMITS.NAME) || !name.trim())) {
        badRequest("Give the subscription a name.");
      }
      if (cycle != null && !okEnum(cycle, SUBSCRIPTION_CYCLES)) {
        badRequest("Pick a billing cycle.");
      }
      if (!okMoney(amount)) badRequest("Amount is out of range.");
      const existing = await prisma.subscription.findFirst({
        where: { id, userId },
      });
      if (!existing) notFound();

      // A client-supplied categoryId must belong to the caller (BOLA guard):
      // otherwise the joined categoryName would leak another user's category.
      if (categoryId) {
        const cat = await prisma.category.findFirst({
          where: { id: categoryId, userId },
        });
        if (!cat) notFound("Category not found.");
      }

      const data: {
        name?: string;
        cycle?: string;
        categoryId?: string | null;
        amount?: number;
        previousAmount?: number;
        domain?: string | null;
      } = {};
      if (name != null) {
        const trimmed = name.trim();
        data.name = trimmed;
        // Re-resolve the logo only when the name actually changed.
        if (trimmed !== existing.name) {
          data.domain = (await resolveMerchant(trimmed)).domain;
        }
      }
      if (cycle != null) data.cycle = cycle;
      if (categoryId !== undefined) data.categoryId = categoryId || null;
      if (amount != null && Number.isFinite(amount) && amount !== existing.amount) {
        // Stash the prior amount so the price-change detector can flag the diff.
        data.previousAmount = existing.amount;
        data.amount = amount;
      }

      if (Object.keys(data).length > 0) {
        await prisma.subscription.update({ where: { id }, data });
      }
      return { ok: true, id };
    },
  }),
);

builder.mutationField("deleteSubscription", (t) =>
  t.field({
    type: MutationResultRef,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      const userId = requireUser(ctx);
      // Scope the delete to the caller so it can't remove another user's row.
      const { count } = await prisma.subscription.deleteMany({
        where: { id, userId },
      });
      if (count === 0) notFound();
      return { ok: true, id };
    },
  }),
);
