// otterfund form-field system.
//
// One pattern for every form across the app: a labelled field that renders an
// inline error beneath it and flags the control invalid. Build forms from
// <Field> + <TextInput> / <SelectInput> so spacing, focus, and error states
// are identical everywhere.

import { useState } from "react";
import { Check, ChevronDown, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const labelCls =
  "block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-of-faint)] mb-1.5";

// Controls use the shared `.of-field` / `.of-field-select` classes from
// globals.css — one source of truth for field styling across the app. When a
// field is invalid we override its border to clay.
const invalidBorder = "border-[var(--color-of-clay)] focus:border-[var(--color-of-clay)]";

interface FieldProps {
  label: string;
  /** Inline error message; when set, the field reads as invalid. */
  error?: string;
  hint?: string;
  optional?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

/** Labelled field wrapper with an inline error/hint row. */
export function Field({ label, error, hint, optional, htmlFor, className, children }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={labelCls}>
        {label}
        {optional && <span className="ml-1 normal-case tracking-normal text-[var(--color-of-faint)] font-medium">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[12px] font-medium text-[var(--color-of-clay)]">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] text-[var(--color-of-faint)]">{hint}</p>
      ) : null}
    </div>
  );
}

type TextInputProps = React.ComponentProps<"input"> & { invalid?: boolean };

/** Text/number input sharing the system control styling + error state. */
export function TextInput({ invalid, className, ...props }: TextInputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn("of-field", invalid && invalidBorder, className)}
      {...props}
    />
  );
}

/** Date input — the native picker chrome is themed to brand in globals.css.
    The WHOLE field is the tap target: clicking anywhere focuses it (so the
    accent focus border shows) and opens the native picker via showPicker(),
    matching iOS's tap-anywhere behavior instead of Chrome's icon-only target.
    Keyboard entry is untouched — typing into the segments never opens it. */
export function DateInput({ invalid, className, onClick, ...props }: TextInputProps) {
  return (
    <input
      type="date"
      aria-invalid={invalid || undefined}
      className={cn("of-field of-field-date cursor-pointer", invalid && invalidBorder, className)}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        const el = e.currentTarget;
        el.focus();
        // Needs a user gesture (this is one); guarded for engines without it,
        // where the field still opens natively (iOS) or via the icon.
        try {
          el.showPicker?.();
        } catch {}
      }}
      {...props}
    />
  );
}

/** Password input — same system control with an inline reveal/hide toggle. */
export function PasswordInput({ invalid, className, ...props }: TextInputProps) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="relative">
      <input
        type={revealed ? "text" : "password"}
        aria-invalid={invalid || undefined}
        className={cn("of-field pr-11", invalid && invalidBorder, className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-label={revealed ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-lg text-[var(--color-of-muted)] transition-colors hover:text-[var(--color-of-ink)] hover:bg-[var(--color-of-line-soft)] outline-none focus-visible:text-[var(--color-of-ink)]"
      >
        {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export interface PasswordRule {
  label: string;
  test: (value: string) => boolean;
}

/**
 * The rules a new password must satisfy. Shared between the live meter and the
 * submit-time validation so the two never drift out of sync.
 */
export const PASSWORD_RULES: PasswordRule[] = [
  { label: "8 or more characters", test: (v) => v.length >= 8 },
  { label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "One special character", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

/** True when a password satisfies every rule. */
export function passwordMeetsRules(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

// Strength tiers keyed by how many rules are met (index = met − 1). Restrained
// palette: clay → warm gold → the evergreen accent. No off-brand traffic lights.
const STRENGTH_TIERS = [
  { label: "Weak", color: "var(--color-of-clay)" },
  { label: "Fair", color: "oklch(70% 0.13 75)" },
  { label: "Strong", color: "var(--color-primary)" },
];

/**
 * Live password-strength feedback: a segmented meter plus a checklist of the
 * rules. Renders nothing until the user starts typing.
 */
export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;

  const met = PASSWORD_RULES.map((rule) => rule.test(value));
  const count = met.filter(Boolean).length;
  const tier = STRENGTH_TIERS[Math.max(0, count - 1)];

  return (
    <div className="mt-2.5">
      <div className="flex items-center gap-2.5">
        <div className="flex gap-1 flex-1" aria-hidden>
          {PASSWORD_RULES.map((_, i) => (
            <span
              key={i}
              className="h-1 flex-1 rounded-full transition-colors duration-300"
              style={{ background: i < count ? tier.color : "var(--color-of-line)" }}
            />
          ))}
        </div>
        <span
          className="text-[11px] font-semibold tracking-[0.04em] w-[42px] text-right"
          style={{ color: tier.color }}
        >
          {tier.label}
        </span>
      </div>

      <ul className="mt-2.5 flex flex-col gap-1.5" aria-label="Password requirements">
        {PASSWORD_RULES.map((rule, i) => (
          <li key={rule.label} className="flex items-center gap-2 text-[12px]">
            <span
              className="grid place-items-center w-4 h-4 rounded-full shrink-0 transition-colors duration-200"
              style={{
                background: met[i] ? "var(--color-primary)" : "transparent",
                border: met[i] ? "none" : "1px solid var(--color-of-line)",
              }}
            >
              {met[i] && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
            </span>
            <span style={{ color: met[i] ? "var(--color-of-muted)" : "var(--color-of-faint)" }}>
              {rule.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type SelectInputProps = React.ComponentProps<"select"> & { invalid?: boolean };

/** Select sharing the system control styling, with the brand chevron. */
export function SelectInput({ invalid, className, children, ...props }: SelectInputProps) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={cn("of-field-select pr-10 cursor-pointer", invalid && invalidBorder, className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--color-of-muted)]" />
    </div>
  );
}
