import { handleWebhookPost } from "@/lib/messaging/inbound-route";
import { whatsappAdapter } from "@/lib/messaging/whatsapp";

// Inbound WhatsApp Cloud API webhook. Public by design (verified by the
// X-Hub-Signature-256 HMAC on POST). The AI reply runs in `after()`.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Meta's one-time subscription handshake: echo hub.challenge back verbatim when
// the verify token matches the one configured in the Meta app dashboard.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge != null) {
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(request: Request) {
  return handleWebhookPost(whatsappAdapter, request);
}
