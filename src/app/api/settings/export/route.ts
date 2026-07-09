import { getApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  const [userData, accounts, transactions, goals, subscriptions, bills, budgets] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          monthlyIncome: true,
          currency: true,
          budgetTarget: true,
        },
      }),
      prisma.account.findMany({ where: { userId } }),
      prisma.transaction.findMany({
        where: { userId },
        include: { category: true },
        orderBy: { date: "desc" },
      }),
      prisma.goal.findMany({ where: { userId } }),
      prisma.subscription.findMany({ where: { userId } }),
      prisma.bill.findMany({ where: { userId } }),
      prisma.budget.findMany({
        where: { userId },
        include: { category: true },
      }),
    ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: userData,
    accounts,
    transactions: transactions.map((t) => ({
      ...t,
      categoryName: t.category?.name,
    })),
    goals,
    subscriptions,
    bills,
    budgets: budgets.map((b) => ({
      ...b,
      categoryName: b.category.name,
    })),
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=otterfund-export.json",
    },
  });
}
