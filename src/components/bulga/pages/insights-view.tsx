"use client";

import { BulgaInsights } from "@/components/bulga/pages/insights";
import { useBulgaChrome } from "@/components/bulga/chrome-context";
import type { InsightView } from "@/lib/types";

export function InsightsView({ insights }: { insights: InsightView[] }) {
  const { accent, theme } = useBulgaChrome();
  return <BulgaInsights insights={insights} accent={accent} theme={theme} />;
}
