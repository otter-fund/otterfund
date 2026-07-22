import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import type { MessagingProvider } from "@/lib/messaging/types";

// Persistence for the "text your advisor" channels (Telegram / WhatsApp). Every
// function is scoped by userId or by the provider+chat binding, so one user's
// connection can never reach another's. See prisma MessagingConnection /
// MessagingEvent.

// How long a link token stays valid after the user taps "Connect" in Settings —
// long enough to open the chat app and hit Start, short enough that a leaked link
// is quickly useless.
const LINK_TOKEN_TTL_MS = 15 * 60 * 1000;

/** A connection's public-facing state for the settings UI (no chat ids leak). */
export interface MessagingConnectionView {
  provider: MessagingProvider;
  status: string; // pending | active | disconnected
}

/** Status per provider for the current user (drives the Settings rows). */
export async function listMessagingConnections(userId: string): Promise<MessagingConnectionView[]> {
  const rows = await prisma.messagingConnection.findMany({
    where: { userId },
    select: { provider: true, status: true },
  });
  return rows.map((r) => ({ provider: r.provider as MessagingProvider, status: r.status }));
}

/**
 * Mint a one-time link token for (user, provider) and upsert a pending row,
 * clearing any previous chat binding so re-linking always starts fresh. Returns
 * the token to embed in the connect deep link.
 */
export async function createLinkToken(userId: string, provider: MessagingProvider): Promise<string> {
  const token = randomBytes(24).toString("base64url"); // ~32 URL-safe chars
  const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MS);
  await prisma.messagingConnection.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider, status: "pending", linkToken: token, linkTokenExpiresAt: expiresAt },
    update: {
      status: "pending",
      linkToken: token,
      linkTokenExpiresAt: expiresAt,
      providerChatId: null,
    },
  });
  return token;
}

/** The fields the inbound handler needs about a resolved connection. */
export interface ResolvedConnection {
  id: string;
  userId: string;
  conversationId: string | null;
}

/**
 * Bind an incoming chat to the user who owns `token`, if it is valid + unexpired.
 * Sets the connection active, stores the chat id, and clears the token (single
 * use). Returns the activated connection, or null if the token is unknown/expired.
 */
export async function activateConnectionByToken(
  provider: MessagingProvider,
  token: string,
  providerChatId: string,
): Promise<ResolvedConnection | null> {
  const conn = await prisma.messagingConnection.findUnique({
    where: { linkToken: token },
    select: { id: true, userId: true, provider: true, linkTokenExpiresAt: true, conversationId: true },
  });
  if (!conn || conn.provider !== provider) return null;
  if (!conn.linkTokenExpiresAt || conn.linkTokenExpiresAt.getTime() < Date.now()) return null;

  // If this chat id was bound elsewhere for this provider, detach it there first
  // so the unique(provider, providerChatId) holds (rare: linking a second account
  // from the same chat).
  await prisma.messagingConnection.updateMany({
    where: { provider, providerChatId, NOT: { id: conn.id } },
    data: { providerChatId: null, status: "disconnected" },
  });

  await prisma.messagingConnection.update({
    where: { id: conn.id },
    data: { status: "active", providerChatId, linkToken: null, linkTokenExpiresAt: null },
  });
  return { id: conn.id, userId: conn.userId, conversationId: conn.conversationId };
}

/** The active connection for an incoming chat, or null if none/disconnected. */
export async function getActiveConnectionByChatId(
  provider: MessagingProvider,
  providerChatId: string,
): Promise<ResolvedConnection | null> {
  const conn = await prisma.messagingConnection.findUnique({
    where: { provider_providerChatId: { provider, providerChatId } },
    select: { id: true, userId: true, status: true, conversationId: true },
  });
  if (!conn || conn.status !== "active") return null;
  return { id: conn.id, userId: conn.userId, conversationId: conn.conversationId };
}

/** Attach the rolling advisor conversation to a connection (set once, lazily). */
export async function setConnectionConversation(id: string, conversationId: string): Promise<void> {
  await prisma.messagingConnection.update({ where: { id }, data: { conversationId } }).catch(() => {});
}

/**
 * Disconnect a provider for a user: stop replying and drop the chat binding, but
 * keep the row (so the rolling conversation history survives and re-linking reuses
 * the upsert target).
 */
export async function disconnectMessaging(userId: string, provider: MessagingProvider): Promise<void> {
  await prisma.messagingConnection.updateMany({
    where: { userId, provider },
    data: { status: "disconnected", providerChatId: null, linkToken: null, linkTokenExpiresAt: null },
  });
}

/**
 * Idempotency guard for inbound webhooks. Records an event id; returns true the
 * first time it's seen and false on a duplicate delivery (unique-constraint clash).
 * Recorded BEFORE the AI call so a duplicate can't trigger a second (billable) answer.
 */
export async function recordMessagingEvent(
  eventId: string,
  provider: MessagingProvider,
  userId?: string | null,
): Promise<boolean> {
  try {
    await prisma.messagingEvent.create({ data: { id: eventId, provider, userId: userId ?? null } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}
