"use client";

// Bulga — Transactions page.
//
// Translated from the design spec (TRANSACTIONS sc-if, lines 229-263). The static
// reference markup becomes a controlled React view: a real search input that
// filters by merchant name / category, and an All / Income / Spending segmented
// filter. Every row is wired to a real TransactionView — no sample data ships.

import { useMemo, useState } from "react";
import type { TransactionView } from "@/lib/types";
import type { BulgaTheme } from "@/components/bulga/theme";
import { tintFor } from "@/components/bulga/theme";
import { fmt } from "@/lib/format";

interface BulgaTransactionsProps {
  transactions: TransactionView[];
  accent: string;
  theme: BulgaTheme;
  currency?: string;
  onEdit?: (t: TransactionView) => void;
}

type Segment = "all" | "income" | "spending";

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: "all", label: "All" },
  { id: "income", label: "Income" },
  { id: "spending", label: "Spending" },
];

export function BulgaTransactions({ transactions, theme, currency = "CAD", onEdit }: BulgaTransactionsProps) {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (segment === "income" && t.amount <= 0) return false;
      if (segment === "spending" && t.amount >= 0) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [transactions, query, segment]);

  return (
    <div
      className="bk-enter"
      style={{ maxWidth: 1000, margin: "0 auto" }}
    >
      {/* controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            flex: 1,
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
          style={{
            display: "grid",
            gridTemplateColumns: "2.4fr 1.3fr 1fr 1fr",
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
          <span>Merchant</span>
          <span>Category</span>
          <span>Date</span>
          <span style={{ textAlign: "right" }}>Amount</span>
        </div>

        {filtered.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "72px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-bk-ink)" }}>
              No transactions
            </div>
            <div style={{ fontSize: 13, color: "var(--color-bk-muted)" }}>
              Nothing matches your search or filter.
            </div>
          </div>
        ) : (
          filtered.map((t) => {
            const [tint, ink] = tintFor(t.category);
            const income = t.amount > 0;
            const amountLabel = (income ? "+" : "−") + fmt(t.amount, currency);
            return (
              <div
                key={t.id}
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
                  gridTemplateColumns: "2.4fr 1.3fr 1fr 1fr",
                  gap: 16,
                  alignItems: "center",
                  padding: "13px 24px",
                  borderTop: "1px solid var(--color-bk-line-soft)",
                  cursor: "pointer",
                  transition: "background .15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "oklch(97.5% 0.005 90)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
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
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {t.name}
                  </span>
                </div>
                <div>
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
                <span style={{ fontSize: 13, color: "var(--color-bk-muted)" }}>{t.date}</span>
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
  );
}
