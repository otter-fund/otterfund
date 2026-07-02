"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/bulga/card";
import { Wordmark } from "@/components/bulga/logo";
import { Field, TextInput, PasswordInput } from "@/components/bulga/form";
import { Button } from "@/components/ui/button";
import { GoogleAuthButton } from "@/components/auth/google-button";
import { GuillochePattern } from "@/components/bulga/guilloche";
import { BRAND_THEME } from "@/components/bulga/theme";

// useSearchParams() must sit under a Suspense boundary or `next build` errors on
// this route. The form is otherwise self-contained, so wrap the whole thing.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // If redirected here with ?error=..., surface it inline. useSearchParams reads
  // the URL during render (SSR-safe) — no effect + window.location needed.
  const hadRedirectError = useSearchParams().has("error");
  const [error, setError] = useState(
    hadRedirectError ? "Incorrect email or password. Please try again." : "",
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Incorrect email or password. Please try again.");
      setLoading(false);
      return;
    }

    // Full navigation so the proxy sees the fresh session cookie and routes to
    // dashboard or onboarding as appropriate.
    window.location.href = "/dashboard";
  }

  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <Link href="/" aria-label="Bulga home">
          <Wordmark size={34} />
        </Link>
        <p className="text-[13px] text-[var(--color-bk-muted)]">
          Sign in to your budget dashboard
        </p>
      </div>

      <Card className="relative overflow-hidden p-8">
        <GuillochePattern accent={BRAND_THEME.accent} accentDeep={BRAND_THEME.accentDeep} fade="right" opacity={0.13} />
        <div className="relative">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field label="Email" htmlFor="email">
            <TextInput
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <div className="mt-2 flex justify-end">
              <Link
                href="/forgot-password"
                className="text-[13px] font-medium text-[var(--color-bk-muted)] transition-colors hover:text-[var(--color-bk-ink)]"
              >
                Forgot password?
              </Link>
            </div>
          </Field>

          {error && (
            <p className="text-sm font-medium text-[var(--color-bk-clay)]">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-full text-sm font-semibold"
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <GoogleAuthButton label="Continue with Google" />

        <p className="text-center text-sm text-[var(--color-bk-muted)] mt-6">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-[var(--color-primary)] hover:underline"
          >
            Sign up
          </Link>
        </p>
        </div>
      </Card>
    </>
  );
}
