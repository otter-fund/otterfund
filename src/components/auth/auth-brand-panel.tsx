"use client";

// Bulga — auth brand panel.
//
// The pitch half of the split-screen auth layout. On the shared evergreen
// banknote field it floats a "note" that counts its net-worth figure up and
// draws its own sparkline on mount, so the emotional case is made while the
// form on the right stays clean. All motion degrades to a calm static state
// under prefers-reduced-motion.

import { useEffect, useState } from "react";

import {
  BrandPanelShell,
  PanelLockup,
  PANEL_INK,
  PANEL_MUTED,
  PANEL_ACCENT,
  PANEL_HAIRLINE,
} from "@/components/bulga/brand-panel";
import { fmt } from "@/lib/format";

// ── mini net-worth sparkline (illustrative, mirrors the real Overview) ──
const SP_W = 460;
const SP_H = 96;
const TREND = [18.2, 18.9, 18.4, 19.6, 20.3, 19.9, 21.2, 22.1, 21.8, 22.9, 23.6, 24.18];
const SPARK = (() => {
  const mn = Math.min(...TREND);
  const mx = Math.max(...TREND);
  const rg = mx - mn || 1;
  const pts = TREND.map(
    (d, i) => [(i / (TREND.length - 1)) * SP_W, SP_H - 6 - ((d - mn) / rg) * (SP_H - 20)] as const,
  );
  const line = "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L");
  const [lx, ly] = pts[pts.length - 1];
  return { line, area: `${line}L${SP_W} ${SP_H}L0 ${SP_H}Z`, lx, ly };
})();

/** Eased count-up toward `target` once `run` flips true; jumps to the final
    figure under reduced motion. */
function useCountUp(target: number, run: boolean, duration = 1500) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf: number;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, duration]);
  return value;
}

const STATS = [
  { label: "Income", value: 6450 },
  { label: "Spending", value: 4012.55 },
];

// Subtle "matrix" drizzle inside the area fill — small glints that fall on
// staggered loops. Values are fixed (not random) so server and client markup
// match. x is in the chart's 0–460 viewBox; negative delays start each mid-fall
// so there's no empty first pass.
const RAIN: { x: number; h: number; dur: number; delay: number; o: number }[] = [
  { x: 26, h: 12, dur: 3.4, delay: 0.0, o: 0.4 },
  { x: 63, h: 8, dur: 4.3, delay: 1.6, o: 0.28 },
  { x: 104, h: 15, dur: 3.7, delay: 2.4, o: 0.46 },
  { x: 145, h: 10, dur: 4.8, delay: 0.7, o: 0.32 },
  { x: 187, h: 13, dur: 4.0, delay: 2.9, o: 0.38 },
  { x: 225, h: 8, dur: 5.1, delay: 1.1, o: 0.26 },
  { x: 264, h: 16, dur: 3.5, delay: 3.3, o: 0.48 },
  { x: 300, h: 11, dur: 4.4, delay: 0.4, o: 0.34 },
  { x: 338, h: 9, dur: 5.3, delay: 2.6, o: 0.26 },
  { x: 375, h: 14, dur: 3.8, delay: 1.9, o: 0.42 },
  { x: 410, h: 10, dur: 4.6, delay: 1.0, o: 0.32 },
  { x: 441, h: 12, dur: 4.1, delay: 3.6, o: 0.38 },
];

export function AuthBrandPanel() {
  // One flag drives the count-ups and flips `data-in` so the sparkline draws.
  const [live, setLive] = useState(false);
  const netWorth = useCountUp(24180.62, live);
  useEffect(() => {
    const id = requestAnimationFrame(() => setLive(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <BrandPanelShell>
      <PanelLockup />

      {/* ── pitch + showpiece ── */}
      <div className="relative flex max-w-[440px] flex-1 flex-col justify-center">
        <div
          className="bk-enter"
          style={{
            animationDelay: "80ms",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: PANEL_ACCENT,
          }}
        >
          Personal budgeting, in balance
        </div>
        <h2
          className="bk-enter mt-4 mb-9 text-balance"
          style={{
            animationDelay: "160ms",
            fontFamily: "var(--font-num), Georgia, serif",
            fontWeight: 500,
            fontSize: "clamp(30px, 3.4vw, 42px)",
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: PANEL_INK,
          }}
        >
          Every dollar,{" "}
          <em style={{ fontStyle: "italic", color: PANEL_ACCENT }}>accounted for.</em>
        </h2>

        {/* the floating note */}
        <div
          data-in={live ? "" : undefined}
          className="bk-enter relative overflow-hidden"
          style={{
            animationDelay: "260ms",
            background: "oklch(99% 0.01 95 / 0.07)",
            border: `1px solid ${PANEL_HAIRLINE}`,
            borderRadius: 22,
            padding: 24,
            backdropFilter: "blur(7px)",
            WebkitBackdropFilter: "blur(7px)",
            boxShadow: "0 26px 60px oklch(14% 0.03 158 / 0.45)",
          }}
        >
          <div className="flex items-start justify-between">
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: PANEL_MUTED,
              }}
            >
              Net worth
            </span>
            <span
              className="bk-num"
              style={{ fontSize: 10.5, letterSpacing: "0.14em", color: PANEL_MUTED, opacity: 0.8 }}
            >
              SERIES 2026
            </span>
          </div>

          <div
            className="bk-num"
            style={{ fontSize: 40, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1, marginTop: 12, color: PANEL_INK }}
          >
            {fmt(netWorth)}
          </div>

          <div className="relative mt-5">
            <svg viewBox={`0 0 ${SP_W} ${SP_H}`} preserveAspectRatio="none" className="h-[80px] w-full" aria-hidden>
              <defs>
                <linearGradient id="auth-nw-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PANEL_ACCENT} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={PANEL_ACCENT} stopOpacity="0" />
                </linearGradient>
                {/* each drizzle glint: soft at the ends, bright in the middle */}
                <linearGradient id="auth-nw-drop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PANEL_ACCENT} stopOpacity="0" />
                  <stop offset="50%" stopColor={PANEL_ACCENT} stopOpacity="1" />
                  <stop offset="100%" stopColor={PANEL_ACCENT} stopOpacity="0" />
                </linearGradient>
                <clipPath id="auth-nw-clip">
                  <path d={SPARK.area} />
                </clipPath>
              </defs>
              <path className="bk-lp-area" d={SPARK.area} fill="url(#auth-nw-grad)" />
              <g className="bk-lp-area" clipPath="url(#auth-nw-clip)">
                {RAIN.map((d, i) => (
                  <rect
                    key={i}
                    className="bk-lp-rain"
                    x={d.x}
                    y={0}
                    width={1.8}
                    height={d.h}
                    rx={0.9}
                    fill="url(#auth-nw-drop)"
                    style={{
                      ["--o"]: d.o,
                      animationDuration: `${d.dur}s`,
                      animationDelay: `-${d.delay}s`,
                    } as React.CSSProperties}
                  />
                ))}
              </g>
              <path
                className="bk-lp-line"
                d={SPARK.line}
                pathLength={1}
                fill="none"
                stroke={PANEL_ACCENT}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="absolute h-0 w-0"
              style={{ left: `${(SPARK.lx / SP_W) * 100}%`, top: `${(SPARK.ly / SP_H) * 100}%` }}
              aria-hidden
            >
              <span
                className="bk-lp-dot absolute -left-[5.5px] -top-[5.5px] block h-[11px] w-[11px] rounded-full"
                style={{ background: PANEL_ACCENT, border: "2px solid oklch(28% 0.05 158)" }}
              />
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl px-4 py-3"
                style={{ border: `1px solid ${PANEL_HAIRLINE}` }}
              >
                <div style={{ fontSize: 11.5, color: PANEL_MUTED }}>{s.label}</div>
                <div className="bk-num mt-0.5" style={{ fontSize: 17, letterSpacing: "-0.02em", color: PANEL_INK }}>
                  {fmt(s.value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrandPanelShell>
  );
}
