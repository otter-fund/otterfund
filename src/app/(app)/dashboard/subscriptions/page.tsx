import { requireUser, userCurrency } from "@/lib/dashboard-context";
import { getSubscriptions, getSubscriptionSuggestions } from "@/lib/db/queries";
import { SubscriptionsView } from "@/components/otterfund/pages/subscriptions-view";

// Recurring subscriptions — a first-class tab (was folded into Spending). Page =
// guard + fetch; the view (client) renders via the otterfund design system.
export default async function SubscriptionsPage() {
  const user = await requireUser();
  const [subscriptions, suggestions, currency] = await Promise.all([
    getSubscriptions(user.id).catch(() => []),
    getSubscriptionSuggestions(user.id).catch(() => []),
    userCurrency(user.id),
  ]);
  return (
    <SubscriptionsView
      subscriptions={subscriptions}
      suggestions={suggestions}
      currency={currency}
    />
  );
}
