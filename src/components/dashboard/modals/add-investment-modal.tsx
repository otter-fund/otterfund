"use client";

// Add-investment modal. Lets the user add a holding by hand. Owns only submit +
// API; the fields live in the shared <InvestmentForm>. On create the resolver
// resolves a logo domain from the name (same path as subscriptions).

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  InvestmentForm,
  validateInvestment,
  EMPTY_INVESTMENT,
  type InvestmentFormValues,
  type InvestmentFormErrors,
} from "@/components/dashboard/modals/investment-form";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const CREATE_INVESTMENT = /* GraphQL */ `
  mutation CreateInvestment($input: InvestmentCreateInput!) {
    createInvestment(input: $input) { ok }
  }
`;

export function AddInvestmentModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [values, setValues] = useState<InvestmentFormValues>(EMPTY_INVESTMENT);
  const [errors, setErrors] = useState<InvestmentFormErrors>({});
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  const change = (patch: Partial<InvestmentFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof InvestmentFormErrors];
      return next;
    });
  };

  const reset = () => {
    setValues(EMPTY_INVESTMENT);
    setErrors({});
    setFormError("");
  };

  const handleSubmit = () => {
    const found = validateInvestment(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setFormError("");
    startTransition(async () => {
      try {
        await gqlClient.request(CREATE_INVESTMENT, {
          input: {
            name: values.name.trim(),
            symbol: values.symbol.trim() || undefined,
            assetClass: values.assetClass,
            accountId: values.accountId || undefined,
            value: Number(values.value),
            costBasis: values.costBasis.trim() ? Number(values.costBasis) : undefined,
            quantity: values.quantity.trim() ? Number(values.quantity) : undefined,
          },
        });
        reset();
        onAdded();
      } catch (e) {
        setFormError(errMessage(e));
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[460px] p-6 sm:p-9">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-[-0.02em] text-[var(--color-of-ink)]">
            New investment
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2 min-w-0">
          <InvestmentForm values={values} errors={errors} onChange={change} open={open} idPrefix="inv" />
        </div>
        {formError && (
          <p className="text-sm text-[var(--color-of-clay)] font-medium mt-2">{formError}</p>
        )}
        <div className="flex gap-3 mt-7">
          <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isPending} className="flex-[2]">
            {isPending ? "Adding…" : "Add investment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
