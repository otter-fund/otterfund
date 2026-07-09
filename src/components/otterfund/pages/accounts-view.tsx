"use client";

import { OtterfundAccounts } from "@/components/otterfund/pages/accounts";
import { useOtterfundChrome } from "@/components/otterfund/chrome-context";
import type { AccountView } from "@/lib/types";

export function AccountsView({ accounts, netWorth, currency }: { accounts: AccountView[]; netWorth: number; currency: string }) {
  const { accent, theme, addAccount, connectBank, editAccount, refreshData } = useOtterfundChrome();
  return (
    <OtterfundAccounts
      accounts={accounts}
      netWorth={netWorth}
      currency={currency}
      accent={accent}
      theme={theme}
      onAdd={addAccount}
      onConnect={connectBank}
      onEdit={editAccount}
      onSynced={refreshData}
    />
  );
}
