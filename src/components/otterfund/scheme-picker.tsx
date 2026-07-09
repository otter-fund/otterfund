"use client";

// otterfund accent scheme picker.
//
// A compact palette — a tight row of color chips. Tapping one retones the whole
// app (fills, inputs, buttons, focus rings, charts, progress); the active chip
// carries a soft ring + check. The logo alone stays evergreen. Shared by
// Settings → Appearance and the Brand kit so the picker lives in one place.

import { Check } from "lucide-react";
import { SCHEMES, hueOf } from "@/components/otterfund/theme";

interface SchemePickerProps {
  /** The active accent (raw oklch string). */
  accent: string;
  onAccentChange: (accent: string) => void;
}

export function SchemePicker({ accent, onAccentChange }: SchemePickerProps) {
  const activeHue = hueOf(accent);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {SCHEMES.map((s) => {
        const active = hueOf(s.value) === activeHue;
        return (
          <button
            key={s.name}
            type="button"
            onClick={() => onAccentChange(s.value)}
            aria-pressed={active}
            aria-label={s.name}
            title={s.name}
            className="grid place-items-center outline-none transition-transform duration-150 active:scale-90 focus-visible:scale-105"
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: s.value,
              border: "none",
              cursor: "pointer",
              padding: 0,
              boxShadow: active
                ? `0 0 0 2px var(--color-of-surface), 0 0 0 3.5px ${s.value}`
                : "inset 0 0 0 1px oklch(0% 0 0 / 0.07)",
              transition: "box-shadow .15s, transform .15s cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            {active && <Check size={15} strokeWidth={3} color="#fff" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
