// Dashboard period (month/year) — the single source of truth for the browsable
// range and how a ?month=&year= pair is validated. Client-safe (no server-only
// imports) so the chrome, the month picker, AND the server pages all share ONE
// definition instead of hand-syncing the bounds in three places.

/** Browsable year range, shared by the picker UI and the validators. */
export const PERIOD_MIN_YEAR = 2000;
export const PERIOD_MAX_YEAR_AHEAD = 5;

export interface Period {
  month: number; // 1-indexed
  year: number;
}

/**
 * Resolve a period from raw ?month=&year= values against a fallback (today).
 * Both must be present and sane (month 1–12, year within range) or we fall back
 * wholesale to `today` — never mix a valid month with a bogus year. Accepts the
 * string|null from URLSearchParams.get and the string|undefined from a page's
 * searchParams prop alike.
 */
export function resolvePeriod(
  raw: { month?: string | null; year?: string | null },
  today: Period
): Period {
  const month = Number(raw.month);
  const year = Number(raw.year);
  const validMonth = Number.isInteger(month) && month >= 1 && month <= 12;
  const validYear =
    Number.isInteger(year) && year >= PERIOD_MIN_YEAR && year <= today.year + PERIOD_MAX_YEAR_AHEAD;
  return validMonth && validYear ? { month, year } : today;
}
