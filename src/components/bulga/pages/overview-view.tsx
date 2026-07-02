"use client";

import { useRouter } from "next/navigation";
import { BulgaOverview } from "@/components/bulga/pages/overview";
import { useBulgaChrome } from "@/components/bulga/chrome-context";
import type { DashboardOverview } from "@/lib/types";

const ROUTE_FOR: Record<string, string> = {
  goals: "/dashboard/goals",
  transactions: "/dashboard/transactions",
  insights: "/dashboard/insights",
};

export function OverviewView({ overview }: { overview: DashboardOverview }) {
  const router = useRouter();
  const { accent, theme, hrefFor } = useBulgaChrome();
  return (
    <BulgaOverview
      overview={overview}
      accent={accent}
      theme={theme}
      // hrefFor preserves the selected month when landing on a period-scoped
      // route (e.g. Transactions), and stays clean for the others.
      onNavigate={(v) => router.push(hrefFor(ROUTE_FOR[v] ?? "/dashboard"))}
    />
  );
}
