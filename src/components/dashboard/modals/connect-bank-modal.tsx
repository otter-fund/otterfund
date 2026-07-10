"use client";

// Connect-a-bank flow (Plaid Link). Fetches a link_token from our server, opens
// the Plaid Link overlay, then exchanges the public_token server-side. The
// access_token never touches the client. Styled from otterfund primitives.

import { useCallback, useEffect, useState } from "react";
import {
  usePlaidLink,
  type PlaidLinkOnSuccess,
} from "react-plaid-link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/otterfund/wordmark";
import { Landmark, Loader2, ShieldCheck, RefreshCw, CheckCircle2 } from "lucide-react";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const CREATE_LINK_TOKEN = /* GraphQL */ `
  mutation CreatePlaidLinkToken {
    createPlaidLinkToken
  }
`;

const CREATE_UPDATE_LINK_TOKEN = /* GraphQL */ `
  mutation CreatePlaidUpdateLinkToken($itemId: ID) {
    createPlaidUpdateLinkToken(itemId: $itemId)
  }
`;

const EXCHANGE_PLAID_TOKEN = /* GraphQL */ `
  mutation ExchangePlaidToken($publicToken: String!, $institution: PlaidInstitutionInput) {
    exchangePlaidToken(publicToken: $publicToken, institution: $institution) { ok }
  }
`;

const SYNC_PLAID = /* GraphQL */ `
  mutation SyncPlaid($itemId: ID) {
    syncPlaid(itemId: $itemId)
  }
`;

type Phase = "loading" | "ready" | "linking" | "done" | "error";

export function ConnectBankModal({
  open,
  onClose,
  onLinked,
  updateItemId,
}: {
  open: boolean;
  onClose: () => void;
  onLinked: () => void;
  /** When set, opens Link in "update mode" to repair this Item instead of linking a new one. */
  updateItemId?: string;
}) {
  const isUpdate = !!updateItemId;
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("");

  const loadToken = useCallback(async () => {
    setPhase("loading");
    setMessage("");
    setLinkToken(null);
    try {
      const token = updateItemId
        ? (
            await gqlClient.request<{ createPlaidUpdateLinkToken: string | null }>(
              CREATE_UPDATE_LINK_TOKEN,
              { itemId: updateItemId },
            )
          ).createPlaidUpdateLinkToken
        : (
            await gqlClient.request<{ createPlaidLinkToken: string | null }>(CREATE_LINK_TOKEN)
          ).createPlaidLinkToken;
      if (!token) {
        setPhase("error");
        setMessage("Couldn't start the connection. Check that your Plaid keys are set in .env.");
        return;
      }
      setLinkToken(token);
      setPhase("ready");
    } catch (e) {
      setPhase("error");
      setMessage(errMessage(e));
    }
  }, [updateItemId]);

  // Fetch a fresh link token whenever the modal opens.
  useEffect(() => {
    if (open) loadToken();
  }, [open, loadToken]);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      setPhase("linking");
      try {
        // Update mode repairs the existing Item (no public_token exchange) — just
        // resync it to clear the error and pull anything new.
        if (updateItemId) {
          await gqlClient.request(SYNC_PLAID, { itemId: updateItemId });
        } else {
          await gqlClient.request(EXCHANGE_PLAID_TOKEN, {
            publicToken,
            institution: metadata.institution
              ? {
                  institutionId: metadata.institution.institution_id,
                  name: metadata.institution.name,
                }
              : null,
          });
        }
        setPhase("done");
        onLinked();
      } catch {
        setPhase("error");
        setMessage(
          "Connected, but the first import failed. You can sync again from the Accounts page."
        );
      }
    },
    [onLinked, updateItemId]
  );

  const { open: openPlaid, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess,
    onExit: () => {
      // User closed Plaid without finishing — let them retry.
      setPhase(linkToken ? "ready" : "error");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[440px] p-6 sm:p-9">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-[-0.02em] text-[var(--color-of-ink)]">
            {isUpdate ? "Reconnect bank" : "Connect a bank"}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-1 flex flex-col items-center text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            {phase === "done" ? (
              <CheckCircle2 className="h-7 w-7" />
            ) : (
              <Landmark className="h-7 w-7" strokeWidth={1.8} />
            )}
          </div>

          <p className="mt-4 text-[13.5px] leading-relaxed text-[var(--color-of-muted)]">
            {phase === "linking"
              ? isUpdate
                ? "Reconnecting and refreshing your data…"
                : "Importing your accounts and transactions…"
              : phase === "done"
                ? "All set. Your accounts are syncing."
                : isUpdate
                  ? "Re-authenticate with your bank to resume automatic syncing."
                  : (
                      <>
                        Securely link your bank so balances and transactions sync
                        automatically. Your credentials are encrypted and handled by
                        Plaid. <Wordmark />{" "}never sees or stores them.
                      </>
                    )}
          </p>

          {message && (
            <p className="mt-3 text-[13px] font-medium text-[var(--color-of-clay)]">
              {message}
            </p>
          )}

          <div
            className="mt-4 flex items-center gap-1.5 text-[11.5px] font-medium"
            style={{ color: "var(--color-of-faint)" }}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            256-bit encryption · powered by Plaid
          </div>
        </div>

        <div className="mt-7 flex gap-3">
          <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">
            {phase === "done" ? "Close" : "Cancel"}
          </Button>
          {phase !== "done" && (
            <Button
              size="sm"
              onClick={() => (phase === "error" ? loadToken() : openPlaid())}
              disabled={
                phase === "linking" ||
                (phase === "ready" && !ready) ||
                phase === "loading"
              }
              className="flex-[2]"
            >
              {phase === "loading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Preparing…
                </>
              ) : phase === "linking" ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Importing…
                </>
              ) : phase === "error" ? (
                "Try again"
              ) : isUpdate ? (
                "Reconnect with Plaid"
              ) : (
                "Continue with Plaid"
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
