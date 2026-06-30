"use client";

import { BulgaSpending } from "@/components/bulga/pages/spending";
import { useBulgaChrome } from "@/components/bulga/chrome-context";
import type { SpendCategory } from "@/lib/types";

export function SpendingView({ spending, currency }: { spending: SpendCategory[]; currency: string }) {
  const { accent, theme } = useBulgaChrome();
  return <BulgaSpending spending={spending} currency={currency} accent={accent} theme={theme} />;
}
