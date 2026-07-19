"use client";

// The customizable primary navigation — one flat, user-orderable list shared by
// the icon rail (otterfund-chrome), the mobile sheet (mobile-nav), and the
// customize editor (sidebar-customizer). Items carry a STABLE `key` that is what
// gets persisted in the saved layout, so a label/href/icon can change later
// without orphaning a user's saved order. Dev tools stay separate + admin-only
// (see SECONDARY_NAV in otterfund-chrome) and are NOT customizable.

import { Home, List, CreditCard, Target, PieChart, TrendingUp, Repeat, type LucideProps } from "lucide-react";
import { OtterFace } from "@/components/otterfund/logo";

export interface NavItem {
  /** Stable id persisted in the saved layout — independent of href/label/icon.
      Never reuse a key for a different destination. */
  key: string;
  href: string;
  label: string;
  Icon: React.ComponentType<LucideProps>;
}

// Default order = the previous Flow · Holdings · Advisor grouping, flattened
// (the rail already rendered them as one continuous run). This is the seed a
// user with no saved layout sees, and the fallback position for any item their
// saved layout predates.
export const NAV_ITEMS: NavItem[] = [
  { key: "overview", href: "/dashboard", label: "Overview", Icon: Home },
  { key: "transactions", href: "/dashboard/transactions", label: "Transactions", Icon: List },
  { key: "spending", href: "/dashboard/spending", label: "Spending", Icon: PieChart },
  { key: "subscriptions", href: "/dashboard/subscriptions", label: "Subscriptions", Icon: Repeat },
  { key: "accounts", href: "/dashboard/accounts", label: "Accounts", Icon: CreditCard },
  { key: "investments", href: "/dashboard/investments", label: "Investments", Icon: TrendingUp },
  { key: "goals", href: "/dashboard/goals", label: "Goals", Icon: Target },
  { key: "insights", href: "/dashboard/insights", label: "Insights", Icon: OtterFace },
];

/** The persisted shape: an ordered list of item keys + the hidden set. */
export interface SidebarLayout {
  order: string[];
  hidden: string[];
}

export interface ResolvedNav {
  /** Every item in the user's order (hidden ones included) — for the editor. */
  ordered: NavItem[];
  /** Just the shown items, in order — for the rail + mobile sheet. */
  visible: NavItem[];
  /** Hidden keys, as a Set for O(1) lookup. */
  hidden: Set<string>;
}

/**
 * Apply a saved layout over the item registry. Robust to drift: unknown keys in
 * the saved order are dropped, and any registry item missing from the saved
 * order is appended in its default position — so a nav item shipped in a later
 * release still shows for users who saved a layout before it existed.
 */
export function resolveNav(
  layout: SidebarLayout | null | undefined,
  items: NavItem[] = NAV_ITEMS,
): ResolvedNav {
  const byKey = new Map(items.map((i) => [i.key, i]));
  const hidden = new Set((layout?.hidden ?? []).filter((k) => byKey.has(k)));
  const ordered: NavItem[] = [];
  const seen = new Set<string>();
  for (const key of layout?.order ?? []) {
    const item = byKey.get(key);
    if (item && !seen.has(key)) {
      ordered.push(item);
      seen.add(key);
    }
  }
  for (const item of items) {
    if (!seen.has(item.key)) ordered.push(item);
  }
  // Never let the rail go empty: if every item is hidden, ignore the hidden set.
  const visible = ordered.filter((i) => !hidden.has(i.key));
  return { ordered, visible: visible.length ? visible : ordered, hidden };
}
