"use client";

import { BulgaSpending } from "@/components/bulga/pages/spending";
import { useBulgaChrome } from "@/components/bulga/chrome-context";
import type { SpendingPlanView } from "@/lib/types";

export function SpendingView({ plan }: { plan: SpendingPlanView }) {
  const { accent, theme } = useBulgaChrome();
  return <BulgaSpending plan={plan} accent={accent} theme={theme} />;
}
