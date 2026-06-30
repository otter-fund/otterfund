import { requireUser, currentPeriod, resolvePeriod, userCurrency } from "@/lib/dashboard-context";
import { getSpendingData } from "@/lib/db/queries";
import { SpendingView } from "@/components/bulga/pages/spending-view";

export default async function SpendingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const user = await requireUser();
  const { month, year } = resolvePeriod(await searchParams, currentPeriod());
  const [spending, currency] = await Promise.all([
    getSpendingData(user.id, month, year).catch(() => []),
    userCurrency(user.id),
  ]);
  return <SpendingView spending={spending} currency={currency} />;
}
