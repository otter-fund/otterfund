"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AccountForm,
  validateAccount,
  DEFAULT_ACCOUNT_COLOR,
  type AccountFormValues,
  type AccountFormErrors,
} from "@/components/dashboard/modals/account-form";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const CREATE_ACCOUNT = /* GraphQL */ `
  mutation CreateAccount($input: AccountCreateInput!) {
    createAccount(input: $input) { ok }
  }
`;

const EMPTY: AccountFormValues = {
  name: "",
  type: "Chequing",
  balance: "",
  number: "",
  gradient: DEFAULT_ACCOUNT_COLOR,
};

export function AddAccountModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [values, setValues] = useState<AccountFormValues>(EMPTY);
  const [errors, setErrors] = useState<AccountFormErrors>({});
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  const change = (patch: Partial<AccountFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    // Clear a field's error as the user corrects it.
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof AccountFormErrors];
      return next;
    });
  };

  const handleSubmit = () => {
    const found = validateAccount(values);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setFormError("");
    startTransition(async () => {
      try {
        await gqlClient.request(CREATE_ACCOUNT, {
          input: {
            name: values.name.trim(),
            type: values.type.toLowerCase().replace(" ", "-"),
            balance: Number(values.balance) || 0, // balance defaults to 0
            number: values.number.trim() || undefined,
            gradient: values.gradient,
          },
        });
        setValues(EMPTY);
        setErrors({});
        onAdded();
      } catch (e) {
        setFormError(errMessage(e));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-6 sm:p-9">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-[-0.02em] text-[var(--color-bk-ink)]">
            Add account
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          <AccountForm values={values} errors={errors} onChange={change} />
        </div>

        {formError && <p className="text-sm text-[var(--color-bk-clay)] font-medium mt-3">{formError}</p>}

        <div className="flex gap-3 mt-7">
          <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isPending} className="flex-[2]">
            {isPending ? "Adding…" : "Add account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
