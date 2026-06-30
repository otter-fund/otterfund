import { requireUser, userCurrency } from "@/lib/dashboard-context";
import { getGoals } from "@/lib/db/queries";
import { GoalsView } from "@/components/bulga/pages/goals-view";

export default async function GoalsPage() {
  const user = await requireUser();
  const [goals, currency] = await Promise.all([
    getGoals(user.id).catch(() => []),
    userCurrency(user.id),
  ]);
  return <GoalsView goals={goals} currency={currency} />;
}
