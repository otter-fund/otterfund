"use client";

import { OtterfundInsights } from "@/components/otterfund/pages/insights";
import { useOtterfundChrome } from "@/components/otterfund/chrome-context";
import type { InsightView } from "@/lib/types";

export function InsightsView({ insights, currency }: { insights: InsightView[]; currency: string }) {
  const { accent, theme } = useOtterfundChrome();
  return <OtterfundInsights insights={insights} accent={accent} theme={theme} currency={currency} />;
}
