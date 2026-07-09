"use client";

// Edit-investment modal. Mirrors edit-subscription: prefill from the selected
// holding, save via updateInvestment, delete via deleteInvestment (ConfirmButton
// guard). Fields live in the shared <InvestmentForm>; this modal owns only
// prefill + submit/delete + API. Optional fields left blank are sent as null so
// they clear.

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/otterfund/confirm-button";
import { Trash2 } from "lucide-react";
import {
  InvestmentForm,
  validateInvestment,
  EMPTY_INVESTMENT,
  type InvestmentFormValues,
  type InvestmentFormErrors,
} from "@/components/dashboard/modals/investment-form";
import type { InvestmentView } from "@/lib/types";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const UPDATE_INVESTMENT = /* GraphQL */ `
  mutation UpdateInvestment($id: ID!, $input: InvestmentUpdateInput!) {
    updateInvestment(id: $id, input: $input) { ok }
  }
`;

const DELETE_INVESTMENT = /* GraphQL */ `
  mutation DeleteInvestment($id: ID!) {
    deleteInvestment(id: $id) { ok }
  }
`;

export function EditInvestmentModal({
  open,
  investment,
  onClose,
  onUpdated,
}: {
  open: boolean;
  investment: InvestmentView | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [values, setValues] = useState<InvestmentFormValues>(EMPTY_INVESTMENT);
  const [errors, setErrors] = useState<InvestmentFormErrors>({});
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (investment && open) {
      setValues({
        name: investment.name,
        symbol: investment.symbol ?? "",
        assetClass: investment.assetClass,
        accountId: investment.accountId ?? "",
        value: String(investment.value),
        costBasis: investment.costBasis != null ? String(investment.costBasis) : "",
        quantity: investment.quantity != null ? String(investment.quantity) : "",
      });
      setErrors({});
      setFormError("");
    }
  }, [investment, open]);

  const change = (patch: Partial<InvestmentFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof InvestmentFormErrors];
      return next;
    });
  };

  const handleSave = () => {
    if (!investment) return;
    const found = validateInvestment(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setFormError("");
    startTransition(async () => {
      try {
        await gqlClient.request(UPDATE_INVESTMENT, {
          id: investment.id,
          input: {
            name: values.name.trim(),
            symbol: values.symbol.trim() || null,
            assetClass: values.assetClass,
            accountId: values.accountId || null,
            value: Number(values.value),
            costBasis: values.costBasis.trim() ? Number(values.costBasis) : null,
            quantity: values.quantity.trim() ? Number(values.quantity) : null,
          },
        });
        onUpdated();
      } catch (e) {
        setFormError(errMessage(e));
      }
    });
  };

  const handleDelete = () => {
    if (!investment) return;
    startTransition(async () => {
      try {
        await gqlClient.request(DELETE_INVESTMENT, { id: investment.id });
        onUpdated();
      } catch (e) {
        setFormError(errMessage(e));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[460px] p-6 sm:p-9">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-[-0.02em] text-[var(--color-of-ink)]">
            Edit investment
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2 min-w-0">
          <InvestmentForm values={values} errors={errors} onChange={change} open={open} idPrefix="edit-inv" />
        </div>
        {formError && (
          <p className="text-sm text-[var(--color-of-clay)] font-medium mt-2">{formError}</p>
        )}
        <div className="flex items-center gap-2.5 mt-6">
          <ConfirmButton
            onConfirm={handleDelete}
            icon={Trash2}
            confirmLabel="Are you sure?"
            busyLabel="Deleting…"
            busy={isPending}
            restLabel="Delete"
            armedLabel="Confirm delete"
          />
          <Button size="sm" onClick={handleSave} disabled={isPending} className="ml-auto">
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
