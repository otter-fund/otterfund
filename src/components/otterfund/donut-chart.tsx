"use client";

// otterfund — donut chart.
//
// A hand-built SVG donut in the same idiom as ProgressRing: it self-animates on
// mount — one continuous clockwise fill from 12 o'clock, each slice's transition
// delayed by its start angle and sized to its share so the fill front moves at
// constant angular speed — and respects reduced-motion. Segments are drawn as
// arcs of one stroked circle via strokeDasharray, so there are no external chart
// deps. Colors are passed in by the caller (derived from the active accent).
// Optional centered content renders upright over the ring.
//
// Pass `formatValue` to make it interactive: slices become hoverable and show a
// tooltip (label · formatted value · percent), dimming the others. It's opt-in,
// so static callers are unaffected.

import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/use-media-query";

export interface DonutSegment {
  value: number;
  color: string;
  label?: string;
}

// Total duration of the mount fill — the full ring, regardless of slice count.
const SWEEP_MS = 900;

export function DonutChart({
  segments,
  size = 168,
  stroke = 24,
  trackColor = "var(--color-of-track)",
  children,
  formatValue,
  onSelect,
}: {
  segments: DonutSegment[];
  size?: number;
  stroke?: number;
  trackColor?: string;
  children?: React.ReactNode;
  /** When provided, slices become hoverable and show a tooltip
      (label · formatValue(value) · percent). Opt-in — omit for a static ring. */
  formatValue?: (value: number) => string;
  /** When provided, slices become clickable and report their index. */
  onSelect?: (index: number) => void;
}) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)", false);
  const [filled, setFilled] = useState(false);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const interactive = typeof formatValue === "function";

  useEffect(() => {
    if (reduced) {
      setFilled(true);
      return;
    }
    const raf = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;

  // Cursor position relative to the (unrotated) wrapper, for the tooltip.
  const at = (e: React.MouseEvent, i: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ i, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const hovered = interactive && hover ? segments[hover.i] : null;

  let start = 0; // cumulative arc length consumed by prior slices
  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
      onMouseLeave={interactive ? () => setHover(null) : undefined}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        <circle cx={c} cy={c} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        {total > 0 &&
          segments.map((seg, i) => {
            const v = Math.max(0, seg.value);
            if (v <= 0) return null;
            const len = (v / total) * circ;
            const begin = start; // arc length consumed before this slice
            const offset = -start;
            start += len;
            const dash = filled
              ? `${len.toFixed(2)} ${(circ - len).toFixed(2)}`
              : `0 ${circ.toFixed(2)}`;
            const dim = interactive && hover != null && hover.i !== i;
            // One clockwise fill: each slice starts when the fill front reaches
            // it (delay ∝ start angle) and draws for its share of the total
            // sweep (duration ∝ length), linear so the front never stalls.
            const delay = (begin / circ) * SWEEP_MS;
            const dur = (len / circ) * SWEEP_MS;
            return (
              <circle
                key={i}
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={dash}
                strokeDashoffset={offset.toFixed(2)}
                onMouseEnter={interactive ? (e) => at(e, i) : undefined}
                onMouseMove={interactive ? (e) => at(e, i) : undefined}
                onClick={onSelect ? () => onSelect(i) : undefined}
                style={{
                  cursor: onSelect || interactive ? "pointer" : undefined,
                  opacity: dim ? 0.45 : 1,
                  transition: reduced
                    ? "opacity .15s"
                    : `stroke-dasharray ${dur.toFixed(0)}ms linear ${delay.toFixed(0)}ms, opacity .15s`,
                }}
              />
            );
          })}
      </svg>
      {children != null && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            textAlign: "center",
            // Let hover events reach the slices underneath — the centre label
            // must not swallow the pointer (otherwise the tooltip never fires).
            pointerEvents: "none",
          }}
        >
          {children}
        </div>
      )}
      {hovered && hovered.label && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            left: hover!.x,
            top: hover!.y,
            transform: "translate(-50%, calc(-100% - 12px))",
            pointerEvents: "none",
            zIndex: 40,
            background: "oklch(26% 0.012 75)",
            color: "#fff",
            borderRadius: 10,
            padding: "7px 10px",
            boxShadow: "0 8px 24px oklch(20% 0.02 80 / 0.3)",
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: hovered.color, flexShrink: 0 }} />
            {hovered.label}
          </div>
          <div className="of-num" style={{ fontSize: 12, marginTop: 2, color: "oklch(85% 0.01 80)" }}>
            {formatValue!(hovered.value)} · {total > 0 ? Math.round((Math.max(0, hovered.value) / total) * 100) : 0}%
          </div>
        </div>
      )}
    </div>
  );
}
