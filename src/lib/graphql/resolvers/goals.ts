import { builder } from "../builder";
import { requireUser, notFound, badRequest } from "../errors";
import { GoalRef } from "../types/views";
import { MutationResultRef } from "../types/results";
import { getGoals } from "@/lib/db/queries";
import { assignAvailableSurplus } from "@/lib/db/goal-allocation";
import { prisma } from "@/lib/db/prisma";
import { okString, okMoney, okColor, LIMITS } from "@/lib/validate";

builder.queryField("goals", (t) =>
  t.field({
    type: [GoalRef],
    resolve: (_root, _args, ctx) => getGoals(requireUser(ctx)),
  }),
);

const GoalCreateInput = builder.inputType("GoalCreateInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    emoji: t.string(),
    target: t.float({ required: true }),
    saved: t.float(),
    deadline: t.string(),
    priority: t.float(),
  }),
});

const GoalUpdateInput = builder.inputType("GoalUpdateInput", {
  fields: (t) => ({
    name: t.string(),
    emoji: t.string(),
    target: t.float(),
    saved: t.float(),
    deadline: t.string(),
    color: t.string(),
    priority: t.float(),
  }),
});

builder.mutationField("createGoal", (t) =>
  t.field({
    type: MutationResultRef,
    args: { input: t.arg({ type: GoalCreateInput, required: true }) },
    resolve: async (_root, { input }, ctx) => {
      const userId = requireUser(ctx);
      if (!okString(input.name, LIMITS.NAME)) badRequest("Name is too long.");
      if (!okString(input.emoji, LIMITS.EMOJI)) badRequest("Invalid emoji.");
      if (!okMoney(input.target) || (input.target != null && input.target < 0)) {
        badRequest("Target is out of range.");
      }
      if (!okMoney(input.saved) || (input.saved != null && input.saved < 0)) {
        badRequest("Saved amount is out of range.");
      }
      if ((await prisma.goal.count({ where: { userId } })) >= 100) {
        badRequest("Goal limit reached.");
      }
      const goal = await prisma.goal.create({
        data: {
          userId,
          name: input.name,
          emoji: input.emoji || undefined,
          target: input.target,
          saved: input.saved ?? 0,
          priority: input.priority ?? 0,
          deadline: input.deadline ? new Date(input.deadline) : undefined,
          color: `oklch(${55 + Math.random() * 10}% 0.09 ${Math.round(Math.random() * 360)})`,
        },
      });
      return { ok: true, id: goal.id };
    },
  }),
);

builder.mutationField("updateGoal", (t) =>
  t.field({
    type: MutationResultRef,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: GoalUpdateInput, required: true }),
    },
    resolve: async (_root, { id, input }, ctx) => {
      const userId = requireUser(ctx);
      if (!okString(input.name, LIMITS.NAME)) badRequest("Name is too long.");
      if (!okString(input.emoji, LIMITS.EMOJI)) badRequest("Invalid emoji.");
      if (!okColor(input.color)) badRequest("Invalid color.");
      if (!okMoney(input.target) || (input.target != null && input.target < 0)) {
        badRequest("Target is out of range.");
      }
      if (!okMoney(input.saved) || (input.saved != null && input.saved < 0)) {
        badRequest("Saved amount is out of range.");
      }
      const existing = await prisma.goal.findFirst({ where: { id, userId } });
      if (!existing) notFound();

      await prisma.goal.update({
        where: { id },
        data: {
          ...(input.name != null && { name: input.name }),
          ...(input.emoji !== undefined && { emoji: input.emoji || null }),
          ...(input.target != null && { target: input.target }),
          ...(input.saved != null && { saved: input.saved }),
          ...(input.color !== undefined && { color: input.color || null }),
          ...(input.priority != null && { priority: input.priority }),
          ...(input.deadline !== undefined && {
            deadline: input.deadline ? new Date(input.deadline) : null,
          }),
        },
      });
      return { ok: true, id };
    },
  }),
);

// Assigns this month's remaining real surplus to goals. The amount is derived
// server-side (surplus − already assigned this month) so a client can't spend
// cash it doesn't have, and re-running is a no-op once the surplus is used.
builder.mutationField("assignSavingsToGoals", (t) =>
  t.field({
    type: MutationResultRef,
    resolve: async (_root, _args, ctx) => {
      const userId = requireUser(ctx);
      const now = new Date();
      await assignAvailableSurplus(userId, now.getMonth() + 1, now.getFullYear());
      return { ok: true, id: userId };
    },
  }),
);

builder.mutationField("deleteGoal", (t) =>
  t.field({
    type: MutationResultRef,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      const userId = requireUser(ctx);
      const existing = await prisma.goal.findFirst({ where: { id, userId } });
      if (!existing) notFound();
      await prisma.goal.delete({ where: { id } });
      return { ok: true, id };
    },
  }),
);
