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
  Check,
  ChevronLeft,
  ChevronRight,
  Landmark,
  ListChecks,
  Lock,
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
import { ProgressRing } from "@/components/bulga/progress";
import { LogoMark } from "@/components/bulga/logo";
import { BRAND_THEME, SCHEMES, deriveTheme, hueOf, type BulgaTheme } from "@/components/bulga/theme";
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

/** Flips true (once, latched) the moment the referenced element is FULLY within
    the viewport. If the element is taller than the viewport it can never reach
    100%, so we fire when it's as visible as it physically can be (fills the
    viewport). Pins true immediately under reduced motion. */
function useFullyVisible<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        // Max ratio this element can hit: 1 when it fits the viewport, less when
        // it's taller — fire once it reaches (near) that ceiling.
        const h = entry.boundingClientRect.height || 1;
        const maxRatio = Math.min(1, window.innerHeight / h);
        if (entry.intersectionRatio >= maxRatio - 0.01) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 0.9, 0.99, 1] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, shown };
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

// `word` fills the "Built to make money feel ___." headline while the card is
// hovered — each feature names the feeling it delivers ("quiet." is the resting
// word). See <FeaturesSection>.
const FEATURES = [
  { icon: Wallet, title: "Every account, one net worth", desc: "Chequing, savings, credit, and investments add up to a single live balance.", word: "whole." },
  { icon: ListChecks, title: "Spending, made plain", desc: "Every transaction sorted into clean categories, so you see where it all goes.", word: "clear." },
  { icon: Target, title: "Goals that fund themselves", desc: "Your monthly savings split across goals by priority, each with a finish date.", word: "intentional." },
  { icon: Sparkles, title: "Insights, not lectures", desc: "Quiet, AI-written nudges drawn from your own numbers — never judgment.", word: "understood." },
];

const TRUST = [
  { icon: Upload, title: "Import in seconds", desc: "Link a bank with Plaid, or drop a statement — Bulga categorizes it." },
  { icon: PieChart, title: "Split every dollar", desc: "Needs, Wants, and Savings — a plan you can adjust anytime." },
  { icon: ShieldCheck, title: "Private by default", desc: "Bank-grade encryption. Your numbers are never sold." },
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

// ── pieces ──────────────────────────────────────────────────────────────────

/** The showpiece — a live-feeling slice of the real Overview page: counting
    net-worth figure, self-drawing sparkline, this-month stat tiles. */
function DashboardPreview() {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);
  const netWorth = useCountUp(24180.62, inView);
  const income = useCountUp(6450, inView, 1200);
  const spending = useCountUp(4012.55, inView, 1350);
  const leftover = useCountUp(2437.45, inView, 1500);
  // The three this-month tiles carry the banknote palette ($5 blue, $10 purple,
  // $20 green) as a set — so the hero picks up the page's multi-colour system
  // while the net-worth figure and sparkline stay the evergreen anchor.
  const blue = deriveTheme(SCHEMES[0].value);
  const purple = deriveTheme(SCHEMES[1].value);
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
          <div
            className="rounded-2xl border px-5 py-4"
            style={{ background: blue.accentTint, borderColor: blue.accentTintBorder }}
          >
            <div className="text-[12px] font-medium text-[var(--color-bk-muted)]">Income</div>
            <div className="bk-num text-[22px] tracking-[-0.02em] mt-1 whitespace-nowrap" style={{ color: blue.accentDeep }}>
              {fmt(income)}
            </div>
          </div>
          <div
            className="rounded-2xl border px-5 py-4"
            style={{ background: purple.accentTint, borderColor: purple.accentTintBorder }}
          >
            <div className="text-[12px] font-medium text-[var(--color-bk-muted)]">Spending</div>
            <div className="bk-num text-[22px] tracking-[-0.02em] mt-1 whitespace-nowrap" style={{ color: purple.accentDeep }}>
              {fmt(spending)}
            </div>
          </div>
          <div className="rounded-2xl px-5 py-4 text-white" style={{ background: BRAND_THEME.accent }}>
            <div className="text-[12px] font-medium opacity-85">Left over</div>
            <div className="bk-num text-[22px] tracking-[-0.02em] mt-1 whitespace-nowrap">+{fmt(leftover)}</div>
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

// Descriptive titles for the carousel subtitle. The plan `name` in constants is
// the ratio itself for three of the four plans ("70/20/10"), which just repeats
// the big figure above it — so give each a real name here (the ratio already
// shows as the headline + tab). Can't rename in constants: the Spending page
// derives the ratio from `name.split(" ")[0]`.
const PLAN_TITLES: Record<string, string> = {
  "50-30-20": "The Classic",
  "70-20-10": "Renter's Rule",
  "60-20-20": "Steady Saver",
  "50-20-30": "Aggressive Saver",
};

/** The "Choose your split" picker — one card the visitor clicks through instead
    of a static grid. Plan tabs + prev/next step through the four plans; each one
    reveals a touch more than the old cards did: the per-bucket dollar split
    against a sample income. Content fades up on each switch (calms under
    reduced motion via the shared .bk-enter rules). */
function PlanCarousel({
  active,
  setActive,
}: {
  active: number;
  setActive: React.Dispatch<React.SetStateAction<number>>;
}) {
  const count = BUDGET_PLANS.length;
  const plan = BUDGET_PLANS[active];
  const go = (dir: number) => setActive((i) => (i + dir + count) % count);

  // The whole card re-tints to the active plan's Canadian-banknote colour, so
  // stepping through the plans walks the $5→$100 palette. The three buckets are
  // tonal shades of that one note hue (deep / accent / light) — cohesive, not a
  // rainbow.
  const note = SCHEMES[active % SCHEMES.length];
  const noteTheme = deriveTheme(note.value);
  const noteHue = hueOf(note.value);
  const noteBucket: Record<"needs" | "wants" | "savings", string> = {
    needs: noteTheme.accentDeep,
    wants: note.value,
    savings: `oklch(78% 0.07 ${noteHue})`,
  };

  const buckets = (["needs", "wants", "savings"] as const).map((key) => ({
    key,
    label: key[0].toUpperCase() + key.slice(1),
    pct: plan[key],
    amount: (plan[key] / 100) * SHOWCASE_INCOME,
  }));

  return (
    <Card className="relative overflow-hidden p-6 sm:p-8">
      {/* tabs + stepper */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Budget plans"
          className="flex flex-wrap gap-2"
        >
          {BUDGET_PLANS.map((p, i) => {
            const selected = i === active;
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                className={cn(
                  "bk-num rounded-full px-3.5 py-1.5 text-[13px] font-semibold tracking-[-0.01em] transition-colors",
                  selected
                    ? "text-white"
                    : "text-[var(--color-bk-muted)] bg-[var(--color-bk-canvas)] border border-[var(--color-bk-line-soft)] hover:text-[var(--color-bk-ink)]"
                )}
                style={
                  selected
                    ? { background: SCHEMES[i % SCHEMES.length].value }
                    : undefined
                }
              >
                {p.needs}/{p.wants}/{p.savings}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => go(-1)}
            aria-label="Previous plan"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-bk-line-soft)] text-[var(--color-bk-muted)] transition-colors hover:text-[var(--color-bk-ink)] hover:bg-[var(--color-bk-canvas)]"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Next plan"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-bk-line-soft)] text-[var(--color-bk-muted)] transition-colors hover:text-[var(--color-bk-ink)] hover:bg-[var(--color-bk-canvas)]"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* body — remounts on switch so content fades up */}
      <div key={active} className="bk-enter mt-8 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
        {/* pitch */}
        <div>
          <div className="flex items-center gap-3">
            <span
              className="bk-num text-[38px] tracking-[-0.02em] leading-none"
              style={{ color: noteTheme.accentDeep }}
            >
              {plan.needs}/{plan.wants}/{plan.savings}
            </span>
            {plan.recommended && (
              <span
                className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em] text-white"
                style={{ background: note.value }}
              >
                Recommended
              </span>
            )}
          </div>
          <div className="mt-3 text-[15px] font-semibold text-[var(--color-bk-ink)]">
            {PLAN_TITLES[plan.id] ?? plan.name}
          </div>
          <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-[var(--color-bk-muted)]">
            {plan.blurb}
          </p>
        </div>

        {/* the split, made tangible against a sample income */}
        <div>
          <div className="mb-4 flex items-baseline justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-bk-faint)]">
              On a {fmt(SHOWCASE_INCOME)} month
            </span>
          </div>
          <SplitBar plan={plan} colors={noteBucket} />
          <div className="mt-5 grid gap-3">
            {buckets.map((b) => (
              <div key={b.key} className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: noteBucket[b.key] }}
                  aria-hidden
                />
                <span className="text-[13.5px] font-medium text-[var(--color-bk-ink)]">
                  {b.label}
                </span>
                <span className="bk-num text-[12.5px] text-[var(--color-bk-muted)]">
                  {b.pct}%
                </span>
                <span className="bk-num ml-auto text-[15px] font-medium text-[var(--color-bk-ink)]">
                  {fmt(b.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** The "Choose your split" section — owns the active-plan state so both the
    heading's accent word and the drifting guilloché backdrop re-tint to the
    selected plan's banknote colour, in step with the carousel below. */
function PlanSection() {
  const [active, setActive] = useState(
    Math.max(0, BUDGET_PLANS.findIndex((p) => p.recommended))
  );
  const note = SCHEMES[active % SCHEMES.length];
  const noteTheme = deriveTheme(note.value);

  return (
    <section className="relative mt-24 max-w-[1120px] w-full">
      {/* Banknote line-work behind the section — re-tints and drifts with the
          active plan; freezes under prefers-reduced-motion. */}
      <div className="absolute -inset-x-10 -top-10 bottom-0" aria-hidden>
        <GuillocheFlow
          accent={noteTheme.accent}
          accentDeep={noteTheme.accentDeep}
          fade="radial"
          opacity={0.1}
        />
      </div>

      <div className="relative">
        <Reveal className="max-w-xl">
          <CardLabel>Choose your split</CardLabel>
          <h2
            className="text-[clamp(26px,3.4vw,38px)] tracking-[-0.02em] leading-tight text-balance mt-3 mb-2"
            style={{ ...SERIF, fontWeight: 500 }}
          >
            Pick a plan, or make it{" "}
            <em style={{ fontStyle: "italic", color: note.value }}>your own.</em>
          </h2>
          <p className="text-[15px] text-[var(--color-bk-muted)] leading-relaxed">
            Start with a proven rule and adjust anytime. Every plan tracks Needs, Wants, and Savings.
          </p>
        </Reveal>

        <Reveal className="mt-10">
          <PlanCarousel active={active} setActive={setActive} />
        </Reveal>
      </div>
    </section>
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

/** "Why Bulga" — four feature plates in the banknote palette. One card is always
    "lit" (its icon plate filled + wave wash washed in) and the headline wears
    that card's feeling word in its note colour. The first card ($5 blue,
    "whole.") is lit by default; hovering another lifts it instead, and the row
    falls back to the first once the pointer leaves. */
function FeaturesSection() {
  const [active, setActive] = useState(0);
  const word = FEATURES[active].word;
  const wordColor = SCHEMES[active % SCHEMES.length].value;

  return (
    <section className="mt-24 max-w-[1120px] w-full">
      <Reveal className="max-w-2xl">
        <CardLabel>Why Bulga</CardLabel>
        <h2
          className="text-[clamp(26px,3.4vw,38px)] tracking-[-0.02em] leading-tight text-balance mt-3"
          style={{ ...SERIF, fontWeight: 500 }}
        >
          Built to make money feel{" "}
          <em
            className="transition-colors duration-300"
            style={{ fontStyle: "italic", color: wordColor }}
          >
            {word}
          </em>
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-bk-muted)]">
          Accounts, spending, goals, and insights — everything Bulga does adds up to one
          confident picture of your money.
        </p>
      </Reveal>

      {/* First (blue) card is lit by default; the last card hovered stays lit. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
        {FEATURES.map((f, i) => {
          // Each feature carries one Canadian-banknote colour ($5 blue,
          // $10 purple, $20 green, $50 red) so the row reads as a set of notes.
          const note = SCHEMES[i % SCHEMES.length];
          const noteTheme = deriveTheme(note.value);
          const on = active === i;
          return (
            <Reveal key={f.title} delay={i * 80} className="h-full">
              <Card
                hover
                data-wash={on ? "on" : undefined}
                className="group relative flex h-full min-h-[208px] flex-col overflow-hidden p-6 text-left"
                style={
                  {
                    "--card-note": note.value,
                    "--card-tint": noteTheme.accentTint,
                  } as React.CSSProperties
                }
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
              >
                {/* Wave wash — an engraved guilloché field with straight
                    (horizontal) waves that washes in along a 45° diagonal while
                    the card is lit (see .bk-wave-wash in globals.css). The
                    field's dashes drift, so it reads as live water. */}
                <div className="bk-wave-wash pointer-events-none absolute inset-0">
                  <GuillocheFlow
                    accent={note.value}
                    accentDeep={noteTheme.accentDeep}
                    fade="right"
                    opacity={0.45}
                    speed={5}
                    gap={26}
                    amp={11}
                    strokeWidth={1.3}
                  />
                </div>

                {/* Icon plate — soft note tint at rest, filled solid while lit. */}
                <div
                  className={cn(
                    "relative flex h-12 w-12 items-center justify-center rounded-2xl transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(.22,.61,.36,1)]",
                    on && "-translate-y-0.5"
                  )}
                  style={{
                    background: on ? "var(--card-note)" : "var(--card-tint)",
                    color: on ? "#ffffff" : "var(--card-note)",
                  }}
                >
                  <f.icon className="h-5 w-5" strokeWidth={1.9} />
                </div>

                <div className="relative mt-auto pt-10">
                  <div className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-bk-ink)]">{f.title}</div>
                  <div className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-bk-muted)]">{f.desc}</div>
                </div>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

// ── trust strip + reactive graphic ──────────────────────────────────────────
// The three claims double as tabs: hovering one cross-fades the panel below to a
// small graphic that mirrors the *real* product surface it names — Plaid bank
// connect, the plan→goals split, the encryption layer. Each claim wears one
// banknote colour ($5 blue, $10 purple, $20 green) and its graphic re-tints to
// match, so this section joins the same palette as Features and Plans.

/** Tonal Needs/Wants/Savings shades derived from one note hue (deep/accent/light). */
function splitColors(theme: BulgaTheme): Record<"needs" | "wants" | "savings", string> {
  return {
    needs: theme.accentDeep,
    wants: theme.accent,
    savings: `oklch(78% 0.07 ${hueOf(theme.accent)})`,
  };
}

// Accounts as Plaid would return them after a link (kind + live balance).
const SYNCED_ACCOUNTS = [
  { name: "RBC Chequing", kind: "Chequing", balance: 4182.55 },
  { name: "TD Savings", kind: "Savings", balance: 12940.0 },
  { name: "Amex Gold", kind: "Credit", balance: -642.18 },
];

// Goals the Savings bucket funds, by priority — mirrors the Goals page.
const SAVINGS_GOALS = [
  { emoji: "🏝️", name: "Vacation", pct: 64, perMo: 220 },
  { emoji: "🚗", name: "New car", pct: 28, perMo: 180 },
];

const PRIVATE_ROWS = [
  { label: "Net worth", masked: "$••,•••" },
  { label: "Chequing", masked: "$•,•••" },
  { label: "Savings", masked: "$••,•••" },
];

/** "Import in seconds" — link a bank with Plaid; accounts sync automatically.
    Mirrors <ConnectBankModal>. */
function ImportGraphic({ theme }: { theme: BulgaTheme }) {
  return (
    <div className="grid w-full items-center gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:gap-8">
      {/* the connect card */}
      <div className="rounded-2xl border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] p-5 text-center shadow-[0_10px_28px_oklch(20%_0.02_80/0.08)]">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: theme.accentTint, color: theme.accentDeep }}
        >
          <Landmark className="h-6 w-6" strokeWidth={1.8} />
        </div>
        <div className="mt-3 text-[14px] font-semibold text-[var(--color-bk-ink)]">Connect a bank</div>
        <p className="mx-auto mt-1 max-w-[220px] text-[12px] leading-relaxed text-[var(--color-bk-muted)]">
          Balances and transactions sync automatically.
        </p>
        <div
          className="mt-4 flex items-center justify-center rounded-full py-2 text-[12.5px] font-semibold text-white"
          style={{ background: theme.accent }}
        >
          Continue with Plaid
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10.5px] font-medium text-[var(--color-bk-faint)]">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
          256-bit encryption · powered by Plaid
        </div>
      </div>

      {/* what comes back */}
      <div className="grid gap-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-bk-faint)]">
          <Check className="h-3.5 w-3.5" style={{ color: theme.accent }} strokeWidth={2.4} />
          Synced just now
        </div>
        {SYNCED_ACCOUNTS.map((a) => (
          <div
            key={a.name}
            className="flex items-center gap-3 rounded-xl border border-[var(--color-bk-line-soft)] bg-[var(--color-bk-surface)] px-3.5 py-2.5"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold"
              style={{ background: theme.accentTint, color: theme.accentDeep }}
            >
              {a.name[0]}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-[var(--color-bk-ink)]">{a.name}</div>
              <div className="text-[11px] text-[var(--color-bk-muted)]">{a.kind}</div>
            </div>
            <span
              className="bk-num ml-auto text-[13.5px] font-medium"
              style={{ color: a.balance < 0 ? "var(--color-bk-ink)" : theme.accentDeep }}
            >
              {fmt(a.balance)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Split every dollar" — the plan splits income Needs/Wants/Savings, and the
    Savings bucket funds goals by priority. Mirrors the Spending + Goals pages. */
function SplitGraphic({ theme }: { theme: BulgaTheme }) {
  const sc = splitColors(theme);
  const buckets = (["needs", "wants", "savings"] as const).map((key) => ({
    key,
    label: key[0].toUpperCase() + key.slice(1),
    pct: SHOWCASE_PLAN[key],
    amount: (SHOWCASE_PLAN[key] / 100) * SHOWCASE_INCOME,
  }));
  return (
    <div className="w-full">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-bk-faint)]">
          Every dollar, split
        </span>
        <span className="bk-num text-[14px] font-medium">
          {fmt(SHOWCASE_INCOME)}
          <span className="text-[12px] text-[var(--color-bk-muted)]"> / mo</span>
        </span>
      </div>

      <div className="flex h-9 w-full overflow-hidden rounded-xl">
        {buckets.map((b) => (
          <span key={b.key} style={{ width: `${b.pct}%`, background: sc[b.key] }} />
        ))}
      </div>
      <div className="mt-2 flex justify-between">
        {buckets.map((b) => (
          <div key={b.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: sc[b.key] }} />
            <span className="text-[11.5px] text-[var(--color-bk-muted)]">{b.label}</span>
            <span className="bk-num text-[11.5px] font-medium text-[var(--color-bk-ink)]">{fmt(b.amount)}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-bk-faint)]">
        <Target className="h-3.5 w-3.5" style={{ color: theme.accent }} strokeWidth={2.2} />
        Savings funds your goals
      </div>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {SAVINGS_GOALS.map((g) => (
          <div
            key={g.name}
            className="flex items-center gap-3 rounded-xl border border-[var(--color-bk-line-soft)] bg-[var(--color-bk-surface)] px-3.5 py-2.5"
          >
            <ProgressRing value={g.pct} size={42} stroke={5} color={theme.accent}>
              <span className="text-[16px] leading-none">{g.emoji}</span>
            </ProgressRing>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-semibold text-[var(--color-bk-ink)]">{g.name}</span>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold"
                  style={{ background: theme.accentTint, color: theme.accentDeep }}
                >
                  On track
                </span>
              </div>
              <div className="bk-num mt-0.5 text-[11.5px] text-[var(--color-bk-muted)]">
                <span style={{ color: theme.accentDeep }}>+{fmt(g.perMo)}</span>/mo
              </div>
            </div>
            <span className="bk-num ml-auto text-[15px] font-medium" style={{ color: theme.accentDeep }}>
              {g.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Private by default" — figures sit behind the encryption layer; credentials
    are handled by Plaid and never touch Bulga. Mirrors <ConnectBankModal> copy. */
function PrivateGraphic({ theme }: { theme: BulgaTheme }) {
  return (
    <div className="grid w-full items-center gap-8 sm:grid-cols-[auto_1fr]">
      <div
        className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl"
        style={{ background: theme.accentTint }}
      >
        <Lock className="h-10 w-10" style={{ color: theme.accent }} strokeWidth={1.8} />
      </div>

      <div className="grid max-w-sm gap-2.5">
        {PRIVATE_ROWS.map((r) => (
          <div
            key={r.label}
            className="flex items-center gap-3 rounded-xl border border-[var(--color-bk-line-soft)] bg-[var(--color-bk-surface)] px-3.5 py-2.5"
          >
            <span className="text-[13px] font-medium text-[var(--color-bk-ink)]">{r.label}</span>
            <span className="bk-num ml-auto text-[15px] tracking-[0.18em] text-[var(--color-bk-muted)]">{r.masked}</span>
            <Lock className="h-3.5 w-3.5 text-[var(--color-bk-faint)]" strokeWidth={2} />
          </div>
        ))}
        <div className="mt-1 flex items-center gap-1.5 text-[10.5px] font-medium text-[var(--color-bk-faint)]">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
          256-bit encryption
        </div>
        <p className="text-[12.5px] leading-relaxed text-[var(--color-bk-muted)]">
          Your credentials are encrypted and handled by Plaid — Bulga never sees or stores them.
        </p>
      </div>
    </div>
  );
}

const TRUST_GRAPHICS = [ImportGraphic, SplitGraphic, PrivateGraphic];

/** Trust strip whose three claims act as tabs for the graphic panel below. The
    panel grid-stacks all three graphics in one cell and cross-fades between them,
    so switching is smooth and the height never jumps. */
function TrustSection() {
  const [active, setActive] = useState(0);

  return (
    <section className="mt-28 sm:mt-40 max-w-[1120px] w-full">
      <Reveal>
        {/* First (blue) claim is selected by default; the last one hovered stays. */}
        <Card className="grid grid-cols-1 divide-y divide-[var(--color-bk-line-soft)] overflow-hidden sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {TRUST.map((t, i) => {
            const on = active === i;
            const note = SCHEMES[i % SCHEMES.length];
            const noteTheme = deriveTheme(note.value);
            return (
              <button
                key={t.title}
                type="button"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                aria-pressed={on}
                className={cn(
                  "group flex items-center gap-4 p-6 text-left transition-colors",
                  on ? "bg-[var(--color-bk-canvas)]" : "hover:bg-[var(--color-bk-canvas)]"
                )}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(.22,.61,.36,1)] group-hover:-translate-y-0.5"
                  style={{
                    background: on ? note.value : noteTheme.accentTint,
                    color: on ? "#ffffff" : note.value,
                  }}
                >
                  <t.icon className="h-5 w-5" strokeWidth={1.9} />
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-[var(--color-bk-ink)]">{t.title}</div>
                  <div className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--color-bk-muted)]">{t.desc}</div>
                </div>
              </button>
            );
          })}
        </Card>
      </Reveal>

      {/* The graphic that answers whichever claim is hovered — all three sit in
          a horizontal track that slides to the active one, carousel-style. The
          track height holds to the tallest graphic so nothing jumps. */}
      <Reveal className="mt-4">
        <Card className="relative overflow-hidden">
          <div
            className="flex transition-transform duration-[550ms] ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none"
            style={{ transform: `translateX(-${active * 100}%)` }}
          >
            {TRUST_GRAPHICS.map((Graphic, i) => (
              <div
                key={i}
                aria-hidden={active !== i}
                className="flex w-full shrink-0 items-center p-6 sm:p-10"
              >
                <Graphic theme={deriveTheme(SCHEMES[i % SCHEMES.length].value)} />
              </div>
            ))}
          </div>
        </Card>
      </Reveal>
    </section>
  );
}

/** The closing crescendo — a near-full-height panel whose multi-colour banknote
    "sea" surges in as you scroll to it (waves rise + intensify, receding on
    scroll-up), with the palette echoed as a foreground dot row so the coloured
    field reads as intentional. Freezes full + static under reduced motion. */
function ClosingBand() {
  // One-shot: the sea holds its "out" state until the band is fully in view,
  // then plays its entrance once (latched, never rewinds). The ref sits on the
  // sea layer, which is `inset-0` on the Card, so its box == the band's box.
  const { ref, shown } = useFullyVisible<HTMLDivElement>();

  return (
    <Reveal className="w-full max-w-[1120px] mt-24">
      <Card className="relative flex min-h-[56vh] flex-col items-center justify-center overflow-hidden px-8 pt-16 pb-10 sm:pt-20 sm:pb-14 text-center">
        {/* The banknote sea — every line a different hue, gently warped like
            moving water. Once the band is scrolled into view, two layers play a
            one-shot entrance: even rows slide in from the left, odd rows from the
            right, interleaving into one sharp field as the whole thing fades up.
            Transitions are suppressed under reduced motion. */}
        <div
          ref={ref}
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-[1800ms] ease-out motion-reduce:transition-none"
          style={{ opacity: shown ? 1 : 0 }}
        >
          {/* even rows enter from the left */}
          <div
            className="absolute inset-0 transition-transform duration-[2200ms] ease-[cubic-bezier(.22,.61,.36,1)] motion-reduce:transition-none"
            style={{ transform: shown ? "translateX(0)" : "translateX(-60%)" }}
          >
            <GuillocheFlow
              accent={BRAND_THEME.accent}
              accentDeep={BRAND_THEME.accentDeep}
              palette={SCHEMES.map((s) => s.value)}
              rows="even"
              fade="radial"
              opacity={0.26}
              warp={4}
            />
          </div>
          {/* odd rows enter from the right — interleave with the even rows into
              one sharp field (no overlapping duplicates) */}
          <div
            className="absolute inset-0 transition-transform duration-[2200ms] ease-[cubic-bezier(.22,.61,.36,1)] motion-reduce:transition-none"
            style={{ transform: shown ? "translateX(0)" : "translateX(60%)" }}
          >
            <GuillocheFlow
              accent={BRAND_THEME.accent}
              accentDeep={BRAND_THEME.accentDeep}
              palette={SCHEMES.map((s) => s.value)}
              rows="odd"
              fade="radial"
              opacity={0.26}
              warp={4}
            />
          </div>
        </div>
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
          Connect your accounts, set your plan, and let Bulga track every dollar in the
          background — you just live your life.
        </p>
        <div className="relative flex justify-center">
          <Link href="/register" className={CTA_PRIMARY}>
            Start for free <ArrowRight className="bk-lp-arrow w-4 h-4" />
          </Link>
        </div>
      </Card>
    </Reveal>
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
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/login"
              className="text-[13px] font-semibold text-[var(--color-bk-muted)] px-4 py-2 rounded-full hover:text-[var(--color-bk-ink)] transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center text-[13px] font-semibold text-white bg-[var(--color-primary)] px-4 py-2 rounded-full hover:brightness-[1.06] transition-[filter] shadow-[0_1px_2px_oklch(40%_0.1_158/0.3)]"
            >
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center px-7 pb-28">
        {/* ── Hero ── */}
        <section className="relative w-full max-w-[1120px] pt-20 sm:pt-32">
          {/* Gentle drifting banknote line-work behind the hero — freezes under
              prefers-reduced-motion. */}
          <div className="absolute -inset-x-10 -top-10 bottom-0" aria-hidden>
            <GuillocheFlow
              accent={BRAND_THEME.accent}
              accentDeep={BRAND_THEME.accentDeep}
              fade="radial"
              opacity={0.06}
            />
          </div>

          <div className="relative grid items-center gap-16 lg:grid-cols-[1.02fr_1fr] lg:gap-20">
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
                Connect your bank, split every dollar across Needs, Wants, and Savings,
                and fund your goals — Bulga does the math so you don&apos;t have to.
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

        {/* ── Trust strip — three claims that drive a reactive graphic ── */}
        <TrustSection />

        {/* ── Plan showpiece (deep evergreen band) ── */}
        <section className="w-full max-w-[1120px] mt-24">
          <Reveal>
            <PlanShowpiece />
          </Reveal>
        </section>

        {/* ── Features — banknote feature plates + reactive headline ── */}
        <FeaturesSection />

        {/* ── Budget plans (real product data) ── */}
        <PlanSection />

        {/* ── Closing band — the final crescendo (see <ClosingBand>) ── */}
        <ClosingBand />
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
