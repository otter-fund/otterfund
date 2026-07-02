"use client";

// Bulga — GOALS page.
//
// Goals are the destination of the plan's monthly Savings. The budget plan sets
// a savings amount (income × savings%); that pool is split across under-funded
// goals by priority (Low/Medium/High) — the same split the Spending page shows
// under its Savings bucket. The page makes that concrete: the monthly pool, each
// goal's share of it, the $/month it draws, and a projected finish date with a
// deadline-pacing signal. Every figure derives from `plan`.

import { useState } from "react";
import { Plus, ArrowRight, AlertTriangle } from "lucide-react";
import type { GoalPlanItem, GoalsPlanView, GoalView } from "@/lib/types";
import type { BulgaTheme } from "@/components/bulga/theme";
import { Button } from "@/components/ui/button";
import { ProgressRing, ProgressBar } from "@/components/bulga/progress";
import { GuillochePattern, GuillocheSeal } from "@/components/bulga/guilloche";
import { useBulgaChrome } from "@/components/bulga/chrome-context";
import { allocatePool } from "@/lib/goal-split";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const ASSIGN_SAVINGS = /* GraphQL */ `
  mutation AssignSavingsToGoals($amount: Float!) {
    assignSavingsToGoals(amount: $amount) { ok }
  }
`;

interface BulgaGoalsProps {
  plan: GoalsPlanView;
  accent: string;
  theme: BulgaTheme;
  onAdd?: () => void;
  onEdit?: (g: GoalView) => void;
}

const CARD: React.CSSProperties = {
  background: "var(--color-bk-surface)",
  border: "1px solid var(--color-bk-line)",
  borderRadius: 20,
  padding: 24,
};

const EYEBROW: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--color-bk-muted)",
};

function priorityLabel(p: number): "Low" | "Medium" | "High" {
  if (p === 1) return "Low";
  if (p === 3) return "High";
  return "Medium";
}

export function BulgaGoals({ plan, accent, theme, onAdd, onEdit }: BulgaGoalsProps) {
  const { currency, goals, monthlyIncome, monthlySpent, monthlySavings, surplus, planName, totalSaved, totalTarget } = plan;

  const fmtDate = (iso?: string) =>
    iso
      ? new Date(`${iso}T12:00:00Z`).toLocaleDateString(currency === "USD" ? "en-US" : "en-CA", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

  const fmt0 = (n: number) =>
    new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-CA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Math.abs(n));

  const hasPool = monthlySavings > 0;

  return (
    <div className="bk-enter bk-page">
      {/* ── hero ── */}
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
          <div style={EYEBROW}>Saved across goals</div>
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
            {fmt0(totalSaved)}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-bk-muted)", marginTop: 10 }}>
            of {fmt0(totalTarget)} target · {goals.length} active {goals.length === 1 ? "goal" : "goals"}
            {hasPool && (
              <>
                {" · funding "}
                <span className="bk-num" style={{ color: theme.accentDeep }}>{fmt0(monthlySavings)}</span>/mo
              </>
            )}
          </div>
        </div>

        <div style={{ position: "relative", flexShrink: 0 }}>
          <Button variant="outline" size="sm" onClick={() => onAdd?.()} className="border-dashed">
            <Plus data-icon="inline-start" size={16} strokeWidth={2.2} />
            New goal
          </Button>
        </div>
      </section>

      {goals.length === 0 ? (
        <section
          style={{
            ...CARD,
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
            No goals yet
          </div>
          <div style={{ position: "relative", fontSize: 13, color: "var(--color-bk-muted)", maxWidth: 340 }}>
            Create a goal and your monthly savings will split across it automatically by priority.
          </div>
          <div style={{ position: "relative", marginTop: 14 }}>
            <Button size="sm" onClick={() => onAdd?.()}>
              <Plus data-icon="inline-start" size={16} strokeWidth={2.2} />
              Create your first goal
            </Button>
          </div>
        </section>
      ) : (
        <>
          {/* ── assign savings to goals ── */}
          <AssignSavingsCard
            goals={goals}
            monthlyIncome={monthlyIncome}
            monthlySpent={monthlySpent}
            monthlySavings={monthlySavings}
            surplus={surplus}
            planName={planName}
            theme={theme}
            currency={currency}
            fmt0={fmt0}
          />

          {/* ── goal cards ── */}
          <div className="bk-grid-2up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                accent={accent}
                theme={theme}
                fmt0={fmt0}
                fmtDate={fmtDate}
                hasPool={hasPool}
                onEdit={onEdit}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AssignSavingsCard({
  goals,
  monthlyIncome,
  monthlySpent,
  monthlySavings,
  surplus,
  planName,
  theme,
  currency,
  fmt0,
}: {
  goals: GoalPlanItem[];
  monthlyIncome: number;
  monthlySpent: number;
  monthlySavings: number;
  surplus: number;
  planName: string;
  theme: BulgaTheme;
  currency: string;
  fmt0: (n: number) => string;
}) {
  const { refreshData } = useBulgaChrome();

  const hasIncome = monthlyIncome > 0;
  // What's actually left this month = income − spending. Can be negative when
  // the user has overspent; `surplus` is the same value floored at 0.
  const net = Math.round((monthlyIncome - monthlySpent) * 100) / 100;
  const overspent = hasIncome && net <= 0;

  const [amount, setAmount] = useState(String(surplus));
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const amountNum = Math.max(0, Math.round(Number(amount) || 0));
  const split = allocatePool(
    goals.map((g) => ({ id: g.id, priority: g.priority, saved: g.saved, target: g.target })),
    amountNum,
  );
  const previewFunded = goals.filter((g) => (split.get(g.id) ?? 0) > 0);
  const assignedTotal = [...split.values()].reduce((s, n) => s + n, 0);
  const leftover = Math.max(0, Math.round((amountNum - assignedTotal) * 100) / 100);
  const overBudget = amountNum > surplus && surplus >= 0;
  const canAssign = amountNum > 0 && split.size > 0 && !isPending;

  const setChip = (v: number) => {
    setAmount(String(v));
    setDone("");
  };

  const handleAssign = async () => {
    if (!canAssign) return;
    setPending(true);
    setError("");
    setDone("");
    try {
      await gqlClient.request(ASSIGN_SAVINGS, { amount: amountNum });
      setDone(`${fmt0(assignedTotal)} moved into ${split.size} ${split.size === 1 ? "goal" : "goals"}.`);
      refreshData();
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <section style={{ ...CARD, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Assign savings to goals</h3>
        <span style={{ fontSize: 12.5, color: "var(--color-bk-faint)" }}>{planName}</span>
      </div>

      {!hasIncome ? (
        <p style={{ fontSize: 12.5, color: "var(--color-bk-muted)", margin: 0 }}>
          Add your income and pick a budget plan in Settings to start funding goals.
        </p>
      ) : (
        <>
          {/* income − spent = left, shown explicitly so the number is never a mystery */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              gap: "4px 10px",
              fontSize: 13,
              color: "var(--color-bk-muted)",
              margin: "2px 0 16px",
            }}
          >
            <span>
              Income <span className="bk-num" style={{ color: "var(--color-bk-ink)" }}>{fmt0(monthlyIncome)}</span>
            </span>
            <span style={{ color: "var(--color-bk-faint)" }}>−</span>
            <span>
              spent <span className="bk-num" style={{ color: "var(--color-bk-ink)" }}>{fmt0(monthlySpent)}</span>
            </span>
            <span style={{ color: "var(--color-bk-faint)" }}>=</span>
            <span style={{ fontWeight: 600, color: overspent ? theme.clay : theme.accentDeep }}>
              <span className="bk-num">{fmt0(net)}</span> {overspent ? "over" : "left to save"}
            </span>
          </div>

          {overspent ? (
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                background: theme.clayTint,
                border: `1px solid ${theme.clay}22`,
                borderRadius: 14,
                padding: "12px 14px",
              }}
            >
              <AlertTriangle size={16} color={theme.clay} strokeWidth={2.2} style={{ marginTop: 1, flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 13, color: "var(--color-bk-ink)" }}>
                You&apos;ve spent everything you earned this month — there&apos;s nothing left to assign right now. Trim spending
                or wait for your next income, and this will free up.
              </p>
            </div>
          ) : (
            <>
              {/* amount + assign */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ position: "relative", flex: "1 1 160px", minWidth: 140 }}>
                  <span
                    style={{
                      position: "absolute",
                      left: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 14,
                      color: "var(--color-bk-faint)",
                    }}
                  >
                    {currency === "USD" ? "$" : currency + " "}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setDone("");
                    }}
                    className="bk-field bk-num"
                    style={{ paddingLeft: currency === "USD" ? 26 : 46 }}
                    aria-label="Amount to assign"
                  />
                </div>
                <Button size="sm" onClick={handleAssign} disabled={!canAssign}>
                  {isPending ? "Assigning…" : `Assign ${fmt0(amountNum)}`}
                  {!isPending && <ArrowRight data-icon="inline-end" size={15} strokeWidth={2.2} />}
                </Button>
              </div>

              {/* quick amounts */}
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <Chip label={`Left to save ${fmt0(surplus)}`} onClick={() => setChip(surplus)} theme={theme} />
                {monthlySavings > 0 && monthlySavings !== surplus && (
                  <Chip label={`Plan target ${fmt0(monthlySavings)}`} onClick={() => setChip(monthlySavings)} theme={theme} />
                )}
              </div>

              {overBudget && (
                <p style={{ fontSize: 12, color: theme.clay, margin: "10px 0 0" }}>
                  That&apos;s more than the {fmt0(surplus)} you have left this month.
                </p>
              )}
              {error && <p style={{ fontSize: 12.5, color: theme.clay, margin: "12px 0 0", fontWeight: 500 }}>{error}</p>}
              {done && <p style={{ fontSize: 12.5, color: theme.accentDeep, margin: "12px 0 0", fontWeight: 500 }}>{done}</p>}

              {/* live split preview */}
              {amountNum > 0 && previewFunded.length > 0 ? (
                <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
                  {previewFunded.map((g) => {
                    const amt = split.get(g.id) ?? 0;
                    const sharePct = assignedTotal > 0 ? Math.round((amt / assignedTotal) * 100) : 0;
                    return (
                      <div key={g.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 6 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }}>
                            {g.emoji && <span style={{ fontSize: 15 }}>{g.emoji}</span>}
                            {g.name}
                            <span style={{ color: "var(--color-bk-faint)", fontWeight: 400 }}>· {sharePct}%</span>
                          </span>
                          <span className="bk-num" style={{ color: theme.accentDeep }}>{fmt0(amt)}</span>
                        </div>
                        <ProgressBar value={sharePct} color={g.color} />
                      </div>
                    );
                  })}
                  {leftover > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--color-bk-muted)", paddingTop: 2 }}>
                      <span>Left unassigned (all goals full)</span>
                      <span className="bk-num">{fmt0(leftover)}</span>
                    </div>
                  )}
                </div>
              ) : amountNum > 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-bk-muted)", margin: "16px 0 0" }}>
                  Every goal is already fully funded — nothing to assign.
                </p>
              ) : null}
            </>
          )}
        </>
      )}
    </section>
  );
}

function Chip({ label, onClick, theme }: { label: string; onClick: () => void; theme: BulgaTheme }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: 500,
        padding: "5px 11px",
        borderRadius: 999,
        border: `1px solid ${theme.accentTintBorder}`,
        background: theme.accentTint,
        color: theme.accentDeep,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function GoalCard({
  goal: g,
  accent,
  theme,
  fmt0,
  fmtDate,
  hasPool,
  onEdit,
}: {
  goal: GoalPlanItem;
  accent: string;
  theme: BulgaTheme;
  fmt0: (n: number) => string;
  fmtDate: (iso?: string) => string | null;
  hasPool: boolean;
  onEdit?: (g: GoalView) => void;
}) {
  // Deadline pacing pill: on track (accent), behind (clay), or none.
  const pill =
    g.done
      ? { label: "Funded", bg: theme.accentTint, fg: theme.accentDeep }
      : g.onTrack === true
        ? { label: "On track", bg: theme.accentTint, fg: theme.accentDeep }
        : g.onTrack === false
          ? { label: "Behind", bg: theme.clayTint, fg: theme.clay }
          : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit?.(g)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit?.(g);
        }
      }}
      style={{
        background: "oklch(99.2% 0.003 95)",
        border: "1px solid oklch(92% 0.006 85)",
        borderRadius: 22,
        padding: 26,
        transition: "transform .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "0 12px 32px oklch(20% 0.02 80 / 0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
        <ProgressRing value={g.pct} color={accent}>
          {g.emoji && <span style={{ fontSize: 22, lineHeight: 1 }}>{g.emoji}</span>}
        </ProgressRing>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>{g.name}</span>
            {pill && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: pill.bg,
                  color: pill.fg,
                }}
              >
                {pill.label}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--color-bk-muted)", marginTop: 2 }}>
            {fmtDate(g.deadlineISO) ?? "Ongoing"} · {priorityLabel(g.priority)} priority
          </div>
        </div>

        <div className="bk-num" style={{ fontSize: 22, fontWeight: 500, color: theme.accentDeep }}>
          {g.pct}%
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: 16,
          borderTop: "1px solid oklch(94.5% 0.004 85)",
        }}
      >
        <div>
          <div style={{ fontSize: 11.5, color: "var(--color-bk-muted)" }}>Saved</div>
          <div className="bk-num" style={{ fontSize: 17, marginTop: 3 }}>{fmt0(g.saved)}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11.5, color: "var(--color-bk-muted)" }}>Target</div>
          <div className="bk-num" style={{ fontSize: 17, marginTop: 3, color: "oklch(44% 0.012 80)" }}>{fmt0(g.target)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11.5, color: "var(--color-bk-muted)" }}>To go</div>
          <div className="bk-num" style={{ fontSize: 17, marginTop: 3, color: theme.accentDeep }}>{fmt0(g.remaining)}</div>
        </div>
      </div>

      {/* funding line — ties the goal to its monthly contribution + finish date */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px solid oklch(94.5% 0.004 85)",
          fontSize: 12.5,
          color: "var(--color-bk-muted)",
        }}
      >
        {g.done ? (
          <span style={{ color: theme.accentDeep, fontWeight: 500 }}>Fully funded 🎉</span>
        ) : g.monthlyContribution > 0 ? (
          <span>
            <span className="bk-num" style={{ color: theme.accentDeep, fontWeight: 500 }}>+{fmt0(g.monthlyContribution)}</span>/mo
            {g.etaLabel && <> · on track to finish <span style={{ color: "var(--color-bk-ink)" }}>{g.etaLabel}</span></>}
          </span>
        ) : hasPool ? (
          <span>Not funded this month — raise its priority to allocate savings here.</span>
        ) : (
          <span>Set your income and plan in Settings to fund this goal.</span>
        )}
      </div>
    </div>
  );
}
