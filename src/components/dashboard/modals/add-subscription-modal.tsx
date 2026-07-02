"use client";

// Add-subscription modal. Subscriptions are usually auto-detected from recurring
// transactions (confirmRecurring), but this lets the user add one by hand. Owns
// only submit + API; the fields live in the shared <SubscriptionForm>.

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  SubscriptionForm,
  validateSubscription,
  EMPTY_SUBSCRIPTION,
  type SubscriptionFormValues,
  type SubscriptionFormErrors,
} from "@/components/dashboard/modals/subscription-form";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const CREATE_SUBSCRIPTION = /* GraphQL */ `
  mutation CreateSubscription($input: SubscriptionCreateInput!) {
    createSubscription(input: $input) { ok }
  }
`;

export function AddSubscriptionModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [values, setValues] = useState<SubscriptionFormValues>(EMPTY_SUBSCRIPTION);
  const [errors, setErrors] = useState<SubscriptionFormErrors>({});
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Default the category to "Subscriptions" so the budget rollup has a bucket,
  // unless the user picks another. Runs once per open when the field is empty.
  useEffect(() => {
    if (!open || values.categoryId) return;
    gqlClient
      .request<{ categories: { id: string; name: string }[] }>(
        `query Categories { categories { id name } }`,
      )
      .then(({ categories }) => {
        const fallback = categories.find((c) => c.name === "Subscriptions");
        if (fallback) setValues((v) => (v.categoryId ? v : { ...v, categoryId: fallback.id }));
      })
      .catch(() => {});
  }, [open, values.categoryId]);

  const change = (patch: Partial<SubscriptionFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof SubscriptionFormErrors];
      return next;
    });
  };

  const reset = () => {
    setValues(EMPTY_SUBSCRIPTION);
    setErrors({});
    setFormError("");
  };

  const handleSubmit = () => {
    const found = validateSubscription(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setFormError("");
    startTransition(async () => {
      try {
        await gqlClient.request(CREATE_SUBSCRIPTION, {
          input: {
            name: values.name.trim(),
            amount: Number(values.amount),
            cycle: values.cycle,
            categoryId: values.categoryId || undefined,
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
          <DialogTitle className="text-2xl font-bold tracking-[-0.02em] text-[var(--color-bk-ink)]">
            New subscription
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <SubscriptionForm values={values} errors={errors} onChange={change} open={open} idPrefix="sub" />
        </div>
        {formError && (
          <p className="text-sm text-[var(--color-bk-clay)] font-medium mt-2">{formError}</p>
        )}
        <div className="flex gap-3 mt-7">
          <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isPending} className="flex-[2]">
            {isPending ? "Adding…" : "Add subscription"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
