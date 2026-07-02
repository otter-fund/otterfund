"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Field,
  PasswordInput,
  PasswordStrength,
  passwordMeetsRules,
} from "@/components/bulga/form";
import { Button } from "@/components/ui/button";

type FieldErrors = { password?: string; confirm?: string };
type Status = "checking" | "ready" | "expired";

// Step 2 of the password-reset flow. The recovery link routes through
// /auth/callback, which exchanges the ?code for a session and forwards here —
// so by the time this renders the user holds a (recovery) session and can call
// updateUser. If there's no session, the link was invalid/expired.
export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "ready" : "expired");
    });
  }, []);

  // Clear a field's inline error as the user edits it (Bulga form pattern).
  function clearErrors(...fields: (keyof FieldErrors)[]) {
    setFieldErrors((prev) => {
      if (!fields.some((f) => prev[f])) return prev;
      const next = { ...prev };
      for (const f of fields) delete next[f];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const errors: FieldErrors = {};
    if (!passwordMeetsRules(password))
      errors.password = "Choose a password that meets all three requirements below.";
    if (confirm !== password) errors.confirm = "Passwords don't match.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      // The user is authenticated here, so there's no enumeration risk — surface
      // the real reason (e.g. the server's stricter length/complexity floor,
      // which can exceed the client meter) so they can correct it.
      setError(
        updateError.message ||
          "We couldn't update your password. Please choose a stronger one and try again.",
      );
      setLoading(false);
      return;
    }

    // Password changed and the session is still valid — full navigation so the
    // proxy routes to dashboard or onboarding as appropriate.
    window.location.href = "/dashboard";
  }

  if (status === "checking") {
    return (
      <p className="bk-enter py-4 text-center text-sm text-[var(--color-bk-muted)]">Loading…</p>
    );
  }

  if (status === "expired") {
    return (
      <div className="bk-enter flex flex-col items-center gap-5 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--color-bk-ink)]">
            This link has expired
          </h1>
          <p className="text-sm leading-relaxed text-[var(--color-bk-muted)]">
            Password reset links can only be used once and expire after a short while. Request a
            fresh one to continue.
          </p>
        </div>

        <Link
          href="/forgot-password"
          className="grid h-11 w-full place-items-center rounded-full bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
        >
          Request a new link
        </Link>

        <Link
          href="/login"
          className="text-[13px] font-semibold text-[var(--color-primary)] hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="bk-enter">
      <header className="mb-8">
        <h1 className="text-[27px] font-semibold tracking-[-0.02em] text-[var(--color-bk-ink)]">
          Choose a new password
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-bk-muted)]">
          Pick something strong you haven&apos;t used here before.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="New password" htmlFor="password" error={fieldErrors.password}>
          <PasswordInput
            id="password"
            value={password}
            invalid={!!fieldErrors.password}
            onChange={(e) => {
              setPassword(e.target.value);
              // Editing the password can also resolve a prior mismatch.
              clearErrors("password", "confirm");
            }}
            placeholder="At least 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <PasswordStrength value={password} />
        </Field>

        <Field label="Confirm password" htmlFor="confirm-password" error={fieldErrors.confirm}>
          <PasswordInput
            id="confirm-password"
            value={confirm}
            invalid={!!fieldErrors.confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              clearErrors("confirm");
            }}
            placeholder="Re-enter your new password"
            required
            autoComplete="new-password"
          />
        </Field>

        {error && (
          <p className="text-sm font-medium text-[var(--color-bk-clay)]">{error}</p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-full text-sm font-semibold"
        >
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
