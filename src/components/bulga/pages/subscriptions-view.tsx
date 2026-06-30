"use client";

import { BulgaSubscriptions } from "@/components/bulga/pages/subscriptions";
import { useBulgaChrome } from "@/components/bulga/chrome-context";
import type { SubscriptionView } from "@/lib/types";

export function SubscriptionsView({ subscriptions, currency }: { subscriptions: SubscriptionView[]; currency: string }) {
  const { accent, theme } = useBulgaChrome();
  return <BulgaSubscriptions subscriptions={subscriptions} currency={currency} accent={accent} theme={theme} />;
}
