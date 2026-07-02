"use client";

// Edit-subscription modal. Mirrors edit-account/edit-goal: prefill from the
// selected row, save via updateSubscription, delete via deleteSubscription
// (ConfirmButton guard). Fields live in the shared <SubscriptionForm>; this
// modal owns only prefill + submit/delete + API.

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/bulga/confirm-button";
import { Trash2 } from "lucide-react";
import {
  SubscriptionForm,
  validateSubscription,
  EMPTY_SUBSCRIPTION,
  type SubscriptionFormValues,
  type SubscriptionFormErrors,
} from "@/components/dashboard/modals/subscription-form";
import type { SubscriptionView } from "@/lib/types";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const UPDATE_SUBSCRIPTION = /* GraphQL */ `
  mutation UpdateSubscription($id: ID!, $name: String, $cycle: String, $amount: Float, $categoryId: ID) {
    updateSubscription(id: $id, name: $name, cycle: $cycle, amount: $amount, categoryId: $categoryId) { ok }
  }
`;

const DELETE_SUBSCRIPTION = /* GraphQL */ `
  mutation DeleteSubscription($id: ID!) {
    deleteSubscription(id: $id) { ok }
  }
`;

export function EditSubscriptionModal({
  open,
  subscription,
  onClose,
  onUpdated,
}: {
  open: boolean;
  subscription: SubscriptionView | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [values, setValues] = useState<SubscriptionFormValues>(EMPTY_SUBSCRIPTION);
  const [errors, setErrors] = useState<SubscriptionFormErrors>({});
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (subscription && open) {
      setValues({
        name: subscription.name,
        amount: String(subscription.amount),
        cycle: subscription.cycle,
        categoryId: subscription.categoryId ?? "",
      });
      setErrors({});
      setFormError("");
    }
  }, [subscription, open]);

  const change = (patch: Partial<SubscriptionFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof SubscriptionFormErrors];
      return next;
    });
  };

  const handleSave = () => {
    if (!subscription) return;
    const found = validateSubscription(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setFormError("");
    startTransition(async () => {
      try {
        await gqlClient.request(UPDATE_SUBSCRIPTION, {
          id: subscription.id,
          name: values.name.trim(),
          cycle: values.cycle,
          amount: Number(values.amount),
          categoryId: values.categoryId || null,
        });
        onUpdated();
      } catch (e) {
        setFormError(errMessage(e));
      }
    });
  };

  const handleDelete = () => {
    if (!subscription) return;
    startTransition(async () => {
      try {
        await gqlClient.request(DELETE_SUBSCRIPTION, { id: subscription.id });
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
          <DialogTitle className="text-2xl font-bold tracking-[-0.02em] text-[var(--color-bk-ink)]">
            Edit subscription
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <SubscriptionForm values={values} errors={errors} onChange={change} open={open} idPrefix="edit-sub" />
        </div>
        {formError && (
          <p className="text-sm text-[var(--color-bk-clay)] font-medium mt-2">{formError}</p>
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
