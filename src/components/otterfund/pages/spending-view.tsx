"use client";

import { OtterfundSpending } from "@/components/otterfund/pages/spending";
import { useOtterfundChrome } from "@/components/otterfund/chrome-context";
import type { SpendingPlanView } from "@/lib/types";

export function SpendingView({ plan }: { plan: SpendingPlanView }) {
  const { accent, theme } = useOtterfundChrome();
  return <OtterfundSpending plan={plan} accent={accent} theme={theme} />;
}
