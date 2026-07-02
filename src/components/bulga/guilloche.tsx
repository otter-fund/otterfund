// Bulga design-system primitive — guilloché pattern.
//
// The banknote line-work, as a reusable *backdrop*. Pure SVG + math (no image,
// no hooks) so it's RSC-safe and cheap.
//
// Two shapes:
//   • "waves"   — engine-turned field: flowing parallel lines that weave into a
//                 quiet moiré. The default backdrop — directional and calm, not
//                 a focal starburst.
//   • "rosette" — the spirograph medallion, kept for the contained <GuillocheSeal>.
//
// Lines are broken up with a dash so it reads as a soft stipple, and the whole
// thing fades at the edges so it never fights the content. Colours come in as
// props (pass theme.accent / theme.accentDeep) so it retones with the accent.

import { cn } from "@/lib/utils";

/** A hypotrochoid (spirograph) traced as one long path — the rosette / seal. */
export function hypotrochoid(R: number, r: number, d: number, turns: number, cx: number, cy: number, scale: number) {
  const pts: string[] = [];
  const steps = turns * 160;
  for (let i = 0; i <= steps; i++) {
    const t = (i / 160) * 2 * Math.PI;
    const k = R - r;
    const x = k * Math.cos(t) + d * Math.cos((k / r) * t);
    const y = k * Math.sin(t) - d * Math.sin((k / r) * t);
    pts.push(`${(cx + x * scale).toFixed(2)} ${(cy + y * scale).toFixed(2)}`);
  }
  return "M" + pts.join("L");
}

/** A woven horizontal ribbon: two phase-shifted sine waves that cross. */
export function braid(w: number, y: number, amp: number, freq: number, phase: number) {
  const pts: string[] = [];
  for (let x = 0; x <= w; x += 4) {
    pts.push(`${x} ${(y + amp * Math.sin((x / w) * Math.PI * 2 * freq + phase)).toFixed(2)}`);
  }
  return "M" + pts.join("L");
}

/**
 * Engine-turned field: a stack of horizontal lines, each a sum of two sines,
 * with the phase drifting per row so neighbouring lines weave together into the
 * moiré banding you see on banknote backgrounds.
 */
export function waveField(w: number, h: number, gap: number, amp: number, freq: number, phaseStep: number) {
  const paths: string[] = [];
  let idx = 0;
  for (let y0 = gap; y0 <= h - gap / 2; y0 += gap, idx++) {
    const phase = idx * phaseStep;
    const pts: string[] = [];
    for (let x = 0; x <= w; x += 6) {
      const y = y0 + amp * Math.sin(x * freq + phase) + amp * 0.45 * Math.sin(x * freq * 2.2 + phase * 1.6);
      pts.push(`${x} ${y.toFixed(2)}`);
    }
    paths.push("M" + pts.join("L"));
  }
  return paths;
}

const FADE: Record<string, string> = {
  radial: "radial-gradient(circle at center, #000 15%, transparent 68%)",
  right: "linear-gradient(to left, #000 12%, transparent 82%)",
  left: "linear-gradient(to right, #000 12%, transparent 82%)",
  top: "linear-gradient(to bottom, #000 8%, transparent 72%)",
  bottom: "linear-gradient(to top, #000 8%, transparent 72%)",
  none: "",
};

interface GuillochePatternProps {
  accent: string;
  accentDeep: string;
  /** "waves" (default backdrop) or "rosette" (spirograph medallion). */
  variant?: "waves" | "rosette";
  /** Overall opacity. Backdrops sit around 0.16–0.24. */
  opacity?: number;
  /** Where the texture fades so it doesn't fight content. */
  fade?: keyof typeof FADE;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Absolutely-positioned, non-interactive guilloché texture. Drop it as the
 * first child of a `relative overflow-hidden` card:
 *   <Card className="relative overflow-hidden">
 *     <GuillochePattern accent={theme.accent} accentDeep={theme.accentDeep} />
 *     …content…
 *   </Card>
 */
export function GuillochePattern({
  accent,
  accentDeep,
  variant = "waves",
  opacity = 0.2,
  fade = "left",
  className,
  style,
}: GuillochePatternProps) {
  const mask = FADE[fade];
  const wrap = (children: React.ReactNode, viewBox: string) => (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      style={{ opacity, ...(mask ? { maskImage: mask, WebkitMaskImage: mask } : null), ...style }}
    >
      {children}
    </svg>
  );

  if (variant === "rosette") {
    const S = 400;
    const a = hypotrochoid(11, 6, 4, 6, S / 2, S / 2, 27);
    const b = hypotrochoid(11, 6, 5.5, 6, S / 2, S / 2, 27);
    return wrap(
      <>
        <path d={b} fill="none" stroke={accentDeep} strokeWidth={0.7} strokeDasharray="1.5 5" strokeLinecap="round" />
        <path d={a} fill="none" stroke={accent} strokeWidth={0.8} strokeDasharray="2.5 4" strokeLinecap="round" />
      </>,
      `0 0 ${S} ${S}`
    );
  }

  // Waves — the default.
  const W = 600;
  const H = 420;
  const lines = waveField(W, H, 13, 7, 0.05, 0.6);
  return wrap(
    <>
      {lines.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={i % 2 ? accent : accentDeep}
          strokeWidth={0.85}
          strokeDasharray="3 4.5"
          strokeLinecap="round"
        />
      ))}
    </>,
    `0 0 ${W} ${H}`
  );
}

/**
 * A small self-contained guilloché seal — the medallion/mint-mark shape. Sizes
 * to its container. Good for badges, stamps and empty-state marks.
 * `spin` slowly revolves the rosette ring (the glyph stays upright) — the
 * engine-turned look; the `.bk-seal-spin` animation freezes under
 * prefers-reduced-motion.
 */
export function GuillocheSeal({
  accent,
  accentDeep,
  label = "$",
  petals = 9,
  inner = 5,
  pen = 3,
  spin = false,
  className,
}: {
  accent: string;
  accentDeep: string;
  label?: string;
  petals?: number;
  inner?: number;
  pen?: number;
  spin?: boolean;
  className?: string;
}) {
  const S = 120;
  // Auto-scale the rosette to the ring so it never spills past the coin edge,
  // whatever the petals/inner/pen values are. Max radius of a hypotrochoid is
  // ≈ |R−r| + d.
  const maxR = Math.abs(petals - inner) + pen;
  const scale = maxR > 0 ? (S / 2 - 16) / maxR : 8;
  const ring = hypotrochoid(petals, inner, pen, inner, S / 2, S / 2, scale);
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className={cn("h-full w-full", className)} role="img" aria-label="Guilloché seal">
      <g className={spin ? "bk-seal-spin" : undefined}>
        <circle cx={S / 2} cy={S / 2} r={S / 2 - 3} fill="none" stroke={accent} strokeWidth={0.8} />
        <circle cx={S / 2} cy={S / 2} r={S / 2 - 8} fill="none" stroke={accentDeep} strokeWidth={0.5} opacity={0.6} />
        <path d={ring} fill="none" stroke={accent} strokeWidth={0.6} opacity={0.85} />
      </g>
      {/* clear disc so the glyph reads cleanly over the rosette */}
      <circle cx={S / 2} cy={S / 2} r={S * 0.17} fill="var(--color-bk-surface)" />
      {/* Center vertically with dy off the alphabetic baseline — more reliable
          across fonts than dominant-baseline:central. */}
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
