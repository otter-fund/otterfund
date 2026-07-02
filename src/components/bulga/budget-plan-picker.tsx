"use client";

// Bulga — budget-plan picker.
//
// A small grid of selectable plan cards (Needs / Wants / Savings splits) shared
// by onboarding and Settings so the two never drift. Each card shows the plan's
// three-way split as a mini stacked bar plus the numbers, and highlights with the
// active accent when selected. Purely presentational — the caller owns `value`
// and persists on `onChange`.

import { BUDGET_PLANS } from "@/lib/constants";
import { deriveTheme, hueOf } from "@/components/bulga/theme";
import { Check } from "lucide-react";

export function BudgetPlanPicker({
  value,
  onChange,
  accent,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  /** Concrete accent (oklch) — drives the selected border + split-bar shades. */
  accent?: string;
  disabled?: boolean;
}) {
  const acc = accent || "var(--color-primary)";
  // Three cohesive shades for the split bar: deep → accent → light tint of the
  // same hue. Falls back to the token palette when no concrete accent is given.
  const shades = accent
    ? (() => {
        const theme = deriveTheme(accent);
        return [theme.accentDeep, theme.accent, `oklch(76% 0.07 ${hueOf(accent)})`];
      })()
    : ["var(--accent-foreground)", "var(--color-primary)", "var(--accent)"];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {BUDGET_PLANS.map((p) => {
        const selected = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(p.id)}
            aria-pressed={selected}
            className="relative flex flex-col gap-2.5 rounded-2xl border p-4 text-left transition-colors disabled:opacity-60"
            style={{
              borderColor: selected ? acc : "var(--color-bk-line)",
              background: selected ? "var(--accent)" : "oklch(98% 0.004 90)",
              boxShadow: selected ? `0 0 0 1px ${acc}` : "none",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--color-bk-ink)]">
                {p.name}
              </span>
              {selected ? (
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ background: acc, color: "#fff" }}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              ) : p.recommended ? (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
                  style={{ background: "var(--accent)", color: "var(--color-primary)" }}
                >
                  Recommended
                </span>
              ) : null}
            </div>

            {/* Needs / Wants / Savings split — widths total 100%. */}
            <div className="flex h-2 w-full overflow-hidden rounded-full">
              <span style={{ width: `${p.needs}%`, background: shades[0] }} />
              <span style={{ width: `${p.wants}%`, background: shades[1] }} />
              <span style={{ width: `${p.savings}%`, background: shades[2] }} />
            </div>

            <div className="text-[11px] text-[var(--color-bk-muted)]">
              <span className="bk-num">{p.needs}</span> needs ·{" "}
              <span className="bk-num">{p.wants}</span> wants ·{" "}
              <span className="bk-num">{p.savings}</span> savings
            </div>
            <p className="text-[11.5px] leading-snug text-[var(--color-bk-muted)]">{p.blurb}</p>
          </button>
        );
      })}
    </div>
  );
}
