"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/bulga/confirm-button";
import { Trash2, Unlink, Eye, EyeOff } from "lucide-react";
import type { AccountView } from "@/lib/types";
import { ACCOUNT_TYPES } from "@/lib/constants";
import {
  AccountForm,
  validateAccount,
  DEFAULT_ACCOUNT_COLOR,
  type AccountFormValues,
  type AccountFormErrors,
} from "@/components/dashboard/modals/account-form";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const UPDATE_ACCOUNT = /* GraphQL */ `
  mutation UpdateAccount($id: ID!, $input: AccountUpdateInput!) {
    updateAccount(id: $id, input: $input) { ok }
  }
`;

const DELETE_ACCOUNT = /* GraphQL */ `
  mutation DeleteAccount($id: ID!) {
    deleteAccount(id: $id) { ok }
  }
`;

const UNLINK_PLAID_ITEM = /* GraphQL */ `
  mutation UnlinkPlaidItem($accountId: ID) {
    unlinkPlaidItem(accountId: $accountId) { ok }
  }
`;

const SET_ACCOUNT_EXCLUDED = /* GraphQL */ `
  mutation SetAccountExcluded($id: ID!, $excluded: Boolean!) {
    setAccountExcluded(id: $id, excluded: $excluded) { ok }
  }
`;

const TYPE_TO_API = (label: string) => label.toLowerCase().replace(" ", "-");
const API_TO_TYPE = (api: string) =>
  ACCOUNT_TYPES.find((t) => t.toLowerCase().replace(" ", "-") === api) || "Other";

interface EditAccountModalProps {
  open: boolean;
  account: AccountView | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditAccountModal({ open, account, onClose, onUpdated }: EditAccountModalProps) {
  const [values, setValues] = useState<AccountFormValues>({
    name: "",
    type: "Chequing",
    balance: "",
    number: "",
    gradient: DEFAULT_ACCOUNT_COLOR,
  });
  const [errors, setErrors] = useState<AccountFormErrors>({});
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  const synced = !!account?.synced;

  useEffect(() => {
    if (account && open) {
      setValues({
        name: account.name,
        type: account.type ? API_TO_TYPE(account.type) : "Chequing",
        balance: String(account.balance),
        number: account.num || "",
        gradient: account.bg || DEFAULT_ACCOUNT_COLOR,
      });
      setErrors({});
      setFormError("");
    }
  }, [account, open]);

  const change = (patch: Partial<AccountFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof AccountFormErrors];
      return next;
    });
  };

  const handleSave = () => {
    if (!account) return;
    const found = validateAccount(values);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setFormError("");
    startTransition(async () => {
      try {
        await gqlClient.request(UPDATE_ACCOUNT, {
          id: account.id,
          input: {
            name: values.name.trim(),
            type: TYPE_TO_API(values.type),
            // Never overwrite a synced account's anchor balance from the form.
            ...(synced ? {} : { balance: Number(values.balance) || 0 }),
            number: values.number.trim() || null,
            gradient: values.gradient,
          },
        });
        onClose();
        onUpdated();
      } catch (e) {
        setFormError(errMessage(e));
      }
    });
  };

  // Manual accounts are deleted; synced accounts unlink their WHOLE bank
  // (Plaid is item-level — you can't remove one account of an item via the API).
  const handleRemove = () => {
    if (!account) return;
    startTransition(async () => {
      try {
        if (synced) {
          await gqlClient.request(UNLINK_PLAID_ITEM, { accountId: account.id });
        } else {
          await gqlClient.request(DELETE_ACCOUNT, { id: account.id });
        }
        onClose();
        onUpdated();
      } catch {
        setFormError(synced ? "Couldn't disconnect the bank." : "Couldn't delete the account.");
      }
    });
  };

  // Hide/show a single synced account locally without touching the bank link —
  // this is how you omit ONE account of a bank while the others keep syncing.
  const handleToggleExcluded = () => {
    if (!account) return;
    startTransition(async () => {
      try {
        await gqlClient.request(SET_ACCOUNT_EXCLUDED, { id: account.id, excluded: !account.excluded });
        onClose();
        onUpdated();
      } catch {
        setFormError("Couldn't update the account.");
      }
    });
  };

  // Render the Dialog even with no account: unmounting the Root here would
  // skip Base UI's enter/exit transitions (mounted-already-open pops in;
  // instant unmount kills the slide-out). `synced` is null-safe, the direct
  // `account.*` reads sit inside `synced`-guarded branches, and every handler
  // guards on `account`.
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-6 sm:p-9">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-[-0.02em] text-[var(--color-bk-ink)]">
            Edit account
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          <AccountForm values={values} errors={errors} onChange={change} lockBalance={synced} />
        </div>

        {synced && (
          <div
            className="mt-4 rounded-xl p-3 text-[12.5px] leading-relaxed"
            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            Synced from {account.institution || "your bank"}. To omit just this account,
            hide it: it stays synced but drops out of your net worth. Disconnecting
            removes the entire bank and all its accounts.
          </div>
        )}

        {formError && <p className="text-sm text-[var(--color-bk-clay)] font-medium mt-3">{formError}</p>}

        {synced ? (
          // Single row: whole-bank disconnect (left, compact) + hide & save (right).
          <div className="flex items-center gap-2.5 mt-7">
            <ConfirmButton
              onConfirm={handleRemove}
              icon={Unlink}
              confirmLabel="Are you sure?"
              busyLabel="Disconnecting…"
              busy={isPending}
              restText="Disconnect"
              restWidth="w-[132px]"
              restLabel="Disconnect bank"
              armedLabel="Confirm disconnect bank"
              expandedWidth="w-[172px]"
              labelMaxWidth="max-w-[160px]"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleToggleExcluded}
              disabled={isPending}
              className="ml-auto"
            >
              {account.excluded ? (
                <>
                  <Eye data-icon="inline-start" size={15} /> Show
                </>
              ) : (
                <>
                  <EyeOff data-icon="inline-start" size={15} /> Hide
                </>
              )}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 mt-7">
            <ConfirmButton
              onConfirm={handleRemove}
              icon={Trash2}
              confirmLabel="Are you sure?"
              busyLabel="Deleting…"
              busy={isPending}
              restLabel="Delete account"
              armedLabel="Confirm delete account"
              expandedWidth="w-[148px]"
              labelMaxWidth="max-w-[140px]"
            />
            <Button size="sm" onClick={handleSave} disabled={isPending} className="ml-auto">
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
