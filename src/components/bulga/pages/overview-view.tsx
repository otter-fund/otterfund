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
  const { accent, theme } = useBulgaChrome();
  return (
    <BulgaOverview
      overview={overview}
      accent={accent}
      theme={theme}
      onNavigate={(v) => router.push(ROUTE_FOR[v] ?? "/dashboard")}
    />
  );
}
