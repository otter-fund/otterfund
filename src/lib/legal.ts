// Shared constants for the Privacy Policy and Terms of Service. Client-safe.
//
// ⚠️ Before launch, confirm the three bracketed fields below with counsel:
// the registered legal entity, its mailing address, and the governing-law
// jurisdiction. Everything else is drawn from how the app actually works.

export const LEGAL = {
  /** Product / service name used throughout the documents. */
  service: "otterfund",
  /** Registered operating entity. TODO: set to your incorporated name. */
  entity: "otterfund",
  site: "https://otterfund.ai",
  /** Human-readable effective date, shown at the top of each document. */
  lastUpdated: "July 9, 2026",
  /** Governing law for the Terms. TODO: confirm your jurisdiction. */
  governingLaw: "the Province of Ontario, Canada",
  courts: "the courts located in Toronto, Ontario, Canada",
  /** Registered mailing address. TODO: set your business address. */
  address: "[Registered business address]",
  privacyEmail: "privacy@otterfund.ai",
  legalEmail: "legal@otterfund.ai",
  supportEmail: "support@otterfund.ai",
  /** Minimum age to use the service (financial product → age of majority). */
  minAge: 18,
} as const;

/** Third parties that process user data on otterfund's behalf ("subprocessors"),
    rendered as a table in the Privacy Policy. Kept accurate to the codebase. */
export interface Subprocessor {
  name: string;
  purpose: string;
  data: string;
  location: string;
  policy?: string;
}

export const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Supabase",
    purpose: "Authentication and primary database hosting",
    data: "Account credentials, profile, and all app data",
    location: "United States / Canada (AWS)",
    policy: "https://supabase.com/privacy",
  },
  {
    name: "Plaid",
    purpose: "Secure bank and financial-account connections",
    data: "Bank login (handled by Plaid, not stored by us), account balances, and transactions",
    location: "United States",
    policy: "https://plaid.com/legal/#end-user-privacy-policy",
  },
  {
    name: "Anthropic (Claude)",
    purpose: "AI advisor, statement parsing, categorization, and insights",
    data: "Financial data, transaction details, uploaded statements, and chat messages you submit",
    location: "United States",
    policy: "https://www.anthropic.com/legal/privacy",
  },
  {
    name: "Stripe",
    purpose: "Payment and subscription processing (when you subscribe to a paid plan)",
    data: "Billing details and payment-card information (processed by Stripe; card numbers are not stored by us)",
    location: "United States",
    policy: "https://stripe.com/privacy",
  },
  {
    name: "Twelve Data",
    purpose: "Market quotes and security search for investment tracking",
    data: "Ticker symbols and security names (no personal information)",
    location: "United States",
    policy: "https://twelvedata.com/privacy",
  },
  {
    name: "Google (favicon service)",
    purpose: "Displaying merchant and brand logos next to transactions",
    data: "Merchant website domains (no personal information)",
    location: "United States",
    policy: "https://policies.google.com/privacy",
  },
];
