"use client";

// Bulga month picker — the top-right period control.
//
// A pill trigger (Calendar · "June 2026" · chevron) that opens a calm popover:
// a year stepper above a 3×4 month grid. Picking a month commits the period up
// to the shell, which re-fetches the whole dashboard for it. Pure presentation
// + an onSelect callback — no data or routing logic lives here. The palette is
// hue-derived from the active accent, so it tracks whatever theme is live.

import { useEffect, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import type { BulgaTheme } from "@/components/bulga/theme";
import { hueOf } from "@/components/bulga/theme";
import { MONTH_NAMES } from "@/lib/constants";
// Browsable year range — the SAME constants the validators use (lib/period), so
// a picked month can never fall outside what the server accepts.
import { PERIOD_MIN_YEAR as MIN_YEAR, PERIOD_MAX_YEAR_AHEAD as MAX_YEAR_AHEAD } from "@/lib/period";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface MonthPickerProps {
  /** Committed selection (1-indexed month). */
  month: number;
  year: number;
  /** Today's real period — drives the "today" marker + reset affordance. */
  todayMonth: number;
  todayYear: number;
  accent: string;
  theme: BulgaTheme;
  /** True while the period change is being fetched — dims the trigger. */
  pending?: boolean;
  onSelect: (month: number, year: number) => void;
}

export function MonthPicker({
  month,
  year,
  todayMonth,
  todayYear,
  accent,
  theme,
  pending = false,
  onSelect,
}: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  // The year being browsed in the popover — lets you page years without
  // committing until you tap a month. Reset to the live selection each time the
  // popover opens (see the trigger handler), so browsing never leaks across opens.
  const [viewYear, setViewYear] = useState(year);

  // Escape closes — click-outside is handled by the scrim below.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const label = `${MONTH_NAMES[month - 1]} ${year}`;
  const onCurrent = month === todayMonth && year === todayYear;
  const maxYear = todayYear + MAX_YEAR_AHEAD;

  const choose = (m: number) => {
    setOpen(false);
    if (m === month && viewYear === year) return; // no-op if unchanged
    onSelect(m, viewYear);
  };

  return (
    <div style={{ position: "relative" }}>
      {/* trigger pill */}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Period: ${label}. Change month`}
        onClick={() => {
          if (!open) setViewYear(year); // entering open → start browsing at the live year
          setOpen((v) => !v);
        }}
        disabled={pending}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          height: 38,
          padding: "0 13px 0 15px",
          borderRadius: 999,
          border: "1px solid oklch(91% 0.006 85)",
          background: open ? "var(--color-bk-line-soft)" : "oklch(98% 0.004 90)",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 600,
          color: "oklch(40% 0.012 80)",
          cursor: pending ? "wait" : "pointer",
          opacity: pending ? 0.6 : 1,
          transition: "background 0.14s, opacity 0.18s",
        }}
      >
        <Calendar size={14} strokeWidth={2} aria-hidden="true" />
        {label}
        <ChevronDown
          size={13}
          strokeWidth={2.2}
          aria-hidden="true"
          style={{
            transition: "transform 0.18s ease",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>

      {open && (
        <>
          {/* click-outside scrim — matches the topbar menus */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="Choose month"
            className="bk-pop"
            style={{
              position: "absolute",
              top: 46,
              right: 0,
              zIndex: 50,
              width: 264,
              padding: 12,
              borderRadius: 16,
              background: "var(--color-bk-surface)",
              border: "1px solid var(--color-bk-line)",
              boxShadow: "0 12px 32px oklch(20% 0.02 80 / 0.16)",
            }}
          >
            {/* year stepper */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 2px 10px",
              }}
            >
              <button
                type="button"
                className="bk-stepper-btn"
                aria-label={`Previous year, ${viewYear - 1}`}
                disabled={viewYear <= MIN_YEAR}
                onClick={() => setViewYear((y) => Math.max(MIN_YEAR, y - 1))}
              >
                <ChevronLeft size={17} strokeWidth={2} aria-hidden="true" />
              </button>
              <span
                className="bk-num"
                style={{
                  fontFamily: "var(--font-num)",
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                  color: "var(--color-bk-ink)",
                }}
              >
                {viewYear}
              </span>
              <button
                type="button"
                className="bk-stepper-btn"
                aria-label={`Next year, ${viewYear + 1}`}
                disabled={viewYear >= maxYear}
                onClick={() => setViewYear((y) => Math.min(maxYear, y + 1))}
              >
                <ChevronRight size={17} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            {/* month grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 6,
              }}
            >
              {MONTHS_SHORT.map((m, i) => {
                const mn = i + 1;
                const selected = mn === month && viewYear === year;
                const isToday = mn === todayMonth && viewYear === todayYear;
                return (
                  <button
                    key={m}
                    type="button"
                    className="bk-month-cell"
                    aria-current={selected ? "true" : undefined}
                    aria-label={`${MONTH_NAMES[i]} ${viewYear}`}
                    onClick={() => choose(mn)}
                    style={
                      selected
                        ? {
                            background: accent,
                            color: "#fff",
                            boxShadow: `0 2px 8px oklch(40% 0.1 ${hueOf(accent)} / 0.28)`,
                          }
                        : undefined
                    }
                  >
                    <span style={{ position: "relative" }}>
                      {m}
                      {isToday && !selected && (
                        <span
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            left: "50%",
                            bottom: -7,
                            transform: "translateX(-50%)",
                            width: 4,
                            height: 4,
                            borderRadius: "50%",
                            background: theme.accentDeep,
                          }}
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* reset to the current month — only when browsing away from it */}
            {!onCurrent && (
              <>
                <div
                  style={{
                    height: 1,
                    background: "var(--color-bk-line-soft)",
                    margin: "10px 0 6px",
                  }}
                />
                <button
                  type="button"
                  className="bk-menu-item"
                  style={{ justifyContent: "center", fontSize: 12.5, color: "var(--color-bk-muted)" }}
                  onClick={() => {
                    setOpen(false);
                    onSelect(todayMonth, todayYear);
                  }}
                >
                  <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
                  Back to this month
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
