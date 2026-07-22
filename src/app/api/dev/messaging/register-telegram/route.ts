import { getApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db/prisma";
import { registerTelegramWebhook } from "@/lib/messaging/telegram";

// Admin-only, one-tap Telegram webhook registration (calls setWebhook with our
// URL + secret). Idempotent — safe to re-run after a deploy or a secret rotation.
// The alternative is a manual setWebhook curl; this just makes it a button.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const result = await registerTelegramWebhook();
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
