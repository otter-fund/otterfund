// Read a request body up to a hard byte cap, so a webhook receiver can compute a
// signature over the RAW bytes without trusting Content-Length or risking a
// memory bomb. Returns null if the cap is exceeded (respond 413). Mirrors the
// helper in the Stripe webhook route.

export const MAX_WEBHOOK_BYTES = 256 * 1024;

export async function readBodyCapped(
  request: Request,
  maxBytes: number = MAX_WEBHOOK_BYTES,
): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}
