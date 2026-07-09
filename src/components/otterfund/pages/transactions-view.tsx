"use client";

import { useEffect } from "react";
import { OtterfundTransactions } from "@/components/otterfund/pages/transactions";
import { useOtterfundChrome } from "@/components/otterfund/chrome-context";
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
  const { accent, theme, editTransaction, refreshData, setTxCount } = useOtterfundChrome();
  // Report the selected period's total to the topbar subtitle (the count the
  // chrome can't know — it's this page's data). Full month total, not narrowed
  // by search/account filters, so the subtitle stays stable while filtering.
  useEffect(() => {
    setTxCount(transactions.length);
  }, [transactions.length, setTxCount]);
  return (
    <OtterfundTransactions
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
