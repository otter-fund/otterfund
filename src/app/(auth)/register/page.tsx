"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Field,
  TextInput,
  PasswordInput,
  PasswordStrength,
  passwordMeetsRules,
} from "@/components/otterfund/form";
import { Button } from "@/components/ui/button";
import { GoogleAuthButton } from "@/components/auth/google-button";
import { Wordmark } from "@/components/otterfund/wordmark";

type FieldErrors = { name?: string; password?: string; confirm?: string };

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Terms + Privacy acceptance is required to create an account (email or
  // Google). Returns true when accepted; otherwise flags the checkbox.
  function requireAgreement() {
    if (agreed) return true;
    setAgreeError(true);
    return false;
  }

  // Clear a field's inline error as the user edits it (otterfund form pattern).
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

    const cleanName = name.trim().slice(0, 80);
    const errors: FieldErrors = {};
    if (!cleanName) errors.name = "Please enter your name.";
    if (!passwordMeetsRules(password))
      errors.password = "Choose a password that meets all three requirements below.";
    if (confirm !== password) errors.confirm = "Passwords don't match.";

    // Terms acceptance is mandatory — flag it independently of the field errors.
    const agreedOk = requireAgreement();

    if (Object.keys(errors).length > 0 || !agreedOk) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // `name` lands in raw_user_meta_data; the auth trigger copies it into the
        // public.User profile row (see supabase/migrations).
        data: { name: cleanName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      // Generic message — never echo Supabase's raw error, which can reveal
      // whether an email is already registered (account enumeration).
      setError("We couldn't complete sign-up. Check your details and try again.");
      setLoading(false);
      return;
    }

    // With email confirmation on, there's no session yet — send them to a calm
    // confirmation page (not an inline error). With it off (recommended for
    // local dev), a session is returned immediately and we go to onboarding.
    if (!data.session) {
      window.location.href = `/verify-email?email=${encodeURIComponent(email)}`;
      return;
    }

    window.location.href = "/onboarding";
  }

  return (
    <div className="of-enter">
      <header className="mb-8">
        <h1 className="text-[27px] font-semibold tracking-[-0.02em] text-[var(--color-of-ink)]">
          Create your account
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-of-muted)]">
          Start budgeting with <Wordmark />. It only takes a minute.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="Name" htmlFor="name" error={fieldErrors.name}>
          <TextInput
            id="name"
            type="text"
            value={name}
            invalid={!!fieldErrors.name}
            onChange={(e) => {
              setName(e.target.value);
              clearErrors("name");
            }}
            placeholder="Your name"
            autoComplete="name"
            autoFocus
            required
          />
        </Field>

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

        <Field label="Password" htmlFor="password" error={fieldErrors.password}>
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
            placeholder="Re-enter your password"
            required
            autoComplete="new-password"
          />
        </Field>

        {/* Required Terms + Privacy acceptance. Gates both the email submit
            (handleSubmit) and Google sign-up (GoogleAuthButton beforeStart). */}
        <div>
          <label htmlFor="agree" className="flex cursor-pointer items-start gap-2.5">
            <input
              id="agree"
              type="checkbox"
              checked={agreed}
              aria-invalid={agreeError}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) setAgreeError(false);
              }}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-[var(--color-primary)]"
            />
            <span className="text-[13px] leading-relaxed text-[var(--color-of-muted)]">
              I agree to <Wordmark />&rsquo;s{" "}
              <Link href="/terms" target="_blank" className="font-medium text-[var(--color-primary)] hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-[var(--color-primary)] hover:underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {agreeError && (
            <p className="mt-1.5 text-[13px] font-medium text-[var(--color-of-clay)]">
              Please agree to the Terms of Service and Privacy Policy to continue.
            </p>
          )}
        </div>

        {error && (
          <p className="text-sm font-medium text-[var(--color-of-clay)]">{error}</p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full font-semibold"
        >
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <GoogleAuthButton label="Sign up with Google" beforeStart={requireAgreement} />

      <p className="mt-8 text-center text-sm text-[var(--color-of-muted)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-[var(--color-primary)] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
