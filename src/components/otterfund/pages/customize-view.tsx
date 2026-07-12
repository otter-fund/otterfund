"use client";

// otterfund — DEV plan-preview switcher (/dev/customize).
//
// Admin-only: flip the signed-in account between free / standard / pro to eyeball
// paywalls + locked UI without a real Stripe checkout. Writes via the setDevPlan
// server action (re-checks isAdmin) and refreshes so the whole shell re-reads it.
// Laid out in the Brand-kit language: a surface section with an h3 + subtitle
// over the same selectable picker-cards used by the accent-scheme grid there.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { useOtterfundChrome } from "@/components/otterfund/chrome-context";
import { setDevPlan } from "@/lib/actions/dev";
import { PLAN_TIERS, PLAN_META, type PlanTier } from "@/lib/plans";

const muted = "oklch(54% 0.012 80)";

export function CustomizeView({ currentPlan }: { currentPlan: PlanTier }) {
  const { theme } = useOtterfundChrome();
  const router = useRouter();
  const [plan, setPlan] = useState<PlanTier>(currentPlan);
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<PlanTier | null>(null);

  const switchTo = (next: PlanTier) => {
    if (next === plan || pending) return;
    setTarget(next);
    startTransition(async () => {
      await setDevPlan(next);
      setPlan(next);
      setTarget(null);
      router.refresh(); // re-read plan across the shell (paywalls, locked panels)
    });
  };

  return (
    <div className="of-enter of-page">
      <section
        style={{
          background: "var(--color-of-surface)",
          border: "1px solid var(--color-of-line)",
          borderRadius: 20,
          padding: 28,
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Plan Preview</h3>
        <p style={{ margin: "0 0 22px", fontSize: 13.5, color: muted }}>
          Flip your own account between tiers to check paywalls and locked features. Raw override, not
          a Stripe checkout, so keep it to test accounts.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${PLAN_TIERS.length}, 1fr)`, gap: 12 }}>
          {PLAN_TIERS.map((tier) => {
            const active = plan === tier;
            const loading = pending && target === tier;
            return (
              <button
                key={tier}
                type="button"
                onClick={() => switchTo(tier)}
                disabled={pending}
                aria-pressed={active}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 14,
                  background: active ? "oklch(98% 0.004 90)" : "#fff",
                  border: active ? `1.5px solid ${theme.accent}` : "1px solid var(--color-of-line)",
                  cursor: pending ? "default" : "pointer",
                  transition: "border-color .15s, background .15s",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: active ? theme.accentDeep : "var(--color-of-ink)" }}>
                  {PLAN_META[tier].name}
                </span>
                {loading ? (
                  <Loader2 size={16} className="of-spin" style={{ color: theme.accentDeep }} />
                ) : active ? (
                  <Check size={16} style={{ color: theme.accentDeep }} />
                ) : null}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
