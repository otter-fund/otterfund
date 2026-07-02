"use client";

// Bulga — SPENDING page.
//
// Rebuilt in the Bulga design system from the pre-redesign Spending tab.
// A budget-vs-actual hero (total spent of total budget, remaining/over badge),
// then per-category bars that animate from 0% on mount and a category
// breakdown list. Over-budget categories switch their bar + figure to clay.
// Every figure derives from `spending`; nothing is sampled.

import type { SpendCategory } from "@/lib/types";
import { type BulgaTheme } from "@/components/bulga/theme";
import { fmt } from "@/lib/format";
import { ProgressBar } from "@/components/bulga/progress";
import { GuillochePattern } from "@/components/bulga/guilloche";

interface BulgaSpendingProps {
  spending: SpendCategory[];
  accent: string;
  theme: BulgaTheme;
  currency?: string;
}

const CARD: React.CSSProperties = {
  background: "var(--color-bk-surface)",
  border: "1px solid var(--color-bk-line)",
  borderRadius: 20,
  padding: 24,
};

export function BulgaSpending({ spending, theme, currency = "CAD" }: BulgaSpendingProps) {

  const money = (n: number) => fmt(n, currency);

  const totalActual = spending.reduce((s, c) => s + c.amount, 0);
  const totalBudget = spending.reduce((s, c) => s + c.budget, 0);
  const remaining = totalBudget - totalActual;
  const overall = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;

  return (
    <div className="bk-enter bk-page">
      {/* ── hero · budget vs actual ── */}
      <section
        className="bk-hero-row"
        style={{
          position: "relative",
          overflow: "hidden",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          padding: "0 4px 32px",
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
              color: "var(--color-bk-faint)",
            }}
          >
            Spending this month
          </div>
          <div
            className="bk-num"
            style={{
              fontSize: "clamp(44px, 5.5vw, 64px)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              marginTop: 12,
            }}
          >
            {money(totalActual)}{" "}
            <span style={{ fontSize: 18, color: "var(--color-bk-muted)", fontWeight: 400 }}>
              of {money(totalBudget)}
            </span>
          </div>
        </div>
        <span
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 13px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            background: remaining >= 0 ? theme.accentTint : theme.clayTint,
            color: remaining >= 0 ? theme.accentDeep : theme.clay,
          }}
        >
          <span className="bk-num">{money(Math.abs(remaining))}</span>
          {remaining >= 0 ? "remaining" : "over"}
        </span>
      </section>

      {/* ── budget vs actual · per-category bars ── */}
      <section style={{ ...CARD, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Budget vs. actual</h3>
          <span style={{ fontSize: 12.5, color: "var(--color-bk-faint)" }}>{overall}% of budget used</span>
        </div>
        {spending.length > 0 ? (
          spending.map((c) => {
            const pct = c.budget > 0 ? Math.min((c.amount / c.budget) * 100, 100) : 0;
            const over = c.amount > c.budget;
            return (
              <div key={c.categoryId} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
                  <span style={{ fontWeight: 500 }}>{c.name}</span>
                  <span className="bk-num" style={{ color: over ? theme.clay : "var(--color-bk-muted)" }}>
                    {money(c.amount)} <span style={{ color: "var(--color-bk-faint)" }}>/ {money(c.budget)}</span>
                  </span>
                </div>
                <ProgressBar value={pct} color={over ? theme.clay : theme.accent} />
              </div>
            );
          })
        ) : (
          <p style={{ fontSize: 14, color: "var(--color-bk-muted)" }}>No spending data this month.</p>
        )}
      </section>

      {/* ── category breakdown · list ── */}
      <section style={CARD}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Category breakdown</h3>
        </div>
        {spending.length > 0 ? (
          spending.map((c) => (
            <div
              key={c.categoryId}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "11px 0",
                borderTop: "1px solid var(--color-bk-line-soft)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: c.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 500 }}>{c.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                <span className="bk-num" style={{ fontSize: 12.5, color: "var(--color-bk-faint)" }}>{Math.round(c.pct)}%</span>
                <span className="bk-num" style={{ fontSize: 14, fontWeight: 500 }}>{money(c.amount)}</span>
              </div>
            </div>
          ))
        ) : (
          <p style={{ fontSize: 14, color: "var(--color-bk-muted)", marginTop: 8 }}>No data yet.</p>
        )}
      </section>
    </div>
  );
}
