"use client";

import { BulgaTransactions } from "@/components/bulga/pages/transactions";
import { useBulgaChrome } from "@/components/bulga/chrome-context";
import type { TransactionView } from "@/lib/types";

export function TransactionsView({ transactions, currency }: { transactions: TransactionView[]; currency: string }) {
  const { accent, theme, editTransaction } = useBulgaChrome();
  return (
    <BulgaTransactions
      transactions={transactions}
      currency={currency}
      accent={accent}
      theme={theme}
      onEdit={editTransaction}
    />
  );
}
