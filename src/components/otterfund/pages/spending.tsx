"use client";

// otterfund — SPENDING page (the statement).
//
// Built around the user's budget plan (Needs / Wants / Savings), in the app's
// card grammar so it reads like the rest of otterfund: a serif hero shows
// spend-of-budget with a "left to spend" / "over budget" pill, then a trio of
// textured bucket Panels (actual vs target, clay when a spend bucket is over),
// a Plan-vs-actual dual donut inside its own Panel, a grouped category breakdown
// Panel, and the Recurring section folds in at the foot. Category rows carry the
// same tinted sketch glyphs as the overview's "Where it went", and a Needs/Wants
// row opens a drill-in drawer of the real transactions behind it. One accent
// leads, colour survives only in the data. Every figure derives from `plan`.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, House, ShoppingBag, PiggyBank, X, Loader2 } from "lucide-react";
import type { SpendingPlanView, SpendingBucket, SpendingCategorySlice, SpendingCategoryDetail, SubscriptionView } from "@/lib/types";
import { type OtterfundTheme, hueOf, CATEGORY_TINTS } from "@/components/otterfund/theme";
import { getBudgetPlan } from "@/lib/constants";
import { fmt } from "@/lib/format";
import { gqlClient } from "@/lib/graphql/client";
import { ProgressBar } from "@/components/otterfund/progress";
import { DonutChart } from "@/components/otterfund/donut-chart";
import { Statement, HeroBand, SectionHead, Ledger, Row } from "@/components/otterfund/ledger";
import { Panel } from "@/components/otterfund/panel";
import { CardLabel } from "@/components/otterfund/card";
import { StatPill } from "@/components/otterfund/stat-pill";
import { CategoryGlyph } from "@/components/otterfund/category-glyph";
import { Button } from "@/components/ui/button";
import { AddAccountEmptyState } from "@/components/otterfund/empty-state";
import { OtterfundSubscriptions } from "@/components/otterfund/pages/subscriptions";

const SPENDING_CATEGORY_DETAIL = /* GraphQL */ `
  query SpendingCategoryDetail($categoryId: ID!, $month: Int!, $year: Int!) {
    spendingCategoryDetail(categoryId: $categoryId, month: $month, year: $year)
  }
`;

interface OtterfundSpendingProps {
  plan: SpendingPlanView;
  accent: string;
  theme: OtterfundTheme;
  /** The month being viewed — the category drill-in queries the same window. */
  period: { month: number; year: number };
  /** Recurring charges, rendered as the "Recurring" section (formerly a tab). */
  subscriptions: SubscriptionView[];
  currency: string;
  /** False when the user has no accounts at all — with no income or spend, the
      page shows an "add an account" cold start instead of empty donuts/buckets. */
  hasAccounts?: boolean;
  onAddAccount?: () => void;
  onConnect?: () => void;
  onAddSubscription?: () => void;
  onEditSubscription?: (s: SubscriptionView) => void;
  /** Link to Goals (where the savings pool is allocated to goals). */
  goalsHref: string;
}

// Tiny uppercase label — the donut's inner captions ("Target" / "Spent").
const EYEBROW: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-of-faint)",
};

// A quiet icon per bucket, matching the overview trio's icon-led stat cards.
const BUCKET_ICON: Record<SpendingBucket["key"], typeof House> = {
  needs: House,
  wants: ShoppingBag,
  savings: PiggyBank,
};

/** A category's glyph tint — its own identity ink, falling back to the accent's
    deep tone (never the near-grey neutral). Matches the overview glyph colour. */
function glyphInk(name: string, theme: OtterfundTheme): string {
  return CATEGORY_TINTS[name]?.[1] ?? theme.accentDeep;
}

export function OtterfundSpending({ plan, accent, theme, period, subscriptions, currency: currencyProp, hasAccounts = true, onAddAccount, onConnect, onAddSubscription, onEditSubscription, goalsHref }: OtterfundSpendingProps) {
  const currency = plan.currency || currencyProp;
  const money = (n: number) => fmt(n, currency);

  // Drill-in drawer: the category slice the user opened + its resolved rows.
  const [openCat, setOpenCat] = useState<{ categoryId: string; name: string } | null>(null);
  const [detail, setDetail] = useState<SpendingCategoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (slice: SpendingCategorySlice) => {
    setOpenCat({ categoryId: slice.categoryId, name: slice.name });
    setDetail(null);
    setDetailLoading(true);
    try {
      const { spendingCategoryDetail } = await gqlClient.request<{ spendingCategoryDetail: SpendingCategoryDetail | null }>(
        SPENDING_CATEGORY_DETAIL,
        { categoryId: slice.categoryId, month: period.month, year: period.year },
      );
      setDetail(spendingCategoryDetail);
    } catch {
      setDetail(null);
    }
    setDetailLoading(false);
  };
  const closeDetail = () => setOpenCat(null);

  // Cold start — no accounts, and nothing to build a budget from (no income set,
  // no spending). The donut/bucket UI would only render as empty rings, so pivot
  // to the "add an account" surface instead.
  if (!hasAccounts && plan.monthlyIncome === 0 && plan.totalSpent === 0) {
    return (
      <Statement>
        <AddAccountEmptyState
          theme={theme}
          onAdd={onAddAccount}
          onConnect={onConnect}
          title="Add an account to track spending"
          description="Connect a bank or add an account, and your spending will sort itself into needs, wants and savings against your budget."
        />
      </Statement>
    );
  }
  const hue = hueOf(theme.accent);
  const planMeta = getBudgetPlan(plan.planId);

  // Three cohesive shades of the active accent hue, one per bucket — a single-hue
  // data ramp shared by the donut, the legend, and the bucket bars so the three
  // always read as the same encoding.
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
  const leftToSpend = spendBudget - totalSpent;
  // Legend shares the donut's denominator (sum of actual segment values) so the
  // two always agree and the percentages total 100% — even when overspending
  // floors savings at 0 and the segments sum to totalSpent instead of income.
  const actualDenom = plan.buckets.reduce((s, b) => s + b.actualAmount, 0);

  const targetSegments = plan.buckets.map((b) => ({ value: b.targetPct, color: bucketColor[b.key], label: b.label }));
  const actualSegments = plan.buckets.map((b) => ({ value: b.actualAmount, color: bucketColor[b.key], label: b.label }));

  return (
    <>
    <Statement>
      {/* ── hero · spent of budget ── */}
      <HeroBand
        theme={theme}
        ariaLabel="Spending this month"
        eyebrow={
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-of-muted)" }}>
            Spending this month
          </div>
        }
        figure={
          <>
            {money(totalSpent)}{" "}
            <span style={{ fontSize: 18, color: "var(--color-of-muted)", fontWeight: 400 }}>of {money(spendBudget)}</span>
          </>
        }
        meta={
          hasIncome ? (
            <StatPill
              theme={theme}
              tone={leftToSpend < 0 ? "clay" : "accent"}
              bare
              figure={money(Math.abs(leftToSpend))}
              label={leftToSpend < 0 ? "over budget" : "left to spend"}
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d={leftToSpend < 0 ? "M7 7 17 17M9 17h8V9" : "M7 17 17 7M9 7h8v8"} />
                </svg>
              }
            />
          ) : (
            <div style={{ fontSize: 13, color: "var(--color-of-muted)" }}>
              Set your income in Settings to see budget targets.
            </div>
          )
        }
      />

      {/* ── bucket trio · actual vs target, at a glance ── */}
      <CardLabel style={{ margin: "36px 0 16px" }}>Your budget · {planMeta.name}</CardLabel>
      <section className="of-trio" aria-label="Budget buckets">
        {plan.buckets.map((b) => (
          <BucketCard key={b.key} bucket={b} theme={theme} color={bucketColor[b.key]} money={money} hasIncome={hasIncome} />
        ))}
      </section>

      {/* ── plan vs. actual · dual donut ── */}
      <Panel theme={theme} style={{ marginTop: 24 }}>
        <SectionHead title="Plan vs. actual" action={<span style={{ fontSize: 12.5, color: "var(--color-of-faint)" }}>{planMeta.name}</span>} />
        <p style={{ fontSize: 12.5, color: "var(--color-of-muted)", margin: "0 0 22px" }}>
          How your income should split, next to how you actually used it this month.
        </p>

        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <DonutChart segments={targetSegments}>
              <span style={EYEBROW}>Target</span>
              <span className="of-num" style={{ fontSize: 15, fontWeight: 500 }}>{planMeta.name.split(" ")[0]}</span>
            </DonutChart>
            <span style={{ ...EYEBROW, fontSize: 11.5 }}>Your plan</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <DonutChart segments={actualSegments} formatValue={money}>
              <span style={EYEBROW}>Spent</span>
              <span className="of-num" style={{ fontSize: 19, fontWeight: 500 }}>{money(totalSpent)}</span>
            </DonutChart>
            <span style={{ ...EYEBROW, fontSize: 11.5 }}>This month</span>
          </div>
        </div>

        {/* legend — target vs actual share of income per bucket */}
        <div style={{ marginTop: 24, display: "grid", gap: 11 }}>
          {plan.buckets.map((b) => {
            const actualPct = actualDenom > 0 ? Math.round((b.actualAmount / actualDenom) * 100) : 0;
            return (
              <div key={b.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: bucketColor[b.key], flexShrink: 0 }} />
                  <span style={{ fontWeight: 500 }}>{b.label}</span>
                </span>
                <span className="of-num" style={{ color: "var(--color-of-muted)" }}>
                  <span style={{ color: "var(--color-of-faint)" }}>target</span> {b.targetPct}%
                  <span style={{ color: "var(--color-of-faint)" }}> · actual</span> {actualPct}%
                </span>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* ── category breakdown · grouped by bucket ── */}
      <Panel theme={theme} style={{ marginTop: 24 }}>
        <SectionHead title="Category breakdown" />
        {[needs, wants, savings].map((bucket, i) => {
          const isSavings = bucket.key === "savings";
          // Savings lists the goals it funds (planned contributions), so the
          // header sums those rather than the virtual surplus.
          const headerAmount = isSavings ? bucket.categories.reduce((s, c) => s + c.amount, 0) : bucket.actualAmount;
          return (
            <div key={bucket.key} style={{ marginTop: i === 0 ? 10 : 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: bucketColor[bucket.key], flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-of-muted)" }}>
                  {isSavings ? "Savings · to goals" : bucket.label}
                </span>
                <span className="of-num" style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--color-of-faint)" }}>
                  {money(headerAmount)}
                </span>
              </div>
              {bucket.categories.length > 0 ? (
                <Ledger>
                  {bucket.categories.map((c) => {
                    // Needs/Wants slices are real spend — the row drills into the
                    // transactions behind it. Savings slices are goal allocations
                    // (planned, not spent), so they stay inert with a colour dot.
                    const drillable = !isSavings;
                    return (
                      <Row
                        key={c.categoryId}
                        columns="1fr auto"
                        gap={14}
                        padding="11px 12px"
                        onClick={drillable ? () => openDetail(c) : undefined}
                        ariaLabel={drillable ? `View ${c.name} transactions` : undefined}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 13.5, minWidth: 0 }}>
                          {isSavings ? (
                            // Savings rows are goals — show the goal's own emoji (as
                            // the Goals page does); fall back to a colour dot when it
                            // has none.
                            c.emoji ? (
                              <span style={{ width: 26, display: "grid", placeItems: "center", fontSize: 18, lineHeight: 1, flexShrink: 0 }} aria-hidden="true">
                                {c.emoji}
                              </span>
                            ) : (
                              <span style={{ width: 9, height: 9, borderRadius: 999, background: c.color, flexShrink: 0 }} />
                            )
                          ) : (
                            <CategoryGlyph category={c.name} color={glyphInk(c.name, theme)} size={26} />
                          )}
                          <span style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                          <span className="of-num" style={{ fontSize: 12.5, color: "var(--color-of-faint)" }}>{c.pctOfBucket}%</span>
                          <span className="of-num" style={{ fontSize: 14, fontWeight: 500 }}>{money(c.amount)}</span>
                        </div>
                      </Row>
                    );
                  })}
                </Ledger>
              ) : (
                <p style={{ fontSize: 13, color: "var(--color-of-muted)", padding: "8px 0 2px" }}>
                  {isSavings ? "No goals funded yet. Add goals to direct your savings." : "No spending in this bucket yet."}
                </p>
              )}
              {/* Savings flows to goals — allocate it where it's actually done. */}
              {isSavings && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-3 text-[12.5px]"
                  render={<Link href={`${goalsHref}${goalsHref.includes("?") ? "&" : "?"}allocate=1`} />}
                >
                  Allocate savings to goals
                  <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
                </Button>
              )}
            </div>
          );
        })}
      </Panel>

      {/* ── recurring · subscriptions, folded in from the old tab ── */}
      <OtterfundSubscriptions
        embedded
        subscriptions={subscriptions}
        accent={accent}
        theme={theme}
        currency={currency}
        onAdd={onAddSubscription}
        onEdit={onEditSubscription}
      />
    </Statement>

    {/* Drill-in drawer — kept a SIBLING of <Statement> so the statement's
        enter-transform doesn't re-root this fixed overlay into the content
        column (a transformed ancestor becomes the containing block for
        position:fixed). Rendered here, it covers the full viewport and slides
        in from the right edge of the screen. */}
    {openCat && (
      <CategoryDetailDrawer
        name={openCat.name}
        detail={detail}
        loading={detailLoading}
        theme={theme}
        money={money}
        onClose={closeDetail}
      />
    )}
    </>
  );
}

/**
 * One budget bucket as a textured stat Panel — mirrors the overview trio: an
 * icon-led label with the plan's target %, the serif actual figure over its
 * target, a progress bar (clay when a spend bucket runs over), and a one-line
 * status. Savings never reads as "over" — beating its target is a win.
 */
function BucketCard({
  bucket,
  theme,
  color,
  money,
  hasIncome,
}: {
  bucket: SpendingBucket;
  theme: OtterfundTheme;
  color: string;
  money: (n: number) => string;
  hasIncome: boolean;
}) {
  const Icon = BUCKET_ICON[bucket.key];
  const isSavings = bucket.key === "savings";
  const pct = bucket.targetAmount > 0 ? Math.min((bucket.actualAmount / bucket.targetAmount) * 100, 100) : 0;
  const over = !isSavings && bucket.targetAmount > 0 && bucket.actualAmount > bucket.targetAmount;
  const diff = bucket.targetAmount - bucket.actualAmount; // positive ⇒ under target / left

  // The small line beneath the bar — what this bucket is doing against its plan.
  let status: { text: string; color: string };
  if (!hasIncome) {
    status = { text: "Set income for a target", color: "var(--color-of-faint)" };
  } else if (over) {
    status = { text: `${money(bucket.actualAmount - bucket.targetAmount)} over budget`, color: theme.clay };
  } else if (isSavings) {
    status = diff <= 0
      ? { text: "On track for your plan", color: theme.accentDeep }
      : { text: `${money(diff)} to target`, color: "var(--color-of-muted)" };
  } else {
    status = { text: `${money(diff)} left`, color: "var(--color-of-muted)" };
  }

  return (
    <Panel theme={theme} padding="18px 18px">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: "var(--color-of-muted)" }}>
          <Icon size={15} strokeWidth={2.4} color={over ? theme.clay : color} aria-hidden="true" />
          {bucket.label}
        </span>
        <span className="of-num" style={{ fontSize: 12, color: "var(--color-of-faint)" }}>{bucket.targetPct}%</span>
      </div>
      <div className="of-num" style={{ fontSize: 24, letterSpacing: "-0.02em", marginTop: 12, color: over ? theme.clay : "var(--color-of-ink)" }}>
        {money(bucket.actualAmount)}
      </div>
      <div style={{ fontSize: 12, color: "var(--color-of-faint)", marginTop: 3 }}>
        {hasIncome ? <>of {money(bucket.targetAmount)}</> : "no target yet"}
      </div>
      <ProgressBar value={pct} color={over ? theme.clay : color} className="mt-3.5" />
      <div style={{ fontSize: 12, marginTop: 8, color: status.color }}>{status.text}</div>
    </Panel>
  );
}

/**
 * The category drill-in — a right-anchored drawer that lists the real spend
 * transactions behind one Needs/Wants slice for the month, mirroring the
 * Insights drill-down (scrim + Esc + slide-in, motion collapses under
 * prefers-reduced-motion via of-drawer-in). Opens instantly with a spinner
 * while the rows load.
 */
function CategoryDetailDrawer({
  name,
  detail,
  loading,
  theme,
  money,
  onClose,
}: {
  name: string;
  detail: SpendingCategoryDetail | null;
  loading: boolean;
  theme: OtterfundTheme;
  money: (n: number) => string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
      {/* scrim */}
      <div
        onClick={onClose}
        aria-hidden
        className="of-fade-in"
        style={{ position: "absolute", inset: 0, background: "oklch(20% 0.02 80 / 0.28)" }}
      />
      {/* panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${name} transactions`}
        className="of-scroll of-drawer-in"
        style={{
          position: "relative",
          width: "min(460px, 92vw)",
          height: "100%",
          overflowY: "auto",
          background: "var(--color-of-surface)",
          borderLeft: "1px solid var(--color-of-line)",
          boxShadow: "-24px 0 60px oklch(20% 0.02 80 / 0.14)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* header — glyph + category name */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "20px 22px 16px",
            background: "var(--color-of-surface)",
            borderBottom: "1px solid var(--color-of-line-soft)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <CategoryGlyph category={name} color={glyphInk(name, theme)} size={30} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {name}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-of-faint)" }}>This month</div>
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose} className="shrink-0 -mr-2">
            <X size={16} />
          </Button>
        </div>

        {/* body */}
        <div style={{ padding: "18px 22px 28px", flex: 1 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0", color: "var(--color-of-muted)" }}>
              <Loader2 size={18} className="of-spin" />
            </div>
          ) : !detail || detail.count === 0 ? (
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--color-of-muted)" }}>
              No transactions in this category this month.
            </p>
          ) : (
            <>
              {/* summary — total + count in the accent tint */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 20,
                  padding: "16px 18px",
                  borderRadius: 16,
                  background: theme.accentTint,
                  border: `1px solid ${theme.accentTintBorder}`,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-of-faint)" }}>
                    Total spent
                  </div>
                  <div className="of-num" style={{ marginTop: 4, fontSize: 24, fontWeight: 600, color: "var(--color-of-ink)", lineHeight: 1.1 }}>
                    {money(detail.total)}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-of-faint)" }}>
                    Transactions
                  </div>
                  <div className="of-num" style={{ marginTop: 4, fontSize: 16, fontWeight: 600, color: "var(--color-of-ink)", lineHeight: 1.1 }}>
                    {detail.count}
                  </div>
                </div>
              </div>

              {/* the rows behind the figure, largest first */}
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-of-muted)", margin: "22px 0 8px" }}>
                {detail.count > 15 ? `Largest · top 15 of ${detail.count}` : "Transactions"}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {detail.transactions.map((t, i) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 0",
                      borderTop: i === 0 ? "none" : "1px solid var(--color-of-line-soft)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: "var(--color-of-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--color-of-faint)", marginTop: 2 }}>
                        {t.date}{t.account ? ` · ${t.account}` : ""}
                      </div>
                    </div>
                    <span className="of-num" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-of-ink)", flexShrink: 0 }}>
                      {money(Math.abs(t.amount))}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
