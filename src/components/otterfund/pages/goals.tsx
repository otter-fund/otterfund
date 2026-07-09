"use client";

// otterfund — GOALS page.
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
import type { OtterfundTheme } from "@/components/otterfund/theme";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/otterfund/progress";
import { GuillochePattern, GuillocheSeal } from "@/components/otterfund/guilloche";
import { useOtterfundChrome } from "@/components/otterfund/chrome-context";
import { AllocateSavingsModal } from "@/components/dashboard/modals/allocate-savings-modal";

interface OtterfundGoalsProps {
  plan: GoalsPlanView;
  accent: string;
  theme: OtterfundTheme;
  onAdd?: () => void;
  onEdit?: (g: GoalView) => void;
}

const CARD: React.CSSProperties = {
  background: "var(--color-of-surface)",
  border: "1px solid var(--color-of-line)",
  borderRadius: 20,
  padding: 24,
};

const EYEBROW: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--color-of-muted)",
};

function priorityLabel(p: number): "Low" | "Medium" | "High" {
  if (p === 1) return "Low";
  if (p === 3) return "High";
  return "Medium";
}

export function OtterfundGoals({ plan, accent, theme, onAdd, onEdit }: OtterfundGoalsProps) {
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

  const { refreshData } = useOtterfundChrome();
  const [allocateOpen, setAllocateOpen] = useState(false);

  // Allocate is only actionable when there's real cash left AND a goal to take
  // it. Otherwise the button stays visible but grayed, with a reason on hover.
  const canAssign = assignable > 0 && goals.some((g) => g.remaining > 0);
  const assignReason =
    surplus <= 0
      ? "No surplus to allocate this month"
      : assignable <= 0
        ? "Surplus already allocated for the month"
        : "All goals are fully funded";

  return (
    <div className="of-enter of-page">
      {/* ── hero ── */}
      <section
        className="of-hero-row"
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
            className="of-num"
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
          <div style={{ fontSize: 13, color: "var(--color-of-muted)", marginTop: 10 }}>
            of {fmt0(totalTarget)} target · {goals.length} active {goals.length === 1 ? "goal" : "goals"}
            {hasPool && (
              <>
                {" · "}
                <span className="of-num" style={{ color: theme.accentDeep }}>{fmt0(monthlySavings)}</span>/mo to set aside
              </>
            )}
          </div>
        </div>

        <div style={{ position: "relative", flexShrink: 0, alignSelf: "flex-start", display: "flex", gap: 8 }}>
          {goals.length > 0 && hasPool && (
            // group/relative wrapper carries the tooltip so it shows even while
            // the button is disabled (disabled controls don't fire hover events).
            <span className="group relative inline-flex">
              <Button size="sm" onClick={() => setAllocateOpen(true)} disabled={!canAssign}>
                Allocate
              </Button>
              {!canAssign && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute right-0 top-full z-50 mt-2 w-max max-w-[260px] translate-y-1 whitespace-normal rounded-[9px] px-2.5 py-1.5 text-left text-[12px] font-medium leading-snug opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100"
                  style={{ background: "oklch(26% 0.012 75)", color: "#fff", boxShadow: "0 8px 24px oklch(20% 0.02 80 / 0.3)" }}
                >
                  {assignReason}
                </span>
              )}
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
          <div style={{ position: "relative", fontSize: 15, fontWeight: 600, color: "var(--color-of-ink)" }}>
            No goals yet
          </div>
          <div style={{ position: "relative", fontSize: 13, color: "var(--color-of-muted)", maxWidth: 340 }}>
            Create a goal and your monthly savings will split across it automatically by priority.
          </div>
        </section>
      ) : (
        <>
          {/* ── goal cards ── */}
          <div className="of-grid-2up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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

      <AllocateSavingsModal
        open={allocateOpen}
        onClose={() => setAllocateOpen(false)}
        onAllocated={refreshData}
        goals={goals}
        assignable={assignable}
        currency={currency}
        theme={theme}
      />
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
  theme: OtterfundTheme;
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
          <div style={{ fontSize: 12.5, color: "var(--color-of-muted)", marginTop: 2 }}>
            {fmtDate(g.deadlineISO) ?? "Ongoing"} · {priorityLabel(g.priority)} priority
          </div>
        </div>

        <div className="of-num" style={{ fontSize: 22, fontWeight: 500, color: theme.accentDeep }}>
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
          <div style={{ fontSize: 11.5, color: "var(--color-of-muted)" }}>Saved</div>
          <div className="of-num" style={{ fontSize: 17, marginTop: 3 }}>{fmt0(g.saved)}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11.5, color: "var(--color-of-muted)" }}>Target</div>
          <div className="of-num" style={{ fontSize: 17, marginTop: 3, color: "oklch(44% 0.012 80)" }}>{fmt0(g.target)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11.5, color: "var(--color-of-muted)" }}>To go</div>
          <div className="of-num" style={{ fontSize: 17, marginTop: 3, color: theme.accentDeep }}>{fmt0(g.remaining)}</div>
        </div>
      </div>

      {/* funding line — ties the goal to its monthly contribution + finish date */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px solid oklch(94.5% 0.004 85)",
          fontSize: 12.5,
          color: "var(--color-of-muted)",
        }}
      >
        {g.done ? (
          <span style={{ color: theme.accentDeep, fontWeight: 500 }}>Fully funded 🎉</span>
        ) : g.monthlyContribution > 0 ? (
          <span>
            Set aside{" "}
            <span className="of-num" style={{ color: theme.accentDeep, fontWeight: 500 }}>{fmt0(g.monthlyContribution)}</span>/mo
            {g.etaLabel && <> to finish by <span style={{ color: "var(--color-of-ink)" }}>{g.etaLabel}</span></>}
          </span>
        ) : hasPool ? (
          <span>Not funded this month. Raise its priority to allocate savings here.</span>
        ) : (
          <span>Set your income and plan in Settings to fund this goal.</span>
        )}
      </div>
    </div>
  );
}
