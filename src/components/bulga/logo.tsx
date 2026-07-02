// Bulga brand mark.
//
// A high-contrast serif "B" with open (knockout) counters whose top terminal
// grows into a veined leaf sweeping up and to the right. The letterform is
// filled with intaglio line-engraving — the fine line-work of a banknote — but
// the lines follow the FORM the way real currency engraving does: vertical in
// the stem, concentric arcs sweeping around each bowl, and a diagonal grain
// running along the leaf. A thin outline caps the strokes and keeps the
// silhouette sharp from a 96px lockup down to a 16px favicon. A soft
// tonal gradient underneath carries the letter's mass when the lines blur at
// small sizes. Monochrome-safe — every fill/stroke is currentColor.
//
// The mark stands on its own (transparent, no tile) in the fixed brand coral
// so it pops against the canvas. Pass `bg` to sit it on a colored tile.

"use client";

import { useId } from "react";
import { LOGO_CORAL } from "@/components/bulga/theme";

// Letterform geometry. `D_MARK_*` are the B body + veined leaf (clipped +
// outlined, `evenodd` knocks out the counters). The `D_ENGRAVE_*` strings are
// the generated engraving line-work, each clipped to its region so the lines
// stay inside the ink and follow the form.
const D_BODY =
  "M26 26 H50 C62 26 70 32 70 42 C70 48 67 52 61 55 C69 57 74 62 74 70 C74 80 65 87 51 87 H26 Z M39 34 V51 H49 C56 51 60 48 60 42 C60 37 56 34 50 34 Z M39 60 V79 H50 C58 79 63 75 63 69 C63 64 58 60 51 60 Z";
const D_LEAF =
  "M40 28 C48 14 66 8 84 10 C76 26 58 32 40 30 Z M46 27 C56 19 70 15 80 13 C68 18 56 23 46 27 Z";
const D_LEAF_SHAPE = "M40 28 C48 14 66 8 84 10 C76 26 58 32 40 30 Z";
const D_STEM = "M27 25 V88 M29.1 25 V88 M31.2 25 V88 M33.3 25 V88 M35.4 25 V88 M37.5 25 V88";
// Cross-hatch mesh for the stem: horizontal lines rotated ±38° (below) cross
// over the verticals to give the woven intaglio texture of a banknote.
const D_XHATCH =
  "M0 18 H72 M0 21 H72 M0 24 H72 M0 27 H72 M0 30 H72 M0 33 H72 M0 36 H72 M0 39 H72 M0 42 H72 M0 45 H72 M0 48 H72 M0 51 H72 M0 54 H72 M0 57 H72 M0 60 H72 M0 63 H72 M0 66 H72 M0 69 H72 M0 72 H72 M0 75 H72 M0 78 H72 M0 81 H72 M0 84 H72 M0 87 H72 M0 90 H72 M0 93 H72 M0 96 H72";
const D_UPPER =
  "M38.5 39.5 A3 3 0 0 1 38.5 45.5 M38.5 37.4 A5.1 5.1 0 0 1 38.5 47.6 M38.5 35.3 A7.2 7.2 0 0 1 38.5 49.7 M38.5 33.2 A9.3 9.3 0 0 1 38.5 51.8 M38.5 31.1 A11.4 11.4 0 0 1 38.5 53.9 M38.5 29 A13.5 13.5 0 0 1 38.5 56 M38.5 26.9 A15.6 15.6 0 0 1 38.5 58.1 M38.5 24.8 A17.7 17.7 0 0 1 38.5 60.2 M38.5 22.7 A19.8 19.8 0 0 1 38.5 62.3 M38.5 20.6 A21.9 21.9 0 0 1 38.5 64.4 M38.5 18.5 A24 24 0 0 1 38.5 66.5 M38.5 16.4 A26.1 26.1 0 0 1 38.5 68.6 M38.5 14.3 A28.2 28.2 0 0 1 38.5 70.7 M38.5 12.2 A30.3 30.3 0 0 1 38.5 72.8 M38.5 10.1 A32.4 32.4 0 0 1 38.5 74.9";
const D_LOWER =
  "M38.5 66 A3 3 0 0 1 38.5 72 M38.5 63.9 A5.1 5.1 0 0 1 38.5 74.1 M38.5 61.8 A7.2 7.2 0 0 1 38.5 76.2 M38.5 59.7 A9.3 9.3 0 0 1 38.5 78.3 M38.5 57.6 A11.4 11.4 0 0 1 38.5 80.4 M38.5 55.5 A13.5 13.5 0 0 1 38.5 82.5 M38.5 53.4 A15.6 15.6 0 0 1 38.5 84.6 M38.5 51.3 A17.7 17.7 0 0 1 38.5 86.7 M38.5 49.2 A19.8 19.8 0 0 1 38.5 88.8 M38.5 47.1 A21.9 21.9 0 0 1 38.5 90.9 M38.5 45 A24 24 0 0 1 38.5 93 M38.5 42.9 A26.1 26.1 0 0 1 38.5 95.1 M38.5 40.8 A28.2 28.2 0 0 1 38.5 97.2 M38.5 38.7 A30.3 30.3 0 0 1 38.5 99.3 M38.5 36.6 A32.4 32.4 0 0 1 38.5 101.4";
const D_LEAF_GRAIN =
  "M35 -4 H90 M35 -2 H90 M35 0 H90 M35 2 H90 M35 4 H90 M35 6 H90 M35 8 H90 M35 10 H90 M35 12 H90 M35 14 H90 M35 16 H90 M35 18 H90 M35 20 H90 M35 22 H90 M35 24 H90 M35 26 H90 M35 28 H90 M35 30 H90 M35 32 H90 M35 34 H90 M35 36 H90 M35 38 H90 M35 40 H90";

/** The engraved mark, drawn in currentColor at viewBox "8 8 80 80". IDs are
    fixed but the geometry + color are identical everywhere, so repeated
    instances (and duplicate defs) resolve to the same thing — safe.

    `detail` (0–1) scales how much of the fine intaglio line-work shows. At small
    render sizes the hairlines fall below a device pixel and muddy into a smudge,
    so we fade them out and lean on the tonal base + crisp outline to carry the
    "B". At full size the complete engraving shows. */
function EngravedMark({ detail = 1, uid }: { detail?: number; uid: string }) {
  // Below full detail, deepen the tonal base so the letterform keeps its mass as
  // the interior lines fade, and thicken the capping outline so the silhouette
  // stays sharp. lineOpacity drives the fine engraving; it reaches 0 when tiny.
  const baseTop = 0.5 + (1 - detail) * 0.34;   // 0.5 → 0.84
  const baseBottom = 0.24 + (1 - detail) * 0.3; // 0.24 → 0.54
  const outlineWidth = 1.4 + (1 - detail) * 0.8; // 1.4 → 2.2
  const lineOpacity = detail; // fine line-work fades with size
  // IDs are unique per instance (via useId). Sharing one id set across instances
  // breaks when the first definition lives in a display:none subtree (e.g. the
  // lg-only brand panel on mobile) — browsers then ignore that clipPath and the
  // engraving bleeds outside the letterform.
  const base = `${uid}-base`;
  const mark = `${uid}-mark`;
  const stem = `${uid}-stem`;
  const upper = `${uid}-upper`;
  const lower = `${uid}-lower`;
  const leaf = `${uid}-leaf`;
  return (
    <>
      <defs>
        <linearGradient id={base} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity={baseTop} />
          <stop offset="1" stopColor="currentColor" stopOpacity={baseBottom} />
        </linearGradient>
        <clipPath id={mark} clipRule="evenodd">
          <path d={D_BODY} />
          <path d={D_LEAF} />
        </clipPath>
        <clipPath id={stem}>
          <rect x="20" y="24" width="19.2" height="64" />
        </clipPath>
        <clipPath id={upper}>
          <rect x="39.2" y="24" width="42" height="32" />
        </clipPath>
        <clipPath id={lower}>
          <rect x="39.2" y="55.5" width="42" height="33" />
        </clipPath>
        <clipPath id={leaf}>
          <path d={D_LEAF_SHAPE} />
        </clipPath>
      </defs>

      {/* engraved fill: tonal base + form-following line-work, ink only */}
      <g clipPath={`url(#${mark})`}>
        <rect x="8" y="8" width="80" height="80" fill={`url(#${base})`} />
        <g fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity={lineOpacity}>
          <g clipPath={`url(#${stem})`}>
            <path d={D_STEM} />
            {/* woven cross-hatch over the verticals — the $100-bill texture */}
            <g strokeWidth="0.36" strokeOpacity={0.65}>
              <g transform="rotate(38 32 57)">
                <path d={D_XHATCH} />
              </g>
              <g transform="rotate(-38 32 57)">
                <path d={D_XHATCH} />
              </g>
            </g>
          </g>
          <g clipPath={`url(#${upper})`}>
            <path d={D_UPPER} />
          </g>
          <g clipPath={`url(#${lower})`}>
            <path d={D_LOWER} />
          </g>
          <g clipPath={`url(#${leaf})`}>
            <g transform="rotate(-23 60 18)">
              <path d={D_LEAF_GRAIN} />
            </g>
          </g>
        </g>
      </g>

      {/* crisp outline caps the engraving — smooth all around, no serif slabs */}
      <g fill="none" stroke="currentColor" strokeWidth={outlineWidth} fillRule="evenodd">
        <path d={D_BODY} />
        <path d={D_LEAF} />
      </g>
    </>
  );
}

interface LogoMarkProps {
  size?: number;
  /** Background of the rounded square. Defaults to transparent — the coral
      mark stands on its own. Pass a color to sit it on a tile. */
  bg?: string;
  /** Color of the monogram. Defaults to the fixed brand coral. */
  fg?: string;
  className?: string;
}

/** The brand mark — used standalone, in the sidebar rail, and as the favicon. */
export function LogoMark({ size = 30, bg = "transparent", fg = LOGO_CORAL, className }: LogoMarkProps) {
  // Unique per instance so multiple marks on one page never share (and collide
  // on) clipPath / gradient ids. Colons from useId aren't valid in url(#…) refs.
  const uid = useId().replace(/:/g, "");
  const r = size * 0.3;
  // Fade the fine engraving as the mark shrinks: full detail at ≥64px, minimal
  // interior line-work at ≤28px so the "B" reads cleanly on the small rail.
  const detail = Math.max(0, Math.min(1, (size - 28) / (64 - 28)));
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
      <svg
        width={size * 0.72}
        height={size * 0.72}
        viewBox="4 4 88 88"
        aria-hidden="true"
        style={{ color: fg, overflow: "visible" }}
      >
        <EngravedMark detail={detail} uid={uid} />
      </svg>
    </div>
  );
}

