import { requireUser, currentPeriod, dashboardOverview, userCurrency } from "@/lib/dashboard-context";
import { getAccounts } from "@/lib/db/queries";
import { AccountsView } from "@/components/bulga/pages/accounts-view";

export default async function AccountsPage() {
  const user = await requireUser();
  // Net worth is a present-day total, not a month-scoped figure — keep it on
  // today's period so browsing the month picker elsewhere never skews it.
  const { month, year } = currentPeriod();
  const [accounts, overview, currency] = await Promise.all([
    getAccounts(user.id).catch(() => []),
    dashboardOverview(user.id, month, year).catch(() => null),
    userCurrency(user.id),
  ]);
  return <AccountsView accounts={accounts} netWorth={overview?.netWorth ?? 0} currency={currency} />;
}
