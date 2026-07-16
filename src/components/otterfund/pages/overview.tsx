"use client";

// otterfund — OVERVIEW page (the statement).
//
// A time-aware greeting leads into the net-worth hero — a serif figure floating
// over a live guilloché field, seated on the paper by a hairline cut. Beneath it
// the month reads as one honest line (income · spending · left over), then three
// hairline ledgers (where it went · goals · recent) flow down the page, and one
// deep-evergreen insight band carries the single bold moment. No bordered cards,
// no five competing note colours: one accent leads the eye, and colour survives
// only where it's data (a category's own tint). Every figure derives from
// `overview` and eases up from zero on mount.

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import type { DashboardOverview } from "@/lib/types";
import { type OtterfundTheme, hueOf, tintFor, CATEGORY_TINTS } from "@/components/otterfund/theme";
import { SegmentedToggle } from "@/components/otterfund/segmented-toggle";
import { fmt } from "@/lib/format";
import { ProgressBar, ProgressRing } from "@/components/otterfund/progress";
import { GuillocheFlow } from "@/components/otterfund/guilloche-flow";
import { GuillocheSeal } from "@/components/otterfund/guilloche";
import { Panel } from "@/components/otterfund/panel";
import { StatPill } from "@/components/otterfund/stat-pill";
import { CardLabel } from "@/components/otterfund/card";
import { NetWorthSparkline } from "@/components/otterfund/net-worth-sparkline";
import { MerchantAvatar } from "@/components/otterfund/merchant-avatar";
import { CategoryGlyph } from "@/components/otterfund/category-glyph";
import { Twemoji } from "@/components/otterfund/twemoji";
import { OtterFace } from "@/components/otterfund/logo";
import { Wordmark } from "@/components/otterfund/wordmark";
import { Statement, HeroBand, SectionHead, ViewAllLink, Ledger, Row } from "@/components/otterfund/ledger";
import { AddAccountEmptyState } from "@/components/otterfund/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OtterfundOverviewProps {
  overview: DashboardOverview;
  /** The signed-in user's name — powers the personal greeting. */
  name: string | null;
  accent: string;
  theme: OtterfundTheme;
  /** False when the user has no accounts at all — pivots the page to a cold-start
      "add an account" surface instead of a wall of $0 figures. */
  hasAccounts?: boolean;
  onAddAccount?: () => void;
  onConnectBank?: () => void;
  onNavigate?: (view: string) => void;
}

const SERIF = "var(--font-num), Georgia, serif";

/** Eased count-up from 0 → target on mount; jumps straight to target under
    reduced motion. Mirrors the landing hero's net-worth tween. */
function useTween(target: number, run: boolean, duration = 1200) {
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

export function OtterfundOverview({ overview, name, theme, hasAccounts = true, onAddAccount, onConnectBank, onNavigate }: OtterfundOverviewProps) {
  const cur = overview.currency;
  const money = (n: number) => fmt(n, cur);
  const signed = (n: number) => `${n < 0 ? "−" : "+"}${money(n)}`;
  const nwDown = overview.netWorthChange < 0;
  const surplusDown = overview.monthlySurplus < 0;

  // Count-up on mount. `started` flips true after the first client paint so the
  // figures ease up from zero (and it never diverges from SSR, which renders 0).
  const [started, setStarted] = useState(false);
  useEffect(() => setStarted(true), []);
  const nwTween = useTween(overview.netWorth, started);
  const cashTween = useTween(overview.cash, started);
  const nwChangeTween = useTween(overview.netWorthChange, started);
  const incomeTween = useTween(overview.monthlyIncome, started);
  const spendTween = useTween(overview.monthlySpend, started);
  const surplusTween = useTween(overview.monthlySurplus, started);

  // Time-aware greeting. Resolved client-side (in an effect) so the server and
  // client don't disagree on the hour across time zones.
  const firstName = name?.trim().split(/\s+/)[0] ?? null;
  const [timeWord, setTimeWord] = useState("Welcome back");
  const [monthLabel, setMonthLabel] = useState("");
  useEffect(() => {
    const now = new Date();
    const h = now.getHours();
    setTimeWord(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    setMonthLabel(now.toLocaleDateString(undefined, { month: "long" }));
  }, []);

  // Hero can show two figures: net worth (default, with trend) or the cash &
  // savings total (matching the accounts page group). Toggled via the eyebrow.
  const [heroView, setHeroView] = useState<"networth" | "cash">("networth");
  const showingCash = heroView === "cash";

  const cats = overview.spendingByCategory.slice(0, 5);
  const goals = overview.goals.slice(0, 3);
  const recent = overview.recentTransactions.slice(0, 5);

  // Spending as a share of income — the natural mirror of the surplus card's
  // savings rate. Null when there's no income to divide by.
  const spendPct =
    overview.monthlyIncome > 0 ? Math.round((overview.monthlySpend / overview.monthlyIncome) * 100) : null;

  // ── derive a real insight sentence from the data ──
  const savingsRate = Math.round(overview.savingsRate);
  const topCat = [...overview.spendingByCategory].sort((a, b) => b.amount - a.amount)[0];
  const insight =
    savingsRate > 0
      ? `You're saving ${savingsRate}% of your income this month — ${money(overview.monthlySurplus)} set aside toward what matters.`
      : topCat
        ? `${topCat.name} is your largest category at ${money(topCat.amount)}, about ${Math.round(topCat.pct)}% of this month's spending.`
        : `You've spent ${money(overview.monthlySpend)} so far this month against ${money(overview.monthlyIncome)} of income.`;

  // The insight band — the page's one bold moment, in the active accent's hue
  // (a deep evergreen by default) rather than a separate note colour.
  const hue = hueOf(theme.accent);
  const band = {
    bg: `linear-gradient(158deg, oklch(41% 0.115 ${hue}) 0%, oklch(33% 0.095 ${hue}) 52%, oklch(27% 0.08 ${hue}) 100%)`,
    ink: `oklch(97% 0.014 ${hue})`,
    accent: `oklch(84% 0.1 ${hue})`,
    line: `oklch(88% 0.07 ${hue})`,
    lineDeep: `oklch(80% 0.08 ${hue})`,
  };

  // The greeting leads every state of the page — including the cold start, so a
  // brand-new user still gets a personal welcome above the "add an account" call.
  const greeting = (
    <div style={{ paddingBottom: 6 }}>
      <h2
        style={{
          margin: 0,
          fontFamily: SERIF,
          fontWeight: 500,
          fontSize: "clamp(19px, 2.3vw, 26px)",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          color: "var(--color-of-ink)",
        }}
      >
        {timeWord}
        {firstName && (
          <>
            , <em style={{ fontStyle: "italic", color: theme.accentDeep }}>{firstName}</em>
          </>
        )}
      </h2>
      <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--color-of-muted)" }}>
        Here&rsquo;s where your money stands today.
      </p>
    </div>
  );

  // Cold start — no accounts at all. Skip the net-worth hero and every $0 ledger
  // (they'd only read as broken) and lead straight into how to get started.
  if (!hasAccounts) {
    return (
      <Statement>
        {/* Cold start has no hero — anchor the greeting so the tour card stays
            on-screen (a tall target soft-locks). */}
        <div data-tour="overview-hero">{greeting}</div>
        <AddAccountEmptyState
          theme={theme}
          onAdd={onAddAccount}
          onConnect={onConnectBank}
          title="Add an account to see your money"
          description="Connect a bank to sync your balances and transactions automatically, or add an account by hand. Your net worth, spending and goals all build from here."
        />
      </Statement>
    );
  }

  return (
    <Statement>
      {/* Greeting + net-worth hero are the first-run tour's Overview spotlight —
          from the greeting down through the hero's hairline cut. */}
      <div data-tour="overview-hero">
      {/* ── greeting ── */}
      {greeting}

      {/* ── net-worth hero — the one engraved moment ── */}
      <HeroBand
        theme={theme}
        ariaLabel="Net worth"
        asideGrow
        aside={
          showingCash ? undefined : (
            <NetWorthSparkline trend={overview.netWorthTrend} theme={theme} money={money} signed={signed} currency={cur} />
          )
        }
        eyebrow={
          <SegmentedToggle
            ariaLabel="Hero figure"
            theme={theme}
            value={heroView}
            onChange={setHeroView}
            options={[
              { value: "networth", label: "Net worth" },
              { value: "cash", label: "Cash flow" },
            ]}
          />
        }
        figure={money(showingCash ? cashTween : nwTween)}
        meta={
          showingCash ? (
            <div style={{ fontSize: 13, color: "var(--color-of-muted)" }}>
              Total across your cash &amp; savings accounts
            </div>
          ) : (
            <StatPill
              theme={theme}
              tone={nwDown ? "clay" : "accent"}
              bare
              figure={signed(nwChangeTween)}
              label="this month"
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d={nwDown ? "M7 7 17 17M9 17h8V9" : "M7 17 17 7M9 7h8v8"} />
                </svg>
              }
            />
          )
        }
      />
      </div>

      {/* ── this month — one honest line, hairline-split ── */}
      <CardLabel style={{ margin: "40px 0 18px" }}>
        This month{monthLabel && ` · ${monthLabel}`}
      </CardLabel>
      <section className="of-trio" aria-label="This month">
        <Panel theme={theme} padding="18px 16px" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: 12.5, color: "var(--color-of-muted)", fontWeight: 500 }}>
            <ArrowUpRight size={16} strokeWidth={2.6} color={theme.accentDeep} aria-hidden="true" />
            Income
          </div>
          <div className="of-num" style={{ fontSize: 21, letterSpacing: "-0.02em", marginTop: 7, color: theme.accentDeep }}>
            {money(incomeTween)}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-of-faint)", marginTop: 3 }}>total received</div>
        </Panel>
        <Panel theme={theme} padding="18px 16px" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: 12.5, color: "var(--color-of-muted)", fontWeight: 500 }}>
            <ArrowDownLeft size={16} strokeWidth={2.6} color="var(--color-of-muted)" aria-hidden="true" />
            Spending
          </div>
          <div className="of-num" style={{ fontSize: 21, letterSpacing: "-0.02em", marginTop: 7 }}>
            {money(spendTween)}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-of-faint)", marginTop: 3 }}>
            {spendPct != null ? `${spendPct}% of income` : "total spent"}
          </div>
        </Panel>
        {/* Left over — the one dark trio card, minted with a liquid guilloché so
            it "pops" against the two light figures beside it. */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            minWidth: 0,
            borderRadius: 20,
            padding: "18px 16px",
            textAlign: "center",
            background: band.bg,
            boxShadow: `0 1px 2px oklch(20% 0.02 80 / 0.05), 0 14px 34px oklch(30% 0.06 ${hue} / 0.22)`,
          }}
        >
          <GuillocheFlow accent={band.line} accentDeep={band.lineDeep} opacity={0.18} fade="none" speed={3} warp={6} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: 12.5, color: band.accent, fontWeight: 500 }}>
              <Wallet size={16} strokeWidth={2.4} color={band.accent} aria-hidden="true" />
              {surplusDown ? "Overspent" : "Left over"}
            </div>
            <div className="of-num" style={{ fontSize: 21, letterSpacing: "-0.02em", marginTop: 7, color: band.ink }}>
              {signed(surplusTween)}
            </div>
            <div style={{ fontSize: 12, color: band.accent, marginTop: 3 }}>
              {surplusDown
                ? "more went out than came in"
                : overview.monthlyIncome <= 0
                  ? "no money in yet this month"
                  : `${savingsRate}% savings rate`}
            </div>
          </div>
        </div>
      </section>

      {/* ── where it went · recent activity (two-up, stacks on tablet) ── */}
      <section
        className="of-grid-2up"
        style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}
      >
        <Panel theme={theme}>
          <SectionHead title="Where it went" action={<ViewAllLink label="All spending" onClick={() => onNavigate?.("spending")} />} />
          {cats.length > 0 ? (
            <Ledger>
              {cats.map((c) => {
                // The glyph is a category IDENTITY mark, so it keeps its category's
                // own deep colour (as it did before the redesign). Categories not in
                // the tint map (e.g. "Other") fall back to the accent's deep tone —
                // never the near-grey neutral, which is what left these icons flat.
                const catTint = CATEGORY_TINTS[c.name];
                const glyphColor = catTint ? catTint[1] : theme.accentDeep;
                return (
                  <Row key={c.categoryId} columns="40px 1fr" gap={15} padding="15px 12px">
                    <CategoryGlyph category={c.name} color={glyphColor} size={36} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5, marginBottom: 9 }}>
                        <span style={{ fontWeight: 500 }}>{c.name}</span>
                        <span className="of-num" style={{ color: "var(--color-of-muted)" }}>{money(c.amount)}</span>
                      </div>
                      <ProgressBar value={c.pct} />
                    </div>
                  </Row>
                );
              })}
            </Ledger>
          ) : (
            <EmptyBlock theme={theme} text="No spending yet this month." />
          )}
        </Panel>

        <Panel theme={theme}>
          <SectionHead title="Recent activity" action={<ViewAllLink label="All transactions" onClick={() => onNavigate?.("transactions")} />} />
          {recent.length > 0 ? (
            <Ledger>
              {recent.map((t) => {
                const [tileBg, tileInk] = tintFor(t.category);
                const isIncome = t.amount > 0;
                return (
                  <Row key={t.id} columns="40px 1fr auto" gap={15} padding="15px 12px">
                    <MerchantAvatar name={t.name} bg={tileBg} ink={tileInk} size={36} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {t.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-of-faint)" }}>{t.category}</div>
                    </div>
                    <div className="of-num" style={{ fontSize: 14.5, fontWeight: 500, color: isIncome ? theme.accentDeep : "var(--color-of-ink)" }}>
                      {isIncome ? "+" : "−"}{money(Math.abs(t.amount))}
                    </div>
                  </Row>
                );
              })}
            </Ledger>
          ) : (
            <EmptyBlock theme={theme} text="No transactions yet this month." />
          )}
        </Panel>
      </section>

      {/* ── goals · insight (two-up, stacks on tablet) ── */}
      <section
        className="of-grid-2up"
        style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "stretch" }}
      >
        <Panel theme={theme}>
        <SectionHead title="Goals on track" action={<ViewAllLink label="All goals" onClick={() => onNavigate?.("goals")} />} />
        {goals.length > 0 ? (
          // Reserve the height of three goal rows (44px ring + 15px padding
          // each side = 74px per row) so the column — and the insight band that
          // stretches beside it — stays a consistent height whether the user has
          // two goals or three, and never looks off when a third appears.
          <Ledger style={{ minHeight: 74 * 3 }}>
            {goals.map((g) => {
              const pct = g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0;
              return (
                <Row key={g.id} columns="44px 1fr auto" gap={15} padding="15px 12px">
                  <ProgressRing value={pct} size={44} stroke={5} color={theme.accent}>
                    {g.emoji && <Twemoji emoji={g.emoji} size={16} />}
                  </ProgressRing>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {g.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-of-faint)" }}>
                      <span className="of-num">{money(g.saved)}</span> of <span className="of-num">{money(g.target)}</span>
                    </div>
                  </div>
                  <span className="of-num" style={{ fontSize: 15, fontWeight: 500, color: theme.accentDeep }}>
                    {pct}%
                  </span>
                </Row>
              );
            })}
          </Ledger>
        ) : (
          <EmptyBlock theme={theme} text="No goals yet — set one to start saving with intent." />
        )}
        </Panel>

        {/* ── the insight — the one bold moment, a square beside the goals ── */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Open insights"
        onClick={() => onNavigate?.("insights")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onNavigate?.("insights");
          }
        }}
        style={{
          position: "relative",
          overflow: "hidden",
          background: band.bg,
          borderRadius: 22,
          padding: 24,
          height: "100%",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          boxShadow: "0 22px 55px oklch(30% 0.06 158 / 0.24)",
          cursor: "pointer",
          outline: "none",
        }}
      >
        <GuillocheFlow accent={band.line} accentDeep={band.lineDeep} opacity={0.15} fade="none" speed={4} />
        <div
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: band.accent,
          }}
        >
          <OtterFace size={15} strokeWidth={1.9} />
          <Wordmark style={{ fontWeight: 700, letterSpacing: "0.08em" }} />{" "}insight
        </div>
        <p
          style={{
            position: "relative",
            fontFamily: SERIF,
            fontSize: 19,
            lineHeight: 1.35,
            letterSpacing: "-0.01em",
            margin: "16px 0 0",
            color: band.ink,
            maxWidth: "52ch",
          }}
        >
          {insight}
        </p>
        <span
          className={cn(buttonVariants({ size: "sm" }), "relative mt-6 self-start")}
          style={{ background: band.ink, color: `oklch(26% 0.05 ${hue})` }}
        >
          See more insights →
        </span>
      </div>
      </section>
    </Statement>
  );
}

/** Compact centred empty state — the GuillocheSeal used across the app. */
function EmptyBlock({ theme, text }: { theme: OtterfundTheme; text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 140, textAlign: "center" }}>
      <div style={{ width: 52, height: 52 }} aria-hidden="true">
        <GuillocheSeal accent={theme.accent} accentDeep={theme.accentDeep} label="$" />
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--color-of-muted)", maxWidth: 260 }}>{text}</p>
    </div>
  );
}
