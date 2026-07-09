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
} from "@/components/bulga/form";
import { Button } from "@/components/ui/button";
import { GoogleAuthButton } from "@/components/auth/google-button";

type FieldErrors = { name?: string; password?: string; confirm?: string };

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

    const cleanName = name.trim().slice(0, 80);
    const errors: FieldErrors = {};
    if (!cleanName) errors.name = "Please enter your name.";
    if (!passwordMeetsRules(password))
      errors.password = "Choose a password that meets all three requirements below.";
    if (confirm !== password) errors.confirm = "Passwords don't match.";

    if (Object.keys(errors).length > 0) {
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
    <div className="bk-enter">
      <header className="mb-8">
        <h1 className="text-[27px] font-semibold tracking-[-0.02em] text-[var(--color-bk-ink)]">
          Create your account
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-bk-muted)]">
          Start budgeting with Bulga. It only takes a minute.
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

        {error && (
          <p className="text-sm font-medium text-[var(--color-bk-clay)]">{error}</p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full font-semibold"
        >
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <GoogleAuthButton label="Sign up with Google" />

      <p className="mt-8 text-center text-sm text-[var(--color-bk-muted)]">
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
