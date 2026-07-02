"use client";

// Bulga — onboarding brand panel.
//
// The left half of the onboarding split-screen, on the shared evergreen
// banknote field. It greets the user by name and doubles as a live progress
// map: before a path is chosen it lists what to expect; once they're in a flow
// it shows a vertical step tracker (done / active / upcoming) that follows the
// wizard's state.

import { Check, type LucideIcon } from "lucide-react";

import {
  BrandPanelShell,
  PanelLockup,
  PANEL_INK,
  PANEL_MUTED,
  PANEL_ACCENT,
  PANEL_LINE,
} from "@/components/bulga/brand-panel";

export interface PanelStep {
  label: string;
  icon: LucideIcon;
}

const EXPECT = [
  "Takes about two minutes",
  "Everything stays editable later",
  "Private by default — your data is yours",
];

export function OnboardingBrandPanel({
  userName,
  steps,
  step,
}: {
  userName: string;
  /** The active flow's steps, or null on the mode-chooser screen. */
  steps: PanelStep[] | null;
  step: number;
}) {
  const first = userName.split(" ")[0] || "there";

  return (
    <BrandPanelShell>
      <PanelLockup />

      {/* ── greeting + progress ── */}
      <div className="relative flex max-w-[440px] flex-1 flex-col justify-center">
        <div
          className="bk-enter"
          style={{
            animationDelay: "80ms",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: PANEL_ACCENT,
          }}
        >
          Set up your budget
        </div>
        <h2
          className="bk-enter mt-4 text-balance"
          style={{
            animationDelay: "160ms",
            fontFamily: "var(--font-num), Georgia, serif",
            fontWeight: 500,
            fontSize: "clamp(30px, 3.4vw, 42px)",
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: PANEL_INK,
          }}
        >
          Welcome, <em style={{ fontStyle: "italic", color: PANEL_ACCENT }}>{first}.</em>
        </h2>
        <p
          className="bk-enter mt-4 mb-10"
          style={{ animationDelay: "220ms", fontSize: 14.5, lineHeight: 1.6, color: PANEL_MUTED, maxWidth: 360 }}
        >
          {steps
            ? "A calm, guided setup. You can jump back to any completed step."
            : "Three ways to begin — pick whichever fits. We'll do the math from here."}
        </p>

        {steps ? <StepTracker steps={steps} step={step} /> : <ExpectList />}
      </div>
    </BrandPanelShell>
  );
}

function ExpectList() {
  return (
    <ul className="bk-enter relative flex flex-col gap-4" style={{ animationDelay: "280ms" }}>
      {EXPECT.map((line) => (
        <li key={line} className="flex items-center gap-3" style={{ color: PANEL_INK }}>
          <span
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
            style={{ background: "oklch(90% 0.09 158 / 0.16)" }}
          >
            <Check size={13} strokeWidth={2.8} style={{ color: PANEL_ACCENT }} />
          </span>
          <span style={{ fontSize: 14 }}>{line}</span>
        </li>
      ))}
    </ul>
  );
}

function StepTracker({ steps, step }: { steps: PanelStep[]; step: number }) {
  return (
    <ol className="bk-enter relative flex flex-col gap-1" style={{ animationDelay: "280ms" }}>
      {/* the spine — a single line the nodes sit over */}
      <span
        aria-hidden
        className="absolute left-[15px] top-4 bottom-4 w-px"
        style={{ background: `${PANEL_LINE}` , opacity: 0.28 }}
      />
      {steps.map((s, i) => {
        const state = i < step ? "done" : i === step ? "active" : "upcoming";
        const Icon = s.icon;
        return (
          <li key={s.label} className="relative flex items-center gap-3.5 py-1.5">
            <span
              className="grid h-[31px] w-[31px] shrink-0 place-items-center rounded-full transition-colors"
              style={{
                background:
                  state === "done"
                    ? PANEL_ACCENT
                    : state === "active"
                      ? "oklch(90% 0.09 158 / 0.16)"
                      : "oklch(24% 0.05 158)",
                border:
                  state === "active"
                    ? `1.5px solid ${PANEL_ACCENT}`
                    : state === "upcoming"
                      ? `1px solid ${PANEL_LINE}33`
                      : "none",
              }}
            >
              {state === "done" ? (
                <Check size={15} strokeWidth={2.8} style={{ color: "oklch(24% 0.05 158)" }} />
              ) : (
                <Icon
                  size={15}
                  strokeWidth={2}
                  style={{ color: state === "active" ? PANEL_ACCENT : PANEL_MUTED }}
                />
              )}
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: state === "active" ? 600 : 500,
                color: state === "upcoming" ? PANEL_MUTED : PANEL_INK,
              }}
            >
              {s.label}
            </span>
            {state === "active" && (
              <span
                className="ml-1 rounded-full px-2 py-0.5"
                style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "oklch(90% 0.09 158 / 0.16)", color: PANEL_ACCENT }}
              >
                Now
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
