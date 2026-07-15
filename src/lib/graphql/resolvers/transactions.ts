import { builder } from "../builder";
import { requireUser, notFound, badRequest } from "../errors";
import { TransactionPageRef } from "../types/views";
import { MutationResultRef } from "../types/results";
import { getTransactions, getSpendingCategoryDetail } from "@/lib/db/queries";
import { prisma } from "@/lib/db/prisma";
import { okString, okMoney, LIMITS } from "@/lib/validate";

builder.queryField("transactions", (t) =>
  t.field({
    type: TransactionPageRef,
    args: {
      page: t.arg.int(),
      limit: t.arg.int(),
      search: t.arg.string(),
      month: t.arg.int(),
      year: t.arg.int(),
    },
    resolve: (_root, args, ctx) =>
      getTransactions(requireUser(ctx), {
        page: args.page ?? undefined,
        limit: args.limit ?? undefined,
        search: args.search ?? undefined,
        month: args.month ?? undefined,
        year: args.year ?? undefined,
      }),
  }),
);

// The spend transactions behind one Spending category slice — powers the
// category-breakdown drill-in drawer. JSON return mirrors insightDetail's
// category drill-down, which the client already renders the same way.
builder.queryField("spendingCategoryDetail", (t) =>
  t.field({
    type: "JSON",
    nullable: true,
    args: {
      categoryId: t.arg.id({ required: true }),
      month: t.arg.int({ required: true }),
      year: t.arg.int({ required: true }),
    },
    resolve: (_root, args, ctx) =>
      getSpendingCategoryDetail(requireUser(ctx), String(args.categoryId), args.month, args.year),
  }),
);

const TransactionCreateInput = builder.inputType("TransactionCreateInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    amount: t.float({ required: true }),
    category: t.string(),
    type: t.string(), // "credit" | "debit"
    accountId: t.id(),
    date: t.string(),
  }),
});

const TransactionUpdateInput = builder.inputType("TransactionUpdateInput", {
  fields: (t) => ({
    name: t.string(),
    amount: t.float(),
    category: t.string(),
    type: t.string(),
    date: t.string(),
  }),
});

builder.mutationField("createTransaction", (t) =>
  t.field({
    type: MutationResultRef,
    args: { input: t.arg({ type: TransactionCreateInput, required: true }) },
    resolve: async (_root, { input }, ctx) => {
      const userId = requireUser(ctx);
      if (!okString(input.name, LIMITS.NAME)) badRequest("Name is too long.");
      if (!okMoney(input.amount)) badRequest("Amount is out of range.");
      const finalAmount =
        input.type === "credit" ? Math.abs(input.amount) : -Math.abs(input.amount);

      // A manual transaction must come out of a manual account the caller owns.
      // Synced accounts are bank-truth — their balance is Plaid's number and a
      // hand-entered row wouldn't move it — so we require a manual account here
      // (the add-transaction modal only offers manual accounts). The account
      // lookup also serves as the BOLA guard (must belong to the caller).
      if (!input.accountId) badRequest("Choose which account this comes out of.");
      const acct = await prisma.account.findFirst({
        where: { id: input.accountId, userId },
      });
      if (!acct) notFound("Account not found.");
      if (acct.plaidItemId) {
        badRequest("Transactions can only be added to a manual account, not a synced one.");
      }

      let categoryId: string | undefined;
      if (input.category) {
        const cat = await prisma.category.findUnique({
          where: { userId_name: { userId, name: input.category } },
        });
        categoryId = cat?.id;
      }

      const tx = await prisma.transaction.create({
        data: {
          userId,
          name: input.name,
          amount: finalAmount,
          date: input.date ? new Date(input.date) : new Date(),
          categoryId,
          accountId: input.accountId,
          source: "manual",
        },
      });
      return { ok: true, id: tx.id };
    },
  }),
);

builder.mutationField("updateTransaction", (t) =>
  t.field({
    type: MutationResultRef,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: TransactionUpdateInput, required: true }),
    },
    resolve: async (_root, { id, input }, ctx) => {
      const userId = requireUser(ctx);
      if (!okString(input.name, LIMITS.NAME)) badRequest("Name is too long.");
      if (!okMoney(input.amount)) badRequest("Amount is out of range.");
      const existing = await prisma.transaction.findFirst({
        where: { id, userId },
      });
      if (!existing) notFound();

      let categoryId = existing.categoryId;
      if (input.category != null) {
        const cat = await prisma.category.findUnique({
          where: { userId_name: { userId, name: input.category } },
        });
        categoryId = cat?.id ?? null;
      }

      let finalAmount = existing.amount;
      if (input.amount != null) {
        finalAmount =
          input.type === "credit" || (input.type == null && existing.amount > 0)
            ? Math.abs(input.amount)
            : -Math.abs(input.amount);
      }

      await prisma.transaction.update({
        where: { id },
        data: {
          ...(input.name != null && { name: input.name }),
          ...(input.amount != null && { amount: finalAmount }),
          categoryId,
          ...(input.date != null && { date: new Date(input.date) }),
        },
      });
      return { ok: true, id };
    },
  }),
);

builder.mutationField("deleteTransaction", (t) =>
  t.field({
    type: MutationResultRef,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      const userId = requireUser(ctx);
      const existing = await prisma.transaction.findFirst({
        where: { id, userId },
      });
      if (!existing) notFound();
      await prisma.transaction.delete({ where: { id } });
      return { ok: true, id };
    },
  }),
);

builder.mutationField("deleteTransactions", (t) =>
  t.field({
    type: MutationResultRef,
    args: { ids: t.arg({ type: ["ID"], required: true }) },
    resolve: async (_root, { ids }, ctx) => {
      const userId = requireUser(ctx);
      if (ids.length === 0) badRequest("No transactions selected.");
      if (ids.length > LIMITS.BULK) badRequest("Too many at once.");
      // Scope the delete to the caller's own rows — ids they don't own simply
      // don't match, so this is BOLA-safe without a separate ownership pass.
      await prisma.transaction.deleteMany({
        where: { id: { in: ids }, userId },
      });
      return { ok: true };
    },
  }),
);
