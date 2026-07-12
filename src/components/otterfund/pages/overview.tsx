"use client";

// otterfund — OVERVIEW page.
//
// A personal, time-aware greeting leads into the net-worth hero (count-up figure
// + live guilloché field + sparkline), this-month stats with icon-tile identity,
// a two-up of spending and goals (progress rings), then recent activity beside a
// deep evergreen otterfund-insight showpiece band — the landing's banknote
// language brought in-app. Every figure derives from `overview` and eases up
// from zero on mount (jumping straight to value under reduced motion).

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import type { DashboardOverview } from "@/lib/types";
import { type OtterfundTheme, accentFamilyTint, deriveTheme } from "@/components/otterfund/theme";
import { fmt } from "@/lib/format";
import { ProgressBar, ProgressRing } from "@/components/otterfund/progress";
import { GuillocheFlow } from "@/components/otterfund/guilloche-flow";
import { GuillocheSeal } from "@/components/otterfund/guilloche";
import { StatPill } from "@/components/otterfund/stat-pill";
import { NetWorthSparkline } from "@/components/otterfund/net-worth-sparkline";
import { MerchantAvatar } from "@/components/otterfund/merchant-avatar";
import { OtterFace } from "@/components/otterfund/logo";
import { Wordmark } from "@/components/otterfund/wordmark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OtterfundOverviewProps {
  overview: DashboardOverview;
  /** The signed-in user's name — powers the personal greeting. */
  name: string | null;
  accent: string;
  theme: OtterfundTheme;
  onNavigate?: (view: string) => void;
}

const CARD: React.CSSProperties = {
  background: "var(--color-of-surface)",
  border: "1px solid var(--color-of-line)",
  borderRadius: 20,
  padding: 24,
};

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

// Hand-drawn category glyphs (public/categories/*.png) are white+alpha masks,
// so filling the box with a colour tints the sketch to the active accent —
// the same engraved-icon treatment the landing uses on its feature cards.
const CATEGORY_GLYPHS = new Set([
  "bills", "dining_out", "entertainment", "groceries",
  "health", "housing", "other", "subscriptions", "transport",
]);

function glyphFor(category: string): string {
  const key = category.trim().toLowerCase().replace(/\s+/g, "_");
  return `/categories/${CATEGORY_GLYPHS.has(key) ? key : "other"}.png`;
}

/** A category's sketch glyph, tinted to `color` via CSS mask (landing-style). */
function CategoryGlyph({ category, color, size = 26 }: { category: string; color: string; size?: number }) {
  const src = glyphFor(category);
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: size,
        height: size,
        flexShrink: 0,
        background: color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

// The five Canadian-banknote note colours from the landing, one per page the
// overview previews. Each preview wears its note's accent (bars / rings / links /
// hover border) so the five surfaces read as five distinct places.
interface Note {
  hue: string;
  accent: string;
  deep: string;
  tint: string;
  tintBorder: string;
}
const NOTES: Record<"transactions" | "spending" | "accounts" | "goals" | "insights", Note> = {
  transactions: { hue: "250", accent: "oklch(52% 0.11 250)", deep: "oklch(40% 0.09 250)", tint: "oklch(95.5% 0.03 250)", tintBorder: "oklch(90% 0.045 250)" },
  spending: { hue: "25", accent: "oklch(53% 0.16 25)", deep: "oklch(43% 0.13 25)", tint: "oklch(95.5% 0.04 25)", tintBorder: "oklch(90% 0.055 25)" },
  accounts: { hue: "158", accent: "oklch(48% 0.115 158)", deep: "oklch(38% 0.092 158)", tint: "oklch(95.5% 0.03 158)", tintBorder: "oklch(90% 0.045 158)" },
  goals: { hue: "312", accent: "oklch(50% 0.13 312)", deep: "oklch(40% 0.1 312)", tint: "oklch(95.5% 0.035 312)", tintBorder: "oklch(90% 0.05 312)" },
  insights: { hue: "68", accent: "oklch(52% 0.075 68)", deep: "oklch(40% 0.06 68)", tint: "oklch(95.5% 0.025 68)", tintBorder: "oklch(90% 0.04 68)" },
};

/** A surface card that navigates on click — the whole preview is the target. */
function NavCard({
  note,
  onClick,
  ariaLabel,
  style,
  children,
}: {
  note: Note;
  onClick: () => void;
  ariaLabel: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = note.accent;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 12px 30px oklch(20% 0.02 80 / 0.09)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--color-of-line)";
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "none";
      }}
      style={{
        ...CARD,
        cursor: "pointer",
        outline: "none",
        transition: "transform .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s, border-color .2s",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** The coloured "View all →" affordance shown in a preview's header. */
function ViewLink({ color, label = "View all" }: { color: string; label?: string }) {
  // Decorative affordance inside a clickable NavCard — must stay a span (no
  // nested interactive element), but adopts the `link` button styling so it
  // matches the design system. Section color overrides the variant's default.
  return (
    <span className={cn(buttonVariants({ variant: "link" }), "text-[12.5px]")} style={{ color }}>
      {label} <span aria-hidden="true">→</span>
    </span>
  );
}

/** Small tinted icon tile that gives each stat card its own identity. */
function StatTile({ children, bg, ink }: { children: React.ReactNode; bg: string; ink: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 9,
        background: bg,
        color: ink,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

export function OtterfundOverview({ overview, name, theme, onNavigate }: OtterfundOverviewProps) {
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
  useEffect(() => {
    const h = new Date().getHours();
    setTimeWord(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);

  // Hero can show two figures: net worth (default, with trend) or the cash &
  // savings total (matching the accounts page group). Toggled via the eyebrow.
  const [heroView, setHeroView] = useState<"networth" | "cash">("networth");
  const showingCash = heroView === "cash";

  const cats = overview.spendingByCategory.slice(0, 5);
  const goals = overview.goals.slice(0, 4);
  const recent = overview.recentTransactions.slice(0, 5);

  // ── derive a real insight sentence from the data ──
  const savingsRate = Math.round(overview.savingsRate);
  const topCat = [...overview.spendingByCategory].sort((a, b) => b.amount - a.amount)[0];
  const insight =
    savingsRate > 0
      ? `You're saving ${savingsRate}% of your income this month. That's ${money(overview.monthlySurplus)} set aside toward what matters.`
      : topCat
        ? `${topCat.name} is your largest category at ${money(topCat.amount)}, about ${Math.round(topCat.pct)}% of this month's spending.`
        : `You've spent ${money(overview.monthlySpend)} so far this month against ${money(overview.monthlyIncome)} of income.`;

  // Per-note themes for the five previews (banknote colours from the landing),
  // so each preview reads as its own place regardless of the app accent.
  const tAccounts = deriveTheme(NOTES.accounts.accent);
  const tSpending = deriveTheme(NOTES.spending.accent);
  const tGoals = deriveTheme(NOTES.goals.accent);
  const tTx = deriveTheme(NOTES.transactions.accent);

  // Insights preview: the deep banknote band, in the $100 brown note.
  const hue = NOTES.insights.hue;
  const band = {
    bg: `linear-gradient(158deg, oklch(34% 0.064 ${hue}) 0%, oklch(25% 0.052 ${hue}) 52%, oklch(20% 0.044 ${hue}) 100%)`,
    ink: `oklch(97% 0.014 ${hue})`,
    muted: `oklch(86% 0.03 ${hue})`,
    accent: `oklch(84% 0.1 ${hue})`,
    line: `oklch(90% 0.05 ${hue})`,
    lineDeep: `oklch(82% 0.06 ${hue})`,
  };

  return (
    <div className="of-enter of-page">
      {/* ── greeting ── */}
      <div style={{ padding: "0 4px 18px" }}>
        <h2
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontWeight: 500,
            fontSize: "clamp(22px, 2.6vw, 30px)",
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
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--color-of-muted)" }}>
          Here&rsquo;s where your money stands today.
        </p>
      </div>

      {/* ── net worth hero · Accounts preview (green $20 note) ── */}
      <section
        className="of-nw-hero"
        onClick={() => onNavigate?.("accounts")}
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1.15fr 1fr",
          gap: 28,
          alignItems: "end",
          padding: "0 4px 36px",
          cursor: "pointer",
        }}
      >
        {/* Clip only the backdrop, not the section — so the sparkline tooltip
            can overflow past the hero edges instead of getting cut off. */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: 20 }}>
          <GuillocheFlow accent={tAccounts.accent} accentDeep={tAccounts.accentDeep} fade="left" opacity={0.14} speed={5} />
        </div>
        <div style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {(
                [
                  ["networth", "Net worth"],
                  ["cash", "Cash flow"],
                ] as const
              ).map(([key, label], i) => (
                <span key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {i > 0 && <span style={{ color: "var(--color-of-faint)" }} aria-hidden="true">/</span>}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHeroView(key);
                    }}
                    aria-pressed={heroView === key}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      font: "inherit",
                      letterSpacing: "inherit",
                      textTransform: "inherit",
                      transition: "color 140ms ease",
                      color: heroView === key ? tAccounts.accentDeep : "var(--color-of-faint)",
                    }}
                  >
                    {label}
                  </button>
                </span>
              ))}
            </div>
            {/* keyboard-accessible nav target (the whole hero is clickable too) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate?.("accounts");
              }}
              className={cn(buttonVariants({ variant: "link" }), "text-[12.5px] normal-case tracking-normal")}
              style={{ color: NOTES.accounts.accent }}
            >
              View accounts <span aria-hidden="true">→</span>
            </button>
          </div>
          <div
            className="of-num"
            style={{
              fontSize: "clamp(48px, 6vw, 68px)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              marginTop: 12,
            }}
          >
            {money(showingCash ? cashTween : nwTween)}
          </div>
          <div style={{ marginTop: 14 }}>
            {showingCash ? (
              <div style={{ fontSize: 13, color: "var(--color-of-muted)" }}>
                Total across your cash &amp; savings accounts
              </div>
            ) : (
              <StatPill
                theme={tAccounts}
                figure={signed(nwChangeTween)}
                label="this month"
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d={nwDown ? "M7 7 17 17M9 17h8V9" : "M7 17 17 7M9 7h8v8"} />
                  </svg>
                }
              />
            )}
          </div>
        </div>
        {!showingCash && (
          <NetWorthSparkline trend={overview.netWorthTrend} theme={tAccounts} money={money} signed={signed} currency={cur} />
        )}
      </section>

      {/* ── this-month stats ── */}
      <section
        className="of-grid-3"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginTop: 20,
          marginBottom: 16,
        }}
      >
        <div style={{ ...CARD, padding: "12px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatTile bg={theme.accentTint} ink={theme.accentDeep}>
              <ArrowDownLeft size={16} strokeWidth={2.2} aria-hidden="true" />
            </StatTile>
            <span style={{ fontSize: 12.5, color: "var(--color-of-muted)", fontWeight: 500 }}>Income</span>
          </div>
          <div className="of-num" style={{ fontSize: 23, letterSpacing: "-0.02em", marginTop: 6, color: theme.accentDeep }}>
            {money(incomeTween)}
          </div>
        </div>
        <div style={{ ...CARD, padding: "12px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatTile bg="var(--color-of-line-soft)" ink="var(--color-of-muted)">
              <ArrowUpRight size={16} strokeWidth={2.2} aria-hidden="true" />
            </StatTile>
            <span style={{ fontSize: 12.5, color: "var(--color-of-muted)", fontWeight: 500 }}>Spending</span>
          </div>
          <div className="of-num" style={{ fontSize: 23, letterSpacing: "-0.02em", marginTop: 6 }}>
            {money(spendTween)}
          </div>
        </div>
        <div style={{ background: theme.accent, borderRadius: 20, padding: "12px 20px", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatTile bg="rgba(255,255,255,0.22)" ink="#fff">
              <Wallet size={16} strokeWidth={2.2} aria-hidden="true" />
            </StatTile>
            <span style={{ fontSize: 12.5, opacity: 0.9, fontWeight: 500 }}>{surplusDown ? "Overspent" : "Left over"}</span>
          </div>
          <div className="of-num" style={{ fontSize: 23, letterSpacing: "-0.02em", marginTop: 6 }}>
            {signed(surplusTween)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{savingsRate}% savings rate</div>
        </div>
      </section>

      {/* ── two-up: Spending (red) + Goals (purple) previews ── */}
      <section className="of-grid-2up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <NavCard note={NOTES.spending} onClick={() => onNavigate?.("spending")} ariaLabel="View spending">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Where it went</h3>
            <ViewLink color={NOTES.spending.accent} />
          </div>
          {cats.length > 0 ? (
            cats.map((c) => (
              <div key={c.categoryId} style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 16 }}>
                <CategoryGlyph category={c.name} color={NOTES.spending.accent} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
                    <span style={{ fontWeight: 500 }}>{c.name}</span>
                    <span className="of-num" style={{ color: "var(--color-of-muted)" }}>{money(c.amount)}</span>
                  </div>
                  <ProgressBar value={c.pct} color={tSpending.accent} />
                </div>
              </div>
            ))
          ) : (
            <EmptyBlock theme={tSpending} text="No spending yet this month." />
          )}
        </NavCard>

        <NavCard note={NOTES.goals} onClick={() => onNavigate?.("goals")} ariaLabel="View goals">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Goals on track</h3>
            <ViewLink color={NOTES.goals.accent} />
          </div>
          {goals.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {goals.map((g) => {
                const pct = g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0;
                return (
                  <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <ProgressRing value={pct} size={44} stroke={5} color={NOTES.goals.accent}>
                      {g.emoji && <span style={{ fontSize: 16, lineHeight: 1 }}>{g.emoji}</span>}
                    </ProgressRing>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {g.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-of-faint)" }}>
                        <span className="of-num">{money(g.saved)}</span> of{" "}
                        <span className="of-num">{money(g.target)}</span>
                      </div>
                    </div>
                    <span className="of-num" style={{ fontSize: 15, fontWeight: 500, color: tGoals.accentDeep, flexShrink: 0 }}>
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyBlock theme={tGoals} text="No goals yet — set one to start saving with intent." />
          )}
        </NavCard>
      </section>

      {/* ── recent (Transactions · blue) + insight (Insights · brown) ── */}
      <section className="of-grid-split" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        <NavCard note={NOTES.transactions} onClick={() => onNavigate?.("transactions")} ariaLabel="View transactions">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Recent activity</h3>
            <ViewLink color={NOTES.transactions.accent} label="See all" />
          </div>
          {recent.length > 0 ? (
            recent.map((t, i) => {
              const [tileBg, tileInk] = accentFamilyTint(i, NOTES.transactions.accent);
              const isIncome = t.amount > 0;
              return (
                <div
                  key={t.id}
                  style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0", borderTop: "1px solid var(--color-of-line-soft)" }}
                >
                  <MerchantAvatar name={t.name} bg={tileBg} ink={tileInk} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-of-faint)" }}>{t.category}</div>
                  </div>
                  <div className="of-num" style={{ fontSize: 14.5, fontWeight: 500, color: isIncome ? tTx.accentDeep : "var(--color-of-ink)" }}>
                    {isIncome ? "+" : ""}{money(t.amount)}
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyBlock theme={tTx} text="No transactions yet this month." />
          )}
        </NavCard>

        {/* deep banknote showpiece — the AI insight, in the $100 brown note. */}
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
            borderRadius: 20,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 50px oklch(22% 0.05 68 / 0.28)",
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
              fontSize: 21,
              lineHeight: 1.35,
              letterSpacing: "-0.01em",
              margin: "16px 0 0",
              color: band.ink,
            }}
          >
            {insight}
          </p>
          <div style={{ flex: 1 }} />
          {/* Decorative CTA inside the clickable insight card — stays a span (no
              nested interactive element). Adopts the button base for pill shape,
              size, and press spring; cream-on-brown fill is hue-derived to read
              on the dark surface, so it overrides the variant's default colors. */}
          <span
            className={cn(buttonVariants({ size: "sm" }), "relative mt-5 self-start")}
            style={{
              background: band.ink,
              color: `oklch(26% 0.05 ${hue})`,
            }}
          >
            See more insights →
          </span>
        </div>
      </section>
    </div>
  );
}

/** Compact centred empty state — the GuillocheSeal used across the app. */
function EmptyBlock({ theme, text }: { theme: OtterfundTheme; text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 150, textAlign: "center" }}>
      <div style={{ width: 56, height: 56 }} aria-hidden="true">
        <GuillocheSeal accent={theme.accent} accentDeep={theme.accentDeep} label="$" />
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--color-of-muted)", maxWidth: 260 }}>{text}</p>
    </div>
  );
}
