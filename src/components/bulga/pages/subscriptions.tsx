"use client";

// Bulga — SUBSCRIPTIONS page.
//
// Rebuilt in the Bulga design system from the pre-redesign Subscriptions tab.
// A monthly-total hero (with annual projection + a flagged-count alert when any
// subscription needs attention), then a two-up: the service list (letter-avatar
// tiles + flag badges) and an annual-projection bar chart. Figures derive from
// `subscriptions`; flags render as clay (price up) / amber (unused) badges.

import type { SubscriptionView } from "@/lib/types";
import { type BulgaTheme } from "@/components/bulga/theme";
import { fmt } from "@/lib/format";
import { ProgressBar } from "@/components/bulga/progress";
import { GuillochePattern, GuillocheSeal } from "@/components/bulga/guilloche";

interface BulgaSubscriptionsProps {
  subscriptions: SubscriptionView[];
  accent: string;
  theme: BulgaTheme;
  currency?: string;
}

const CARD: React.CSSProperties = {
  background: "var(--color-bk-surface)",
  border: "1px solid var(--color-bk-line)",
  borderRadius: 20,
  padding: 24,
};

// Price-up flags use the clay alert tone; everything else (e.g. "unused") gets a
// warm amber tint so the two reasons-to-look read distinctly at a glance.
function flagBadge(flag: string, theme: BulgaTheme): { bg: string; color: string; label: string } {
  const isPriceChange = flag.toLowerCase().startsWith("price");
  return isPriceChange
    ? { bg: theme.clayTint, color: theme.clay, label: "Price up" }
    : { bg: "oklch(95% 0.05 90)", color: "oklch(46% 0.11 75)", label: "Unused?" };
}

export function BulgaSubscriptions({ subscriptions, theme, currency = "CAD" }: BulgaSubscriptionsProps) {

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

  return (
    <div className="bk-enter bk-page">
      {/* ── hero · subscription summary ── */}
      <section style={{ position: "relative", overflow: "hidden", padding: "0 4px 32px" }}>
        <GuillochePattern accent={theme.accent} accentDeep={theme.accentDeep} fade="left" opacity={0.16} />
        <div style={{ position: "relative" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "var(--color-bk-faint)",
          }}
        >
          Active subscriptions
        </div>
        <div
          className="bk-num"
          style={{
            fontSize: "clamp(44px, 5.5vw, 64px)",
            fontWeight: 500,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            marginTop: 12,
          }}
        >
          {money(monthlyEquivalent)}
          <span style={{ fontSize: 18, color: "var(--color-bk-muted)", fontWeight: 400 }}>/mo</span>
        </div>
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--color-bk-muted)" }}>
            <span className="bk-num">{money(annualTotal)}</span>/year · {subscriptions.length} service
            {subscriptions.length === 1 ? "" : "s"}
          </span>
          {flaggedCount > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                background: theme.clayTint,
                color: theme.clay,
              }}
            >
              <span className="bk-num">{flaggedCount}</span> need attention
            </span>
          )}
        </div>
        </div>
      </section>

      {/* ── services + annual projection · two-up ── */}
      <section className="bk-grid-2up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* service list */}
        <div style={CARD}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>Services</h3>
          {subscriptions.length > 0 ? (
            <div className="bk-scroll" style={{ maxHeight: 440, overflowY: "auto", margin: "0 -8px" }}>
              {subscriptions.map((s) => (
                <div
                  key={s.id}
                  style={{ display: "flex", alignItems: "center", gap: 13, padding: "10px 8px" }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 11,
                      background: s.color,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 13.5,
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
                    <div style={{ fontSize: 12, color: "var(--color-bk-faint)", marginTop: 1 }}>
                      {s.cycle}
                      {s.categoryName && <span> · {s.categoryName}</span>}
                    </div>
                  </div>
                  <div className="bk-num" style={{ fontSize: 14, fontWeight: 500, flexShrink: 0 }}>
                    {money(s.amount)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, minHeight: 220, textAlign: "center" }}>
              <div style={{ width: 72, height: 72 }} aria-hidden="true">
                <GuillocheSeal accent={theme.accent} accentDeep={theme.accentDeep} label="$" />
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--color-bk-muted)" }}>No subscriptions tracked yet.</p>
            </div>
          )}
        </div>

        {/* annual projection */}
        <div style={CARD}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 600 }}>Annual projection</h3>
          {subscriptions.length > 0 ? (
            subscriptions.map((s) => {
              const annualCost = s.cycle === "Annual" ? s.amount : s.amount * 12;
              const pct = maxAnnual > 0 ? (annualCost / maxAnnual) * 100 : 0;
              return (
                <div key={s.id} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
                    <span style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.name}
                    </span>
                    <span className="bk-num" style={{ color: "var(--color-bk-muted)", flexShrink: 0 }}>
                      {money(annualCost)}/yr
                    </span>
                  </div>
                  <ProgressBar value={pct} color={theme.accent} />
                </div>
              );
            })
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, minHeight: 220, textAlign: "center" }}>
              <div style={{ width: 72, height: 72 }} aria-hidden="true">
                <GuillocheSeal accent={theme.accent} accentDeep={theme.accentDeep} label="$" />
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--color-bk-muted)" }}>No data.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
