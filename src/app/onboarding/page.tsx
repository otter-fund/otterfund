import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  // getClaims() verifies the JWT locally (asymmetric ES256 keys) — no network
  // round-trip to the Auth server, unlike getUser().
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const profile = await prisma.user.findUnique({
    where: { id: data.claims.sub },
    select: { name: true, onboardingDone: true },
  });
  if (profile?.onboardingDone) redirect("/dashboard");

  // The wizard renders the full split-screen shell (brand panel + form column).
  return (
    <div className="text-[var(--color-bk-ink)]">
      <OnboardingWizard userName={profile?.name ?? ""} />
    </div>
  );
}
