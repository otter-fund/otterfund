"use client";

// Shared dashboard chrome state, exposed via context so any routed page can
// read the live accent/theme and trigger the chrome-level modals (add/edit
// dialogs, settings) without prop-drilling across the layout boundary.
//
// Server data is NOT held here — that stays in RSCs (each route fetches its
// own and re-runs on router.refresh()). This context carries only the small,
// genuinely-global *client* state: the accent and the modal triggers.

import { createContext, useContext } from "react";
import type { BulgaTheme } from "@/components/bulga/theme";
import type { TransactionView, GoalView, AccountView } from "@/lib/types";

export interface BulgaChromeValue {
  /** Live accent (oklch) and its derived palette. */
  accent: string;
  theme: BulgaTheme;
  /** Switch + persist the accent (used by the Brand kit). */
  setAccent: (accent: string) => void;
  /** Open the chrome-owned modals. */
  addTransaction: () => void;
  addGoal: () => void;
  addAccount: () => void;
  editTransaction: (tx: TransactionView) => void;
  editGoal: (goal: GoalView) => void;
  editAccount: (account: AccountView) => void;
}

const BulgaChromeContext = createContext<BulgaChromeValue | null>(null);

export const BulgaChromeProvider = BulgaChromeContext.Provider;

export function useBulgaChrome(): BulgaChromeValue {
  const ctx = useContext(BulgaChromeContext);
  if (!ctx) {
    throw new Error("useBulgaChrome must be used within the dashboard layout");
  }
  return ctx;
}
