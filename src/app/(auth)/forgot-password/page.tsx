"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Field, TextInput } from "@/components/bulga/form";
import { Button } from "@/components/ui/button";
import { GuillocheSeal } from "@/components/bulga/guilloche";
import { BRAND_THEME } from "@/components/bulga/theme";

// Step 1 of the password-reset flow: request a recovery email. Supabase's
// resetPasswordForEmail never reveals whether the address is registered, and we
// always show the same "check your email" success — no account enumeration.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      // Land on the shared PKCE callback, which exchanges the ?code for a
      // (recovery) session and forwards to /reset-password. `next` is validated
      // against open-redirects in the callback route.
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    // Only surface transport/rate-limit failures. A missing account is NOT an
    // error here (Supabase returns success) — we never confirm existence.
    if (resetError) {
      setError("We couldn't send the reset email. Please try again in a moment.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="bk-enter flex flex-col items-center gap-5 text-center">
        <div className="h-16 w-16" aria-hidden="true">
          <GuillocheSeal accent={BRAND_THEME.accent} accentDeep={BRAND_THEME.accentDeep} label="✓" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--color-bk-ink)]">
            Check your email
          </h1>
          <p className="text-sm leading-relaxed text-[var(--color-bk-muted)]">
            If an account exists for{" "}
            <span className="font-semibold text-[var(--color-bk-ink)]">{email}</span>, we&apos;ve
            sent a link to reset your password. Open it to choose a new one.
          </p>
        </div>

        <Link
          href="/login"
          className="grid h-11 w-full place-items-center rounded-full bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
        >
          Back to sign in
        </Link>

        <p className="text-[13px] text-[var(--color-bk-muted)]">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-semibold text-[var(--color-primary)] hover:underline"
          >
            try again
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="bk-enter">
      <header className="mb-8">
        <h1 className="text-[27px] font-semibold tracking-[-0.02em] text-[var(--color-bk-ink)]">
          Reset your password
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-bk-muted)]">
          Enter your email and we&apos;ll send you a link to set a new one.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="Email" htmlFor="email">
          <TextInput
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
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
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-[var(--color-bk-muted)]">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-semibold text-[var(--color-primary)] hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
