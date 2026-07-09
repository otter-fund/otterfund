// Branded HTML shell for otterfund's own transactional email (reminders,
// digests, alerts). Mirrors the Supabase Auth templates in emails/*.html —
// same warm canvas, evergreen pill button, Newsreader headings — so every
// message the product sends reads as one voice.
//
// Colours are the otterfund tokens flattened to hex (email clients don't do
// oklch / CSS vars): canvas #f5f3ef · surface #fdfcfa · ink #231e19 ·
// muted #6d6861 · line #e6e4e0 · evergreen #007044.

const FONT_UI =
  "'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const FONT_NUM = "'Newsreader',Georgia,'Times New Roman',serif";

/** Public URL of the coral otter mark (emails/otterfund-logo.png). See EMAIL_SETUP.md. */
const LOGO_URL =
  process.env.EMAIL_LOGO_URL ??
  "https://jqayzpdgkuvdmfoicjwv.supabase.co/storage/v1/object/public/assets/otterfund-logo.png";

export interface BrandedEmailOptions {
  /** Small uppercase eyebrow above the heading (e.g. "Reminder"). */
  eyebrow?: string;
  /** Serif headline. */
  heading: string;
  /** Body HTML (paragraphs already wrapped in <p>…</p>, or plain text). */
  bodyHtml: string;
  /** Optional pill call-to-action. */
  cta?: { label: string; url: string };
  /** Optional muted footnote under the divider. */
  footnote?: string;
}

/** Escape a caller-supplied CTA label (URLs go into href attributes verbatim). */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderBrandedEmail(opts: BrandedEmailOptions): string {
  const { eyebrow, heading, bodyHtml, cta, footnote } = opts;

  const eyebrowBlock = eyebrow
    ? `<p style="margin:0 0 10px; font-family:${FONT_UI}; font-size:12px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:#007044;">${esc(eyebrow)}</p>`
    : "";

  const ctaBlock = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
        <tr>
          <td align="center" bgcolor="#007044" style="border-radius:999px;">
            <a href="${cta.url}" target="_blank" style="display:inline-block; padding:15px 34px; font-family:${FONT_UI}; font-size:16px; font-weight:600; color:#ffffff; background-color:#007044; border-radius:999px; text-decoration:none;">${esc(cta.label)}</a>
          </td>
        </tr>
      </table>`
    : "";

  const footnoteBlock = footnote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
         <tr><td style="padding:28px 0;"><div style="height:1px; line-height:1px; font-size:0; background-color:#eeedea;">&nbsp;</div></td></tr>
       </table>
       <p style="margin:0; font-family:${FONT_UI}; font-size:13px; line-height:1.6; color:#78746d;">${footnote}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <title>${esc(heading)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Hanken+Grotesk:wght@400;500;600&display=swap');
    body { margin:0 !important; padding:0 !important; width:100% !important; }
    @media (max-width:600px){ .of-card{ padding:32px 24px !important; } .of-h1{ font-size:26px !important; } }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f5f3ef; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f3ef;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px; max-width:520px;">
          <tr><td align="center" style="padding-bottom:24px;">
            <img src="${LOGO_URL}" width="132" alt="otterfund" style="display:block; width:132px; max-width:132px; height:auto; border:0;">
          </td></tr>
        </table>
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px; max-width:520px; background-color:#fdfcfa; border:1px solid #e6e4e0; border-radius:20px;">
          <tr>
            <td class="of-card" style="padding:44px 48px;">
              ${eyebrowBlock}
              <h1 class="of-h1" style="margin:0 0 16px; font-family:${FONT_NUM}; font-size:30px; line-height:1.2; font-weight:600; color:#231e19;">${esc(heading)}</h1>
              <div style="font-family:${FONT_UI}; font-size:16px; line-height:1.6; color:#6d6861;">${bodyHtml}</div>
              ${ctaBlock}
              ${footnoteBlock}
            </td>
          </tr>
        </table>
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px; max-width:520px;">
          <tr><td align="center" style="padding:24px 24px 0;">
            <p style="margin:0; font-family:${FONT_UI}; font-size:12px; line-height:1.6; color:#a8a29a;">otterfund · Calm, honest money.</p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
