"use client";

// Bulga — INSIGHTS page (Chat + AI insights, full-screen, ChatGPT-style).
//
// Fills the whole content area edge-to-edge (bk-fullbleed). A single top bar
// holds everything on one line — the sidebar toggle + New chat on the left, the
// centered Chat/Insights segmented island, and (on Insights) the Find button on
// the right — with NO divider beneath it, so it blends into the workspace. The
// sidebar's vertical border runs continuously from the top.
//   • Chat     — <AdvisorChat>: ask questions, get grounded, cited answers.
//   • Insights — the "Find insights" action over a scrollable card list.

import { useEffect, useState, type CSSProperties } from "react";
import { Loader2, PanelLeft, Plus } from "lucide-react";
import type { InsightView } from "@/lib/types";
import { type BulgaTheme } from "@/components/bulga/theme";
import { gqlClient } from "@/lib/graphql/client";
import { Button } from "@/components/ui/button";
import { GuillocheSeal } from "@/components/bulga/guilloche";
import { AdvisorChat } from "@/components/bulga/pages/advisor-chat";

const GENERATE_INSIGHTS = /* GraphQL */ `
  mutation GenerateInsights {
    generateInsights
  }
`;

type View = "chat" | "insights";
const SEG_W = 124; // segmented-control button width
const SIDEBAR_W = 248; // matches AdvisorChat's sidebar — keeps the divider continuous

// Surface the cards that prompt action first: things to fix, then things to
// gain, then context. Unknown tags sort last.
const TAG_ORDER: Record<string, number> = { Alert: 0, Opportunity: 1, Trend: 2, "Spending Pattern": 3 };

interface BulgaInsightsProps {
  insights: InsightView[];
  accent: string;
  theme: BulgaTheme;
  currency: string;
}

export function BulgaInsights({ insights: initial, accent, theme, currency }: BulgaInsightsProps) {
  const [view, setView] = useState<View>("chat");
  const [showChats, setShowChats] = useState(true);
  // Sidebar width is shared: the top-bar rail and the drawer both use it so
  // their divider stays aligned. `resizing` suspends the open/close transition
  // while the handle is dragged, so the panel tracks the cursor 1:1.
  const [sidebarW, setSidebarW] = useState(SIDEBAR_W);
  const [resizing, setResizing] = useState(false);
  const [newChatSignal, setNewChatSignal] = useState(0);
  const [insights, setInsights] = useState<InsightView[]>(initial);
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Collapse the sidebar on narrow screens (post-mount, no hydration mismatch).
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) setShowChats(false);
  }, []);

  const generate = async () => {
    setGenerating(true);
    setNote(null);
    try {
      const { generateInsights } = await gqlClient.request(GENERATE_INSIGHTS);
      if (generateInsights.insights) setInsights(generateInsights.insights);
      if (generateInsights.cached) setNote("You've already refreshed today. Fresh insights arrive once a day.");
    } catch {
      setNote("Couldn't generate insights right now. Try again in a moment.");
    }
    setGenerating(false);
  };

  const hasInsights = insights.length > 0;
  const orderedInsights = [...insights].sort(
    (a, b) => (TAG_ORDER[a.tag] ?? 9) - (TAG_ORDER[b.tag] ?? 9),
  );

  return (
    <div className="bk-enter bk-fullbleed" style={{ display: "flex", flexDirection: "column", background: "var(--color-bk-surface)" }}>
      {/* ── top bar · one line, no bottom divider ── */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", height: 56, flexShrink: 0 }}>
        {/* left · chat controls (chat view only). Right border continues the sidebar's. */}
        {view === "chat" && (
          <div
            className="bk-enter"
            style={{
              width: showChats ? sidebarW : 104,
              flexShrink: 0,
              height: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 12px",
              borderRight: `1px solid ${showChats ? "var(--color-bk-line-soft)" : "transparent"}`,
              transition: resizing ? "border-color 360ms ease" : "width 360ms cubic-bezier(.4,0,.2,1), border-color 360ms ease",
            }}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={showChats ? "Hide chats" : "Show chats"}
              onClick={() => setShowChats((v) => !v)}
            >
              <PanelLeft size={16} />
            </Button>
            {/* One continuous button: collapsed it's a bare + icon; expanded the
                "New chat" label reveals. Padding + label width ride the SAME
                360ms curve as the rail, so it grows *with* the drawer instead of
                snapping to the full pill and then catching up (the jitter). */}
            <Button
              variant="outline"
              size="sm"
              aria-label="New chat"
              onClick={() => setNewChatSignal((s) => s + 1)}
              className="shrink-0 overflow-hidden !gap-0"
              style={{
                // Always right-aligned: as the rail width animates, flexbox keeps
                // the button pinned to the shrinking edge so it glides left with
                // the drawer instead of teleporting (auto→0 can't transition).
                marginLeft: "auto",
                paddingLeft: showChats ? 18 : 10,
                paddingRight: showChats ? 18 : 10,
                transition: "padding 360ms cubic-bezier(.4,0,.2,1)",
              }}
            >
              <Plus size={15} />
              <span
                style={{
                  display: "inline-block",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  maxWidth: showChats ? 90 : 0,
                  opacity: showChats ? 1 : 0,
                  marginLeft: showChats ? 6 : 0,
                  transition:
                    "max-width 360ms cubic-bezier(.4,0,.2,1), opacity 220ms ease, margin-left 360ms cubic-bezier(.4,0,.2,1)",
                }}
              >
                New chat
              </span>
            </Button>
          </div>
        )}

        {/* center · toggle island, lowered so it hovers just below the top bar.
            Chat's content sits right of the sidebar (true center 50% + W/2),
            Insights is full-width (true center 50%). The island glides between
            the two on tab switch — driven by the SAME transform + easing +
            duration as the content track below, so the control and the panels
            move as one coordinated gesture rather than two rival animations. */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "calc(50% + 28px)",
            transform: `translate(calc(-50% + ${view === "chat" && showChats ? sidebarW / 2 : 0}px), -50%)`,
            transition: resizing ? "none" : "transform 380ms cubic-bezier(.4,0,.2,1)",
            zIndex: 2,
          }}
        >
          <div
            role="tablist"
            aria-label="Insights view"
            style={{
              position: "relative",
              display: "inline-flex",
              padding: 4,
              borderRadius: 999,
              background: "var(--color-bk-surface)",
              border: "1px solid var(--color-bk-line)",
              boxShadow: "0 8px 24px oklch(20% 0.02 80 / 0.07)",
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 4,
                left: 4,
                width: SEG_W,
                height: 38,
                borderRadius: 999,
                background: theme.accent,
                transform: view === "chat" ? "translateX(0)" : `translateX(${SEG_W}px)`,
                transition: "transform 340ms cubic-bezier(.4,0,.2,1)",
              }}
            />
            <Segment label="Chat" active={view === "chat"} onClick={() => setView("chat")} />
            <Segment label="Insights" active={view === "insights"} onClick={() => setView("insights")} />
          </div>
        </div>

        {/* right · insights action (insights view only) — fades in with the
            panel slide so it doesn't pop against the gliding toggle */}
        {view === "insights" && (
          <div className="bk-enter" style={{ marginLeft: "auto", display: "flex", alignItems: "center", height: "100%", padding: "0 16px" }}>
            <Button size="sm" onClick={generate} disabled={generating} className="shrink-0">
              {generating && <Loader2 data-icon="inline-start" size={14} className="bk-spin" />}
              {generating ? "Finding…" : hasInsights ? "Refresh" : "Find insights"}
            </Button>
          </div>
        )}
      </div>

      {/* ── sliding track (both panels stay mounted) ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            width: "200%",
            height: "100%",
            transform: view === "chat" ? "translateX(0)" : "translateX(-50%)",
            transition: "transform 380ms cubic-bezier(.4,0,.2,1)",
          }}
        >
          <div style={{ flex: "0 0 50%", height: "100%", pointerEvents: view === "chat" ? "auto" : "none" }} aria-hidden={view !== "chat"}>
            <AdvisorChat
              accent={accent}
              theme={theme}
              currency={currency}
              showChats={showChats}
              newChatSignal={newChatSignal}
              sidebarWidth={sidebarW}
              onSidebarWidth={setSidebarW}
              resizing={resizing}
              onResizingChange={setResizing}
            />
          </div>

          <div style={{ flex: "0 0 50%", height: "100%", pointerEvents: view === "insights" ? "auto" : "none" }} aria-hidden={view !== "insights"}>
            {/* extra top padding clears the toggle island, which hovers just
                below the top bar and would otherwise overlap the first row */}
            <div className="bk-scroll" style={{ height: "100%", overflowY: "auto", padding: "56px 24px 28px", background: "var(--color-bk-surface)" }}>
              {note && <p style={{ margin: "0 0 16px", fontSize: 12.5, color: theme.accentDeep, textAlign: "center" }}>{note}</p>}

              {hasInsights ? (
                <div className="bk-grid-2up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 1100, margin: "0 auto" }}>
                  {orderedInsights.map((ins) => (
                    <div
                      key={ins.id}
                      className="group transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-px hover:border-[var(--ins)] hover:shadow-[0_14px_34px_oklch(20%_0.02_80/0.09)]"
                      style={
                        {
                          "--ins": ins.tagColor,
                          background: "var(--color-bk-surface)",
                          border: "1px solid var(--color-bk-line)",
                          borderRadius: 20,
                          padding: 22,
                        } as CSSProperties
                      }
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 7,
                          marginBottom: 14,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.09em",
                          textTransform: "uppercase",
                          color: ins.tagColor,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: 999, background: ins.tagColor, flexShrink: 0 }} />
                        {ins.tag}
                      </span>
                      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.62, color: "var(--color-bk-ink)" }}>{ins.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    gap: 14,
                    padding: "24px 16px",
                  }}
                >
                  <div style={{ width: 68, height: 68 }} aria-hidden>
                    <GuillocheSeal accent={theme.accent} accentDeep={theme.accentDeep} label="$" />
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--color-bk-muted)", maxWidth: 340, lineHeight: 1.55 }}>
                    No insights yet. Hit <strong style={{ color: "var(--color-bk-ink)" }}>Find insights</strong> for an AI read on your
                    spending, savings, and trends.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Segment({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        position: "relative",
        zIndex: 1,
        width: SEG_W,
        height: 38,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: "transparent",
        borderRadius: 999,
        cursor: "pointer",
        fontSize: 13.5,
        fontWeight: 600,
        color: active ? "#fff" : "var(--color-bk-muted)",
        transition: "color 200ms",
      }}
    >
      {label}
    </button>
  );
}
