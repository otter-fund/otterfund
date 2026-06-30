import { requireUser } from "@/lib/dashboard-context";
import { getInsights } from "@/lib/db/queries";
import { InsightsView } from "@/components/bulga/pages/insights-view";

export default async function InsightsPage() {
  const user = await requireUser();
  const insights = await getInsights(user.id).catch(() => []);
  return <InsightsView insights={insights} />;
}
