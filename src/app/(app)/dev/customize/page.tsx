import { requireAdmin } from "@/lib/dashboard-context";
import { CustomizeView } from "@/components/otterfund/pages/customize-view";
import type { PlanTier } from "@/lib/plans";

// Internal dev tool: preview the app as any plan tier. Page = guard + read the
// current plan; CustomizeView renders the switcher.
export default async function CustomizePage() {
  const user = await requireAdmin();
  return <CustomizeView currentPlan={(user.plan ?? "free") as PlanTier} />;
}
