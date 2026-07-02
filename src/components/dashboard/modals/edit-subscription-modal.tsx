"use client";

// Edit-subscription modal. Mirrors edit-goal/edit-account: prefill from the
// selected row, save via updateSubscription, delete via deleteSubscription
// (ConfirmButton guard). Same form system + validate() shape as the add modal.

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
import { Field, TextInput, SelectInput } from "@/components/bulga/form";
import { SUBSCRIPTION_CYCLES } from "@/lib/constants";
import type { SubscriptionView } from "@/lib/types";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const CATEGORIES = /* GraphQL */ `query Categories { categories { id name } }`;

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

interface Values {
  name: string;
  amount: string;
  cycle: string;
  categoryId: string;
}

function validate(v: Values): Partial<Record<keyof Values, string>> {
  const errors: Partial<Record<keyof Values, string>> = {};
  if (!v.name.trim()) errors.name = "Give the subscription a name.";
  const amount = Number(v.amount);
  if (!v.amount.trim() || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Enter an amount greater than zero.";
  }
  if (!SUBSCRIPTION_CYCLES.includes(v.cycle as (typeof SUBSCRIPTION_CYCLES)[number])) {
    errors.cycle = "Pick a billing cycle.";
  }
  return errors;
}

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
  const [values, setValues] = useState<Values>({ name: "", amount: "", cycle: "Monthly", categoryId: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
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

  useEffect(() => {
    if (!open) return;
    gqlClient
      .request<{ categories: { id: string; name: string }[] }>(CATEGORIES)
      .then(({ categories }) => setCategories(categories))
      .catch(() => setCategories([]));
  }, [open]);

  const set = (field: keyof Values, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  const handleSave = () => {
    if (!subscription) return;
    const found = validate(values);
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
        <div className="space-y-4 mt-2">
          <Field label="Name" error={errors.name} htmlFor="edit-sub-name">
            <TextInput
              id="edit-sub-name"
              value={values.name}
              invalid={!!errors.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Netflix"
            />
          </Field>
          <div className="flex gap-3">
            <Field label="Amount" error={errors.amount} htmlFor="edit-sub-amount" className="flex-1">
              <TextInput
                id="edit-sub-amount"
                type="number"
                min="0"
                step="0.01"
                value={values.amount}
                invalid={!!errors.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Cycle" error={errors.cycle} htmlFor="edit-sub-cycle" className="flex-1">
              <SelectInput
                id="edit-sub-cycle"
                value={values.cycle}
                invalid={!!errors.cycle}
                onChange={(e) => set("cycle", e.target.value)}
              >
                {SUBSCRIPTION_CYCLES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <Field label="Budget category" optional htmlFor="edit-sub-category">
            <SelectInput
              id="edit-sub-category"
              value={values.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
          </Field>
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
