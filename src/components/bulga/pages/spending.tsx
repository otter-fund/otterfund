"use client";

// Bulga — SPENDING page.
//
// Built around the user's budget plan (Needs / Wants / Savings). The hero shows
// spend-of-budget for the month; a dual donut contrasts the plan's target split
// with this month's actual utilization; per-bucket bars track actual vs. target
// (clay when a spend bucket is over); and a grouped breakdown lists each
// category under its bucket. Every figure derives from `plan`; the plan itself
// is chosen in onboarding and changed in Settings.

import type { SpendingPlanView, SpendingBucket } from "@/lib/types";
import { type BulgaTheme, hueOf } from "@/components/bulga/theme";
import { getBudgetPlan } from "@/lib/constants";
import { fmt } from "@/lib/format";
import { ProgressBar } from "@/components/bulga/progress";
import { DonutChart } from "@/components/bulga/donut-chart";
import { GuillochePattern } from "@/components/bulga/guilloche";

interface BulgaSpendingProps {
  plan: SpendingPlanView;
  accent: string;
  theme: BulgaTheme;
}

const CARD: React.CSSProperties = {
  background: "var(--color-bk-surface)",
  border: "1px solid var(--color-bk-line)",
  borderRadius: 20,
  padding: 24,
};

const EYEBROW: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-bk-faint)",
};

export function BulgaSpending({ plan, theme }: BulgaSpendingProps) {
  const currency = plan.currency;
  const money = (n: number) => fmt(n, currency);
  const hue = hueOf(theme.accent);
  const planMeta = getBudgetPlan(plan.planId);

  // Three cohesive shades of the active accent hue, one per bucket.
  const bucketColor: Record<SpendingBucket["key"], string> = {
    needs: theme.accentDeep,
    wants: theme.accent,
    savings: `oklch(75% 0.07 ${hue})`,
  };

  const needs = plan.buckets.find((b) => b.key === "needs")!;
  const wants = plan.buckets.find((b) => b.key === "wants")!;
  const savings = plan.buckets.find((b) => b.key === "savings")!;

  const income = plan.monthlyIncome;
  const totalSpent = plan.totalSpent;
  const spendBudget = needs.targetAmount + wants.targetAmount;
  const hasIncome = income > 0;
  // Legend shares the donut's denominator (sum of actual segment values) so the
  // two always agree and the percentages total 100% — even when overspending
  // floors savings at 0 and the segments sum to totalSpent instead of income.
  const actualDenom = plan.buckets.reduce((s, b) => s + b.actualAmount, 0);

  const targetSegments = plan.buckets.map((b) => ({
    value: b.targetPct,
    color: bucketColor[b.key],
    label: b.label,
  }));
  const actualSegments = plan.buckets.map((b) => ({
    value: b.actualAmount,
    color: bucketColor[b.key],
    label: b.label,
  }));

  return (
    <div className="bk-enter bk-page">
      {/* ── hero · spent of budget ── */}
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
          <div style={{ ...EYEBROW, fontSize: 12, letterSpacing: "0.07em" }}>Spending this month</div>
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
            {money(totalSpent)}{" "}
            <span style={{ fontSize: 18, color: "var(--color-bk-muted)", fontWeight: 400 }}>
              of {money(spendBudget)}
            </span>
          </div>
        </div>
      </section>

      {/* ── plan vs. actual · dual donut ── */}
      <section style={{ ...CARD, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Plan vs. actual</h3>
          <span style={{ fontSize: 12.5, color: "var(--color-bk-faint)" }}>{planMeta.name}</span>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--color-bk-muted)", margin: "6px 0 20px" }}>
          How your income should split, next to how you actually used it this month.
        </p>

        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <DonutChart segments={targetSegments}>
              <span style={EYEBROW}>Target</span>
              <span className="bk-num" style={{ fontSize: 15, fontWeight: 500 }}>{planMeta.name.split(" ")[0]}</span>
            </DonutChart>
            <span style={{ ...EYEBROW, fontSize: 11.5 }}>Your plan</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <DonutChart segments={actualSegments}>
              <span style={EYEBROW}>Spent</span>
              <span className="bk-num" style={{ fontSize: 19, fontWeight: 500 }}>{money(totalSpent)}</span>
            </DonutChart>
            <span style={{ ...EYEBROW, fontSize: 11.5 }}>This month</span>
          </div>
        </div>

        {/* legend — target vs actual share of income per bucket */}
        <div style={{ marginTop: 24, display: "grid", gap: 11 }}>
          {plan.buckets.map((b) => {
            const actualPct = actualDenom > 0 ? Math.round((b.actualAmount / actualDenom) * 100) : 0;
            return (
              <div
                key={b.key}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: bucketColor[b.key], flexShrink: 0 }} />
                  <span style={{ fontWeight: 500 }}>{b.label}</span>
                </span>
                <span className="bk-num" style={{ color: "var(--color-bk-muted)" }}>
                  <span style={{ color: "var(--color-bk-faint)" }}>target</span> {b.targetPct}%
                  <span style={{ color: "var(--color-bk-faint)" }}> · actual</span> {actualPct}%
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── per-bucket bars · actual vs target ── */}
      <section style={{ ...CARD, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Bucket progress</h3>
          {!hasIncome && (
            <span style={{ fontSize: 12.5, color: "var(--color-bk-clay)" }}>Add income in Settings for targets</span>
          )}
        </div>
        {plan.buckets.map((b) => {
          const isSavings = b.key === "savings";
          const pct = b.targetAmount > 0 ? Math.min((b.actualAmount / b.targetAmount) * 100, 100) : 0;
          const over = !isSavings && b.targetAmount > 0 && b.actualAmount > b.targetAmount;
          return (
            <div key={b.key} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
                <span style={{ fontWeight: 500 }}>
                  {b.label}{" "}
                  <span style={{ color: "var(--color-bk-faint)", fontWeight: 400 }}>· {b.targetPct}%</span>
                </span>
                <span className="bk-num" style={{ color: over ? theme.clay : "var(--color-bk-muted)" }}>
                  {money(b.actualAmount)}{" "}
                  <span style={{ color: "var(--color-bk-faint)" }}>/ {money(b.targetAmount)}</span>
                </span>
              </div>
              <ProgressBar value={pct} color={over ? theme.clay : bucketColor[b.key]} />
            </div>
          );
        })}
      </section>

      {/* ── category breakdown · grouped by bucket ── */}
      <section style={CARD}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>Category breakdown</h3>
        {[needs, wants, savings].map((bucket) => {
          const isSavings = bucket.key === "savings";
          // Savings lists the goals it funds (planned contributions), so the
          // header sums those rather than the virtual surplus.
          const headerAmount = isSavings
            ? bucket.categories.reduce((s, c) => s + c.amount, 0)
            : bucket.actualAmount;
          return (
            <div key={bucket.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 2px" }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: bucketColor[bucket.key], flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-bk-muted)" }}>
                  {isSavings ? "Savings · to goals" : bucket.label}
                </span>
                <span className="bk-num" style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--color-bk-faint)" }}>
                  {money(headerAmount)}
                </span>
              </div>
              {bucket.categories.length > 0 ? (
                bucket.categories.map((c) => (
                  <div
                    key={c.categoryId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderTop: "1px solid var(--color-bk-line-soft)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: c.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 500 }}>{c.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                      <span className="bk-num" style={{ fontSize: 12.5, color: "var(--color-bk-faint)" }}>{c.pctOfBucket}%</span>
                      <span className="bk-num" style={{ fontSize: 14, fontWeight: 500 }}>{money(c.amount)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: 13, color: "var(--color-bk-muted)", padding: "6px 0 2px" }}>
                  {isSavings
                    ? "No goals funded yet. Add goals to direct your savings."
                    : "No spending in this bucket yet."}
                </p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
