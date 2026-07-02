"use client";

// Bulga — donut chart.
//
// A hand-built SVG donut in the same idiom as ProgressRing: it self-animates
// (each slice sweeps out from its start on mount) and respects reduced-motion.
// Segments are drawn as arcs of one stroked circle via strokeDasharray, so there
// are no external chart deps. Colors are passed in by the caller (derived from
// the active accent). Optional centered content renders upright over the ring.

import { useEffect, useState } from "react";
import { useMediaQuery } from "@/lib/use-media-query";

export interface DonutSegment {
  value: number;
  color: string;
  label?: string;
}

export function DonutChart({
  segments,
  size = 168,
  stroke = 24,
  trackColor = "var(--color-bk-track)",
  children,
}: {
  segments: DonutSegment[];
  size?: number;
  stroke?: number;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)", false);
  const [filled, setFilled] = useState(false);
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

  let start = 0; // cumulative arc length consumed by prior slices
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
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
            const offset = -start;
            start += len;
            const dash = filled
              ? `${len.toFixed(2)} ${(circ - len).toFixed(2)}`
              : `0 ${circ.toFixed(2)}`;
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
                style={{
                  transition: reduced
                    ? "none"
                    : "stroke-dasharray 0.9s cubic-bezier(.22,.61,.36,1)",
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
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
