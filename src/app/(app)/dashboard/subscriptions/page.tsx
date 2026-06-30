import { requireUser, userCurrency } from "@/lib/dashboard-context";
import { getSubscriptions } from "@/lib/db/queries";
import { SubscriptionsView } from "@/components/bulga/pages/subscriptions-view";

export default async function SubscriptionsPage() {
  const user = await requireUser();
  const [subscriptions, currency] = await Promise.all([
    getSubscriptions(user.id).catch(() => []),
    userCurrency(user.id),
  ]);
  return <SubscriptionsView subscriptions={subscriptions} currency={currency} />;
}
