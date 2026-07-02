"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const CATEGORIES = /* GraphQL */ `query Categories { categories { name } }`;

const CREATE_TRANSACTION = /* GraphQL */ `
  mutation CreateTransaction($input: TransactionCreateInput!) {
    createTransaction(input: $input) { ok }
  }
`;

interface AddTransactionModalProps {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

export function AddTransactionModal({
  open,
  onClose,
  onAdded,
}: AddTransactionModalProps) {
  const [form, setForm] = useState({
    name: "",
    amount: "",
    category: "Groceries",
    type: "debit",
    date: new Date().toISOString().split("T")[0],
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      gqlClient
        .request(CATEGORIES)
        .then(({ categories }) =>
          setCategories(categories.map((c: { name: string }) => c.name)),
        )
        .catch(() => {
          // Fallback categories
          setCategories([
            "Groceries",
            "Dining Out",
            "Transport",
            "Bills",
            "Entertainment",
            "Health",
            "Subscriptions",
            "Income",
            "Other",
          ]);
        });
    }
  }, [open]);

  const set =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = () => {
    if (!form.name || !form.amount) {
      setError("Please fill in all fields");
      return;
    }

    setError("");
    startTransition(async () => {
      try {
        await gqlClient.request(CREATE_TRANSACTION, {
          input: {
            name: form.name,
            amount: Number(form.amount),
            category: form.category,
            type: form.type,
            date: form.date,
          },
        });

        // Reset form and close
        setForm({
          name: "",
          amount: "",
          category: "Groceries",
          type: "debit",
          date: new Date().toISOString().split("T")[0],
        });
        onClose();
        onAdded?.();
      } catch (e) {
        setError(errMessage(e));
      }
    });
  };

  const displayCategories =
    categories.length > 0
      ? categories
      : [
          "Groceries",
          "Dining Out",
          "Transport",
          "Bills",
          "Entertainment",
          "Health",
          "Subscriptions",
          "Income",
          "Other",
        ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[480px] p-9">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-[-0.02em] text-[var(--color-bk-ink)]">
            Add Transaction
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1.5">
              Description
            </label>
            <input
              placeholder="e.g. Tim Hortons"
              value={form.name}
              onChange={set("name")}
              className="bk-field"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1.5">
              Amount
            </label>
            <input
              type="number"
              placeholder="0.00"
              value={form.amount}
              onChange={set("amount")}
              className="bk-field"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={form.date}
              onChange={set("date")}
              className="bk-field bk-field-date"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1.5">
              Category
            </label>
            <div className="relative">
              <select
                value={form.category}
                onChange={set("category")}
                className="bk-field-select"
              >
                {displayCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--color-bk-muted)]" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1.5">
              Type
            </label>
            <div className="relative">
              <select
                value={form.type}
                onChange={set("type")}
                className="bk-field-select"
              >
                <option value="debit">Expense</option>
                <option value="credit">Income</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--color-bk-muted)]" />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-[var(--color-bk-clay)] font-medium mt-2">{error}</p>
        )}

        <div className="flex gap-3 mt-7">
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isPending} className="flex-[2]">
            {isPending ? "Adding..." : "Add Transaction"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
