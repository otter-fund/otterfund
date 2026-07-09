"use client";

// A three-level priority control (Low / Medium / High) for goals. Priority is
// stored on the goal as a numeric weight — 1, 2, or 3 — that the savings
// allocator splits the monthly pool by. Higher priority = a bigger share.
// Rendered as a segmented control with one sliding accent thumb (styled by
// .of-priority* in globals.css) — the thumb glides between segments instead of
// each button repainting, so the switch reads as one physical control. Sized
// to the of-field shell (44px) so it lines up with sibling fields and meets
// the iOS touch-target minimum.

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
  const index = Math.max(
    0,
    PRIORITY_LEVELS.findIndex((lvl) => lvl.value === toPriorityLevel(value))
  );
  return (
    <div role="radiogroup" aria-label="Priority" className="of-priority">
      <span
        className="of-priority-thumb"
        aria-hidden="true"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {PRIORITY_LEVELS.map((lvl) => (
        <button
          key={lvl.value}
          type="button"
          role="radio"
          aria-checked={value === lvl.value}
          onClick={() => onChange(lvl.value)}
          className="of-priority-btn"
        >
          {lvl.label}
        </button>
      ))}
    </div>
  );
}
