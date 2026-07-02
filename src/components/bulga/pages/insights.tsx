"use client";

// Bulga — INSIGHTS page.
//
// Rebuilt in the Bulga design system from the pre-redesign AI insights tab.
// A hero with the "Generate" action (the generateInsights GraphQL mutation —
// rate-limited to one fresh generation per day; a same-day call returns the cached set), then
// a grid of insight cards. Each insight carries its own tag color/background from
// the model output; the loading + empty + already-refreshed states are handled
// inline. This is the page the overview's "See more insights" button opens.

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { InsightView } from "@/lib/types";
import { type BulgaTheme } from "@/components/bulga/theme";
import { gqlClient } from "@/lib/graphql/client";
import { Button } from "@/components/ui/button";
import { GuillochePattern, GuillocheSeal } from "@/components/bulga/guilloche";

const GENERATE_INSIGHTS = /* GraphQL */ `
  mutation GenerateInsights {
    generateInsights
  }
`;

interface BulgaInsightsProps {
  insights: InsightView[];
  accent: string;
  theme: BulgaTheme;
}

const CARD: React.CSSProperties = {
  background: "var(--color-bk-surface)",
  border: "1px solid var(--color-bk-line)",
  borderRadius: 20,
  padding: 24,
};

export function BulgaInsights({ insights: initial, theme }: BulgaInsightsProps) {
  const [insights, setInsights] = useState<InsightView[]>(initial);
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const generate = async () => {
    setGenerating(true);
    setNote(null);
    try {
      const { generateInsights } = await gqlClient.request(GENERATE_INSIGHTS);
      if (generateInsights.insights) setInsights(generateInsights.insights);
      if (generateInsights.cached) setNote("You've already refreshed today — fresh insights once a day.");
    } catch {
      setNote("Couldn't generate insights right now. Try again in a moment.");
    }
    setGenerating(false);
  };

  const hasInsights = insights.length > 0;

  return (
    <div className="bk-enter bk-page">
      {/* ── hero · AI overview + generate ── */}
      <section
        style={{
          ...CARD,
          position: "relative",
          overflow: "hidden",
          padding: "32px 28px",
          marginBottom: 16,
          background: theme.accentTint,
          border: `1px solid ${theme.accentTintBorder}`,
        }}
      >
        <GuillochePattern accent={theme.accent} accentDeep={theme.accentDeep} fade="left" opacity={0.14} />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: theme.accentDeep,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
              </svg>
              AI overview
            </div>
            <p
              style={{
                fontFamily: "var(--font-num), serif",
                fontSize: 24,
                lineHeight: 1.3,
                letterSpacing: "-0.01em",
                margin: "14px 0 0",
                maxWidth: 560,
                color: "oklch(28% 0.02 90)",
              }}
            >
              {hasInsights
                ? "Your latest financial insights, drawn from this month's activity."
                : "Generate AI-powered insights about your spending patterns, savings opportunities, and trends."}
            </p>
          </div>
          <Button size="sm" onClick={generate} disabled={generating} className="shrink-0">
            {generating ? (
              <Loader2 data-icon="inline-start" size={15} className="bk-spin" />
            ) : (
              <Sparkles data-icon="inline-start" size={15} />
            )}
            {generating ? "Generating…" : "Generate insights"}
          </Button>
        </div>
        {note && (
          <p style={{ position: "relative", margin: "14px 0 0", fontSize: 12.5, color: theme.accentDeep }}>{note}</p>
        )}
      </section>

      {/* ── insight cards ── */}
      {hasInsights ? (
        <section className="bk-grid-2up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {insights.map((ins) => (
            <div key={ins.id} style={CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: ins.tagColor, flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: ins.tagColor,
                  }}
                >
                  {ins.tag}
                </span>
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "var(--color-bk-ink)" }}>
                {ins.body}
              </p>
            </div>
          ))}
        </section>
      ) : (
        <section style={{ ...CARD, position: "relative", overflow: "hidden", textAlign: "center", padding: "44px 24px" }}>
          <GuillochePattern accent={theme.accent} accentDeep={theme.accentDeep} fade="radial" opacity={0.14} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ width: 72, height: 72 }} aria-hidden="true">
              <GuillocheSeal accent={theme.accent} accentDeep={theme.accentDeep} label="$" />
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-bk-muted)", maxWidth: 360 }}>
              No insights yet — hit <strong style={{ color: "var(--color-bk-ink)" }}>Generate insights</strong> above to get an
              AI-powered read on your finances.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
