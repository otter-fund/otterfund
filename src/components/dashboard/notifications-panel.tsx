"use client";

import type { SpendCategory, BillView } from "@/lib/types";
import { fmt } from "@/lib/format";
import { AlertTriangle, TrendingUp, Calendar } from "lucide-react";

interface NotificationsPanelProps {
  budgetTarget: number;
  monthlySpend: number;
  spendingByCategory: SpendCategory[];
  upcomingBills: BillView[];
}

interface Notification {
  type: "warning" | "alert" | "info";
  title: string;
  message: string;
}

export function NotificationsPanel({
  budgetTarget,
  monthlySpend,
  spendingByCategory,
  upcomingBills,
}: NotificationsPanelProps) {
  const notifications: Notification[] = [];

  // Budget warnings
  if (budgetTarget > 0) {
    const pct = (monthlySpend / budgetTarget) * 100;
    if (pct > 100) {
      notifications.push({
        type: "alert",
        title: "Budget Exceeded",
        message: `You've spent ${fmt(monthlySpend)} of your ${fmt(budgetTarget)} budget (${Math.round(pct)}%).`,
      });
    } else if (pct > 80) {
      notifications.push({
        type: "warning",
        title: "Approaching Budget",
        message: `You've used ${Math.round(pct)}% of your monthly budget. ${fmt(budgetTarget - monthlySpend)} remaining.`,
      });
    }
  }

  // Category-level warnings
  for (const cat of spendingByCategory) {
    if (cat.budget > 0 && cat.amount > cat.budget) {
      notifications.push({
        type: "warning",
        title: `${cat.name} Over Budget`,
        message: `Spent ${fmt(cat.amount)} of ${fmt(cat.budget)} budget.`,
      });
    }
  }

  // Upcoming bills
  for (const bill of upcomingBills) {
    if (bill.urgent) {
      notifications.push({
        type: "info",
        title: `Bill Due Soon`,
        message: `${bill.name}: ${fmt(bill.amount)} due ${bill.due}.`,
      });
    }
  }

  if (notifications.length === 0) {
    notifications.push({
      type: "info",
      title: "All Good!",
      message: "No alerts right now. Your finances are on track.",
    });
  }

  const iconMap = {
    warning: <TrendingUp className="w-4 h-4 text-[var(--color-of-clay)]" />,
    alert: <AlertTriangle className="w-4 h-4 text-[var(--color-of-clay)]" />,
    info: <Calendar className="w-4 h-4 text-[var(--color-primary)]" />,
  };

  // Content only — the surface, positioning, scrim, focus and dismissal are
  // owned by the <Popover> wrapper in the shell (ui/popover.tsx). Fixed width
  // on wide screens; the Popover caps it to the viewport on small ones.
  return (
    <div className="w-[320px] max-w-full">
      <div className="px-4 py-3 border-b border-[var(--color-of-line)]">
        <span className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-of-faint)]">
          Notifications
        </span>
      </div>
      <div className="max-h-[360px] overflow-y-auto of-scroll">
        {notifications.map((n, i) => (
          <div
            key={i}
            className="flex gap-3 px-4 py-3 border-b border-[var(--color-of-line-soft)] last:border-b-0 hover:bg-[oklch(98%_0.004_90)]"
          >
            <div className="mt-0.5 shrink-0">{iconMap[n.type]}</div>
            <div>
              <div className="text-[13px] font-semibold tracking-[-0.02em] text-[var(--color-of-ink)]">{n.title}</div>
              <div className="text-[11px] text-[var(--color-of-muted)] mt-0.5">{n.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
