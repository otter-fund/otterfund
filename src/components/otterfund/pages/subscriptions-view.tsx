"use client";

import { OtterfundSubscriptions } from "@/components/otterfund/pages/subscriptions";
import { useOtterfundChrome } from "@/components/otterfund/chrome-context";
import type { SubscriptionView } from "@/lib/types";

export function SubscriptionsView({
  subscriptions,
  suggestions,
  currency,
}: {
  subscriptions: SubscriptionView[];
  suggestions: SubscriptionView[];
  currency: string;
}) {
  const { accent, theme, addSubscription, editSubscription, refreshData, notify } = useOtterfundChrome();
  return (
    <OtterfundSubscriptions
      subscriptions={subscriptions}
      suggestions={suggestions}
      accent={accent}
      theme={theme}
      currency={currency}
      onAdd={addSubscription}
      onEdit={editSubscription}
      onReviewed={refreshData}
      notify={notify}
    />
  );
}
