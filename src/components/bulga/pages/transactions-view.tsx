"use client";

import { useEffect } from "react";
import { BulgaTransactions } from "@/components/bulga/pages/transactions";
import { useBulgaChrome } from "@/components/bulga/chrome-context";
import type { TransactionView } from "@/lib/types";

export function TransactionsView({
  transactions,
  accounts,
  currency,
}: {
  transactions: TransactionView[];
  accounts: { id: string; name: string }[];
  currency: string;
}) {
  const { accent, theme, editTransaction, refreshData, setTxCount } = useBulgaChrome();
  // Report the selected period's total to the topbar subtitle (the count the
  // chrome can't know — it's this page's data). Full month total, not narrowed
  // by search/account filters, so the subtitle stays stable while filtering.
  useEffect(() => {
    setTxCount(transactions.length);
  }, [transactions.length, setTxCount]);
  return (
    <BulgaTransactions
      transactions={transactions}
      accounts={accounts}
      currency={currency}
      accent={accent}
      theme={theme}
      onEdit={editTransaction}
      onBulkDeleted={refreshData}
    />
  );
}
