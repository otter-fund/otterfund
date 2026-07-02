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
import { Trash2, Unlink } from "lucide-react";
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

  // Synced accounts disconnect the whole bank link (removes its accounts +
  // transactions). Manual accounts are simply deleted.
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
        setFormError(synced ? "Couldn't disconnect the account." : "Couldn't delete the account.");
      }
    });
  };

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[480px] p-9">
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
            Synced from {account.institution || "your bank"}. Balance and transactions
            update automatically — disconnect to manage this account manually.
          </div>
        )}

        {formError && <p className="text-sm text-[var(--color-bk-clay)] font-medium mt-3">{formError}</p>}

        <div className="flex items-center gap-2.5 mt-7">
          <ConfirmButton
            onConfirm={handleRemove}
            icon={synced ? Unlink : Trash2}
            confirmLabel="Are you sure?"
            busyLabel={synced ? "Disconnecting…" : "Deleting…"}
            busy={isPending}
            restLabel={synced ? "Disconnect account" : "Delete account"}
            armedLabel={synced ? "Confirm disconnect account" : "Confirm delete account"}
            expandedWidth={synced ? "w-[172px]" : "w-[148px]"}
            labelMaxWidth={synced ? "max-w-[160px]" : "max-w-[140px]"}
          />
          <Button size="sm" onClick={handleSave} disabled={isPending} className="ml-auto">
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
