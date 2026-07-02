"use client";

// Bulga — brand panel shell.
//
// The immersive left half of the split-screen pre-auth surfaces (sign in,
// sign up, onboarding). A deep evergreen banknote field with drifting guilloché
// line-work and a soft top-left light spill. It lays its children out top /
// middle / bottom (justify-between) so callers drop in a lockup, a pitch, and a
// trust foot. Hidden below `lg`, where the form column stands alone.

import Link from "next/link";
import { LogoMark } from "@/components/bulga/logo";
import { GuillocheFlow } from "@/components/bulga/guilloche-flow";
import { cn } from "@/lib/utils";

// Panel-local palette — light tones tuned to sit on the deep evergreen field.
// These are surface-specific values, not global design tokens, so they live
// with the panel and are shared by every screen that renders it.
export const PANEL_INK = "oklch(97% 0.014 95)";
export const PANEL_MUTED = "oklch(86% 0.03 150)";
export const PANEL_ACCENT = "oklch(84% 0.1 158)";
export const PANEL_LINE = "oklch(90% 0.05 158)";
export const PANEL_LINE_DEEP = "oklch(82% 0.06 158)";
export const PANEL_HAIRLINE = "oklch(95% 0.03 150 / 0.16)";

export const PANEL_BG =
  "linear-gradient(158deg, oklch(34% 0.064 158) 0%, oklch(25% 0.052 156) 52%, oklch(20% 0.044 160) 100%)";

/** The evergreen banknote field. Children stack in a flex column: give the
    lockup its natural height and let the pitch block grow (`flex-1`) so it
    centres in the remaining space. Each child should be `relative` so it sits
    above the texture. */
export function BrandPanelShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "relative hidden overflow-hidden p-14 lg:flex lg:flex-col xl:p-16",
        className,
      )}
      style={{ background: PANEL_BG }}
    >
      <GuillocheFlow accent={PANEL_LINE} accentDeep={PANEL_LINE_DEEP} opacity={0.15} fade="none" speed={4} />
      {/* soft top-left light spill, so the flat field gains depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 12% 0%, oklch(96% 0.05 158 / 0.12) 0%, transparent 55%)",
        }}
      />
      {children}
    </aside>
  );
}

/** The mark used at the top of every brand panel. Links home. */
export function PanelLockup() {
  return (
    <Link
      href="/"
      aria-label="Bulga home"
      className="bk-enter relative inline-flex w-fit items-center"
    >
      <LogoMark size={46} />
    </Link>
  );
}
