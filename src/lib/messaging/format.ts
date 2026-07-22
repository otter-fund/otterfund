// Render the advisor's Markdown answer into what each chat app can actually
// display, and chunk it to the provider message-size limit. The advisor replies
// in Markdown (bold, headings, bullet lists, and pipe tables); neither Telegram
// nor WhatsApp renders Markdown tables/headings, so we down-convert.
//
// The hard requirement for Telegram HTML mode: escape &,<,> in content FIRST,
// then add only balanced tags we control — a malformed tag makes Telegram reject
// the whole message. (The Telegram adapter also retries as plain text if a send
// is ever rejected, as a last-resort safety net.)

const TELEGRAM_LIMIT = 4096;
const WHATSAPP_LIMIT = 4096;

/** Split text into <=limit chunks, preferring a newline boundary near the cut. */
export function splitForLimit(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n", limit);
    if (cut < limit * 0.5) cut = limit; // don't emit a tiny chunk from an early newline
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).replace(/^\n+/, "");
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function isTableSeparator(line: string): boolean {
  // e.g. "|---|:--:|---|" — the row under a table header. Dropped entirely.
  return line.includes("-") && /^\s*\|?[\s:|-]+\|?\s*$/.test(line);
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

/** "| a | b | c |" → "a  ·  b  ·  c" (tables can't render, so flatten a row). */
function flattenTableRow(line: string): string {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean)
    .join("  ·  ");
}

// ── Telegram (HTML parse mode) ───────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Inline markup → Telegram HTML. Input MUST already be HTML-escaped; we only add
// balanced tags around paired delimiters, so the result stays well-formed.
function inlineTelegram(escaped: string): string {
  return escaped
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/(^|[^*_])[*_]([^*_\n]+)[*_](?!\*|_)/g, "$1<i>$2</i>");
}

export function toTelegramHtml(md: string): string {
  const out: string[] = [];
  for (const raw of md.split("\n")) {
    if (isTableSeparator(raw)) continue;
    if (isTableRow(raw)) {
      out.push(inlineTelegram(escapeHtml(flattenTableRow(raw))));
      continue;
    }
    const escaped = escapeHtml(raw);
    const heading = escaped.match(/^\s{0,3}#{1,6}\s+(.*)$/);
    if (heading) {
      out.push(`<b>${inlineTelegram(heading[1])}</b>`);
      continue;
    }
    const bullet = escaped.match(/^(\s*)[-*]\s+(.*)$/);
    if (bullet) {
      out.push(`${bullet[1]}• ${inlineTelegram(bullet[2])}`);
      continue;
    }
    out.push(inlineTelegram(escaped));
  }
  return out.join("\n").trim();
}

export function telegramChunks(md: string): string[] {
  return splitForLimit(toTelegramHtml(md), TELEGRAM_LIMIT);
}

/** Strip Telegram HTML tags back to plain text — the send() fallback if HTML is rejected. */
export function stripTelegramHtml(html: string): string {
  return html
    .replace(/<a href="([^"]*)">([^<]*)<\/a>/g, "$2 ($1)")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// ── WhatsApp (its own lightweight markup) ────────────────────────────────────
// WhatsApp: *bold*, _italic_, ~strike~, ```mono```. No HTML, headings, tables, or
// link markup (bare URLs auto-linkify). Plain text — no escaping needed.

function inlineWhatsapp(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1: $2") // link → "text: url"
    .replace(/\*\*([^*]+)\*\*/g, "*$1*") // **bold** → *bold*
    .replace(/`([^`]+)`/g, "$1"); // drop inline-code backticks
}

export function toWhatsappText(md: string): string {
  const out: string[] = [];
  for (const raw of md.split("\n")) {
    if (isTableSeparator(raw)) continue;
    if (isTableRow(raw)) {
      out.push(inlineWhatsapp(flattenTableRow(raw)));
      continue;
    }
    const heading = raw.match(/^\s{0,3}#{1,6}\s+(.*)$/);
    if (heading) {
      out.push(`*${inlineWhatsapp(heading[1])}*`);
      continue;
    }
    const bullet = raw.match(/^(\s*)[-*]\s+(.*)$/);
    if (bullet) {
      out.push(`${bullet[1]}• ${inlineWhatsapp(bullet[2])}`);
      continue;
    }
    out.push(inlineWhatsapp(raw));
  }
  return out.join("\n").trim();
}

export function whatsappChunks(md: string): string[] {
  return splitForLimit(toWhatsappText(md), WHATSAPP_LIMIT);
}
