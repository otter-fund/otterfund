// otterfund — plans & entitlements.
//
// ONE source of truth for what each paid tier unlocks, shared by the server
// (GraphQL resolvers + the Stripe webhook) and the client (paywall modal,
// locked-feature panels, plan labels). Client-safe: NO server-only imports —
// this file is pulled into client components. Stripe Price IDs are NOT here;
// they live in env and are mapped in lib/stripe/config.ts (server-only).

export const PLAN_TIERS = ["free", "standard", "pro"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

/** Gated capabilities. A resolver/UI asks `canUse(plan, feature)`. */
export type Feature = "bank_sync" | "insights" | "advisor" | "investments" | "messaging";

export interface PlanEntitlements {
  /** Max connected bank (Plaid) accounts. 0 = bank sync entirely locked. */
  bankAccounts: number;
  /** AI advisor chat. */
  advisor: boolean;
  /** AI insights generation. */
  insights: boolean;
  /** Investments tab. */
  investments: boolean;
  /** Text the AI advisor from Telegram / WhatsApp (Settings → Connections). The
      chat itself reuses the advisor, so `advisor` must also be true wherever this
      is; the monthly message cap (aiMonthlyMessages) applies to texted turns too. */
  messaging: boolean;
  /** Durable per-user monthly advisor-message cap (one per answered question).
      0 when advisor is locked, `null` when unlimited (Pro). Per-minute/hour rate
      limits still apply as abuse protection regardless. Resets at the start of
      each calendar month. */
  aiMonthlyMessages: number | null;
  /** Durable per-user monthly cap on AI insight *generations* (each generation
      is a fresh batch of insight cards). 0 when insights are locked, `null` when
      unlimited (Pro). Resets at the start of each calendar month. */
  insightsPerMonth: number | null;
}

// Entitlement matrix — mirrors the /pricing table. Insights + advisor unlock at
// Standard; investments are Pro-only.
export const PLAN_ENTITLEMENTS: Record<PlanTier, PlanEntitlements> = {
  free: {
    bankAccounts: 0,
    advisor: false,
    insights: false,
    investments: false,
    messaging: false,
    aiMonthlyMessages: 0,
    insightsPerMonth: 0,
  },
  standard: {
    bankAccounts: 3,
    advisor: true,
    insights: true,
    investments: false,
    messaging: false,
    aiMonthlyMessages: 20,
    insightsPerMonth: 10,
  },
  pro: {
    bankAccounts: 10,
    advisor: true,
    insights: true,
    investments: true,
    messaging: true,
    aiMonthlyMessages: null, // "Unlimited AI chats & insights" — no monthly cap
    insightsPerMonth: null, // unlimited
  },
};

/** Display metadata for the paywall modal + plan labels (kept in sync with the
    pricing page). */
export const PLAN_META: Record<PlanTier, { name: string; label: string }> = {
  free: { name: "Free", label: "Free plan" },
  standard: { name: "Standard", label: "Standard plan" },
  pro: { name: "Pro", label: "Pro plan" },
};

/** The lowest tier that grants a feature — what a paywall should point users to. */
export const FEATURE_REQUIRED_TIER: Record<Feature, PlanTier> = {
  bank_sync: "standard",
  insights: "standard",
  advisor: "standard",
  investments: "pro",
  messaging: "pro",
};

/** Marketing copy for each gated feature, shown across the upsell surfaces.
 *
 * Two registers, used by the two-step paywall (see paywall-modal):
 *  · `outcome` — the FUTURE the user gets ("never type a transaction again").
 *    Sells the result, not the mechanism. Shown on the paywall's first page,
 *    before any price, and on the full-page LockedFeature.
 *  · `title`/`blurb`/`perks` — the concrete feature + what's included. Shown on
 *    the paywall's offer page and in the Settings connections upsell. */
export const FEATURE_COPY: Record<
  Feature,
  {
    title: string;
    blurb: string;
    perks: string[];
    outcome: { headline: string; sub: string; bullets: string[] };
  }
> = {
  bank_sync: {
    title: "Connect your bank",
    blurb: "Sync transactions and balances automatically. No more manual entry.",
    perks: [
      "Connect up to 3 bank accounts",
      "Automatic transaction categorization",
      "Always-current balances",
    ],
    outcome: {
      headline: "Never type a transaction again",
      sub: "Link your bank once and your accounts keep themselves up to date. Spend your time deciding, not data-entering.",
      bullets: [
        "Every transaction sorted for you, automatically",
        "Balances that always show today, not last week",
        "Set it once and otterfund keeps up on its own",
      ],
    },
  },
  insights: {
    title: "AI insights",
    blurb: "Let otterfund surface where your money's going and how to save more.",
    perks: ["Access AI chats & insights", "Savings opportunities", "Refreshed daily"],
    outcome: {
      headline: "Know exactly where your money goes",
      sub: "otterfund reads your own spending and hands you plain-language wins. No spreadsheets, no guessing.",
      bullets: [
        "Spot what's quietly eating your budget",
        "Savings opportunities picked from your data",
        "A fresh read whenever you want one",
      ],
    },
  },
  advisor: {
    title: "AI financial advisor",
    blurb: "Ask questions about your finances and get answers grounded in your data.",
    perks: ["Access AI chats & insights", "Grounded in your accounts", "Saved conversations"],
    outcome: {
      headline: "A money expert in your corner",
      sub: "Ask anything about your finances and get straight answers grounded in your actual numbers.",
      bullets: [
        "Answers built from your real accounts",
        "Judgment-free, whenever it suits you",
        "Every conversation saved to pick back up",
      ],
    },
  },
  investments: {
    title: "Investments",
    blurb: "Track your holdings and see your full net worth in one place.",
    perks: ["Real-time investment tracking", "Full net worth in one place", "Priority support"],
    outcome: {
      headline: "Your whole net worth, one number",
      sub: "Track every holding beside your cash and goals. The full picture, finally in one place.",
      bullets: [
        "Every holding tracked, live",
        "True net worth at a single glance",
        "Priority support when you need it",
      ],
    },
  },
  messaging: {
    title: "Text your advisor",
    blurb: "Ask about your money from Telegram or WhatsApp and get answers back on your phone.",
    perks: ["Chat from Telegram or WhatsApp", "Answers grounded in your accounts", "No app needed to check in"],
    outcome: {
      headline: "Your money advisor, one text away",
      sub: "Ask what you can cut or where your money went straight from your phone, and get a real answer back in seconds.",
      bullets: [
        "Text a question, get a grounded reply",
        "Works from Telegram or WhatsApp",
        "Every answer built from your real numbers",
      ],
    },
  },
};

export function isPlanTier(v: unknown): v is PlanTier {
  return typeof v === "string" && (PLAN_TIERS as readonly string[]).includes(v);
}

/** Normalize any stored/incoming value to a valid tier (defaults to free). */
export function toPlanTier(v: unknown): PlanTier {
  return isPlanTier(v) ? v : "free";
}

export function entitlementsFor(plan: PlanTier | string | null | undefined): PlanEntitlements {
  return PLAN_ENTITLEMENTS[toPlanTier(plan)];
}

/** 0 = free, 1 = standard, 2 = pro. For "is at least" comparisons. */
export function tierRank(plan: PlanTier | string | null | undefined): number {
  return PLAN_TIERS.indexOf(toPlanTier(plan));
}

/** Whether a plan grants a boolean feature (bank_sync = has >0 account allowance). */
export function canUse(plan: PlanTier | string | null | undefined, feature: Feature): boolean {
  const e = entitlementsFor(plan);
  switch (feature) {
    case "bank_sync":
      return e.bankAccounts > 0;
    case "insights":
      return e.insights;
    case "advisor":
      return e.advisor;
    case "investments":
      return e.investments;
    case "messaging":
      return e.messaging;
  }
}
