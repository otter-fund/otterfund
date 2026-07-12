"use client";

// otterfund — ADVISOR CHAT (the default view of the Insights page).
//
// A full-width, ChatGPT-style workspace: a left sidebar of saved conversations
// plus a centered message column with the composer pinned at the bottom.
// Conversations are PERSISTENT — each turn is saved server-side, so a chat can
// be reopened from the sidebar and continued. Sending hits the `askAdvisor`
// mutation (read-only, user-scoped tool loop server-side; history loaded from
// the DB) and returns a grounded answer + source chips + the conversation id.

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Loader2,
  Trash2,
  CreditCard,
  Receipt,
  Tag,
  Target,
  Repeat,
  BarChart3,
} from "lucide-react";
import type {
  AdvisorConversation,
  AdvisorConversationSummary,
  AdvisorMessage,
  AdvisorSource,
} from "@/lib/types";
import { type OtterfundTheme } from "@/components/otterfund/theme";
import { BlinkingOtter } from "@/components/otterfund/blinking-otter";
import { gqlClient, errMessage } from "@/lib/graphql/client";
import { GuillocheLoader } from "@/components/otterfund/guilloche-loader";
import { AdvisorMarkdown, TypingMarkdown } from "@/components/otterfund/pages/advisor-markdown";

const ASK_ADVISOR = /* GraphQL */ `
  mutation AskAdvisor($message: String!, $conversationId: String) {
    askAdvisor(message: $message, conversationId: $conversationId)
  }
`;
const LIST_CONVERSATIONS = /* GraphQL */ `
  query AdvisorConversations {
    advisorConversations
  }
`;
const GET_CONVERSATION = /* GraphQL */ `
  query AdvisorConversation($id: String!) {
    advisorConversation(id: $id)
  }
`;
const DELETE_CONVERSATION = /* GraphQL */ `
  mutation DeleteAdvisorConversation($id: String!) {
    deleteAdvisorConversation(id: $id)
  }
`;

const SUGGESTIONS = [
  "How much did I spend on groceries last month?",
  "What are my biggest subscriptions?",
  "How am I tracking toward my goals?",
  "Where could I cut back?",
];

// Loading catchphrases — mostly playful, a few earnest — cycled while working.
const THINKING_PHRASES = [
  "Counting your pennies",
  "Crunching the numbers",
  "Auditing the vibes",
  "Interrogating your lattes",
  "Balancing the books",
  "Checking under the couch cushions",
  "Following the money",
  "Summoning the budget spirits",
  "Reconciling the ledger",
  "Doing napkin math",
  "Sniffing out subscriptions",
  "Tallying the damage",
  "Squinting at your statement",
  "Counting beans",
  "Reading the fine print",
  "Chasing down receipts",
  "Consulting the spreadsheet oracle",
  "Pinching pennies",
  "Running the tape",
  "Untangling your cash flow",
];

type ChatMessage = AdvisorMessage & { error?: boolean; typing?: boolean };

const SOURCE_ICON: Record<AdvisorSource["kind"], typeof CreditCard> = {
  account: CreditCard,
  transaction: Receipt,
  category: Tag,
  goal: Target,
  subscription: Repeat,
  summary: BarChart3,
};

const COLUMN = 720; // readable centered column width (ChatGPT-style)

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface AdvisorChatProps {
  accent: string;
  theme: OtterfundTheme;
  currency: string;
  /** Whether the conversation sidebar is shown (owned by the page's top bar). */
  showChats: boolean;
  /** Bumped by the page's "New chat" button to reset to a fresh conversation. */
  newChatSignal: number;
  /** Shared drawer width (px) — owned by the page so the rail divider aligns. */
  sidebarWidth: number;
  /** Called with the new width as the resize handle is dragged. */
  onSidebarWidth: (w: number) => void;
  /** True while the handle is being dragged — suspends the open/close animation. */
  resizing: boolean;
  /** Toggles the dragging state up so the rail can suspend its transition too. */
  onResizingChange: (v: boolean) => void;
  /** True at the phone breakpoint — the drawer becomes a sliding overlay (with a
   *  backdrop) instead of an inline push, and the resize handle is dropped. */
  mobile: boolean;
  /** Close the conversation drawer (owned by the page). Used by the mobile
   *  overlay's backdrop and to auto-close when a conversation is opened. */
  onCloseSidebar: () => void;
}

const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 460;
const SIDEBAR_DEFAULT = 288; // matches the page's SIDEBAR_W — double-click the handle resets here

export function AdvisorChat({
  theme,
  showChats,
  newChatSignal,
  sidebarWidth,
  onSidebarWidth,
  resizing,
  onResizingChange,
  mobile,
  onCloseSidebar,
}: AdvisorChatProps) {
  const [conversations, setConversations] = useState<AdvisorConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [phrase, setPhrase] = useState(THINKING_PHRASES[0]);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const firstSignal = useRef(true);

  const fetchConversations = async (): Promise<AdvisorConversationSummary[]> => {
    try {
      const { advisorConversations } = await gqlClient.request<{
        advisorConversations: AdvisorConversationSummary[];
      }>(LIST_CONVERSATIONS);
      const list = advisorConversations ?? [];
      setConversations(list);
      return list;
    } catch {
      /* sidebar is non-critical — leave whatever we have */
      return [];
    }
  };

  // Load the sidebar on mount, then open the most recent chat so returning to
  // Insights resumes where you left off (rather than the blank composer). The
  // list is ordered most-recent-first, so [0] is newest. Guarded to the first
  // load only — a later refetch (after sending) must not yank you off the thread.
  const didAutoOpen = useRef(false);
  useEffect(() => {
    fetchConversations().then((list) => {
      if (didAutoOpen.current) return;
      didAutoOpen.current = true;
      if (list.length > 0) openConversation(list[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The page's "New chat" button bumps newChatSignal — reset to a fresh thread
  // (skip the initial mount, which is already fresh).
  useEffect(() => {
    if (firstSignal.current) {
      firstSignal.current = false;
      return;
    }
    setActiveId(null);
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  }, [newChatSignal]);

  // Keep the latest turn in view.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  // Cycle the catchphrase while sending — random start, then step through.
  useEffect(() => {
    if (!sending) return;
    let i = Math.floor(Math.random() * THINKING_PHRASES.length);
    setPhrase(THINKING_PHRASES[i]);
    const id = setInterval(() => {
      i = (i + 1) % THINKING_PHRASES.length;
      setPhrase(THINKING_PHRASES[i]);
    }, 2100);
    return () => clearInterval(id);
  }, [sending]);

  const newChat = () => {
    setActiveId(null);
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  // Drag the right edge to resize the drawer. We track from the pointer's start
  // position + the width at grab so the panel follows the cursor 1:1, clamped
  // to a sensible range; `resizing` (lifted to the page) freezes the width
  // transition on both the drawer and the rail for the duration of the drag.
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    onResizingChange(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startW + (ev.clientX - startX)));
      onSidebarWidth(next);
    };
    const onUp = () => {
      onResizingChange(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const openConversation = async (id: string) => {
    if (id === activeId || sending) return;
    if (mobile) onCloseSidebar(); // reveal the thread — the drawer is an overlay here
    setLoadingThread(true);
    setActiveId(id);
    setMessages([]);
    try {
      const { advisorConversation } = await gqlClient.request<{
        advisorConversation: AdvisorConversation;
      }>(GET_CONVERSATION, { id });
      setMessages(advisorConversation.messages as ChatMessage[]);
    } catch {
      setMessages([{ role: "assistant", content: "Couldn't load that conversation.", error: true }]);
    } finally {
      setLoadingThread(false);
    }
  };

  const removeConversation = async (id: string) => {
    // If the active chat is deleted, jump to a neighbor (the one that slides into
    // its place, else the previous) so the thread stays populated; fall back to a
    // fresh composer only when the last chat is gone.
    if (id === activeId) {
      const idx = conversations.findIndex((c) => c.id === id);
      const next = conversations[idx + 1] ?? conversations[idx - 1] ?? null;
      if (next) openConversation(next.id);
      else newChat();
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    try {
      await gqlClient.request(DELETE_CONVERSATION, { id });
    } catch {
      fetchConversations(); // restore truth if the delete failed
    }
  };

  const send = async (raw: string) => {
    const question = raw.trim();
    if (!question || sending || loadingThread) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setSending(true);
    try {
      const { askAdvisor } = await gqlClient.request<{
        askAdvisor: { answer: string; sources: AdvisorSource[]; conversationId: string };
      }>(ASK_ADVISOR, { message: question, conversationId: activeId });
      setActiveId(askAdvisor.conversationId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: askAdvisor.answer, sources: askAdvisor.sources, typing: true },
      ]);
      fetchConversations(); // pick up the new/renamed thread + reorder
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: errMessage(e), error: true }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const scrollToEnd = () => threadEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  const markTyped = (index: number) =>
    setMessages((prev) => prev.map((mm, idx) => (idx === index && mm.typing ? { ...mm, typing: false } : mm)));

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div
      style={{
        position: "relative", // anchors the mobile drawer overlay + backdrop
        display: "flex",
        height: "100%",
        background: "var(--color-of-surface)",
        overflow: "hidden",
      }}
    >
      {/* ── sidebar · saved conversations (sliding drawer) ──
          Desktop: an inline, resizable rail — the shell clips to an easing width
          (0 ⇆ sidebarWidth), the chat column grows/shrinks with it via flexbox,
          and the inner panel slides so it reads as a drawer gliding out. Drag the
          right edge to resize; `resizing` freezes the transition so it tracks the
          cursor 1:1.
          Phones: the same list, but as an OVERLAY — it slides in over the thread
          on top of a tap-to-dismiss backdrop, so it never crushes the column. */}
      {mobile && (
        <div
          aria-hidden
          onClick={onCloseSidebar}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 29,
            background: "oklch(20% 0.02 80 / 0.32)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
            opacity: showChats ? 1 : 0,
            pointerEvents: showChats ? "auto" : "none",
            transition: "opacity 300ms ease",
          }}
        />
      )}
      <aside
        aria-hidden={!showChats}
        style={
          mobile
            ? {
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                zIndex: 30,
                width: "min(320px, 86vw)",
                overflow: "hidden",
                borderRight: "1px solid var(--color-of-line-soft)",
                background: "oklch(99% 0.003 90)",
                transform: showChats ? "translateX(0)" : "translateX(-100%)",
                boxShadow: showChats ? "8px 0 40px oklch(20% 0.02 80 / 0.18)" : "none",
                pointerEvents: showChats ? "auto" : "none",
                transition: "transform 320ms cubic-bezier(.4,0,.2,1), box-shadow 320ms ease",
              }
            : {
                position: "relative",
                width: showChats ? sidebarWidth : 0,
                flexShrink: 0,
                overflow: "hidden",
                borderRight: `1px solid ${showChats ? "var(--color-of-line-soft)" : "transparent"}`,
                background: "oklch(99% 0.003 90)",
                transition: resizing ? "border-color 360ms ease" : "width 360ms cubic-bezier(.4,0,.2,1), border-color 360ms ease",
              }
        }
      >
        <div
          style={
            mobile
              ? { width: "100%", height: "100%", display: "flex", flexDirection: "column" }
              : {
                  width: sidebarWidth,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  transform: showChats ? "translateX(0)" : "translateX(-100%)",
                  opacity: showChats ? 1 : 0,
                  pointerEvents: showChats ? "auto" : "none",
                  transition: resizing ? "none" : "transform 360ms cubic-bezier(.4,0,.2,1), opacity 300ms ease",
                }
          }
        >
          <div className="of-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
            <div
              style={{
                padding: "2px 8px 8px",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: "var(--color-of-faint)",
              }}
            >
              Recent chats
            </div>
            {conversations.length === 0 ? (
              <p style={{ margin: "4px 8px", fontSize: 12.5, color: "var(--color-of-faint)", lineHeight: 1.5 }}>
                No saved chats yet. Ask a question to start one.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {conversations.map((c) => {
                  const active = c.id === activeId;
                  return (
                    <div
                      key={c.id}
                      className={`group rounded-[10px] ${active ? "" : "hover:bg-[var(--color-of-line-soft)]"}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        paddingRight: 4,
                        background: active ? theme.accentTint : "transparent",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => openConversation(c.id)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          textAlign: "left",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: "8px 10px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: active ? theme.accentDeep : "var(--color-of-ink)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {c.title}
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--color-of-faint)", marginTop: 1 }}>
                          {relTime(c.updatedAt)}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeConversation(c.id)}
                        aria-label="Delete chat"
                        className={
                          mobile
                            ? "transition-opacity"
                            : "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        }
                        style={{
                          flexShrink: 0,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 26,
                          height: 26,
                          borderRadius: 7,
                          border: "none",
                          background: "transparent",
                          color: "var(--color-of-muted)",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* resize handle — a thin grab strip over the right edge; the divider
            line brightens on hover/drag so it reads as adjustable. Desktop only:
            the mobile drawer is a fixed-width overlay with nothing to drag. */}
        {showChats && !mobile && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat list"
            onMouseDown={startResize}
            onDoubleClick={() => onSidebarWidth(SIDEBAR_DEFAULT)}
            title="Drag to resize · double-click to reset"
            className="group"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: 10,
              cursor: "col-resize",
              display: "flex",
              justifyContent: "flex-end",
              zIndex: 5,
            }}
          >
            <div
              className="transition-colors group-hover:bg-[var(--color-of-line)]"
              style={{
                width: 2,
                height: "100%",
                ...(resizing ? { background: theme.accent } : null),
              }}
            />
          </div>
        )}
      </aside>

      {/* ── chat column ── */}
      {/* height:100% + minHeight:0 keep the column filling the workspace and let
          the thread's flex:1 resolve, so the empty state stays centered and the
          composer stays pinned to the bottom (rather than collapsing to content
          height, which floats everything up to the top). */}
      <div style={{ flex: 1, minWidth: 0, height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
        {/* thread — extra top padding on desktop clears the toggle island, which
            hovers just below the top bar and would otherwise crowd the first
            message; phones keep it tight (the island sits inside the bar there) */}
        <div className="of-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: mobile ? "18px 16px 16px" : "56px 20px 24px" }}>
          {loadingThread ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 76, height: 76 }} aria-hidden>
                <GuillocheLoader accent={theme.accent} accentDeep={theme.accentDeep} label="$" />
              </div>
            </div>
          ) : !hasMessages ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                gap: 16,
                padding: "20px 8px",
              }}
            >
              {/* Blinking coral otter — single element that swaps between
                  eyes-open / eyes-closed frames (see BlinkingOtter). */}
              <BlinkingOtter width={104} height={58} />
              <div>
                <p style={{ margin: 0, fontFamily: "var(--font-num), serif", fontSize: 22, letterSpacing: "-0.01em", color: "var(--color-of-ink)" }}>
                  Ask your advisor
                </p>
                <p style={{ margin: "8px auto 0", fontSize: 14, color: "var(--color-of-muted)", maxWidth: 420, lineHeight: 1.55 }}>
                  Anything about your money: spending, subscriptions, goals, or where to cut back. Answers cite your own accounts.
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 560 }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    style={{
                      fontSize: 13,
                      lineHeight: 1.3,
                      padding: "8px 14px",
                      borderRadius: 999,
                      border: `1px solid ${theme.accentTintBorder}`,
                      background: theme.accentTint,
                      color: theme.accentDeep,
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: COLUMN, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div
                      style={{
                        maxWidth: "85%",
                        padding: "10px 15px",
                        borderRadius: 18,
                        borderBottomRightRadius: 5,
                        background: theme.accentDeep,
                        color: "#fff",
                        fontSize: 14.5,
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                    <div
                      style={{
                        maxWidth: "100%",
                        width: m.error ? "auto" : "100%",
                        padding: "14px 16px",
                        borderRadius: 18,
                        borderBottomLeftRadius: 5,
                        background: m.error ? "var(--color-of-clay-tint)" : theme.accentTint,
                        border: `1px solid ${m.error ? "var(--color-of-clay)" : theme.accentTintBorder}`,
                        color: m.error ? "var(--color-of-clay)" : "var(--color-of-ink)",
                      }}
                    >
                      {m.error ? (
                        <span style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.content}</span>
                      ) : m.typing ? (
                        <TypingMarkdown
                          content={m.content}
                          theme={theme}
                          onProgress={scrollToEnd}
                          onDone={() => markTyped(i)}
                        />
                      ) : (
                        <AdvisorMarkdown content={m.content} theme={theme} />
                      )}
                    </div>
                    {!m.typing && m.sources && m.sources.length > 0 && (
                      <SourceChips sources={m.sources} theme={theme} />
                    )}
                  </div>
                ),
              )}
              {sending && (
                <div style={{ display: "flex", alignItems: "center", gap: 9, color: theme.accentDeep, fontSize: 13.5 }}>
                  <Loader2 size={15} className="of-spin" />
                  <RollingPhrase phrase={phrase} />
                </div>
              )}
            </div>
          )}
          <div ref={threadEndRef} />
        </div>

        {/* composer */}
        <div style={{ padding: mobile ? "10px 14px 14px" : "12px 20px 18px", borderTop: "1px solid var(--color-of-line-soft)" }}>
          <div style={{ maxWidth: COLUMN, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                // center for a single line (the common case) so the text aligns
                // with the send button; a growing textarea pushes the row taller
                // symmetrically rather than dropping below the button.
                alignItems: "center",
                gap: 8,
                background: "oklch(98% 0.004 90)",
                border: "1px solid var(--color-of-line)",
                borderRadius: 18,
                padding: "8px 8px 8px 16px",
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask about your spending, goals, subscriptions…"
                className="of-scroll"
                style={{
                  flex: 1,
                  resize: "none",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 14.5,
                  lineHeight: 1.5,
                  color: "var(--color-of-ink)",
                  fontFamily: "var(--font-ui)",
                  maxHeight: 140,
                  padding: "5px 0",
                }}
              />
              <button
                type="button"
                onClick={() => send(input)}
                disabled={sending || loadingThread || !input.trim()}
                aria-label="Send"
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  border: "none",
                  background: theme.accent,
                  color: "#fff",
                  cursor: sending || loadingThread || !input.trim() ? "default" : "pointer",
                  opacity: sending || loadingThread || !input.trim() ? 0.45 : 1,
                  transition: "opacity 150ms",
                }}
              >
                {sending ? <Loader2 size={16} className="of-spin" /> : <ArrowUp size={18} />}
              </button>
            </div>
            <p style={{ margin: "8px 2px 0", fontSize: 11, color: "var(--color-of-faint)", textAlign: "center" }}>
              General guidance, not certified financial advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The cycling "thinking" line, as a vertical ticker: when the phrase changes the
 * outgoing line rolls up and out while the incoming line rises from below into
 * its place. The incoming span stays in flow (defines the width/height); the
 * outgoing one overlays absolutely and is dropped once its replacement lands.
 */
function RollingPhrase({ phrase }: { phrase: string }) {
  const prevRef = useRef(phrase);
  const [pair, setPair] = useState<{ prev: string | null; cur: string }>({ prev: null, cur: phrase });

  useEffect(() => {
    if (prevRef.current !== phrase) {
      setPair({ prev: prevRef.current, cur: phrase });
      prevRef.current = phrase;
    }
  }, [phrase]);

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        overflow: "hidden",
        lineHeight: "1.45em",
        verticalAlign: "bottom",
        fontStyle: "italic",
      }}
    >
      <span
        key={`in-${pair.cur}`}
        className="of-roll-in"
        style={{ display: "inline-block", whiteSpace: "nowrap" }}
        onAnimationEnd={() => setPair((p) => (p.prev === null ? p : { prev: null, cur: p.cur }))}
      >
        {pair.cur}…
      </span>
      {pair.prev !== null && (
        <span
          key={`out-${pair.prev}`}
          className="of-roll-out"
          style={{ position: "absolute", left: 0, top: 0, display: "inline-block", whiteSpace: "nowrap" }}
        >
          {pair.prev}…
        </span>
      )}
    </span>
  );
}

function SourceChips({ sources, theme }: { sources: AdvisorSource[]; theme: OtterfundTheme }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 2 }}>
      {sources.map((s, i) => {
        const Icon = SOURCE_ICON[s.kind] ?? Tag;
        return (
          <span
            key={`${s.kind}-${s.id ?? s.label}-${i}`}
            title={s.detail}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              maxWidth: 240,
              padding: "4px 9px",
              borderRadius: 999,
              background: "var(--color-of-surface)",
              border: "1px solid var(--color-of-line)",
              fontSize: 11.5,
              color: "var(--color-of-muted)",
            }}
          >
            <Icon size={12} style={{ color: theme.accentDeep, flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
          </span>
        );
      })}
    </div>
  );
}
