"use client";

// otterfund — pricing page.
//
// Three tiers in the brand's banknote language: warm surface cards, Newsreader
// figures, one evergreen accent, and the deep guilloché panel for the closing
// CTA. A Monthly / Yearly toggle re-prices the paid tiers (yearly shows the
// per-month equivalent + the amount billed once a year, with the saving). Pro
// is the featured tier — accent ring, "Most popular" pill, filled CTA.

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";

import { gqlClient, errMessage } from "@/lib/graphql/client";
import { tierRank, type PlanTier } from "@/lib/plans";
import { CardLabel } from "@/components/otterfund/card";
import { GuillocheFlow } from "@/components/otterfund/guilloche-flow";
import { LogoMark } from "@/components/otterfund/logo";
import { Wordmark } from "@/components/otterfund/wordmark";
import { BRAND_THEME, SCHEMES } from "@/components/otterfund/theme";
// The otter poking over the top of the featured card — pre-tinted coral to
// match the brand mark (see otter-poking.png).
import otterPoking from "@/components/otterfund/otter-poking.png";
import { PANEL_ACCENT, PANEL_BG, PANEL_INK, PANEL_LINE, PANEL_LINE_DEEP } from "@/components/otterfund/brand-panel";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SERIF: React.CSSProperties = { fontFamily: "var(--font-num), Georgia, serif" };
const T = BRAND_THEME;

const CREATE_CHECKOUT = /* GraphQL */ `
  mutation CreateCheckout($tier: String!, $interval: String) {
    createCheckoutSession(tier: $tier, interval: $interval)
  }
`;
const CREATE_PORTAL = /* GraphQL */ `
  mutation CreatePortal {
    createBillingPortalSession
  }
`;

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
      { text: "Unlimited manual transactions", included: true },
      { text: "Goals & savings allocation", included: true },
      { text: "Spending breakdown", included: true },
      { text: "Automatic bank sync", included: false },
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
    featured: true,
    features: [
      { text: "Everything in Free", included: true, lead: true },
      { text: "Connect up to 3 bank accounts", included: true },
      { text: "Access AI chats & insights", included: true },
      { text: "Automatic transaction categorization", included: true },
      { text: "Track investments across accounts", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "The full picture, investments and all.",
    monthly: 20,
    yearly: 144,
    cta: "Choose Pro",
    href: "/register?plan=pro",
    features: [
      { text: "Everything in Standard", included: true, lead: true },
      { text: "Connect up to 10 bank accounts", included: true },
      { text: "Unlimited AI chats & insights", included: true },
      { text: "Real-time investment tracking", included: true },
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

// How fast the count runs and how much the digits smear while they spin.
const ROLL_DUR = 520; // ms — quick, slot-machine snappy
const ROLL_MAX_BLUR = 2; // px of vertical smear right after a digit flips
const ROLL_BLUR_TAIL = 90; // ms a digit keeps smearing after it last flipped

/** The price figure as an animated count. When Monthly/Yearly toggles, the number
    tweens from its previous value to the new one with an eased ramp — the same
    count-up used on the auth panel's net-worth figure — while each digit smears
    vertically as it flips, so it reads like a slot-machine reel spinning to a
    stop. The blur is per-digit and driven by how recently that digit last
    changed: a fast-cycling digit (the units) stays smeared until it lands, while
    a digit that flips just once (the tens "2"→"1" in 20 → 12) gets a single quick
    smear rather than blurring the whole roll. The "$" never smears. Whole-dollar
    prices count in whole dollars. Honors prefers-reduced-motion (instant swap). */
function RollingPrice({
  amount,
  className,
  style,
}: {
  amount: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const whole = Number.isInteger(amount);
  const fmt = (v: number) => money(whole ? Math.round(v) : Math.round(v * 100) / 100);

  const [display, setDisplay] = useState(amount);
  // Per-character blur in px, aligned to the formatted string.
  const [blurs, setBlurs] = useState<number[]>([]);
  const target = useRef(amount);
  const cur = useRef(amount);
  const raf = useRef(0);
  const prevChars = useRef<string[]>([]);
  const lastFlip = useRef<number[]>([]); // timestamp each position last changed
  // Unique, selector-safe id so each card's reels get their own blur filters.
  const filterId = "of-roll-" + useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    if (amount === target.current) return;
    target.current = amount;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cur.current = amount;
      setDisplay(amount);
      setBlurs([]);
      return;
    }
    const start = cur.current;
    const end = amount;
    prevChars.current = fmt(start).split("");
    lastFlip.current = prevChars.current.map(() => -Infinity);
    const t0 = performance.now();
    cancelAnimationFrame(raf.current);
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ROLL_DUR);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = start + (end - start) * eased;
      cur.current = v;
      setDisplay(v);
      if (p >= 1) {
        setBlurs([]); // land crisp
        return;
      }
      // A digit smears for ROLL_BLUR_TAIL ms after it last flipped, fading out —
      // so a reel that keeps ticking stays blurred and one that flips once pulses
      // briefly. The "$" (and any non-digit) never smears.
      const s = fmt(v).split("");
      const nb = s.map((ch, i) => {
        if (ch !== prevChars.current[i]) lastFlip.current[i] = t;
        if (ch < "0" || ch > "9") return 0;
        const since = t - (lastFlip.current[i] ?? -Infinity);
        return since >= ROLL_BLUR_TAIL ? 0 : ROLL_MAX_BLUR * (1 - since / ROLL_BLUR_TAIL);
      });
      prevChars.current = s;
      setBlurs(nb);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // Only react to an incoming `amount`; `fmt` is derived from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  const chars = fmt(display).split("");
  return (
    <span className={className} style={style}>
      <svg width="0" height="0" aria-hidden className="absolute">
        {/* One vertical-only blur filter per character, driven by that digit's
            current smear. The reel spins up/down; horizontal stays sharp. */}
        {chars.map((_, i) => (
          <filter key={i} id={`${filterId}-${i}`} x="-20%" y="-70%" width="140%" height="240%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={`0 ${(blurs[i] ?? 0).toFixed(2)}`} />
          </filter>
        ))}
      </svg>
      {chars.map((ch, i) => {
        const doBlur = (blurs[i] ?? 0) > 0.05;
        return (
          <span
            key={i}
            style={{
              filter: doBlur ? `url(#${filterId}-${i})` : undefined,
              willChange: doBlur ? "filter" : undefined,
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}

function PriceBlock({ tier, period }: { tier: Tier; period: BillingPeriod }) {
  // Free is always $0. Paid tiers show the per-month figure; yearly divides the
  // annual price by 12 so both periods read as "/month".
  const perMonth = tier.monthly === 0 ? 0 : period === "yearly" ? tier.yearly / 12 : tier.monthly;

  return (
    <div>
      <div className="flex items-end gap-1.5">
        <RollingPrice
          amount={perMonth}
          className="of-num text-[44px] leading-none tracking-[-0.03em]"
          style={{ fontWeight: 500 }}
        />
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
              {money(perMonth)}/month billed yearly ·{" "}
            <span style={{ color: T.accentDeep }}>save {savingsPct(tier)}%</span>
          </span>
        ) : (
          <span className="text-[var(--color-of-faint)]">
                Switch to yearly to save {savingsPct(tier)}%
          </span>
        )}
      </div>
    </div>
  );
}

// "Money stroke" hues for the corner etch — the Canadian banknote palette:
// Free = $5 blue, Standard = $20 green (the brand hue), Pro = coral (the mark).
// Hex (not oklch) so they embed cleanly in the SVG hatch tile. The two shades
// tint the two diagonals of the cross-hatch.
const TIER_STROKES: Record<string, [string, string]> = {
  free: ["#1f74bf", "#0059a7"],
  standard: ["#007e4b", "#006130"],
  pro: ["#e55647", "#c44134"],
};

// Reveal the etch only around the border — denser blocks in the four corners,
// joined by a fine line along each edge — so the middle stays white, like the
// engraved frame of a banknote. Multiple mask layers union (mask-composite: add).
const ETCH_MASK = [
  "radial-gradient(130px 110px at 0% 0%, #000, transparent 66%)",
  "radial-gradient(130px 110px at 100% 0%, #000, transparent 66%)",
  "radial-gradient(130px 110px at 0% 100%, #000, transparent 66%)",
  "radial-gradient(130px 110px at 100% 100%, #000, transparent 66%)",
  "linear-gradient(to bottom, #000, transparent 7%)",
  "linear-gradient(to top, #000, transparent 7%)",
  "linear-gradient(to right, #000, transparent 5%)",
  "linear-gradient(to left, #000, transparent 5%)",
].join(", ");

// The tier's call-to-action. Logged out → a link to sign up (carrying the plan
// + interval). Logged in → a live billing action: start Checkout for a first
// paid plan, or open the Stripe portal to switch/downgrade an existing one. The
// user's current tier reads as a non-interactive "Current plan".
function TierCta({
  tier,
  period,
  featured,
  authed,
  currentPlan,
  busy,
  onCheckout,
  onPortal,
}: {
  tier: Tier;
  period: BillingPeriod;
  featured: boolean;
  authed: boolean;
  currentPlan: PlanTier;
  busy: boolean;
  onCheckout: (tier: string, period: BillingPeriod) => void;
  onPortal: () => void;
}) {
  const cls = (variant: "default" | "outline") =>
    cn(buttonVariants({ variant, size: "lg" }), "mt-7 w-full font-semibold");

  // Logged out — keep the crawlable sign-up link, carrying the chosen interval.
  if (!authed) {
    const href =
      tier.id === "free"
        ? tier.href
        : `/register?plan=${tier.id}&interval=${period === "yearly" ? "year" : "month"}`;
    return (
      <Link href={href} className={cls(featured ? "default" : "outline")}>
        {tier.cta}
        {featured && <ArrowRight className="h-4 w-4" />}
      </Link>
    );
  }

  const isCurrent = currentPlan === tier.id;
  if (isCurrent) {
    // Free has no subscription to manage — it reads as a static marker. A paid
    // current plan links into the Stripe portal to manage or cancel.
    if (tier.id === "free") {
      return (
        <button type="button" disabled className={cn(cls("outline"), "cursor-default opacity-70")}>
          <Check className="h-4 w-4" strokeWidth={2.6} />
          Current plan
        </button>
      );
    }
    return (
      <button type="button" onClick={onPortal} disabled={busy} className={cls("outline")}>
        {busy ? "Opening…" : "Manage plan"}
      </button>
    );
  }

  // Free card while on a paid plan → downgrade happens in the Stripe portal.
  if (tier.id === "free") {
    return (
      <button type="button" onClick={onPortal} disabled={busy} className={cls("outline")}>
        {busy ? "Opening…" : "Downgrade"}
      </button>
    );
  }

  // Paid card that isn't the current plan. First paid plan from Free → Checkout;
  // changing an existing paid plan → the portal. Higher tier reads "Upgrade",
  // a lower paid tier "Downgrade".
  const changingExisting = currentPlan !== "free";
  const label = tierRank(tier.id) > tierRank(currentPlan) ? "Upgrade" : "Downgrade";
  return (
    <button
      type="button"
      onClick={() => (changingExisting ? onPortal() : onCheckout(tier.id, period))}
      disabled={busy}
      className={cls(featured ? "default" : "outline")}
    >
      {busy ? "Starting…" : label}
      {featured && !busy && <ArrowRight className="h-4 w-4" />}
    </button>
  );
}

function TierCard({
  tier,
  period,
  authed,
  currentPlan,
  busy,
  onCheckout,
  onPortal,
}: {
  tier: Tier;
  period: BillingPeriod;
  authed: boolean;
  currentPlan: PlanTier;
  busy: boolean;
  onCheckout: (tier: string, period: BillingPeriod) => void;
  onPortal: () => void;
}) {
  const featured = !!tier.featured;
  const [strokeLine, strokeDeep] = TIER_STROKES[tier.id] ?? TIER_STROKES.standard;
  // A tiny tile of two dashed diagonals → a cross-hatch of short strokes (not
  // long continuous lines) when tiled. The dash pattern keeps each mark tiny.
  const etchTile = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><g stroke-width='0.7' stroke-linecap='round'><line x1='0' y1='0' x2='12' y2='12' stroke='${strokeLine}' stroke-dasharray='1.6 2.8'/><line x1='12' y1='0' x2='0' y2='12' stroke='${strokeDeep}' stroke-dasharray='1.6 2.8'/></g></svg>`,
  )}`;
  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-[24px] p-7 sm:p-8",
        // The featured tier sits slightly larger and lifted toward the viewer.
        featured && "md:z-10 md:scale-[1.045] md:-translate-y-1",
      )}
      style={{
        // Layered surface for depth: a soft top sheen over the paper, plus (on the
        // featured tier) a faint accent glow bleeding in from the top-right corner.
        background: featured
          ? `radial-gradient(135% 90% at 88% -14%, ${T.accentTint} 0%, transparent 52%), linear-gradient(180deg, oklch(100% 0 0 / 0.55), oklch(100% 0 0 / 0) 42%), var(--color-of-surface)`
          : "linear-gradient(180deg, oklch(100% 0 0 / 0.5), oklch(100% 0 0 / 0) 40%), var(--color-of-surface)",
        border: featured ? `1.5px solid ${T.accent}` : "1px solid var(--color-of-line)",
        // Inset top highlight (a lit top edge) + a crisp near shadow + a soft far
        // shadow: the card reads as a raised sheet rather than a flat rectangle.
        boxShadow: featured
          ? "inset 0 1px 0 oklch(100% 0 0 / 0.9), 0 0 0 1px oklch(66% 0.17 29 / 0.12), 0 6px 34px oklch(66% 0.17 29 / 0.16), 0 30px 70px oklch(20% 0.04 160 / 0.16)"
          : "inset 0 1px 0 oklch(100% 0 0 / 0.8), 0 1px 3px oklch(20% 0.02 80 / 0.05), 0 14px 34px oklch(20% 0.02 80 / 0.07)",
      }}
    >
      {/* "Money strokes" — a fine engraved cross-hatch (like a banknote's etched
          border) worked into the corners and joined by a hairline along each
          edge, tinted per tier (Free blue, Standard green, Pro coral). The middle
          stays white. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-30"
        style={{
          maskImage: ETCH_MASK,
          WebkitMaskImage: ETCH_MASK,
          backgroundImage: `url("${etchTile}")`,
          backgroundSize: "9px 9px",
          backgroundRepeat: "repeat",
        }}
      />

      {featured && (
        <>
          {/* The otter pokes over the top edge, both paws gripping the card. Sits
              on top (z-10) so nothing clips it; purely decorative. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={otterPoking.src}
            alt=""
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 z-10 w-[210px] max-w-none -translate-x-1/2 -translate-y-[80%]"
            style={{ filter: "drop-shadow(0 8px 10px oklch(20% 0.04 160 / 0.14))" }}
          />
          {/* "Most popular" — tucked into the top-right, just under the corner and
              clear of the otter's paw. */}
          <span
            className="absolute right-4 top-4 z-20 rounded-full px-2.5 py-[5px] text-[10px] font-semibold uppercase tracking-[0.07em]"
            style={{ background: T.accent, color: "#fff", boxShadow: "0 3px 8px oklch(20% 0.04 160 / 0.2)" }}
          >
            Most popular
          </span>
        </>
      )}

      <div className="relative z-[1] flex flex-col">

      <div className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--color-of-ink)]">{tier.name}</div>
      <p className="mt-1 min-h-[40px] max-w-[240px] text-[13px] leading-relaxed text-[var(--color-of-muted)]">
        {tier.tagline}
      </p>

      <div className="mt-5">
        <PriceBlock tier={tier} period={period} />
      </div>

      <TierCta
        tier={tier}
        period={period}
        featured={featured}
        authed={authed}
        currentPlan={currentPlan}
        busy={busy}
        onCheckout={onCheckout}
        onPortal={onPortal}
      />

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
    </div>
  );
}

export function PricingView({
  authed = false,
  currentPlan = "free",
}: {
  authed?: boolean;
  currentPlan?: PlanTier;
} = {}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // Start a Stripe Checkout Session for a first paid plan and redirect to it.
  const handleCheckout = (tierId: string, p: BillingPeriod) => {
    setError("");
    startTransition(async () => {
      try {
        const res = await gqlClient.request<{ createCheckoutSession: string }>(CREATE_CHECKOUT, {
          tier: tierId,
          interval: p === "yearly" ? "year" : "month",
        });
        window.location.href = res.createCheckoutSession;
      } catch (e) {
        setError(errMessage(e));
      }
    });
  };

  // Open the Stripe billing portal to change or cancel an existing plan.
  const handlePortal = () => {
    setError("");
    startTransition(async () => {
      try {
        const res = await gqlClient.request<{ createBillingPortalSession: string }>(CREATE_PORTAL);
        window.location.href = res.createBillingPortalSession;
      } catch (e) {
        setError(errMessage(e));
      }
    });
  };

  return (
    <div className="of-paper min-h-screen bg-[var(--color-of-canvas)] text-[var(--color-of-ink)] overflow-x-hidden">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-[var(--color-of-line-soft)] bg-[var(--color-of-canvas)]/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-7 py-4">
          <Link href="/" aria-label="otterfund home" className="inline-flex items-center">
            <LogoMark size={52} />
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {authed ? (
              <Link href="/dashboard" className={cn(buttonVariants({ variant: "default" }), "h-auto px-4 py-2 text-[13px]")}>
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "h-auto px-4 py-2 text-[13px]")}>
                  Sign in
                </Link>
                <Link href="/register" className={cn(buttonVariants({ variant: "default" }), "h-auto px-4 py-2 text-[13px]")}>
                  Sign up
                </Link>
              </>
            )}
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
                          Save up to 40%
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
        {/* Extra top margin so the otter poking over the featured card clears the
            Monthly / Yearly toggle above it. */}
        <section className="relative mt-24 flex w-full justify-center">
          {/* Backdrop that fills the plain canvas around the cards: a faint, wide
              guilloché field in the side gutters, fading before it reaches the
              cards (which sit opaque on top). */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[150%] w-screen max-w-none -translate-x-1/2 -translate-y-1/2"
          >
            <GuillocheFlow accent={T.accent} accentDeep={T.accentDeep} opacity={0.07} fade="left" speed={2} gap={20} amp={10} />
            <GuillocheFlow accent={T.accent} accentDeep={T.accentDeep} opacity={0.07} fade="right" speed={2} gap={20} amp={10} />
          </div>

          <div className="relative grid w-full max-w-[1000px] gap-5 md:grid-cols-3 md:items-start">
            {TIERS.map((tier) => (
              <TierCard
                key={tier.id}
                tier={tier}
                period={period}
                authed={authed}
                currentPlan={currentPlan}
                busy={isPending}
                onCheckout={handleCheckout}
                onPortal={handlePortal}
              />
            ))}
          </div>
        </section>

        {error && (
          <p className="mt-6 text-center text-[13px] font-medium text-[var(--color-of-clay)]">{error}</p>
        )}

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
