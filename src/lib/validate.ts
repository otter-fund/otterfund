// Server-side input validators. Framework-agnostic (no GraphQL/Prisma deps) so
// they stay easy to unit-test; resolvers call these and raise badRequest() on a
// falsy result. RLS is disabled, so app-layer validation is the only guard
// against oversized/garbage/injection-shaped writes reaching Postgres.

/** Hard limits enforced before any write or expensive (AI) call. */
export const LIMITS = {
  NAME: 120,
  EMOJI: 16,
  COLOR: 240,
  ACCOUNT_NUMBER: 34,
  /** Absolute cap on any monetary magnitude (amounts, balances, targets). */
  MONEY_MAX: 1e12,
  /** Max transactions accepted by confirmImport in one call (fan-out guard). */
  IMPORT_TRANSACTIONS: 1000,
  /** Max ids accepted by a bulk delete in one call. */
  BULK: 1000,
  /** Max files accepted by autoOnboardFromFiles in one call. */
  UPLOAD_FILES: 10,
  /** Max bytes for a single uploaded statement (before buffering to memory). */
  UPLOAD_BYTES: 10 * 1024 * 1024,
} as const;

/** True when a nullable string is absent or within `max` chars. */
export function okString(v: string | null | undefined, max: number): boolean {
  return v == null || v.length <= max;
}

/** True when a nullable number is absent or a finite value within ±MONEY_MAX. */
export function okMoney(v: number | null | undefined): boolean {
  return v == null || (Number.isFinite(v) && Math.abs(v) <= LIMITS.MONEY_MAX);
}

/** True when a nullable value is absent or one of the allowed members. */
export function okEnum<T extends string>(
  v: string | null | undefined,
  allowed: readonly T[],
): boolean {
  return v == null || v === "" || (allowed as readonly string[]).includes(v);
}

/**
 * True when a color/gradient string is safe to inline into a React `style` prop.
 * Allowlist: hex, rgb(a)/hsl(a)/oklch/oklab functions, and *-gradient(...).
 * Denylist blocks CSS-injection primitives (url(), expression, <, ;, {}) that
 * could exfiltrate data or break out of the value even though React blocks
 * script execution. Empty/null is allowed (callers default it).
 */
export function okColor(v: string | null | undefined): boolean {
  if (v == null || v === "") return true;
  if (v.length > LIMITS.COLOR) return false;
  const s = v.toLowerCase();
  if (/[<>;{}]|url\(|expression|javascript:|@import|image-set/.test(s)) return false;
  return /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab)\([\d%.,\s/-]+\)|(linear|radial|conic)-gradient\([\da-z%.,\s()/-]+\))$/.test(
    s,
  );
}
