"use client";

import { useRouter } from "next/navigation";
import { OtterfundOverview } from "@/components/otterfund/pages/overview";
import { useOtterfundChrome } from "@/components/otterfund/chrome-context";
import type { DashboardOverview } from "@/lib/types";

const ROUTE_FOR: Record<string, string> = {
  goals: "/dashboard/goals",
  transactions: "/dashboard/transactions",
  insights: "/dashboard/insights",
};

export function OverviewView({ overview }: { overview: DashboardOverview }) {
  const router = useRouter();
  const { accent, theme, hrefFor } = useOtterfundChrome();
  return (
    <OtterfundOverview
      overview={overview}
      accent={accent}
      theme={theme}
      // hrefFor preserves the selected month when landing on a period-scoped
      // route (e.g. Transactions), and stays clean for the others.
      onNavigate={(v) => router.push(hrefFor(ROUTE_FOR[v] ?? "/dashboard"))}
    />
  );
}
