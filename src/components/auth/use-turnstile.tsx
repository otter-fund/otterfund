"use client";

import { useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

// Cloudflare Turnstile site key. When unset the CAPTCHA is inert: no widget
// renders, callers send captchaToken: undefined, and with the Supabase Auth
// CAPTCHA toggle off every auth call behaves exactly as before. Turning it on
// takes BOTH this key AND the Supabase toggle — Supabase verifies the token
// server-side, so the *secret* lives in Supabase, not in this app.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Shared Turnstile integration for the password-based auth forms — sign-in,
 * sign-up, and password reset, the three endpoints Supabase guards when CAPTCHA
 * is enabled. In "Managed" mode the widget is invisible for normal users and
 * only challenges suspicious traffic.
 *
 * Returns the `widget` to render, the single-use `captchaToken` to spread into
 * the Supabase auth call's `options`, `pending` (true until the widget produces
 * a token — use it to disable the submit button), and `reset()` to re-arm the
 * widget after each attempt (Turnstile tokens are one-shot).
 */
export function useTurnstile() {
  const [token, setToken] = useState("");
  const ref = useRef<TurnstileInstance>(null);

  const widget = SITE_KEY ? (
    <Turnstile
      ref={ref}
      siteKey={SITE_KEY}
      onSuccess={setToken}
      onExpire={() => setToken("")}
      onError={() => setToken("")}
      // Pinned light — the auth forms always sit on a light card, so "auto"
      // (which follows the OS setting) would render a dark widget in dark mode.
      options={{ theme: "light" }}
      className="mx-auto"
    />
  ) : null;

  return {
    widget,
    captchaToken: SITE_KEY ? token : undefined,
    pending: !!SITE_KEY && !token,
    reset() {
      setToken("");
      ref.current?.reset();
    },
  };
}
