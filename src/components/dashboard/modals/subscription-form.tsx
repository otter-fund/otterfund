"use client";

// Shared Subscription form — used identically by Add and Edit so the two modals
// stay in lockstep (mirrors account-form.tsx). Owns the field layout, the
// category fetch, and per-field validation. The parent owns submit/delete + API
// calls and the values/errors state.

import { useEffect, useState } from "react";
import { Field, TextInput, SelectInput } from "@/components/bulga/form";
import { SUBSCRIPTION_CYCLES } from "@/lib/constants";
import { gqlClient } from "@/lib/graphql/client";

const CATEGORIES = /* GraphQL */ `query Categories { categories { id name } }`;

export interface SubscriptionFormValues {
  name: string;
  amount: string;
  cycle: string;
  categoryId: string;
}

export type SubscriptionFormErrors = Partial<Record<"name" | "amount" | "cycle", string>>;

export const EMPTY_SUBSCRIPTION: SubscriptionFormValues = {
  name: "",
  amount: "",
  cycle: "Monthly",
  categoryId: "",
};

/** Validate values; returns field→message map (empty = valid). */
export function validateSubscription(v: SubscriptionFormValues): SubscriptionFormErrors {
  const errors: SubscriptionFormErrors = {};
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

interface SubscriptionFormProps {
  values: SubscriptionFormValues;
  errors: SubscriptionFormErrors;
  onChange: (patch: Partial<SubscriptionFormValues>) => void;
  /** When the parent modal opens — triggers the category fetch. */
  open: boolean;
  /** id prefix so Add/Edit don't collide on field ids. */
  idPrefix: string;
}

export function SubscriptionForm({ values, errors, onChange, open, idPrefix }: SubscriptionFormProps) {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    gqlClient
      .request<{ categories: { id: string; name: string }[] }>(CATEGORIES)
      .then(({ categories }) => setCategories(categories))
      .catch(() => setCategories([]));
  }, [open]);

  return (
    <div className="space-y-4">
      <Field label="Name" error={errors.name} htmlFor={`${idPrefix}-name`}>
        <TextInput
          id={`${idPrefix}-name`}
          value={values.name}
          invalid={!!errors.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Netflix"
        />
      </Field>
      <div className="flex gap-3">
        <Field label="Amount" error={errors.amount} htmlFor={`${idPrefix}-amount`} className="flex-1">
          <TextInput
            id={`${idPrefix}-amount`}
            type="number"
            min="0"
            step="0.01"
            value={values.amount}
            invalid={!!errors.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="0.00"
          />
        </Field>
        <Field label="Cycle" error={errors.cycle} htmlFor={`${idPrefix}-cycle`} className="flex-1">
          <SelectInput
            id={`${idPrefix}-cycle`}
            value={values.cycle}
            invalid={!!errors.cycle}
            onChange={(e) => onChange({ cycle: e.target.value })}
          >
            {SUBSCRIPTION_CYCLES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
      <Field label="Budget category" optional htmlFor={`${idPrefix}-category`}>
        <SelectInput
          id={`${idPrefix}-category`}
          value={values.categoryId}
          onChange={(e) => onChange({ categoryId: e.target.value })}
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
  );
}
