"use client";

// Bulga — landing page.
//
// The pre-auth pitch, in the brand's banknote language and now sharing the
// app's split-screen vocabulary: engraved guilloché line-work, Newsreader
// figures, one evergreen accent, and the same deep-evergreen "brand panel"
// field that carries sign-in / sign-up / onboarding. The page reads like the
// product it sells — a live dashboard note counts up and draws its own
// sparkline, a deep showpiece band renders the real Needs/Wants/Savings donut,
// and the actual budget plans are shown as pickable cards. Every motion degrades
// to a calm static layout under prefers-reduced-motion (CSS in globals.css,
// sections "bk-enter" / "Landing").

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ListChecks,
  PieChart,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Wallet,
} from "lucide-react";

import { Card, CardLabel } from "@/components/bulga/card";
import { GuillocheSeal } from "@/components/bulga/guilloche";
import { GuillocheFlow } from "@/components/bulga/guilloche-flow";
import { DonutChart } from "@/components/bulga/donut-chart";
import { LogoMark } from "@/components/bulga/logo";
import { BRAND_THEME, SCHEMES, hueOf } from "@/components/bulga/theme";
import {
  PANEL_ACCENT,
  PANEL_BG,
  PANEL_INK,
  PANEL_LINE,
  PANEL_LINE_DEEP,
  PANEL_MUTED,
} from "@/components/bulga/brand-panel";
import { BUDGET_PLANS, getBudgetPlan } from "@/lib/constants";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";

const SERIF: React.CSSProperties = { fontFamily: "var(--font-num), Georgia, serif" };

const CTA_PRIMARY =
  "bk-lp-cta inline-flex items-center gap-2 text-sm font-semibold text-white bg-[var(--color-primary)] px-6 py-3 rounded-full hover:brightness-[1.06] transition-[filter] shadow-[0_1px_2px_oklch(40%_0.1_158/0.3)]";

// ── in-view + reveal helpers ────────────────────────────────────────────────

function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Reveal({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  return (
    <div
      ref={ref}
      data-in={inView ? "" : undefined}
      className={cn("bk-reveal", className)}
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/** True once the page has scrolled past `y` — drives the nav's blur/hairline. */
function useScrolled(y = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > y);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [y]);
  return scrolled;
}

/** Eased count-up toward `target` once `run` flips true; jumps straight to the
    final figure under reduced motion. */
function useCountUp(target: number, run: boolean, duration = 1600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf: number;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, duration]);
  return value;
}

// ── dashboard preview data (illustrative, mirrors the real Overview) ────────

const SP_W = 560;
const SP_H = 120;
const TREND = [18.2, 18.9, 18.4, 19.6, 20.3, 19.9, 21.2, 22.1, 21.8, 22.9, 23.6, 24.18];

const SPARK = (() => {
  const mn = Math.min(...TREND);
  const mx = Math.max(...TREND);
  const rg = mx - mn || 1;
  const pts = TREND.map(
    (d, i) =>
      [
        (i / (TREND.length - 1)) * SP_W,
        SP_H - 8 - ((d - mn) / rg) * (SP_H - 24),
      ] as const
  );
  const line = "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L");
  const [lx, ly] = pts[pts.length - 1];
  return { line, area: `${line}L${SP_W} ${SP_H}L0 ${SP_H}Z`, lx, ly };
})();

const FEATURES = [
  { icon: Wallet, title: "Everything in one place", desc: "Accounts, cards, and investments — one calm balance." },
  { icon: ListChecks, title: "Spending, made plain", desc: "See where every dollar went without the spreadsheet." },
  { icon: Target, title: "Goals with intent", desc: "Save toward what matters and watch it get closer." },
  { icon: Sparkles, title: "Insights that help", desc: "Quiet nudges from your own numbers — never lectures." },
];

const TRUST = [
  { icon: Upload, title: "Import in seconds", desc: "Drop in a CSV — Bulga sorts the rest." },
  { icon: PieChart, title: "Split every dollar", desc: "Needs, wants, savings — a plan that fits." },
  { icon: ShieldCheck, title: "Private by default", desc: "Your numbers stay yours. Always." },
];

// ── budget-plan showpiece figures ───────────────────────────────────────────
// A sample income makes the plan's split tangible in the deep band; the numbers
// derive from the real BUDGET_PLANS percentages, exactly as the Spending page
// computes them.
const SHOWCASE_INCOME = 6450;
const SHOWCASE_PLAN = getBudgetPlan("50-30-20");

// Three cohesive light shades of the evergreen hue for the dark banknote field.
const PANEL_BUCKET: Record<"needs" | "wants" | "savings", string> = {
  needs: "oklch(66% 0.12 158)",
  wants: "oklch(80% 0.11 158)",
  savings: "oklch(91% 0.06 158)",
};

// Three shades of the active brand hue for the light plan cards (mirrors the
// Spending page's bucketColor map).
const LIGHT_BUCKET: Record<"needs" | "wants" | "savings", string> = {
  needs: BRAND_THEME.accentDeep,
  wants: BRAND_THEME.accent,
  savings: `oklch(78% 0.07 ${hueOf(BRAND_THEME.accent)})`,
};

// ── pieces ──────────────────────────────────────────────────────────────────

/** The showpiece — a live-feeling slice of the real Overview page: counting
    net-worth figure, self-drawing sparkline, this-month stat tiles. */
function DashboardPreview() {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);
  const netWorth = useCountUp(24180.62, inView);
  const income = useCountUp(6450, inView, 1200);
  const spending = useCountUp(4012.55, inView, 1350);
  const leftover = useCountUp(2437.45, inView, 1500);
  return (
    <div ref={ref} data-in={inView ? "" : undefined} className="w-full">
      <Card className="relative overflow-hidden p-6 sm:p-8 text-left shadow-[0_24px_60px_oklch(20%_0.02_80/0.10)]">
        <div className="flex items-start justify-between mb-1">
          <CardLabel>Net worth</CardLabel>
          <div className="w-11 h-11 -mt-1 opacity-80">
            {/* The brand kit's "Verified seal" geometry (13/4/4). */}
            <GuillocheSeal accent={BRAND_THEME.accent} accentDeep={BRAND_THEME.accentDeep} petals={13} inner={4} pen={4} label="$" />
          </div>
        </div>

        <div
          className="bk-num text-[clamp(36px,4.6vw,50px)] tracking-[-0.03em] leading-none"
          style={{ fontWeight: 500 }}
        >
          {fmt(netWorth)}
        </div>
        <div
          className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-[12.5px] font-semibold"
          style={{ background: BRAND_THEME.accentTint, color: BRAND_THEME.accentDeep }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
          <span className="bk-num">+{fmt(1240.18)}</span>
          <span>this month</span>
        </div>

        <div className="relative mt-6">
          <svg
            viewBox={`0 0 ${SP_W} ${SP_H}`}
            preserveAspectRatio="none"
            className="w-full h-[104px]"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="lp-nw-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND_THEME.accent} stopOpacity="0.16" />
                <stop offset="100%" stopColor={BRAND_THEME.accent} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path className="bk-lp-area" d={SPARK.area} fill="url(#lp-nw-grad)" />
            <path
              className="bk-lp-line"
              d={SPARK.line}
              pathLength={1}
              fill="none"
              stroke={BRAND_THEME.accent}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {/* End dot + pulse live outside the SVG: preserveAspectRatio="none"
              stretches it horizontally, which would turn circles into ellipses.
              HTML circles stay round. */}
          <span
            className="absolute w-0 h-0"
            style={{ left: `${(SPARK.lx / SP_W) * 100}%`, top: `${(SPARK.ly / SP_H) * 100}%` }}
            aria-hidden
          >
            <span
              className="bk-lp-pulse absolute block w-7 h-7 -left-3.5 -top-3.5 rounded-full"
              style={{ border: `1.5px solid ${BRAND_THEME.accent}` }}
            />
            <span
              className="bk-lp-dot absolute block w-[11px] h-[11px] -left-[5.5px] -top-[5.5px] rounded-full border-2 border-white"
              style={{ background: BRAND_THEME.accent }}
            />
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          <div className="rounded-2xl border border-[var(--color-bk-line-soft)] px-5 py-4">
            <div className="text-[12px] font-medium text-[var(--color-bk-muted)]">Income</div>
            <div className="bk-num text-[22px] tracking-[-0.02em] mt-1" style={{ color: BRAND_THEME.accentDeep }}>
              {fmt(income)}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-bk-line-soft)] px-5 py-4">
            <div className="text-[12px] font-medium text-[var(--color-bk-muted)]">Spending</div>
            <div className="bk-num text-[22px] tracking-[-0.02em] mt-1">{fmt(spending)}</div>
          </div>
          <div className="rounded-2xl px-5 py-4 text-white" style={{ background: BRAND_THEME.accent }}>
            <div className="text-[12px] font-medium opacity-85">Left over</div>
            <div className="bk-num text-[22px] tracking-[-0.02em] mt-1">+{fmt(leftover)}</div>
          </div>
        </div>

        <span className="absolute bottom-3 right-5 text-[9.5px] font-semibold tracking-[0.14em] uppercase text-[var(--color-bk-faint)] opacity-70 select-none">
          Series 2026
        </span>
      </Card>
    </div>
  );
}

/** A stacked Needs/Wants/Savings split bar — the plan's three shares in one
    horizontal ribbon. Colors come from the caller so it works on light and dark. */
function SplitBar({
  plan,
  colors,
  track,
}: {
  plan: (typeof BUDGET_PLANS)[number];
  colors: Record<"needs" | "wants" | "savings", string>;
  track?: string;
}) {
  const parts: ["needs" | "wants" | "savings", number][] = [
    ["needs", plan.needs],
    ["wants", plan.wants],
    ["savings", plan.savings],
  ];
  return (
    <div
      className="flex h-2.5 w-full overflow-hidden rounded-full"
      style={{ background: track ?? "var(--color-bk-track)" }}
      aria-hidden
    >
      {parts.map(([k, pct]) => (
        <span key={k} style={{ width: `${pct}%`, background: colors[k] }} />
      ))}
    </div>
  );
}

/** The deep-evergreen showpiece band — mirrors the auth/onboarding brand panel
    and renders the app's real Needs/Wants/Savings donut against a sample income,
    so the landing shows the exact surface a new user lands on. */
function PlanShowpiece() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const buckets = (["needs", "wants", "savings"] as const).map((key) => ({
    key,
    label: key[0].toUpperCase() + key.slice(1),
    pct: SHOWCASE_PLAN[key],
    amount: (SHOWCASE_PLAN[key] / 100) * SHOWCASE_INCOME,
  }));
  const segments = buckets.map((b) => ({ value: b.pct, color: PANEL_BUCKET[b.key] }));

  return (
    <div
      ref={ref}
      data-in={inView ? "" : undefined}
      className="relative overflow-hidden rounded-[28px] p-8 sm:p-12"
      style={{ background: PANEL_BG }}
    >
      <GuillocheFlow accent={PANEL_LINE} accentDeep={PANEL_LINE_DEEP} opacity={0.14} fade="none" speed={4} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 8% 0%, oklch(96% 0.05 158 / 0.12) 0%, transparent 55%)",
        }}
      />

      <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_auto] lg:gap-16">
        {/* pitch + buckets */}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: PANEL_ACCENT,
            }}
          >
            A plan for every dollar
          </div>
          <h2
            className="mt-4 mb-3 text-balance"
            style={{
              ...SERIF,
              fontWeight: 500,
              fontSize: "clamp(28px, 3.4vw, 40px)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: PANEL_INK,
            }}
          >
            Split your income the{" "}
            <em style={{ fontStyle: "italic", color: PANEL_ACCENT }}>way that fits.</em>
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed" style={{ color: PANEL_MUTED }}>
            Bulga divides what you earn into Needs, Wants, and Savings, then tracks how the
            month actually lands against your plan — no spreadsheet required.
          </p>

          <div className="mt-8 grid gap-4 max-w-md">
            {buckets.map((b) => (
              <div key={b.key} className="flex items-center gap-4">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: PANEL_BUCKET[b.key] }}
                  aria-hidden
                />
                <span className="text-[14px] font-medium" style={{ color: PANEL_INK }}>
                  {b.label}
                </span>
                <span className="bk-num text-[13px]" style={{ color: PANEL_MUTED }}>
                  {b.pct}%
                </span>
                <span className="bk-num ml-auto text-[15px] font-medium" style={{ color: PANEL_INK }}>
                  {fmt(b.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* the real donut, drawn against a sample income */}
        <div className="flex flex-col items-center gap-4 lg:pr-4">
          <DonutChart segments={segments} size={208} stroke={30} trackColor="oklch(100% 0 0 / 0.08)">
            <span
              style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: PANEL_MUTED }}
            >
              Monthly income
            </span>
            <span className="bk-num" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", color: PANEL_INK }}>
              {fmt(SHOWCASE_INCOME)}
            </span>
          </DonutChart>
          <span
            className="rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{ background: "oklch(90% 0.09 158 / 0.14)", color: PANEL_ACCENT }}
          >
            {SHOWCASE_PLAN.name}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── the page ────────────────────────────────────────────────────────────────

export function LandingView() {
  const scrolled = useScrolled();

  return (
    <div className="bk-paper min-h-screen flex flex-col bg-[var(--color-bk-canvas)] text-[var(--color-bk-ink)] overflow-x-hidden">
      {/* Nav — sticky; gains a hairline + blur once the page scrolls. */}
      <nav
        className={cn(
          "sticky top-0 z-50 transition-colors duration-300",
          scrolled
            ? "border-b border-[var(--color-bk-line-soft)] bg-[var(--color-bk-canvas)]/80 backdrop-blur-md"
            : "border-b border-transparent"
        )}
      >
        <div className="flex items-center justify-between px-7 py-4 max-w-[1120px] mx-auto w-full">
          <Link href="/" aria-label="Bulga home" className="inline-flex items-center">
            <LogoMark size={52} />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-[13px] font-semibold text-[var(--color-bk-muted)] px-4 py-2 rounded-full hover:text-[var(--color-bk-ink)] transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center px-7 pb-28">
        {/* ── Hero ── */}
        <section className="relative w-full max-w-[1120px] pt-14 sm:pt-20">
          {/* Gentle drifting banknote line-work behind the hero — freezes under
              prefers-reduced-motion. */}
          <div className="absolute -inset-x-10 -top-10 bottom-0" aria-hidden>
            <GuillocheFlow
              accent={BRAND_THEME.accent}
              accentDeep={BRAND_THEME.accentDeep}
              fade="radial"
              opacity={0.1}
            />
          </div>

          <div className="relative grid items-center gap-12 lg:grid-cols-[1.02fr_1fr] lg:gap-14">
            {/* pitch */}
            <div className="text-center lg:text-left">
              <h1
                className="bk-enter text-[clamp(40px,5.6vw,66px)] tracking-[-0.03em] leading-[1.03] text-balance mb-5"
                style={{ ...SERIF, fontWeight: 500, animationDelay: "140ms" }}
              >
                Your money,{" "}
                <em className="text-[var(--color-primary)]" style={{ fontStyle: "italic" }}>
                  in balance.
                </em>
              </h1>
              <p
                className="bk-enter text-[17px] text-[var(--color-bk-muted)] leading-relaxed max-w-md mx-auto lg:mx-0 mb-8"
                style={{ animationDelay: "220ms" }}
              >
                Calm, confident budgeting that does the math so you don&apos;t have to.
                Import statements, split every dollar, and reach your goals.
              </p>
              <div
                className="bk-enter flex flex-wrap items-center justify-center lg:justify-start gap-3"
                style={{ animationDelay: "300ms" }}
              >
                <Link href="/login" className={CTA_PRIMARY}>
                  Start saving <ArrowRight className="bk-lp-arrow w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* live preview */}
            <div className="bk-enter" style={{ animationDelay: "420ms" }}>
              <DashboardPreview />
            </div>
          </div>

        </section>

        {/* ── Trust strip — one engraved ledger bar, three divided columns ── */}
        <section className="mt-16 sm:mt-20 max-w-[1120px] w-full">
          <Reveal>
            <Card className="grid grid-cols-1 divide-y divide-[var(--color-bk-line-soft)] overflow-hidden sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {TRUST.map((t) => (
                <div
                  key={t.title}
                  className="group flex items-center gap-4 p-6 transition-colors hover:bg-[var(--color-bk-canvas)]"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] transition-transform duration-200 ease-[cubic-bezier(.22,.61,.36,1)] group-hover:-translate-y-0.5">
                    <t.icon className="h-5 w-5 text-[var(--color-primary)]" strokeWidth={1.9} />
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold text-[var(--color-bk-ink)]">{t.title}</div>
                    <div className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--color-bk-muted)]">{t.desc}</div>
                  </div>
                </div>
              ))}
            </Card>
          </Reveal>
        </section>

        {/* ── Plan showpiece (deep evergreen band) ── */}
        <section className="w-full max-w-[1120px] mt-24">
          <Reveal>
            <PlanShowpiece />
          </Reveal>
        </section>

        {/* ── Features — engraved ledger entries (serif index watermark) ── */}
        <section className="mt-24 max-w-[1120px] w-full">
          <Reveal className="max-w-2xl">
            <CardLabel>Why Bulga</CardLabel>
            <h2
              className="text-[clamp(26px,3.4vw,38px)] tracking-[-0.02em] leading-tight text-balance mt-3"
              style={{ ...SERIF, fontWeight: 500 }}
            >
              Built to make money feel{" "}
              <em className="text-[var(--color-primary)]" style={{ fontStyle: "italic" }}>
                quiet.
              </em>
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-bk-muted)]">
              Four calm ideas that add up to one confident picture of your money.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80} className="h-full">
                <Card
                  hover
                  className="group relative flex h-full min-h-[220px] flex-col overflow-hidden p-6 text-left"
                >
                  {/* engraved index numeral — a banknote/ledger watermark that
                      warms to the accent on hover */}
                  <span
                    aria-hidden
                    className="bk-num pointer-events-none absolute right-3 top-2 select-none text-[76px] leading-none text-[var(--color-bk-line-soft)] transition-colors duration-300 group-hover:text-[var(--accent)]"
                    style={{ fontStyle: "italic" }}
                  >
                    0{i + 1}
                  </span>

                  <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] transition-transform duration-200 ease-[cubic-bezier(.22,.61,.36,1)] group-hover:-translate-y-0.5">
                    <f.icon className="h-5 w-5 text-[var(--color-primary)]" strokeWidth={1.9} />
                  </div>

                  <div className="relative mt-auto pt-10">
                    <div className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-bk-ink)]">{f.title}</div>
                    <div className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-bk-muted)]">{f.desc}</div>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Budget plans (real product data) ── */}
        <section className="mt-24 max-w-[1120px] w-full">
          <Reveal className="max-w-xl">
            <CardLabel>Choose your split</CardLabel>
            <h2
              className="text-[clamp(26px,3.4vw,38px)] tracking-[-0.02em] leading-tight text-balance mt-3 mb-2"
              style={{ ...SERIF, fontWeight: 500 }}
            >
              Pick a plan, or make it{" "}
              <em className="text-[var(--color-primary)]" style={{ fontStyle: "italic" }}>
                your own.
              </em>
            </h2>
            <p className="text-[15px] text-[var(--color-bk-muted)] leading-relaxed">
              Start with a proven rule and adjust anytime. Every plan tracks Needs, Wants, and Savings.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
            {BUDGET_PLANS.map((plan, i) => (
              <Reveal key={plan.id} delay={i * 70} className="h-full">
                <Card
                  hover
                  className={cn(
                    "relative h-full p-6 text-left",
                    plan.recommended && "border-[var(--color-primary)]"
                  )}
                >
                  {plan.recommended && (
                    <span
                      className="absolute -top-2.5 left-6 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold tracking-[0.05em] uppercase text-white"
                      style={{ background: BRAND_THEME.accent }}
                    >
                      Recommended
                    </span>
                  )}
                  <div className="bk-num text-[26px] tracking-[-0.02em]" style={{ color: BRAND_THEME.accentDeep }}>
                    {plan.needs}/{plan.wants}/{plan.savings}
                  </div>
                  <div className="text-[13.5px] font-semibold text-[var(--color-bk-ink)] mt-1">{plan.name}</div>
                  <p className="text-[12px] text-[var(--color-bk-muted)] leading-relaxed mt-2 mb-5 min-h-[48px]">
                    {plan.blurb}
                  </p>
                  <SplitBar plan={plan} colors={LIGHT_BUCKET} />
                  <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--color-bk-faint)]">
                    <span>Needs</span>
                    <span>Wants</span>
                    <span>Savings</span>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Closing band ── */}
        <Reveal className="w-full max-w-[1120px] mt-24">
          <Card className="relative overflow-hidden px-8 py-16 sm:py-20 text-center">
            {/* The brand kit's flowing-lines field — alive, drifting dashes;
                freezes under reduced motion. */}
            <GuillocheFlow
              accent={BRAND_THEME.accent}
              accentDeep={BRAND_THEME.accentDeep}
              fade="radial"
              opacity={0.18}
            />
            {/* Verified-seal stamp (13/4/4, the kit's verification ✓). The
                rosette revolves imperceptibly — engine-turned. */}
            <div className="relative w-[76px] h-[76px] mx-auto mb-7">
              <GuillocheSeal
                accent={BRAND_THEME.accent}
                accentDeep={BRAND_THEME.accentDeep}
                petals={13}
                inner={4}
                pen={4}
                label="✓"
                spin
              />
            </div>
            <h2
              className="relative text-[clamp(28px,4vw,42px)] tracking-[-0.02em] leading-tight text-balance"
              style={{ ...SERIF, fontWeight: 500 }}
            >
              Less spreadsheet,{" "}
              <em className="text-[var(--color-primary)]" style={{ fontStyle: "italic" }}>
                more balance.
              </em>
            </h2>
            <p className="relative text-[15px] text-[var(--color-bk-muted)] max-w-sm mx-auto mt-4 mb-8">
              Bulga does the math quietly in the background — you just live your life.
            </p>
            <div className="relative flex justify-center">
              <Link href="/register" className={CTA_PRIMARY}>
                Start for free <ArrowRight className="bk-lp-arrow w-4 h-4" />
              </Link>
            </div>
          </Card>
        </Reveal>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-bk-line-soft)] py-7">
        <div className="max-w-[1120px] mx-auto px-7 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[12px] text-[var(--color-bk-faint)]">
            <LogoMark size={16} />
            Bulga — personal budgeting, in balance.
          </div>
          {/* The Canadian banknote palette — the brand's colour through-line. */}
          <div className="flex items-center gap-2" aria-hidden>
            {SCHEMES.map((s) => (
              <span
                key={s.name}
                title={s.name}
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: s.value }}
              />
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
