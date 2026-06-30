"use client";

import { BulgaAccounts } from "@/components/bulga/pages/accounts";
import { useBulgaChrome } from "@/components/bulga/chrome-context";
import type { AccountView } from "@/lib/types";

export function AccountsView({ accounts, netWorth, currency }: { accounts: AccountView[]; netWorth: number; currency: string }) {
  const { accent, theme, addAccount, editAccount } = useBulgaChrome();
  return (
    <BulgaAccounts
      accounts={accounts}
      netWorth={netWorth}
      currency={currency}
      accent={accent}
      theme={theme}
      onAdd={addAccount}
      onEdit={editAccount}
    />
  );
}
