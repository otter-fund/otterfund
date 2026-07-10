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
    if (value > assignable) {
      setError(`Only ${fmt0(assignable)} is available to allocate.`);
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
          className="mt-1 flex items-baseline justify-between rounded-2xl px-4 py-3"
          style={{ background: theme.accentTint, border: `1px solid ${theme.accentTintBorder}` }}
        >
          <span className="text-[12px] font-semibold uppercase tracking-[0.07em]" style={{ color: theme.accentDeep }}>
            Available to allocate
          </span>
          <span className="of-num text-[20px] font-medium" style={{ color: theme.accentDeep }}>
            {fmt0(assignable)}
          </span>
        </div>

        {assignable <= 0 ? (
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
                                  setAmount(e.target.value);
                                  if (error) setError("");
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
                              onClick={() => setAmount(String(Math.min(assignable, g.remaining)))}
                            >
                              Max
                            </Button>
                          </div>
                          <p className="mt-2 text-[12px] text-[var(--color-of-muted)]">
                            Up to {fmt0(Math.min(assignable, g.remaining))}, capped by your surplus and what this goal still needs.
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
