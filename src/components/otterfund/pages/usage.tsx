// otterfund — internal AI USAGE page (/dev/usage). A server component (reads the DB
// directly, no client JS): per-user rollup of advisor-chat + insights token spend
// and derived USD cost, sorted by cost. Internal tooling — never user-facing.

import type { AiUsageSummary } from "@/lib/db/ai-usage";

const money = (n: number) => `$${n.toFixed(n !== 0 && Math.abs(n) < 1 ? 4 : 2)}`;
const num = (n: number) => n.toLocaleString("en-US");
const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--color-of-surface)",
        border: "1px solid var(--color-of-line)",
        borderRadius: 18,
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: "var(--color-of-faint)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div className="of-num" style={{ fontSize: 24, letterSpacing: "-0.01em", color: "var(--color-of-ink)" }}>
        {value}
      </div>
    </div>
  );
}

const TH: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-of-faint)",
  whiteSpace: "nowrap",
};
const TDNUM: React.CSSProperties = { padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" };

export function UsageView({ summary }: { summary: AiUsageSummary }) {
  const { users, totals } = summary;

  return (
    <div className="of-enter of-page">
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 22 }}
      >
        <Stat label="Total cost" value={money(totals.costUsd)} />
        <Stat label="Chats" value={num(totals.chats)} />
        <Stat label="Insights runs" value={num(totals.insights)} />
        <Stat label="Tokens" value={num(totals.inputTokens + totals.outputTokens)} />
        <Stat label="Users" value={num(totals.users)} />
      </div>

      <div
        style={{
          background: "var(--color-of-surface)",
          border: "1px solid var(--color-of-line)",
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        {users.length === 0 ? (
          <p style={{ margin: 0, padding: "36px 24px", textAlign: "center", fontSize: 14, color: "var(--color-of-muted)" }}>
            No AI usage recorded yet. Once people chat with the advisor or generate insights, per-user cost shows up here.
          </p>
        ) : (
          <div className="of-scroll" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-of-line)" }}>
                  <th style={TH}>User</th>
                  <th style={{ ...TH, textAlign: "right" }}>Chats</th>
                  <th style={{ ...TH, textAlign: "right" }}>Convos</th>
                  <th style={{ ...TH, textAlign: "right" }}>Insights</th>
                  <th style={{ ...TH, textAlign: "right" }}>Tokens</th>
                  <th style={{ ...TH, textAlign: "right" }}>Cost</th>
                  <th style={{ ...TH, textAlign: "right" }}>Last used</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userId} style={{ borderBottom: "1px solid var(--color-of-line-soft)" }}>
                    <td style={{ padding: "12px 14px", minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: "var(--color-of-ink)" }}>{u.name || "—"}</div>
                      <div style={{ fontSize: 12, color: "var(--color-of-faint)", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {u.email || u.userId}
                      </div>
                    </td>
                    <td className="of-num" style={{ ...TDNUM, color: "var(--color-of-ink)" }}>{num(u.chats)}</td>
                    <td className="of-num" style={{ ...TDNUM, color: "var(--color-of-muted)" }}>{num(u.conversations)}</td>
                    <td className="of-num" style={{ ...TDNUM, color: "var(--color-of-muted)" }}>{num(u.insights)}</td>
                    <td className="of-num" style={{ ...TDNUM, color: "var(--color-of-muted)" }}>{num(u.inputTokens + u.outputTokens)}</td>
                    <td className="of-num" style={{ ...TDNUM, fontWeight: 600, color: "var(--of-accent, var(--color-primary))" }}>
                      {money(u.costUsd)}
                    </td>
                    <td style={{ ...TDNUM, color: "var(--color-of-faint)", fontSize: 12.5 }}>{shortDate(u.lastUsedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ margin: "14px 2px 0", fontSize: 11.5, color: "var(--color-of-faint)" }}>
        Cost is estimated from Anthropic token pricing (Sonnet $3/$15, Haiku $1/$5 per 1M in/out). Cached days don&apos;t
        call the API, so they add no cost. &ldquo;Chats&rdquo; counts advisor messages sent; &ldquo;Convos&rdquo; counts distinct threads.
      </p>
    </div>
  );
}
