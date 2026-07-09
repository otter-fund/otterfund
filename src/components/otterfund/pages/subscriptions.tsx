"use client";

// otterfund — SUBSCRIPTIONS page.
//
// A monthly-equivalent hero (with annual projection + a flagged-count alert when
// subscriptions need attention), then a two-up: the service list (theme-derived
// avatar tiles + flag badges) and an annual-projection bar chart. Every figure
// derives from `subscriptions`; flags render as clay (price up) / amber (unused)
// badges. Avatar tiles are tinted from the ACTIVE ACCENT (via the theme) rather
// than a per-service colour, so the page stays on one hue and re-tints with the
// brand-kit scheme.

import type { SubscriptionView } from "@/lib/types";
import { type OtterfundTheme, accentFamilyTint } from "@/components/otterfund/theme";
import { fmt } from "@/lib/format";
import { ProgressBar } from "@/components/otterfund/progress";
import { GuillochePattern, GuillocheSeal } from "@/components/otterfund/guilloche";
import { StatPill } from "@/components/otterfund/stat-pill";
import { MerchantAvatar } from "@/components/otterfund/merchant-avatar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface OtterfundSubscriptionsProps {
  subscriptions: SubscriptionView[];
  accent: string;
  theme: OtterfundTheme;
  currency?: string;
  onAdd?: () => void;
  onEdit?: (subscription: SubscriptionView) => void;
}

const CARD: React.CSSProperties = {
  background: "var(--color-of-surface)",
  border: "1px solid var(--color-of-line)",
  borderRadius: 20,
  padding: 24,
};

// Price-up flags use the clay alert tone; "unused" gets a warm amber tint so the
// two reasons-to-look read distinctly at a glance.
function flagBadge(flag: string, theme: OtterfundTheme): { bg: string; color: string; label: string } {
  const isPriceChange = flag.toLowerCase().startsWith("price");
  return isPriceChange
    ? { bg: theme.clayTint, color: theme.clay, label: "Price up" }
    : { bg: "oklch(95% 0.05 90)", color: "oklch(46% 0.11 75)", label: "No recent charge" };
}

export function OtterfundSubscriptions({ subscriptions, theme, currency = "CAD", onAdd, onEdit }: OtterfundSubscriptionsProps) {
  const money = (n: number) => fmt(n, currency);

  const monthlyTotal = subscriptions
    .filter((s) => s.cycle === "Monthly")
    .reduce((sum, s) => sum + s.amount, 0);
  const annualSubs = subscriptions
    .filter((s) => s.cycle === "Annual")
    .reduce((sum, s) => sum + s.amount, 0);
  const monthlyEquivalent = monthlyTotal + annualSubs / 12;
  const annualTotal = monthlyTotal * 12 + annualSubs;
  const flaggedCount = subscriptions.filter((s) => s.flags.length > 0).length;
  const maxAnnual = subscriptions.reduce(
    (m, s) => Math.max(m, s.cycle === "Annual" ? s.amount : s.amount * 12),
    0,
  );

  // Projection rows sorted high→low so the bars step down cleanly.
  const projection = subscriptions
    .map((s) => ({ s, annual: s.cycle === "Annual" ? s.amount : s.amount * 12 }))
    .sort((a, b) => b.annual - a.annual);

  return (
    <div className="of-enter of-page">
      {/* ── hero · subscription summary ── */}
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
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "var(--color-of-faint)",
          }}
        >
          Active subscriptions
        </div>
        <div
          className="of-num"
          style={{
            fontSize: "clamp(44px, 5.5vw, 64px)",
            fontWeight: 500,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            marginTop: 12,
          }}
        >
          {money(monthlyEquivalent)}
          <span style={{ fontSize: 18, color: "var(--color-of-muted)", fontWeight: 400 }}>/mo</span>
        </div>
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--color-of-muted)" }}>
            <span className="of-num">{money(annualTotal)}</span>/year · {subscriptions.length} service
            {subscriptions.length === 1 ? "" : "s"}
          </span>
          {flaggedCount > 0 && (
            <StatPill theme={theme} tone="clay" figure={flaggedCount} label="need attention" />
          )}
        </div>
        </div>
        {onAdd && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAdd()}
            className="border-dashed shrink-0"
            style={{ position: "relative" }}
          >
            <Plus data-icon="inline-start" size={16} strokeWidth={2.2} />
            New subscription
          </Button>
        )}
      </section>

      {/* ── services + annual projection · two-up ── */}
      <section className="of-grid-2up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* service list */}
        <div style={CARD}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              margin: "0 0 6px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Services</h3>
            <span style={{ fontSize: 12, color: "var(--color-of-faint)" }}>
              {subscriptions.length} active
            </span>
          </div>
          {subscriptions.length > 0 ? (
            <div style={{ margin: "0 -4px" }}>
              {subscriptions.map((s, i) => {
                const [tileBg, tileInk] = accentFamilyTint(i, theme.accent);
                return (
                <div
                  key={s.id}
                  role={onEdit ? "button" : undefined}
                  tabIndex={onEdit ? 0 : undefined}
                  onClick={onEdit ? () => onEdit(s) : undefined}
                  onKeyDown={
                    onEdit
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onEdit(s);
                          }
                        }
                      : undefined
                  }
                  onMouseEnter={
                    onEdit ? (e) => (e.currentTarget.style.background = "oklch(97.5% 0.005 90)") : undefined
                  }
                  onMouseLeave={
                    onEdit ? (e) => (e.currentTarget.style.background = "transparent") : undefined
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 13,
                    padding: "13px 8px",
                    cursor: onEdit ? "pointer" : "default",
                    transition: "background .15s",
                    borderTop: i === 0 ? "none" : "1px solid var(--color-of-line-soft)",
                  }}
                >
                  <MerchantAvatar name={s.name} domain={s.domain} bg={tileBg} ink={tileInk} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {s.name}
                      </span>
                      {s.flags.map((flag) => {
                        const { bg, color, label } = flagBadge(flag, theme);
                        return (
                          <span
                            key={flag}
                            title={flag}
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              letterSpacing: "0.04em",
                              padding: "2px 7px",
                              borderRadius: 999,
                              background: bg,
                              color,
                            }}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-of-faint)", marginTop: 2 }}>
                      {s.cycle}
                    </div>
                  </div>
                  <div className="of-num" style={{ fontSize: 15, fontWeight: 500, flexShrink: 0, whiteSpace: "nowrap" }}>
                    {money(s.amount)}
                    <span style={{ fontSize: 11, fontWeight: 400, color: "var(--color-of-faint)", marginLeft: 2 }}>
                      {s.cycle === "Annual" ? "/yr" : "/mo"}
                    </span>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, minHeight: 220, textAlign: "center" }}>
              <div style={{ width: 72, height: 72 }} aria-hidden="true">
                <GuillocheSeal accent={theme.accent} accentDeep={theme.accentDeep} label="$" />
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--color-of-muted)" }}>No subscriptions tracked yet.</p>
            </div>
          )}
        </div>

        {/* annual projection */}
        <div style={CARD}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              margin: "0 0 18px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Annual projection</h3>
            <span className="of-num" style={{ fontSize: 12, color: "var(--color-of-faint)" }}>
              {money(annualTotal)}/yr total
            </span>
          </div>
          {projection.length > 0 ? (
            <div>
              {projection.map(({ s, annual }, i) => {
                const pct = maxAnnual > 0 ? (annual / maxAnnual) * 100 : 0;
                return (
                  <div key={s.id} style={{ marginBottom: i === projection.length - 1 ? 0 : 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, marginBottom: 7, gap: 12 }}>
                      <span style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {s.name}
                      </span>
                      <span className="of-num" style={{ color: "var(--color-of-muted)", flexShrink: 0 }}>
                        {money(annual)}<span style={{ color: "var(--color-of-faint)" }}>/yr</span>
                      </span>
                    </div>
                    <ProgressBar value={pct} color={theme.accent} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, minHeight: 220, textAlign: "center" }}>
              <div style={{ width: 72, height: 72 }} aria-hidden="true">
                <GuillocheSeal accent={theme.accent} accentDeep={theme.accentDeep} label="$" />
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--color-of-muted)" }}>No data.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
