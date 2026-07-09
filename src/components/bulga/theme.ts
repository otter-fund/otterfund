// Bulga design system — accent theming.
//
// The whole palette derives from ONE accent hue: deep tone, soft fill, badge
// backgrounds, the net-worth chart and every progress bar follow the hue you
// pick, so the brand stays cohesive whichever scheme is active. This mirrors
// one accent hue, derived into a cohesive palette.

export const DEFAULT_ACCENT = "oklch(48% 0.115 158)"; // Evergreen

/**
 * The Bulga logo green — fixed forever, independent of the active accent. The
 * brand mark must read as the same evergreen no matter which theme the user
 * picks in the Brand kit, so the logo pins to this rather than `--bk-accent`.
 */
export const LOGO_GREEN = "oklch(48% 0.115 158)";

/**
 * The Bulga logo coral — the brand mark now stands on its own (no tile) in a
 * warm coral so it pops against the app's canvas and the light sidebar rail.
 * Like LOGO_GREEN, it is fixed and ignores the active accent.
 */
export const LOGO_CORAL = "oklch(66% 0.17 29)";

/**
 * The Canadian banknote scheme — one accent per denomination, in each note's
 * signature colour ($5 blue, $10 purple, $20 green, $50 red, $100 brown/sepia).
 * Hues are tuned to the system's accent lightness/chroma range so they read
 * cleanly as accents (text on tint, charts, progress). The $20 green sits on
 * hue 158 — the same as Bulga's evergreen brand hue, so it matches the logo.
 */
export const SCHEMES: { name: string; value: string }[] = [
  { name: "$5 · Blue", value: "oklch(52% 0.11 250)" },
  { name: "$10 · Purple", value: "oklch(50% 0.13 312)" },
  { name: "$20 · Green", value: "oklch(48% 0.115 158)" },
  { name: "$50 · Red", value: "oklch(53% 0.16 25)" },
  { name: "$100 · Brown", value: "oklch(52% 0.075 68)" },
];

/**
 * A Canadian banknote *scheme* — one cohesive palette that uses ALL five note
 * colours at once ($5 blue, $10 purple, $20 green, $50 red, $100 brown). Unlike
 * the single-accent SCHEMES above, these are meant to be used together: charts,
 * category tiles, and allocation bars can draw from the whole set. `accent` is
 * the primary hue that still drives the single-hue app theming (kept green — the
 * brand through-line — so the logo and primary UI stay on-brand across variants).
 */
export interface BanknoteScheme {
  name: string;
  note: string;
  accent: string;
  colors: { label: string; value: string }[];
}

/** A few tonal treatments of the same five-note palette. */
export const BANKNOTE_SCHEMES: BanknoteScheme[] = [
  {
    name: "Polymer",
    note: "The notes as issued: vivid, confident, unmistakably currency.",
    accent: "oklch(50% 0.13 158)",
    colors: [
      { label: "$5", value: "oklch(52% 0.13 250)" },
      { label: "$10", value: "oklch(50% 0.14 312)" },
      { label: "$20", value: "oklch(50% 0.13 158)" },
      { label: "$50", value: "oklch(51% 0.18 25)" },
      { label: "$100", value: "oklch(53% 0.09 68)" },
    ],
  },
  {
    name: "Tundra",
    note: "Lightened, low-chroma: calm fills and tints that stay legible.",
    accent: "oklch(48% 0.115 158)",
    colors: [
      { label: "$5", value: "oklch(68% 0.08 250)" },
      { label: "$10", value: "oklch(67% 0.09 312)" },
      { label: "$20", value: "oklch(67% 0.08 158)" },
      { label: "$50", value: "oklch(68% 0.11 25)" },
      { label: "$100", value: "oklch(70% 0.055 68)" },
    ],
  },
  {
    name: "Vault",
    note: "Darker, richer tones for figures, emphasis and dense data.",
    accent: "oklch(38% 0.1 158)",
    colors: [
      { label: "$5", value: "oklch(40% 0.1 250)" },
      { label: "$10", value: "oklch(40% 0.11 312)" },
      { label: "$20", value: "oklch(38% 0.1 158)" },
      { label: "$50", value: "oklch(40% 0.15 24)" },
      { label: "$100", value: "oklch(40% 0.07 68)" },
    ],
  },
];

/** Pull the hue (3rd oklch component) out of an `oklch(L C H)` string. */
export function hueOf(accent: string): string {
  const parts = accent.replace(/oklch\(|\)/gi, "").trim().split(/[\s,/]+/);
  return parts[2] ?? "158";
}

export interface BulgaTheme {
  accent: string;        // the raw accent (a.k.a. "green")
  accentDeep: string;    // deep tone for figures / emphasis
  accentTint: string;    // soft fill for insight card, badges
  accentTintBorder: string;
  accentBorder: string;  // mid-strength accent border for hover/active edges
  clay: string;          // alert / negative
  clayTint: string;
  ink: string;
  muted: string;
}

/** Derive the full cohesive theme from a single accent. */
export function deriveTheme(accent: string = DEFAULT_ACCENT): BulgaTheme {
  const hue = hueOf(accent);
  return {
    accent,
    accentDeep: `oklch(38% 0.092 ${hue})`,
    accentTint: `oklch(95.5% 0.03 ${hue})`,
    accentTintBorder: `oklch(90% 0.045 ${hue})`,
    accentBorder: `oklch(78% 0.09 ${hue})`,
    clay: "oklch(52% 0.14 33)",
    clayTint: "oklch(95% 0.04 38)",
    ink: "oklch(24% 0.012 70)",
    muted: "oklch(52% 0.012 80)",
  };
}

/**
 * The fixed evergreen brand theme. Pre-auth surfaces (landing, auth, onboarding)
 * render before a user has picked an accent, so they texture with this rather
 * than a live theme — keeping the guilloché line-work on-brand everywhere.
 */
export const BRAND_THEME = deriveTheme(DEFAULT_ACCENT);

/**
 * Map the active theme onto the shadcn/base-ui `:root` tokens so the whole
 * primitive layer (Button, Input focus border, Badge, focus rings, accent
 * tints, chart-1) re-tints with the accent instead of staying evergreen.
 * Spread onto the shell root's `style` alongside `--bk-accent`. Note these
 * override the static `:root` values in globals.css for everything inside the
 * shell — the logo deliberately ignores them by pinning to LOGO_GREEN.
 */
export function themeVars(theme: BulgaTheme): Record<string, string> {
  return {
    "--bk-accent": theme.accent,
    "--primary": theme.accent,
    "--ring": theme.accent,
    "--accent": theme.accentTint,
    "--accent-foreground": theme.accentDeep,
    "--chart-1": theme.accent,
  };
}

/**
 * A soft avatar tint that varies per item while staying in the active accent's
 * family. We nudge the hue a little around the accent hue (a gentle spread) so a
 * list of tiles reads as a related set of shades rather than one flat colour —
 * cohesive, not a rainbow, and it re-tints with the scheme. Returns [bg, ink].
 */
export function accentFamilyTint(index: number, accent: string = DEFAULT_ACCENT): [string, string] {
  const base = Number(hueOf(accent)) || 158;
  // Spread across ±26° in 5 steps, cycling — enough to distinguish neighbours
  // without leaving the accent's neighbourhood.
  const offsets = [0, 16, -14, 26, -24];
  const hue = base + offsets[index % offsets.length];
  return [`oklch(95% 0.035 ${hue})`, `oklch(40% 0.09 ${hue})`];
}

/** Per-category tints for transaction / account avatars: [bg, ink]. */
export const CATEGORY_TINTS: Record<string, [string, string]> = {
  Groceries: ["oklch(94.5% 0.03 155)", "oklch(43% 0.08 155)"],
  Income: ["oklch(94.5% 0.035 158)", "oklch(40% 0.1 158)"],
  Subscriptions: ["oklch(94.5% 0.022 290)", "oklch(46% 0.07 290)"],
  Transport: ["oklch(94.5% 0.022 245)", "oklch(46% 0.06 245)"],
  Dining: ["oklch(95% 0.03 70)", "oklch(48% 0.07 60)"],
  "Dining out": ["oklch(95% 0.03 70)", "oklch(48% 0.07 60)"],
  Entertainment: ["oklch(95% 0.03 35)", "oklch(50% 0.09 35)"],
  Bills: ["oklch(94.5% 0.016 250)", "oklch(44% 0.05 250)"],
  Health: ["oklch(94.5% 0.025 190)", "oklch(44% 0.06 190)"],
  Housing: ["oklch(94.5% 0.02 100)", "oklch(45% 0.06 100)"],
};

const FALLBACK_TINT: [string, string] = ["oklch(95% 0.005 85)", "oklch(52% 0.012 80)"];

export function tintFor(category: string): [string, string] {
  return CATEGORY_TINTS[category] ?? FALLBACK_TINT;
}
