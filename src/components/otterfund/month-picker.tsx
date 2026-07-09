"use client";

// otterfund month picker — the top-right period control.
//
// One segmented control (‹ · "June 2026" · ›) in the outline-button language,
// matching the topbar bell — a single bordered pill with the arrows fused to
// the center label by hairline dividers, so it reads as ONE control. The arrows
// nudge one month at a time (rolling the year at Dec↔Jan); the center opens a
// year stepper above a 3×4 month grid. Picking commits the period up to the
// shell, which re-fetches the whole dashboard for it. Pure presentation + an
// onSelect callback — no data or routing logic lives here. The palette is
// hue-derived from the active accent, so it tracks whatever theme is live.

import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import type { OtterfundTheme } from "@/components/otterfund/theme";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
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
  theme: OtterfundTheme;
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
  // popover opens, so browsing never leaks across opens.
  const [viewYear, setViewYear] = useState(year);

  // Short label on the trigger ("Jul 2026") so the pill width never shifts
  // between long/short month names; full name kept for the accessible label.
  const label = `${MONTHS_SHORT[month - 1]} ${year}`;
  const fullLabel = `${MONTH_NAMES[month - 1]} ${year}`;
  const onCurrent = month === todayMonth && year === todayYear;
  const maxYear = todayYear + MAX_YEAR_AHEAD;

  const choose = (m: number) => {
    setOpen(false);
    if (m === month && viewYear === year) return; // no-op if unchanged
    onSelect(m, viewYear);
  };

  // Step one month, rolling the year at the Dec↔Jan boundary. The arrows share
  // the picker's browsable range, so they disable at the edges rather than
  // committing an out-of-range period the server would reject.
  const step = (dir: -1 | 1) => {
    let m = month + dir;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    else if (m > 12) { m = 1; y += 1; }
    onSelect(m, y);
  };
  const atMin = year <= MIN_YEAR && month <= 1;
  const atMax = year >= maxYear && month >= 12;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setViewYear(year); // entering open → start browsing at the live year
        setOpen(next);
      }}
    >
      {/* One segmented control — a single bordered pill in the outline-button
          language, arrows fused to the center label by hairline dividers so it
          reads as ONE control (not three buttons). The center is the popover
          trigger; the arrows step the month. */}
      <div className="of-month-nav" role="group" aria-label="Period" data-pending={pending || undefined}>
        <button
          type="button"
          className="of-month-nav-step"
          aria-label="Previous month"
          disabled={pending || atMin}
          onClick={() => step(-1)}
        >
          <ChevronLeft size={17} strokeWidth={1.9} aria-hidden="true" />
        </button>

        <PopoverTrigger
          aria-haspopup="dialog"
          render={
            <button
              type="button"
              className="of-month-nav-label of-num"
              aria-label={`Period: ${fullLabel}. Change month`}
              disabled={pending}
            >
              {label}
            </button>
          }
        />

        <button
          type="button"
          className="of-month-nav-step"
          aria-label="Next month"
          disabled={pending || atMax}
          onClick={() => step(1)}
        >
          <ChevronRight size={17} strokeWidth={1.9} aria-hidden="true" />
        </button>
      </div>

      <PopoverContent
        aria-label="Choose month"
        align="end"
        className="of-month-pop w-[300px] p-4"
      >
        <div>
            {/* year stepper */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 2px 14px",
              }}
            >
              <button
                type="button"
                className="of-stepper-btn"
                aria-label={`Previous year, ${viewYear - 1}`}
                disabled={viewYear <= MIN_YEAR}
                onClick={() => setViewYear((y) => Math.max(MIN_YEAR, y - 1))}
              >
                <ChevronLeft size={17} strokeWidth={2} aria-hidden="true" />
              </button>
              <span
                className="of-num"
                style={{
                  fontFamily: "var(--font-num)",
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                  color: "var(--color-of-ink)",
                }}
              >
                {viewYear}
              </span>
              <button
                type="button"
                className="of-stepper-btn"
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
                gap: 8,
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
                    className="of-month-cell"
                    aria-current={selected ? "true" : undefined}
                    aria-label={`${MONTH_NAMES[i]} ${viewYear}`}
                    onClick={() => choose(mn)}
                    style={
                      selected
                        ? { background: accent, color: "#fff" }
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
                            bottom: -6,
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
                    background: "var(--color-of-line-soft)",
                    margin: "10px 0 6px",
                  }}
                />
                <button
                  type="button"
                  className="of-menu-item"
                  style={{ justifyContent: "center", fontSize: 12.5, color: "var(--color-of-muted)" }}
                  onClick={() => {
                    setOpen(false);
                    onSelect(todayMonth, todayYear);
                  }}
                >
                  <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
                  Back to current month
                </button>
              </>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
