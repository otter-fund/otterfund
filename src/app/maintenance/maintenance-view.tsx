"use client";

// The maintenance screen. Public visitors see a calm "we'll be back" message on
// the otterfund canvas; a quiet "Team access" disclosure reveals a password
// field so devs can unlock the site for their own browser. All on-brand: warm
// canvas + paper grain, Newsreader display type, the shared field system, and a
// pill button.

import { useState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { LOGO_CORAL } from "@/components/otterfund/theme";
import { Wordmark } from "@/components/otterfund/wordmark";
import { Field, PasswordInput } from "@/components/otterfund/form";
import { Button } from "@/components/ui/button";
// The maintenance illustration (two beavers on a raft + an otter holding a "?").
// Recolored coral by using it as a CSS mask over a solid block, the same way
// <LogoMark> recolors the otter mark.
import maintenanceMark from "./maintenance-mark.svg";

const MARK_MASK = `url(${maintenanceMark.src}) center / contain no-repeat`;

export function MaintenanceView({ unlockable }: { unlockable: boolean }) {
  const [showAccess, setShowAccess] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/maintenance/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "That password is not correct.");
        setLoading(false);
        return;
      }
      // The cookie is set; a full navigation lets the proxy read it and route
      // to the real app.
      window.location.href = "/";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="of-paper relative flex min-h-screen flex-col items-center justify-center bg-[var(--color-of-canvas)] px-6 py-16">
      <div className="of-enter w-full max-w-[440px] text-center">
        <div className="flex justify-center">
          <div
            aria-hidden
            style={{
              width: "min(300px, 78vw)",
              aspectRatio: "1519 / 790",
              backgroundColor: LOGO_CORAL,
              WebkitMask: MARK_MASK,
              mask: MARK_MASK,
            }}
          />
        </div>

        <h1
          className="of-num mt-8 text-balance text-[34px] font-medium leading-[1.08] tracking-[-0.02em] text-[var(--color-of-ink)]"
        >
          Back in a splash
        </h1>
        <p className="mx-auto mt-4 max-w-[320px] text-balance text-[15px] leading-relaxed text-[var(--color-of-muted)]">
          <Wordmark />{" "}is taking a quick dip. We&apos;ll surface again in a moment.
        </p>

        {unlockable && (
          <div className="mt-10">
            {!showAccess ? (
              <Button
                type="button"
                variant="link"
                onClick={() => setShowAccess(true)}
                className="text-[13px] !text-[var(--color-of-faint)] hover:!text-[var(--color-of-ink)] hover:opacity-100"
              >
                <Lock className="h-3.5 w-3.5" />
                Team access
              </Button>
            ) : (
              <form
                onSubmit={handleUnlock}
                className="of-enter mx-auto flex max-w-[340px] flex-col gap-4 rounded-[20px] border border-[var(--color-of-line)] bg-[var(--color-of-surface)] p-6 text-left"
              >
                <Field
                  label="Admin password"
                  htmlFor="maintenance-password"
                  error={error || undefined}
                >
                  <PasswordInput
                    id="maintenance-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="••••••••"
                    autoComplete="off"
                    autoFocus
                    invalid={!!error}
                    required
                  />
                </Field>
                <Button type="submit" disabled={loading} className="w-full font-semibold">
                  {loading ? "Unlocking…" : "Enter site"}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>

      <footer className="of-enter mt-16 text-[12px] text-[var(--color-of-faint)]">
        © {new Date().getFullYear()} <Wordmark />
      </footer>
    </main>
  );
}
