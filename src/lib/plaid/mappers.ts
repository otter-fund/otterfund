// Pure mappings from Plaid shapes onto otterfund's domain. Server-only.

import { AccountType } from "plaid";
import { CATEGORY_ICON_MAP } from "@/lib/ai/categorize";

/**
 * Guess a loan/mortgage type from an account's name, for accounts Plaid didn't
 * classify (type "other"). Mortgage wins over the generic "loan" so a "Home
 * Mortgage Loan" reads as a mortgage. Returns null when nothing matches.
 */
function inferLoanTypeFromName(name?: string | null): "mortgage" | "loan" | null {
  const n = (name || "").toLowerCase();
  if (/\bmortgage\b/.test(n)) return "mortgage";
  if (/\bloan\b/.test(n)) return "loan";
  return null;
}

/**
 * Map a Plaid account type/subtype onto otterfund's account-type string
 * (lowercase-hyphenated, matching what the manual Add-account form stores).
 * Trusts Plaid's own classification first; only when Plaid leaves the type
 * unknown ("other") do we fall back to inferring loan/mortgage from the name.
 */
export function mapPlaidAccountType(
  type: string,
  subtype: string | null,
  name?: string | null
): string {
  const sub = (subtype || "").toLowerCase();
  if (sub === "tfsa" || sub === "rrsp" || sub === "fhsa") return sub;

  switch (type) {
    case AccountType.Depository:
      return sub === "savings" ? "savings" : "chequing";
    case AccountType.Credit:
      return "credit-card";
    case AccountType.Investment:
    case AccountType.Brokerage:
      return "investment";
    case AccountType.Loan:
      // Plaid reports mortgages (and home-equity loans) as a loan subtype; keep
      // them distinct so both land in the "Loans & mortgages" section.
      return sub === "mortgage" || sub === "home equity" ? "mortgage" : "loan";
    case AccountType.Other:
    default:
      // Plaid didn't tell us it's a loan/mortgage — infer from the name.
      return inferLoanTypeFromName(name) ?? "other";
  }
}

/** True for otterfund account types that represent debt (balance shown as negative). */
export function isDebtOtterfundType(type: string): boolean {
  return type === "credit-card" || type === "loan" || type === "mortgage";
}

// Plaid personal_finance_category.primary → otterfund category name.
const PFC_TO_otterfund: Record<string, string> = {
  INCOME: "Income",
  ENTERTAINMENT: "Entertainment",
  TRANSPORTATION: "Transport",
  TRAVEL: "Transport",
  MEDICAL: "Health",
  PERSONAL_CARE: "Health",
  LOAN_PAYMENTS: "Bills",
  BANK_FEES: "Bills",
  GOVERNMENT_AND_NON_PROFIT: "Bills",
  HOME_IMPROVEMENT: "Housing",
};

/**
 * Map Plaid's personal-finance category onto otterfund's fixed category set.
 * Uses the `detailed` code to split the two ambiguous primaries
 * (food → groceries vs dining; rent/utilities → housing vs bills).
 */
export function plaidCategoryToOtterfund(primary?: string, detailed?: string): string {
  const p = (primary || "").toUpperCase();
  const d = (detailed || "").toUpperCase();
  if (p === "FOOD_AND_DRINK") return d.includes("GROCERIES") ? "Groceries" : "Dining Out";
  if (p === "RENT_AND_UTILITIES") return d.includes("RENT") ? "Housing" : "Bills";
  return PFC_TO_otterfund[p] || "Other";
}

/** Icon + display color for a otterfund category (reuses the import pipeline's map). */
export function iconColorFor(category: string): { icon: string; color: string } {
  return CATEGORY_ICON_MAP[category] || CATEGORY_ICON_MAP.Other;
}
