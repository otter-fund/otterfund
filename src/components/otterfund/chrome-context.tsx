"use client";

// Shared dashboard chrome state, exposed via context so any routed page can
// read the live accent/theme and trigger the chrome-level modals (add/edit
// dialogs, settings) without prop-drilling across the layout boundary.
//
// Server data is NOT held here — that stays in RSCs (each route fetches its
// own and re-runs on router.refresh()). This context carries only the small,
// genuinely-global *client* state: the accent and the modal triggers.

import { createContext, useContext } from "react";
import type { OtterfundTheme } from "@/components/otterfund/theme";
import type { TransactionView, GoalView, AccountView, SubscriptionView, InvestmentView } from "@/lib/types";
import type { Feature, PlanTier } from "@/lib/plans";

export interface OtterfundChromeValue {
  /** Live accent (oklch) and its derived palette. */
  accent: string;
  theme: OtterfundTheme;
  /** Switch + persist the accent (used by the Brand kit). */
  setAccent: (accent: string) => void;
  /** The user's billing tier — pages read it to render locked states. */
  plan: PlanTier;
  /** Gate an action: true = proceed; false = plan lacks it (redirects to pricing). */
  requireFeature: (feature: Feature) => boolean;
  /** Send the user to the pricing page to upgrade. */
  promptUpgrade: () => void;
  /** Open Stripe's hosted billing portal to manage/cancel a paid plan. */
  openBillingPortal: () => void;
  /** Open the chrome-owned modals. */
  addTransaction: () => void;
  addGoal: () => void;
  addAccount: () => void;
  addSubscription: () => void;
  addInvestment: () => void;
  /** Open the Connect-a-bank modal. Pass a Plaid itemId to reconnect (update mode). */
  connectBank: (updateItemId?: string) => void;
  editSubscription: (subscription: SubscriptionView) => void;
  editInvestment: (investment: InvestmentView) => void;
  editTransaction: (tx: TransactionView) => void;
  editGoal: (goal: GoalView) => void;
  editAccount: (account: AccountView) => void;
  /** Re-run the current route's RSC to pick up mutated server data. */
  refreshData: () => void;
  /** Build a route href that preserves the remembered period on period-scoped
      routes (and stays clean elsewhere). Use for ALL cross-route navigation so
      the selected month survives — the rail and in-page links both go through
      it, and the destination URL is born correct (no post-mount redirect). */
  hrefFor: (href: string) => string;
  /** Period-scoped transaction count for the topbar subtitle. A period page
      reports its real count here (chrome can't know it — it's the page's data);
      null when the current route doesn't track one. */
  txCount: number | null;
  setTxCount: (n: number | null) => void;
}

const OtterfundChromeContext = createContext<OtterfundChromeValue | null>(null);

export const OtterfundChromeProvider = OtterfundChromeContext.Provider;

export function useOtterfundChrome(): OtterfundChromeValue {
  const ctx = useContext(OtterfundChromeContext);
  if (!ctx) {
    throw new Error("useOtterfundChrome must be used within the dashboard layout");
  }
  return ctx;
}
