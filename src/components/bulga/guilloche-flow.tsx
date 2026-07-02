"use client";

// Bulga design-system primitive — animated guilloché flow.
//
// The wave field in gentle motion: the dash offset drifts along each line so the
// engine-turned line-work flows — for hero / landing moments where a little life
// helps. It reuses waveField() from the static <GuillochePattern> and mirrors its
// absolute-backdrop + edge-fade API, so it drops in the exact same way. Under
// prefers-reduced-motion the animation never starts, so it degrades to the calm
// static field and is safe as a live background.

import { useEffect, useMemo, useRef } from "react";

import { waveField } from "@/components/bulga/guilloche";
import { cn } from "@/lib/utils";

// Geometry — matches the "flowing lines" tuning from the brand-kit pattern lab.
const W = 600;
const H = 420;
const GAP = 15;
const AMP = 8;
const FREQ = 0.04;
const DASH = 3;
const PERIOD = DASH + DASH * 1.5; // one full dash cycle → seamless loop

const FADE: Record<string, string> = {
  radial: "radial-gradient(circle at center, #000 15%, transparent 68%)",
  right: "linear-gradient(to left, #000 12%, transparent 82%)",
  left: "linear-gradient(to right, #000 12%, transparent 82%)",
  top: "linear-gradient(to bottom, #000 8%, transparent 72%)",
  bottom: "linear-gradient(to top, #000 8%, transparent 72%)",
  none: "",
};

interface GuillocheFlowProps {
  accent: string;
  accentDeep: string;
  /** Overall opacity. Live backgrounds sit low — around 0.12–0.16. */
  opacity?: number;
  /** Where the texture fades so it never fights content. */
  fade?: keyof typeof FADE;
  /** 1 slow → 10 fast. */
  speed?: number;
  className?: string;
}

/**
 * Absolutely-positioned, non-interactive animated guilloché field. Drop it as the
 * first child of a `relative overflow-hidden` container, exactly like
 * <GuillochePattern>. The following content must be `relative` to sit above it.
 */
export function GuillocheFlow({
  accent,
  accentDeep,
  opacity = 0.14,
  fade = "radial",
  speed = 6,
  className,
}: GuillocheFlowProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const lines = useMemo(() => waveField(W, H, GAP, AMP, FREQ, 0.6), []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    // Freeze under reduced-motion — render the static field, no drift.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const paths = Array.from(svg.querySelectorAll("path"));
    // Drift the dash by exactly one period for a seamless loop; alternate the
    // direction per row and vary the duration so the field breathes rather than
    // marching in lockstep.
    const base = 5200 - speed * 400;
    const anims = paths.map((p, i) =>
      p.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: (i % 2 ? 1 : -1) * PERIOD }], {
        duration: base + i * 80,
        iterations: Infinity,
        easing: "linear",
      })
    );
    return () => anims.forEach((a) => a.cancel());
  }, [speed]);

  const mask = FADE[fade];
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      style={{ opacity, ...(mask ? { maskImage: mask, WebkitMaskImage: mask } : null) }}
    >
      {lines.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={i % 2 ? accent : accentDeep}
          strokeWidth={0.85}
          strokeDasharray={`${DASH} ${DASH * 1.5}`}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
