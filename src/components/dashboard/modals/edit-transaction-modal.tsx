"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/otterfund/form";
import { ConfirmButton } from "@/components/otterfund/confirm-button";
import { Trash2, ChevronDown, Check, RefreshCw } from "lucide-react";
import type { TransactionView } from "@/lib/types";
import { SUBSCRIPTION_CYCLES } from "@/lib/constants";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const CATEGORIES = /* GraphQL */ `query Categories { categories { name } }`;

const UPDATE_TRANSACTION = /* GraphQL */ `
  mutation UpdateTransaction($id: ID!, $input: TransactionUpdateInput!) {
    updateTransaction(id: $id, input: $input) { ok }
  }
`;

const DELETE_TRANSACTION = /* GraphQL */ `
  mutation DeleteTransaction($id: ID!) {
    deleteTransaction(id: $id) { ok }
  }
`;

interface EditTransactionModalProps {
  open: boolean;
  transaction: TransactionView | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditTransactionModal({
  open,
  transaction,
  onClose,
  onUpdated,
}: EditTransactionModalProps) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"debit" | "credit">("debit");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  // "Recurring subscription" toggle. `initialRecurring` lets us send the change
  // only when the user actually flips it, so an unrelated edit doesn't churn the
  // subscription list.
  const [isRecurring, setIsRecurring] = useState(false);
  const [initialRecurring, setInitialRecurring] = useState(false);
  const [cycle, setCycle] = useState<string>("Monthly");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    if (transaction && open) {
      setName(transaction.name);
      setAmount(String(Math.abs(transaction.amount)));
      setType(transaction.amount >= 0 ? "credit" : "debit");
      setCategory(transaction.category);
      setIsRecurring(Boolean(transaction.isRecurring));
      setInitialRecurring(Boolean(transaction.isRecurring));
      setCycle("Monthly");
      // Parse the display date back — we need the ISO date from the API
      setDate("");
      setError("");

      gqlClient
        .request(CATEGORIES)
        .then(({ categories }) =>
          setCategories(categories.map((c: { name: string }) => c.name)),
        )
        .catch(() => {});
    }
  }, [transaction, open]);

  const handleSave = () => {
    if (!transaction) return;
    setError("");
    startTransition(async () => {
      try {
        const input: Record<string, unknown> = {
          name,
          amount: Number(amount),
          type,
          category,
        };
        if (date) input.date = date;
        // Only send the recurring change when the user actually toggled it.
        if (isRecurring !== initialRecurring) {
          input.isRecurring = isRecurring;
          if (isRecurring) input.cycle = cycle;
        }

        await gqlClient.request(UPDATE_TRANSACTION, { id: transaction.id, input });

        onClose();
        onUpdated();
      } catch (e) {
        setError(errMessage(e));
      }
    });
  };

  const handleDelete = () => {
    if (!transaction) return;
    startTransition(async () => {
      try {
        await gqlClient.request(DELETE_TRANSACTION, { id: transaction.id });
        onClose();
        onUpdated();
      } catch {
        setError("Failed to delete");
      }
    });
  };

  // Render the Dialog even with no transaction: unmounting the Root here would
  // skip Base UI's enter/exit transitions (mounted-already-open pops in;
  // instant unmount kills the slide-out). The JSX reads only local state, and
  // every handler guards on `transaction`.
  const displayCategories =
    categories.length > 0
      ? categories
      : ["Groceries", "Dining Out", "Transport", "Bills", "Entertainment", "Health", "Subscriptions", "Income", "Other"];

  // Where the transaction came from — a synced bank feed vs. something the user
  // tracked themselves. "Synced" reuses the accent pill from the Accounts page;
  // manual/imported stay neutral. Read-only: the modal doesn't move transactions
  // between accounts.
  const sourceBadge =
    transaction?.source === "plaid"
      ? { label: "Synced", bg: "var(--accent)", fg: "var(--accent-foreground)" }
      : transaction?.source === "csv"
        ? { label: "Imported", bg: "var(--color-of-line-soft)", fg: "var(--color-of-muted)" }
        : { label: "Manual", bg: "var(--color-of-line-soft)", fg: "var(--color-of-muted)" };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-6 sm:p-9">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-[-0.02em] text-[var(--color-of-ink)]">
            Edit transaction
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-of-faint)] mb-1.5">
              Description
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="of-field"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-of-faint)] mb-1.5">
              Account
            </label>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--color-of-line)] bg-[var(--color-of-canvas)] px-3.5 py-2.5">
              <span className="min-w-0 truncate text-sm font-medium text-[var(--color-of-ink)]">
                {transaction?.accountName || "No linked account"}
              </span>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.02em]"
                style={{ background: sourceBadge.bg, color: sourceBadge.fg }}
              >
                {sourceBadge.label}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-of-faint)] mb-1.5">
                Amount
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="of-field"
              />
            </div>
            <div className="w-32">
              <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-of-faint)] mb-1.5">
                Type
              </label>
              <div className="relative">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "debit" | "credit")}
                  className="of-field-select"
                >
                  <option value="debit">Expense</option>
                  <option value="credit">Income</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--color-of-muted)]" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-of-faint)] mb-1.5">
              Category
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="of-field-select"
              >
                {displayCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--color-of-muted)]" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-of-faint)] mb-1.5">
              Date (leave blank to keep current)
            </label>
            <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {/* Recurring subscription — checking this tracks the merchant in the
              Recurring subscriptions section; the cadence picker appears once on. */}
          <div>
            <button
              type="button"
              onClick={() => setIsRecurring((v) => !v)}
              aria-pressed={isRecurring}
              className="flex w-full items-start gap-3 rounded-xl border border-[var(--color-of-line)] px-3.5 py-3 text-left transition-colors hover:bg-[var(--color-of-hover)]"
            >
              <span
                className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors"
                style={{
                  borderColor: isRecurring ? "var(--primary)" : "var(--color-of-line)",
                  background: isRecurring ? "var(--primary)" : "transparent",
                }}
              >
                {isRecurring && (
                  <Check size={13} strokeWidth={3} className="text-[var(--primary-foreground)]" />
                )}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-of-ink)]">
                  <RefreshCw size={13} strokeWidth={2.2} className="text-[var(--color-of-muted)]" />
                  Recurring subscription
                </span>
                <span className="block text-[12.5px] text-[var(--color-of-muted)] mt-0.5">
                  Track this merchant in your Recurring subscriptions.
                </span>
              </span>
            </button>
            {isRecurring && (
              <div className="mt-3 pl-8">
                <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-of-faint)] mb-1.5">
                  Billing cycle
                </label>
                <div className="relative">
                  <select
                    value={cycle}
                    onChange={(e) => setCycle(e.target.value)}
                    className="of-field-select"
                  >
                    {SUBSCRIPTION_CYCLES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--color-of-muted)]" />
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="text-sm text-[var(--color-of-clay)] font-medium mt-2">{error}</p>
        )}

        <div className="flex items-center gap-3 mt-7">
          <ConfirmButton
            onConfirm={handleDelete}
            icon={Trash2}
            confirmLabel="Are you sure?"
            busyLabel="Deleting…"
            busy={isPending}
            restLabel="Delete transaction"
            armedLabel="Confirm delete transaction"
          />
          <Button size="sm" onClick={handleSave} disabled={isPending} className="ml-auto">
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
