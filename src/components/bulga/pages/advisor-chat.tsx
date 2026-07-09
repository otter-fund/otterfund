"use client";

// Bulga — ADVISOR CHAT (the default view of the Insights page).
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
import { type BulgaTheme } from "@/components/bulga/theme";
import { gqlClient, errMessage } from "@/lib/graphql/client";
import { GuillocheSeal } from "@/components/bulga/guilloche";
import { GuillocheLoader } from "@/components/bulga/guilloche-loader";
import { AdvisorMarkdown, TypingMarkdown } from "@/components/bulga/pages/advisor-markdown";

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
  theme: BulgaTheme;
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
}

const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 460;

export function AdvisorChat({
  theme,
  showChats,
  newChatSignal,
  sidebarWidth,
  onSidebarWidth,
  resizing,
  onResizingChange,
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

  const fetchConversations = async () => {
    try {
      const { advisorConversations } = await gqlClient.request<{
        advisorConversations: AdvisorConversationSummary[];
      }>(LIST_CONVERSATIONS);
      setConversations(advisorConversations ?? []);
    } catch {
      /* sidebar is non-critical — leave whatever we have */
    }
  };

  // Load the sidebar on mount.
  useEffect(() => {
    fetchConversations();
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
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === activeId) newChat();
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
        display: "flex",
        height: "100%",
        background: "var(--color-bk-surface)",
        overflow: "hidden",
      }}
    >
      {/* ── sidebar · saved conversations (sliding, resizable drawer) ──
          Always mounted so it can animate: the shell clips to an easing width
          (0 ⇆ sidebarWidth) — the chat column grows/shrinks with it via flexbox
          — while the inner panel slides so it reads as a drawer gliding out and
          back rather than a snap. Drag the right edge to resize; during a drag
          `resizing` freezes the transition so it tracks the cursor 1:1. */}
      <aside
        aria-hidden={!showChats}
        style={{
          position: "relative",
          width: showChats ? sidebarWidth : 0,
          flexShrink: 0,
          overflow: "hidden",
          borderRight: `1px solid ${showChats ? "var(--color-bk-line-soft)" : "transparent"}`,
          background: "oklch(99% 0.003 90)",
          transition: resizing ? "border-color 360ms ease" : "width 360ms cubic-bezier(.4,0,.2,1), border-color 360ms ease",
        }}
      >
        <div
          style={{
            width: sidebarWidth,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            transform: showChats ? "translateX(0)" : "translateX(-100%)",
            opacity: showChats ? 1 : 0,
            pointerEvents: showChats ? "auto" : "none",
            transition: resizing ? "none" : "transform 360ms cubic-bezier(.4,0,.2,1), opacity 300ms ease",
          }}
        >
          <div className="bk-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
            {conversations.length === 0 ? (
              <p style={{ margin: "8px 8px", fontSize: 12.5, color: "var(--color-bk-faint)", lineHeight: 1.5 }}>
                No saved chats yet. Ask a question to start one.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {conversations.map((c) => {
                  const active = c.id === activeId;
                  return (
                    <div
                      key={c.id}
                      className={`group rounded-[10px] ${active ? "" : "hover:bg-[var(--color-bk-line-soft)]"}`}
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
                            color: active ? theme.accentDeep : "var(--color-bk-ink)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {c.title}
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--color-bk-faint)", marginTop: 1 }}>
                          {relTime(c.updatedAt)}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeConversation(c.id)}
                        aria-label="Delete chat"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
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
                          color: "var(--color-bk-muted)",
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
            line brightens on hover/drag so it reads as adjustable. */}
        {showChats && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat list"
            onMouseDown={startResize}
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
              className="transition-colors group-hover:bg-[var(--color-bk-line)]"
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
        {/* thread */}
        <div className="bk-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 20px" }}>
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
              <div style={{ width: 66, height: 66 }} aria-hidden>
                <GuillocheSeal accent={theme.accent} accentDeep={theme.accentDeep} label="?" />
              </div>
              <div>
                <p style={{ margin: 0, fontFamily: "var(--font-num), serif", fontSize: 22, letterSpacing: "-0.01em", color: "var(--color-bk-ink)" }}>
                  Ask your advisor
                </p>
                <p style={{ margin: "8px auto 0", fontSize: 14, color: "var(--color-bk-muted)", maxWidth: 420, lineHeight: 1.55 }}>
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
                        background: m.error ? "var(--color-bk-clay-tint)" : theme.accentTint,
                        border: `1px solid ${m.error ? "var(--color-bk-clay)" : theme.accentTintBorder}`,
                        color: m.error ? "var(--color-bk-clay)" : "var(--color-bk-ink)",
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
                  <Loader2 size={15} className="bk-spin" />
                  <RollingPhrase phrase={phrase} />
                </div>
              )}
            </div>
          )}
          <div ref={threadEndRef} />
        </div>

        {/* composer */}
        <div style={{ padding: "12px 20px 18px", borderTop: "1px solid var(--color-bk-line-soft)" }}>
          <div style={{ maxWidth: COLUMN, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                background: "oklch(98% 0.004 90)",
                border: "1px solid var(--color-bk-line)",
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
                className="bk-scroll"
                style={{
                  flex: 1,
                  resize: "none",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 14.5,
                  lineHeight: 1.5,
                  color: "var(--color-bk-ink)",
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
                {sending ? <Loader2 size={16} className="bk-spin" /> : <ArrowUp size={18} />}
              </button>
            </div>
            <p style={{ margin: "8px 2px 0", fontSize: 11, color: "var(--color-bk-faint)", textAlign: "center" }}>
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
        className="bk-roll-in"
        style={{ display: "inline-block", whiteSpace: "nowrap" }}
        onAnimationEnd={() => setPair((p) => (p.prev === null ? p : { prev: null, cur: p.cur }))}
      >
        {pair.cur}…
      </span>
      {pair.prev !== null && (
        <span
          key={`out-${pair.prev}`}
          className="bk-roll-out"
          style={{ position: "absolute", left: 0, top: 0, display: "inline-block", whiteSpace: "nowrap" }}
        >
          {pair.prev}…
        </span>
      )}
    </span>
  );
}

function SourceChips({ sources, theme }: { sources: AdvisorSource[]; theme: BulgaTheme }) {
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
              background: "var(--color-bk-surface)",
              border: "1px solid var(--color-bk-line)",
              fontSize: 11.5,
              color: "var(--color-bk-muted)",
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
