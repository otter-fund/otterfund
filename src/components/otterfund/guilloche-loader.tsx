"use client";

// otterfund — animated guilloché loader.
//
// The brand-kit seal, but alive: the rosette's pen offset breathes in and out
// (two rays a quarter-cycle apart, so they weave) while the whole figure turns
// slowly. The result is a starburst whose points endlessly roll and cross
// through one another — an ongoing, smoothly-shifting load, never a blink or a
// flash. The glyph in the middle stays upright and legible throughout.
//
// It's a client component (rAF drives the morph) so it stays out of the
// RSC-safe guilloche.tsx; it reuses that file's hypotrochoid math. Under
// prefers-reduced-motion it renders a single still frame.

import { useEffect, useRef, useState } from "react";
import { hypotrochoid } from "@/components/otterfund/guilloche";
import { cn } from "@/lib/utils";

const S = 120;
const PETALS = 12;
const INNER = 5;
const PEN_MID = 3.6; // centre of the pen-offset swing

// Defaults — the maxed, energetic settings. Exported so the brand-kit tuner
// can seed its sliders from the exact values the app ships with.
export const LOADER_DEFAULTS = {
  penSwing: 3.2, // how far the offset rolls either side of centre
  swingHz: 1.8, // radians/sec — the breathing speed
  spinDps: 80, // degrees/sec — the revolve
};

// Scale to the widest the rosette ever reaches (offset at its peak) so the star
// breathes *within* the coin instead of resizing it. Depends on the swing.
const scaleFor = (penSwing: number) => (S / 2 - 16) / (Math.abs(PETALS - INNER) + (PEN_MID + penSwing));

export function GuillocheLoader({
  accent,
  accentDeep,
  label = "$",
  className,
  penSwing = LOADER_DEFAULTS.penSwing,
  swingHz = LOADER_DEFAULTS.swingHz,
  spinDps = LOADER_DEFAULTS.spinDps,
}: {
  accent: string;
  accentDeep: string;
  label?: string;
  className?: string;
  /** How far the rosette's pen offset rolls either side of centre. */
  penSwing?: number;
  /** Breathing speed of the offset, in radians/sec. */
  swingHz?: number;
  /** Revolve speed, in degrees/sec. */
  spinDps?: number;
}) {
  const [t, setT] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let start: number | null = null;
    const loop = (ts: number) => {
      if (start === null) start = ts;
      setT((ts - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const scale = scaleFor(penSwing);
  const still = hypotrochoid(PETALS, INNER, PEN_MID, INNER, S / 2, S / 2, scale);
  const penA = PEN_MID + penSwing * Math.sin(t * swingHz);
  const penB = PEN_MID + penSwing * Math.sin(t * swingHz + Math.PI / 2);
  const ringA = t === 0 ? still : hypotrochoid(PETALS, INNER, penA, INNER, S / 2, S / 2, scale);
  const ringB = t === 0 ? still : hypotrochoid(PETALS, INNER, penB, INNER, S / 2, S / 2, scale);
  const rot = (t * spinDps) % 360;

  return (
    <svg viewBox={`0 0 ${S} ${S}`} className={cn("h-full w-full", className)} role="img" aria-label="Loading">
      <circle cx={S / 2} cy={S / 2} r={S / 2 - 3} fill="none" stroke={accent} strokeWidth={0.8} />
      <circle cx={S / 2} cy={S / 2} r={S / 2 - 8} fill="none" stroke={accentDeep} strokeWidth={0.5} opacity={0.6} />
      {/* the rolling starburst — two phase-shifted rays that revolve together */}
      <g transform={`rotate(${rot} ${S / 2} ${S / 2})`}>
        <path d={ringB} fill="none" stroke={accentDeep} strokeWidth={0.55} opacity={0.5} />
        <path d={ringA} fill="none" stroke={accent} strokeWidth={0.65} opacity={0.9} />
      </g>
      {/* clear disc so the glyph reads cleanly over the rosette */}
      <circle cx={S / 2} cy={S / 2} r={S * 0.17} fill="var(--color-of-surface)" />
      <text
        x={S / 2}
        y={S / 2}
        dy="0.34em"
        textAnchor="middle"
        fill={accentDeep}
        style={{ font: `700 ${S * 0.3}px var(--font-num)` }}
      >
        {label}
      </text>
    </svg>
  );
}
