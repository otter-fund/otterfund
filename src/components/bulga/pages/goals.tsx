"use client";

import { Plus } from "lucide-react";
import type { GoalView } from "@/lib/types";
import type { BulgaTheme } from "@/components/bulga/theme";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/bulga/progress";
import { GuillochePattern } from "@/components/bulga/guilloche";

interface BulgaGoalsProps {
  goals: GoalView[];
  accent: string;
  theme: BulgaTheme;
  currency?: string;
  onAdd?: () => void;
  onEdit?: (g: GoalView) => void;
}

export function BulgaGoals({ goals, accent, theme, currency = "CAD", onAdd, onEdit }: BulgaGoalsProps) {

  // Full date from the ISO field (e.g. "October 15, 2026"). Parsed at UTC noon
  // so the calendar day never shifts across timezones. Falsy ISO → "Ongoing".
  const fmtDate = (iso?: string) =>
    iso
      ? new Date(`${iso}T12:00:00Z`).toLocaleDateString(currency === "USD" ? "en-US" : "en-CA", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

  // Whole-dollar money (no cents) for goal figures — mirrors the reference fmt0.
  const fmt0 = (n: number) =>
    new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-CA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Math.abs(n));

  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);

  return (
    <div className="bk-enter bk-page">
      {/* ── header ── */}
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
              color: "var(--color-bk-muted)",
            }}
          >
            Saved across goals
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
            {fmt0(totalSaved)}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-bk-muted)", marginTop: 10 }}>
            of {fmt0(totalTarget)} target · {goals.length} active{" "}
            {goals.length === 1 ? "goal" : "goals"}
          </div>
        </div>

        <div style={{ position: "relative", flexShrink: 0 }}>
          <Button variant="outline" size="sm" onClick={() => onAdd?.()} className="border-dashed">
            <Plus data-icon="inline-start" size={16} strokeWidth={2.2} />
            New goal
          </Button>
        </div>
      </section>

      {/* ── goal cards ── */}
      <div className="bk-grid-2up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {goals.map((g) => {
          const pct = g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0;
          const remaining = Math.max(g.target - g.saved, 0);

          return (
            <div
              key={g.id}
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
                transition:
                  "transform .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow =
                  "0 12px 32px oklch(20% 0.02 80 / 0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: 22,
                }}
              >
                <ProgressRing value={pct} color={accent}>
                  {g.emoji && <span style={{ fontSize: 22, lineHeight: 1 }}>{g.emoji}</span>}
                </ProgressRing>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}
                  >
                    {g.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--color-bk-muted)",
                      marginTop: 2,
                    }}
                  >
                    {fmtDate(g.deadlineISO) ?? "Ongoing"}
                  </div>
                </div>

                <div
                  className="bk-num"
                  style={{ fontSize: 22, fontWeight: 500, color: theme.accentDeep }}
                >
                  {pct}%
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: 18,
                  borderTop: "1px solid oklch(94.5% 0.004 85)",
                }}
              >
                <div>
                  <div style={{ fontSize: 11.5, color: "var(--color-bk-muted)" }}>
                    Saved
                  </div>
                  <div className="bk-num" style={{ fontSize: 17, marginTop: 3 }}>
                    {fmt0(g.saved)}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11.5, color: "var(--color-bk-muted)" }}>
                    Target
                  </div>
                  <div
                    className="bk-num"
                    style={{ fontSize: 17, marginTop: 3, color: "oklch(44% 0.012 80)" }}
                  >
                    {fmt0(g.target)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11.5, color: "var(--color-bk-muted)" }}>
                    To go
                  </div>
                  <div
                    className="bk-num"
                    style={{ fontSize: 17, marginTop: 3, color: theme.accentDeep }}
                  >
                    {fmt0(remaining)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
