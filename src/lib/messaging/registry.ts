import type { MessagingAdapter, MessagingProvider } from "./types";
import { telegramAdapter } from "./telegram";
import { whatsappAdapter } from "./whatsapp";

// The single place that maps a provider string to its adapter. Both the GraphQL
// resolver (deep links, configured checks) and any future caller use this, so
// adding a provider is one entry here plus the adapter file.
export const ADAPTERS: Record<MessagingProvider, MessagingAdapter> = {
  telegram: telegramAdapter,
  whatsapp: whatsappAdapter,
};

export function adapterFor(provider: MessagingProvider): MessagingAdapter {
  return ADAPTERS[provider];
}
