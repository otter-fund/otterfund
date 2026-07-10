"use client";

// otterfund — ALLOCATE SAVINGS modal.
//
// The manual counterpart to the old one-tap auto-split. It lists every goal
// (emoji · name · priority); tapping one expands it to show how much surplus is
// still available this month and a field to hand-place a slice of it onto that
// goal. The server clamps each amount to what's actually available and to the
// goal's remaining need, so the figures here are a guide — the truth is
// re-fetched after each allocation (the parent refreshes and passes fresh props).

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PRIORITY_LEVELS, toPriorityLevel } from "@/components/otterfund/priority-picker";
import type { GoalPlanItem } from "@/lib/types";
import type { OtterfundTheme } from "@/components/otterfund/theme";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const ASSIGN_SURPLUS_TO_GOAL = /* GraphQL */ `
  mutation AssignSurplusToGoal($goalId: ID!, $amount: Float!) {
    assignSurplusToGoal(goalId: $goalId, amount: $amount) { ok }
  }
`;

function priorityName(p: number): string {
  return PRIORITY_LEVELS.find((l) => l.value === toPriorityLevel(p))?.label ?? "Medium";
}

export function AllocateSavingsModal({
  open,
  onClose,
  onAllocated,
  goals,
  assignable,
  currency,
  theme,
}: {
  open: boolean;
  onClose: () => void;
  /** Fires after a successful allocation so the parent can re-fetch. */
  onAllocated: () => void;
  goals: GoalPlanItem[];
  /** Real cash still free to place this month. */
  assignable: number;
  currency: string;
  theme: OtterfundTheme;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Extra cash on hand that our prediction didn't see (a side gig, a gift, cash
  // in the account we don't track). The user can top up what's allocatable so
  // they can put it to work now; the server still clamps each allocation.
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraInput, setExtraInput] = useState("");
  const extra = Math.max(0, Number(extraInput) || 0);
  const effectiveAssignable = assignable + extra;

  const fmt0 = (n: number) =>
    new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-CA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Math.abs(n));

  const toggle = (id: string) => {
    setError("");
    setAmount("");
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleAllocate = (goal: GoalPlanItem) => {
    const value = Number(amount);
    if (!value || value <= 0) {
      setError("Enter an amount to allocate.");
      return;
    }
    if (value > effectiveAssignable) {
      setError(`Only ${fmt0(effectiveAssignable)} is available to allocate.`);
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await gqlClient.request(ASSIGN_SURPLUS_TO_GOAL, { goalId: goal.id, amount: value });
        setAmount("");
        onAllocated();
      } catch (e) {
        setError(errMessage(e));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px] p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-[-0.02em] text-[var(--color-of-ink)]">
            Allocate savings
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[var(--color-of-muted)]">
            Choose a goal and place some of this month’s surplus onto it.
          </DialogDescription>
        </DialogHeader>

        {/* available banner */}
        <div
          className="mt-1 rounded-2xl px-4 py-3"
          style={{ background: theme.accentTint, border: `1px solid ${theme.accentTintBorder}` }}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-[0.07em]" style={{ color: theme.accentDeep }}>
              Available to allocate
            </span>
            <span className="of-num text-[20px] font-medium" style={{ color: theme.accentDeep }}>
              {fmt0(effectiveAssignable)}
            </span>
          </div>
          {extra > 0 && (
            <p className="mt-1 text-[11.5px]" style={{ color: theme.accentDeep, opacity: 0.75 }}>
              Includes {fmt0(extra)} you added on top of this month’s surplus.
            </p>
          )}
        </div>

        {/* top-up note: more came in than we predicted */}
        {extraOpen ? (
          <div
            className="mt-2 rounded-2xl border px-4 py-3"
            style={{ borderColor: "var(--color-of-line)", background: "var(--color-of-surface)" }}
          >
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--color-of-faint)]">
              Extra cash to allocate
            </label>
            <div className="flex items-end gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={extraInput}
                autoFocus
                onChange={(e) => {
                  setExtraInput(e.target.value);
                  if (error) setError("");
                }}
                placeholder="0"
                className="of-field flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-[44px]"
                onClick={() => {
                  setExtraInput("");
                  setExtraOpen(false);
                }}
              >
                {extra > 0 ? "Done" : "Cancel"}
              </Button>
            </div>
            <p className="mt-2 text-[12px] text-[var(--color-of-muted)]">
              Add money that landed outside our forecast — a side gig, a gift, cash sitting in your account.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setExtraOpen(true)}
            className="mt-2 text-left text-[12px] font-medium text-[var(--color-of-muted)] underline decoration-[var(--color-of-line)] underline-offset-2 transition-colors hover:text-[var(--color-of-ink)]"
          >
            Got more than we predicted? Add extra cash to allocate.
          </button>
        )}

        {effectiveAssignable <= 0 ? (
          <p className="mt-4 text-[13px] text-[var(--color-of-muted)]">
            You’ve allocated all of this month’s surplus. More becomes available as income comes in.
          </p>
        ) : (
          <div className="of-scroll mt-4 flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1">
            {goals.map((g) => {
              const expanded = expandedId === g.id;
              const room = g.remaining <= 0;
              return (
                <div
                  key={g.id}
                  className="rounded-2xl border transition-colors"
                  style={{
                    borderColor: expanded ? theme.accentBorder : "var(--color-of-line)",
                    background: expanded ? theme.accentTint : "var(--color-of-surface)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggle(g.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[20px]"
                      style={{ background: "var(--color-of-canvas)", border: "1px solid var(--color-of-line-soft)" }}
                    >
                      {g.emoji || "🎯"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold text-[var(--color-of-ink)]">{g.name}</span>
                        {room && (
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                            style={{ background: theme.accentTint, color: theme.accentDeep }}
                          >
                            Funded
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-[var(--color-of-muted)]">
                        {priorityName(g.priority)} priority
                        {!room && <> · {fmt0(g.remaining)} to go</>}
                      </span>
                    </span>
                    <span className="of-num shrink-0 text-[14px]" style={{ color: theme.accentDeep }}>
                      {g.pct}%
                    </span>
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4">
                      {room ? (
                        <p className="rounded-xl bg-[var(--color-of-canvas)] px-3 py-2.5 text-[13px] text-[var(--color-of-muted)]">
                          This goal is fully funded. Nothing more to allocate here.
                        </p>
                      ) : (
                        (() => {
                          const cap = Math.min(effectiveAssignable, g.remaining);
                          return (
                        <>
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--color-of-faint)]">
                                Amount
                              </label>
                              <input
                                type="number"
                                inputMode="decimal"
                                value={amount}
                                autoFocus
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const n = Number(raw);
                                  // Clamp over-the-cap entries down to the max and flag it,
                                  // but leave partial/empty input ("", "1.") untouched so typing works.
                                  if (raw !== "" && Number.isFinite(n) && n > cap) {
                                    setAmount(String(cap));
                                    setError(`Capped at ${fmt0(cap)} — the most this goal can take right now.`);
                                  } else {
                                    setAmount(raw);
                                    if (error) setError("");
                                  }
                                }}
                                placeholder="0"
                                className="of-field"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-[44px]"
                              onClick={() => {
                                setAmount(String(cap));
                                if (error) setError("");
                              }}
                            >
                              Max
                            </Button>
                          </div>
                          <p className="mt-2 text-[12px] text-[var(--color-of-muted)]">
                            Up to {fmt0(cap)}, capped by your surplus and what this goal still needs.
                          </p>
                          {error && (
                            <p className="mt-2 text-[13px] font-medium text-[var(--color-of-clay)]">{error}</p>
                          )}
                          <Button
                            size="sm"
                            className="mt-3 w-full"
                            disabled={isPending}
                            onClick={() => handleAllocate(g)}
                          >
                            {isPending ? "Allocating…" : `Allocate to ${g.name}`}
                          </Button>
                        </>
                          );
                        })()
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex">
          <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
