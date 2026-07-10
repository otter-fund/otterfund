import type { Metadata } from "next";
import { PricingView } from "@/components/landing/pricing-view";
import { JsonLd } from "@/components/seo/json-ld";
import { KEYWORDS, SITE_NAME, absoluteUrl, pricingOffersLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Pricing: Free & Paid Budgeting Plans",
  description:
    "Simple, honest pricing for every stage. Start budgeting free with no credit card, then upgrade for automatic bank sync, an AI financial advisor, and investment tracking.",
  keywords: [
    "otterfund pricing",
    "budgeting app pricing",
    "free budgeting app",
    "best budgeting app cost",
    ...KEYWORDS.budgeting,
    ...KEYWORDS.ai,
  ],
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: `Pricing · ${SITE_NAME}`,
    description:
      "Start budgeting free. Upgrade for bank sync, an AI advisor, and investments.",
    url: "/pricing",
  },
};

// Product with the three tiers as offers — lets search show price + plan info.
const productLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: `${SITE_NAME} · AI Budgeting App`,
  description:
    "otterfund is a budgeting app that splits your income across Needs, Wants, and Savings, syncs your bank automatically, and funds your savings goals with AI-powered insights.",
  brand: { "@type": "Brand", name: SITE_NAME },
  url: absoluteUrl("/pricing"),
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "0",
    highPrice: "20",
    priceCurrency: "USD",
    offerCount: 3,
    offers: pricingOffersLd(),
  },
};

export default function PricingPage() {
  return (
    <>
      <JsonLd data={productLd} />
      <PricingView />
    </>
  );
}
