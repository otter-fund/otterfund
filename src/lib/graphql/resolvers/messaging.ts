import { builder } from "../builder";
import { requireUser, badRequest } from "../errors";
import { requireEntitlement } from "../entitlements";
import {
  listMessagingConnections,
  createLinkToken,
  disconnectMessaging,
} from "@/lib/db/messaging";
import { adapterFor } from "@/lib/messaging/registry";
import { MESSAGING_PROVIDERS, isMessagingProvider } from "@/lib/messaging/types";

const PROVIDER_LABEL: Record<string, string> = { telegram: "Telegram", whatsapp: "WhatsApp" };

// Status for every provider (drives the Settings → Connections rows). Always
// returns a row per provider, merging the user's DB state with whether the server
// is configured to offer it, so the UI can render + enable/disable each cleanly.
builder.queryField("messagingConnections", (t) =>
  t.field({
    type: "JSON",
    resolve: async (_root, _args, ctx) => {
      const userId = requireUser(ctx);
      const rows = await listMessagingConnections(userId);
      const statusByProvider = new Map(rows.map((r) => [r.provider, r.status]));
      return MESSAGING_PROVIDERS.map((provider) => ({
        provider,
        status: statusByProvider.get(provider) ?? "disconnected",
        configured: adapterFor(provider).isConfigured(),
      }));
    },
  }),
);

// Begin linking a chat app. Pro-gated (hard paywall). Mints a one-time token and
// returns the deep link the client opens; the actual bind happens when the user
// taps Start/Send and the provider hits our webhook with that token.
builder.mutationField("startMessagingLink", (t) =>
  t.field({
    type: "JSON",
    args: { provider: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const userId = await requireEntitlement(ctx, "messaging");
      if (!isMessagingProvider(args.provider)) badRequest("Unknown messaging provider.");
      const provider = args.provider; // narrowed to MessagingProvider
      const adapter = adapterFor(provider);
      if (!adapter.isConfigured()) {
        badRequest(`${PROVIDER_LABEL[provider]} isn't available right now. Try the other option.`);
      }
      const token = await createLinkToken(userId, provider);
      return { provider, deepLink: adapter.deepLink(token) };
    },
  }),
);

// Unlink a provider: stop replying and drop the chat binding (history is kept).
builder.mutationField("disconnectMessaging", (t) =>
  t.field({
    type: "JSON",
    args: { provider: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      if (!isMessagingProvider(args.provider)) badRequest("Unknown messaging provider.");
      await disconnectMessaging(userId, args.provider);
      return { ok: true };
    },
  }),
);
