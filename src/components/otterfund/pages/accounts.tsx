"use client";

// otterfund ACCOUNTS page.
//
// Net-worth hero + accounts grouped one of two ways: by derived section
// (Cash & savings / Investments / Credit — the default) or by bank (each
// linked institution's accounts together, manual ones pooled at the end).
// The grouping toggle + manual sync live in one "Options" dropdown, shown
// only when a bank is linked — without synced accounts neither applies.
// Wired to real AccountView data passed in as props.

import { useState, useTransition } from "react";
import { Plus, Landmark, RefreshCw, Check, ChevronDown, SlidersHorizontal, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuRadioGroup,
  MenuRadioItem,
} from "@/components/ui/menu";

import type { AccountView, NetWorthPoint } from "@/lib/types";
import { fmt } from "@/lib/format";
import { ACCOUNT_TYPES, accountGroupOf, type AccountGroup } from "@/lib/constants";
import { tintFor, type OtterfundTheme } from "@/components/otterfund/theme";
import { GuillochePattern } from "@/components/otterfund/guilloche";
import { StatPill } from "@/components/otterfund/stat-pill";
import { NetWorthSparkline } from "@/components/otterfund/net-worth-sparkline";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const SYNC_PLAID = /* GraphQL */ `
  mutation SyncPlaid { syncPlaid }
`;

interface OtterfundAccountsProps {
  accounts: AccountView[];
  netWorth: number;
  /** Month-by-month net-worth history for the hero sparkline. */
  netWorthTrend?: NetWorthPoint[];
  /** This month's net-worth change — the signed pill beside the figure. */
  netWorthChange?: number;
  accent: string;
  theme: OtterfundTheme;
  currency?: string;
  onAdd?: () => void;
  onConnect?: () => void;
  onEdit?: (a: AccountView) => void;
  /** Re-fetch the page's RSC after a successful sync. */
  onSynced?: () => void;
  /** Open the Investments drill-in (portfolio + holdings). */
  onViewInvestments?: () => void;
}

type GroupKey = AccountGroup;

const GROUP_LABELS: Record<GroupKey, string> = {
  cash: "Cash & savings",
  loans: "Loans & mortgages",
  invest: "Investments",
  credit: "Credit",
};

// Render order — groups appear top-to-bottom in this sequence.
const GROUP_ORDER: GroupKey[] = ["cash", "loans", "invest", "credit"];

// Avatar tint keys, chosen so the group's accounts read as a coherent family.
const GROUP_TINT_KEY: Record<GroupKey, string> = {
  cash: "Bills",
  loans: "Housing",
  invest: "Subscriptions",
  credit: "Entertainment",
};

/** Canonical display label for a stored account type ("credit-card" → "Credit Card"). */
function typeLabel(type: string): string {
  const t = type.trim().toLowerCase().replace(/-/g, " ");
  const known = ACCOUNT_TYPES.find((k) => k.toLowerCase() === t);
  return known ?? (t.charAt(0).toUpperCase() + t.slice(1));
}

/** Treat an account's bg as a usable CSS color (not empty / placeholder). */
function usableColor(bg: string | undefined): bg is string {
  if (!bg) return false;
  const v = bg.trim();
  return v.length > 0 && v.toLowerCase() !== "transparent" && v.toLowerCase() !== "none";
}

function initialOf(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, "");
  return (letters[0] ?? name[0] ?? "?").toUpperCase();
}

export function OtterfundAccounts({ accounts, netWorth, netWorthTrend = [], netWorthChange = 0, theme, currency = "CAD", onAdd, onConnect, onEdit, onSynced, onViewInvestments }: OtterfundAccountsProps) {
  const hasLinkedBank = accounts.some((a) => a.synced);
  const hasTrend = netWorthTrend.length > 0;
  const money = (n: number) => fmt(n, currency);
  const signed = (n: number) => `${n < 0 ? "−" : "+"}${money(n)}`;
  const nwDown = netWorthChange < 0;
  const [isSyncing, startSync] = useTransition();
  const [syncError, setSyncError] = useState("");

  // Grouping view. "type" is the default; "bank" clusters each linked
  // institution's accounts (chequing + credit + investment together) with
  // manual accounts pooled last. Only reachable with a linked bank — the
  // Options menu that switches it is hidden otherwise, and the guard below
  // snaps back to "type" if the last bank is disconnected mid-session.
  const [groupBy, setGroupBy] = useState<"type" | "bank">("type");
  const mode = hasLinkedBank ? groupBy : "type";

  const handleSync = () => {
    setSyncError("");
    startSync(async () => {
      try {
        await gqlClient.request(SYNC_PLAID);
        onSynced?.();
      } catch (e) {
        // Rate-limit ("syncing too often") and other failures surface inline.
        setSyncError(errMessage(e));
      }
    });
  };

  // Group subtotal excludes hidden accounts, matching net worth.
  const totalOf = (items: AccountView[]) =>
    items.reduce((sum, a) => sum + (a.excluded ? 0 : a.balance), 0);

  // Bucket the accounts, preserving their incoming order within each group.
  let groups: { key: string; label: string; items: AccountView[]; total: number }[];
  if (mode === "bank") {
    // One group per institution (in order of first appearance), manual last.
    const byKey = new Map<string, AccountView[]>();
    for (const a of accounts) {
      const key = a.synced ? `bank:${a.institution?.trim() || "Linked bank"}` : "manual";
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(a);
    }
    const ordered = [...byKey.keys()].filter((k) => k !== "manual");
    if (byKey.has("manual")) ordered.push("manual");
    groups = ordered.map((key) => {
      const items = byKey.get(key)!;
      return {
        key,
        label: key === "manual" ? "Manual accounts" : key.slice("bank:".length),
        items,
        total: totalOf(items),
      };
    });
  } else {
    const buckets: Record<GroupKey, AccountView[]> = { cash: [], loans: [], invest: [], credit: [] };
    for (const a of accounts) buckets[accountGroupOf(a.type)].push(a);
    groups = GROUP_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({
      key,
      label: GROUP_LABELS[key],
      items: buckets[key],
      total: totalOf(buckets[key]),
    }));
  }

  return (
    <div className="of-enter of-page">
      {/* net worth hero */}
      <section
        className="of-nw-hero"
        style={{
          position: "relative",
          padding: "0 4px 32px",
        }}
      >
        {/* Clip only the backdrop, not the section — so the sparkline tooltip
            can overflow past the hero edges instead of getting cut off. */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <GuillochePattern
            accent={theme.accent}
            accentDeep={theme.accentDeep}
            fade="left"
            opacity={0.1}
            style={{
              maskImage: "linear-gradient(to right, #000 2%, transparent 52%)",
              WebkitMaskImage: "linear-gradient(to right, #000 2%, transparent 52%)",
            }}
          />
        </div>
        <div
          className="of-hero-row"
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
        <div style={{ position: "relative" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--color-of-muted)",
            }}
          >
            Net worth · {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
          </div>
          <div
            className="of-num"
            style={{
              fontSize: "clamp(44px, 5.5vw, 60px)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              marginTop: 12,
            }}
          >
            {fmt(netWorth, currency)}
          </div>
          {hasTrend && (
            <div style={{ marginTop: 14 }}>
              <StatPill
                theme={theme}
                figure={signed(netWorthChange)}
                label="this month"
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d={nwDown ? "M7 7 17 17M9 17h8V9" : "M7 17 17 7M9 7h8v8"} />
                  </svg>
                }
              />
            </div>
          )}
        </div>
        <div className="of-hero-actions" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 10 }}>
          <Button size="sm" onClick={() => onConnect?.()} aria-label="Connect a bank">
            <Landmark data-icon="inline-start" size={16} strokeWidth={2} />
            Connect a bank
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAdd?.()}
            aria-label="Add account"
            className="border-dashed"
          >
            <Plus data-icon="inline-start" size={16} strokeWidth={2} />
            Add account
          </Button>
          {/* Sync + grouping share one Options menu (the transactions account-
              filter language) — both only make sense with a linked bank. */}
          {hasLinkedBank && (
            <Menu>
              <MenuTrigger
                render={
                  <Button variant="outline" size="sm" aria-label="Account view options">
                    {isSyncing ? (
                      <RefreshCw data-icon="inline-start" size={15} strokeWidth={2} className="of-spin" />
                    ) : (
                      <SlidersHorizontal data-icon="inline-start" size={15} strokeWidth={2} />
                    )}
                    {isSyncing ? "Syncing…" : "Options"}
                    <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
                  </Button>
                }
              />
              <MenuContent align="end" className="min-w-[210px]">
                <MenuItem onClick={handleSync} disabled={isSyncing}>
                  <RefreshCw size={15} strokeWidth={2} aria-hidden="true" />
                  <span>Sync accounts</span>
                </MenuItem>
                <MenuSeparator />
                <div className="px-2.5 pt-1.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--color-of-faint)]">
                  Group by
                </div>
                <MenuRadioGroup value={groupBy}>
                  <MenuRadioItem value="type" onClick={() => setGroupBy("type")}>
                    <span>Account type</span>
                    {groupBy === "type" && <Check size={15} strokeWidth={2.5} style={{ color: theme.accent, flexShrink: 0 }} aria-hidden="true" />}
                  </MenuRadioItem>
                  <MenuRadioItem value="bank" onClick={() => setGroupBy("bank")}>
                    <span>Bank</span>
                    {groupBy === "bank" && <Check size={15} strokeWidth={2.5} style={{ color: theme.accent, flexShrink: 0 }} aria-hidden="true" />}
                  </MenuRadioItem>
                </MenuRadioGroup>
              </MenuContent>
            </Menu>
          )}
          </div>
          {syncError && (
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-of-clay)", textAlign: "right", maxWidth: 320 }}>
              {syncError}
            </span>
          )}
        </div>
        </div>

        {/* net-worth history — the balance-sheet's trend belongs here, beside
            the balances that make it up (the Overview shows the same line). */}
        {hasTrend && (
          <div style={{ position: "relative", marginTop: 18 }}>
            <NetWorthSparkline trend={netWorthTrend} theme={theme} money={money} signed={signed} currency={currency} height={104} />
          </div>
        )}
      </section>

      {/* groups */}
      {groups.map((grp) => {
        const totalNegative = grp.total < 0;
        return (
          <div key={grp.key} style={{ marginBottom: 26 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "0 4px 12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "oklch(48% 0.012 80)",
                  }}
                >
                  {grp.label}
                </h3>
                {/* Investments open their full portfolio (allocation + holdings)
                    as a drill-in — Accounts is the one home for balances. */}
                {grp.key === "invest" && onViewInvestments && (
                  <Button
                    variant="link"
                    size="xs"
                    onClick={() => onViewInvestments()}
                    className="text-[12px]"
                  >
                    <TrendingUp strokeWidth={2.2} aria-hidden="true" />
                    View portfolio →
                  </Button>
                )}
              </div>
              <span className="of-num" style={{ fontSize: 14, color: "oklch(48% 0.012 80)" }}>
                {(totalNegative ? "−" : "") + fmt(grp.total, currency)}
              </span>
            </div>

            <div
              style={{
                background: "var(--color-of-surface)",
                border: "1px solid var(--color-of-line)",
                borderRadius: 20,
                overflow: "hidden",
              }}
            >
              {grp.items.map((a, i) => {
                const negative = a.balance < 0;
                // Tint by the account's own type-family (not the visible group)
                // so an account's avatar stays identical across both views.
                const fallback = tintFor(GROUP_TINT_KEY[accountGroupOf(a.type)]);
                const tileBg = usableColor(a.bg) ? a.bg : fallback[0];
                const tileInk = usableColor(a.bg) ? "#fff" : fallback[1];
                return (
                  <div
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onEdit?.(a)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onEdit?.(a);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 15,
                      padding: "18px 22px",
                      borderTop: i === 0 ? "none" : "1px solid var(--color-of-line-soft)",
                      transition: "background .15s, opacity .15s",
                      cursor: "pointer",
                      // Excluded accounts are dimmed — kept visible so they can be
                      // un-hidden, but visibly omitted from net worth.
                      opacity: a.excluded ? 0.5 : 1,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 13,
                        background: tileBg,
                        color: tileInk,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 15,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {initialOf(a.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            fontSize: 14.5,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {a.name}
                        </span>
                        {a.synced && (
                          <span
                            style={{
                              flexShrink: 0,
                              padding: "2px 8px",
                              borderRadius: 9999,
                              background: "var(--accent)",
                              color: "var(--accent-foreground)",
                              fontSize: 10.5,
                              fontWeight: 600,
                              letterSpacing: "0.02em",
                            }}
                          >
                            Synced
                          </span>
                        )}
                        {a.excluded && (
                          <span
                            style={{
                              flexShrink: 0,
                              padding: "2px 8px",
                              borderRadius: 9999,
                              background: "var(--color-of-line-soft)",
                              color: "var(--color-of-muted)",
                              fontSize: 10.5,
                              fontWeight: 600,
                              letterSpacing: "0.02em",
                            }}
                          >
                            Hidden
                          </span>
                        )}
                      </div>
                      {(() => {
                        // For synced accounts show institution + last update —
                        // except in bank view, where the institution IS the
                        // group header, so show the account type instead.
                        // Manual rows keep number + monthly change. Join only
                        // the parts that exist, so no dangling "· " separator.
                        const parts = a.synced
                          ? [mode === "bank" ? typeLabel(a.type) : a.institution, a.syncedLabel && `Updated ${a.syncedLabel}`]
                          : [a.num, a.change];
                        const meta = parts.filter((p) => p && String(p).trim()).join(" · ");
                        return meta ? (
                          <div style={{ fontSize: 12.5, color: "var(--color-of-muted)" }}>{meta}</div>
                        ) : null;
                      })()}
                    </div>
                    <div
                      className="of-num"
                      style={{
                        fontSize: 18,
                        fontWeight: 500,
                        color: negative ? theme.clay : "var(--color-of-ink)",
                      }}
                    >
                      {(negative ? "−" : "") + fmt(a.balance, currency)}
                    </div>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="oklch(70% 0.01 80)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
