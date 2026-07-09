const LOCALE_MAP: Record<string, string> = {
  CAD: "en-CA",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
};

export const fmt = (n: number, currency = "CAD") =>
  new Intl.NumberFormat(LOCALE_MAP[currency] || "en-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Math.abs(n));

// Whole-dollar variant for round figures where cents are noise ("$6,450").
export const fmtWhole = (n: number, currency = "CAD") =>
  new Intl.NumberFormat(LOCALE_MAP[currency] || "en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.abs(n));

export const fmtShort = (n: number) =>
  "$" + (Math.abs(n) / 1000).toFixed(1) + "K";
