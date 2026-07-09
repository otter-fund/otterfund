"use client";

import { OtterfundSubscriptions } from "@/components/otterfund/pages/subscriptions";
import { useOtterfundChrome } from "@/components/otterfund/chrome-context";
import type { SubscriptionView } from "@/lib/types";

export function SubscriptionsView({ subscriptions, currency }: { subscriptions: SubscriptionView[]; currency: string }) {
  const { accent, theme, addSubscription, editSubscription } = useOtterfundChrome();
  return (
    <OtterfundSubscriptions
      subscriptions={subscriptions}
      currency={currency}
      accent={accent}
      theme={theme}
      onAdd={addSubscription}
      onEdit={editSubscription}
    />
  );
}
