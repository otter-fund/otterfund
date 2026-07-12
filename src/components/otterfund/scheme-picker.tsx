"use client";

// otterfund accent scheme picker.
//
// A compact palette — a tight row of color chips. Tapping one retones the whole
// app (fills, inputs, buttons, focus rings, charts, progress); the active chip
// carries a soft ring + check. The logo alone stays evergreen. Shared by
// Settings → Appearance and the Brand kit so the picker lives in one place.
//
// Premium accents (gold, obsidian) are a paid perk: shown inline for Standard +
// Pro, and entirely absent for Free — no chip, no label, not advertised.

import { Check } from "lucide-react";
import { SCHEMES, PREMIUM_SCHEMES, hueOf } from "@/components/otterfund/theme";

interface SchemePickerProps {
  /** The active accent (raw oklch string). */
  accent: string;
  onAccentChange: (accent: string) => void;
  /** Whether the viewer's plan includes the premium accents. Defaults to true
   *  (Brand kit). Free users pass false and never see them. */
  canUsePremium?: boolean;
}

export function SchemePicker({ accent, onAccentChange, canUsePremium = true }: SchemePickerProps) {
  const activeHue = hueOf(accent);

  const chip = (s: { name: string; value: string }) => {
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
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{SCHEMES.map(chip)}</div>

      {/* Premium accents — a labelled group below the standard row, shown only to
          paid users (Free never sees the group at all). Set apart by whitespace
          and its label rather than a divider. */}
      {canUsePremium && (
        <div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: "var(--color-of-faint)",
              marginBottom: 12,
            }}
          >
            Premium
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{PREMIUM_SCHEMES.map(chip)}</div>
        </div>
      )}
    </div>
  );
}
