import { requireUser, currentPeriod, resolvePeriod, userCurrency } from "@/lib/dashboard-context";
import { getTransactions, getAccountOptions } from "@/lib/db/queries";
import { TransactionsView } from "@/components/bulga/pages/transactions-view";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const user = await requireUser();
  const { month, year } = resolvePeriod(await searchParams, currentPeriod());
  const [data, accountOptions, currency] = await Promise.all([
    // High limit so the account filter + search operate over the whole month.
    getTransactions(user.id, { month, year, limit: 500 }).catch(() => ({ transactions: [], total: 0, totalPages: 0 })),
    getAccountOptions(user.id).catch(() => []),
    userCurrency(user.id),
  ]);
  return <TransactionsView transactions={data.transactions} accounts={accountOptions} currency={currency} />;
}
