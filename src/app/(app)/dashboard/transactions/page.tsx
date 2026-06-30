import { requireUser, currentPeriod, resolvePeriod, userCurrency } from "@/lib/dashboard-context";
import { getTransactions } from "@/lib/db/queries";
import { TransactionsView } from "@/components/bulga/pages/transactions-view";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const user = await requireUser();
  const { month, year } = resolvePeriod(await searchParams, currentPeriod());
  const [data, currency] = await Promise.all([
    getTransactions(user.id, { month, year }).catch(() => ({ transactions: [], total: 0, totalPages: 0 })),
    userCurrency(user.id),
  ]);
  return <TransactionsView transactions={data.transactions} currency={currency} />;
}
