// Resend transport — the one place otterfund sends its OWN email from
// (reminders, digests, alerts). Supabase Auth handles signup/reset emails
// itself (over Resend SMTP — see emails/EMAIL_SETUP.md); this module is for
// everything the app triggers directly.
//
// Server-only: reads RESEND_API_KEY. Never import into a client component.
// Uses the Resend REST API over fetch (no SDK dependency to version-pin).

import { renderBrandedEmail } from "./layout";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  /** Full HTML body. Prefer building it with renderBrandedEmail() for on-brand mail. */
  html: string;
  /** Plain-text fallback. Auto-derived from a stripped HTML if omitted. */
  text?: string;
  /** Override the default From. Must be on a domain verified in Resend. */
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  id: string;
}

/**
 * Send an email through Resend. Throws on a non-2xx response so callers can
 * decide whether a failed send should fail the surrounding action.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const from = input.from ?? process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set (e.g. 'otterfund <no-reply@yourdomain.com>')");

  const body: Record<string, unknown> = {
    from,
    to: Array.isArray(input.to) ? input.to : [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text ?? stripHtml(input.html),
  };
  if (input.replyTo) body.reply_to = input.replyTo;

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${detail}`);
  }

  return (await res.json()) as SendEmailResult;
}

/** Crude HTML → text fallback for the plain-text part. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export { renderBrandedEmail };
