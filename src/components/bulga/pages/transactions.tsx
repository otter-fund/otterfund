"use client";

// Bulga — Transactions page.
//
// Translated from the design spec (TRANSACTIONS sc-if, lines 229-263). The static
// reference markup becomes a controlled React view: a real search input that
// filters by merchant name / category, and an All / Income / Spending segmented
// filter. Every row is wired to a real TransactionView — no sample data ships.

import { useMemo, useState, useTransition } from "react";
import { Trash2, Check, ChevronDown } from "lucide-react";
import type { TransactionView } from "@/lib/types";
import type { BulgaTheme } from "@/components/bulga/theme";
import { tintFor } from "@/components/bulga/theme";
import { GuillochePattern, GuillocheSeal } from "@/components/bulga/guilloche";
import { fmt } from "@/lib/format";
import { gqlClient } from "@/lib/graphql/client";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuCheckboxItem,
  MenuSeparator,
} from "@/components/ui/menu";

const DELETE_TRANSACTIONS = /* GraphQL */ `
  mutation DeleteTransactions($ids: [ID!]!) {
    deleteTransactions(ids: $ids) { ok }
  }
`;

interface BulgaTransactionsProps {
  transactions: TransactionView[];
  accounts: { id: string; name: string }[];
  accent: string;
  theme: BulgaTheme;
  currency?: string;
  onEdit?: (t: TransactionView) => void;
  /** Called after a successful bulk delete so the RSC re-fetches. */
  onBulkDeleted?: () => void;
}

type Segment = "all" | "income" | "spending";

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: "all", label: "All" },
  { id: "income", label: "Income" },
  { id: "spending", label: "Spending" },
];

export function BulgaTransactions({ transactions, accounts, theme, currency = "CAD", onEdit, onBulkDeleted }: BulgaTransactionsProps) {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  // Empty set = all accounts. Otherwise, only these account ids are shown.
  const [acctFilter, setAcctFilter] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDeleting, startDelete] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (segment === "income" && t.amount <= 0) return false;
      if (segment === "spending" && t.amount >= 0) return false;
      if (acctFilter.size > 0 && !(t.accountId && acctFilter.has(t.accountId))) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [transactions, query, segment, acctFilter]);

  const toggleAcct = (id: string) => {
    setAcctFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const acctLabel =
    acctFilter.size === 0
      ? "All accounts"
      : acctFilter.size === 1
        ? accounts.find((a) => acctFilter.has(a.id))?.name ?? "1 account"
        : `${acctFilter.size} accounts`;

  // Only ids currently visible can be selected; "select all" targets the filter.
  const visibleIds = useMemo(() => filtered.map((t) => t.id), [filtered]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const clearSelection = () => {
    setSelected(new Set());
    setConfirmingDelete(false);
    setDeleteError(false);
  };

  // Anchor for shift-range selection — the last checkbox toggled without shift.
  const [anchorId, setAnchorId] = useState<string | null>(null);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Mail-client selection on a checkbox: shift = select the contiguous range
  // from the anchor to this row; plain/⌘ = toggle one. Ranges respect the
  // current filter (operate over visibleIds, in displayed order).
  const selectAt = (id: string, e: { shiftKey: boolean }) => {
    if (e.shiftKey && anchorId && anchorId !== id) {
      const from = visibleIds.indexOf(anchorId);
      const to = visibleIds.indexOf(id);
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from < to ? [from, to] : [to, from];
        const range = visibleIds.slice(lo, hi + 1);
        setSelected((prev) => new Set([...prev, ...range]));
        return; // keep the existing anchor for further shift-clicks
      }
    }
    toggleOne(id);
    setAnchorId(id);
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      }
      return new Set([...prev, ...visibleIds]);
    });
  };

  const handleBulkDelete = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setDeleteError(false);
    startDelete(async () => {
      try {
        await gqlClient.request(DELETE_TRANSACTIONS, { ids });
        clearSelection();
        onBulkDeleted?.();
      } catch {
        setDeleteError(true);
        setConfirmingDelete(false);
      }
    });
  };

  return (
    <>
    <div className="bk-enter bk-page">
      {/* controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            flex: 1,
            minWidth: 200,
            height: 42,
            padding: "0 16px",
            borderRadius: 13,
            border: "1px solid var(--color-bk-line)",
            background: "var(--color-bk-surface)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-bk-muted)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transactions"
            aria-label="Search transactions"
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "inherit",
              fontSize: 13.5,
              fontWeight: 500,
              color: "var(--color-bk-ink)",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: 5,
            borderRadius: 999,
            border: "1px solid var(--color-bk-line)",
            background: "var(--color-bk-surface)",
          }}
        >
          {SEGMENTS.map((s) => {
            const active = segment === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSegment(s.id)}
                style={{
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "7px 16px",
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  background: active ? theme.accent : "transparent",
                  color: active ? "#fff" : "var(--color-bk-muted)",
                  transition: "background .16s, color .16s",
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* account filter — Base UI Menu; checkbox items stay open across
            multi-select, and the positioner keeps it on-screen at any width. */}
        {accounts.length > 0 && (
          <Menu>
            <MenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  style={acctFilter.size > 0 ? { background: theme.accentTint, color: theme.accentDeep, borderColor: "transparent" } : undefined}
                >
                  {acctLabel}
                  <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
                </Button>
              }
            />
            <MenuContent align="end" className="min-w-[220px]">
              <MenuRadioGroup value={acctFilter.size === 0 ? "all" : "some"}>
                <MenuRadioItem value="all" onClick={() => setAcctFilter(new Set())}>
                  <span>All accounts</span>
                  {acctFilter.size === 0 && <Check size={15} strokeWidth={2.5} style={{ color: theme.accent, flexShrink: 0 }} aria-hidden="true" />}
                </MenuRadioItem>
              </MenuRadioGroup>
              <MenuSeparator />
              {accounts.map((a) => {
                const on = acctFilter.has(a.id);
                return (
                  <MenuCheckboxItem
                    key={a.id}
                    checked={on}
                    closeOnClick={false}
                    onCheckedChange={() => toggleAcct(a.id)}
                  >
                    <span>{a.name}</span>
                    {on && <Check size={15} strokeWidth={2.5} style={{ color: theme.accent, flexShrink: 0 }} aria-hidden="true" />}
                  </MenuCheckboxItem>
                );
              })}
            </MenuContent>
          </Menu>
        )}
      </div>

      {/* table card */}
      <div
        style={{
          background: "var(--color-bk-surface)",
          border: "1px solid var(--color-bk-line-soft)",
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        {/* header */}
        <div
          className="bk-tx-row"
          style={{
            display: "grid",
            gridTemplateColumns: "26px 2.4fr 1.3fr 1fr 1fr",
            gap: 16,
            padding: "14px 24px",
            background: "var(--color-bk-surface)",
            borderBottom: "1px solid var(--color-bk-line-soft)",
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--color-bk-muted)",
          }}
        >
          <BkCheckbox
            checked={allVisibleSelected}
            onToggle={toggleAllVisible}
            theme={theme}
            ariaLabel="Select all"
          />
          <span>Merchant</span>
          <span className="bk-tx-col-cat">Category</span>
          <span className="bk-tx-col-date">Date</span>
          <span style={{ textAlign: "right" }}>Amount</span>
        </div>

        {filtered.length === 0 ? (
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "72px 24px",
              textAlign: "center",
            }}
          >
            <GuillochePattern accent={theme.accent} accentDeep={theme.accentDeep} fade="radial" opacity={0.16} />
            <div style={{ position: "relative", width: 72, height: 72, marginBottom: 8 }} aria-hidden="true">
              <GuillocheSeal accent={theme.accent} accentDeep={theme.accentDeep} label="$" />
            </div>
            <div style={{ position: "relative", fontSize: 15, fontWeight: 600, color: "var(--color-bk-ink)" }}>
              No transactions
            </div>
            <div style={{ position: "relative", fontSize: 13, color: "var(--color-bk-muted)" }}>
              Nothing matches your search or filter.
            </div>
          </div>
        ) : (
          filtered.map((t) => {
            const [tint, ink] = tintFor(t.category);
            const income = t.amount > 0;
            const amountLabel = (income ? "+" : "−") + fmt(t.amount, currency);
            const isSelected = selected.has(t.id);
            return (
              <div
                key={t.id}
                className="bk-tx-row"
                role="button"
                tabIndex={0}
                onClick={() => onEdit?.(t)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEdit?.(t);
                  }
                }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "26px 2.4fr 1.3fr 1fr 1fr",
                  gap: 16,
                  alignItems: "center",
                  padding: "13px 24px",
                  borderTop: "1px solid var(--color-bk-line-soft)",
                  cursor: "pointer",
                  background: isSelected ? theme.accentTint : "transparent",
                  transition: "background .15s",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "oklch(97.5% 0.005 90)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isSelected ? theme.accentTint : "transparent";
                }}
              >
                <BkCheckbox
                  checked={isSelected}
                  onToggle={(e) => selectAt(t.id, e)}
                  theme={theme}
                  ariaLabel={`Select ${t.name}`}
                  stopPropagation
                />
                <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 11,
                      background: tint,
                      color: ink,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {t.name}
                    </div>
                    {/* Account name — hidden when filtered to one account (redundant). */}
                    {t.accountName && acctFilter.size !== 1 && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--color-bk-faint)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          marginTop: 1,
                        }}
                      >
                        {t.accountName}
                      </div>
                    )}
                  </div>
                </div>
                <div className="bk-tx-col-cat">
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: ink,
                      background: tint,
                      padding: "4px 10px",
                      borderRadius: 999,
                    }}
                  >
                    {t.category}
                  </span>
                </div>
                <span className="bk-tx-col-date" style={{ fontSize: 13, color: "var(--color-bk-muted)" }}>{t.date}</span>
                <span
                  className="bk-num"
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    textAlign: "right",
                    color: income ? theme.accentDeep : "var(--color-bk-ink)",
                  }}
                >
                  {amountLabel}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>

      {/* bulk-action bar — fixed to the viewport bottom, screen-centered. Kept a
          sibling of the .bk-enter wrapper so its permanent transform (animation
          `both`) doesn't re-root this fixed element to the content column. */}
      {selected.size > 0 && (
        <div
          className="bk-pop bk-bulkbar"
          style={{
            // Center over the CONTENT area (right of the 60px icon rail) via
            // symmetric insets + margin auto — NOT translateX, which the bk-pop
            // animation's own transform would override. On mobile the rail is
            // hidden, so .bk-bulkbar resets left:0 (see globals.css) to keep it
            // centered on the full-width viewport.
            position: "fixed",
            left: 60,
            right: 0,
            bottom: 28,
            marginInline: "auto",
            width: "fit-content",
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "10px 12px 10px 20px",
            borderRadius: 999,
            background: "var(--color-bk-ink)",
            boxShadow: "0 16px 40px oklch(20% 0.02 80 / 0.28)",
          }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", color: deleteError ? "oklch(78% 0.09 33)" : "#fff" }}>
            {deleteError
              ? "Couldn't delete. Try again"
              : confirmingDelete
                ? "Are you sure?"
                : `${selected.size} selected`}
          </span>
          <Button
            size="sm"
            onClick={clearSelection}
            disabled={isDeleting}
            className="bg-transparent text-white/70 hover:bg-white/10 hover:text-white"
          >
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleBulkDelete} disabled={isDeleting}>
            <Trash2 data-icon="inline-start" style={{ width: 15, height: 15 }} />
            {isDeleting ? "Deleting…" : confirmingDelete ? "Confirm" : "Delete"}
          </Button>
        </div>
      )}
    </>
  );
}

/** On-brand checkbox — rounded square, hairline when empty, accent fill + check
    when on. Used for row selection; matches the app's radius + accent language. */
function BkCheckbox({
  checked,
  onToggle,
  theme,
  ariaLabel,
  stopPropagation = false,
}: {
  checked: boolean;
  onToggle: (e: React.MouseEvent) => void;
  theme: BulgaTheme;
  ariaLabel: string;
  stopPropagation?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        onToggle(e);
      }}
      // Large, full-cell hit area (negative margin claws back the row/header
      // padding) so the whole box is clickable — not just the 18px glyph.
      style={{
        display: "grid",
        placeItems: "center",
        alignSelf: "stretch",
        margin: "-13px -8px -13px -24px",
        padding: "13px 8px 13px 24px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 18,
          height: 18,
          borderRadius: 6,
          border: checked ? "none" : "1.5px solid var(--color-bk-line)",
          background: checked ? theme.accent : "var(--color-bk-surface)",
          transition: "background .14s, border-color .14s",
        }}
      >
        {checked && <Check size={12} strokeWidth={3} color="#fff" aria-hidden="true" />}
      </span>
    </button>
  );
}
