"use client";

// otterfund — INVESTMENTS page (Blossom-inspired, our twist).
//
// Built on the user's synced investment ACCOUNTS (TFSA / RRSP / FHSA / Investment
// — see `accountGroupOf` → "invest") PLUS individually-tracked positions (Apple,
// Nvidia, …). The allocation donut is UNIFIED: every position is its own slice,
// and each account's un-itemized balance shows as a remainder slice — so adding a
// holding carves it out of its account with no double-counting. Total stays the
// real account value (+ any standalone positions).
//
// Holdings list mirrors Blossom: logo, ticker, shares · allocation %, value, and
// return. There is no live-price feed, so "return" is all-time vs cost basis
// (green up / clay down), not a daily change.

import { useState } from "react";
import type { AccountView, InvestmentView } from "@/lib/types";
import { type OtterfundTheme, accentFamilyTint, accentRamp } from "@/components/otterfund/theme";
import { fmt } from "@/lib/format";
import { ACCOUNT_TYPES, accountGroupOf } from "@/lib/constants";
import { ProgressBar } from "@/components/otterfund/progress";
import { DonutChart } from "@/components/otterfund/donut-chart";
import { GuillochePattern, GuillocheSeal } from "@/components/otterfund/guilloche";
import { MerchantAvatar } from "@/components/otterfund/merchant-avatar";
import { StatPill } from "@/components/otterfund/stat-pill";
import { Button } from "@/components/ui/button";
import { Plus, Landmark, TrendingUp, TrendingDown, ArrowLeft, ChevronRight } from "lucide-react";

interface OtterfundInvestmentsProps {
  accounts: AccountView[];
  holdings: InvestmentView[];
  accent: string;
  theme: OtterfundTheme;
  currency?: string;
  onConnect?: () => void;
  onAddPosition?: () => void;
  onEditPosition?: (h: InvestmentView) => void;
  onEditAccount?: (a: AccountView) => void;
  /** Return to the Accounts tab — Investments is reached as a drill-in from it. */
  onBack?: () => void;
}

const CARD: React.CSSProperties = {
  background: "var(--color-of-surface)",
  border: "1px solid var(--color-of-line)",
  borderRadius: 20,
  padding: 24,
};

const EYEBROW: React.CSSProperties = {
  fontSize: 11,
  color: "var(--color-of-faint)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 600,
};

const MAX_SLICES = 8;

// Drill key for the "positions not inside a tracked account" bucket.
const STANDALONE = "__standalone__";

function typeLabel(type: string): string {
  const t = type.trim().toLowerCase().replace(/-/g, " ");
  const known = ACCOUNT_TYPES.find((k) => k.toLowerCase() === t);
  return known ?? (t.charAt(0).toUpperCase() + t.slice(1));
}

function initialOf(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, "");
  return (letters[0] ?? name[0] ?? "?").toUpperCase();
}

function usableColor(bg: string | undefined): boolean {
  if (!bg) return false;
  const v = bg.trim().toLowerCase();
  return v.length > 0 && v !== "transparent" && v !== "none";
}

export function OtterfundInvestments({
  accounts,
  holdings,
  accent,
  theme,
  currency = "CAD",
  onConnect,
  onAddPosition,
  onEditPosition,
  onEditAccount,
  onBack,
}: OtterfundInvestmentsProps) {
  const money = (n: number) => fmt(n, currency);
  const pct = (n: number) => Math.round(n);

  // Investment accounts only (shared predicate with the Accounts page); hidden
  // accounts drop out, matching net worth.
  const invAccounts = accounts.filter((a) => accountGroupOf(a.type) === "invest" && !a.excluded);
  const invAcctIds = new Set(invAccounts.map((a) => a.id));
  const hasAccounts = invAccounts.length > 0;
  const hasHoldings = holdings.length > 0;
  const nothing = !hasAccounts && !hasHoldings;

  // Money already itemized inside each investment account (positions linked to it).
  const itemizedByAcct = new Map<string, number>();
  for (const h of holdings) {
    if (h.accountId && invAcctIds.has(h.accountId)) {
      itemizedByAcct.set(h.accountId, (itemizedByAcct.get(h.accountId) ?? 0) + h.value);
    }
  }

  const accountsTotal = invAccounts.reduce((s, a) => s + a.balance, 0);
  // Positions not inside a tracked investment account are separate money.
  const standaloneHoldings = holdings.filter((h) => !(h.accountId && invAcctIds.has(h.accountId)));
  const standaloneTotal = standaloneHoldings.reduce((s, h) => s + h.value, 0);
  const portfolioTotal = accountsTotal + standaloneTotal;
  const share = (v: number) => (portfolioTotal > 0 ? (v / portfolioTotal) * 100 : 0);

  // ── Allocation drill-down ──────────────────────────────────────────────────
  // Default: one slice per account (+ a "Direct holdings" bucket for positions
  // not inside a tracked account). Click an account → the donut re-renders to
  // what's inside it: its holdings, plus a remainder slice for the un-itemized
  // balance. An account with no itemized holdings (e.g. a home) shows as a single
  // full-balance slice, making it obvious all the money sits there.
  type Slice = { key: string; label: string; value: number; drillId?: string; holding?: InvestmentView };
  const [drillId, setDrillId] = useState<string | null>(null);
  // Slide direction (1 = drilling in, −1 = going back) and a nav counter that
  // re-keys the content so the slide animation replays on each navigation.
  const [dir, setDir] = useState<1 | -1>(1);
  const [navCount, setNavCount] = useState(0);
  const drillInto = (id: string) => {
    setDir(1);
    setNavCount((n) => n + 1);
    setDrillId(id);
  };
  const drillBack = () => {
    setDir(-1);
    setNavCount((n) => n + 1);
    setDrillId(null);
  };

  const drillAccount = drillId && drillId !== STANDALONE ? invAccounts.find((a) => a.id === drillId) : null;
  const inStandalone = drillId === STANDALONE && standaloneHoldings.length > 0;
  // If a drilled account vanished (e.g. after a refresh), fall back to default.
  const activeDrill: string | null = drillAccount ? drillId : inStandalone ? STANDALONE : null;

  let allocTitle = "Allocation";
  let centerLabel = "Total";
  let centerValue = portfolioTotal;
  let allocNote: string | undefined;
  const rawSlices: Slice[] = [];

  if (!activeDrill) {
    for (const a of invAccounts) {
      if (a.balance > 0.005) rawSlices.push({ key: `a:${a.id}`, label: a.name, value: a.balance, drillId: a.id });
    }
    if (standaloneTotal > 0.005) {
      rawSlices.push({
        key: "sa",
        label: standaloneHoldings.length === 1 ? standaloneHoldings[0].name : "Direct holdings",
        value: standaloneTotal,
        drillId: STANDALONE,
      });
    }
  } else if (inStandalone) {
    allocTitle = "Direct holdings";
    centerLabel = "Direct";
    centerValue = standaloneTotal;
    for (const h of standaloneHoldings) {
      if (h.value > 0.005) rawSlices.push({ key: `h:${h.id}`, label: h.name, value: h.value, holding: h });
    }
  } else if (drillAccount) {
    allocTitle = drillAccount.name;
    centerLabel = drillAccount.name;
    centerValue = drillAccount.balance;
    const linked = holdings.filter((h) => h.accountId === drillAccount.id);
    for (const h of linked) {
      if (h.value > 0.005) rawSlices.push({ key: `h:${h.id}`, label: h.name, value: h.value, holding: h });
    }
    const itemized = itemizedByAcct.get(drillAccount.id) ?? 0;
    const remainder = Math.max(0, drillAccount.balance - itemized);
    if (remainder > 0.005) {
      rawSlices.push({
        key: "rem",
        label: linked.length ? "Cash & other" : `${typeLabel(drillAccount.type)} balance`,
        value: remainder,
      });
    }
    if (linked.length === 0) allocNote = "Not itemized into holdings, so the full balance is shown here.";
  }
  rawSlices.sort((x, y) => y.value - x.value);

  // Cap to the top slices + an aggregated "Other" (Blossom does the same).
  let allocSlices = rawSlices;
  if (rawSlices.length > MAX_SLICES) {
    const top = rawSlices.slice(0, MAX_SLICES);
    const other = rawSlices.slice(MAX_SLICES).reduce((s, x) => s + x.value, 0);
    allocSlices = other > 0 ? [...top, { key: "other", label: "Other", value: other }] : top;
  }
  const rampColors = accentRamp(allocSlices.length, accent);
  const donutSegments = allocSlices.map((s, i) => ({ value: s.value, color: rampColors[i], label: s.label }));
  // Percent within the current level (of the account balance when drilled).
  const levelPct = (v: number) => (centerValue > 0 ? (v / centerValue) * 100 : 0);

  // Percent within the current level, and the slide class for the content.
  const slideClass = navCount === 0 ? undefined : dir === 1 ? "of-slide-in-right" : "of-slide-in-left";

  // Click a slice/legend row: drill into an account/bucket, or open a holding.
  const activateSlice = (i: number) => {
    const s = allocSlices[i];
    if (!s) return;
    if (s.drillId) drillInto(s.drillId);
    else if (s.holding && onEditPosition) onEditPosition(s.holding);
  };

  // ── Return (all-time vs cost basis) across positions that carry a cost basis.
  const withCost = holdings.filter((h) => h.costBasis != null && h.costBasis > 0);
  const investedTotal = withCost.reduce((s, h) => s + (h.costBasis ?? 0), 0);
  const totalReturn = withCost.reduce((s, h) => s + (h.gain ?? 0), 0);
  const totalReturnPct = investedTotal > 0 ? (totalReturn / investedTotal) * 100 : 0;
  const hasReturn = withCost.length > 0;

  // ── Live daily movement across holdings that resolved to a market quote.
  const livePositions = holdings.filter((h) => h.live && h.dayChange != null);
  const dayChangeTotal = livePositions.reduce((s, h) => s + (h.dayChange ?? 0), 0);
  const liveValueTotal = livePositions.reduce((s, h) => s + h.value, 0);
  const dayBase = liveValueTotal - dayChangeTotal;
  const dayChangePct = dayBase > 0 ? (dayChangeTotal / dayBase) * 100 : 0;
  const hasLive = livePositions.length > 0;

  // Headline change (hero): today's move when we have live prices, else all-time
  // return vs cost basis.
  const headline = hasLive
    ? { amount: dayChangeTotal, pct: dayChangePct, label: "today" }
    : hasReturn
      ? { amount: totalReturn, pct: totalReturnPct, label: "all-time" }
      : null;
  const headlineUp = (headline?.amount ?? 0) >= 0;

  const sortedHoldings = [...holdings].sort((a, b) => b.value - a.value);

  const changeText = (gain: number, gainPct: number) => {
    const up = gain >= 0;
    return `${up ? "+" : "−"}${money(Math.abs(gain))} (${up ? "+" : "−"}${pct(Math.abs(gainPct))}%)`;
  };

  // ── Holdings card (Blossom-style list) — reused whether or not there are
  // accounts, so it renders full-width when the portfolio is positions-only.
  const holdingsCard = (
    <div style={CARD}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 0 6px", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Holdings</h3>
        {hasHoldings && (
          <span style={{ fontSize: 12, color: "var(--color-of-faint)" }}>
            {hasLive ? `${livePositions.length} live` : `${holdings.length} tracked`}
          </span>
        )}
      </div>
      {hasHoldings ? (
        <div style={{ margin: "0 -4px" }}>
          {sortedHoldings.map((h, i) => {
            const [tileBg, tileInk] = accentFamilyTint(i, accent);
            const up = (h.gain ?? 0) >= 0;
            const sub = [
              h.quantity != null ? `${h.quantity} shares` : null,
              h.accountName || null,
              `${pct(share(h.value))}%`,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div
                key={h.id}
                role={onEditPosition ? "button" : undefined}
                tabIndex={onEditPosition ? 0 : undefined}
                onClick={onEditPosition ? () => onEditPosition(h) : undefined}
                onKeyDown={
                  onEditPosition
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onEditPosition(h);
                        }
                      }
                    : undefined
                }
                onMouseEnter={onEditPosition ? (e) => (e.currentTarget.style.background = "oklch(97.5% 0.005 90)") : undefined}
                onMouseLeave={onEditPosition ? (e) => (e.currentTarget.style.background = "transparent") : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 13,
                  padding: "12px 8px",
                  cursor: onEditPosition ? "pointer" : "default",
                  transition: "background .15s",
                  borderTop: i === 0 ? "none" : "1px solid var(--color-of-line-soft)",
                }}
              >
                <MerchantAvatar name={h.name} domain={h.domain} bg={tileBg} ink={tileInk} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {h.name}
                    </span>
                    {h.symbol && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.04em",
                          padding: "2px 6px",
                          borderRadius: 6,
                          background: "var(--color-of-line-soft)",
                          color: "var(--color-of-muted)",
                        }}
                      >
                        {h.symbol}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-of-faint)", marginTop: 2 }}>{sub}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="of-num" style={{ fontSize: 15, fontWeight: 500, whiteSpace: "nowrap" }}>
                    {money(h.value)}
                  </div>
                  {h.live && h.dayChange != null ? (
                    <div className="of-num" style={{ fontSize: 11, marginTop: 2, color: (h.dayChange ?? 0) >= 0 ? theme.accentDeep : theme.clay }}>
                      {changeText(h.dayChange, h.dayChangePct ?? 0)} <span style={{ color: "var(--color-of-faint)" }}>today</span>
                    </div>
                  ) : h.gain != null ? (
                    <div className="of-num" style={{ fontSize: 11, marginTop: 2, color: up ? theme.accentDeep : theme.clay }}>
                      {changeText(h.gain, h.gainPct ?? 0)}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 200, textAlign: "center" }}>
          <div style={{ width: 56, height: 56 }} aria-hidden="true">
            <GuillocheSeal accent={theme.accent} accentDeep={theme.accentDeep} label="$" />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-of-muted)", maxWidth: 300 }}>
            Add the individual stocks and funds you hold (Apple, Nvidia, Netflix, …) to see them in your allocation.
          </p>
          {onAddPosition && (
            <Button variant="outline" size="sm" onClick={() => onAddPosition()}>
              <Plus data-icon="inline-start" size={16} strokeWidth={2.2} />
              Add a position
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="of-enter of-page">
      {/* Back to Accounts — the portfolio is a drill-in from the balance sheet. */}
      {onBack && (
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => onBack()}
          className="mb-[18px] text-[var(--color-of-muted)]"
        >
          <ArrowLeft data-icon="inline-start" strokeWidth={2.4} aria-hidden="true" />
          Accounts
        </Button>
      )}
      {nothing ? (
        /* ── empty state · connect or add ── */
        <section
          style={{
            ...CARD,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            minHeight: 360,
            textAlign: "center",
          }}
        >
          <div style={{ width: 84, height: 84 }} aria-hidden="true">
            <GuillocheSeal accent={theme.accent} accentDeep={theme.accentDeep} label="$" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>No investments found</h3>
            <p style={{ margin: "8px auto 0", fontSize: 14, color: "var(--color-of-muted)", maxWidth: 400 }}>
              Connect an account to bring your investment balances in (TFSA, RRSP, and more), or add an individual holding by hand.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
            {onConnect && (
              <Button size="sm" onClick={() => onConnect()}>
                <Landmark data-icon="inline-start" size={16} strokeWidth={2.2} />
                Connect an account
              </Button>
            )}
            {onAddPosition && (
              <Button variant="outline" size="sm" onClick={() => onAddPosition()}>
                <Plus data-icon="inline-start" size={16} strokeWidth={2.2} />
                Add a position
              </Button>
            )}
          </div>
        </section>
      ) : (
        <>
          {/* ── hero · portfolio summary ── */}
          <section
            style={{
              position: "relative",
              overflow: "hidden",
              padding: "0 4px 32px",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <GuillochePattern accent={theme.accent} accentDeep={theme.accentDeep} fade="left" opacity={0.16} />
            <div style={{ position: "relative" }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-of-faint)" }}>
                Portfolio value
              </div>
              <div
                className="of-num"
                style={{ fontSize: "clamp(44px, 5.5vw, 64px)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1, marginTop: 12 }}
              >
                {money(portfolioTotal)}
              </div>
              <div style={{ marginTop: 14, fontSize: 13, color: "var(--color-of-muted)" }}>
                {hasAccounts && (
                  <>
                    {invAccounts.length} account{invAccounts.length === 1 ? "" : "s"}
                  </>
                )}
                {hasAccounts && hasHoldings && " · "}
                {hasHoldings && (
                  <>
                    {holdings.length} position{holdings.length === 1 ? "" : "s"}
                  </>
                )}
              </div>
              {headline && (
                <div style={{ marginTop: 12 }}>
                  <StatPill
                    theme={theme}
                    tone={headlineUp ? "accent" : "clay"}
                    icon={headlineUp ? <TrendingUp size={13} strokeWidth={2.4} /> : <TrendingDown size={13} strokeWidth={2.4} />}
                    figure={`${headlineUp ? "+" : "−"}${money(Math.abs(headline.amount))}`}
                    label={`${headlineUp ? "+" : "−"}${pct(Math.abs(headline.pct))}% ${headline.label}`}
                  />
                </div>
              )}
            </div>
          </section>

          {/* ── allocation · centred donut, the money on the side (drillable) ── */}
          <section style={CARD}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "0 0 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                {activeDrill && (
                  <button
                    type="button"
                    onClick={drillBack}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px 4px 7px",
                      borderRadius: 9999,
                      border: "1px solid var(--color-of-line)",
                      background: "var(--color-of-surface)",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--color-of-muted)",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <ArrowLeft size={14} strokeWidth={2.4} />
                    All accounts
                  </button>
                )}
                <h3
                  title={allocTitle}
                  style={{ margin: 0, fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {activeDrill ? allocTitle : "Allocation"}
                </h3>
              </div>
              <span style={{ fontSize: 12, color: "var(--color-of-faint)", flexShrink: 0 }}>
                {activeDrill ? "Inside this account" : "Click an account to see its holdings"}
              </span>
            </div>

            <div key={navCount} className={slideClass}>
            {allocSlices.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 180, fontSize: 13, color: "var(--color-of-muted)" }}>
                Nothing invested here yet.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 52,
                  flexWrap: "wrap",
                  padding: "14px 0 8px",
                }}
              >
                <DonutChart segments={donutSegments} size={236} stroke={34} formatValue={money} onSelect={activateSlice}>
                  <span
                    title={centerLabel}
                    style={{ ...EYEBROW, maxWidth: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {centerLabel}
                  </span>
                  <span className="of-num" style={{ fontSize: centerLabel.length > 10 ? 20 : 26, fontWeight: 500 }}>
                    {money(centerValue)}
                  </span>
                </DonutChart>
                <div
                  className="of-scroll"
                  style={{ flex: "0 1 460px", minWidth: 260, maxHeight: 236, overflowY: "auto", paddingRight: 4 }}
                >
                  {allocSlices.map((s, i) => {
                    const clickable = !!(s.drillId || (s.holding && onEditPosition));
                    return (
                      <div
                        key={s.key}
                        role={clickable ? "button" : undefined}
                        tabIndex={clickable ? 0 : undefined}
                        onClick={clickable ? () => activateSlice(i) : undefined}
                        onKeyDown={
                          clickable
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  activateSlice(i);
                                }
                              }
                            : undefined
                        }
                        onMouseEnter={clickable ? (e) => (e.currentTarget.style.background = "oklch(97.5% 0.005 90)") : undefined}
                        onMouseLeave={clickable ? (e) => (e.currentTarget.style.background = "transparent") : undefined}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 11,
                          padding: "8px 6px",
                          borderRadius: 10,
                          cursor: clickable ? "pointer" : "default",
                          transition: "background .15s",
                        }}
                      >
                        <span style={{ width: 11, height: 11, borderRadius: 3, background: rampColors[i], flexShrink: 0 }} />
                        <span
                          title={s.label}
                          style={{ fontSize: 14, fontWeight: 500, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        >
                          {s.label}
                        </span>
                        <span className="of-num" style={{ fontSize: 14, color: "var(--color-of-ink)", flexShrink: 0 }}>
                          {money(s.value)}
                        </span>
                        <span style={{ fontSize: 12.5, color: "var(--color-of-faint)", width: 40, textAlign: "right", flexShrink: 0 }}>
                          {pct(levelPct(s.value))}%
                        </span>
                        <ChevronRight
                          size={15}
                          style={{ flexShrink: 0, color: "var(--color-of-faint)", opacity: s.drillId ? 1 : 0 }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {allocNote && (
              <p style={{ margin: "10px 2px 0", fontSize: 12.5, color: "var(--color-of-muted)" }}>{allocNote}</p>
            )}
            </div>
          </section>

          {/* ── holdings (Blossom-style) ── */}
          <div style={{ marginTop: 16 }}>{holdingsCard}</div>

          {/* ── row 2 · accounts + by institution (only when there are accounts) ── */}
          {hasAccounts && (
            <section className="of-grid-2up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              {/* accounts */}
              <div style={CARD}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 0 6px" }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Accounts</h3>
                  <span style={{ fontSize: 12, color: "var(--color-of-faint)" }}>{invAccounts.length} total</span>
                </div>
                <div style={{ margin: "0 -4px" }}>
                  {invAccounts.map((a, i) => {
                    const fallback = accentFamilyTint(i, accent);
                    const tileBg = usableColor(a.bg) ? a.bg : fallback[0];
                    const tileInk = usableColor(a.bg) ? "#fff" : fallback[1];
                    const meta = [a.synced ? a.institution : typeLabel(a.type), a.syncedLabel && `Updated ${a.syncedLabel}`]
                      .filter((p) => p && String(p).trim())
                      .join(" · ");
                    return (
                      <div
                        key={a.id}
                        role={onEditAccount ? "button" : undefined}
                        tabIndex={onEditAccount ? 0 : undefined}
                        onClick={onEditAccount ? () => onEditAccount(a) : undefined}
                        onKeyDown={
                          onEditAccount
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  onEditAccount(a);
                                }
                              }
                            : undefined
                        }
                        onMouseEnter={onEditAccount ? (e) => (e.currentTarget.style.background = "oklch(97.5% 0.005 90)") : undefined}
                        onMouseLeave={onEditAccount ? (e) => (e.currentTarget.style.background = "transparent") : undefined}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 13,
                          padding: "13px 8px",
                          cursor: onEditAccount ? "pointer" : "default",
                          transition: "background .15s",
                          borderTop: i === 0 ? "none" : "1px solid var(--color-of-line-soft)",
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 11,
                            background: tileBg,
                            color: tileInk,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {initialOf(a.name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {a.name}
                            </span>
                            {a.synced && (
                              <span
                                style={{
                                  flexShrink: 0,
                                  padding: "1px 7px",
                                  borderRadius: 9999,
                                  background: "var(--accent)",
                                  color: "var(--accent-foreground)",
                                  fontSize: 10,
                                  fontWeight: 600,
                                  letterSpacing: "0.02em",
                                }}
                              >
                                Synced
                              </span>
                            )}
                          </div>
                          {meta && <div style={{ fontSize: 12, color: "var(--color-of-faint)", marginTop: 2 }}>{meta}</div>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div className="of-num" style={{ fontSize: 15, fontWeight: 500, whiteSpace: "nowrap" }}>
                            {money(a.balance)}
                          </div>
                          <div style={{ fontSize: 11, marginTop: 2, color: "var(--color-of-faint)" }}>{pct(share(a.balance))}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* by institution */}
              <div style={CARD}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 0 18px" }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>By institution</h3>
                  <span style={{ fontSize: 12, color: "var(--color-of-faint)" }}>Where it&rsquo;s held</span>
                </div>
                <div>
                  {(() => {
                    const instMap = new Map<string, number>();
                    for (const a of invAccounts) {
                      const key = a.synced ? a.institution?.trim() || "Linked bank" : "Manual";
                      instMap.set(key, (instMap.get(key) ?? 0) + a.balance);
                    }
                    const rows = [...instMap.entries()].map(([name, value]) => ({ name, value })).sort((x, y) => y.value - x.value);
                    return rows.map((inst, i) => (
                      <div key={inst.name} style={{ marginBottom: i === rows.length - 1 ? 0 : 18 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, marginBottom: 7, gap: 12 }}>
                          <span
                            style={{
                              fontWeight: 500,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              color: inst.name === "Manual" ? "var(--color-of-muted)" : undefined,
                            }}
                          >
                            {inst.name}
                          </span>
                          <span className="of-num" style={{ color: "var(--color-of-muted)", flexShrink: 0 }}>
                            {money(inst.value)}
                            <span style={{ color: "var(--color-of-faint)" }}> · {pct(share(inst.value))}%</span>
                          </span>
                        </div>
                        <ProgressBar value={share(inst.value)} color={theme.accent} />
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
