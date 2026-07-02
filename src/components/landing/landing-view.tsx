"use client";

// Bulga — landing page.
//
// The pre-auth pitch, told in the brand's banknote language: engraved
// guilloché line-work, Newsreader figures, one evergreen accent. Motion is
// calm and purposeful — the hero field drifts, a dashboard preview draws its
// own sparkline while the net-worth figure counts up, a ticker of everyday
// transactions rolls by, and sections reveal on scroll. All of it degrades to
// a static layout under prefers-reduced-motion (CSS in globals.css, "Landing").

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ListChecks, Sparkles, Target, Wallet } from "lucide-react";

import { Card, CardLabel } from "@/components/bulga/card";
import { GuillocheSeal } from "@/components/bulga/guilloche";
import { GuillocheFlow } from "@/components/bulga/guilloche-flow";
import { LogoMark } from "@/components/bulga/logo";
import { BRAND_THEME, SCHEMES, tintFor } from "@/components/bulga/theme";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";

const SERIF: React.CSSProperties = { fontFamily: "var(--font-num), Georgia, serif" };

const CTA_PRIMARY =
  "bk-lp-cta inline-flex items-center gap-2 text-sm font-semibold text-white bg-[var(--color-primary)] px-6 py-3 rounded-full hover:brightness-[1.06] transition-[filter] shadow-[0_1px_2px_oklch(40%_0.1_158/0.3)]";
// Opaque fill: this pill sits over the guilloché field, which shows through a
// transparent button and reads as broken.
const CTA_GHOST =
  "inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-bk-ink)] border border-[var(--color-bk-line)] bg-[var(--color-bk-canvas)] px-6 py-3 rounded-full hover:bg-[var(--color-bk-surface)] transition-colors";

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

const TICKER: { name: string; cat: string; amount: number }[] = [
  { name: "Paycheque", cat: "Income", amount: 2150 },
  { name: "Groceries", cat: "Groceries", amount: -82.4 },
  { name: "Morning coffee", cat: "Dining out", amount: -6.25 },
  { name: "Transit pass", cat: "Transport", amount: -156 },
  { name: "Streaming", cat: "Subscriptions", amount: -16.99 },
  { name: "Rent", cat: "Housing", amount: -1450 },
  { name: "Pharmacy", cat: "Health", amount: -23.1 },
  { name: "Movie night", cat: "Entertainment", amount: -32.5 },
  { name: "Hydro bill", cat: "Bills", amount: -94.2 },
];

const FEATURES = [
  { icon: Wallet, title: "Everything in one place", desc: "Accounts, cards, and investments — one calm balance." },
  { icon: ListChecks, title: "Spending, made plain", desc: "See where every dollar went without the spreadsheet." },
  { icon: Target, title: "Goals with intent", desc: "Save toward what matters and watch it get closer." },
  { icon: Sparkles, title: "Insights that help", desc: "Quiet nudges from your own numbers — never lectures." },
];

// ── pieces ──────────────────────────────────────────────────────────────────

function TickerChip({ name, cat, amount }: { name: string; cat: string; amount: number }) {
  const [bg, ink] = tintFor(cat);
  const positive = amount > 0;
  return (
    <span className="inline-flex items-center gap-2.5 rounded-full border border-[var(--color-bk-line)] bg-[var(--color-bk-surface)] pl-4 pr-4 py-2 whitespace-nowrap">
      <span
        aria-hidden
        className="w-[9px] h-[9px] rounded-full shrink-0"
        style={{ background: ink, boxShadow: `0 0 0 3px ${bg}` }}
      />
      <span className="text-[13px] font-medium text-[var(--color-bk-muted)]">{name}</span>
      <span
        className={cn(
          "bk-num text-[13.5px]",
          positive ? "text-[var(--color-primary)]" : "text-[var(--color-bk-ink)]"
        )}
      >
        {positive ? "+" : "−"}
        {fmt(amount)}
      </span>
    </span>
  );
}

/** The showpiece — a live-feeling slice of the real Overview page: counting
    net-worth figure, self-drawing sparkline, this-month stat tiles. */
function DashboardPreview() {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);
  const netWorth = useCountUp(24180.62, inView);
  const income = useCountUp(6450, inView, 1200);
  const spending = useCountUp(4012.55, inView, 1350);
  const leftover = useCountUp(2437.45, inView, 1500);
  return (
    <div ref={ref} data-in={inView ? "" : undefined} className="w-full max-w-3xl">
      <Card className="relative overflow-hidden p-6 sm:p-8 text-left shadow-[0_18px_48px_oklch(20%_0.02_80/0.07)]">
        <div className="flex items-start justify-between mb-1">
          <CardLabel>Net worth</CardLabel>
          <div className="w-11 h-11 -mt-1 opacity-80">
            {/* The brand kit's "Verified seal" geometry (13/4/4). */}
            <GuillocheSeal accent={BRAND_THEME.accent} accentDeep={BRAND_THEME.accentDeep} petals={13} inner={4} pen={4} label="$" />
          </div>
        </div>

        <div
          className="bk-num text-[clamp(38px,5vw,54px)] tracking-[-0.03em] leading-none"
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
            className="w-full h-[110px]"
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
              stretches it horizontally, which would turn circles into
              ellipses. HTML circles stay round. */}
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

// ── the page ────────────────────────────────────────────────────────────────

export function LandingView() {
  return (
    <div className="bk-paper min-h-screen flex flex-col bg-[var(--color-bk-canvas)] text-[var(--color-bk-ink)] overflow-x-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-7 py-6 shrink-0 max-w-[1100px] mx-auto w-full">
        <Link href="/" aria-label="Bulga home" className="inline-flex items-center">
          <LogoMark size={40} />
        </Link>
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

      <main className="flex-1 flex flex-col items-center px-7 pt-10 sm:pt-16 pb-28">
        {/* ── Hero ── */}
        <div className="relative max-w-2xl py-10 text-center">
          {/* Gentle drifting banknote line-work behind the headline — freezes
              under prefers-reduced-motion. */}
          <GuillocheFlow
            accent={BRAND_THEME.accent}
            accentDeep={BRAND_THEME.accentDeep}
            fade="radial"
            opacity={0.12}
          />
          <h1
            className="bk-enter relative text-[clamp(42px,6vw,68px)] tracking-[-0.03em] leading-[1.04] text-balance mt-6 mb-5"
            style={{ ...SERIF, fontWeight: 500, animationDelay: "140ms" }}
          >
            Your money,{" "}
            <em className="text-[var(--color-primary)]" style={{ fontStyle: "italic" }}>
              in balance.
            </em>
          </h1>
          <p
            className="bk-enter relative text-[17px] text-[var(--color-bk-muted)] leading-relaxed max-w-md mx-auto mb-9"
            style={{ animationDelay: "220ms" }}
          >
            Calm, confident budgeting that does the math so you don&apos;t have
            to. Import statements, track spending, reach your goals.
          </p>
          <div
            className="bk-enter relative flex items-center justify-center gap-3"
            style={{ animationDelay: "300ms" }}
          >
            <Link href="/register" className={CTA_PRIMARY}>
              Start for free <ArrowRight className="bk-lp-arrow w-4 h-4" />
            </Link>
            <Link href="/login" className={CTA_GHOST}>
              Sign in
            </Link>
          </div>
        </div>

        {/* ── Dashboard preview ── */}
        <div className="bk-enter relative w-full max-w-5xl mt-12" style={{ animationDelay: "400ms" }}>
          {/* The flowing field behind the floating card — spills a little past
              it vertically, fades radially so it never hits an edge. */}
          <div className="absolute -inset-y-10 inset-x-0" aria-hidden>
            <GuillocheFlow
              accent={BRAND_THEME.accent}
              accentDeep={BRAND_THEME.accentDeep}
              fade="radial"
              opacity={0.13}
            />
          </div>
          <div className="relative flex justify-center">
            <DashboardPreview />
          </div>
        </div>

        {/* ── Features ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-24 max-w-4xl w-full">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 80} className="h-full">
              <Card hover className="h-full p-6 text-left">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-9 h-9 rounded-[11px] bg-[var(--accent)] flex items-center justify-center">
                    <f.icon className="w-[18px] h-[18px] text-[var(--color-primary)]" strokeWidth={1.9} />
                  </div>
                  <span className="bk-num text-[13px] text-[var(--color-bk-faint)]" style={{ fontStyle: "italic" }}>
                    0{i + 1}
                  </span>
                </div>
                <div className="text-[14px] font-semibold text-[var(--color-bk-ink)] mb-1.5">{f.title}</div>
                <div className="text-[12.5px] text-[var(--color-bk-muted)] leading-relaxed">{f.desc}</div>
              </Card>
            </Reveal>
          ))}
        </section>

        {/* ── Closing band ── */}
        <Reveal className="w-full max-w-4xl mt-24">
          <Card className="relative overflow-hidden px-8 py-14 sm:py-16 text-center">
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
              className="relative text-[clamp(28px,4vw,40px)] tracking-[-0.02em] leading-tight text-balance"
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
        <div className="max-w-[1100px] mx-auto px-7 flex flex-col sm:flex-row items-center justify-between gap-4">
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
