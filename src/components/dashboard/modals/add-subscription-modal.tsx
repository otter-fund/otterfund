"use client";

// Add-subscription modal. Subscriptions are usually auto-detected from recurring
// transactions (confirmRecurring), but this lets the user add one by hand — same
// modal/CRUD pattern as add-goal/add-account. Built on the shared form system
// (Field + TextInput/SelectInput) with a pure validate() helper.

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, TextInput, SelectInput } from "@/components/bulga/form";
import { SUBSCRIPTION_CYCLES } from "@/lib/constants";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const CATEGORIES = /* GraphQL */ `query Categories { categories { id name } }`;

const CREATE_SUBSCRIPTION = /* GraphQL */ `
  mutation CreateSubscription($input: SubscriptionCreateInput!) {
    createSubscription(input: $input) { ok }
  }
`;

interface Values {
  name: string;
  amount: string;
  cycle: string;
  categoryId: string;
}

const EMPTY: Values = { name: "", amount: "", cycle: "Monthly", categoryId: "" };

/** Pure validation → { field: message }. Empty object means valid. */
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

export function AddSubscriptionModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    gqlClient
      .request<{ categories: { id: string; name: string }[] }>(CATEGORIES)
      .then(({ categories }) => {
        setCategories(categories);
        // Default new subscriptions to the "Subscriptions" bucket so the budget
        // rollup always has a category, unless the user picks another.
        const fallback = categories.find((c) => c.name === "Subscriptions");
        if (fallback) {
          setValues((v) => (v.categoryId ? v : { ...v, categoryId: fallback.id }));
        }
      })
      .catch(() => setCategories([]));
  }, [open]);

  const set = (field: keyof Values, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    // Clear this field's error as the user edits it.
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  const reset = () => {
    setValues(EMPTY);
    setErrors({});
    setFormError("");
  };

  const handleSubmit = () => {
    const found = validate(values);
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
        <div className="space-y-4 mt-2">
          <Field label="Name" error={errors.name} htmlFor="sub-name">
            <TextInput
              id="sub-name"
              value={values.name}
              invalid={!!errors.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Netflix"
            />
          </Field>
          <div className="flex gap-3">
            <Field label="Amount" error={errors.amount} htmlFor="sub-amount" className="flex-1">
              <TextInput
                id="sub-amount"
                type="number"
                min="0"
                step="0.01"
                value={values.amount}
                invalid={!!errors.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Cycle" error={errors.cycle} htmlFor="sub-cycle" className="flex-1">
              <SelectInput
                id="sub-cycle"
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
          <Field label="Budget category" optional htmlFor="sub-category">
            <SelectInput
              id="sub-category"
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
