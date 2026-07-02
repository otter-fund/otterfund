"use client";

// Bulga ACCOUNTS page.
//
// Net-worth hero + accounts grouped by derived section (Cash & savings /
// Investments / Credit), wired to real AccountView data passed in as props.

import { useState, useTransition } from "react";
import { Plus, Landmark, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

import type { AccountView } from "@/lib/types";
import { fmt } from "@/lib/format";
import { tintFor, type BulgaTheme } from "@/components/bulga/theme";
import { GuillochePattern } from "@/components/bulga/guilloche";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const SYNC_PLAID = /* GraphQL */ `
  mutation SyncPlaid { syncPlaid }
`;

interface BulgaAccountsProps {
  accounts: AccountView[];
  netWorth: number;
  accent: string;
  theme: BulgaTheme;
  currency?: string;
  onAdd?: () => void;
  onConnect?: () => void;
  onEdit?: (a: AccountView) => void;
  /** Re-fetch the page's RSC after a successful sync. */
  onSynced?: () => void;
}

type GroupKey = "cash" | "invest" | "credit";

const GROUP_LABELS: Record<GroupKey, string> = {
  cash: "Cash & savings",
  invest: "Investments",
  credit: "Credit",
};

// Render order — groups appear top-to-bottom in this sequence.
const GROUP_ORDER: GroupKey[] = ["cash", "invest", "credit"];

// Avatar tint keys, chosen so the group's accounts read as a coherent family.
const GROUP_TINT_KEY: Record<GroupKey, string> = {
  cash: "Bills",
  invest: "Subscriptions",
  credit: "Entertainment",
};

/** Derive the section a free-string account type belongs to. */
function groupOf(type: string): GroupKey {
  // Normalize so both "credit-card" (stored) and "credit card" match.
  const t = type.trim().toLowerCase().replace(/-/g, " ");
  if (t === "tfsa" || t === "rrsp" || t === "fhsa" || t === "investment") return "invest";
  if (t === "credit card") return "credit";
  // Chequing, Savings, Other-cash, and anything unknown fall into cash.
  return "cash";
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

export function BulgaAccounts({ accounts, netWorth, accent, theme, currency = "CAD", onAdd, onConnect, onEdit, onSynced }: BulgaAccountsProps) {
  const hasLinkedBank = accounts.some((a) => a.synced);
  const [isSyncing, startSync] = useTransition();
  const [syncError, setSyncError] = useState("");

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

  // Bucket the accounts, preserving their incoming order within each group.
  const buckets: Record<GroupKey, AccountView[]> = { cash: [], invest: [], credit: [] };
  for (const a of accounts) buckets[groupOf(a.type)].push(a);

  const groups = GROUP_ORDER.filter((key) => buckets[key].length > 0).map((key) => {
    const items = buckets[key];
    // Group subtotal excludes hidden accounts, matching net worth.
    const total = items.reduce((sum, a) => sum + (a.excluded ? 0 : a.balance), 0);
    return { key, label: GROUP_LABELS[key], items, total };
  });

  return (
    <div className="bk-enter bk-page">
      {/* net worth hero */}
      <section
        className="bk-hero-row"
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "0 4px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <GuillochePattern accent={theme.accent} accentDeep={theme.accentDeep} fade="left" opacity={0.16} />
        <div style={{ position: "relative" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--color-bk-muted)",
            }}
          >
            Net worth · {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
          </div>
          <div
            className="bk-num"
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
        </div>
        <div className="bk-hero-actions" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 10 }}>
          {hasLinkedBank && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
              aria-label="Sync linked banks"
            >
              <RefreshCw data-icon="inline-start" size={15} strokeWidth={2} className={isSyncing ? "bk-spin" : undefined} />
              {isSyncing ? "Syncing…" : "Sync"}
            </Button>
          )}
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
          </div>
          {syncError && (
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-bk-clay)", textAlign: "right", maxWidth: 320 }}>
              {syncError}
            </span>
          )}
        </div>
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
              <span className="bk-num" style={{ fontSize: 14, color: "oklch(48% 0.012 80)" }}>
                {(totalNegative ? "−" : "") + fmt(grp.total, currency)}
              </span>
            </div>

            <div
              style={{
                background: "var(--color-bk-surface)",
                border: "1px solid var(--color-bk-line)",
                borderRadius: 20,
                overflow: "hidden",
              }}
            >
              {grp.items.map((a, i) => {
                const negative = a.balance < 0;
                const fallback = tintFor(GROUP_TINT_KEY[grp.key]);
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
                      borderTop: i === 0 ? "none" : "1px solid var(--color-bk-line-soft)",
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
                              background: "var(--color-bk-line-soft)",
                              color: "var(--color-bk-muted)",
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
                        // For synced accounts show institution + last update;
                        // otherwise the number + monthly change. Join only the
                        // parts that exist, so no dangling "· " separator.
                        const parts = a.synced
                          ? [a.institution, a.syncedLabel && `Updated ${a.syncedLabel}`]
                          : [a.num, a.change];
                        const meta = parts.filter((p) => p && String(p).trim()).join(" · ");
                        return meta ? (
                          <div style={{ fontSize: 12.5, color: "var(--color-bk-muted)" }}>{meta}</div>
                        ) : null;
                      })()}
                    </div>
                    <div
                      className="bk-num"
                      style={{
                        fontSize: 18,
                        fontWeight: 500,
                        color: negative ? theme.clay : "var(--color-bk-ink)",
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
