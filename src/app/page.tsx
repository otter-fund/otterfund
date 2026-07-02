import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { ArrowRight, ListChecks, Wallet, Target, Sparkles } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/bulga/logo";
import { GuillocheFlow } from "@/components/bulga/guilloche-flow";
import { BRAND_THEME } from "@/components/bulga/theme";

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

  const features = [
    { icon: Wallet, title: "Everything in one place", desc: "Accounts, cards, and investments — one calm balance." },
    { icon: ListChecks, title: "Spending, made plain", desc: "See where every dollar went without the spreadsheet." },
    { icon: Target, title: "Goals with intent", desc: "Save toward what matters and watch it get closer." },
    { icon: Sparkles, title: "Insights that help", desc: "Quiet nudges from your own numbers — never lectures." },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bk-canvas)] text-[var(--color-bk-ink)]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-7 py-6 shrink-0 max-w-[1100px] mx-auto w-full">
        <Wordmark size={30} />
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-[13px] font-semibold text-[var(--color-bk-muted)] px-4 py-2 rounded-full hover:text-[var(--color-bk-ink)] transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-[13px] font-semibold text-white bg-[var(--color-primary)] px-5 py-2 rounded-full hover:brightness-[1.06] transition-[filter]"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-7 pb-24 text-center">
        <div className="relative max-w-2xl py-10">
          {/* Gentle drifting banknote line-work behind the headline — freezes
              under prefers-reduced-motion. */}
          <GuillocheFlow
            accent={BRAND_THEME.accent}
            accentDeep={BRAND_THEME.accentDeep}
            fade="radial"
            opacity={0.12}
          />
          <h1
            className="relative text-[clamp(40px,6vw,64px)] tracking-[-0.03em] leading-[1.05] text-balance mb-5"
            style={{ fontFamily: "var(--font-num), Georgia, serif", fontWeight: 500 }}
          >
            Your money,
            <br />
            <span className="text-[var(--color-primary)]">in balance.</span>
          </h1>
          <p className="relative text-[17px] text-[var(--color-bk-muted)] leading-relaxed max-w-md mx-auto mb-9">
            Calm, confident budgeting that does the math so you don&apos;t have
            to. Import statements, track spending, reach your goals.
          </p>
          <div className="relative flex items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[var(--color-primary)] px-6 py-3 rounded-full hover:brightness-[1.06] transition-[filter] shadow-[0_1px_2px_oklch(40%_0.1_158/0.3)]"
            >
              Start for free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-bk-ink)] border border-[var(--color-bk-line)] px-6 py-3 rounded-full hover:bg-[var(--color-bk-surface)] transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-20 max-w-4xl w-full">
          {features.map((f) => (
            <div
              key={f.title}
              className="border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] rounded-[20px] p-6 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_oklch(20%_0.02_80/0.08)]"
            >
              <div className="w-9 h-9 rounded-[11px] bg-[var(--accent)] flex items-center justify-center mb-4">
                <f.icon className="w-[18px] h-[18px] text-[var(--color-primary)]" strokeWidth={1.9} />
              </div>
              <div className="text-[14px] font-semibold text-[var(--color-bk-ink)] mb-1.5">
                {f.title}
              </div>
              <div className="text-[12.5px] text-[var(--color-bk-muted)] leading-relaxed">
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center gap-2 py-6 text-[12px] text-[var(--color-bk-faint)]">
        <LogoMark size={16} />
        Bulga — personal budgeting, in balance.
      </footer>
    </div>
  );
}
