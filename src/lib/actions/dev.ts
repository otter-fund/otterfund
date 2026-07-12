"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { PLAN_TIERS, type PlanTier } from "@/lib/plans";

// Internal dev-only actions, gated on the isAdmin flag. Each re-verifies the
// caller server-side — a server action is a public endpoint, so the UI hiding
// these is NOT the security boundary; this check is.
async function requireAdminUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, isAdmin: true } });
  if (!user?.isAdmin) throw new Error("Forbidden");
  return user.id;
}

/**
 * Dev plan preview: overwrite the signed-in admin's own entitlement tier so they
 * can see the app as a free / standard / pro user. This is a raw override, NOT a
 * Stripe flow — it does not create/cancel a subscription, so on an account with a
 * real Stripe subscription it will drift from billing truth until the next
 * webhook. Intended for throwaway staff/test accounts.
 */
export async function setDevPlan(plan: PlanTier) {
  const id = await requireAdminUser();
  if (!PLAN_TIERS.includes(plan)) throw new Error("Invalid plan");

  await prisma.user.update({
    where: { id },
    data: {
      plan,
      // Keep entitlement checks that also read planStatus consistent: an active
      // paid tier reads "active"; free clears it. Stripe fields are left alone.
      planStatus: plan === "free" ? null : "active",
    },
  });

  // The plan drives paywalls + locked-feature panels across the whole app, so
  // refresh every route's RSC data, not just this page.
  revalidatePath("/", "layout");
  return { plan };
}
