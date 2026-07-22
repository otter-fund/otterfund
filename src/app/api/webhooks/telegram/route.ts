import { handleWebhookPost } from "@/lib/messaging/inbound-route";
import { telegramAdapter } from "@/lib/messaging/telegram";

// Inbound Telegram webhook. Public by design (verified by the secret token
// header, not a session) — the proxy lets /api/* through without auth. The AI
// reply runs in `after()`, so allow up to 60s of background time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleWebhookPost(telegramAdapter, request);
}
