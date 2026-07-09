import type { Metadata } from "next";
import { PricingView } from "@/components/landing/pricing-view";

export const metadata: Metadata = {
  title: "Pricing · otterfund",
  description: "Simple pricing for every stage. Start free; upgrade for bank sync, an AI advisor, and investments.",
};

export default function PricingPage() {
  return <PricingView />;
}
