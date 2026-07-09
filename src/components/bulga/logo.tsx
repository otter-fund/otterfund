// Bulga brand mark — the floating otter.
//
// The mark is a traced illustration (otter-mark.svg, 38 flat paths on a
// 1024×432 canvas) supplied as final artwork. It renders as a CSS mask over a
// solid color block, so `fg` recolors the whole drawing — coral by default,
// white on the brand-kit accent tile — without touching the asset.

"use client";

import type { LucideProps } from "lucide-react";
import { LOGO_CORAL } from "@/components/bulga/theme";
import otterMark from "./otter-mark.svg";

// Aspect ratio of the artwork's viewBox.
const MARK_W = 1024;
const MARK_H = 432;

// The otter face icon, on lucide's 24×24 grid: head outline with two small
// round ears in one stroke, a filled nose, and a whisker either side. No eyes,
// same line quality as the mark.
const D_FACE =
  "M 3.3 13.7 C 3.3 10.5, 3.9 8.6, 5 7.2 C 4.2 4.3, 7.3 2.7, 9.2 4.7 C 10.1 4.2, 13.9 4.2, 14.8 4.7 C 16.7 2.7, 19.8 4.3, 19 7.2 C 20.1 8.6, 20.7 10.5, 20.7 13.7 C 20.7 18, 16.8 21.1, 12 21.1 C 7.2 21.1, 3.3 18, 3.3 13.7 Z";
const D_WHISKERS = "M 8.5 13.8 L 5.9 14.1 M 15.5 13.8 L 18.1 14.1";

/** The otter face — Bulga's stand-in for generic "AI" iconography (sparkles,
    chat bubbles). Lucide-compatible props so it drops into any icon slot. */
export function OtterFace({ size = 24, strokeWidth = 2, className, style }: LucideProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d={D_FACE} />
      <path d={D_WHISKERS} strokeWidth={Number(strokeWidth) * 0.85} />
      <circle cx="12" cy="13.1" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

interface LogoMarkProps {
  size?: number;
  /** Background of the rounded square. Defaults to transparent — the coral
      mark stands on its own. Pass a color to sit it on a tile. */
  bg?: string;
  /** Color of the mark. Defaults to the fixed brand coral. */
  fg?: string;
  className?: string;
}

/** The brand mark — used standalone, in the sidebar rail, and as the favicon.
    `size` is the square slot it occupies; the artwork is wide (~2.4:1), so it
    draws ~45% wider than the slot (every placement has clear space around it)
    and stays vertically centered. */
export function LogoMark({ size = 30, bg = "transparent", fg = LOGO_CORAL, className }: LogoMarkProps) {
  const r = size * 0.3;
  const drawW = size * 1.45;
  const mask = `url(${otterMark.src}) center / contain no-repeat`;
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <div
        aria-hidden
        style={{
          width: drawW,
          height: drawW * (MARK_H / MARK_W),
          flexShrink: 0,
          backgroundColor: fg,
          WebkitMask: mask,
          mask,
        }}
      />
    </div>
  );
}
