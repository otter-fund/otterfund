// Central SEO source of truth — client-safe (pure data + builders, no server
// imports). Everything that touches search visibility flows through here:
//   · canonical site URL + brand facts (incl. search-variant alt names)
//   · the keyword sets we want to rank for
//   · the shared FAQ (rendered on the landing page AND emitted as FAQPage JSON-LD)
//   · JSON-LD builders for Organization / WebSite / SoftwareApplication / FAQ / Offers
//
// The product name in visible copy is always "otterfund" (one word — see
// AGENTS.md). The "otter fund" / "OtterFund" / "otterfund AI" spellings people
// actually type into a search box are captured as `alternateName`s + keywords,
// never in body copy, so we rank for every variant without breaking the brand.

/** Canonical origin, override per-env with NEXT_PUBLIC_SITE_URL. No trailing slash. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://otterfund.ai"
).replace(/\/+$/, "");

export const SITE_NAME = "otterfund";
export const SITE_TAGLINE = "Your money, in balance";

/** How people spell/search the name — fed to JSON-LD alternateName + keywords. */
export const BRAND_ALT_NAMES = [
  "Otter Fund",
  "OtterFund",
  "otterfund AI",
  "Otter Fund AI",
  "otter fund app",
  "otterfund budgeting app",
];

/** One-liner used as the default meta description across the site. */
export const SITE_DESCRIPTION =
  "otterfund is a free AI budgeting app that splits every dollar across Needs, Wants, and Savings, tracks your spending automatically, and funds your savings goals. Personal budgeting, money management, and financial planning made calm and simple.";

/** Absolute URL helper for canonicals, sitemap, JSON-LD. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

// ── Keyword sets ─────────────────────────────────────────────────────────────
// Grouped by intent so pages can compose the mix they want. Broad but honest —
// every term describes something otterfund actually does.

export const KEYWORDS = {
  brand: [
    "otterfund",
    "otter fund",
    "otterfund app",
    "otter fund app",
    "otterfund ai",
    "otter fund budgeting",
    "otterfund budget app",
  ],
  budgeting: [
    "budgeting app",
    "budget app",
    "budgeting tool",
    "best budgeting app",
    "free budgeting app",
    "online budgeting",
    "personal budgeting software",
    "monthly budget planner",
    "budget tracker",
    "budget calculator",
    "budgeting app for couples",
    "simple budgeting app",
    "household budget app",
  ],
  saving: [
    "how to save money",
    "save money app",
    "money saving app",
    "savings goals app",
    "how to save more money each month",
    "automatic savings",
    "emergency fund calculator",
    "savings tracker",
  ],
  allocating: [
    "how to allocate money",
    "how to allocate my income",
    "50/30/20 budget",
    "50 30 20 rule",
    "needs wants savings",
    "income allocation",
    "how to split your paycheck",
    "70/20/10 budget",
    "zero based budgeting alternative",
  ],
  ai: [
    "ai budgeting app",
    "ai financial advisor",
    "ai money management",
    "ai personal finance",
    "ai budget planner",
    "ai savings assistant",
  ],
  finance: [
    "personal finance app",
    "money management app",
    "net worth tracker",
    "expense tracker",
    "spending tracker",
    "financial planning app",
    "bank account aggregator",
    "investment tracker",
  ],
} as const;

/** The full de-duplicated keyword list (site-wide default). */
export const ALL_KEYWORDS: string[] = Array.from(
  new Set(Object.values(KEYWORDS).flat())
);

// ── Shared FAQ ───────────────────────────────────────────────────────────────
// One source rendered two ways: a visible on-brand FAQ section on the landing
// page (real, useful content — the kind Google rewards) and the FAQPage JSON-LD
// that can earn rich-result accordions in search. Answers are keyword-aware but
// written to genuinely help.

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "What is otterfund?",
    a: "otterfund is a free budgeting app that gives you one calm, confident picture of your money. It splits every dollar of income across Needs, Wants, and Savings, sorts your spending into clean categories automatically, and funds your savings goals by priority, with an AI advisor that turns your own numbers into plain-language insights.",
  },
  {
    q: "How do I start budgeting with otterfund?",
    a: "Connect your bank securely through Plaid or import a statement, pick a budgeting method like the 50/30/20 rule, and otterfund does the math. Your accounts, transactions, and net worth stay up to date automatically, so building a monthly budget takes minutes instead of a spreadsheet weekend.",
  },
  {
    q: "How do I save money every month?",
    a: "otterfund routes a set share of every paycheck into your Savings bucket, then splits it across your goals by priority: an emergency fund, a trip, a down payment. Because saving happens automatically before you spend, you save consistently each month without having to think about it.",
  },
  {
    q: "How do I allocate my money across needs, wants, and savings?",
    a: "The simplest way to allocate income is a proven rule. otterfund supports the 50/30/20 rule (50% needs, 30% wants, 20% savings), 70/20/10 for high fixed costs like rent, 60/20/20 for steady savers, and an aggressive 50/20/30 split. Pick one and otterfund tracks how each month lands against it.",
  },
  {
    q: "Is otterfund free?",
    a: "Yes. otterfund is free to get started with no credit card required: unlimited manual accounts and the full Needs / Wants / Savings budget. Paid plans add automatic bank sync, the AI financial advisor, and investment tracking when you want them.",
  },
  {
    q: "Does otterfund use AI?",
    a: "Yes. otterfund's AI advisor reads your own spending and savings patterns and offers quiet, plain-language nudges, never lectures. It helps you see where your money goes, spot wins worth keeping, and stay on track toward your goals.",
  },
  {
    q: "Is my financial data secure?",
    a: "Yes. otterfund uses bank-grade 256-bit encryption, connects to your bank through Plaid (the same secure network trusted by major finance apps), and encrypts your access tokens at rest. Your data is private by default and never sold.",
  },
  {
    q: "What budgeting methods does otterfund support?",
    a: "otterfund supports popular budgeting frameworks including the 50/30/20 rule, 70/20/10, 60/20/20, and an aggressive saver split, all built on the Needs, Wants, and Savings model so you can find the plan that fits your income.",
  },
];

// ── JSON-LD builders ─────────────────────────────────────────────────────────
// Plain objects; render with <JsonLd data={...} />. Kept as builders so the
// canonical URL and brand facts stay in one place.

const LOGO_URL = absoluteUrl("/otterfund-logo.png");

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: BRAND_ALT_NAMES,
    url: SITE_URL,
    logo: LOGO_URL,
    description: SITE_DESCRIPTION,
    slogan: SITE_TAGLINE,
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: BRAND_ALT_NAMES,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "en",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

/** The app itself, described as a finance application — the entity behind
    "budgeting app" / "AI budgeting app" searches. */
export function softwareApplicationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#app`,
    name: SITE_NAME,
    alternateName: BRAND_ALT_NAMES,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "FinanceApplication",
    applicationSubCategory: "Budgeting",
    operatingSystem: "Web, iOS, Android",
    browserRequirements: "Requires JavaScript. Works in any modern browser.",
    featureList: [
      "Needs / Wants / Savings budgeting (50/30/20 and more)",
      "Automatic bank sync via Plaid",
      "AI financial advisor and insights",
      "Savings goals funded by priority",
      "Net worth and investment tracking",
      "Spending categorized automatically",
    ],
    keywords: ALL_KEYWORDS.join(", "),
    publisher: { "@id": `${SITE_URL}/#organization` },
    offers: pricingOffersLd(),
  };
}

/** Offer list mirroring the pricing tiers (kept in sync with pricing-view). */
export function pricingOffersLd() {
  return [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD", description: "Everything you need to start budgeting." },
    { "@type": "Offer", name: "Standard", price: "15", priceCurrency: "USD", description: "Automatic bank sync and an AI advisor." },
    { "@type": "Offer", name: "Pro", price: "20", priceCurrency: "USD", description: "The full picture: investments and all." },
  ];
}

export function faqLd(items: FaqItem[] = FAQ_ITEMS) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
