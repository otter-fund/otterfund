// otterfund — category glyph.
//
// Hand-drawn category sketches (public/categories/*.png) are white+alpha masks,
// so filling the box with a colour tints the sketch. This is the one place a
// category's identity mark is drawn — used by the overview "Where it went"
// ledger and the spending category breakdown — so the glyph set + fallback
// stay in one source of truth. Colour is passed in by the caller (usually the
// category's own identity tint, the one place per-category colour survives the
// single-accent chrome — a category is data, not decoration).

const CATEGORY_GLYPHS = new Set([
  "bills", "dining_out", "entertainment", "groceries",
  "health", "housing", "other", "subscriptions", "transport",
]);

/** Resolve a category name to its sketch asset, falling back to "other". */
export function glyphFor(category: string): string {
  const key = category.trim().toLowerCase().replace(/\s+/g, "_");
  return `/categories/${CATEGORY_GLYPHS.has(key) ? key : "other"}.png`;
}

/** A category's sketch glyph, tinted to `color` via CSS mask (landing-style). */
export function CategoryGlyph({ category, color, size = 24 }: { category: string; color: string; size?: number }) {
  const src = glyphFor(category);
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: size,
        height: size,
        flexShrink: 0,
        background: color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
