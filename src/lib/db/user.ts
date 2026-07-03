import { cache } from "react";
import { prisma } from "./prisma";

/**
 * The user row, read ONCE per request. Every server-side consumer (auth guard,
 * prefs, overview, spending/goals plans, surplus) shares this cached read
 * instead of issuing its own `prisma.user.findUnique` — previously up to five
 * identical round-trips per render. cache() is per-request inside an RSC
 * render and a pass-through elsewhere (route handlers), so mutation flows that
 * read-modify-read are unaffected.
 */
export const getUserRow = cache((userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      onboardingDone: true,
      accent: true,
      currency: true,
      budgetPlan: true,
      monthlyIncome: true,
      budgetTarget: true,
    },
  })
);
