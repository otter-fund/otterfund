import { after } from "next/server";
import type { MessagingAdapter } from "./types";
import { readBodyCapped } from "./webhook-util";
import { handleInbound } from "./handler";
import { rateLimit, tooManyRequests, MINUTE } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/log";

// Shared POST pipeline for every inbound messaging webhook. The route files just
// pick the adapter. The flow: flood-guard → read raw bytes → verify provenance →
// parse → ACK 200 immediately, then answer in the background via `after()` so the
// slow AI turn never delays the ack (or the provider will retry and duplicate).
export async function handleWebhookPost(adapter: MessagingAdapter, request: Request): Promise<Response> {
  const flood = rateLimit(`msg:webhook:${adapter.provider}`, [{ limit: 240, windowMs: MINUTE }]);
  if (!flood.ok) return tooManyRequests(flood.retryAfterSec);

  const raw = await readBodyCapped(request);
  if (raw === null) return Response.json({ error: "Payload too large" }, { status: 413 });

  if (!adapter.verify(request, raw)) {
    logSecurityEvent("webhook.signature_failed", { source: adapter.provider });
    return new Response("forbidden", { status: 403 });
  }

  const messages = adapter.parse(raw);
  if (messages.length > 0) {
    after(async () => {
      for (const m of messages) {
        try {
          await handleInbound(adapter, m);
        } catch (err) {
          console.error(`[messaging:${adapter.provider}] inbound error`, err);
        }
      }
    });
  }

  return Response.json({ ok: true });
}
