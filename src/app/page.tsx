import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { LandingView } from "@/components/landing/landing-view";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_DESCRIPTION, SITE_NAME, faqLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME}: Free AI Budgeting App`,
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE_NAME}: Free AI Budgeting App`,
    description: SITE_DESCRIPTION,
    url: "/",
  },
};

export default async function LandingPage() {
  const supabase = await createClient();
  // getClaims() verifies the JWT locally (asymmetric ES256 keys) — no network
  // round-trip to the Auth server, unlike getUser().
  const { data } = await supabase.auth.getClaims();

  // If already logged in, go straight to the right place.
  if (data?.claims) {
    const profile = await prisma.user.findUnique({
      where: { id: data.claims.sub },
      select: { onboardingDone: true },
    });
    redirect(profile?.onboardingDone ? "/dashboard" : "/onboarding");
  }

  return (
    <>
      {/* FAQ structured data — mirrors the visible FAQ on the landing page and
          is eligible for rich-result accordions in search. */}
      <JsonLd data={faqLd()} />
      <LandingView />
    </>
  );
}
