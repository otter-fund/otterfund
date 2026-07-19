"use client";

// otterfund — SUBSCRIPTIONS page.
//
// A first-class tab (was folded into Spending). Standalone mode is the full
// statement: a monthly-equivalent HeroBand (annual projection + attention pill +
// Scan / New actions), the auto-detection review queue, then a two-up of the
// services ledger and the annual-projection bars — all in the shared Statement /
// HeroBand / Panel grammar so it reads like Accounts and Spending. Embedded mode
// (inside Spending) is a compact summary that links here, so the two surfaces
// don't duplicate. Every figure derives from `subscriptions`; flags render as
// clay (price up) / amber (unused) badges. Avatar tiles tint from the ACTIVE
// ACCENT so the page stays on one hue.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SubscriptionView } from "@/lib/types";
import { type OtterfundTheme, accentFamilyTint } from "@/components/otterfund/theme";
import { fmt } from "@/lib/format";
import { ProgressBar } from "@/components/otterfund/progress";
import { StatPill } from "@/components/otterfund/stat-pill";
import { MerchantAvatar } from "@/components/otterfund/merchant-avatar";
import { Statement, HeroBand, SectionHead, Ledger, Row, ViewAllLink } from "@/components/otterfund/ledger";
import { Panel } from "@/components/otterfund/panel";
import { EmptyState } from "@/components/otterfund/empty-state";
import { Button } from "@/components/ui/button";
import { Plus, Check, X, RefreshCw } from "lucide-react";
import { gqlClient, errMessage } from "@/lib/graphql/client";
import type { ToastInput } from "@/components/otterfund/toast";

const REVIEW_SUBSCRIPTION = /* GraphQL */ `
  mutation ReviewSubscription($id: ID!, $action: String!) {
    reviewSubscription(id: $id, action: $action) { ok }
  }
`;

const SCAN_RECURRING = /* GraphQL */ `
  mutation ScanRecurring { scanRecurring }
`;

interface OtterfundSubscriptionsProps {
  subscriptions: SubscriptionView[];
  /** Auto-detected subscriptions awaiting the user's accept/decline. */
  suggestions?: SubscriptionView[];
  accent: string;
  theme: OtterfundTheme;
  currency?: string;
  onAdd?: () => void;
  onEdit?: (subscription: SubscriptionView) => void;
  /** Re-fetch the page after a review/scan. */
  onReviewed?: () => void;
  /** Show a transient toast (chrome-owned) — used for background-scan status. */
  notify?: (toast: ToastInput) => void;
  /**
   * Rendered as a compact "Recurring" summary inside the Spending page (linking
   * to this tab) rather than the full standalone statement.
   */
  embedded?: boolean;
}

// Price-up flags use the clay alert tone; "unused" gets a warm amber tint so the
// two reasons-to-look read distinctly at a glance.
function flagBadge(flag: string, theme: OtterfundTheme): { bg: string; color: string; label: string } {
  const isPriceChange = flag.toLowerCase().startsWith("price");
  return isPriceChange
    ? { bg: theme.clayTint, color: theme.clay, label: "Price up" }
    : { bg: "var(--color-of-warn)", color: "var(--color-of-warn-ink)", label: "No recent charge" };
}

export function OtterfundSubscriptions({ subscriptions, suggestions = [], theme, currency = "CAD", onAdd, onEdit, onReviewed, notify, embedded = false }: OtterfundSubscriptionsProps) {
  const money = (n: number) => fmt(n, currency);
  const router = useRouter();

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

  // Review queue — id currently being accepted/declined (disables its buttons).
  const [reviewing, setReviewing] = useState<string | null>(null);
  const review = (id: string, action: "accept" | "dismiss") => {
    if (reviewing) return;
    setReviewing(id);
    gqlClient
      .request(REVIEW_SUBSCRIPTION, { id, action })
      .then(() => onReviewed?.())
      .catch(() => {})
      .finally(() => setReviewing(null));
  };

  // Manual "Scan for subscriptions" — runs the same detection the bank link /
  // import trigger automatically. It's a slow AI pass, so we don't block: fire it,
  // toast "we'll let you know", and toast + refresh on completion (the sidebar /
  // bell also surface the result, so the user can navigate away meanwhile).
  const [scanning, setScanning] = useState(false);
  const scan = () => {
    if (scanning) return;
    setScanning(true);
    notify?.({
      key: "scan",
      tone: "progress",
      title: "Scanning your transactions…",
      message: "This can take a moment. We'll let you know when it's done.",
      duration: 30000,
    });
    gqlClient
      .request<{ scanRecurring?: { added?: number; suggested?: number } }>(SCAN_RECURRING)
      .then((d) => {
        const r = d.scanRecurring ?? {};
        const found = (r.added ?? 0) + (r.suggested ?? 0);
        notify?.(
          found > 0
            ? {
                key: "scan",
                tone: "success",
                title: `Found ${found} possible ${found === 1 ? "subscription" : "subscriptions"}`,
                message: "Review them in your queue below.",
              }
            : { key: "scan", tone: "info", title: "Scan complete", message: "No new subscriptions found." },
        );
        onReviewed?.();
      })
      .catch((e) => notify?.({ key: "scan", tone: "error", title: "Scan failed", message: errMessage(e) }))
      .finally(() => setScanning(false));
  };

  const addButton = onAdd && (
    <Button size="sm" onClick={() => onAdd()} className="shrink-0" aria-label="Add subscription">
      <Plus data-icon="inline-start" size={16} strokeWidth={2.2} />
      New subscription
    </Button>
  );

  const scanButton = onReviewed && (
    <Button
      variant="outline"
      size="sm"
      onClick={scan}
      disabled={scanning}
      className="border-dashed shrink-0"
      aria-label="Scan transactions for subscriptions"
    >
      <RefreshCw data-icon="inline-start" size={15} strokeWidth={2} className={scanning ? "of-spin" : undefined} />
      {scanning ? "Scanning…" : "Scan for subscriptions"}
    </Button>
  );

  // ── review queue · auto-detected charges awaiting a decision ──
  const reviewQueue = suggestions.length > 0 && (
    <Panel theme={theme} style={{ marginTop: 24 }}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
          {suggestions.length} possible subscription{suggestions.length === 1 ? "" : "s"}
        </h3>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--color-of-muted)" }}>
          We spotted these recurring charges in your transactions. Add the ones you want to track.
        </p>
      </div>
      <Ledger>
        {suggestions.map((s, i) => {
          const [tileBg, tileInk] = accentFamilyTint(i, theme.accent);
          const busy = reviewing === s.id;
          return (
            <Row key={s.id} columns="40px 1fr auto" gap={13}>
              <MerchantAvatar name={s.name} domain={s.domain} bg={tileBg} ink={tileInk} size={36} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-of-faint)", marginTop: 2 }}>
                  <span className="of-num">{money(s.amount)}</span> · {s.cycle}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => review(s.id, "dismiss")}
                  disabled={busy}
                  aria-label={`Decline ${s.name}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    height: 32,
                    padding: "0 12px",
                    borderRadius: 9999,
                    border: "1px solid var(--color-of-line)",
                    background: "transparent",
                    color: "var(--color-of-muted)",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: busy ? "default" : "pointer",
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  <X size={14} strokeWidth={2.4} aria-hidden="true" />
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => review(s.id, "accept")}
                  disabled={busy}
                  aria-label={`Add ${s.name}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    height: 32,
                    padding: "0 14px",
                    borderRadius: 9999,
                    border: "none",
                    background: theme.accent,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: busy ? "default" : "pointer",
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  <Check size={14} strokeWidth={2.6} aria-hidden="true" />
                  Add
                </button>
              </div>
            </Row>
          );
        })}
      </Ledger>
    </Panel>
  );

  // ── services ledger ──
  const servicesPanel = (
    <Panel theme={theme}>
      <SectionHead
        title="Services"
        action={<span style={{ fontSize: 12, color: "var(--color-of-faint)" }}>{subscriptions.length} active</span>}
      />
      <Ledger style={{ marginTop: 4 }}>
        {subscriptions.map((s, i) => {
          const [tileBg, tileInk] = accentFamilyTint(i, theme.accent);
          return (
            <Row
              key={s.id}
              columns="40px 1fr auto"
              gap={13}
              onClick={onEdit ? () => onEdit(s) : undefined}
              ariaLabel={onEdit ? `Edit ${s.name}` : undefined}
            >
              <MerchantAvatar name={s.name} domain={s.domain} bg={tileBg} ink={tileInk} size={36} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.name}
                  </span>
                  {s.flags.map((flag) => {
                    const { bg, color, label } = flagBadge(flag, theme);
                    return (
                      <span
                        key={flag}
                        title={flag}
                        style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", padding: "2px 7px", borderRadius: 999, background: bg, color }}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-of-faint)", marginTop: 2 }}>{s.cycle}</div>
              </div>
              <div className="of-num" style={{ fontSize: 15, fontWeight: 500, flexShrink: 0, whiteSpace: "nowrap", textAlign: "right" }}>
                {money(s.amount)}
                <span style={{ fontSize: 11, fontWeight: 400, color: "var(--color-of-faint)", marginLeft: 2 }}>
                  {s.cycle === "Annual" ? "/yr" : "/mo"}
                </span>
              </div>
            </Row>
          );
        })}
      </Ledger>
    </Panel>
  );

  // ── annual projection bars ──
  const projectionPanel = (
    <Panel theme={theme}>
      <SectionHead
        title="Annual projection"
        action={<span className="of-num" style={{ fontSize: 12, color: "var(--color-of-faint)" }}>{money(annualTotal)}/yr total</span>}
      />
      <div style={{ marginTop: 14 }}>
        {projection.map(({ s, annual }, i) => {
          const pct = maxAnnual > 0 ? (annual / maxAnnual) * 100 : 0;
          return (
            <div key={s.id} style={{ marginBottom: i === projection.length - 1 ? 0 : 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, marginBottom: 7, gap: 12 }}>
                <span style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                <span className="of-num" style={{ color: "var(--color-of-muted)", flexShrink: 0 }}>
                  {money(annual)}<span style={{ color: "var(--color-of-faint)" }}>/yr</span>
                </span>
              </div>
              <ProgressBar value={pct} color={theme.accent} />
            </div>
          );
        })}
      </div>
    </Panel>
  );

  // ── embedded · a compact "Recurring" summary for the Spending page ──
  // Points to this tab rather than duplicating the full page.
  if (embedded) {
    const hasAny = subscriptions.length > 0;
    return (
      <section style={{ marginTop: 30 }}>
        <SectionHead
          title="Recurring"
          action={<ViewAllLink label="View subscriptions" onClick={() => router.push("/dashboard/subscriptions")} />}
        />
        <Panel theme={theme}>
          {hasAny || suggestions.length > 0 ? (
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div className="of-num" style={{ fontSize: 27, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {money(monthlyEquivalent)}
                  <span style={{ fontSize: 14, color: "var(--color-of-muted)", fontWeight: 400 }}>/mo</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--color-of-muted)", marginTop: 6 }}>
                  <span className="of-num">{money(annualTotal)}</span>/yr · {subscriptions.length} service{subscriptions.length === 1 ? "" : "s"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {suggestions.length > 0 && <StatPill theme={theme} tone="accent" figure={suggestions.length} label="to review" />}
                {flaggedCount > 0 && <StatPill theme={theme} tone="clay" figure={flaggedCount} label="need attention" />}
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--color-of-muted)" }}>
              No recurring subscriptions tracked yet. Open the Subscriptions tab to scan your transactions or add one.
            </p>
          )}
        </Panel>
      </section>
    );
  }

  // ── standalone · the full Subscriptions statement ──
  return (
    <Statement>
      <HeroBand
        theme={theme}
        ariaLabel="Recurring subscriptions"
        asideAlign="start"
        eyebrow={
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-of-muted)" }}>
            Recurring · {subscriptions.length} {subscriptions.length === 1 ? "service" : "services"}
          </div>
        }
        figure={
          <>
            {money(monthlyEquivalent)}
            <span style={{ fontSize: "0.4em", fontWeight: 400, letterSpacing: 0, color: "var(--color-of-muted)" }}>/mo</span>
          </>
        }
        meta={
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "var(--color-of-muted)" }}>
              <span className="of-num">{money(annualTotal)}</span>/year
            </span>
            {flaggedCount > 0 && <StatPill theme={theme} tone="clay" figure={flaggedCount} label="need attention" />}
          </div>
        }
        aside={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {addButton}
            {scanButton}
          </div>
        }
      />

      {reviewQueue}

      {subscriptions.length > 0 ? (
        <div className="of-grid-2up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 24 }}>
          {servicesPanel}
          {projectionPanel}
        </div>
      ) : suggestions.length === 0 ? (
        <div style={{ marginTop: 20 }}>
          <EmptyState
            theme={theme}
            title="No subscriptions yet"
            description="Add a recurring service by hand, or scan your transactions to detect them automatically. Anything found lands in the review queue for you to confirm."
          />
        </div>
      ) : null}
    </Statement>
  );
}
