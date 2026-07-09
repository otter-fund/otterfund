"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * "Continue with Google" for the login + register pages. Kicks off Supabase's
 * OAuth PKCE flow; the provider redirects back to /auth/callback, which exchanges
 * the code for a session. A first-time Google user gets their public.User profile
 * row created by the auth trigger (supabase/migrations) and lands on /onboarding;
 * a returning user is bounced on to /dashboard by the onboarding guard.
 *
 * Renders an "or" divider above itself so both auth pages share one identical
 * treatment — the only difference is the label.
 */
export function GoogleAuthButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogle() {
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Same callback the email-confirmation flow uses; it exchanges the
        // ?code for a session and forwards to /onboarding (its default `next`).
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    // On success the browser navigates to Google, so this line is only reached
    // when the provider is misconfigured or the call is rejected.
    if (oauthError) {
      setError("We couldn't start Google sign-in. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-[var(--color-bk-line)]" />
        <span className="text-xs text-[var(--color-bk-faint)]">or</span>
        <span className="h-px flex-1 bg-[var(--color-bk-line)]" />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleGoogle}
        disabled={loading}
        className="w-full font-semibold gap-2.5"
      >
        <GoogleG />
        {loading ? "Redirecting…" : label}
      </Button>

      {error && (
        <p className="text-sm font-medium text-[var(--color-bk-clay)]">{error}</p>
      )}
    </div>
  );
}

/** Official Google "G" mark (multicolor), sized to the button's icon slot. */
function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.6-.21-2.36H12v4.47h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.26-2.09 3.59-5.17 3.59-8.73Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.9l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.29a12 12 0 0 0 0 10.78l3.98-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.17 15.24 0 12 0A12 12 0 0 0 1.29 6.61l3.98 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}
