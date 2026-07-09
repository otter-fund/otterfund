import { requireUser, userCurrency } from "@/lib/dashboard-context";
import { getAccounts, getInvestments } from "@/lib/db/queries";
import { InvestmentsView } from "@/components/otterfund/pages/investments-view";

export default async function InvestmentsPage() {
  const user = await requireUser();
  // The portfolio is built from the user's investment ACCOUNTS (getAccounts,
  // filtered to the "invest" group client-side); manual holdings are the
  // optional Positions layer.
  const [accounts, holdings, currency] = await Promise.all([
    getAccounts(user.id).catch(() => []),
    getInvestments(user.id).catch(() => []),
    userCurrency(user.id),
  ]);
  return <InvestmentsView accounts={accounts} holdings={holdings} currency={currency} />;
}
