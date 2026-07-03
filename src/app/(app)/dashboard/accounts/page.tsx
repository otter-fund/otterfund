import { requireUser, userCurrency } from "@/lib/dashboard-context";
import { getAccounts } from "@/lib/db/queries";
import { AccountsView } from "@/components/bulga/pages/accounts-view";

export default async function AccountsPage() {
  const user = await requireUser();
  const [accounts, currency] = await Promise.all([
    getAccounts(user.id).catch(() => []),
    userCurrency(user.id),
  ]);
  // Same figure the overview computes: sum of non-excluded account balances
  // (getAccounts already applies the synced-vs-manual balance rule).
  const netWorth = accounts.reduce((sum, a) => sum + (a.excluded ? 0 : a.balance), 0);
  return <AccountsView accounts={accounts} netWorth={netWorth} currency={currency} />;
}
