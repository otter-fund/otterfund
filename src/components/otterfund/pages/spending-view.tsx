"use client";

import { OtterfundSpending } from "@/components/otterfund/pages/spending";
import { useOtterfundChrome } from "@/components/otterfund/chrome-context";
import type { SpendingPlanView, SubscriptionView } from "@/lib/types";

export function SpendingView({
  plan,
  subscriptions,
  currency,
  period,
}: {
  plan: SpendingPlanView;
  subscriptions: SubscriptionView[];
  currency: string;
  /** The month being viewed — the category drill-in queries the same window. */
  period: { month: number; year: number };
}) {
  const { accent, theme, hrefFor, addSubscription, editSubscription, hasAccounts, addAccount, connectBank } = useOtterfundChrome();
  return (
    <OtterfundSpending
      plan={plan}
      accent={accent}
      theme={theme}
      subscriptions={subscriptions}
      currency={currency}
      period={period}
      hasAccounts={hasAccounts}
      onAddAccount={addAccount}
      onConnect={connectBank}
      onAddSubscription={addSubscription}
      onEditSubscription={editSubscription}
      goalsHref={hrefFor("/dashboard/goals")}
    />
  );
}
