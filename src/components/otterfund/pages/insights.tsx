"use client";

// otterfund — INSIGHTS page (Chat + AI insights, full-screen, ChatGPT-style).
//
// Fills the whole content area edge-to-edge (of-fullbleed). A single top bar
// holds everything on one line — the sidebar toggle + New chat on the left, the
// centered Chat/Insights segmented island, and (on Insights) the Find button on
// the right — with NO divider beneath it, so it blends into the workspace. The
// sidebar's vertical border runs continuously from the top.
//   • Chat     — <AdvisorChat>: ask questions, get grounded, cited answers.
//   • Insights — the "Find insights" action over a scrollable card list.
//
// Mobile (≤768px): the desktop's absolutely-centered floating island + inline
// resizable drawer don't fit a phone, so the top bar collapses to a compact
// three-slot row (list toggle · centered island · action), the conversation
// list slides in as an OVERLAY drawer instead of pushing the column, and the
// workspace is pinned to fill the viewport under the shell topbar so the
// composer stays put and only the thread scrolls (a real chat-app feel).

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, ChevronRight, Loader2, PanelLeft, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import type { InsightView, InsightDetail } from "@/lib/types";
import { type OtterfundTheme } from "@/components/otterfund/theme";
import { BlinkingOtter } from "@/components/otterfund/blinking-otter";
import { gqlClient } from "@/lib/graphql/client";
import { fmt } from "@/lib/format";
import { useMediaQuery } from "@/lib/use-media-query";
import { Button } from "@/components/ui/button";
import { AdvisorChat } from "@/components/otterfund/pages/advisor-chat";

const GENERATE_INSIGHTS = /* GraphQL */ `
  mutation GenerateInsights {
    generateInsights
  }
`;

const INSIGHT_DETAIL = /* GraphQL */ `
  query InsightDetail($id: ID!) {
    insightDetail(id: $id)
  }
`;

type View = "chat" | "insights";
const SEG_W = 124; // segmented-control button width (desktop)
const SEG_W_MOBILE = 92; // …tighter on phones, where the row shares space with two icon buttons
const SIDEBAR_W = 288; // matches AdvisorChat's SIDEBAR_DEFAULT — keeps the divider continuous
const SIDEBAR_W_KEY = "otterfund.insights.sidebarW"; // persisted resized width

// Surface the cards that prompt action first: things to fix, then things to
// gain, then context. Unknown tags sort last.
const TAG_ORDER: Record<string, number> = { Alert: 0, Opportunity: 1, Trend: 2, "Spending Pattern": 3 };

interface OtterfundInsightsProps {
  insights: InsightView[];
  accent: string;
  theme: OtterfundTheme;
  currency: string;
}

export function OtterfundInsights({ insights: initial, accent, theme, currency }: OtterfundInsightsProps) {
  const mobile = useMediaQuery("(max-width: 768px)");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The Chat / Insights view is URL-driven so each is directly linkable:
  //   /dashboard/insights            → Chat
  //   /dashboard/insights?view=insights → Insights feed (e.g. "See more insights"
  //   from the Overview lands here). Toggling replaces the URL rather than
  //   pushing, so the back button leaves the page instead of unwinding tabs.
  const view: View = searchParams.get("view") === "insights" ? "insights" : "chat";
  const setView = (v: View) => {
    // Native History API — Next syncs useSearchParams off this WITHOUT a server
    // round-trip, so toggling tabs doesn't refetch insights or reset chat state.
    window.history.replaceState(null, "", v === "insights" ? `${pathname}?view=insights` : pathname);
  };

  // Sidebar visibility is tracked PER breakpoint so the two layouts don't clobber
  // each other on resize: the desktop rail is open by default, the mobile overlay
  // closed. Deriving `showChats` from the active breakpoint means collapsing the
  // desktop rail and then resizing down→up no longer re-pops it open.
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const showChats = mobile ? mobileOpen : desktopOpen;
  const toggleChats = () => (mobile ? setMobileOpen((v) => !v) : setDesktopOpen((v) => !v));
  const closeChats = () => (mobile ? setMobileOpen(false) : setDesktopOpen(false));
  // Sidebar width is shared: the top-bar rail and the drawer both use it so
  // their divider stays aligned. `resizing` suspends the open/close transition
  // while the handle is dragged, so the panel tracks the cursor 1:1. The width
  // persists in localStorage across reloads. It's read in a mount effect rather
  // than a lazy initializer so SSR and first client render agree on the default
  // (no hydration mismatch); `hydrated` gates the save effect so we don't write
  // the default back over the stored value before that read lands.
  const [sidebarW, setSidebarW] = useState(SIDEBAR_W);
  const [resizing, setResizing] = useState(false);
  const hydrated = useRef(false);
  useEffect(() => {
    const saved = Number(window.localStorage.getItem(SIDEBAR_W_KEY));
    if (Number.isFinite(saved) && saved > 0) setSidebarW(Math.max(220, Math.min(460, saved)));
    hydrated.current = true;
  }, []);
  // Save once the drag ends (not on every mousemove) to avoid thrashing storage.
  useEffect(() => {
    if (resizing || !hydrated.current) return;
    try {
      window.localStorage.setItem(SIDEBAR_W_KEY, String(sidebarW));
    } catch {
      /* storage may be unavailable (private mode / quota) — width just won't persist */
    }
  }, [resizing, sidebarW]);
  const [newChatSignal, setNewChatSignal] = useState(0);
  const [insights, setInsights] = useState<InsightView[]>(initial);
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Drill-down drawer: the card the user opened plus its resolved real data.
  const [openInsight, setOpenInsight] = useState<InsightView | null>(null);
  const [detail, setDetail] = useState<InsightDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (ins: InsightView) => {
    setOpenInsight(ins);
    setDetail(null);
    setDetailLoading(true);
    try {
      const { insightDetail } = await gqlClient.request<{ insightDetail: InsightDetail | null }>(
        INSIGHT_DETAIL,
        { id: ins.id },
      );
      setDetail(insightDetail);
    } catch {
      setDetail(null);
    }
    setDetailLoading(false);
  };
  const closeDetail = () => setOpenInsight(null);

  const segW = mobile ? SEG_W_MOBILE : SEG_W;

  // Phones document-scroll the shell, so of-fullbleed can't resolve a height
  // from its parent. Measure where the page actually starts (flush under the
  // sticky topbar) and pin it to fill the rest of the viewport — the chat then
  // owns a single scroll (its thread) with the composer fixed, rather than
  // nesting inside the document scroll. Re-measure on resize and whenever the
  // topbar changes height (collapse, safe-area, orientation).
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageH, setPageH] = useState<number | null>(null);
  useEffect(() => {
    if (!mobile) {
      setPageH(null);
      return;
    }
    const measure = () => {
      const el = pageRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setPageH(Math.max(360, Math.round(window.innerHeight - top)));
    };
    measure();
    window.addEventListener("resize", measure);
    const bar = document.querySelector(".of-topbar");
    const ro = typeof ResizeObserver !== "undefined" && bar ? new ResizeObserver(measure) : null;
    if (bar && ro) ro.observe(bar);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [mobile]);

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

  // Fresh thread. On phones the overlay drawer closes so the new chat is visible.
  const startNewChat = () => {
    setNewChatSignal((s) => s + 1);
    if (mobile) setMobileOpen(false);
  };

  const hasInsights = insights.length > 0;
  const orderedInsights = [...insights].sort(
    (a, b) => (TAG_ORDER[a.tag] ?? 9) - (TAG_ORDER[b.tag] ?? 9),
  );

  return (
    <div
      ref={pageRef}
      className="of-enter of-fullbleed"
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--color-of-surface)",
        // Mobile: fill the viewport under the topbar (see the measure effect).
        ...(mobile && pageH ? { height: pageH } : null),
      }}
    >
      {/* ── top bar · one line, no bottom divider ── */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          height: 56,
          flexShrink: 0,
          ...(mobile ? { padding: "0 12px", gap: 8 } : null),
        }}
      >
        {mobile ? (
          // ── phone top bar · three slots so the island stays centered on both
          //    tabs: [list toggle | spacer] · island · [New chat | Find] ──
          <>
            <div style={{ width: 40, flexShrink: 0, display: "flex" }}>
              {view === "chat" && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={showChats ? "Hide chats" : "Show chats"}
                  onClick={toggleChats}
                >
                  <PanelLeft size={16} />
                </Button>
              )}
            </div>

            <div style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}>
              <ViewToggle view={view} setView={setView} theme={theme} segW={segW} />
            </div>

            <div style={{ width: 40, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
              {view === "chat" ? (
                <Button variant="outline" size="icon" aria-label="New chat" onClick={startNewChat}>
                  <Plus size={16} />
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={generate}
                  disabled={generating}
                  aria-label={generating ? "Finding insights" : hasInsights ? "Refresh insights" : "Find insights"}
                >
                  {generating ? (
                    <Loader2 size={16} className="of-spin" />
                  ) : hasInsights ? (
                    <RefreshCw size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* left · chat controls (chat view only). Right border continues the sidebar's. */}
            {view === "chat" && (
              <div
                className="of-enter"
                style={{
                  width: showChats ? sidebarW : 112,
                  flexShrink: 0,
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "0 12px",
                  borderRight: `1px solid ${showChats ? "var(--color-of-line-soft)" : "transparent"}`,
                  transition: resizing ? "border-color 360ms ease" : "width 360ms cubic-bezier(.4,0,.2,1), border-color 360ms ease",
                }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={showChats ? "Hide chats" : "Show chats"}
                  onClick={toggleChats}
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
                  onClick={startNewChat}
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
              <ViewToggle view={view} setView={setView} theme={theme} segW={segW} />
            </div>

            {/* right · insights action (insights view only) — fades in with the
                panel slide so it doesn't pop against the gliding toggle */}
            {view === "insights" && (
              <div className="of-enter" style={{ marginLeft: "auto", display: "flex", alignItems: "center", height: "100%", padding: "0 16px" }}>
                <Button size="sm" onClick={generate} disabled={generating} className="shrink-0">
                  {generating && <Loader2 data-icon="inline-start" size={14} className="of-spin" />}
                  {generating ? "Finding…" : hasInsights ? "Refresh" : "Find insights"}
                </Button>
              </div>
            )}
          </>
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
              mobile={mobile}
              onCloseSidebar={closeChats}
            />
          </div>

          <div style={{ flex: "0 0 50%", height: "100%", pointerEvents: view === "insights" ? "auto" : "none" }} aria-hidden={view !== "insights"}>
            {/* extra top padding on desktop clears the toggle island, which hovers
                just below the top bar; on phones the island sits inside the bar,
                so the panel starts near the top */}
            <div className="of-scroll" style={{ height: "100%", overflowY: "auto", padding: mobile ? "20px 16px 24px" : "56px 24px 28px", background: "var(--color-of-surface)" }}>
              {note && <p style={{ margin: "0 0 16px", fontSize: 12.5, color: theme.accentDeep, textAlign: "center" }}>{note}</p>}

              {hasInsights ? (
                <div className="of-grid-2up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 1100, margin: "0 auto" }}>
                  {orderedInsights.map((ins) => {
                    const clickable = !!ins.focusType;
                    return (
                    <div
                      key={ins.id}
                      role={clickable ? "button" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      aria-label={clickable ? `View details for this ${ins.tag.toLowerCase()}` : undefined}
                      onClick={clickable ? () => openDetail(ins) : undefined}
                      onKeyDown={
                        clickable
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openDetail(ins);
                              }
                            }
                          : undefined
                      }
                      className={`group transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-px hover:border-[var(--ins)] hover:shadow-[0_14px_34px_oklch(20%_0.02_80/0.09)]${
                        clickable ? " cursor-pointer focus:outline-none focus-visible:border-[var(--ins)] focus-visible:shadow-[0_14px_34px_oklch(20%_0.02_80/0.09)]" : ""
                      }`}
                      style={
                        {
                          "--ins": ins.tagColor,
                          background: "var(--color-of-surface)",
                          border: "1px solid var(--color-of-line)",
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
                      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.62, color: "var(--color-of-ink)" }}>{ins.body}</p>
                      {clickable && (
                        <span
                          className="opacity-70 transition-opacity duration-200 group-hover:opacity-100"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            marginTop: 16,
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: ins.tagColor,
                          }}
                        >
                          View details
                          <ChevronRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                        </span>
                      )}
                    </div>
                    );
                  })}
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
                  {/* Blinking coral otter — single element that swaps between
                      eyes-open / eyes-closed frames (see BlinkingOtter). */}
                  <BlinkingOtter width={104} height={58} />
                  <p style={{ margin: 0, fontSize: 14, color: "var(--color-of-muted)", maxWidth: 340, lineHeight: 1.55 }}>
                    No insights yet. Hit <strong style={{ color: "var(--color-of-ink)" }}>Find insights</strong> for an AI read on your
                    spending, savings, and trends.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {openInsight && (
        <InsightDetailDrawer
          insight={openInsight}
          detail={detail}
          loading={detailLoading}
          theme={theme}
          currency={currency}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}

// ── Drill-down drawer ──────────────────────────────────────────────────────
// A right-anchored panel that slides in over the insights grid and shows the
// REAL data behind a card — the transactions, accounts, and totals that produced
// the insight. Rendered fixed over the viewport (the grid lives inside an
// overflow:hidden track, so an in-flow drawer would clip). Esc / scrim / close
// button dismiss it; motion collapses under prefers-reduced-motion via of-enter.
// Where a given insight lives in the app — Insights is a lens over the other
// tabs, so the drawer offers a jump to the tab that actually owns this data.
function destFor(detail: InsightDetail | null): { href: string; label: string } | null {
  switch (detail?.kind) {
    case "category":
      return { href: "/dashboard/spending", label: "View in Spending" };
    case "subscription":
      return { href: "/dashboard/spending", label: "View in Recurring" };
    case "goal":
      return { href: "/dashboard/goals", label: "View in Goals" };
    case "income":
      return { href: "/dashboard", label: "View in Overview" };
    default:
      return null;
  }
}

function InsightDetailDrawer({
  insight,
  detail,
  loading,
  theme,
  currency,
  onClose,
}: {
  insight: InsightView;
  detail: InsightDetail | null;
  loading: boolean;
  theme: OtterfundTheme;
  currency: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const dest = destFor(detail);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
      {/* scrim */}
      <div
        onClick={onClose}
        aria-hidden
        className="of-fade-in"
        style={{ position: "absolute", inset: 0, background: "oklch(20% 0.02 80 / 0.28)" }}
      />
      {/* panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${insight.tag} details`}
        className="of-scroll of-drawer-in"
        style={{
          position: "relative",
          width: "min(460px, 92vw)",
          height: "100%",
          overflowY: "auto",
          background: "var(--color-of-surface)",
          borderLeft: "1px solid var(--color-of-line)",
          boxShadow: "-24px 0 60px oklch(20% 0.02 80 / 0.14)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            padding: "22px 22px 16px",
            background: "var(--color-of-surface)",
            borderBottom: "1px solid var(--color-of-line-soft)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: insight.tagColor,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: insight.tagColor }} />
              {insight.tag}
            </span>
            <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--color-of-muted)" }}>
              {insight.body}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close details" onClick={onClose} className="shrink-0 -mr-2 -mt-1">
            <X size={16} />
          </Button>
        </div>

        {/* body */}
        <div style={{ padding: "18px 22px 28px", flex: 1 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0", color: "var(--color-of-muted)" }}>
              <Loader2 size={18} className="of-spin" />
            </div>
          ) : !detail ? (
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--color-of-muted)" }}>
              We couldn&apos;t pull the data behind this one. It may reference something that has since changed.
            </p>
          ) : (
            <DetailBody detail={detail} theme={theme} currency={currency} />
          )}
        </div>

        {/* footer · jump to the tab that owns this data — Insights routes into
            the app rather than being a dead end. */}
        {dest && !loading && (
          <div
            style={{
              position: "sticky",
              bottom: 0,
              padding: "14px 22px",
              background: "var(--color-of-surface)",
              borderTop: "1px solid var(--color-of-line-soft)",
            }}
          >
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                onClose();
                router.push(dest.href);
              }}
            >
              {dest.label}
              <ArrowUpRight size={15} strokeWidth={2.2} aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Renders whichever slice of an InsightDetail is populated for its `kind`.
function DetailBody({ detail, theme, currency }: { detail: InsightDetail; theme: OtterfundTheme; currency: string }) {
  if (detail.kind === "category") {
    return (
      <>
        <StatRow theme={theme}>
          <Stat label={`${detail.label} · this period`} value={fmt(detail.total ?? 0, currency)} big />
          <Stat label="Transactions" value={String(detail.count ?? 0)} />
          {detail.dateRange && <Stat label="Range" value={`${detail.dateRange.from} – ${detail.dateRange.to}`} />}
        </StatRow>

        {detail.count === 0 ? (
          <p style={{ margin: "18px 0 0", fontSize: 13.5, color: "var(--color-of-muted)" }}>
            No transactions in the last three months. This may be an older or one-time charge.
          </p>
        ) : (
          <>
            {detail.byAccount && detail.byAccount.length > 0 && (
              <Section title="Where it comes from">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {detail.byAccount.map((a) => (
                    <span
                      key={a.account}
                      style={{
                        display: "inline-flex",
                        alignItems: "baseline",
                        gap: 6,
                        padding: "6px 11px",
                        borderRadius: 999,
                        background: theme.accentTint,
                        border: `1px solid ${theme.accentTintBorder}`,
                        fontSize: 12.5,
                        color: "var(--color-of-ink)",
                      }}
                    >
                      {a.account}
                      <span className="of-num" style={{ fontWeight: 600, color: theme.accentDeep }}>{fmt(a.total, currency)}</span>
                    </span>
                  ))}
                </div>
              </Section>
            )}

            <Section title={`Largest transactions${(detail.count ?? 0) > 15 ? ` · top 15 of ${detail.count}` : ""}`}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {detail.transactions?.map((t, i) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 0",
                      borderTop: i === 0 ? "none" : "1px solid var(--color-of-line-soft)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: "var(--color-of-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--color-of-faint)", marginTop: 2 }}>
                        {t.date}{t.account ? ` · ${t.account}` : ""}
                      </div>
                    </div>
                    <span className="of-num" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-of-ink)", flexShrink: 0 }}>{fmt(t.amount, currency)}</span>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}
      </>
    );
  }

  if (detail.kind === "subscription" && detail.subscription) {
    const s = detail.subscription;
    return (
      <>
        <StatRow theme={theme}>
          <Stat label={`${detail.label} · ${s.cycle}`} value={fmt(s.amount, currency)} big />
          <Stat label="Per year" value={fmt(s.annualized, currency)} />
        </StatRow>
        <Section title="Details">
          <KeyVals
            rows={[
              ["Category", s.category ?? "Uncategorized"],
              ["Billing cycle", s.cycle],
              ["Last charged", s.lastCharged ?? "—"],
            ]}
          />
        </Section>
      </>
    );
  }

  if (detail.kind === "goal" && detail.goal) {
    const g = detail.goal;
    return (
      <>
        <StatRow theme={theme}>
          <Stat label={`${detail.label} · saved`} value={fmt(g.saved, currency)} big />
          <Stat label="Target" value={fmt(g.target, currency)} />
          <Stat label="Progress" value={`${g.pct}%`} />
        </StatRow>
        <div style={{ marginTop: 16, height: 8, borderRadius: 999, background: theme.accentTint, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, g.pct)}%`, height: "100%", background: theme.accent }} />
        </div>
        {g.allocations.length > 0 && (
          <Section title="Recent contributions">
            <KeyVals rows={g.allocations.map((a) => [`${a.label}${a.status !== "confirmed" ? ` · ${a.status}` : ""}`, fmt(a.amount, currency)])} />
          </Section>
        )}
      </>
    );
  }

  if (detail.kind === "income" && detail.months) {
    return (
      <Section title="Income vs. spending by month" first>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {detail.months.map((m, i) => (
            <div
              key={m.label + i}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr 1fr",
                gap: 12,
                alignItems: "baseline",
                padding: "10px 0",
                borderTop: i === 0 ? "none" : "1px solid var(--color-of-line-soft)",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--color-of-ink)", fontWeight: 600 }}>{m.label}</span>
              <span className="of-num" style={{ fontSize: 12.5, color: theme.accentDeep, textAlign: "right" }}>+{fmt(m.income, currency)}</span>
              <span className="of-num" style={{ fontSize: 12.5, color: "var(--color-of-clay)", textAlign: "right" }}>−{fmt(m.expenses, currency)}</span>
            </div>
          ))}
        </div>
      </Section>
    );
  }

  return null;
}

function StatRow({ children, theme }: { children: ReactNode; theme: OtterfundTheme }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 20,
        padding: "16px 18px",
        borderRadius: 16,
        background: theme.accentTint,
        border: `1px solid ${theme.accentTintBorder}`,
      }}
    >
      {children}
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-of-faint)" }}>{label}</div>
      <div className="of-num" style={{ marginTop: 4, fontSize: big ? 24 : 16, fontWeight: 600, color: "var(--color-of-ink)", lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function Section({ title, children, first }: { title: string; children: ReactNode; first?: boolean }) {
  return (
    <div style={{ marginTop: first ? 0 : 22 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-of-muted)", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function KeyVals({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map(([k, v], i) => (
        <div
          key={k + i}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            padding: "9px 0",
            borderTop: i === 0 ? "none" : "1px solid var(--color-of-line-soft)",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--color-of-muted)" }}>{k}</span>
          <span className="of-num" style={{ fontSize: 13, fontWeight: 600, color: "var(--color-of-ink)" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// The Chat / Insights segmented switch — one sliding accent thumb behind two
// equal-width segments. Width is parameterised (`segW`) so the same control can
// be full-size on desktop and tighter on phones.
function ViewToggle({ view, setView, theme, segW }: { view: View; setView: (v: View) => void; theme: OtterfundTheme; segW: number }) {
  return (
    <div
      role="tablist"
      aria-label="Insights view"
      style={{
        position: "relative",
        display: "inline-flex",
        padding: 4,
        borderRadius: 999,
        background: "var(--color-of-surface)",
        border: "1px solid var(--color-of-line)",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 4,
          left: 4,
          width: segW,
          height: 38,
          borderRadius: 999,
          background: theme.accent,
          transform: view === "chat" ? "translateX(0)" : `translateX(${segW}px)`,
          transition: "transform 340ms cubic-bezier(.4,0,.2,1)",
        }}
      />
      <Segment label="Chat" w={segW} active={view === "chat"} onClick={() => setView("chat")} />
      <Segment label="Insights" w={segW} active={view === "insights"} onClick={() => setView("insights")} />
    </div>
  );
}

function Segment({ label, w, active, onClick }: { label: string; w: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        position: "relative",
        zIndex: 1,
        width: w,
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
        color: active ? "#fff" : "var(--color-of-muted)",
        transition: "color 200ms",
      }}
    >
      {label}
    </button>
  );
}
