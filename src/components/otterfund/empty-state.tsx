"use client";

// otterfund — the shared empty state.
//
// One branded "nothing here yet" block, in the statement grammar: the guilloché
// seal, a serif-weight title, a muted line of guidance, and an optional action
// row. Every page's cold-start / no-data view is built from this so the app
// degrades to the SAME calm, actionable surface everywhere — never a wall of $0
// figures or an empty chart. <AddAccountEmptyState> is the account-cold-start
// specialisation used across Overview / Accounts / Transactions / Spending.

import type { ReactNode } from "react";
import { Landmark, Plus } from "lucide-react";
import { GuillocheSeal } from "@/components/otterfund/guilloche";
import type { OtterfundTheme } from "@/components/otterfund/theme";
import { Button } from "@/components/ui/button";

export function EmptyState({
  theme,
  title,
  description,
  seal = "$",
  size = "lg",
  actions,
}: {
  theme: OtterfundTheme;
  title: string;
  description?: ReactNode;
  /** Glyph inside the seal — a single character. */
  seal?: string;
  /** "lg" = full-page cold start; "md" = an in-page section that's empty. */
  size?: "md" | "lg";
  actions?: ReactNode;
}) {
  const sealPx = size === "lg" ? 76 : 56;
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: size === "lg" ? "72px 24px" : "48px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ width: sealPx, height: sealPx, marginBottom: 8 }} aria-hidden="true">
        <GuillocheSeal accent={theme.accent} accentDeep={theme.accentDeep} label={seal} />
      </div>
      <div style={{ fontSize: size === "lg" ? 18 : 15, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-of-ink)" }}>
        {title}
      </div>
      {description && (
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-of-muted)", maxWidth: 380, lineHeight: 1.5 }}>
          {description}
        </p>
      )}
      {actions && <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 12 }}>{actions}</div>}
    </section>
  );
}

/**
 * The account cold-start: shown whenever the user has NO accounts (none linked,
 * none manual). Offers the two ways in — connect a bank, or add one by hand.
 * Free users can still click Connect; the chrome's `connectBank` gates it and
 * routes them to pricing. Copy is overridable so each page frames it in its own
 * voice ("see your net worth" on Accounts, "track your spending" on Spending).
 */
export function AddAccountEmptyState({
  theme,
  onAdd,
  onConnect,
  title = "Add an account to get started",
  description = "Connect a bank to sync balances and transactions automatically, or add an account by hand — your money shows up here either way.",
}: {
  theme: OtterfundTheme;
  onAdd?: () => void;
  onConnect?: () => void;
  title?: string;
  description?: ReactNode;
}) {
  return (
    <EmptyState
      theme={theme}
      title={title}
      description={description}
      actions={
        // data-tour anchors the first-run tour's closing step to this CTA.
        <span data-tour="add-account-cta" style={{ display: "inline-flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          <Button size="sm" onClick={() => onConnect?.()} aria-label="Connect a bank">
            <Landmark data-icon="inline-start" size={16} strokeWidth={2} />
            Connect a bank
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAdd?.()} aria-label="Add account" className="border-dashed">
            <Plus data-icon="inline-start" size={16} strokeWidth={2} />
            Add account
          </Button>
        </span>
      }
    />
  );
}
