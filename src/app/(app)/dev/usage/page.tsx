import { requireAdmin } from "@/lib/dashboard-context";
import { getAiUsageSummary } from "@/lib/db/ai-usage";
import { UsageView } from "@/components/otterfund/pages/usage";

// Internal AI usage & cost dashboard. Page = guard + fetch; UsageView renders.
export default async function UsagePage() {
  await requireAdmin();
  const summary = await getAiUsageSummary();
  return <UsageView summary={summary} />;
}
