"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/bulga/card";
import { Wordmark } from "@/components/bulga/logo";
import { Field, TextInput } from "@/components/bulga/form";
import { Button } from "@/components/ui/button";
import { GuillochePattern, GuillocheSeal } from "@/components/bulga/guilloche";
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

  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <Link href="/" aria-label="Bulga home">
          <Wordmark size={34} />
        </Link>
        {!sent && (
          <p className="text-[13px] text-[var(--color-bk-muted)]">
            Reset your password
          </p>
        )}
      </div>

      <Card className="relative overflow-hidden p-8">
        <GuillochePattern accent={BRAND_THEME.accent} accentDeep={BRAND_THEME.accentDeep} fade="right" opacity={0.13} />
        <div className="relative">
        {sent ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="w-16 h-16" aria-hidden="true">
              <GuillocheSeal accent={BRAND_THEME.accent} accentDeep={BRAND_THEME.accentDeep} label="✓" />
            </div>

            <div className="flex flex-col gap-2">
              <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-[var(--color-bk-ink)]">
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
              className="w-full h-11 grid place-items-center rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)] text-sm font-semibold transition-opacity hover:opacity-90"
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
        ) : (
          <>
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
                <p className="mt-1.5 text-center text-[12px] text-[var(--color-bk-faint)]">
                  We&apos;ll email you a link to set a new password.
                </p>
              </Field>

              {error && (
                <p className="text-sm font-medium text-[var(--color-bk-clay)]">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-full text-sm font-semibold"
              >
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>

            <p className="text-center text-sm text-[var(--color-bk-muted)] mt-6">
              Remembered it?{" "}
              <Link
                href="/login"
                className="font-semibold text-[var(--color-primary)] hover:underline"
              >
                Back to sign in
              </Link>
            </p>
          </>
        )}
        </div>
      </Card>
    </>
  );
}
