"use client";

// otterfund — landing page.
//
// The pre-auth pitch, in the brand's banknote language and now sharing the
// app's split-screen vocabulary: engraved guilloché line-work, Newsreader
// figures, one evergreen accent, and the same deep-evergreen "brand panel"
// field that carries sign-in / sign-up / onboarding. The page reads like the
// product it sells — a live dashboard note counts up and draws its own
// sparkline, a deep showpiece band renders the real Needs/Wants/Savings donut,
// and the actual budget plans are shown as pickable cards. Every motion degrades
// to a calm static layout under prefers-reduced-motion (CSS in globals.css,
// sections "of-enter" / "Landing").

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Home,
  Landmark,
  ListChecks,
  Lock,
  type LucideIcon,
  PieChart,
  ShieldCheck,
  Target,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";

import { Card, CardLabel } from "@/components/otterfund/card";
import { GuillocheFlow } from "@/components/otterfund/guilloche-flow";
import { DonutChart } from "@/components/otterfund/donut-chart";
import { ProgressRing } from "@/components/otterfund/progress";
import { LogoMark, OtterFace } from "@/components/otterfund/logo";
import { Wordmark } from "@/components/otterfund/wordmark";
import { BRAND_THEME, SCHEMES, deriveTheme, hueOf, type OtterfundTheme } from "@/components/otterfund/theme";
import { LEGAL } from "@/lib/legal";
import {
  PANEL_ACCENT,
  PANEL_BG,
  PANEL_INK,
  PANEL_LINE,
  PANEL_LINE_DEEP,
} from "@/components/otterfund/brand-panel";
import { BUDGET_PLANS, getBudgetPlan } from "@/lib/constants";
import { buttonVariants } from "@/components/ui/button";
import { fmt, fmtWhole } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FAQ_ITEMS } from "@/lib/seo";

const SERIF: React.CSSProperties = { fontFamily: "var(--font-num), Georgia, serif" };

const CTA_PRIMARY = cn(buttonVariants({ variant: "default", size: "lg" }), "of-lp-cta font-semibold");
const CTA_SECONDARY = cn(buttonVariants({ variant: "outline", size: "lg" }), "font-semibold");

// In-page sections the nav and footer link to (see scrollToId).
const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#plans", label: "Plans" },
  { href: "#features", label: "Features" },
  { href: "#faq", label: "FAQ" },
];

/** Anchor-link scroll for the nav/footer links — smooth unless the visitor
    prefers reduced motion; targets carry scroll-mt for the sticky nav. */
function scrollToId(e: React.MouseEvent<HTMLAnchorElement>) {
  const el = document.getElementById(e.currentTarget.hash.slice(1));
  if (!el) return;
  e.preventDefault();
  el.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
}

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
      className={cn("of-reveal", className)}
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/** Scroll-linked "settle" — the element enters scaled up toward the viewport
    width with softly rounded corners and eases down into its laid-out card
    size as it climbs toward the middle of the screen. Styles are mutated
    directly so scrolling never re-renders the tree; inert under
    prefers-reduced-motion (the element just keeps its resting card look).

    Scroll position is treated as a *target*, not applied 1:1: a rAF loop
    eases the current pose toward it (time-based exponential smoothing) and
    stops once converged. Notched mouse wheels move the scroll offset in
    ~100px steps — mapping directly made the band resize in visible jumps. */
function useSettleOnScroll<T extends HTMLElement>(radius = 28, radiusFrom = 12) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Grow downward from the top edge — scaling from the center would push the
    // band up over the tail of the previous section while it's fullscreen.
    el.style.transformOrigin = "50% 0%";
    let raf = 0;
    let running = false;
    let last = 0;
    let pose = -1; // smoothed eased progress (0 = fullscreen, 1 = card)

    // Scroll-derived target pose. f = how far the band's top has climbed into
    // the viewport (0 at the bottom edge → 1 at the top). Hold fullscreen
    // until 30% in, then settle to the card by 75%. Cubic ease-out so the
    // settle decelerates. (Scale keeps the top edge fixed, so rect.top is
    // unaffected by the transform we apply.)
    const target = () => {
      const f = (window.innerHeight - el.getBoundingClientRect().top) / window.innerHeight;
      const t = Math.min(1, Math.max(0, (f - 0.3) / 0.45));
      return 1 - Math.pow(1 - t, 3);
    };

    const apply = (e: number) => {
      // Cap the entrance scale — a hint of extra width reads as "settling in";
      // true edge-to-edge on wide screens felt like it started too big.
      const max = Math.min(1.12, window.innerWidth / el.offsetWidth);
      const s = max - (max - 1) * e;
      const settled = s <= 1.001;
      el.style.transform = settled ? "" : `scale(${s.toFixed(4)})`;
      el.style.borderRadius = `${(radiusFrom + (radius - radiusFrom) * e).toFixed(1)}px`;
      // Own compositor layer only while mid-flight — the band is a large
      // patterned surface and re-rasterizing it per frame is the jank.
      el.style.willChange = settled ? "" : "transform";
    };

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const t = target();
      // ~90ms time constant: frame-rate independent, converges in ~a third of
      // a second — quick enough to track the scroll, slow enough to absorb
      // the wheel's steps.
      pose += (t - pose) * (1 - Math.exp(-dt / 90));
      if (Math.abs(t - pose) < 0.002) {
        pose = t;
        apply(pose);
        running = false;
        return;
      }
      apply(pose);
      raf = requestAnimationFrame(tick);
    };

    const kick = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    // First paint lands directly on the correct pose — no glide on load when
    // the page is restored mid-scroll.
    pose = target();
    apply(pose);
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
    };
  }, [radius, radiusFrom]);
  return ref;
}

/** Eased tween that animates from its *previous* value to `target` whenever the
    target changes (once `run` flips true) — so it works both for the first
    count-up and for the looping hand-off between scenes. Jumps straight to the
    figure under reduced motion. */
function useTween(target: number, run: boolean, duration = 1100) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    const from = fromRef.current;
    let raf: number;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, duration]);
  return value;
}

// The trailing noun of the hero headline cycles so "Your money, in ___." reads
// as a loop of the outcomes otterfund delivers. Static first word under reduced
// motion (RotatingWord holds on index 0 when the interval never starts).
const HERO_WORDS = ["balance.", "focus.", "order.", "reach."];

/** Swaps the trailing headline noun on a loop, each new word rising in via
    `of-hero-word` (remounted by `key`). The slot is sized to the *active*
    word and its width animates on each swap, so the centered headline stays
    optically centered on every word (a fixed widest-word slot left the
    shorter words looking off-center). */
function RotatingWord({ words, interval = 3600 }: { words: string[]; interval?: number }) {
  const [i, setI] = useState(0);
  const measurers = useRef<Record<string, HTMLSpanElement | null>>({});
  const [width, setWidth] = useState<number>();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % words.length), interval);
    return () => clearInterval(id);
  }, [words.length, interval]);

  // Size the slot to the active word. Glyph widths move when the vw-clamped
  // font size (resize) or the loaded serif face (fonts.ready) changes.
  useLayoutEffect(() => {
    const measure = () => {
      const el = measurers.current[words[i]];
      if (el) setWidth(el.offsetWidth);
    };
    measure();
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [i, words]);

  return (
    <span
      className="relative inline-block align-baseline whitespace-nowrap"
      style={{ width, transition: "width 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)" }}
    >
      {/* Invisible copies: the active word sits in-flow (giving the slot its
          height and baseline); the rest are absolute so each word's natural
          width can be read off its own span. */}
      {words.map((w) => (
        <span
          key={w}
          ref={(el) => {
            measurers.current[w] = el;
          }}
          className={cn("invisible whitespace-nowrap", w !== words[i] && "absolute left-0 top-0")}
          aria-hidden
        >
          {w}
        </span>
      ))}
      <span key={words[i]} className="of-hero-word absolute inset-0">
        {words[i]}
      </span>
    </span>
  );
}

// ── hero deck data (illustrative, mirrors the real app tabs) ────────────────
// The right of the hero is a small floating "deck": one glassmorphic card per
// app tab (Overview · Investments · Goals). All three hover together and the
// loop lifts each to the front in turn, so every surface gets its moment.

const SP_W = 560;
const SP_H = 120;

/** Build the sparkline geometry (line path, filled-area path, end-point) for a
    12-point net-worth trend, normalized into the SP_W × SP_H viewbox. */
function buildSpark(trend: number[]) {
  const mn = Math.min(...trend);
  const mx = Math.max(...trend);
  const rg = mx - mn || 1;
  const pts = trend.map(
    (d, i) =>
      [
        (i / (trend.length - 1)) * SP_W,
        SP_H - 8 - ((d - mn) / rg) * (SP_H - 24),
      ] as const
  );
  const line = "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L");
  const [lx, ly] = pts[pts.length - 1];
  return { line, area: `${line}L${SP_W} ${SP_H}L0 ${SP_H}Z`, lx, ly };
}

// Net-worth trend (Overview card) + its sparkline.
const NW_TREND = [18.2, 18.9, 18.4, 19.6, 20.3, 19.9, 21.2, 22.1, 21.8, 22.9, 23.6, 24.18];
const NW_SPARK = buildSpark(NW_TREND);

// Holdings shown on the Investments card. `chg` is today's % move (green up /
// clay down, universal gain-loss semantics regardless of the card's accent).
const HOLDINGS = [
  { sym: "VEQT", name: "All-Equity ETF", value: 7420.5, chg: 1.8 },
  { sym: "AAPL", name: "Apple Inc.", value: 3960.0, chg: -0.6 },
  { sym: "BTC", name: "Bitcoin", value: 2240.0, chg: 3.2 },
];

// Goals shown on the Goals card.
const HERO_GOALS = [
  { name: "Japan trip", saved: 4600, target: 10000, pct: 46 },
  { name: "Emergency fund", saved: 9400, target: 12000, pct: 78 },
];

/** A small self-drawing net-worth/portfolio sparkline for a deck card. The
    line + area draw once when the deck scrolls into view (of-lp-* under the
    ancestor's `data-in`). `gradId` must be unique per instance. */
function MiniSpark({
  spark,
  color,
  gradId,
  heightClass = "h-[58px]",
}: {
  spark: ReturnType<typeof buildSpark>;
  color: string;
  gradId: string;
  heightClass?: string;
}) {
  return (
    <svg viewBox={`0 0 ${SP_W} ${SP_H}`} preserveAspectRatio="none" className={cn("w-full", heightClass)} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="of-lp-area" d={spark.area} fill={`url(#${gradId})`} />
      <path
        className="of-lp-line"
        d={spark.line}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// `word` fills the "Built to make money feel ___." headline while the card is
// hovered — each feature names the feeling it delivers ("quiet." is the resting
// word). See <FeaturesSection>.
const FEATURES = [
  { icon: Wallet, title: "Every account, one net worth", desc: "Chequing, savings, credit, and investments add up to a single live balance.", word: "whole." },
  { icon: ListChecks, title: "Spending, made plain", desc: "Every transaction sorted into clean categories, so you see where it all goes.", word: "clear." },
  { icon: Target, title: "Goals that fund themselves", desc: "Your monthly savings split across goals by priority, each with a finish date.", word: "intentional." },
  { icon: OtterFace, title: "Insights, not lectures", desc: "Quiet nudges drawn from your own numbers, written in plain language.", word: "understood." },
];

// The three steps of the "How it works" band. Each doubles as a tab for the
// graphic panel below it, which shows the real product surface it names.
const STEPS = [
  { icon: Upload, title: "Connect your accounts", desc: "Link your bank through Plaid, or drop in a statement." },
  { icon: PieChart, title: "Split every dollar", desc: "Needs, Wants, and Savings. A plan you can adjust anytime." },
  { icon: Target, title: "Watch your goals grow", desc: "Whatever you save flows to your goals, by priority." },
];

// ── budget-plan showpiece figures ───────────────────────────────────────────
// A sample income makes the plan's split tangible in the deep band; the numbers
// derive from the real BUDGET_PLANS percentages, exactly as the Spending page
// computes them.
const SHOWCASE_INCOME = 6450;
const SHOWCASE_PLAN = getBudgetPlan("50-30-20");

// Each plan tab wears one Canadian-banknote colour ($5 blue, $10 purple,
// $20 green, $50 red) — the same mapping as the Features row — and the band's
// light-on-dark accents re-derive from the active plan's hue. At hue 158 this
// reproduces the panel's original evergreen tones exactly.
function notePanel(hue: string) {
  return {
    accent: `oklch(84% 0.1 ${hue})`, // light accent for text/em on the dark field
    badgeBg: `oklch(90% 0.09 ${hue} / 0.14)`,
    // The dark banknote field itself, and its guilloché line tones — the same
    // formula as the brand panel's evergreen (PANEL_BG / PANEL_LINE*), hue-swapped.
    bg: `linear-gradient(158deg, oklch(34% 0.064 ${hue}) 0%, oklch(25% 0.052 ${hue}) 52%, oklch(20% 0.044 ${hue}) 100%)`,
    line: `oklch(90% 0.05 ${hue})`,
    lineDeep: `oklch(82% 0.06 ${hue})`,
    muted: `oklch(86% 0.03 ${hue})`, // secondary copy on the dark field (PANEL_MUTED, hue-swapped)
    // Three cohesive light shades of the hue for the dark banknote field.
    bucket: {
      needs: `oklch(66% 0.12 ${hue})`,
      wants: `oklch(80% 0.11 ${hue})`,
      savings: `oklch(91% 0.06 ${hue})`,
    } as Record<"needs" | "wants" | "savings", string>,
  };
}

const PLAN_HUES = BUDGET_PLANS.map((_, i) => hueOf(SCHEMES[i % SCHEMES.length].value));

// ── pieces ──────────────────────────────────────────────────────────────────

/** Small header for a deck card: a tinted tab-icon tile + its uppercase label.
    `align="right"` flips it (label then tile, hugging the right edge) for the
    Goals card, whose visible portion pokes out on the right. */
function DeckHeader({ Icon, label, t, align = "left" }: { Icon: LucideIcon; label: string; t: OtterfundTheme; align?: "left" | "right" }) {
  return (
    <div className={cn("flex items-center gap-2.5 mb-3", align === "right" && "flex-row-reverse")}>
      <span
        className="grid place-items-center w-8 h-8 rounded-[10px]"
        style={{ background: t.accentTint, color: t.accentDeep }}
      >
        <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
      </span>
      <CardLabel>{label}</CardLabel>
    </div>
  );
}

/** The showpiece — a centered hero composition: a large, solid Overview card up
    front, with the Investments and Goals cards fanned behind it as calm,
    dimmed context. All three drift gently (desynced); the Overview figure
    counts up and its sparkline draws when the composition scrolls into view.
    Under reduced motion nothing moves — the cards simply rest in place. */
function DashboardPreview() {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);

  // Each card carries its own hue from the banknote palette (evergreen /
  // blue / purple), so the trio picks up the app's multi-colour system while
  // every figure stays anchored in ink.
  const green = BRAND_THEME;
  const blue = deriveTheme(SCHEMES[0].value);
  const purple = deriveTheme(SCHEMES[1].value);

  const netWorth = useTween(inView ? 24180.62 : 0, inView, 1300);
  const nwDelta = useTween(inView ? 1240.18 : 0, inView, 1300);

  const gain = green.accentDeep;
  const loss = "var(--color-of-clay)";

  // Shared surface for the two background cards: glassy, softened, and pushed
  // back so they read as context behind the star.
  const backCard = "rounded-[28px] border p-7 text-left backdrop-blur-md";
  const backStyle: React.CSSProperties = {
    background: "oklch(99% 0.004 95 / 0.7)",
    borderColor: "oklch(100% 0 0 / 0.55)",
    boxShadow: "0 22px 55px oklch(20% 0.04 80 / 0.14)",
    opacity: 0.82,
  };

  return (
    <div ref={ref} data-in={inView ? "" : undefined} className="relative mx-auto w-full max-w-[480px]">
      {/* ── Background — Investments, fanned upper-left ── */}
      <div
        className="of-hero-float pointer-events-none absolute left-0 top-0 w-full z-10"
        style={{ animationDelay: "-3.2s" }}
        aria-hidden
      >
        <div style={{ transform: "translate(-42%, -22%) rotate(-8deg) scale(0.86)", transformOrigin: "center" }}>
          <div className={backCard} style={backStyle}>
            <DeckHeader Icon={TrendingUp} label="Investments" t={blue} />
            <div className="text-[12px] font-medium text-[var(--color-of-muted)]">Portfolio</div>
            <div className="flex items-end justify-between">
              <div className="of-num text-[26px] tracking-[-0.03em] leading-none mt-1" style={{ fontWeight: 500 }}>
                {fmt(13620.5)}
              </div>
              <span
                className="of-num text-[12px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: green.accentTint, color: green.accentDeep }}
              >
                +{fmt(312.4)}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {HOLDINGS.slice(0, 2).map((h) => (
                <div key={h.sym} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[var(--color-of-ink)] leading-tight">{h.sym}</div>
                    <div className="text-[11px] text-[var(--color-of-faint)] leading-tight truncate">{h.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="of-num text-[13px] text-[var(--color-of-ink)] leading-tight">{fmt(h.value)}</div>
                    <div className="of-num text-[11px] font-semibold leading-tight" style={{ color: h.chg >= 0 ? gain : loss }}>
                      {h.chg >= 0 ? "+" : ""}
                      {h.chg.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Background — Goals, fanned upper-right ── */}
      <div
        className="of-hero-float pointer-events-none absolute left-0 top-0 w-full z-10"
        style={{ animationDelay: "-1.6s" }}
        aria-hidden
      >
        <div style={{ transform: "translate(46%, -20%) rotate(9deg) scale(0.86)", transformOrigin: "center" }}>
          {/* Content is right-aligned so it lives on the card's right side — the
              part that pokes out past the front card and stays visible. */}
          <div className={backCard} style={backStyle}>
            <DeckHeader Icon={Target} label="Goals" t={purple} align="right" />
            <div className="text-[12px] font-medium text-[var(--color-of-muted)] text-right">Saving with intent</div>
            <div className="mt-4 space-y-4">
              {HERO_GOALS.map((g) => (
                <div key={g.name} className="flex items-center justify-end gap-3">
                  <div className="min-w-0 text-right">
                    <div className="text-[13px] font-semibold text-[var(--color-of-ink)] leading-tight truncate">{g.name}</div>
                    <div className="of-num text-[11.5px] text-[var(--color-of-muted)] leading-tight">
                      {fmtWhole(g.saved)} of {fmtWhole(g.target)}
                    </div>
                  </div>
                  <ProgressRing value={g.pct} size={46} stroke={5} color={purple.accent}>
                    <span className="of-num text-[11px] font-semibold" style={{ color: purple.accentDeep }}>
                      {g.pct}%
                    </span>
                  </ProgressRing>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Front — Overview, the prominent star (a touch smaller than the
          background cards' reference width so the fan reads clearly) ── */}
      <div className="of-hero-float relative z-30 mx-auto w-[88%]">
        <div className="rounded-[28px] border border-[var(--color-of-line)] bg-[var(--color-of-surface)] p-7 sm:p-8 text-left shadow-[0_40px_90px_oklch(20%_0.05_80/0.22)]">
          <DeckHeader Icon={Home} label="Overview" t={green} />
          <div className="text-[13px] font-medium text-[var(--color-of-muted)]">Net worth</div>
          <div className="of-num text-[clamp(32px,4vw,44px)] tracking-[-0.03em] leading-none mt-1.5" style={{ fontWeight: 500 }}>
            {fmt(netWorth)}
          </div>
          <div
            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-[12px] font-semibold"
            style={{ background: green.accentTint, color: green.accentDeep }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
            <span className="of-num">+{fmt(nwDelta)}</span>
            <span className="opacity-80">this month</span>
          </div>
          <div className="mt-4">
            <MiniSpark spark={NW_SPARK} color={green.accent} gradId="lp-deck-ov" heightClass="h-[88px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Descriptive titles for the plan tabs' subtitle. The plan `name` in constants is
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

// The classic plan's blurb restates its title ("The Classic — The classic
// balance…"), so the band shows this trimmed line instead.
const PLAN_BLURBS: Record<string, string> = {
  "50-30-20": "Half to essentials, a third to lifestyle, a fifth to savings.",
};


/** The deep-evergreen showpiece band — mirrors the auth/onboarding brand panel
    and renders the app's real Needs/Wants/Savings donut against a sample income.
    The four budget plans are tabs in the Features row's banknote colours
    ($5 blue, $10 purple, $20 green, $50 red): selecting one re-splits the
    buckets, animates the donut, and re-tints the band's accents to that note's
    hue. The active plan auto-advances every 10s while the band is on screen
    (hover hands over, leave resumes — same rhythm as Features). */
function PlanShowpiece() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  // Fullscreen → card: the band enters at viewport width with square corners
  // and settles into the rounded panel as it scrolls up (see useSettleOnScroll).
  const settleRef = useSettleOnScroll<HTMLDivElement>(28);
  const [active, setActive] = useState(
    Math.max(0, BUDGET_PLANS.findIndex((p) => p.recommended))
  );
  const [paused, setPaused] = useState(false);
  const plan = BUDGET_PLANS[active];
  const note = notePanel(PLAN_HUES[active]);
  const buckets = (["needs", "wants", "savings"] as const).map((key) => ({
    key,
    label: key[0].toUpperCase() + key.slice(1),
    pct: plan[key],
    amount: (plan[key] / 100) * SHOWCASE_INCOME,
  }));
  const segments = buckets.map((b) => ({ value: b.pct, color: note.bucket[b.key] }));

  // Same guided rhythm as the Features row, at a reading pace: the active plan
  // advances on its own while the band is on screen, hands over on hover, and
  // resumes once the pointer leaves. Reduced motion opts out.
  useEffect(() => {
    if (!inView || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((i) => (i + 1) % BUDGET_PLANS.length), 10000);
    return () => clearInterval(t);
  }, [inView, paused]);

  const pick = (i: number) => {
    setPaused(true);
    setActive(i);
  };

  return (
    <div
      ref={(el) => {
        ref.current = el;
        settleRef.current = el;
      }}
      data-in={inView ? "" : undefined}
      className="relative overflow-hidden rounded-[28px] p-8 sm:p-12 shadow-[0_28px_70px_oklch(22%_0.04_160/0.28)]"
      style={{ background: PANEL_BG }}
    >
      {/* Per-plan dark fields — the active hue's gradient sits over the rest.
          Gradients can't transition, so each is its own stacked layer and only
          opacity animates (the evergreen PANEL_BG above is the first-paint base). */}
      {BUDGET_PLANS.map((p, i) => (
        <div
          key={p.id}
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out"
          style={{ background: notePanel(PLAN_HUES[i]).bg, opacity: active === i ? 1 : 0 }}
        />
      ))}
      {/* stroke transitions so the line-work re-tints in step with the field */}
      <GuillocheFlow
        accent={note.line}
        accentDeep={note.lineDeep}
        opacity={0.14}
        fade="none"
        speed={4}
        className="[&_path]:transition-[stroke] [&_path]:duration-700"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 8% 0%, oklch(96% 0.05 158 / 0.12) 0%, transparent 55%)",
        }}
      />

      {/* Two columns from md up — stacking only on true mobile. At tablet
          widths the stacked layout left the bucket amounts and the donut
          floating in a sea of dark field. */}
      <div className="relative grid items-center gap-10 md:grid-cols-[1fr_auto] md:gap-12 lg:gap-16">
        {/* pitch + buckets */}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: note.accent,
              transition: "color .6s ease",
            }}
          >
            Choose your split
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
            <em style={{ fontStyle: "italic", color: note.accent, transition: "color .6s ease" }}>
              way that fits.
            </em>
          </h2>
          <p
            className="text-[15px] leading-relaxed"
            style={{ color: note.muted, transition: "color .6s ease" }}
          >
            Pick a proven rule. <Wordmark />{" "}tracks how each month lands against it.
          </p>

          {/* plan tabs — each wears its banknote colour; hovering (or the 10s
              auto-cycle) selects it, re-splits the buckets, and re-tints the
              band's accents. Hover hands the rhythm over; it resumes on leave. */}
          <div
            className="mt-6 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Budget plans"
            onMouseLeave={() => setPaused(false)}
          >
            {BUDGET_PLANS.map((p, i) => {
              const selected = i === active;
              // White pill with the dark note colour as text at rest, flipped
              // (dark note fill, white text) while selected.
              const noteValue = SCHEMES[i % SCHEMES.length].value;
              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => pick(i)}
                  onMouseEnter={() => pick(i)}
                  onFocus={() => pick(i)}
                  className={cn(
                    // Fixed-height flex pill: leading-none + items-center keeps
                    // the serif digits truly centred (an inherited line-height
                    // floated them high), and nothing moves on select — the
                    // dark fill is the whole affordance.
                    "of-num inline-flex h-8 items-center justify-center rounded-full px-3.5 text-[13px] font-semibold leading-none tracking-[-0.01em]",
                    "transition-[background-color,color] duration-300 ease-[cubic-bezier(.22,.61,.36,1)]"
                  )}
                  style={
                    selected
                      ? { background: noteValue, color: "#ffffff" }
                      : { background: "#ffffff", color: noteValue }
                  }
                >
                  {p.needs}/{p.wants}/{p.savings}
                </button>
              );
            })}
          </div>
          <p
            key={plan.id}
            className="of-enter mt-3 text-[13px] leading-relaxed"
            style={{ color: note.muted, transition: "color .6s ease" }}
          >
            <span className="font-semibold" style={{ color: PANEL_INK }}>
              {PLAN_TITLES[plan.id] ?? plan.name}
            </span>
            {": "}
            {PLAN_BLURBS[plan.id] ?? plan.blurb}
          </p>

          {/* Centered while stacked (matching the donut below); flush-left in
              the two-column layout. */}
          <div className="mx-auto mt-7 grid w-full max-w-md gap-4 md:mx-0">
            {buckets.map((b) => (
              <div key={b.key} className="flex items-center gap-4">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: note.bucket[b.key], transition: "background .6s ease" }}
                  aria-hidden
                />
                <span className="text-[14px] font-medium" style={{ color: PANEL_INK }}>
                  {b.label}
                </span>
                <span
                  className="of-num text-[13px]"
                  style={{ color: note.muted, transition: "color .6s ease" }}
                >
                  {b.pct}%
                </span>
                <span className="of-num ml-auto text-[15px] font-medium" style={{ color: PANEL_INK }}>
                  {fmtWhole(b.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* the real donut, drawn against a sample income */}
        <div className="flex flex-col items-center gap-4 lg:pr-4">
          {/* Keyed by plan: switching remounts the donut so its draw-in sweep
              replays in full with the new colours — cleaner than transitioning
              arcs and strokes at the same time. */}
          <DonutChart key={plan.id} segments={segments} size={208} stroke={30} trackColor="oklch(100% 0 0 / 0.08)">
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: note.muted,
                transition: "color .6s ease",
              }}
            >
              Monthly income
            </span>
            <span className="of-num" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", color: PANEL_INK }}>
              {fmtWhole(SHOWCASE_INCOME)}
            </span>
          </DonutChart>
          <span
            className="of-num rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{
              background: note.badgeBg,
              color: note.accent,
              transition: "background .6s ease, color .6s ease",
            }}
          >
            {plan.needs}/{plan.wants}/{plan.savings}
          </span>
        </div>
      </div>
    </div>
  );
}

/** "Why otterfund" — four feature plates in the banknote palette. One card is always
    "lit" (its icon plate filled + wave wash washed in) and the headline wears
    that card's feeling word in its note colour. The first card ($5 blue,
    "whole.") is lit by default; hovering another lifts it instead, and the row
    falls back to the first once the pointer leaves. */
function FeaturesSection() {
  const { ref, inView } = useInView<HTMLElement>(0.25);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const word = FEATURES[active].word;
  const wordColor = SCHEMES[active % SCHEMES.length].value;

  // Same guided rhythm as "How it works": the lit card advances on its own
  // while the section is on screen, hands over on hover, and resumes once the
  // pointer leaves. Reduced motion opts out.
  useEffect(() => {
    if (!inView || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((i) => (i + 1) % FEATURES.length), 5500);
    return () => clearInterval(t);
  }, [inView, paused]);

  const pick = (i: number) => {
    setPaused(true);
    setActive(i);
  };

  return (
    <section id="features" ref={ref} className="mt-24 sm:mt-32 max-w-[1120px] w-full scroll-mt-24">
      <Reveal className="max-w-2xl">
        <CardLabel>Why <Wordmark /></CardLabel>
        <h2
          className="text-[clamp(26px,3.4vw,38px)] tracking-[-0.02em] leading-tight text-balance mt-3"
          style={{ ...SERIF, fontWeight: 500 }}
        >
          Built to make money feel{" "}
          <em
            key={word}
            className="of-word-swap"
            style={{ fontStyle: "italic", color: wordColor }}
          >
            {word}
          </em>
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-of-muted)]">
          Everything <Wordmark />{" "}does adds up to one confident picture of your money.
        </p>
      </Reveal>

      {/* First (blue) card is lit by default; hovering takes over, and the
          auto-cycle picks back up from there once the pointer leaves. */}
      <div
        className="mt-8 grid grid-cols-1 gap-2.5 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4"
        onMouseLeave={() => setPaused(false)}
      >
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
                className="group relative flex h-full flex-row items-start gap-4 overflow-hidden p-4 text-left sm:min-h-[208px] sm:flex-col sm:gap-0 sm:p-6"
                style={
                  {
                    "--card-note": note.value,
                    "--card-tint": noteTheme.accentTint,
                  } as React.CSSProperties
                }
                onMouseEnter={() => pick(i)}
                onFocus={() => pick(i)}
              >
                {/* Wave wash — an engraved guilloché field with straight
                    (horizontal) waves that washes in along a 45° diagonal while
                    the card is lit (see .of-wave-wash in globals.css). The
                    field's dashes drift, so it reads as live water. */}
                <div className="of-wave-wash pointer-events-none absolute inset-0">
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
                    "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-[background-color,color,translate,rotate,scale] duration-300 ease-[cubic-bezier(.22,.61,.36,1)] sm:h-12 sm:w-12 sm:rounded-2xl",
                    on && "-translate-y-0.5 -rotate-2 scale-[1.05]"
                  )}
                  style={{
                    background: on ? "var(--card-note)" : "var(--card-tint)",
                    color: on ? "#ffffff" : "var(--card-note)",
                  }}
                >
                  <f.icon className="h-5 w-5" strokeWidth={1.9} />
                </div>

                {/* Top-anchored (not mt-auto) so titles line up across the row
                    regardless of how many lines each description wraps to. */}
                <div className="relative min-w-0 sm:pt-10">
                  <div className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--color-of-ink)] sm:text-[15px]">{f.title}</div>
                  <div className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-of-muted)] sm:mt-1.5">{f.desc}</div>
                </div>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

// ── "How it works" band — three steps + reactive graphic ────────────────────
// The steps double as tabs: hovering (or the gentle auto-advance) slides the
// panel below to a graphic that mirrors the *real* product surface it names —
// Plaid bank connect, the Needs/Wants/Savings split, the goals it funds. Each
// step wears one banknote colour ($5 blue, $10 purple, $20 green) and its
// graphic re-tints to match, so this section joins the same palette as
// Features and Plans.

/** Tonal Needs/Wants/Savings shades derived from one note hue (deep/accent/light). */
function splitColors(theme: OtterfundTheme): Record<"needs" | "wants" | "savings", string> {
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

/** "Import in seconds" — link a bank with Plaid; accounts sync automatically.
    Mirrors <ConnectBankModal>. */
function ImportGraphic({ theme }: { theme: OtterfundTheme }) {
  return (
    <div className="grid w-full items-center gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:gap-8">
      {/* the connect card */}
      <div className="rounded-2xl border border-[var(--color-of-line)] bg-[var(--color-of-surface)] p-5 text-center shadow-[0_10px_28px_oklch(20%_0.02_80/0.08)]">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: theme.accentTint, color: theme.accentDeep }}
        >
          <Landmark className="h-6 w-6" strokeWidth={1.8} />
        </div>
        <div className="mt-3 text-[14px] font-semibold text-[var(--color-of-ink)]">Connect a bank</div>
        <p className="mx-auto mt-1 max-w-[220px] text-[12px] leading-relaxed text-[var(--color-of-muted)]">
          Balances and transactions sync automatically.
        </p>
        <div
          className="mt-4 flex items-center justify-center rounded-full py-2 text-[12.5px] font-semibold text-white"
          style={{ background: theme.accent }}
        >
          Continue with Plaid
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10.5px] font-medium text-[var(--color-of-faint)]">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
          256-bit encryption · powered by Plaid
        </div>
      </div>

      {/* what comes back */}
      <div className="grid gap-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-of-faint)]">
          <Check className="h-3.5 w-3.5" style={{ color: theme.accent }} strokeWidth={2.4} />
          Synced just now
        </div>
        {SYNCED_ACCOUNTS.map((a) => (
          <div
            key={a.name}
            className="flex items-center gap-3 rounded-xl border border-[var(--color-of-line-soft)] bg-[var(--color-of-surface)] px-3.5 py-2.5"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold"
              style={{ background: theme.accentTint, color: theme.accentDeep }}
            >
              {a.name[0]}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-[var(--color-of-ink)]">{a.name}</div>
              <div className="text-[11px] text-[var(--color-of-muted)]">{a.kind}</div>
            </div>
            <span
              className="of-num ml-auto text-[13.5px] font-medium"
              style={{ color: a.balance < 0 ? "var(--color-of-ink)" : theme.accentDeep }}
            >
              {fmt(a.balance)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Split every dollar" — the plan splits income Needs/Wants/Savings against a
    sample month. Mirrors the Spending page. */
function SplitGraphic({ theme }: { theme: OtterfundTheme }) {
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
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-of-faint)]">
          Every dollar, split
        </span>
        <span className="of-num text-[14px] font-medium">
          {fmtWhole(SHOWCASE_INCOME)}
          <span className="text-[12px] text-[var(--color-of-muted)]"> / mo</span>
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
            <span className="text-[11.5px] text-[var(--color-of-muted)]">{b.label}</span>
            <span className="of-num text-[11.5px] font-medium text-[var(--color-of-ink)]">{fmtWhole(b.amount)}</span>
          </div>
        ))}
      </div>

    </div>
  );
}

/** "Watch your goals grow" — the Savings bucket funds goals by priority, and a
    sample nudge shows the tone of otterfund's insights. Mirrors the Goals page. */
function GoalsGraphic({ theme }: { theme: OtterfundTheme }) {
  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-of-faint)]">
        <Target className="h-3.5 w-3.5" style={{ color: theme.accent }} strokeWidth={2.2} />
        Savings, put to work
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {SAVINGS_GOALS.map((g) => (
          <div
            key={g.name}
            className="flex items-center gap-3 rounded-xl border border-[var(--color-of-line-soft)] bg-[var(--color-of-surface)] px-3.5 py-2.5"
          >
            <ProgressRing value={g.pct} size={42} stroke={5} color={theme.accent}>
              <span className="text-[16px] leading-none">{g.emoji}</span>
            </ProgressRing>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-semibold text-[var(--color-of-ink)]">{g.name}</span>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold"
                  style={{ background: theme.accentTint, color: theme.accentDeep }}
                >
                  On track
                </span>
              </div>
              <div className="of-num mt-0.5 text-[11.5px] text-[var(--color-of-muted)]">
                <span style={{ color: theme.accentDeep }}>+{fmtWhole(g.perMo)}</span>/mo
              </div>
            </div>
            <span className="of-num ml-auto text-[15px] font-medium" style={{ color: theme.accentDeep }}>
              {g.pct}%
            </span>
          </div>
        ))}
      </div>
      <div
        className="mt-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-3"
        style={{ background: theme.accentTint, borderColor: theme.accentTintBorder }}
      >
        <OtterFace className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: theme.accentDeep }} strokeWidth={2} />
        <p className="text-[12.5px] leading-relaxed" style={{ color: theme.accentDeep }}>
          You&apos;re two months ahead on Vacation. A quiet win worth keeping.
        </p>
      </div>
    </div>
  );
}

const STEP_GRAPHICS = [ImportGraphic, SplitGraphic, GoalsGraphic];

/** "How it works" — a full-bleed surface band (hairline top and bottom) so the
    page gets a distinct second act instead of more cards floating on canvas.
    Three numbered steps act as tabs for the graphic panel; while the band is on
    screen the steps advance on their own every few seconds until the visitor
    takes over (hover/click latches auto-advance off). Reduced motion opts out. */
function HowItWorksSection() {
  const { ref, inView } = useInView<HTMLElement>(0.25);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!inView || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((i) => (i + 1) % STEPS.length), 4500);
    return () => clearInterval(t);
  }, [inView, paused]);

  const pick = (i: number) => {
    setPaused(true);
    setActive(i);
  };

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="self-stretch -mx-7 mt-24 sm:mt-36 scroll-mt-14 border-y border-[var(--color-of-line-soft)] bg-[var(--color-of-surface)] px-7 pt-14 sm:pt-20 pb-28 sm:pb-40"
    >
      <div className="mx-auto w-full max-w-[1120px]">
        <Reveal className="max-w-xl">
          <CardLabel>How it works</CardLabel>
          <h2
            className="mt-3 text-[clamp(26px,3.4vw,38px)] tracking-[-0.02em] leading-tight text-balance"
            style={{ ...SERIF, fontWeight: 500 }}
          >
            Three steps.{" "}
            <em className="text-[var(--color-primary)]" style={{ fontStyle: "italic" }}>
              That&apos;s the whole system.
            </em>
          </h2>
        </Reveal>

        {/* Guided tour — vertical steps on the left drive the graphic panel on
            the right (they stack below lg). The active step carries a thin fill
            that sweeps in time with the auto-advance, so the rotation reads as
            a tour, not content jumping on its own. Hovering pauses the tour;
            it picks back up from the current step once the pointer leaves. */}
        <div
          className="mt-8 grid grid-cols-[minmax(0,1fr)] items-center gap-4 sm:mt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-stretch lg:gap-12"
          onMouseLeave={() => setPaused(false)}
        >
          {/* Below lg the steps sit in one horizontal row of compact tabs
              (descriptions fold away — the graphic tells the story); at lg they
              become the full vertical list beside the panel. */}
          <div className="grid grid-cols-3 gap-2 lg:flex lg:flex-col lg:justify-between">
            {STEPS.map((s, i) => {
              const on = active === i;
              const note = SCHEMES[i % SCHEMES.length];
              const noteTheme = deriveTheme(note.value);
              return (
                <Reveal key={s.title} delay={i * 90} className="h-full">
                  <button
                    type="button"
                    onMouseEnter={() => pick(i)}
                    onFocus={() => pick(i)}
                    onClick={() => pick(i)}
                    aria-pressed={on}
                    className={cn(
                      "group relative flex h-full w-full flex-col items-center gap-2.5 rounded-2xl border p-3 pb-5 text-center transition-colors lg:flex-row lg:items-start lg:gap-4 lg:p-5 lg:pb-6 lg:text-left",
                      on
                        ? "border-[var(--color-of-line)] bg-[var(--color-of-canvas)]"
                        : "border-transparent hover:bg-[var(--color-of-canvas)]/60"
                    )}
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(.22,.61,.36,1)] group-hover:-translate-y-0.5"
                      style={{
                        background: on ? note.value : noteTheme.accentTint,
                        color: on ? "#ffffff" : note.value,
                      }}
                    >
                      <s.icon className="h-5 w-5" strokeWidth={1.9} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-of-faint)] lg:text-[10.5px]">
                        Step {i + 1}
                      </div>
                      <div className="mt-0.5 text-[13px] font-semibold leading-snug text-[var(--color-of-ink)] lg:mt-1 lg:text-[14.5px]">
                        {s.title}
                      </div>
                      <div className="mt-0.5 hidden text-[12.5px] leading-relaxed text-[var(--color-of-muted)] lg:block">
                        {s.desc}
                      </div>
                    </div>
                    {on && inView && !paused && (
                      <span
                        aria-hidden
                        className="of-step-track absolute inset-x-4 bottom-2 h-[2.5px] overflow-hidden rounded-full bg-[var(--color-of-line-soft)] lg:inset-x-5 lg:bottom-2.5"
                      >
                        <span
                          key={active}
                          className="of-step-fill block h-full rounded-full"
                          style={{ background: note.value }}
                        />
                      </span>
                    )}
                  </button>
                </Reveal>
              );
            })}
          </div>

          {/* The graphic that answers the active step — all three sit in a
              horizontal track that slides to the active one, carousel-style.
              The track height holds to the tallest graphic so nothing jumps. */}
          <Reveal delay={150}>
            <div className="relative overflow-hidden rounded-[20px] border border-[var(--color-of-line)] bg-[var(--color-of-canvas)]">
              <div
                className="flex transition-transform duration-[550ms] ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none"
                style={{ transform: `translateX(-${active * 100}%)` }}
              >
                {STEP_GRAPHICS.map((Graphic, i) => (
                  <div
                    key={i}
                    aria-hidden={active !== i}
                    className="flex w-full shrink-0 items-center p-6 sm:p-8"
                  >
                    <Graphic theme={deriveTheme(SCHEMES[i % SCHEMES.length].value)} />
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Trust, in one quiet line — the privacy story without a whole section. */}
        <Reveal className="mt-8">
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[12px] font-medium text-[var(--color-of-faint)]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
              Bank-grade encryption
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" strokeWidth={2} />
              Private by default
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5" strokeWidth={2} />
              Bank sync by Plaid
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** FAQ — real, useful answers to the questions people actually search: how to
    start budgeting, how to save money each month, how to allocate income across
    Needs/Wants/Savings, is it free, does it use AI, is it secure. Native
    <details> accordions (accessible, JS-free, fully crawlable) so the content is
    indexed as-is; it mirrors the FAQPage JSON-LD emitted on the home route. */
/** FAQ copy lives in FAQ_ITEMS as plain strings because those same strings
    are emitted as FAQPage JSON-LD (faqLd), which must stay raw text for search
    engines. Here we render the brand name as a <Wordmark> for the VISIBLE
    accordion only — split on the literal, drop a <Wordmark> between the pieces.
    Surrounding spaces live inside the string segments, so no bare-JSX-space
    trimming to worry about. */
function withWordmark(text: string) {
  // Split on the whole word only (\b guards against "otterfunds" firing
  // mid-word) and case-insensitively (a sentence-leading "Otterfund" still
  // becomes the wordmark, which always renders lowercase). <Wordmark> supplies
  // its own text, so the matched token is dropped; surrounding spaces live in
  // the string segments, so spacing is preserved.
  const parts = text.split(/\botterfund\b/i);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && <Wordmark />}
    </Fragment>
  ));
}

function FaqSection() {
  return (
    <section id="faq" className="mt-24 sm:mt-32 w-full max-w-[820px] scroll-mt-24">
      <Reveal className="max-w-2xl">
        <CardLabel>Answers</CardLabel>
        <h2
          className="mt-3 text-[clamp(26px,3.4vw,38px)] tracking-[-0.02em] leading-tight text-balance"
          style={{ ...SERIF, fontWeight: 500 }}
        >
          Budgeting questions,{" "}
          <em className="text-[var(--color-primary)]" style={{ fontStyle: "italic" }}>
            answered plainly.
          </em>
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-of-muted)]">
          How to start budgeting, save money every month, and allocate your income
          across Needs, Wants, and Savings, with <Wordmark />{" "}doing the math.
        </p>
      </Reveal>

      <div className="mt-8 grid gap-2 sm:mt-10 sm:gap-3">
        {FAQ_ITEMS.map((item, i) => (
          <Reveal key={item.q} delay={i * 60}>
            {/* shared name → native single-open accordion: opening one closes
                the rest (no JS), the standard FAQ pattern. */}
            <details name="faq" className="of-faq group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden sm:gap-4 sm:px-6 sm:py-5">
                <h3 className="text-[14.5px] font-semibold text-[var(--color-of-ink)] transition-colors duration-200 group-hover:text-[var(--color-primary)] group-open:text-[var(--color-primary)] sm:text-[16px]">
                  {withWordmark(item.q)}
                </h3>
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-of-canvas)] text-[var(--color-of-muted)] transition-all duration-200 group-open:bg-[var(--color-primary)] group-open:text-[var(--primary-foreground)] sm:h-7 sm:w-7"
                  aria-hidden
                >
                  <ChevronDown
                    className="h-[14px] w-[14px] transition-transform duration-300 group-open:rotate-180 sm:h-[15px] sm:w-[15px]"
                    strokeWidth={2.25}
                  />
                </span>
              </summary>
              <p className="px-4 pb-4 pr-12 text-[13.5px] leading-relaxed text-[var(--color-of-muted)] sm:px-6 sm:pb-6 sm:pr-16 sm:text-[14px]">
                {withWordmark(item.a)}
              </p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** The closing finale — the layer the page sheet lifts off of (it's fixed
    behind the sheet; LandingView owns the curtain structure). The deep
    evergreen brand panel, oversized and minimal: engraved line-work, palette
    dots, one huge serif line, one sentence, a light CTA. The footer lives here
    too, at the bottom of the revealed layer. */
function ClosingBand() {
  return (
    <>
      {/* engraved line-work — the dark panel's signature, same as the plans band */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <GuillocheFlow accent={PANEL_LINE} accentDeep={PANEL_LINE_DEEP} opacity={0.12} fade="none" speed={4} />
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-7">
        <section className="w-full max-w-[1120px] text-center">
          <div className="flex items-center justify-center gap-2.5" aria-hidden>
            {SCHEMES.map((s) => (
              <span key={s.name} className="h-2.5 w-2.5 rounded-full" style={{ background: s.value }} />
            ))}
          </div>
          <h2
            className="mx-auto mt-8 max-w-4xl text-[clamp(40px,6vw,72px)] tracking-[-0.03em] leading-[1.05] text-balance"
            style={{ ...SERIF, fontWeight: 500, color: PANEL_INK }}
          >
            Forget the spreadsheets,{" "}
            <em style={{ fontStyle: "italic", color: PANEL_ACCENT }}>we&apos;ll handle the setup.</em>
          </h2>
          <div className="mt-10 flex justify-center">
            <Link
              href="/register"
              className={cn(
                CTA_PRIMARY,
                "h-14 px-8 text-[16px] bg-[oklch(97%_0.014_95)] text-[oklch(26%_0.055_155)]"
              )}
            >
              Start for free <ArrowRight className="of-lp-arrow w-4 h-4" />
            </Link>
          </div>
          <p className="mt-4 text-[12.5px] font-medium" style={{ color: "oklch(86% 0.03 150 / 0.65)" }}>
            Free to get started · No credit card required
          </p>
        </section>
      </div>

      <footer className="relative border-t border-[oklch(95%_0.03_150_/_0.16)] py-7">
        <div className="max-w-[1120px] mx-auto px-7 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[12px] text-[oklch(86%_0.03_150_/_0.75)]">
            <LogoMark size={16} />
            <Wordmark />
          </div>
          <nav className="flex items-center gap-5 text-[12px]" aria-label="Footer">
            <Link
              href="/privacy"
              className="text-[oklch(86%_0.03_150_/_0.75)] transition-colors hover:text-[oklch(97%_0.014_95)]"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-[oklch(86%_0.03_150_/_0.75)] transition-colors hover:text-[oklch(97%_0.014_95)]"
            >
              Terms
            </Link>
            <a
              href={`mailto:${LEGAL.supportEmail}`}
              className="text-[oklch(86%_0.03_150_/_0.75)] transition-colors hover:text-[oklch(97%_0.014_95)]"
            >
              Contact us
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}

// ── the page ────────────────────────────────────────────────────────────────

/** Tracks whether the hero has been scrolled past. A sentinel sits at the
    hero/first-section boundary; once it leaves the top of the viewport we are
    "in the content" (slim header drops in), and it retracts when the hero comes
    back. IntersectionObserver, so there is no per-frame scroll work. */
function usePastHero() {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) =>
        setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { sentinelRef, past };
}

export function LandingView() {
  const { sentinelRef, past } = usePastHero();

  return (
    <div className="of-paper min-h-screen flex flex-col bg-[var(--color-of-canvas)] text-[var(--color-of-ink)] overflow-x-clip">
      {/* Slim header — slides down once the hero is scrolled past, retracts when
          the hero is back in view. Fixed above the page on every size; off-screen
          and non-interactive until `past`. */}
      <div
        aria-hidden={!past}
        className={cn(
          "fixed inset-x-0 top-0 z-[60] transform-gpu border-b border-[var(--color-of-line-soft)] bg-[var(--color-of-canvas)]/85 backdrop-blur-md transition-transform duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] motion-reduce:transition-none",
          past ? "translate-y-0" : "-translate-y-full pointer-events-none",
        )}
      >
        <div className="relative flex items-center justify-between px-5 sm:px-7 py-2.5 max-w-[1120px] mx-auto w-full">
          <Link href="/" aria-label="otterfund home" className="inline-flex items-center">
            <LogoMark size={30} />
          </Link>
          <div className="pointer-events-none absolute inset-x-0 hidden justify-center md:flex">
            <div className="pointer-events-auto flex items-center gap-1">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={scrollToId}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "xs" }),
                    "px-3 text-[13px] font-medium text-[var(--color-of-muted)] hover:text-[var(--color-of-ink)]",
                  )}
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "outline", size: "xs" }), "px-3.5")}
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className={cn(buttonVariants({ variant: "default", size: "xs" }), "px-3.5")}
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>

      {/* The page "sheet" — everything except the finale. The closing layer is
          fixed behind it (see below); the runway spacer after this sheet gives
          the scroll distance that lifts the sheet off the finale, curtain-style. */}
      <div className="relative z-10 flex min-h-screen flex-col bg-[var(--color-of-canvas)] shadow-[0_36px_72px_-24px_oklch(20%_0.03_80/0.35)]">
      {/* Nav — a plain header at the top of the page; scrolls away with content. */}
      <nav className="relative z-50">
        <div className="relative flex items-center justify-between px-7 py-4 max-w-[1120px] mx-auto w-full">
          <Link href="/" aria-label="otterfund home" className="inline-flex items-center">
            <LogoMark size={52} />
          </Link>
          {/* section links — centered independently of the logo/auth widths */}
          <div className="pointer-events-none absolute inset-x-0 hidden justify-center md:flex" aria-hidden={false}>
            <div className="pointer-events-auto flex items-center gap-1">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={scrollToId}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "xs" }),
                    "px-3.5 text-[13px] font-medium text-[var(--color-of-muted)] hover:text-[var(--color-of-ink)]"
                  )}
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-auto px-4 py-2 text-[13px]"
              )}
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className={cn(
                buttonVariants({ variant: "default" }),
                "h-auto px-4 py-2 text-[13px]"
              )}
            >
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center px-7 pb-28">
        {/* ── Hero ── */}
        <section className="relative w-full max-w-[1120px] pt-14 sm:pt-24 pb-6 sm:pb-10">
          {/* Gentle drifting banknote line-work behind the hero. It fades in on
              mount (of-lp-guilloche) so the texture arrives *with* the headline's
              float-up instead of a dash segment marching into view seconds later
              (which read as a "tail" randomly spawning). Slow drift so it never
              visibly regenerates that segment. Freezes under reduced motion. */}
          <div className="of-lp-guilloche absolute -inset-x-10 -top-10 bottom-0" aria-hidden>
            <GuillocheFlow
              accent={BRAND_THEME.accent}
              accentDeep={BRAND_THEME.accentDeep}
              fade="radial"
              opacity={0.06}
              speed={2}
            />
          </div>

          {/* Stacked, centered composition: headline band up top, card deck
              below. The deck's back cards fan wide and upward, so giving them
              their own full-width stage (instead of a side column) is what
              keeps them clear of the headline at every viewport. */}
          <div className="relative flex flex-col items-center text-center">
            {/* pitch */}
            <h1
              className="of-enter text-[clamp(30px,5vw,64px)] tracking-[-0.03em] leading-[1.03] sm:whitespace-nowrap mb-5"
              style={{ ...SERIF, fontWeight: 500, animationDelay: "140ms" }}
            >
              Your money,{" "}
              <em className="whitespace-nowrap text-[var(--color-primary)]" style={{ fontStyle: "italic" }}>
                in <RotatingWord words={HERO_WORDS} />
              </em>
            </h1>
            <p
              className="of-enter text-[17px] text-[var(--color-of-muted)] leading-relaxed max-w-md mb-8"
              style={{ animationDelay: "220ms" }}
            >
              Split every dollar across Needs, Wants, and Savings. <Wordmark />{" "}
              does the math so you don&apos;t have to.
            </p>
            <div
              className="of-enter flex flex-wrap items-center justify-center gap-3"
              style={{ animationDelay: "300ms" }}
            >
              <Link href="/register" className={CTA_PRIMARY}>
                Start saving <ArrowRight className="of-lp-arrow w-4 h-4" />
              </Link>
              <a href="#how-it-works" onClick={scrollToId} className={CTA_SECONDARY}>
                See how it works
              </a>
            </div>
            <p
              className="of-enter mt-4 text-[12.5px] font-medium text-[var(--color-of-faint)]"
              style={{ animationDelay: "360ms" }}
            >
              Free to get started · No credit card required
            </p>

            {/* live preview — top margin clears the back cards' upward fan
                (they translate ~-22% above the deck container). */}
            <div className="of-enter w-full mt-20 sm:mt-28" style={{ animationDelay: "420ms" }}>
              <DashboardPreview />
            </div>
          </div>

        </section>

        {/* Trigger for the slim header — the hero / first-section boundary. */}
        <div ref={sentinelRef} aria-hidden className="h-px w-full" />

        {/* ── How it works — full-bleed band, three steps + reactive graphic ── */}
        <HowItWorksSection />

        {/* ── Plans — the deep evergreen band, with the real plans as tabs.
            Pulled up over the "How it works" band's bottom edge so the dark
            panel straddles the section boundary — depth instead of a hard cut. */}
        <section id="plans" className="relative z-10 w-full max-w-[1120px] -mt-14 sm:-mt-24 scroll-mt-24">
          {/* No <Reveal> here — the settle-on-scroll entrance owns this band. */}
          <PlanShowpiece />
        </section>

        {/* ── Features — banknote feature plates + reactive headline ── */}
        <FeaturesSection />

        {/* ── FAQ — keyword-rich, genuinely useful answers (mirrors FAQ JSON-LD) ── */}
        <FaqSection />

      </main>
      </div>

      {/* Scroll runway — same height as the fixed finale below, so the last
          stretch of scroll lifts the page sheet off the closing layer. */}
      <div aria-hidden className="h-[85svh] min-h-[560px]" />

      {/* ── Closing finale — pinned behind the sheet, revealed by scroll. The
          deep evergreen brand panel: the page lifts to end on otterfund's colour. ── */}
      <div
        className="fixed inset-x-0 bottom-0 z-0 flex h-[85svh] min-h-[560px] flex-col overflow-hidden"
        style={{ background: PANEL_BG }}
      >
        <ClosingBand />
      </div>
    </div>
  );
}
