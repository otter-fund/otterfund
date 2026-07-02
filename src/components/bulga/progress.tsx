"use client";

// Bulga progress indicators — the one place the "fill sweeps from 0 on mount"
// pattern lives. Both self-animate: they start empty and ease to their value on
// first paint, so callers don't thread their own `mounted` flag. Colors default
// to the live accent (via the --bk-accent / --color-primary token) but accept an
// override (e.g. clay for over-budget).

import { useEffect, useState } from "react";

/** Drives the fill sweep. Returns `filled` (start empty, flip full next frame so
    the CSS transition tweens) and `animate` (whether to apply the transition at
    all). Respects reduced-motion: there we render at the value on first paint
    with NO transition, so nothing sweeps — the inline transitions can't be
    caught by the CSS @media reduced-motion blocks, so the gate lives here. */
function useSweep() {
  const [filled, setFilled] = useState(false);
  const [animate, setAnimate] = useState(true);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setAnimate(false);
      setFilled(true);
      return;
    }
    const raf = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return { filled, animate };
}

export interface ProgressBarProps {
  /** 0–100; clamped. */
  value: number;
  /** Fill color. Defaults to the live accent. */
  color?: string;
  /** Track thickness in px. */
  height?: number;
  /** Sweep duration in seconds. */
  duration?: number;
  className?: string;
}

/** Slim rounded track with an accent fill that sweeps to `value` on mount. */
export function ProgressBar({
  value,
  color = "var(--color-primary)",
  height = 6,
  duration = 0.9,
  className,
}: ProgressBarProps) {
  const { filled, animate } = useSweep();
  const pct = Math.max(0, Math.min(value, 100));
  return (
    <div
      className={className}
      style={{ height, borderRadius: 999, background: "var(--color-bk-track)", overflow: "hidden" }}
    >
      <div
        style={{
          height: "100%",
          width: filled ? `${pct}%` : "0%",
          borderRadius: 999,
          background: color,
          transition: animate ? `width ${duration}s cubic-bezier(.22,.61,.36,1)` : "none",
        }}
      />
    </div>
  );
}

export interface ProgressRingProps {
  /** 0–100; clamped. */
  value: number;
  /** Overall svg size in px. */
  size?: number;
  /** Stroke thickness in px. */
  stroke?: number;
  /** Arc color. Defaults to the live accent. */
  color?: string;
  /** Optional centered content (emoji, percentage, icon). */
  children?: React.ReactNode;
  className?: string;
}

/** Circular progress arc that sweeps to `value` on mount, with optional
    centered content. Geometry matches the goals-card ring. */
export function ProgressRing({
  value,
  size = 62,
  stroke = 6,
  color = "var(--color-primary)",
  children,
  className,
}: ProgressRingProps) {
  const { filled, animate } = useSweep();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(value, 100));
  const offset = filled ? circ * (1 - clamped / 100) : circ;
  const c = size / 2;
  return (
    <div className={className} style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--color-bk-track)" strokeWidth={stroke} />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ.toFixed(1)}
          strokeDashoffset={offset.toFixed(1)}
          style={{ transition: animate ? "stroke-dashoffset 1.1s cubic-bezier(.22,.61,.36,1)" : "none" }}
        />
      </svg>
      {children != null && (
        <span
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {children}
        </span>
      )}
    </div>
  );
}
