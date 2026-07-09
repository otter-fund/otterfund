"use client";

// Shared Account form — used identically by Add and Edit so the two modals
// stay in lockstep. Owns the field layout, the color picker, the live preview
// card, and per-field validation. The parent owns submit/delete + API calls.

import { Check } from "lucide-react";
import { Field, TextInput, SelectInput } from "@/components/otterfund/form";
import { ACCOUNT_TYPES } from "@/lib/constants";

export const ACCOUNT_COLORS: { name: string; value: string }[] = [
  { name: "Charcoal", value: "linear-gradient(135deg, oklch(18% 0.012 260), oklch(28% 0.015 260))" },
  { name: "Sage", value: "linear-gradient(135deg, oklch(52% 0.08 155), oklch(62% 0.09 170))" },
  { name: "Slate", value: "linear-gradient(135deg, oklch(44% 0.07 245), oklch(56% 0.08 255))" },
  { name: "Plum", value: "linear-gradient(135deg, oklch(60% 0.07 290), oklch(52% 0.09 280))" },
  { name: "Sky", value: "linear-gradient(135deg, oklch(58% 0.09 210), oklch(50% 0.08 220))" },
  { name: "Terra", value: "linear-gradient(135deg, oklch(55% 0.09 38), oklch(65% 0.1 50))" },
  { name: "Sand", value: "linear-gradient(135deg, oklch(60% 0.05 80), oklch(50% 0.05 80))" },
];

export const DEFAULT_ACCOUNT_COLOR = ACCOUNT_COLORS[0].value;

export interface AccountFormValues {
  name: string;
  type: string;
  balance: string;
  number: string;
  gradient: string;
}

export type AccountFormErrors = Partial<Record<"name" | "balance", string>>;

/** Validate values; returns field→message map (empty = valid). Balance defaults to 0, so only a non-numeric entry is an error. */
export function validateAccount(v: AccountFormValues): AccountFormErrors {
  const errors: AccountFormErrors = {};
  if (!v.name.trim()) errors.name = "Give the account a name.";
  if (v.balance.trim() !== "" && Number.isNaN(Number(v.balance))) {
    errors.balance = "Enter a valid number.";
  }
  return errors;
}

interface AccountFormProps {
  values: AccountFormValues;
  errors: AccountFormErrors;
  onChange: (patch: Partial<AccountFormValues>) => void;
  /** Lock the balance field — used for bank-synced accounts. */
  lockBalance?: boolean;
}

export function AccountForm({ values, errors, onChange, lockBalance }: AccountFormProps) {
  return (
    <div className="flex flex-col gap-5">
      <Field label="Account name" error={errors.name} htmlFor="acct-name">
        <TextInput
          id="acct-name"
          value={values.name}
          invalid={!!errors.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. TD Chequing"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Balance"
          error={errors.balance}
          hint={errors.balance ? undefined : lockBalance ? "Managed by your bank" : "Defaults to $0.00"}
          htmlFor="acct-balance"
        >
          <TextInput
            id="acct-balance"
            type="number"
            inputMode="decimal"
            value={values.balance}
            invalid={!!errors.balance}
            disabled={lockBalance}
            onChange={(e) => onChange({ balance: e.target.value })}
            placeholder="0.00"
            className={lockBalance ? "opacity-60 cursor-not-allowed" : undefined}
          />
        </Field>
        <Field label="Type" htmlFor="acct-type">
          <SelectInput
            id="acct-type"
            value={values.type}
            onChange={(e) => onChange({ type: e.target.value })}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <Field label="Account number" optional htmlFor="acct-number">
        <TextInput
          id="acct-number"
          value={values.number}
          onChange={(e) => onChange({ number: e.target.value })}
          placeholder="e.g. ·· 4821"
        />
      </Field>

      <Field label="Color">
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_COLORS.map((c) => {
            const selected = c.value === values.gradient;
            // Ring in the swatch's OWN hue (its first gradient stop), not the
            // app accent — a sage swatch gets a sage ring. Set via Tailwind's
            // ring-color variable since a class can't carry a per-swatch value.
            const ringColor = c.value.match(/oklch\([^)]+\)/)?.[0] ?? "var(--color-primary)";
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => onChange({ gradient: c.value })}
                title={c.name}
                aria-label={c.name}
                aria-pressed={selected}
                className={`relative w-9 h-9 rounded-full transition-transform duration-200 cursor-pointer ${
                  selected
                    ? "scale-110 ring-2 ring-offset-2 ring-offset-[var(--color-of-surface)]"
                    : "hover:scale-110"
                }`}
                style={{ background: c.value, ...(selected ? { ["--tw-ring-color" as string]: ringColor } : {}) }}
              >
                {selected && (
                  <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow-[0_1px_2px_oklch(0%_0_0/0.4)]" />
                )}
              </button>
            );
          })}
        </div>
      </Field>

      {/* live preview */}
      <div className="rounded-xl p-4 text-white" style={{ background: values.gradient }} aria-hidden>
        <div className="text-[12px] font-semibold opacity-80">{values.name || "Account name"}</div>
        <div className="of-num text-[22px] tracking-[-0.03em] mt-1">
          {`$${(Number(values.balance) || 0).toLocaleString("en-CA", { minimumFractionDigits: 2 })}`}
        </div>
      </div>
    </div>
  );
}
