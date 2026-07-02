import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Wordmark } from "@/components/bulga/logo";

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-bk-canvas)] text-[var(--color-bk-ink)]">
      <div className="w-full max-w-xl mx-auto">
        <div className="flex flex-col items-center gap-3 text-center mb-10">
          <Wordmark size={30} />
          <p className="text-[var(--color-bk-muted)] text-[13px]">
            Let&apos;s set up your budget
          </p>
        </div>
        <OnboardingWizard userName={profile?.name ?? ""} />
      </div>
    </div>
  );
}
