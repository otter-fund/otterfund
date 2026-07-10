"use client";

// otterfund — pricing page.
//
// Three tiers in the brand's banknote language: warm surface cards, Newsreader
// figures, one evergreen accent, and the deep guilloché panel for the closing
// CTA. A Monthly / Yearly toggle re-prices the paid tiers (yearly shows the
// per-month equivalent + the amount billed once a year, with the saving). Pro
// is the featured tier — accent ring, "Most popular" pill, filled CTA.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";

import { CardLabel } from "@/components/otterfund/card";
import { GuillocheFlow } from "@/components/otterfund/guilloche-flow";
import { LogoMark } from "@/components/otterfund/logo";
import { Wordmark } from "@/components/otterfund/wordmark";
import { BRAND_THEME, SCHEMES } from "@/components/otterfund/theme";
import { PANEL_ACCENT, PANEL_BG, PANEL_INK, PANEL_LINE, PANEL_LINE_DEEP } from "@/components/otterfund/brand-panel";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SERIF: React.CSSProperties = { fontFamily: "var(--font-num), Georgia, serif" };
const T = BRAND_THEME;

type BillingPeriod = "monthly" | "yearly";

interface Feature {
  text: string;
  included: boolean;
  /** Renders bold — the "Everything in X" lead-in row. */
  lead?: boolean;
}

interface Tier {
  id: string;
  name: string;
  tagline: string;
  /** Price per month, billed monthly. */
  monthly: number;
  /** Total price billed once per year (0 for Free). */
  yearly: number;
  cta: string;
  href: string;
  featured?: boolean;
  features: Feature[];
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Everything you need to start budgeting.",
    monthly: 0,
    yearly: 0,
    cta: "Start for free",
    href: "/register",
    features: [
      { text: "Unlimited manual accounts", included: true },
      { text: "Needs / Wants / Savings budget", included: true },
      { text: "Goals & savings allocation", included: true },
      { text: "Spending breakdown", included: true },
      { text: "Automatic bank sync", included: false },
      { text: "AI advisor chats", included: false },
      { text: "Investments tab", included: false },
    ],
  },
  {
    id: "standard",
    name: "Standard",
    tagline: "Automatic bank sync and an AI advisor.",
    monthly: 15,
    yearly: 120,
    cta: "Choose Standard",
    href: "/register?plan=standard",
    features: [
      { text: "Everything in Free", included: true, lead: true },
      { text: "Connect up to 3 bank accounts", included: true },
      { text: "150 AI advisor chats / month", included: true },
      { text: "Automatic transaction categorization", included: true },
      { text: "Investments tab", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "The full picture, investments and all.",
    monthly: 20,
    yearly: 150,
    cta: "Choose Pro",
    href: "/register?plan=pro",
    featured: true,
    features: [
      { text: "Everything in Standard", included: true, lead: true },
      { text: "Connect up to 10 bank accounts", included: true },
      { text: "600 AI advisor chats / month", included: true },
      { text: "Investments tab", included: true },
      { text: "Priority support", included: true },
    ],
  },
];

/** "$10" or "$12.50" — drop the cents when it's a round dollar. */
function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

/** Yearly discount as a whole percent vs. paying monthly for 12 months. */
function savingsPct(t: Tier): number {
  if (!t.monthly) return 0;
  return Math.round((1 - t.yearly / (t.monthly * 12)) * 100);
}

function PriceBlock({ tier, period }: { tier: Tier; period: BillingPeriod }) {
  // Free is always $0. Paid tiers show the per-month figure; yearly divides the
  // annual price by 12 so both periods read as "/month".
  const perMonth = tier.monthly === 0 ? 0 : period === "yearly" ? tier.yearly / 12 : tier.monthly;

  return (
    <div>
      <div className="flex items-end gap-1.5">
        <span className="of-num text-[44px] leading-none tracking-[-0.03em]" style={{ fontWeight: 500 }}>
          {money(perMonth)}
        </span>
        <span className="mb-1.5 text-[14px] font-medium text-[var(--color-of-muted)]">
          {tier.monthly === 0 ? "forever" : "/ month"}
        </span>
      </div>

      {/* Sub-line: annual billing note or the yearly-saving nudge. */}
      <div className="mt-2 h-4 text-[12.5px] font-medium">
        {tier.monthly === 0 ? (
          <span className="text-[var(--color-of-faint)]">No credit card required</span>
        ) : period === "yearly" ? (
          <span className="text-[var(--color-of-muted)]">
            {money(tier.yearly)} billed yearly ·{" "}
            <span style={{ color: T.accentDeep }}>save {savingsPct(tier)}%</span>
          </span>
        ) : (
          <span className="text-[var(--color-of-faint)]">
            or {money(tier.yearly)}/yr, save {savingsPct(tier)}%
          </span>
        )}
      </div>
    </div>
  );
}

function TierCard({ tier, period }: { tier: Tier; period: BillingPeriod }) {
  const featured = !!tier.featured;
  return (
    <div
      className="relative flex flex-col rounded-[24px] p-7 sm:p-8"
      style={{
        background: "var(--color-of-surface)",
        border: featured ? `1.5px solid ${T.accent}` : "1px solid var(--color-of-line)",
        boxShadow: featured ? "0 24px 60px oklch(20% 0.04 160 / 0.16)" : "0 8px 24px oklch(20% 0.02 80 / 0.05)",
      }}
    >
      {featured && (
        <span
          className="of-num absolute -top-3 left-7 rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.02em]"
          style={{ background: T.accent, color: "#fff" }}
        >
          Most popular
        </span>
      )}

      <div className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--color-of-ink)]">{tier.name}</div>
      <p className="mt-1 min-h-[40px] max-w-[240px] text-[13px] leading-relaxed text-[var(--color-of-muted)]">
        {tier.tagline}
      </p>

      <div className="mt-5">
        <PriceBlock tier={tier} period={period} />
      </div>

      <Link
        href={tier.href}
        className={cn(
          buttonVariants({ variant: featured ? "default" : "outline", size: "lg" }),
          "mt-7 w-full font-semibold"
        )}
      >
        {tier.cta}
        {featured && <ArrowRight className="h-4 w-4" />}
      </Link>

      <ul className="mt-7 flex flex-col gap-3.5 border-t border-[var(--color-of-line-soft)] pt-7">
        {tier.features.map((f) => (
          <li key={f.text} className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
              style={
                f.included
                  ? { background: T.accentTint, color: T.accentDeep }
                  : { background: "oklch(96% 0.004 85)", color: "var(--color-of-faint)" }
              }
            >
              {f.included ? <Check className="h-3 w-3" strokeWidth={2.6} /> : <Minus className="h-3 w-3" strokeWidth={2.4} />}
            </span>
            <span
              className={cn(
                "text-[13.5px] leading-snug",
                f.included ? "text-[var(--color-of-ink)]" : "text-[var(--color-of-faint)]",
                f.lead && "font-semibold"
              )}
            >
              {f.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PricingView() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <div className="of-paper min-h-screen bg-[var(--color-of-canvas)] text-[var(--color-of-ink)] overflow-x-hidden">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-[var(--color-of-line-soft)] bg-[var(--color-of-canvas)]/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-7 py-4">
          <Link href="/" aria-label="otterfund home" className="inline-flex items-center">
            <LogoMark size={52} />
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "h-auto px-4 py-2 text-[13px]")}>
              Sign in
            </Link>
            <Link href="/register" className={cn(buttonVariants({ variant: "default" }), "h-auto px-4 py-2 text-[13px]")}>
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto flex w-full max-w-[1120px] flex-col items-center px-7 pb-24">
        {/* ── Header ── */}
        <section className="relative w-full pt-16 pb-6 text-center sm:pt-24">
          <div className="of-lp-guilloche pointer-events-none absolute -inset-x-10 -top-10 bottom-0" aria-hidden>
            <GuillocheFlow accent={T.accent} accentDeep={T.accentDeep} fade="radial" opacity={0.06} speed={2} />
          </div>
          <div className="relative">
            <CardLabel className="justify-center">Pricing</CardLabel>
            <h1
              className="of-enter mx-auto mt-3 max-w-2xl text-[clamp(34px,5vw,56px)] leading-[1.05] tracking-[-0.03em] text-balance"
              style={{ ...SERIF, fontWeight: 500 }}
            >
              Simple pricing,{" "}
              <em className="text-[var(--color-primary)]" style={{ fontStyle: "italic" }}>
                for every stage.
              </em>
            </h1>
            <p className="of-enter mx-auto mt-4 max-w-md text-[16px] leading-relaxed text-[var(--color-of-muted)]">
              Start free. Upgrade when you want bank sync, an AI advisor, and your investments in one place.
            </p>

            {/* Monthly / Yearly toggle */}
            <div className="mt-8 flex justify-center">
              <div className="inline-flex items-center rounded-full border border-[var(--color-of-line)] bg-[var(--color-of-surface)] p-1">
                {(["monthly", "yearly"] as const).map((p) => {
                  const on = period === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      aria-pressed={on}
                      className="rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors"
                      style={on ? { background: T.accent, color: "#fff" } : { color: "var(--color-of-muted)" }}
                    >
                      {p === "monthly" ? "Monthly" : "Yearly"}
                      {p === "yearly" && (
                        <span
                          className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold"
                          style={on ? { background: "oklch(100% 0 0 / 0.22)", color: "#fff" } : { background: T.accentTint, color: T.accentDeep }}
                        >
                          Save up to 38%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Tier cards ── */}
        <section className="mt-10 grid w-full max-w-[1000px] gap-5 md:grid-cols-3 md:items-start">
          {TIERS.map((tier) => (
            <TierCard key={tier.id} tier={tier} period={period} />
          ))}
        </section>

        {/* ── Trust line ── */}
        <p className="mt-10 text-center text-[12.5px] font-medium text-[var(--color-of-faint)]">
          All plans include bank-grade encryption. Cancel anytime.
        </p>
      </main>

      {/* ── Closing CTA — the deep evergreen brand panel ── */}
      <section className="relative overflow-hidden px-7 py-20 sm:py-24" style={{ background: PANEL_BG }}>
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <GuillocheFlow accent={PANEL_LINE} accentDeep={PANEL_LINE_DEEP} opacity={0.12} fade="none" speed={4} />
        </div>
        <div className="relative mx-auto max-w-[1120px] text-center">
          <div className="flex items-center justify-center gap-2.5" aria-hidden>
            {SCHEMES.map((s) => (
              <span key={s.name} className="h-2.5 w-2.5 rounded-full" style={{ background: s.value }} />
            ))}
          </div>
          <h2
            className="mx-auto mt-7 max-w-3xl text-[clamp(30px,5vw,52px)] leading-[1.06] tracking-[-0.03em] text-balance"
            style={{ ...SERIF, fontWeight: 500, color: PANEL_INK }}
          >
            Start free today,{" "}
            <em style={{ fontStyle: "italic", color: PANEL_ACCENT }}>upgrade whenever.</em>
          </h2>
          <div className="mt-9 flex justify-center">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "h-14 px-8 text-[16px] font-semibold bg-[oklch(97%_0.014_95)] text-[oklch(26%_0.055_155)]"
              )}
            >
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--color-of-line-soft)] bg-[var(--color-of-canvas)] py-7">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-4 px-7 sm:flex-row">
          <div className="flex items-center gap-2 text-[12px] text-[var(--color-of-muted)]">
            <LogoMark size={16} />
            <Wordmark />
          </div>
          <nav className="flex items-center gap-5 text-[12px]" aria-label="Footer">
            <Link href="/" className="text-[var(--color-of-muted)] transition-colors hover:text-[var(--color-of-ink)]">
              Home
            </Link>
            <Link href="/login" className="text-[var(--color-of-muted)] transition-colors hover:text-[var(--color-of-ink)]">
              Sign in
            </Link>
          </nav>
          <div className="flex items-center gap-2" aria-hidden>
            {SCHEMES.map((s) => (
              <span key={s.name} title={s.name} className="h-2.5 w-2.5 rounded-full" style={{ background: s.value }} />
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
