"use client";

// otterfund tour card — the on-brand replacement for NextStepjs's DefaultCard.
//
// Rendered by <NextStep> in a portal OUTSIDE the shell, so it can't read the
// chrome context. It leans entirely on the CSS custom properties the chrome
// publishes on :root (--of-accent, --accent, --accent-foreground) plus the
// static --color-of-* tokens — so it stays in the active accent with no prop
// threading. Built from otterfund primitives (surface card, pill Buttons,
// Wordmark, Newsreader figures) so the first thing a new user sees is on-brand.

import type { CardComponentProps } from "nextstepjs";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function TourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}: CardComponentProps) {
  const isWelcome = currentStep === 0;
  const isFinal = currentStep === totalSteps - 1;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div
      // `color` drives the arrow's currentColor fill so its pointer matches the
      // card surface; the arrow self-hides on centered (no-selector) steps.
      style={{
        position: "relative",
        color: "var(--color-of-surface)",
        width: isWelcome ? 360 : 312,
        maxWidth: "calc(100vw - 32px)",
        background: "var(--color-of-surface)",
        border: "1px solid var(--color-of-line)",
        borderRadius: 20,
        boxShadow:
          "0 1px 2px oklch(20% 0.02 80 / 0.05), 0 24px 56px -18px oklch(20% 0.02 80 / 0.34)",
        padding: isWelcome ? "28px 26px 24px" : "20px 22px 18px",
        fontFamily: "var(--font-ui)",
        textAlign: isWelcome ? "center" : "left",
      }}
    >
      {/* ── Header: icon chip + editorial step counter ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isWelcome ? "center" : "space-between",
          marginBottom: isWelcome ? 18 : 15,
        }}
      >
        {step.icon != null && (
          <span
            aria-hidden="true"
            style={
              isWelcome
                ? { display: "inline-flex" }
                : {
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: 13,
                    background: "var(--accent)",
                    color: "var(--accent-foreground)",
                    flexShrink: 0,
                  }
            }
          >
            {step.icon}
          </span>
        )}

        {!isWelcome && (
          <span
            className="of-num"
            aria-label={`Step ${currentStep + 1} of ${totalSteps}`}
            style={{ fontSize: 13, letterSpacing: "0.02em", color: "var(--color-of-faint)", whiteSpace: "nowrap" }}
          >
            <span style={{ color: "var(--color-of-ink)", fontWeight: 500 }}>{pad2(currentStep + 1)}</span>
            {" / "}
            {pad2(totalSteps)}
          </span>
        )}
      </div>

      {/* ── Title ── */}
      <h3
        style={{
          margin: 0,
          fontSize: isWelcome ? 22 : 17,
          fontWeight: 650,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          color: "var(--color-of-ink)",
        }}
      >
        {step.title}
      </h3>

      {/* ── Body ── */}
      <div
        style={{
          margin: isWelcome ? "9px auto 0" : "8px 0 0",
          maxWidth: isWelcome ? 300 : undefined,
          fontSize: 13.5,
          lineHeight: 1.58,
          color: "var(--color-of-muted)",
        }}
      >
        {step.content}
      </div>

      {/* ── Progress rail (hidden on the welcome card) ── */}
      {!isWelcome && (
        <div
          aria-hidden="true"
          style={{
            marginTop: 18,
            height: 3,
            borderRadius: 999,
            background: "var(--color-of-line-soft)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              borderRadius: 999,
              background: "var(--of-accent)",
              transition: "width 420ms cubic-bezier(.22,.61,.36,1)",
            }}
          />
        </div>
      )}

      {/* ── Controls ── */}
      <div
        style={{
          display: "flex",
          flexDirection: isWelcome ? "column" : "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: isWelcome ? 4 : 10,
          marginTop: isWelcome ? 22 : 14,
        }}
      >
        {isWelcome ? (
          <>
            <Button size="sm" onClick={nextStep} className="w-full">
              Take the tour
            </Button>
            {skipTour && (
              <button
                type="button"
                onClick={skipTour}
                style={{
                  marginTop: 4,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "var(--color-of-faint)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 8px",
                }}
              >
                Skip for now
              </button>
            )}
          </>
        ) : (
          <>
            {/* Left: low-emphasis skip (nothing to skip on the last step). */}
            {!isFinal && skipTour ? (
              <button
                type="button"
                onClick={skipTour}
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "var(--color-of-faint)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 2px",
                }}
              >
                Skip tour
              </button>
            ) : (
              <span />
            )}

            {/* Right: Back + primary. */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {currentStep > 0 && (
                <Button variant="ghost" size="sm" onClick={prevStep} aria-label="Previous step">
                  <ArrowLeft data-icon="inline-start" size={15} strokeWidth={2} />
                  Back
                </Button>
              )}
              <Button size="sm" onClick={nextStep}>
                {isFinal ? "Finish" : "Next"}
                {!isFinal && <ArrowRight size={15} strokeWidth={2} />}
              </Button>
            </div>
          </>
        )}
      </div>

      {arrow}
    </div>
  );
}
