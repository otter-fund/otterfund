"use client";

import { useEffect, useRef, useState } from "react";
import { SmilePlus } from "lucide-react";

// Curated, goal-relevant set. A constrained grid is intentional: the value
// always lands as exactly one emoji, so the goal ring (see pages/goals.tsx)
// can never be fed multiple glyphs or arbitrary text.
const GOAL_EMOJI = [
  "🎯", "🏠", "✈️", "🚗", "💰", "🎓",
  "💍", "🏖️", "🎁", "📱", "🛟", "⛺",
  "🚲", "🐶", "👶", "🏥", "💻", "🎸",
] as const;

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  /** Visible label rendered above the trigger. */
  label?: string;
}

export function EmojiPicker({ value, onChange, label = "Emoji" }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape — the popover is non-modal so the rest of
  // the form stays interactive.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (emoji: string) => {
    onChange(emoji === value ? "" : emoji);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-of-faint)] mb-1.5">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={value ? `Emoji: ${value}. Change` : "Choose an emoji"}
        className="flex w-full h-11 items-center justify-center rounded-xl border border-[var(--color-of-line)] bg-[oklch(98%_0.004_90)] px-3 text-lg text-[var(--color-of-ink)] outline-none transition-colors hover:border-[var(--color-of-muted)] focus:border-[var(--color-primary)] cursor-pointer"
      >
        {/* Empty state: a monochrome outline icon, NOT a real emoji — a
            full-color glyph reads as an assigned value (emoji also ignore
            `color:`, so tinting can't fade them). Grey line-work in the app's
            lucide language says "empty, tap to add". */}
        {value || (
          <SmilePlus
            size={19}
            strokeWidth={1.9}
            className="text-[var(--color-of-faint)]"
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose an emoji"
          className="of-enter absolute z-50 mt-2 left-0 w-[244px] rounded-2xl border border-[var(--color-of-line)] bg-[var(--color-of-surface)] p-3 shadow-[0_12px_32px_oklch(20%_0.02_80/0.12)]"
        >
          <div className="grid grid-cols-6 gap-1">
            {GOAL_EMOJI.map((emoji) => {
              const active = emoji === value;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => pick(emoji)}
                  aria-pressed={active}
                  className={`h-9 w-9 flex items-center justify-center rounded-lg text-lg transition-colors ${
                    active
                      ? "bg-[var(--color-accent)] ring-1 ring-[var(--color-primary)]"
                      : "hover:bg-[oklch(95%_0.005_90)]"
                  }`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => pick("")}
            className="mt-2 w-full h-8 rounded-lg text-[12.5px] font-medium text-[var(--color-of-muted)] hover:bg-[oklch(95%_0.005_90)] transition-colors"
          >
            ✕ None
          </button>
        </div>
      )}
    </div>
  );
}
