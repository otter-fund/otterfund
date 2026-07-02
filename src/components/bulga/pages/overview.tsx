"use client";

// Bulga — OVERVIEW page.
//
// Net-worth hero (figure + sparkline), this-month stats, a two-up of spending
// and goals, then recent activity beside a Bulga insight card. Every bar
// animates from 0% once mounted; every figure derives from `overview`.

import { useState } from "react";
import type { DashboardOverview, NetWorthPoint } from "@/lib/types";
import { type BulgaTheme, tintFor } from "@/components/bulga/theme";
import { fmt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/bulga/progress";
import { GuillochePattern } from "@/components/bulga/guilloche";
import { StatPill } from "@/components/bulga/stat-pill";

interface BulgaOverviewProps {
  overview: DashboardOverview;
  accent: string;
  theme: BulgaTheme;
  onNavigate?: (view: string) => void;
}

const CARD: React.CSSProperties = {
  background: "var(--color-bk-surface)",
  border: "1px solid var(--color-bk-line)",
  borderRadius: 20,
  padding: 24,
};

// ── net-worth sparkline geometry ──
const W = 620;
const H = 130;

interface SparkPoint {
  x: number;
  y: number;
  point: NetWorthPoint;
}

function sparkline(trend: NetWorthPoint[]) {
  const zero: NetWorthPoint = { label: "", value: 0, change: 0 };
  const data =
    trend.length >= 2
      ? trend
      : trend.length === 1
        ? [trend[0], trend[0]]
        : [zero, zero];
  const values = data.map((d) => d.value);
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const rg = mx - mn || 1;
  const pts: SparkPoint[] = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - 10 - ((d.value - mn) / rg) * (H - 28),
    point: d,
  }));
  const line = pts.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
  return { line, area: `0,${H} ${line} ${W},${H}`, pts };
}

function NetWorthTooltip({
  pt,
  atStart,
  atEnd,
  theme,
  money,
  signed,
}: {
  pt: SparkPoint;
  atStart: boolean;
  atEnd: boolean;
  theme: BulgaTheme;
  money: (n: number) => string;
  signed: (n: number) => string;
}) {
  const { change, value, label } = pt.point;
  const down = change < 0;
  // Anchor horizontally so edge points don't overflow the chart; drop the card
  // below the point when it sits high enough that a card above would clip.
  const anchorX = atStart ? "0%" : atEnd ? "-100%" : "-50%";
  const yPct = (pt.y / H) * 100;
  const anchorY = yPct < 46 ? "18px" : "calc(-100% - 14px)";
  const changeColor = change === 0 ? "var(--color-bk-muted)" : down ? theme.clay : theme.accentDeep;

  return (
    <div
      style={{
        position: "absolute",
        left: `${(pt.x / W) * 100}%`,
        top: `${yPct}%`,
        transform: `translate(${anchorX}, ${anchorY})`,
        background: "var(--color-bk-surface)",
        border: "1px solid var(--color-bk-line)",
        borderRadius: 12,
        padding: "9px 12px",
        boxShadow: "0 8px 24px rgba(30,20,10,0.14)",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        zIndex: 6,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-bk-faint)",
        }}
      >
        {label}
      </div>
      <div className="bk-num" style={{ fontSize: 19, letterSpacing: "-0.02em", marginTop: 3, lineHeight: 1.1 }}>
        {money(value)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: 12, fontWeight: 600, color: changeColor }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={down ? "M7 7 17 17M9 17h8V9" : "M7 17 17 7M9 7h8v8"} />
        </svg>
        <span className="bk-num">{signed(change)}</span>
        <span style={{ color: "var(--color-bk-faint)", fontWeight: 500 }}>this month</span>
      </div>
    </div>
  );
}

export function BulgaOverview({ overview, theme, onNavigate }: BulgaOverviewProps) {

  const cur = overview.currency;
  const money = (n: number) => fmt(n, cur);
  const signed = (n: number) => `${n < 0 ? "−" : "+"}${money(n)}`;
  const nwDown = overview.netWorthChange < 0;
  const surplusDown = overview.monthlySurplus < 0;
  const spark = sparkline(overview.netWorthTrend);
  const [hover, setHover] = useState<number | null>(null);
  const hoverPt = hover !== null ? spark.pts[hover] : null;
  const hasTrend = overview.netWorthTrend.length > 0;

  const cats = overview.spendingByCategory.slice(0, 5);
  const goals = overview.goals.slice(0, 4);
  const recent = overview.recentTransactions.slice(0, 5);

  // ── derive a real insight sentence from the data ──
  const savingsRate = Math.round(overview.savingsRate);
  const topCat = [...overview.spendingByCategory].sort((a, b) => b.amount - a.amount)[0];
  const insight =
    savingsRate > 0
      ? `You're saving ${savingsRate}% of your income this month — that's ${money(overview.monthlySurplus)} set aside toward what matters.`
      : topCat
        ? `${topCat.name} is your largest category at ${money(topCat.amount)}, about ${Math.round(topCat.pct)}% of this month's spending.`
        : `You've spent ${money(overview.monthlySpend)} so far this month against ${money(overview.monthlyIncome)} of income.`;

  return (
    <div className="bk-enter bk-page">
      {/* ── net worth hero ── */}
      <section
        className="bk-nw-hero"
        style={{
          position: "relative",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1.15fr 1fr",
          gap: 28,
          alignItems: "end",
          padding: "0 4px 36px",
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
            Net worth
          </div>
          <div
            className="bk-num"
            style={{
              fontSize: "clamp(48px, 6vw, 68px)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              marginTop: 12,
            }}
          >
            {money(overview.netWorth)}
          </div>
          <div style={{ marginTop: 14 }}>
            <StatPill
              theme={theme}
              figure={signed(overview.netWorthChange)}
              label="this month"
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d={nwDown ? "M7 7 17 17M9 17h8V9" : "M7 17 17 7M9 7h8v8"} />
                </svg>
              }
            />
          </div>
        </div>
        <div
          className="bk-nw-spark"
          style={{ position: "relative", width: "100%", height: 110 }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={
            hasTrend
              ? (e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / rect.width;
                  const idx = Math.max(
                    0,
                    Math.min(
                      spark.pts.length - 1,
                      Math.round(ratio * (spark.pts.length - 1))
                    )
                  );
                  setHover(idx);
                }
              : undefined
          }
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ position: "relative", width: "100%", height: "100%", display: "block" }} aria-hidden="true">
            <defs>
              <linearGradient id="ev-nw-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.accent} stopOpacity="0.16" />
                <stop offset="100%" stopColor={theme.accent} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`M${spark.area}Z`} fill="url(#ev-nw-grad)" />
            <polyline points={spark.line} fill="none" stroke={theme.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* End-of-line marker (hidden while a hovered point is active). */}
          {hasTrend && !hoverPt && (
            <span
              style={{
                position: "absolute",
                left: `${(spark.pts[spark.pts.length - 1].x / W) * 100}%`,
                top: `${(spark.pts[spark.pts.length - 1].y / H) * 100}%`,
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: theme.accent,
                border: "2px solid #fff",
                boxShadow: "0 1px 3px rgba(30,20,10,0.2)",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            />
          )}

          {hoverPt && (
            <>
              <span
                style={{
                  position: "absolute",
                  left: `${(hoverPt.x / W) * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: "var(--color-bk-line)",
                  transform: "translateX(-0.5px)",
                  pointerEvents: "none",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: `${(hoverPt.x / W) * 100}%`,
                  top: `${(hoverPt.y / H) * 100}%`,
                  width: 11,
                  height: 11,
                  borderRadius: "50%",
                  background: theme.accent,
                  border: "2.5px solid #fff",
                  boxShadow: "0 1px 4px rgba(30,20,10,0.22)",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                }}
              />
              <NetWorthTooltip
                pt={hoverPt}
                atStart={hover === 0}
                atEnd={hover === spark.pts.length - 1}
                theme={theme}
                money={money}
                signed={signed}
              />
            </>
          )}
        </div>
      </section>

      {/* ── this-month stats ── */}
      <section
        className="bk-grid-3"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ ...CARD, padding: "22px 24px" }}>
          <div style={{ fontSize: 12.5, color: "var(--color-bk-muted)", fontWeight: 500 }}>Income</div>
          <div className="bk-num" style={{ fontSize: 30, letterSpacing: "-0.02em", marginTop: 8, color: theme.accentDeep }}>
            {money(overview.monthlyIncome)}
          </div>
        </div>
        <div style={{ ...CARD, padding: "22px 24px" }}>
          <div style={{ fontSize: 12.5, color: "var(--color-bk-muted)", fontWeight: 500 }}>Spending</div>
          <div className="bk-num" style={{ fontSize: 30, letterSpacing: "-0.02em", marginTop: 8 }}>
            {money(overview.monthlySpend)}
          </div>
        </div>
        <div style={{ background: theme.accent, borderRadius: 20, padding: "22px 24px", color: "#fff" }}>
          <div style={{ fontSize: 12.5, opacity: 0.85, fontWeight: 500 }}>{surplusDown ? "Overspent" : "Left over"}</div>
          <div className="bk-num" style={{ fontSize: 30, letterSpacing: "-0.02em", marginTop: 8 }}>
            {signed(overview.monthlySurplus)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{savingsRate}% savings rate</div>
        </div>
      </section>

      {/* ── two-up: spending + goals ── */}
      <section className="bk-grid-2up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={CARD}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Where it went</h3>
            <span style={{ fontSize: 12.5, color: "var(--color-bk-faint)" }}>Top categories</span>
          </div>
          {cats.map((c) => (
            <div key={c.categoryId} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
                <span style={{ fontWeight: 500 }}>{c.name}</span>
                <span className="bk-num" style={{ color: "var(--color-bk-muted)" }}>{money(c.amount)}</span>
              </div>
              <ProgressBar value={c.pct} color={theme.accent} />
            </div>
          ))}
        </div>

        <div style={CARD}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Goals on track</h3>
            <Button variant="link" size="sm" onClick={() => onNavigate?.("goals")} className="text-[12.5px]">
              View all →
            </Button>
          </div>
          {goals.map((g) => {
            const pct = g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0;
            return (
              <div key={g.id} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
                  <span style={{ fontWeight: 500 }}>{g.name}</span>
                  <span className="bk-num" style={{ color: "var(--color-bk-muted)" }}>{pct}%</span>
                </div>
                <ProgressBar value={pct} color={theme.accent} duration={1.05} />
              </div>
            );
          })}
        </div>
      </section>

      {/* ── recent + insight ── */}
      <section className="bk-grid-split" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        <div style={CARD}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Recent activity</h3>
            <Button variant="link" size="sm" onClick={() => onNavigate?.("transactions")} className="text-[12.5px]">
              See all →
            </Button>
          </div>
          {recent.map((t) => {
            const [tint, ink] = tintFor(t.category);
            const isIncome = t.amount > 0;
            return (
              <div
                key={t.id}
                style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0", borderTop: "1px solid var(--color-bk-line-soft)" }}
              >
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-bk-faint)" }}>{t.category}</div>
                </div>
                <div className="bk-num" style={{ fontSize: 14.5, fontWeight: 500, color: isIncome ? theme.accentDeep : "var(--color-bk-ink)" }}>
                  {isIncome ? "+" : ""}{money(t.amount)}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            background: theme.accentTint,
            border: `1px solid ${theme.accentTintBorder}`,
            borderRadius: 20,
            padding: 24,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: theme.accentDeep,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
            </svg>
            Bulga insight
          </div>
          <p
            style={{
              fontFamily: "var(--font-num), serif",
              fontSize: 21,
              lineHeight: 1.35,
              letterSpacing: "-0.01em",
              margin: "16px 0 0",
              color: "oklch(28% 0.02 90)",
            }}
          >
            {insight}
          </p>
          <div style={{ flex: 1 }} />
          <Button size="sm" onClick={() => onNavigate?.("insights")} className="self-start mt-5">
            See more insights
          </Button>
        </div>
      </section>
    </div>
  );
}
