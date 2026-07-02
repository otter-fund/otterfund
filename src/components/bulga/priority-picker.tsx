"use client";

// A three-level priority control (Low / Medium / High) for goals. Priority is
// stored on the goal as a numeric weight — 1, 2, or 3 — that the savings
// allocator splits the monthly pool by. Higher priority = a bigger share.
// Replaces the old free-form "priority weight %" field, which let unrelated
// goals sum past 100% and read as a percentage it never was.

export const PRIORITY_LEVELS = [
  { value: 1, label: "Low" },
  { value: 2, label: "Medium" },
  { value: 3, label: "High" },
] as const;

/** Map any stored priority (incl. legacy free-form values) to a level (default Medium). */
export function toPriorityLevel(priority: number | null | undefined): number {
  return priority === 1 || priority === 3 ? priority : 2;
}

export function PriorityPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Priority"
      style={{ display: "flex", gap: 6, background: "var(--color-bk-canvas)", border: "1px solid var(--color-bk-line)", borderRadius: 12, padding: 4 }}
    >
      {PRIORITY_LEVELS.map((lvl) => {
        const active = value === lvl.value;
        return (
          <button
            key={lvl.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(lvl.value)}
            className="bk-num"
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              transition: "background .15s, color .15s",
              background: active ? "var(--color-primary)" : "transparent",
              color: active ? "#fff" : "var(--color-bk-muted)",
            }}
          >
            {lvl.label}
          </button>
        );
      })}
    </div>
  );
}
