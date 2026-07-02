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
import { Plus } from "lucide-react";
import type { GoalPlanItem, GoalsPlanView, GoalView } from "@/lib/types";
import type { BulgaTheme } from "@/components/bulga/theme";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/bulga/progress";
import { GuillochePattern, GuillocheSeal } from "@/components/bulga/guilloche";
import { useBulgaChrome } from "@/components/bulga/chrome-context";
import { gqlClient } from "@/lib/graphql/client";

const ASSIGN_SAVINGS = /* GraphQL */ `
  mutation AssignSavingsToGoals {
    assignSavingsToGoals { ok }
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
  const { currency, goals, monthlySavings, surplus, totalSaved, totalTarget, assignable } = plan;

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

  const { refreshData } = useBulgaChrome();
  const [assigning, setAssigning] = useState(false);

  // Assign this month's remaining real surplus across goals. The server derives
  // and records the amount, so once the surplus is spent `assignable` is 0 and
  // this can't run again (no double-spending cash you don't have).
  const handleAssign = async () => {
    if (assignable <= 0 || assigning) return;
    setAssigning(true);
    try {
      await gqlClient.request(ASSIGN_SAVINGS);
      refreshData();
    } catch {
      // Non-fatal: leave figures as-is if the assignment fails.
    } finally {
      setAssigning(false);
    }
  };

  // Assign is only actionable when there's real cash left AND a goal to take it.
  // Otherwise the button stays visible but grayed, with a reason on hover.
  const canAssign = assignable > 0 && goals.some((g) => g.remaining > 0);
  const assignReason =
    surplus <= 0
      ? "No surplus to assign this month"
      : assignable <= 0
        ? "Already assigned this month"
        : "All goals are funded";

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

        <div style={{ position: "relative", flexShrink: 0, alignSelf: "flex-start", display: "flex", gap: 8 }}>
          {goals.length > 0 && hasPool && (
            // Wrapper carries the title so the tooltip shows even while the
            // button is disabled (disabled controls don't fire hover events).
            <span title={canAssign ? undefined : assignReason} style={{ display: "inline-flex" }}>
              <Button size="sm" onClick={handleAssign} disabled={assigning || !canAssign}>
                {assigning ? "Assigning…" : "Assign"}
              </Button>
            </span>
          )}
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
          <div style={{ position: "relative", width: 72, height: 72, marginBottom: 8 }} aria-hidden="true">
            <GuillocheSeal accent={theme.accent} accentDeep={theme.accentDeep} label="$" />
          </div>
          <div style={{ position: "relative", fontSize: 15, fontWeight: 600, color: "var(--color-bk-ink)" }}>
            No goals yet
          </div>
          <div style={{ position: "relative", fontSize: 13, color: "var(--color-bk-muted)", maxWidth: 340 }}>
            Create a goal and your monthly savings will split across it automatically by priority.
          </div>
        </section>
      ) : (
        <>
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
