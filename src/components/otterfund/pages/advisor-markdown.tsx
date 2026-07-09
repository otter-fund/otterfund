"use client";

// otterfund — a small, safe Markdown renderer for advisor answers.
//
// The advisor replies in Markdown (paragraphs, **bold**, `code`, ### headings,
// --- rules, bullet/numbered lists, and GFM tables for breakdowns). We render
// that to styled React elements — NOT via dangerouslySetInnerHTML — so tool
// output (merchant names, memos) stays inert text and can't inject markup.
//
// Two renderers share the same block model:
//   • <AdvisorMarkdown>  — renders the whole answer at once (history, final).
//   • <TypingMarkdown>   — reveals it progressively: prose types out word-by-
//     word with a caret, and structural blocks (tables, rules, lists) fade up
//     as they're reached, so a half-built table / raw pipes never show.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { type OtterfundTheme } from "@/components/otterfund/theme";

type Align = "left" | "right" | "center";

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "hr" }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][]; aligns: Align[] };

const NUMERIC = /^[-+−]?\s*[$€£]?\s*[\d,]+(\.\d+)?\s*%?$/;
const isNumeric = (s: string) => NUMERIC.test(s.trim());

const isSeparatorRow = (l: string) => /^[\s|:-]+$/.test(l) && l.includes("-") && l.includes("|");
const isHeading = (l: string) => /^\s*#{1,6}\s+/.test(l);
const isHr = (l: string) => /^\s*([-*_])\1{2,}\s*$/.test(l);
const isBullet = (l: string) => /^\s*[-*]\s+/.test(l);
const isOrdered = (l: string) => /^\s*\d+\.\s+/.test(l);

const CONTAINER: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  fontSize: 14,
  lineHeight: 1.6,
  color: "var(--color-of-ink)",
};

function splitCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function sepToAlign(cell: string): Align | null {
  const c = cell.trim();
  const left = c.startsWith(":");
  const right = c.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return null;
}

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const headers = splitCells(line);
      const sepAligns = splitCells(lines[i + 1]).map(sepToAlign);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].includes("|") && lines[j].trim() !== "") {
        rows.push(splitCells(lines[j]));
        j++;
      }
      const aligns: Align[] = headers.map((_, c) => {
        if (sepAligns[c]) return sepAligns[c] as Align;
        const numeric = rows.filter((r) => isNumeric(r[c] ?? "")).length;
        return rows.length > 0 && numeric >= Math.ceil(rows.length / 2) ? "right" : "left";
      });
      blocks.push({ type: "table", headers, rows, aligns });
      i = j;
      continue;
    }

    if (isHeading(line)) {
      const m = line.match(/^\s*(#{1,6})\s+(.*)$/)!;
      blocks.push({ type: "heading", level: m[1].length, text: m[2].trim() });
      i++;
      continue;
    }

    if (isHr(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (isBullet(line)) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, "").trim());
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (isOrdered(line)) {
      const items: string[] = [];
      while (i < lines.length && isOrdered(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, "").trim());
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !isHeading(lines[i]) &&
      !isHr(lines[i]) &&
      !isBullet(lines[i]) &&
      !isOrdered(lines[i]) &&
      !(lines[i].includes("|") && i + 1 < lines.length && isSeparatorRow(lines[i + 1]))
    ) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) blocks.push({ type: "paragraph", text: para.join(" ") });
  }

  return blocks;
}

const codeStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.9em",
  background: "oklch(96% 0.005 90)",
  border: "1px solid var(--color-of-line-soft)",
  borderRadius: 5,
  padding: "1px 5px",
};

/** Render inline **bold** and `code`; everything else is escaped text. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b${k++}`} style={{ fontWeight: 600, color: "var(--color-of-ink)" }}>
          {tok.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code key={`${keyPrefix}-c${k++}`} style={codeStyle}>
          {tok.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Render one parsed block. `animate` wraps it in the fade-up (used by typing). */
function renderBlockNode(b: Block, i: number, theme: OtterfundTheme, animate: boolean): React.ReactNode {
  const cls = animate ? "of-enter" : undefined;
  switch (b.type) {
    case "heading": {
      const size = b.level <= 2 ? 15.5 : b.level === 3 ? 14 : 13.5;
      return (
        <div key={i} className={cls} style={{ fontSize: size, fontWeight: 600, color: "var(--color-of-ink)", marginTop: i === 0 ? 0 : 4 }}>
          {renderInline(b.text, `h${i}`)}
        </div>
      );
    }
    case "paragraph":
      return (
        <p key={i} className={cls} style={{ margin: 0 }}>
          {renderInline(b.text, `p${i}`)}
        </p>
      );
    case "hr":
      return <hr key={i} className={cls} style={{ border: 0, borderTop: "1px solid var(--color-of-line-soft)", margin: "2px 0" }} />;
    case "ul":
      return (
        <ul key={i} className={cls} style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          {b.items.map((it, k) => (
            <li key={k}>{renderInline(it, `ul${i}-${k}`)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={i} className={cls} style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          {b.items.map((it, k) => (
            <li key={k}>{renderInline(it, `ol${i}-${k}`)}</li>
          ))}
        </ol>
      );
    case "table":
      return <MarkdownTable key={i} block={b} theme={theme} animate={animate} />;
  }
}

export function AdvisorMarkdown({ content, theme }: { content: string; theme: OtterfundTheme }) {
  const blocks = parseBlocks(content);
  return <div style={CONTAINER}>{blocks.map((b, i) => renderBlockNode(b, i, theme, false))}</div>;
}

// ── Progressive "typing" reveal ─────────────────────────────────────────────

const TICK_MS = 38;
const WORDS_PER_TICK = 2;

/** Drop a dangling half-open **bold** / `code` marker from a partial prefix, so
 *  a stray `**` never flashes at the typing edge. */
function cleanupPartial(s: string): string {
  let t = s;
  if (((t.match(/\*\*/g) || []).length) % 2 === 1) t = t.replace(/\*\*(?=[^*]*$)/, "");
  if (((t.match(/`/g) || []).length) % 2 === 1) t = t.replace(/`(?=[^`]*$)/, "");
  return t;
}

function Caret() {
  return <span className="of-caret" aria-hidden />;
}

export function TypingMarkdown({
  content,
  theme,
  onDone,
  onProgress,
}: {
  content: string;
  theme: OtterfundTheme;
  onDone?: () => void;
  onProgress?: () => void;
}) {
  const blocks = useMemo(() => parseBlocks(content), [content]);
  const paraWords = useMemo(
    () => blocks.map((b) => (b.type === "paragraph" ? b.text.split(/\s+/).filter(Boolean) : null)),
    [blocks],
  );
  const total = useMemo(
    () => blocks.reduce((n, b, i) => n + (b.type === "paragraph" ? Math.max(1, paraWords[i]!.length) : 1), 0),
    [blocks, paraWords],
  );

  const [revealed, setRevealed] = useState(0);
  const doneRef = useRef(onDone);
  const progRef = useRef(onProgress);
  useEffect(() => {
    doneRef.current = onDone;
    progRef.current = onProgress;
  });

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || total <= WORDS_PER_TICK) {
      setRevealed(total);
      return;
    }
    setRevealed(WORDS_PER_TICK); // show the first words immediately (no empty flash)
    const id = setInterval(() => {
      setRevealed((r) => {
        if (r >= total) {
          clearInterval(id);
          return r;
        }
        return Math.min(total, r + WORDS_PER_TICK);
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [total]);

  useEffect(() => {
    progRef.current?.();
    if (total > 0 && revealed >= total) doneRef.current?.();
  }, [revealed, total]);

  const nodes: React.ReactNode[] = [];
  let acc = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === "paragraph") {
      const words = paraWords[i] ?? [];
      const start = acc;
      acc += Math.max(1, words.length);
      const shown = Math.max(0, Math.min(words.length, revealed - start));
      if (shown <= 0) break;
      if (shown < words.length) {
        const text = cleanupPartial(words.slice(0, shown).join(" "));
        nodes.push(
          <p key={i} className="of-enter" style={{ margin: 0 }}>
            {renderInline(text, `tp${i}`)}
            <Caret />
          </p>,
        );
        break;
      }
      nodes.push(renderBlockNode(b, i, theme, true));
    } else {
      const start = acc;
      acc += 1;
      if (revealed <= start) break;
      nodes.push(renderBlockNode(b, i, theme, true));
    }
  }

  return <div style={CONTAINER}>{nodes}</div>;
}

function MarkdownTable({
  block,
  theme,
  animate,
}: {
  block: Extract<Block, { type: "table" }>;
  theme: OtterfundTheme;
  animate?: boolean;
}) {
  const { headers, rows, aligns } = block;
  return (
    <div
      className={`of-scroll${animate ? " of-enter" : ""}`}
      style={{
        overflowX: "auto",
        border: "1px solid var(--color-of-line)",
        borderRadius: 12,
        margin: "2px 0",
      }}
    >
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <thead>
          <tr style={{ background: theme.accentTint }}>
            {headers.map((h, c) => (
              <th
                key={c}
                style={{
                  textAlign: aligns[c],
                  padding: "8px 12px",
                  fontWeight: 600,
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: theme.accentDeep,
                  borderBottom: `1px solid ${theme.accentTintBorder}`,
                  whiteSpace: "nowrap",
                }}
              >
                {renderInline(h, `th${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {headers.map((_, c) => {
                const cell = r[c] ?? "";
                const numeric = isNumeric(cell);
                return (
                  <td
                    key={c}
                    className={numeric ? "of-num" : undefined}
                    style={{
                      textAlign: aligns[c],
                      padding: "8px 12px",
                      color: "var(--color-of-ink)",
                      borderBottom: ri === rows.length - 1 ? "none" : "1px solid var(--color-of-line-soft)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {renderInline(cell, `td${ri}-${c}`)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
